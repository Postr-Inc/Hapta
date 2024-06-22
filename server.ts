//@ts-nocheck
import RequestHandler from "./core/controllers/Requests";
import Pocketbase from 'pocketbase'
import fs from 'fs'
let args = process.argv.slice(2);
let port =  process.env.PORT || 8080;
if(!fs.existsSync(process.cwd() + '/config.ts')){
    console.log("⛔ Please create a config.ts file in the root directory")
    process.exit(1)
}
globalThis.version = "1.0.3"
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
    case !process.env.JWT_SECRET:
        console.log("Please set the JWT_SECRET environment variable")
        process.exit(1) 
    case process.env.SSL_ENABLED == 'true' && (!fs.existsSync('./certs/private.pem') || !fs.existsSync('./certs/public.pem')):
        console.log("Please generate SSL certificates in the certs directory - private.pem and public.pem ( these have to pertain to the domain of your app)")
        process.exit(1)
    default:
        break;
}
export let pb  = new Pocketbase(process.env.DB_URL || "")

pb.admins.client.autoCancellation(false)
try { 
    await pb.admins.authWithPassword(process.env.ADMIN_EMAIL || "", process.env.ADMIN_PASSWORD || "")
    console.log("Authentication successful")
} catch (error) {
    throw new Error(new ErrorHandler({type:'auth'}).handle({code: ErrorCodes.AUTHORIZATION_FAILED}).message) 
}


let ws = null; 
let reqHandler = new RequestHandler(ws,   pb,  config)
export const server =  Bun.serve({
    port: port,
    development: config.developmentMode || true,  
    ...(process.env.SSL_ENABLED == 'true' ? {
      tls:{
        key: Bun.file('./certs/private.pem'),
        cert: Bun.file('./certs/public.pem')
      }
    } : {}),
    async fetch(req, server: any) {
      const success = server.upgrade(req);
      let url = new URL(req.url) 
      if (success) { 
        return new Response("Connected", {status: 200})
      } 
      if(url.pathname === '/'){
        return new Response(JSON.stringify({
          message: "Hapta server is running",
          // @ts-ignore
          version: globalThis.version || "1.0.0"  
        }), {status: 200})
      }
      if(url.pathname === '/oauth'){
        let body = JSON.parse(req.body as any) 
      } 
      if(url.pathname.startsWith('/read')){
         let token = req.headers.get('Authorization')
         if(!token || token !== process.env.HAPTA_ADMIN_KEY) return new Response("Unauthorized", {status: 401})
         let collection = url.pathname.split('/')[2]
         let id = url.pathname.split('/')[3] 
         try {
           let data = await reqHandler.crudManager.read({isAdmin: true, collection: collection, id: id, token, expand:["author", "comments", "likes"]})  
          return new Response(JSON.stringify(data), {status: 200, headers: {'Content-Type': 'application/json'}})
         } catch (error) {
            return new Response("Not found", {status: 404})
         }
      }
      
      return new  Response("Not found", {status: 404})
       
    },
    websocket: {
     
 
      open(ws) {
        reqHandler.ws = () => ws;
      },
      async message(ws: any, message: any) {
         reqHandler.ws = () => ws;
         let data = JSON.parse(message) 
         if(data.type === 'authSession'){
            console.log("Authenticating session", data.session)
            ws.subscribe(data.session) 
            // @ts-ignore;
            globalThis.ws = ws; 
            reqHandler.ws = () => ws;
            console.log("Session " + data.session + " successfully authenticated ✅")
            ws.send(JSON.stringify({type: 'authSession', message: 'success'}))
            return;
         }
         reqHandler.handleRequest(message)
      },
      close(ws) {
        new CrudManager(pb, config, new TokenManager(process.env.JWT_SECRET || ""))  
      },
    },
  });
   
console.log(`
           
     __  __            __       
     / / / /___ _____  / /_____ _
    / /_/ / __ / __ \/ __/ __ / /
   / __  / /_/ / /_/ / /_/ /_/ / 
  /_/ /_/\__,_/ .___/\__/\__,_/  
               Version: ${globalThis.version || "1.0.0"}
               Port: ${server.port} 
               SSL: ${process.env.SSL_ENABLED == 'true' ? 'Enabled' : 'Disabled'}
`)
