import RequestHandler from "./core/controllers/Requests";
import Pocketbase from 'pocketbase'
let args = process.argv.slice(2);
let port =  process.env.PORT || 8080;
import config from "./config.json" with {type: "json"}
import eventsource from 'eventsource'
import CrudManager from "./core/controllers/CrudManager";
import { TokenManager } from "./core/utils/jwt/JWT";
globalThis.EventSource = eventsource as any;
switch(true){
    case !process.env.DB_URL:
        console.log("Please set the DB_URL environment variable")
        process.exit(1)
        break;
    case !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD:
        console.log("Please set the ADMIN_EMAIL and ADMIN_PASSWORD environment variables")
        process.exit(1)
        break;
    default:
        break;
}
export let pb  = new Pocketbase(process.env.DB_URL || "")

pb.admins.client.autoCancellation(false)
try {
    console.log("Authenticating", process.env.ADMIN_EMAIL)
    await pb.admins.authWithPassword(process.env.ADMIN_EMAIL || "", process.env.ADMIN_PASSWORD || "")
    console.log("Authentication successful")
} catch (error) {
    console.log("Authentication failed", error)
    process.exit(1)
}


let ws = null; 
let reqHandler = new RequestHandler(ws,   pb,  config)
 
export const server =  Bun.serve({
    port: port,
    fetch(req: any, server: any) {
      const success = server.upgrade(req);
      if (success) {
        // Bun automatically returns a 101 Switching Protocols
        // if the upgrade succeeds
        return undefined;
      } 
      return new Response("Hello world!");
       
    },
    websocket: {
     
 
      open(ws) {
        reqHandler.ws = () => ws;
      },
      async message(ws, message) {
         reqHandler.ws = () => ws;
         let data = JSON.parse(message)
         if(data.type === 'authSession'){
            console.log("Authenticating session", data.session)
            ws.subscribe(data.session) 
            return;
         }
         reqHandler.handleRequest(message)
      },
      close(ws) {
        new CrudManager(pb, config, new TokenManager(pb)) 
      },
    },
  });
   
console.log(`
           
     __  __            __       
     / / / /___ _____  / /_____ _
    / /_/ / __ / __ \/ __/ __ / /
   / __  / /_/ / /_/ / /_/ /_/ / 
  /_/ /_/\__,_/ .___/\__/\__,_/  
               
         
 Version: 1.0.0
 
 Gateway is running on port  ${server.port}  
`)