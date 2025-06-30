import { Hono } from "hono";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { webSocketLimiter } from "hono-rate-limiter";
import { HTTPException } from "hono/http-exception"; // This was in original, but not explicitly used for Hono errors here, only custom ones.
import { verify, decode } from "hono/jwt"; // Added decode and verify for isTokenValid

import { HttpCodes } from "../../Utils/Enums/HttpCodes/index.ts";
import { ErrorCodes, ErrorMessages } from "../../Utils/Enums/Errors/index.ts";

/**
 * Checks if a JWT token is valid based on its presence in the token store
 * and successful verification.
 * @param {string} token - The JWT token to validate.
 * @param {_AuthHandler} _AuthHandler - The authentication handler instance.
 * @returns {boolean} True if the token is valid, false otherwise.
 */
export function isTokenValid(token: string, _AuthHandler: any): boolean {
  try {
    if (
      !token ||
      !_AuthHandler.tokenStore.has(token) ||
      !verify(token, _AuthHandler.tokenStore.get(token) as string, "HS256")
    ) {
      return false;
    }
    return true;
  } catch (e) {
    // console.warn("Token validation failed during verification:", e);
    return false;
  }
}

/**
 * Applies all global middleware to the Hono app.
 * @param {Hono} app - The Hono application instance.
 * @param {object} config - The application configuration.
 * @param {_AuthHandler} _AuthHandler - The authentication handler instance.
 * @param {function} isTokenValidFn - The function to validate tokens.
 * @param {function} getCookieFn - The Hono getCookie function.
 */
export function applyGlobalMiddleware(app: Hono, config: any, _AuthHandler: any, isTokenValidFn: Function, getCookieFn: Function) {
  // 1. Rate Limiting for HTTP Requests
  const HTTP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const HTTP_RATE_LIMIT_MAX_REQUESTS = 500; // 500 requests per window
  const PUBLIC_RATE_LIMIT_WHITELIST = ["/auth/check"]; // Paths to skip HTTP rate limiting

  if (config.ratelimit && config.ratelimit.isEnabled) {
    const httpLimiter = rateLimiter({
      windowMs: HTTP_RATE_LIMIT_WINDOW_MS,
      limit: HTTP_RATE_LIMIT_MAX_REQUESTS,
      standardHeaders: "draft-6",
      keyGenerator: (c) => {
        // Use various headers for IP, falling back to 'anon'
        return (
          c.req.header("x-forwarded-for") ||
          c.req.raw.headers.get("cf-connecting-ip") || // for Cloudflare
          c.req.raw.headers.get("x-real-ip") ||
          "anon"
        );
      },
      message: "Rate limit exceeded. Please try again later.",
    });

    app.use('*', async (c, next) => {
      const path = c.req.path;
      if (PUBLIC_RATE_LIMIT_WHITELIST.includes(path)) {
        return next(); // Skip rate limiter for whitelisted paths
      }
      return httpLimiter(c, next); // Apply rate limit otherwise
    });
  }

  // 2. CORS Configuration
  app.use(
    "*",
    cors({
      origin: "*", // Consider making this configurable or more restrictive in production
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "User-Agent",
        "Upgrade",
        "Connection",
        "Sec-WebSocket-Key",
        "Sec-WebSocket-Extensions",
        "Access-Control-Allow-Origin",
        "Sec-WebSocket-Version",
        "Range"
      ],
      allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH", "HEAD"],
      exposeHeaders: ["Content-Length", "X-Content-Ranges", "Accept-Ranges", "Content-Range"],
      maxAge: 600,
      credentials: true,
    })
  );

  // 3. Authentication and Authorization Middleware (Pre-route)
  app.get("*", async (c, next) => {
    const host = c.req.header("host");
    const url = new URL(c.req.url, `http://${host}`).pathname;

    // Handle embed subdomain immediately without further processing
    if (host === "embed.postlyapp.com") {
      c.status(HttpCodes.OK);
      return c.json({ message: "Embed Server is running" });
    }

    // Skip all checks for WebSocket upgrade requests
    if (c.req.header("Upgrade") === "websocket") {
      return next();
    }

    // Define public paths that do NOT require token validation
    const publicPaths = [
      "/auth/register",
      "/auth/verify",
      "/auth/refreshtoken",
      "/auth/requestPasswordReset",
      "/auth/resetPassword",
      "/auth/get-basic-auth-token",
      "/auth/login",
      "/opengraph/embed",
      "/health",
      '/', // Swagger UI
      '/openapi.json', // OpenAPI spec
      '/api-reference', // Scalar API Reference
    ];

    const isPublicPath =
      publicPaths.includes(url) ||
      url.includes("/embed/") ||
      url.startsWith("/api/files") ||
      (url.includes("/realtime") === false && host?.startsWith("embed") === false && url.includes("/admin") === false);

    // If it's a public path, skip token validation and proceed
    if (isPublicPath) {
      return next();
    }

    // --- Token Validation for Private Routes ---
    const token = getCookieFn(c, "Authorization") || c.req.header("Authorization");
    const ip = c.req.header("CF-Connecting-IP"); // Cloudflare IP header

    let decodedTokenPayload: any;
    try {
      if (token) {
        decodedTokenPayload = decode(token)?.payload;
      }
    } catch (err) {
      console.warn("Invalid JWT decode attempt in middleware:", err);
      decodedTokenPayload = null;
    }

    // Basic Token Specific Checks
    if (decodedTokenPayload?.isBasicToken) {
      const tokenIp = _AuthHandler.ipStore.get(token);
      // Block if IP does not match token IP for basic tokens (security measure)
      if (tokenIp && tokenIp !== ip) {
        c.status(ErrorCodes.UNAUTHORIZED_REQUEST);
        return c.json({
          status: ErrorCodes.UNAUTHORIZED_REQUEST,
          message: ErrorMessages[ErrorCodes.UNAUTHORIZED_REQUEST],
        });
      }

      // Block specific sensitive routes for basic tokens
      if (
        url.includes("/action/posts/") ||
        url.includes("/action/users") ||
        url.includes("/action/comments/")
      ) {
        c.status(ErrorCodes.UNAUTHORIZED_REQUEST);
        return c.json({
          status: ErrorCodes.UNAUTHORIZED_REQUEST,
          message: ErrorMessages[ErrorCodes.UNAUTHORIZED_REQUEST],
        });
      }
    }

    // Validate token signature for all non-public, non-basic-token routes
    if (isTokenValidFn(token, _AuthHandler)) {
      return next(); // Token valid, allow through
    }

    // If token is missing or invalid, respond with error
    c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
    return c.json({
      status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
      message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
    });
  });

  // 4. OPTIONS Handler for CORS Preflight.
  app.options("*", (c) => {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH");
    c.header(
      "Access-Control-Allow-Headers",
      "Range, Origin, Accept, Content-Type, Authorization, User-Agent, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Extensions, Sec-WebSocket-Version"
    );
    c.header("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    c.header("Access-Control-Max-Age", "86400");
    return c.text("", HttpCodes.NO_CONTENT as any);
  });
}

// Export specific limiter for WebSocket usage
export { webSocketLimiter };
