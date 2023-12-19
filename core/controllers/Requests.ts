import { TokenManager } from "../utils/jwt/JWT";
import AuthSate from "./AuthState";
import CDN from "./Cdn";
import CrudManager from "./CrudManager";
import oauth2 from "./oauth2";

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
  Cdn: CDN;
  isServer: boolean;
  crudManager: CrudManager;
  constructor(ws: any, pb: any, Config: any) {
    this.ws = () => ws;

    this.Config = Config;
    this.rateLimits = new Map();
    this.ratelimitsClients = new Array();
    this.addedLimits = false;

    this.isServer = false;
    this.sendMsg = (msg: string) => {
      this.waitForSocketConnection(() => {
        this.ws().send(JSON.stringify(msg));
      });
    };
    this.pb = pb;

    this.addLimits();

    this.TokenManager = new TokenManager(this.pb);
    this.authState = new AuthSate(this.pb, this.TokenManager);
    this.crudManager = new CrudManager(this.pb, this.Config, this.TokenManager);
    this.Cdn = new CDN(this.pb);
  }

  public addLimits() {
    if (this.addedLimits) return;

    Object.keys(this.Config.ratelimits).forEach((key) => {
      console.log(`Setting rate limit for ${key}`);
      this.rateLimits.set(key, {
        limit: this.Config.ratelimits[key].limit,
        every: this.Config.ratelimits[key].every,
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

  private waitForRateLimit(token: string, type: string) {
    console.log(`Waiting for ${type} rate limit to clear`);
    return new Promise<void>((resolve) => {
      const checkRateLimit = () => {
        if (!this.isRatelimited(token, type)) {
          resolve();
          
        } else {
          this.clearExpiredLimits(type, token);
          console.log(`Waiting for ${type} rate limit to clear`);
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
    if (this.ratelimitsClients.find((client) => client.token === token)) {
      const client = this.ratelimitsClients.find(
        (client) => client.token === token
      );
      if (!client) return;
      if (Date.now() - client.lastUsed > this.rateLimits.get(type)?.every) {
        client.used = 1;
        client.lastUsed = Date.now();
      } else {
        client.used++;
        client.lastUsed = Date.now();
      }
    } else {
      this.ratelimitsClients.push({
        token,
        used: 1,
        lastUsed: Date.now(),
        type: type,
      });
    }
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
      if (client.used >= this.rateLimits.get(type)?.limit) {
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
    if (tokenUsage.used >= this.rateLimits.get(type)?.limit) {
      if (Date.now() - tokenUsage.lastUsed > this.rateLimits.get(type)?.every) {
        tokenUsage.used = 0;
        tokenUsage.lastUsed = Date.now();
      }
    } 
  }

  public async handleRequest(msg: any) {
    msg = JSON.parse(msg);
     
    if (msg.server) this.isServer = true;

    if (
      msg.type !== "oauth" &&
      msg.type !== "authwithpassword" &&
      msg.type !== "isRatelimited" &&
      msg.type !== "fetchFile"
    ) {
      if (!this.TokenManager.isValid(msg.token, true)) return this.sendMsg({ error: true, message: "Invalid token" });
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
            });
        break;
      case "oauth":
        if (this.isServer)
          return this.sendMsg({
            error: true,
            message:
              "Cannot use client oauth instead use the server oauth gateway",
          });
        await oauth2(this.TokenManager, this.sendMsg, msg.data);
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
      case "fetchFile":
        this.sendMsg(await this.Cdn.fetchFile(msg));
        break;
      case "checkUsername":
        this.sendMsg({key: msg.key, error:false, message:await this.authState.checkUsername(msg.data.username)});
        break;
      default:
        this.sendMsg({ error: true, message: "Invalid request type" });
        break;
    }
  }
}
