import isNew from "../routes/isnew.js";
import { TokenManager } from "../utils/jwt.js";
import authWithPassword, { authUpdate } from "./AuthState.js";
import { CrudManager } from "./Crud.js";
import oauth2 from "./Oauth2.js";

export class Requests {
  constructor(wss, pb, rateLimitsList = new Map(), data =  {email: "", password: ""}) {
    this.wss = wss;
    this.pb = pb;
    /**
     * Rate limit for each token
     * @type {Map<string, {count: number, timestamp: number}>}
     */
    this.rateLimitsList = rateLimitsList
    this.wss.on('connection', this.onConnection.bind(this));
    this.sendMessage = null;
    this.rateLimits = new Map(); // Map to store token usage and timestamps
    
    this.tokenManager = new TokenManager(pb)
    this.CrudManager = new CrudManager(pb, this.tokenManager)
  }

  async onConnection(ws) {
     global.shouldLog ? console.log(`new connection, total: ${this.wss.clients.size}`) : null;
     
    // Listen for the 'message' event for each connected client
    ws.on('message', (data) => this.onMessage(data));
    this.sendMessage = (data) => {
      ws.send(JSON.stringify(data));
    };
  }

  async onMessage(data) {
    await this.pb.admins.authWithPassword(process.env.EMAIL, process.env.PASSWORD)
    try {
      const parsedData = JSON.parse(data.toString());
      const token = parsedData.token || parsedData.data.token;
      let methodrateLimit = this.rateLimitsList.has(parsedData.type) ? this.rateLimitsList.get(parsedData.type) : { RequestLimit: 10, Duration: 1000 * 60 * 60 * 24 * 7 }
      this.rateLimit = methodrateLimit.RequestLimit
      setTimeout(() => {
        this.clearExpiredLimits(parsedData.type);
      }, methodrateLimit.Duration);
  
     
     
      
      // Check rate limit
      if (this.isRateLimited(token)) {
        this.sendMessage({
          type: 'rateLimitExceeded',
          key:parsedData.key,
          data: {
            error: true,
            errorType: 'rateLimitExceeded',
            message: 'Rate limit exceeded. Please try again later.',
            timeRemaining: Math.floor((this.rateLimits.get(token).timestamp + methodrateLimit.Duration - Date.now()) / 1000) + ' seconds'
          },
        });
        global.shouldLog ? console.log(`Rate limit exceeded for method:${parsedData.type} with ${token}`) : null;
        return;
      }

      switch (parsedData.type) {
        case 'oauth':
          oauth2(this.tokenManager, this.pb, this.sendMessage, parsedData.data);
          break;
        case 'isValid':
          this.sendMessage({
            type: 'authValid',
            data: {
              isValid: await this.tokenManager.verify(token),
            },
          });
          break;
        case 'auth&password':
        this.sendMessage(await authWithPassword(this.pb, parsedData.data));
        case 'authUpdate':
            this.sendMessage(await authUpdate(this.pb, parsedData.data));
            break;
       
        case 'isNew':
          this.sendMessage(isNew(parsedData.data.id));
        case 'list':
          this.sendMessage(await this.CrudManager.list(parsedData));
          break;
      }

      // Update token usage
      this.updateTokenUsage(token);
    } catch (error) {
        this.sendMessage({
            type: 'error',
            data: {
            error: true,
            errorType: 'invalidRequest',
            message: 'Invalid request',
            },
        });
        global.shouldLog ? console.log(`Invalid request: ${error.message}`) : null;
    }
  }

  isRateLimited(token) {
    const tokenUsage =  this.rateLimits.get(token) || { count: 0, timestamp: Date.now() };
    return  tokenUsage.count >= this.rateLimit;
  }

  updateTokenUsage(token) {
    const tokenUsage = this.rateLimits.get(token) || { count: 0, timestamp: Date.now() };
    tokenUsage.count += 1;
    this.rateLimits.set(token, tokenUsage);
  }

  clearExpiredLimits(usageType) {
   let rateLimit = this.rateLimitsList.get(usageType)
    this.rateLimits.forEach((tokenUsage, token) => {
      if (Date.now() - tokenUsage.timestamp >= rateLimit.Duration) {
        this.rateLimits.delete(token);
      }
    });
  }
}
