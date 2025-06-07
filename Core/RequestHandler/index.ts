import { WSContext } from "hono/ws";
import { MessageTypes } from "../../Enums/MessageTypes";
import CrudManager from "../CrudManager";
import RecommendationAlgorithmHandler from "../RecommendationAlgorithmHandler";
import { pb } from "../../src";

export default class RequestHandler {
    crudManager: CrudManager;
    constructor() {
      //@ts-ignore
       this.crudManager = new CrudManager(cache, pb);
    }
    async handleMessage(data: {type: string, callback: string, payload: any, ws: any}, token: string) {
       const {  type, callback, payload, ws } = data;   
       switch(type){
         case MessageTypes.LIST:  
          if(payload.options.hasOwnProperty('recommended') && payload.options.recommended){ 
            // return recommended content
            let list = await this.crudManager.list(payload, token) as any;
            if(list.opCode !== 200){ 
               return  {opCode: list.opCode, payload: list._payload, }
            }
               
            let recommendedHandler = new RecommendationAlgorithmHandler({ _payload: list._payload, totalPages: list.totalPages, totalItems: list.totalItems });

            let { items:recommended, totalItems, totalPages } = await recommendedHandler.process();
            return {
               opCode: 200,
               payload: recommended,
               totalItems: list.totalItems,
               totalPages: list.totalPages
            } 
          }
          let { _payload, opCode, totalItems, totalPages } = await this.crudManager.list(payload, token) as any; 
           
          return { opCode, payload: _payload, totalItems, totalPages } 
         case MessageTypes.DELETE:
            let { _payload: payloadDelete, opCode: opCodeDelete} = await this.crudManager.delete(payload, token) as any;
            return { opCode: opCodeDelete, payload: payloadDelete }
         case MessageTypes.DEEP_SEARCH:
            let { _payload: payloadDeepSearch, opCode: opCodeDeepSearch} = await this.crudManager.deepSearch(payload, token) as any;
            return { opCode: opCodeDeepSearch, payload: payloadDeepSearch }
         case MessageTypes.UPDATE: 
            let { _payload: payloadUpdate, opCode: opCodeUpdate} = await this.crudManager.update(payload, token) as any;
             
            return { opCode: opCodeUpdate, payload: payloadUpdate } 
         case MessageTypes.GET: 
            let { _payload: payloadGet, opCode: opCodeGet} = await this.crudManager.get(payload, token) as any; 
            return {opCode:opCodeGet, payload: payloadGet}
         break;
         case MessageTypes.CREATE:
            let { _payload: payloadCreate, opCode: opCodeCreate} = await this.crudManager.create(payload, token) as any;
           
            return { opCode: opCodeCreate, payload: payloadCreate }
            break;
         case MessageTypes.SUBSCRIBE:
            let { _payload: payloadSubscribe, opCode: opCodeSubscribe } = await this.crudManager.subscribe(payload, ws, token) as any;
            return { opCode: opCodeSubscribe, payload: payloadSubscribe }
         case MessageTypes.UNSUBSCRIBE:
            let { _payload: payloadUnsubscribe, opCode: opCodeUnsubscribe } = await this.crudManager.unsubscribe(ws, token) as any;
            return { opCode: opCodeUnsubscribe, payload: payloadUnsubscribe }
         default: 
             
             return { opCode: 404, payload: { message: "Invalid Request" } }
       }
    }
    
}