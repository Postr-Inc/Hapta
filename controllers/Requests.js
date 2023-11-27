import isNew from "../routes/isnew.js";
import { TokenManager } from "../utils/jwt.js";
import authWithPassword, { authUpdate } from "./AuthState.js";
import { CrudManager } from "./Crud.js";
import oauth2 from "./Oauth2.js";

export class Requests {
  constructor(wss, pb, rateLimitsList = new Map(), data = { email: "", password: "" }) {
    this.wss = wss;
    this.pb = pb;
    this.rateLimitsList = rateLimitsList;
    this.wss.on('connection', this.onConnection.bind(this));
    this.sendMessage = null;
    this.requestsQueue = [];
    this.isProcessing = false;
    this.rateLimits = new Map();
    this.tokenManager = new TokenManager(pb);
    this.CrudManager = new CrudManager(pb, this.tokenManager);
  }

  async onConnection(ws) {
    ws.on('message', (data) => this.onMessage(data));
    this.sendMessage = (data) => {
      ws.send(JSON.stringify(data));
    };

    this.processQueue();
  }

  async onMessage(data) {
    await this.pb.admins.authWithPassword(process.env.EMAIL, process.env.PASSWORD);
    const parsedData = JSON.parse(data);
    const token = parsedData.token || parsedData.data.token;
    const usageType = parsedData.type;

   if(!token || this.tokenManager.isValid(token) === false)  {
      this.sendMessage({error:true, message: 'invalid token' });
      return;
   }
    if (usageType !== 'isRatelimited' && usageType !== 'isValid'
  
    ) {
      this.initializeRateLimit(usageType);
      await this.waitForRateLimit(token, usageType);
      await this.processRequest(parsedData, token);
      this.updateTokenUsage(token, usageType);
    } else {
       usageType === 'isRatelimited' ? this.sendMessage({ isRatelimited: this.isRateLimited(token), key: parsedData.key, Duration: this.Duration}) : this.sendMessage({ isValid: await this.tokenManager.isValid(token) });
    }
  }

  initializeRateLimit(type) {
    if (!this.rateLimitsList.has(type)) {
      this.rateLimitsList.set(type, { RequestLimit: 1, Duration: 1000 });
    }

    const { RequestLimit, Duration } = this.rateLimitsList.get(type);
    this.rateLimit = RequestLimit;
    this.Duration = Duration;
  }

  waitForRateLimit(token, type) {
    return new Promise(resolve => {
      const checkRateLimit = () => {
        if (!this.isRateLimited(token)) {
          resolve();
          console.log(`Rate limit cleared for ${type} for ${this.tokenManager.decode(token).id}`);
        } else {
          console.log(`Waiting for ${type} rate limit for ${this.tokenManager.decode(token).id}`)
          this.clearExpiredLimits(type, token);
          setTimeout(checkRateLimit, this.Duration);
        }
      };

      checkRateLimit();
    });
  }

  async processRequest(parsedData, token) {
    return new Promise(async (resolve) => {
      switch (parsedData.type) {
        case 'isRatelimited':
           this.sendMessage({ isRatelimited: this.isRateLimited(token), key: parsedData.key, Duration: this.Duration});
          break;
        case 'isValid':
          this.sendMessage({ isValid: await this.tokenManager.isValid(token) });
          break;
        case 'authWithPassword':
          this.sendMessage(await authWithPassword(this.pb, parsedData.data));
          break;
        case 'authUpdate':
          this.sendMessage(await authUpdate(this.pb, parsedData, this.sendMessage))
          break;
        case 'oauth2':
          await oauth2(this.pb, parsedData.data, this.sendMessage);
          break;
        case 'list':
          this.sendMessage(await this.CrudManager.list(parsedData));
          break;
        case 'create':
          await this.CrudManager.create(parsedData.data, this.sendMessage);
          break;
        case 'read':
          await this.CrudManager.read(parsedData.data, this.sendMessage);
          break;
        case 'update':
          this.sendMessage(await await this.CrudManager.update(parsedData))
          break;
        case 'delete':
          this.sendMessage(await this.CrudManager.delete(parsedData))
          break;
        case 'isnew':
          await isNew(this.pb, parsedData.data, this.sendMessage);
          break;
        default:
          this.sendMessage({ error: 'invalid request type' });
          break;
      }
      resolve();
    });
  }

  isRateLimited(token, {method} = {}) {
    // check if token is rateloimited for this request type
    const tokenUsage = this.rateLimits.get(token);
    if (!tokenUsage) return false;
    if (Date.now() - tokenUsage.timestamp > this.Duration) {
      return false;
    }
    if (tokenUsage.count >= this.rateLimit) {
      return true;
    }
  }

  clearExpiredLimits(type, token) {
    const tokenUsage = this.rateLimits.get(token);
    if (!tokenUsage) return;
    if (Date.now() - tokenUsage.timestamp > this.Duration) {
      console.log(`Cleared ${type} rate limit for ${token}`);
      this.rateLimits.delete(token);
    }
  }

  updateTokenUsage(token, type) {
    const tokenUsage = this.rateLimits.get(token) || { count: 0, timestamp: Date.now() };
    tokenUsage.count++;
    tokenUsage.timestamp = Date.now();
    this.rateLimits.set(token, tokenUsage);
    this.clearExpiredLimits(type, token);
  }

  enqueueRequest(request) {
    this.requestsQueue.push(request);
  }

  async processQueue() {
    if (!this.isProcessing && this.requestsQueue.length > 0) {
      this.isProcessing = true;
      const request = this.requestsQueue.shift();
      await this.onMessage(JSON.stringify(request));
      this.isProcessing = false;
      this.processQueue();
    }
  }
}
