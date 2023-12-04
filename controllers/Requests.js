import isNew from "../routes/isnew.js";
import { TokenManager } from "../utils/jwt.js";
import authWithPassword, { authUpdate } from "./AuthState.js";
import { CrudManager } from "./Crud.js";
import oauth2 from "./Oauth2.js";

export class Requests {
  constructor(wss, pb, rateLimitsList = new Map(), data = { email: "", password: "" }, rules = []) {
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
    this.rules = rules;
    this.authenticated = false
    this.events = new Map();
  }

  async onConnection(ws) {
    global.shouldLog ? console.log('\nClient connected current clients: ' + this.wss.clients.size) : null;
    ws.on('message', (data) => this.onMessage(data));
    this.sendMessage = (data) => {
      if (ws.readyState !== ws.OPEN) {
        return;
      }
      ws.send(JSON.stringify(data));
    };

    this.processQueue();
    if(!this.authenticated) {
      console.log('\n🔒 Authenticating')
      try {
        await this.pb.admins.authWithPassword(process.env.EMAIL, process.env.PASSWORD);
        this.authenticated = true
       global.shouldLog ?  console.log('\n🔒 Authenticated') : null;
      } catch (error) {
        global.shouldLog ? console.error(`\n🔒 Error authenticating: ${error.message}`) : null;
        
      }
    
     }

  }

  async handleServerSide(data){}


  async onMessage(data) {
 

   

    const parsedData = JSON.parse(data);
    const token = parsedData.token || parsedData.data.token;
    const usageType = parsedData.type;

 
    if (usageType !== 'isRatelimited' && usageType !== 'isValid'
  
    ) {
      this.initializeRateLimit(usageType);
      await this.waitForRateLimit(token, usageType);
      await this.processRequest(parsedData, token);
     usageType !== 'authWithPassword' && usageType !== 'oauth2' ? this.updateTokenUsage(token, usageType) : null;
    } else {
       usageType === 'isRatelimited' ? this.sendMessage({ isRatelimited: this.isRateLimited(token), key: parsedData.key, Duration: this.Duration}) : this.sendMessage({ isValid: await this.tokenManager.isValid(token) });
    }
     
  }

  initializeRateLimit(type) {
    if (!this.rateLimitsList.has(type)) {
      this.rateLimitsList.set(type, { RequestLimit: 1, Duration: 1000 });
    }

    const { RequestLimit, Duration } = this.rateLimitsList.get(type);
    const rule  = this.rules.find((r)=> r.key === type)
    this.rateLimit = RequestLimit;
    this.Duration = Duration;
  }

  waitForRateLimit(token, type) {
    return new Promise(resolve => {
      const checkRateLimit = () => {
        if (!this.isRateLimited(token)) {
          resolve();
          console.log(`\n${type} rate limit cleared for ${this.tokenManager.decode(token).id}`)
        } else {
          console.log(`\nWaiting for ${type} rate limit for ${this.tokenManager.decode(token).id}`)
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
        case 'oauth':
          await oauth2(this.tokenManager, this.pb, this.sendMessage, parsedData.data);
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
        case 'subscribe':
          this.CrudManager.subscribe(parsedData, this.sendMessage);
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
      console.log(`\nCleared ${type} rate limit for ${this.tokenManager.decode(token).id}`);
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
