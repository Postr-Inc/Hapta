import RequestHandler from "./core/controllers/Requests";
import Pocketbase from 'pocketbase'
import fs from 'fs'
let args = process.argv.slice(2);
let port =  process.env.PORT || 8080;
if(!fs.existsSync(process.cwd() + '/config.ts')){
    console.log("⛔ Please create a config.ts file in the root directory")
    process.exit(1)
}
let config = await import(process.cwd() + '/config.ts').then((res) => res.default) 
 
import eventsource from 'eventsource'
import CrudManager from "./core/controllers/CrudManager";
import { TokenManager } from "./core/utils/jwt/JWT";
import { ErrorCodes, ErrorHandler } from "./core/controllers/ErrorHandler";
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
    case !config.ratelimits:
        console.log("Please set the ratelimits in your config file")
        process.exit(1)
        break;
    default:
        break;
}
export let pb  = new Pocketbase(process.env.DB_URL || "")

pb.admins.client.autoCancellation(false)
try { 
    await pb.admins.authWithPassword(process.env.ADMIN_EMAIL || "", process.env.ADMIN_PASSWORD || "")
    console.log("Authentication successful")
} catch (error) {
    throw new Error(new ErrorHandler(null).handle({code: ErrorCodes.AUTHORIZATION_FAILED}).message) 
}


let ws = null; 
let reqHandler = new RequestHandler(ws,   pb,  config)
 
export const server =  Bun.serve({
    port: port,
    development: config.developmentMode || true,
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