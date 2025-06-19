import { Post } from "../../Enums/RecordTypes/post";
import { cache, neuralNetwork, pb, vocabulary } from "../../src";
import { NeuralNetwork, textToVector, summaryVocabulary } from "../Ai";
import { Account_Types } from "./Account_Types";
import Ranks from "./Ranks";
//@ts-ignore
import data from "./data/spam.json"
export default class RecommendationAlgorithmHandler {
  data: Post[];
  totalPages: number;
  totalItems: number;

  constructor(data: { _payload: Post[], totalPages: number, totalItems: number }) {
    this.data = data._payload;
    this.totalPages = data.totalPages;
    this.totalItems = data.totalItems;
     
  }

  process() {
    let recommended = this.data.filter((item: Post) => {
      item.rank = 0;

      const input = textToVector(item.content, vocabulary);
      const output = neuralNetwork.forward(input);
      const summary = summaryVocabulary[output.indexOf(Math.max(...output))];

      const postAgeDays = (Date.now() - new Date(item.created).getTime()) / (1000 * 60 * 60 * 24);
      if (postAgeDays > 30) item.rank -= Ranks.oldPostPenalty ?? 0.5;

      item.rank = this.rank(item, summary);

      const authorTypes = item.expand?.author?.expand?.TypesOfContentPosted;
      if (Array.isArray(authorTypes) && !authorTypes.includes(summary)) {
        item.rank -= Ranks.offTopicPenalty;
      }

      if (item.links?.length > 0) {
        const spam = item.links.filter((link: string) => data.includes(link));
        item.rank += spam.length > 0 ? -Ranks.spamLinksPenalty : Ranks.hasLinkBoost;
      }

      console.log(`Post ${item.id} ranked ${item.rank}`);
 
      return item.rank >= Ranks.minScore;
    });

    recommended = recommended.sort((a, b) => b.rank - a.rank);

    return {
      items: recommended,
      totalPages: Math.max(1, Math.ceil(recommended.length / this.totalPages)),
      totalItems: recommended.length
    };
  }

  rank(item: Post, summary: string) {
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
 
    const postAgeDays = (Date.now() - new Date(item.created).getTime()) / (1000 * 60 * 60 * 24);
    if (postAgeDays <= 7) {
      rank += Ranks.is7daysOld;
    }
 
    if (item.isNSFW) rank -= Ranks.isNSFWPenalty;
    if (item.files?.length > 0) rank += Ranks.hasMediaBoost;
    rank -= Math.floor((item.blocks?.length ?? 0) / 100) * Ranks.authorBlocksPenalty;

    return rank;
  }
}

