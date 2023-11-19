import Pocketbase from 'pocketbase/cjs';
import WebSocket, { WebSocketServer } from 'ws';
import eventsource from 'eventsource';
import './router.js';
import dotenv from 'dotenv';
import { Requests } from './controllers/Requests.js';

dotenv.config();
global.EventSource = eventsource;

export default class Hapta {
  constructor(data = {shouldLog: false, Init: {email: "", password: "", DbUrl: ""}, Port: 8080, RateLimits: {}}) {
    const {Init, Port } = data;
    if (!Init || !Port) {
      throw new Error('Provide all required fields');
    }

    this.pb = new Pocketbase(Init.DbUrl).admins.client.autoCancellation(false);
    this.port = Port;
    this.wss = new WebSocketServer({ port: this.port });
    this.auth = Init;
    this.rateLimitsList = new Map();

    this.shouldLog =   data.shouldLog || false;
    global.pb = this.pb;
    global.shouldLog = this.shouldLog;

    Object.keys(data.RateLimits).forEach((key) => {
        this.addRateLimit(key, data.RateLimits[key].RequestLimit, data.RateLimits[key].Duration);
    });
    this.start();
  }

  async start() {
    await this.pb.admins.authWithPassword(this.auth.email, this.auth.password);
    process.env.EMAIL  = this.auth.email || process.env.EMAIL
    process.env.PASSWORD = this.auth.password || process.env.PASSWORD
    new Requests(this.wss, this.pb, this.rateLimitsList);
  }

  addRateLimit(CrudMethod, RequestLimit, Duration) {
    this.shouldLog ?  console.log(`Added rate limit for ${CrudMethod} with ${RequestLimit} requests per ${Duration}ms`) : null;
    this.rateLimitsList.set(CrudMethod, { RequestLimit, Duration });
  }

}

 