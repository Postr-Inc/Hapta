import RequestHandler from "./core/controllers/Requests";
import Pocketbase from 'pocketbase'
import Bun from 'bun';
import eventsource from 'eventsource';
import CrudManager from "./core/controllers/CrudManager";
import { TokenManager } from "./core/utils/jwt/JWT";

globalThis.EventSource = eventsource as any;

let args = process.argv.slice(2);
let port = process.env.PORT || 8080;
import config from "./config.json" with {type: "json"};

switch (true) {
  case !process.env.DB_URL:
    console.log("Please set the DB_URL environment variable");
    process.exit(1);
    break;
  case !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD:
    console.log("Please set the ADMIN_EMAIL and ADMIN_PASSWORD environment variables");
    process.exit(1);
    break;
  default:
    break;
}

export let pb = new Pocketbase(process.env.DB_URL || "");

pb.admins.client.autoCancellation(false);

try {
  console.log("Authenticating", process.env.ADMIN_EMAIL);
  await pb.admins.authWithPassword(process.env.ADMIN_EMAIL || "", process.env.ADMIN_PASSWORD || "");
  console.log("Authentication successful");
} catch (error) {
  console.log("Authentication failed", error);
  process.exit(1);
}

let ws = null;
let reqHandler = new RequestHandler(ws, pb, config);

const logMemory = () => {
  const ramUsage = process.memoryUsage();
  for (const key in ramUsage) {
    console.log(`${key}: ${ramUsage[key] / 1024 / 1024} MB \n`);
  }
};

const logServerStatus = (status: string) => {
  console.log(`Server Status: ${status}`);
};

const logRequest = (request: string) => {
  console.log(`Incoming Request: ${request}`);
};

export const server = Bun.serve({
  port: port,
  fetch(req: any, server: any) {
    const success = server.upgrade(req);
    if (success) {
      logServerStatus('\nWebSocket Connection Established');
      return undefined;
    }

    logRequest(`${req.method} ${req.url}`);
    // handle HTTP request normally
    globalThis.req = req;
    return new Response("Hello world!");
  },
  websocket: {
    open(ws) {
      reqHandler.ws = () => ws;
      reqHandler.handleStatuses(); 
    },
    async message(ws, message) {
      reqHandler.ws = () => ws;
      let data = JSON.parse(message);
      if (data.type === 'authSession') {
        ws.subscribe(data.session);
        console.log('Subscribed to session', data.session);
        return;
      }
      reqHandler.handleRequest(message); 
    },
    close(ws) {
      new CrudManager(pb, config, new TokenManager(pb)).unsubscribe('*');
      logServerStatus('WebSocket Connection Closed');
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
`);

setInterval(() => {
  logMemory();
}, 10000);
