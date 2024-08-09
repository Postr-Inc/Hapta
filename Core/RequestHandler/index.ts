import { WSContext } from "hono/ws";
import { MessageTypes } from "../../Enums/MessageTypes";
import CrudManager from "../CrudManager";
import RecommendationAlgorithmHandler from "../RecommendationAlgorithmHandler";

export default class RequestHandler {
    crudManager: CrudManager;
    constructor() {
       this.crudManager = new CrudManager()
    }
    async handleMessage(ws: WSContext, data: {type: string, callback: string, payload: any}, token: string) {
       const {  type, callback, payload } = data; 
       switch(type){
         case MessageTypes.LIST:  
          if(payload.options.hasOwnProperty('recommended')){
            console.log("true")
            // return recommended content
            let recommendedHandler = new RecommendationAlgorithmHandler(await this.crudManager.list(payload, token) as any);
            let { items:recommended, totalItems, totalPages } = await recommendedHandler.process();
            ws.send(JSON.stringify({ opCode: 200, payload: recommended, callback, totalItems, totalPages }), {
              compress: true
            })
            return true;
          }
          let { _payload, opCode, totalItems, totalPages } = await this.crudManager.list(payload, token) as any; 
          ws.send(JSON.stringify({ opCode, payload: _payload, callback, totalItems, totalPages }), {
            compress: true
          })
         break;
         case MessageTypes.UPDATE:
            let { _payload: payloadUpdate, opCode: opCodeUpdate} = await this.crudManager.update(payload, token) as any;
         case MessageTypes.GET:
            console.log(payload)
            let { _payload: payloadGet, opCode: opCodeGet} = await this.crudManager.get(payload, token) as any;
            ws.send(JSON.stringify({ opCode: opCodeGet, payload: payloadGet, callback }), {
              compress: true
            })
         break;
         case MessageTypes.CREATE:
            let { _payload: payloadCreate, opCode: opCodeCreate} = await this.crudManager.create(payload, token) as any;
            ws.send(JSON.stringify({ opCode: opCodeCreate, payload: payloadCreate, callback }), {
              compress: true
            })
         default:
             ws.send(JSON.stringify({ opCode: 404, payload: { message: "Invalid Request" }, callback }), {
                compress: true
             })
       }
    }
    
}