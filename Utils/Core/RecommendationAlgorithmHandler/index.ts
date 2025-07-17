import { Post } from "../../Enums/RecordTypes/post";
import { cache, neuralNetwork, pb, rqHandler, vocabulary } from "../../../src/index"
import { NeuralNetwork, textToVector, summaryVocabulary } from "../Ai";
import { Account_Types } from "./Account_Types";
import Ranks from "./Ranks";
//@ts-ignore
import data from "./data/spam.json"
export default class RecommendationAlgorithmHandler {
  data: Post[];
  totalPages: number;
  totalItems: number;
  userId: string;
  userMetrics: any;
  userToken?: string;

  constructor(data: { _payload: Post[], totalPages: number, totalItems: number, userId: string, token?: string }) {
    this.userId = data.userId;
    this.userToken = data.token;
    this.data = data._payload;
    this.totalPages = data.totalPages;
    this.totalItems = data.totalItems;
    this.userMetrics = {}; 
    this.initUserMetrics();
  }

  async initUserMetrics() {
    this.userMetrics = await rqHandler.crudManager.list({
      collection: "statistic_tracking",
      options: {
        filter: `user.id="${this.userId}"`,
        expand: ["user", "viewed_hashtags"],
        sort: "-created",
      },
      cacheKey: `statistic_tracking-${this.userId}`,
      page: 1,
      limit: 1,
    }, this.userToken ?? "").then((data) => { 
      return Array.isArray(data._payload) && data._payload.length ? data._payload[0] : {
        user: { id: this.userId },
        viewed_hashtags: [],
        viewed_profiles: [],
        posts_liked: [],
        posts_bookmarked: [],
        commented_on_post: [],
        followed_after_post_view: []
      };
    }).catch((err) => {
      console.error("Error fetching user metrics:", err);
      return {
        user: { id: this.userId },
        viewed_hashtags: [],
        viewed_profiles: [],
        posts_liked: [],
        posts_bookmarked: [],
        commented_on_post: [],
        followed_after_post_view: []
      };
    });

    return this.userMetrics;
  }

  async process(metrics: any) {
    let recommended = this.data.filter(async (item: Post) => {

      item.rank = 0;

      const input = textToVector(item.content, vocabulary);
      const output = neuralNetwork.forward(input);
      const summary = summaryVocabulary[output.indexOf(Math.max(...output))];
      item.summary = summary; 
 

      const postAgeDays = (Date.now() - new Date(item.created).getTime()) / (1000 * 60 * 60 * 24);
      if (postAgeDays > 30) item.rank -= Ranks.oldPostPenalty ?? 0.5;

      item.rank = this.rank(item, summary, metrics);

      const authorTypes = item.expand?.author?.expand?.TypesOfContentPosted;
      if (Array.isArray(authorTypes) && !authorTypes.includes(summary)) {
        item.rank -= Ranks.offTopicPenalty;
      }

      if ((item.links?.length ?? 0) > 0) {
        const spam = (item.links ?? []).filter((link: string) => data.includes(link));
        item.rank += spam.length > 0 ? -Ranks.spamLinksPenalty : Ranks.hasLinkBoost;
      }


      return item.rank >= Ranks.minScore;
    });

    recommended = recommended.sort((a, b) => b.rank - a.rank);

    return {
      items: recommended,
      totalPages: Math.max(1, Math.ceil(recommended.length / this.totalPages)),
      totalItems: recommended.length
    };
  }

  rank(item: Post, summary: string, metrics: any) {
    let rank = item.rank ?? 0;

    rank += item.isRepost ? Ranks.repostsBoost : 0;
    rank += (item.likes?.length ?? 0) * Ranks.likesBoost;
    rank += (item.people_who_reposted?.length ?? 0) * Ranks.repostsBoost;

    const author = item.expand?.author;
    if (author) {
      rank += Math.floor((author.followers?.length ?? 0) / 100) * Ranks.authorFollowersBoost;
      rank -= Math.floor((author.muted?.length ?? 0) / 100) * Ranks.authorMutesPenalty;

      if (!Array.isArray(author.TypeOfContentPosted) || author.TypeOfContentPosted.length === 0) {
        rank -= Ranks.offTopicPenalty;
      }
    }

    if (metrics && metrics.posts_liked && metrics.posts_liked?.some(async (postId: string) => {  
      const likedPost =  await rqHandler.crudManager.get<Post>({
        cacheKey: `post-${postId}`,
        collection: "posts",
        id: postId,
        expand: ["author", "expand.author.TypesOfContentPosted"]
      }, this.userToken ?? "")  
      //@ts-ignore
      const input = textToVector(likedPost._payload.content, vocabulary);
      const output = neuralNetwork.forward(input);
      const likedSummary = summaryVocabulary[output.indexOf(Math.max(...output))];
      return likedSummary === summary;
    })) {
      rank += Ranks.likesBoost; // indirect boost
    }

    const daysOld = Math.floor((Date.now() - new Date(item.created).getTime()) / (1000 * 60 * 60 * 24));
    if (daysOld <= 7) {
      rank += Ranks.is7daysOldBoost;
    } else {
      rank -= (daysOld - 7) * Ranks.oldPostPenalty;
    }

    if (item.isNSFW) rank -= Ranks.isNSFWPenalty;
    if (item.links?.some(link => data.includes(link))) {
      rank += Ranks.spamLinksPenalty;
    }

    rank -= Math.floor((item.expand.author.blockedBY?.length ?? 0) / 100) * Ranks.authorBlocksPenalty;

    if (metrics && item.hashtags?.some(h => metrics.viewed_hashtags.includes(h))) {
      rank += Ranks.hasTrendingHashtagBoost;
    }

    return rank;
  }
}

