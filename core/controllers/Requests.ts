import { server} from "../../server";
import { TokenManager } from "../utils/jwt/JWT";
import AuthSate from "./AuthState";
 
import CrudManager from "./CrudManager";
export default class RequestHandler {
  ws: any;
  sendMsg: any;
  pb: any;
  rateLimits: Map<string, any>;
  Config: any;
  addedLimits: boolean;
  ratelimitsClients: Array<any>;
  TokenManager: TokenManager;
  authState: AuthSate;
  isOnline: Map<string, any>; 
  isServer: boolean;
  isSpamming: Map<string, any>;
  crudManager: CrudManager;
  constructor(ws: any, pb: any, Config: any) {
    this.ws = () => ws;

    this.Config = Config;
    this.rateLimits = new Map();
    this.ratelimitsClients = new Array();
    this.addedLimits = false;
    this.isOnline = new Map();
    this.isSpamming = new Map();
    this.isServer = false;
    this.sendMsg = (msg: any ) => { 
      this.waitForSocketConnection(() => {
        server.publish(msg.session, JSON.stringify(msg));
      });
    };
    this.pb = pb;

    this.addLimits();

    this.TokenManager = new TokenManager(this.pb);
    this.authState = new AuthSate(this.pb, this.TokenManager);
    this.crudManager = new CrudManager(this.pb, this.Config, this.TokenManager);
    
    
  }

  public addLimits() {
    if (this.addedLimits) return;

    Object.keys(this.Config.ratelimits).forEach((key) => {
      this.rateLimits.set(key, {
        limit: this.Config.ratelimits[key].limit,
        every: this.Config.ratelimits[key].every,
        maxUses: this.Config.ratelimits[key].maxUses || 0
      });
    });

    this.addedLimits = true;
  }

  private waitForSocketConnection(callback: any) {
    setTimeout(() => {
      if (this.ws && this.ws().readyState === 1) {
        if (callback != null) {
          callback();
        }
        return;
      } else {
        this.waitForSocketConnection(callback);
      }
    }, 5);
  }


  handleStatuses() {
    const pingInterval = 1000;  
    const offlineThreshold = 10000; 
  
    const updateStatus = () => {
      let now = Date.now();
  
      let timeout = null
      this.isOnline.forEach((user) => {
        if (now - user.time >= offlineThreshold) {
          this.isOnline.delete(user.userID);
          console.log(`User ${user.userID} is now offline.`);
        }
      });
  
    
  
      this.ws().send(JSON.stringify({ type: "status", data: Array.from(this.isOnline.values()) }));
   
      setTimeout(updateStatus, pingInterval);
    };
 
    updateStatus();
  }
  

  private waitForRateLimit(token: string, type: string) { 
    return new Promise<void>((resolve) => {
      const checkRateLimit = () => {
        if (!this.isRatelimited(token, type)) {
          resolve();
          
        } else {
          this.clearExpiredLimits(type, token);
          setTimeout(
            checkRateLimit,
            this.rateLimits.has(type) ? this.rateLimits.get(type).every : 1000
          );
        }
      };

      checkRateLimit();
    });
  }
  private updateTokenUsage(token: string, type: string) {
    const client = this.ratelimitsClients.find((c) => c.token === token);
  
    if (client) {
      client.used++;
      client.lastUsed = Date.now();
  
      // Check if client is spamming
      if (client.used >= this.rateLimits.get(type)?.maxUses) {
        if (Date.now() - client.lastUsed < this.rateLimits.get(type)?.every) {
          this.handleSpam(client); 
          this.ws().unsubscribe(this.TokenManager.decode(token).id);
          return;
        } else {
          this.isSpamming.delete(token);
        }
      }
    }
  }
  
  
  private handleSpam(client: any) {
    this.isSpamming.set(client.token, Date.now());
    //@ts-ignore
    server.unsubscribe(this.TokenManager.decode(client.token).id);
    console.log(`Kicked ${this.TokenManager.decode(client.token).id} for spamming.`);
  }
  

  private isRatelimited(token: string, type: string) {
    if (
      this.ratelimitsClients.find(
        (client) => client.token === token && client.type === type
      )
    ) {
      const client = this.ratelimitsClients.find(
        (client) => client.token === token && client.type === type
      );
      if (!client) return false;
      if (client.used >= this.rateLimits.get(type)?.limit || client.used === 0) {
        if (Date.now() - client.lastUsed < this.rateLimits.get(type)?.every) {
          return true;
        }
      }
    }
    return false;
  }

  private clearExpiredLimits(type: string, token: string) {
    const tokenUsage = this.ratelimitsClients.find(
      (client) => client.token === token
    );
    if (!tokenUsage) return;
    if (tokenUsage.used >= this.rateLimits.get(type)?.limit || tokenUsage.used === 0) {
      if (Date.now() - tokenUsage.lastUsed >= this.rateLimits.get(type)?.every) {
        tokenUsage.used = 0;
        tokenUsage.lastUsed = Date.now();
      }
    } 
  }

  public async handleRequest(msg: any) {
    msg = JSON.parse(msg);
     
    if (msg.server) this.isServer = true;

    if(!msg.session) return  
    if (
      msg.type !== "oauth" &&
      msg.type !== "authwithpassword" &&
      msg.type !== "isRatelimited" &&
      msg.type !== "fetchFile" 
      && msg.type !== "ping"
    ) {
      if (!this.TokenManager.isValid(msg.token, true)) return this.sendMsg({ error: true, message: "Invalid token" , session: msg.session});
      this.updateTokenUsage(msg.token, msg.type);
      await this.waitForRateLimit(msg.token || msg.data?.token, msg.type);
    } 

   

    switch (msg.type) {
      case "authWithPassword":
        this.sendMsg(await this.authState.authWithPassword(msg.data));
        break;
      case "isRatelimited":
        !msg.method
          ? this.sendMsg({ error: true, message: "method is required" })
          : this.sendMsg({
              error: false,
              ratelimited: this.isRatelimited(msg.token, msg.method),
              duration: this.rateLimits.get(msg.method)?.every,
              limit: this.rateLimits.get(msg.method)?.limit,
              used: this.ratelimitsClients.find(
                (client) => client.token === msg.token
              )?.used,
              key: msg.key,
              session: msg.session
            });
        break;
      case "ping":
        let time = Date.now()
        if(!msg.session || !msg.token) return this.sendMsg({error: true, message: "session and token are required"})
        let id = this.TokenManager.decode(msg.token).id
        this.isOnline.set(id, {time: time, userID: id})
        this.sendMsg({ key: msg.key, time: time, session: msg.session, type: "pong", latency: Date.now() - time });
        break;
      case "checkStatus":
        if(this.isOnline.get(this.TokenManager.decode(msg.token).id)){
          this.sendMsg({key: msg.key, session: msg.session, type: "online", userID: msg.userID})
        }else{
          this.sendMsg({key: msg.key, type: "offline", userID: msg.userID})
        }
        break;
      
      case "oauth":
        
        await this.authState.oauth(msg, this.sendMsg);
        break;
      case "authUpdate":
        this.sendMsg(await this.authState.authUpdate(msg));
        break;
      case "list":
        this.sendMsg(await this.crudManager.list(msg));

        break;
      case "subscribe":
        this.crudManager.subscribe(msg, this.sendMsg);
        break;
      case "unsubscribe":
        this.crudManager.unsubscribe(msg);
        break;
      case "delete":
        this.sendMsg(await this.crudManager.delete(msg));
        break;
      case "update":
        this.sendMsg(await this.crudManager.update(msg));
        break;
      case "create":
        this.sendMsg(await this.crudManager.create(msg));
        break;
      case "getUserByUsername":
        let { username } = msg.data;
        let res = await this.crudManager.read({
          collection: "users",
          filter: `username = "${username}"`,
        });
        break;
      
      case "checkUsername":
        this.sendMsg({key: msg.key, error:false, message:await this.authState.checkUsername(msg.data.username)});
        break;
      default: 
      
        break;
    }
  }
}
