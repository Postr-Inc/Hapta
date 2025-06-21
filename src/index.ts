//@ts-nocheck
import { Hono } from "hono";
import { HttpCodes } from "../Enums/HttpCodes";
import { createBunWebSocket, getConnInfo } from "hono/bun";
import Pocketbase from "pocketbase";
import config from "../config"
import { webSocketLimiter } from "hono-rate-limiter";
import crypto from 'crypto'
import { rateLimiter } from "hono-rate-limiter";
import { bearerAuth } from "hono/bearer-auth";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { decode, sign, verify } from "hono/jwt";
import RateLimitHandler from "../Core/RateLimiter";
import MainDashboard from "../Core/AdminPanel/frontend_panel";
import process from 'process'
import {
  getCookie,
  getSignedCookie,
  setCookie,
  setSignedCookie,
  deleteCookie,
} from "hono/cookie";
globalThis.version = "1.8.0";
import {
  NeuralNetwork,
  summaryToTarget,
  summaryVocabulary,
  textToVector,
  vocabulary,
  neuralNetwork,
} from "../Core/Ai";
var imageCache = new Map();
import { ErrorCodes, ErrorMessages } from "../Enums/Errors";
import AuthHandler from "../Core/AuthHandler";
import Concurrency from "../Core/Concurrency";
import RequestHandler from "../Core/RequestHandler";
import CacheController from "../Core/CacheManager";
import { MessageTypes } from "../Enums/MessageTypes";
import EmbedEngine from "../Core/EmbedEngine";
import AdminLogin from "../Core/AdminPanel/frontend_panel/auth/login";
import { stream } from "hono/streaming";
const { upgradeWebSocket, websocket } = createBunWebSocket();
globalThis.listeners = new Map();
const rateLimites = new Map();

export const pb = new Pocketbase(Bun.env.DatabaseURL);

pb.admins.client.autoCancellation(false);
pb.autoCancellation(false)

export const _AuthHandler = new AuthHandler(pb);
 
function isTokenValid(token: string) {
  if ( 
    !token ||
   !_AuthHandler.tokenStore.has(token) ||
    !verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")
  ) {
     return false
  }
  return true
}
switch (true) {
  case   !Bun.env.DatabaseURL:
    console.error({
      message: "Please set the DatabaseURL in your config file",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
    break;
  case !Bun.env.AdminEmail ||!Bun.env.AdminPassword:
    console.error({
      message:
        "Please set the AdminEmail and AdminPassword in your config file",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
    break;
  case !config.hasOwnProperty("Security") ||
    !config.Security.hasOwnProperty("Secret"):
    console.error({
      message: "Please set the Secret in your config file",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
    break;
} 
export {
  neuralNetwork,
  summaryToTarget,
  summaryVocabulary,
  textToVector,
  vocabulary,
}; 
try {
  await pb.admins.authWithPassword(
    Bun.env.AdminEmail,
    Bun.env.AdminPassword,
    {
      autoRefreshThreshold: 1000,
    }
  );
} catch (error) {
  console.log(error);
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
  config.hasOwnProperty('ratelimit') && config.ratelimit.isEnabled
    ?    rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // 100 requests per window
    standardHeaders: "draft-6", // "RateLimit-*" headers
    keyGenerator: (c) => {
      // Use IP address or fallback
      return (
        c.req.header("x-forwarded-for") ||
        c.req.raw.headers.get("cf-connecting-ip") || // for Cloudflare
        c.req.raw.headers.get("x-real-ip") ||
        "anon"
      );
    },
    message: "Rate limit exceeded. Please try again later.",
  })
    : null

if (limiter) {
  app.use('*', limiter) // Important: apply to all routes
}

const wsLimiter = webSocketLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  keyGenerator: (c) => String(getCookie(c, "Authorization")),
  message: "You have exceeded the 300 requests in 15 minutes limit!",
});
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "user-agent",
      "Upgrade",
      "Connection",
      "Sec-WebSocket-Key",
      "Sec-WebSocket-Extensions",
      "Access-Control-Allow-Origin",
      "Sec-WebSocket-Version",
    ],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH", "HEAD"],
    exposeHeaders: ["Content-Length", "X-Content-Ranges"],
    maxAge: 600,
    credentials: true,
  })
);

const rt = new RateLimitHandler();

app.get("/", (c) => {
  return c.json({ status: HttpCodes.OK, message: "Server is running" });
});
app.get("*", (c, next) => {
  // if route is embed.postlyapp.com
  let host = c.req.header("host");
  if (host === "embed.postlyapp.com") {
    c.status(200);
    return c.json({ message: "Embed Server is running" });
  }

  // get token from cookie
  let token = getCookie(c, "Authorization") || c.req.header("Authorization");
  var decoded;

  if (token) decoded = decode(token);

  // check if ip is rate limited


  let ip = c.req.header("CF-Connecting-IP");

  // check if request is from a web socket
  if (c.req.header("Upgrade") === "websocket") {
    // skip next if the request is a web socket
    return next();
  }

  if (!rt.has(ip)) {
    rt.setRateLimit(ip);
  }
  if (config.ratelimit.isEnabled) {
    console.log("ratelimit enabled")
    if (!rt.checkRateLimit(ip)) { 
      c.status(ErrorCodes.RATE_LIMIT);
      return c.json({
        status: ErrorCodes.RATE_LIMIT,
        message: ErrorMessages[ErrorCodes.RATE_LIMIT],
      });
    }
  }
  // make sure ip matches the one in the token
  let tokenIp = _AuthHandler.ipStore.get(token);
  if (
    c.req.url !== "/auth/register" &&
    c.req.url !== "/auth/verify" &&
    c.req.url !== "/auth/refreshtoken" &&
    c.req.url !== "/auth/requestPasswordReset" &&
    c.req.url !== "/auth/resetPassword" &&
    c.req.url.includes("/embed") == false &&
    c.req.url !== "/auth/get-basic-auth-token" &&
    c.req.url !== "/auth/login" &&
    c.req.url.includes("/api/files") == false &&
    c.req.url.includes("/admin") == false &&
    host?.startsWith("embed") == false &&
    c.req.url.includes("/realtime") == false
  ) {
    if (tokenIp !== ip && !decoded.payload.isBasicToken) {
      c.status(ErrorCodes.UNNAUTHORIZED_IP);
      return c.json({
        status: ErrorCodes.UNNAUTHORIZED_IP,
        message: ErrorMessages[ErrorCodes.UNNAUTHORIZED_IP],
      });
    }
    if (
      decoded.payload.isBasicToken ||
      token &&
      _AuthHandler.tokenStore.has(token) &&
      verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")
    ) { 
      if(decoded?.payload.isBasicToken && c.req.url.includes("/action/posts/")|| 
        decoded?.payload.isBasicToken && c.req.url.includes("/action/users")
        || decoded?.payload.isBasicToken && c.req.url.includes("/action/comments/")
      ){
        c.status(ErrorCodes.UNAUTHORIZED_REQUEST);
        return c.json({
           status: ErrorCodes.UNAUTHORIZED_REQUEST,
            message: ErrorMessages[ErrorCodes.UNAUTHORIZED_REQUEST],
          });
      }
      c.status(HttpCodes.OK);
      return next();
    } else { 
      c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
      return c.json({
        status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
        message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
      });
    }
  }
  return next();
});

app.get(
  "/subscriptions",
  upgradeWebSocket((c) => {
    return {
      async onMessage(event, ws) {
        try {
          let { payload, security, callback } = JSON.parse(event.data);
          // check if token is signed and valid

          if (
            !security || !security.hasOwnProperty("token") ||
            !_AuthHandler.tokenStore.has(security.token) ||
            !verify(
              security.token,
              _AuthHandler.tokenStore.get(security.token) as string,
              "HS256"
            )
          ) {

            return;
          }


          switch (payload.type) {
            case MessageTypes.AUTH_ROLL_TOKEN:
              // check if the user is authorized to roll a new token
              let tokenData = decode(security.token) as any;
              let userID = tokenData.payload.id; 
              let newToken = await _AuthHandler.rollNewToken(security.token, tokenData) 
              if (!newToken) {
                ws.send(
                  JSON.stringify({
                    status: ErrorCodes.ROLL_NEW_TOKEN_FAILED,
                    message: ErrorMessages[ErrorCodes.ROLL_NEW_TOKEN_FAILED],
                    callback: callback,
                  })
                );
                ws.close();
                return;
              }
              ws.send(
                JSON.stringify({
                  status: HttpCodes.OK,
                  message: "New token rolled successfully",
                  data: {
                    token: newToken,
                    callback: callback,
                    type: payload.type,
                  }
                })
              )
              return;
          }
          ws.send(JSON.stringify({ status: HttpCodes.OK, message: "Connected" }));
          globalThis.listeners.set(ws, { ws, token: security.token });
        } catch (error) {
          console.log(error);
        }
      },
      onClose: (ev, ws) => {
        globalThis.listeners.delete(ws);
        console.log(ev.reason);
      },
      onError: (err) => {
        console.error(`Error: ${err}`);
      },
    };
  })
);

app.options("*", (c) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, user-agent"
  );
  return c.text("", 204);
});

app.get("/embed/:collection/:id/:type", async (c) => {
  const { collection, id, type } = c.req.param()
  try {
    var Embedder = new EmbedEngine(type, await rqHandler.crudManager.get({
      collection, id, isEmbed: true, options: {
        expand: ["author"]
      }
    },))
    return c.html(await Embedder.render())
  } catch (error) {
    console.log(error)
    return c.json({
      error: true,
      message: ErrorMessages[ErrorCodes.DATABASE_ERROR],
      status: ErrorCodes.DATABASE_ERROR
    })
  }
})

app.get("/health", (c) => {
  return c.json({ status: HttpCodes.OK, message: "Server is running" });
});

app.get("/api/files/:collection/:id/:file", async (c) => {
  let { collection, id, file } = c.req.param();
  if (!collection || !id || !file)
    return c.json(
      { error: true, message: ErrorMessages[ErrorCodes.NOT_FOUND] },
      { status: ErrorCodes.NOT_FOUND }
    );
  const u = `${pb.baseUrl}/api/files/${collection}/${id}/${file}`;
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
  const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(file);

  if (isImage && imageCache.has(u)) {
    return imageCache.get(u);
  }

  c.header("Cache-Control", "public, max-age=31536000");
  c.header("Expires", new Date(Date.now() + 31536000000).toUTCString());

  if (isVideo) {
    // Handle video streaming with range requests
    const range = c.req.header("range");
    const videoRes = await fetch(u, {
      headers: range ? { Range: range } : {},
    });

    // Set headers for partial content if range requested
    c.status(videoRes.status);
    for (const [key, value] of videoRes.headers.entries()) {
      c.header(key, value);
    }

    // If the response is not partial content, set appropriate headers
    if (videoRes.status === 200 && range) {
      c.status(206);
      c.header("Accept-Ranges", "bytes");
      const contentLength = videoRes.headers.get("Content-Length");
      if (contentLength) c.header("Content-Length", contentLength);
      const contentType = videoRes.headers.get("Content-Type");
      if (contentType) c.header("Content-Type", contentType);
    }

    // Return the video stream directly
    return stream(c, async (stream) => {
      if (!videoRes.body) return;
      const reader = videoRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) await stream.write(value);
      }
    });
  }

  // Default: proxy and cache images/other files
  const res = await fetch(u, { cache: "force-cache" });
  if (isImage && res.ok) {
    const blob = await res.blob();
    imageCache.set(u, new Response(blob, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "",
        "Cache-Control": "public, max-age=31536000",
        "Expires": new Date(Date.now() + 31536000000).toUTCString(),
      },
    }));
    return imageCache.get(u);
  }
  // For non-image, non-video files, just proxy the response
  c.status(res.status);
  for (const [key, value] of res.headers.entries()) {
    c.header(key, value);
  }
  return res.body;
});

app.post("/auth/resetPassword", async (c) => {
  let { resetToken, password } = (await c.req.json()) as any;
  if (!resetToken || !password) {
    return c.json({
      status: ErrorCodes.FIELD_MISSING,
      message: ErrorMessages[ErrorCodes.FIELD_MISSING],
      missing: !resetToken ? "resetToken" : "password",
    });
  }
  return _AuthHandler.resetPassword(resetToken, password, c);
});

app.post("/auth/requestPasswordReset", async (c) => {
  let { email } = (await c.req.json()) as any;
  if (!email) {
    return c.json({
      status: ErrorCodes.MISSING_EMAIL,
      message: ErrorMessages[ErrorCodes.MISSING_EMAIL],
    });
  }
  return _AuthHandler.requestPasswordReset(email, c);
});
/**
 * @description concurrency is used to maximize the performance of server by handling intensive tasks in the background
 */
export const c = new Concurrency();
export const cache = new CacheController();
//@ts-ignore
globalThis.cache = cache;
app.post("/auth/login", async (c) => {
  let { emailOrUsername, password, deviceInfo } = (await c.req.json()) as any;
  const ipAddress = c.req.header("CF-Connecting-IP");
  switch (true) {
    case !emailOrUsername:
      return c.json({
        status: ErrorCodes.MISSING_EMAIL_OR_USERNAME,
        message: ErrorMessages[ErrorCodes.MISSING_EMAIL_OR_USERNAME],
      });
    case !password:
      return c.json({
        status: ErrorCodes.MISSING_PASSWORD,
        message: ErrorMessages[ErrorCodes.MISSING_PASSWORD],
      });
  }
  return _AuthHandler.login(
    emailOrUsername,
    password,
    deviceInfo,
    ipAddress,
    c
  );
});

const rqHandler = new RequestHandler();

app.post("/auth/get-basic-auth-token", async (c) => {
  let sig = config.Security.Secret + crypto.randomUUID()
  let token = await sign({
    isBasicToken: true,
    permissions: ["read", "write", "delete"]
  }, sig, "HS256") as string;
  _AuthHandler.tokenStore.set(token, sig)

  return c.json({ status: 200, message: "Successfully created basic auth token", token })
})

app.post("/deepsearch", async (c) => {
  const token = c.req.header("Authorization");
  if (
    !token ||
    !_AuthHandler.tokenStore.has(token) ||
    !verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")
  ) {
    c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    });
  }
  let { type, payload, callback } = (await c.req.json()) as any;
  let d = await rqHandler.handleMessage({ type, payload, callback }, token);
  c.status(d.opCode);
  return c.json(d);
});

app.post("/collection/:collection", async (c) => {
  let { collection } = c.req.param();
  let { type, payload, security, callback } = (await c.req.json()) as any;

  const token = c.req.header("Authorization") || security?.token;
  c.req.header("Content-Type", "application/json");
  c.req.header("Accept", "application/json");
  c.req.header("Acess-Control-Allow-Origin", "*");
  var decodedToken = decode(token)
  if (
    !decodedToken.payload.isBasicToken &&
    !token ||
    !decodedToken.payload.isBasicToken && !_AuthHandler.tokenStore.has(token) ||
    !decodedToken.payload.isBasicToken && !verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")
  ) {
    c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    });
  }
  payload.collection = collection
  let d = await rqHandler.handleMessage({ type, payload, callback }, token);
  c.status(d.opCode);
  return c.json(d);
});


app.post("/actions/:type/:action_type", async (c) => {
  const { type, action_type } = c.req.param();
  const { targetId } = await c.req.json(); // generic target ID (post, user, or comment)
  const token = c.req.header("Authorization");

  // 🔐 Token validation
  if (!token) {
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    }, ErrorCodes.INVALID_OR_MISSING_TOKEN);
  }

  const decodedToken = decode(token);
  const isBasicToken = decodedToken?.payload?.isBasicToken;

  if (
    (!isBasicToken && !_AuthHandler.tokenStore.has(token)) ||
    (!isBasicToken && !verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256"))
  ) {
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    }, ErrorCodes.INVALID_OR_MISSING_TOKEN);
  }

  const currentUserId = decodedToken.payload.id;

  try {
    switch (type) {
      case "users": {
        const [targetUser, currentUser] = await Promise.all([
          rqHandler.crudManager.get({ collection: "users", id: targetId }, token),
          rqHandler.crudManager.get({ collection: "users", id: currentUserId }, token),
        ]);

        const targetFollowers = targetUser._payload.followers ?? [];
        const currentFollowing = currentUser._payload.following ?? [];

        if (action_type === "follow") {
          if (!targetFollowers.includes(currentUserId)) targetFollowers.push(currentUserId);
          if (!currentFollowing.includes(targetId)) currentFollowing.push(targetId);
        } else if (action_type === "unfollow") {
          targetUser._payload.followers = targetFollowers.filter((id) => id !== currentUserId);
          currentUser._payload.following = currentFollowing.filter((id) => id !== targetId);
        } else {
          throw new Error("Invalid action");
        }

        await Promise.all([
          rqHandler.crudManager.update({
            collection: "users",
            id: currentUserId,
            fields: { following: currentUser._payload.following },
            invalidateCache: [`/u/${currentUser._payload.username}`],
          }, token),
          rqHandler.crudManager.update({
            collection: "users",
            id: targetId,
            fields: { followers: targetUser._payload.followers },
            invalidateCache: [`/u/${targetUser._payload.username}`],
          }, token),
        ]);
        break;
      }

      case "posts":
      case "comments": {
        console.log(targetId)
        const collection = type;
        const doc = await rqHandler.crudManager.get({
          collection,
          id: targetId,
        }, token);

        if (!doc || !doc._payload) {
          return c.json({
            status: ErrorCodes.NOT_FOUND,
            message: `${type.slice(0, -1)} not found.`,
          }, ErrorCodes.NOT_FOUND);
        }

        const likes = doc._payload.likes ?? [];

        if (action_type === "like") {
          if (!likes.includes(currentUserId)) likes.push(currentUserId);
        } else if (action_type === "unlike") {
          doc._payload.likes = likes.filter((id) => id !== currentUserId);
        } else {
          throw new Error("Invalid action");
        }

        const res = await rqHandler.crudManager.update({
          collection,
          id: targetId,
          fields: {
            likes: doc._payload.likes ?? likes,
          },
          invalidateCache: [`/${collection === "posts" ? "p" : "c"}/${doc._payload.id}`],
        }, token);

        return c.json({ status: 200, message: "Action completed.", res: res._payload });
      }

      default:
        return c.json({
          status: ErrorCodes.INVALID_REQUEST,
          message: "Unsupported action target.",
        }, ErrorCodes.INVALID_REQUEST);
    }

    return c.json({ status: 200, message: "Action completed." });

  } catch (err: any) {
    return c.json({
      status: ErrorCodes.SYSTEM_ERROR,
      message: err.message || "An error occurred",
    }, ErrorCodes.SYSTEM_ERROR);
  }
});




app.post("/auth/check", async (c) => {
  let { email, username } = (await c.req.json()) as any;
  if (!email && !username) {
    console.log("Missing email or username");
    return c.json({
      status: ErrorCodes.MISSING_EMAIL,
      message: ErrorMessages[ErrorCodes.MISSING_EMAIL],
    });
  }
  return _AuthHandler.check(email, username, c);
});

app.post("/auth/register", async (c) => {
  let { email, password, username, dob } = (await c.req.json()) as any;
  if (!email || !password || !username || !dob) {
    return c.json({
      status: ErrorCodes.FIELD_MISSING,
      message: ErrorMessages[ErrorCodes.FIELD_MISSING],
    });
  }
  return _AuthHandler.register(email, password, username, dob, c);
});

app.get("/auth/verify", async (c) => {
  const token = c.req.header("Authorization");

  try {
    if (isTokenValid(token)) {
      c.status(HttpCodes.OK);
      return c.json({
        status: HttpCodes.OK,
        message: "Token is valid",
      });
    } else {
      c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
      return c.json({
        status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
        message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
      });
    }
  } catch (error) {
    console.log(error);
    c.status(500);
    return c.json({ status: 500, message: "Internal Server Error" });
  }
});

app.delete('/auth/delete-account', async (c) => {
  const token = c.req.header("Authorization")
  const decoded = decode(token)
  if (
    !token ||
    !_AuthHandler.tokenStore.has(token) ||
    !(await verify(
      token,
      _AuthHandler.tokenStore.get(token) as string,
      "HS256"
    )) ||
    _AuthHandler.ipStore.get(token) !== c.req.header("CF-Connecting-IP")
  ) {
    c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    });
  }
})
app.post("/auth/refreshtoken", async (c) => {
  let { token } = (await c.req.json()) as any;
  if (
    !token ||
    !_AuthHandler.tokenStore.has(token) ||
    !(await verify(
      token,
      _AuthHandler.tokenStore.get(token) as string,
      "HS256"
    )) ||
    _AuthHandler.ipStore.get(token) !== c.req.header("CF-Connecting-IP")
  ) {
    c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
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
        token: newToken,
      },
    });
  } catch (error: any) {
    c.status(ErrorCodes.REFRESH_TOKEN_FAILED);
    return c.json({
      status: ErrorCodes.REFRESH_TOKEN_FAILED,
      message: ErrorMessages[ErrorCodes.REFRESH_TOKEN_FAILED],
      expanded: error.message,
    });
  }
});



Bun.serve({
  port: config.Server.Port || 3000,
  idleTimeout: 255,
  websocket,
  fetch: app.fetch,
});

async function waitForServerReady(url = `http://localhost:${config.Server.Port || 3000}`, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Server not ready after ${timeoutMs} ms`);
}
console.log(` 
  __  __            __       
  / / / /___ _____  / /_____ _
 / /_/ / __ / __ \/ __/ __ / /
/ __  / /_/ / /_/ / /_/ /_/ / 
/_/ /_/\__,_/ .___/\__/\__,_/  
            Version: ${globalThis.version || "1.0.0"}
            Port: ${config.Server.Port || 3000}
            SSL: ${config.Server.SSL || false}
`);

process.on("beforeExit", async () => {
  if (Bun.env.BLUENODE === "true") {
    // EXPORT cache data to a file for GREEN NODE
  }
  await rqHandler.crudManager.saveChanges();
});

if (process.argv[2] && process.argv[2].includes("--test")) {
  (async () => {
    try {
      await waitForServerReady();

      console.log("Running tests...");
      const proc = Bun.spawnSync(["bun", "test", "./TestCases/index.test.ts"], {
        stdio: ["inherit", "inherit", "inherit"],
      });

      if (proc.exitCode === 0) {
        console.log("Tests completed successfully.");
        process.exit(0);
      } else {
        console.error(`Tests failed with exit code: ${proc.exitCode}`);
        process.exit(proc.exitCode);
      }
    } catch (err) {
      console.error("Server did not become ready:", err);
      process.exit(1);
    }
  })();
}
