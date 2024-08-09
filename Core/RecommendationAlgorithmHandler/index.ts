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
  constructor(data: { _payload: Post[] , totalPages: number, totalItems: number }) { 
    this.data = data._payload as Post[];
    this.totalPages = data.totalPages;
    this.totalItems = data.totalItems
    cache.set(`recommendationData`, this.data);
  }

  process() {
    let recommended = this.data.filter((item: Post) => {  
        const input = textToVector(item.content, vocabulary);
        const output = neuralNetwork.forward(input);
        const predictedIndex = output.indexOf(Math.max(...output));
        const summary = summaryVocabulary[predictedIndex] as string; 
        item.rank = this.rank(item);
        if(item.expand.author.hasOwnProperty("expand") && item.expand.author.expand.hasOwnProperty("TypesOfContentPosted") && !item.expand.author.expand.TypesOfContentPosted.includes(summary)){
            item.rank -= Ranks.offTopicPenalty;
        }  
        if(item.links && item.links.length > 0){
            let spam = item.links.filter((link: string) => data.includes(link));
            if(spam.length > 0){
                item.rank -= Ranks.spamLinksPenalty;
            }else{
                item.rank += Ranks.hasLinkBoost;
            }
        } 
        return item.rank > Ranks.minScore || item.rank >= Ranks.maxScore;
    });
    
    // Sort posts by rank in descending order
    recommended = recommended.sort((a, b) => b.rank - a.rank);
    

    return {
        items:recommended,
        totalPages: this.totalPages,
        totalItems: this.totalItems
    }
  }

  rank(item: Post){
     let rank = 0; 
     item.isRepost  ? rank += Ranks.repostsBoost : void 0;
     rank += item.likes.length * Ranks.likesBoost;
     rank += item.people_who_reposted.length * Ranks.repostsBoost;  
     rank += Math.floor(item.expand.author.followers.length / 100) * Ranks.authorFollowersBoost; 
     rank += Math.floor(item.blocks.length / 100) * Ranks.authorBlocksPenalty; 
     rank += Math.floor(item.expand.author.muted.length / 100) * Ranks.authorMutesPenalty;
     item.isNSFW ?  rank -= Ranks.isNSFWPenalty : void 0;  
     item.files.length > 0 ? rank += Ranks.hasMediaBoost : void 0; 
     item.expand.author.TypeOfContentPosted.length < 1 ? rank -= Ranks.offTopicPenalty : void 0;
     return rank;
  }
}
