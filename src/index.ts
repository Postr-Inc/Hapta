//@ts-nocheck
import { Hono } from "hono";
import { HttpCodes } from "../Enums/HttpCodes";
import { createBunWebSocket } from "hono/bun";
import Pocketbase from "pocketbase";
import config from "../config.toml"; 
import { webSocketLimiter } from "hono-rate-limiter";
import { rateLimiter } from "hono-rate-limiter";
import { bearerAuth } from "hono/bearer-auth"
import { HTTPException } from "hono/http-exception" 
import { cors } from "hono/cors"
import { decode, sign, verify } from "hono/jwt"
import {
  getCookie,
  getSignedCookie,
  setCookie,
  setSignedCookie,
  deleteCookie,
} from "hono/cookie";
globalThis.version = "1.8.0";
import { NeuralNetwork, summaryToTarget, summaryVocabulary, textToVector, vocabulary, neuralNetwork } from "../Core/Ai";

 
import { ErrorCodes, ErrorMessages } from "../Enums/Errors";
import AuthHandler from "../Core/AuthHandler";
import Concurrency from "../Core/Concurrency";
import RequestHandler from "../Core/RequestHandler";
import CacheController from "../Core/CacheManager";
const { upgradeWebSocket, websocket } = createBunWebSocket();
switch (true) {
  case !config.hasOwnProperty("database") ||
    !config.database.hasOwnProperty("DatabaseURL"):
    console.error({
      message: "Please set the DatabaseURL in your config file",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
    break;
  case !config.database.hasOwnProperty("AdminEmail") ||
    !config.database.hasOwnProperty("AdminPassword"):
    console.error({
      message:
        "Please set the AdminEmail and AdminPassword in your config file",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
    break;
  case !config.hasOwnProperty("security") ||
    !config.security.hasOwnProperty("Secret"):
    console.error({ message: "Please set the Secret in your config file" , status: ErrorCodes.CONFIGURATION_ERROR});
    process.exit(1);
    break;
}
export const pb = new Pocketbase(config.database.DatabaseURL);

export const _AuthHandler = new AuthHandler(pb)

export {
  neuralNetwork,
  summaryToTarget,
  summaryVocabulary,
  textToVector,
  vocabulary,
}
pb.admins.client.autoCancellation(false);

try {  
  await pb.admins.authWithPassword(config.database.AdminEmail, config.database.AdminPassword, {
    autoRefreshThreshold: 1000,
  });
} catch (error) { 
  console.error({
    message: ErrorMessages[ErrorCodes.DATABASE_AUTH_FAILED],
    status: ErrorCodes.DATABASE_AUTH_FAILED,
  });
  process.exit(1);
}
const app = new Hono();
const parseCookies = (cookie: string) => {
  return cookie
    .split(";")
    .map((v) => v.split("="))
    .reduce((acc: any, v) => {
      acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
      return acc;
    }, {});
};
const limiter =
  config.hasOwnProperty("ratelimits") && config.ratelimits.isEnabled
    ? rateLimiter({
        windowMs: config.rateLimit.Duration || 15 * 60 * 1000, // 15 minutes
        limit: config.rateLimit.Limit || 100,
        standardHeaders: "draft-6", // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
        keyGenerator: (c) =>  String(getCookie(c, "Authorization")),
        message:
          config.rateLimit.Message ||
          "You have exceeded the 100 requests in 15 minutes limit!",
      })
    : null;

  const wsLimiter = webSocketLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    keyGenerator: (c) =>  String(getCookie(c, "Authorization")),
    message: "You have exceeded the 300 requests in 15 minutes limit!",
  }); 
    app.use('*', cors({
      origin:  '*',
      allowHeaders: ['Content-Type', 'Authorization', 'user-agent', 'Upgrade', 'Connection', 'Sec-WebSocket-Key', 'Sec-WebSocket-Extensions', 'Sec-WebSocket-Version'],
      allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE', 'PATCH', 'HEAD'],
      exposeHeaders: ['Content-Length', 'X-Content-Ranges'],
      maxAge: 600,
      credentials: true,
  }))
    app.options('*', (c) => { 
      c.header('Access-Control-Allow-Origin',   '*')
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
      c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, user-agent')
      return c.text('', 204)
    })

app.get("/", (c) => {
  return c.json({ status: HttpCodes.OK, message: "Server is running" });
});

app.get("/health", (c) => { 
  return c.json({ status: HttpCodes.OK, message: "Server is running" });
});

app.get("/api/files/:collection/:id/:file", (c) => {
  let { collection, id, file} = c.req.param();
  if (!collection || !id || !file)
    return c.json(
      { error: true, message: ErrorMessages[ErrorCodes.NOT_FOUND] },
      { status: ErrorCodes.NOT_FOUND }
    );
  const u = `${pb.baseUrl}/api/files/${collection}/${id}/${file}`;
  c.header("Cache-Control", "public, max-age=31536000");
  c.header("Expires", new Date(Date.now() + 31536000000).toUTCString());
  return fetch(u, {
    //@ts-ignore
     cache: "force-cache",
  });
});

app.post('/auth/resetPassword', async (c) => {
  let { resetToken, password } = await c.req.json() as any;
  if(!resetToken || !password){
    return c.json({ status: ErrorCodes.FIELD_MISSING, message: ErrorMessages[ErrorCodes.FIELD_MISSING] , missing: !resetToken ? 'resetToken' : 'password'})
  }
  return _AuthHandler.resetPassword(resetToken, password, c)
})

app.post('/auth/requestPasswordReset', async (c) => {
  let { email } = await c.req.json() as any;
  if(!email){
    return c.json({ status: ErrorCodes.MISSING_EMAIL, message: ErrorMessages[ErrorCodes.MISSING_EMAIL] })
  }
  return _AuthHandler.requestPasswordReset(email, c)
})
/**
 * @description concurrency is used to maximize the performance of server by handling intensive tasks in the background
 */
export const c = new Concurrency();  
export const cache = new CacheController()
//@ts-ignore
globalThis.cache = cache;
app.post("/auth/login", async (c) => {  
  let {  emailOrUsername , password, deviceInfo,  ipAddress } = await c.req.json() as  any  
  switch (true) {
    case !emailOrUsername:
    return c.json({status: ErrorCodes.MISSING_EMAIL_OR_USERNAME, message: ErrorMessages[ErrorCodes.MISSING_EMAIL_OR_USERNAME]})
    case !password:
      return c.json({status: ErrorCodes.MISSING_PASSWORD, message: ErrorMessages[ErrorCodes.MISSING_PASSWORD]})
    case !ipAddress:
      return c.json({status: ErrorCodes.MISSING_IP_ADDRESS, message: ErrorMessages[ErrorCodes.MISSING_IP_ADDRESS]}) 
  }
  return _AuthHandler.login(emailOrUsername, password, deviceInfo, ipAddress, c)
});


const rqHandler = new RequestHandler()


app.post("/collection/:collection", async (c) => {
  let { collection } = c.req.param();
  let { type, payload, security, callback } = await c.req.json() as any;

  const token =  c.req.header('Authorization');
  if (!token || !_AuthHandler.tokenStore.has(token) || !verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")) {
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    });
  } 
  let d = await rqHandler.handleMessage(c, { type, payload, callback }, token)  
  return c.json(d)
});

app.post("/auth/check", async (c) => {
  let { email, username } = await c.req.json() as any;
  if (!email && !username) {
    console.log('Missing email or username')
    return c.json({ status: ErrorCodes.MISSING_EMAIL, message: ErrorMessages[ErrorCodes.MISSING_EMAIL] });
  }
  return _AuthHandler.check(email, username, c);
})


app.post("/auth/register", async (c) => {
  let { email, password, username, dob } = await c.req.json() as any;
  if (!email || !password || !username || !dob) {
    return c.json({ status: ErrorCodes.FIELD_MISSING, message: ErrorMessages[ErrorCodes.FIELD_MISSING] });
  }
  return _AuthHandler.register(email, password, username, dob, c);
})

app.get("/auth/verify", async (c) => {
  let token = c.req.header('Authorization')
  if (!token || !_AuthHandler.tokenStore.has(token) || !await verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")) {
    c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN)
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    });
  }
  return c.json({
    status: HttpCodes.OK,
    message: "Token is valid",
  });
})

app.post("/auth/refreshtoken", async (c) => {
  let { token } = await c.req.json() as any; 
  if(!token || !_AuthHandler.tokenStore.has(token) || !await verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")){
    c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN)
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    }); 
  }
  try {
    let signedSecret = _AuthHandler.tokenStore.get(token) as string;
    let tokenData = decode(token) as any;
    tokenData.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
    _AuthHandler.tokenStore.delete(token);
    const newToken = await sign(tokenData, signedSecret, "HS256");
    _AuthHandler.tokenStore.set(newToken, signedSecret);
    return c.json({
      status: HttpCodes.OK,
      message: "Token Refreshed",
      data: { 
        token: newToken
      },
    });
  } catch (error: any) {
    c.status(ErrorCodes.REFRESH_TOKEN_FAILED)
    return c.json({
      status: ErrorCodes.REFRESH_TOKEN_FAILED,
      message: ErrorMessages[ErrorCodes.REFRESH_TOKEN_FAILED],
      expanded: error.message
    });
  }
})
 

 

if (limiter) {
  app.use(limiter);
}

 

Bun.serve({
  port: config.server.Port || 3000,
  fetch: app.fetch, 
});

console.log(` 
  __  __            __       
  / / / /___ _____  / /_____ _
 / /_/ / __ / __ \/ __/ __ / /
/ __  / /_/ / /_/ / /_/ /_/ / 
/_/ /_/\__,_/ .___/\__/\__,_/  
            Version: ${globalThis.version || "1.0.0"}
            Port: ${config.server.Port || 3000}
            SSL: ${config.server.SSL || false}
`)


process.on("beforeExit", async () => {
     await rqHandler.crudManager.saveChanges()
});