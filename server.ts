import RequestHandler from "./core/controllers/Requests";
import Pocketbase from 'pocketbase'
let args = process.argv.slice(2);
let port =  process.env.PORT || 8080;
let config = require(args[0] || './config.json')
import eventsource from 'eventsource'
import CrudManager from "./core/controllers/CrudManager";
import { TokenManager } from "./core/utils/jwt/JWT";
import WebSocket, { WebSocketServer } from 'ws';
// @ts-ignore
global.EventSource = eventsource  
// @ts-ignore
global.shouldLog = true
switch (true) {
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
let reqHandler = new RequestHandler(ws,  pb, config)
// @ts-ignore
const server =  new WebSocketServer({ port: port });
server.on('connection', (ws: any) => {
  ws.on('message', (message: any) => {
         reqHandler.ws = () => ws;
         reqHandler.handleRequest(message)
  });
});

 
console.log(`
           
     __  __            __       
     / / / /___ _____  / /_____ _
    / /_/ / __ / __ \/ __/ __ / /
   / __  / /_/ / /_/ / /_/ /_/ / 
  /_/ /_/\__,_/ .___/\__/\__,_/  
               
         
 Version: 1.0.0
 
 Gateway is running on port  ${port}
 `)