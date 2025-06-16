import { Post } from "../../Enums/RecordTypes/post";
import { cache, neuralNetwork, pb, vocabulary } from "../../src";
import { NeuralNetwork, textToVector, summaryVocabulary } from "../Ai";
import { Account_Types } from "./Account_Types";
import Ranks from "./Ranks";
//@ts-ignore
import data from "./data/spam.json"
export default class RecommendationAlgorithmHandler {
  data: any[];
  totalPages: number;
  totalItems: number;
  constructor(data: { _payload: Post[], totalPages: number, totalItems: number }) {
    this.data = data._payload as Post[];
    this.totalPages = data.totalPages;
    this.totalItems = data.totalItems
    cache.set(`recommendationData`, this.data);
  }

  process() {
    let recommended = this.data.filter((item: Post) => {
      const input = textToVector(item.content, vocabulary);
      const output = neuralNetwork.forward(input);
      const summary = summaryVocabulary[output.indexOf(Math.max(...output))];
      item.rank = 0
      const postAgeDays = (Date.now() - new Date(item.created).getTime()) / (1000 * 60 * 60 * 24); // Number of days since the post was created
      if (postAgeDays > 30) {
        item.rank -= Ranks.oldPostPenalty ?? 100; // Use a default penalty if not defined
      }
      item.rank = this.rank(item);
      if (item.expand.author.hasOwnProperty("expand") && item.expand.author.expand.hasOwnProperty("TypesOfContentPosted") && !item.expand.author.expand.TypesOfContentPosted.includes(summary)) {
        item.rank -= Ranks.offTopicPenalty;
      }
      // Penalize old posts

      if (item.links && item.links.length > 0) {
        let spam = item.links.filter((link: string) => data.includes(link));
        if (spam.length > 0) {
          item.rank -= Ranks.spamLinksPenalty;
        } else {
          item.rank += Ranks.hasLinkBoost;
        }
      }
      return item.rank > Ranks.minScore || item.rank >= Ranks.maxScore;
    });

    // Sort posts by rank in descending order
    recommended = recommended.sort((a, b) => b.rank - a.rank);
    var data = recommended.sort((a: any, b: any) => {
      const dateA = new Date(a.created).getTime();
      const dateB = new Date(b.created).getTime();
      return dateB - dateA;
    });

    return {
      items: recommended,
      totalPages: Math.round(
        recommended.length / this.totalPages),
      totalItems: recommended.length
    }
  }

  rank(item: Post) {
    let rank = item.rank
    item.isRepost ? rank += Ranks.repostsBoost : void 0;
    rank += item.likes.length * Ranks.likesBoost;
    rank += item.people_who_reposted.length * Ranks.repostsBoost;
    rank -= Math.floor(item.blocks.length / 100) * Ranks.authorBlocksPenalty;
    item.isNSFW ? rank -= Ranks.isNSFWPenalty : void 0;
    item.files.length > 0 ? rank += Ranks.hasMediaBoost : void 0;
    const postAgeDays = (Date.now() - new Date(item.created).getTime()) / (1000 * 60 * 60 * 24);
    if (postAgeDays <= 7) {
      rank += Ranks.is7daysOld
      console.log("7 day old boost")
    }
    if (!item.expand.author) {
      console.log(item)
      return rank
    };
    rank += Math.floor(item.expand.author?.followers.length / 100) * Ranks.authorFollowersBoost;
    rank -= Math.floor(item.expand?.author.muted.length / 100) * Ranks.authorMutesPenalty;
    item.expand?.author.TypeOfContentPosted.length < 1 ? rank -= Ranks.offTopicPenalty : void 0;
    return rank;
  }
}
