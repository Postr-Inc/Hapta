// src/routes/subscriptions.ts
//@ts-nocheck
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { webSocketLimiter } from "../middleware/index.ts"; // Use the exported limiter
import { z } from 'zod'; // Import Zod
import { decode } from 'hono/jwt'; // Import decode for token parsing

import { HttpCodes } from "../../Utils/Enums/HttpCodes/index.ts";
import { ErrorCodes, ErrorMessages } from "../Utils/Enums/Errors/index.ts";
import { MessageTypes } from "../../Utils/Enums/MessageTypes/index.ts";
import * as schemas from '../utils/validationSchemas.ts'; // Import all schemas

const { upgradeWebSocket } = createBunWebSocket(); // Need to re-create it locally or pass from index

const subscriptions = new Hono();

export default (_AuthHandler: any, MessageTypes: any, HttpCodes: any, ErrorCodes: any, ErrorMessages: any, decodeFn: Function, verifyFn: Function, getCookieFn: Function) => {

  const WS_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const WS_RATE_LIMIT_MAX_REQUESTS = 300; // 300 messages per window

  // Re-define wsLimiter here using the imported webSocketLimiter
  const wsLimiter = webSocketLimiter({
    windowMs: WS_RATE_LIMIT_WINDOW_MS,
    limit: WS_RATE_LIMIT_MAX_REQUESTS,
    keyGenerator: (c) => String(getCookieFn(c, "Authorization")), // Use Authorization cookie for key
    message: "You have exceeded the 300 requests in 15 minutes limit for websockets!",
  });

  /**
   * WebSocket Endpoint for Subscriptions.
   * Handles real-time communication, including token refreshing.
   * @route GET /subscriptions (WebSocket upgrade)
   */
  subscriptions.get(
    "/subscriptions",
    wsLimiter, // Apply websocket specific rate limiting
    upgradeWebSocket((c) => {
      return {
        async onMessage(event, ws) {
          let parsedData: z.infer<typeof schemas.WebSocketMessageSchema>;
          let callback: string | undefined;

          try {
            parsedData = schemas.WebSocketMessageSchema.parse(JSON.parse(event.data));
            const { payload, security } = parsedData;
            callback = parsedData.callback; // Assign callback from parsed data

            // Validate token for WebSocket messages
            if (
              !security?.token ||
              !_AuthHandler.tokenStore.has(security.token) ||
              !verifyFn(
                security.token,
                _AuthHandler.tokenStore.get(security.token) as string,
                "HS256"
              )
            ) {
              ws.send(JSON.stringify({
                status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
                message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
                callback: callback,
              }));
              ws.close(1008, "Invalid Token");
              return;
            }

            // Handle different message types
            switch (payload.type) {
              case MessageTypes.AUTH_ROLL_TOKEN: {
                const tokenData = decodeFn(security.token) as any;
                const newToken = await _AuthHandler.rollNewToken(security.token, tokenData);

                if (!newToken) {
                  ws.send(
                    JSON.stringify({
                      status: ErrorCodes.ROLL_NEW_TOKEN_FAILED,
                      message: ErrorMessages[ErrorCodes.ROLL_NEW_TOKEN_FAILED],
                      callback: callback,
                    })
                  );
                  ws.close(1011, "Token Roll Failed");
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
                );
                break;
              }
              default:
                ws.send(JSON.stringify({ status: HttpCodes.OK, message: "Connected and message received", callback: callback }));
                break;
            }

            globalThis.listeners.set(ws, { ws, token: security.token });
          } catch (error) {
            console.error("WebSocket onMessage error:", error);
            // Handle Zod validation errors specifically
            if (error instanceof z.ZodError) {
              ws.send(JSON.stringify({
                status: HttpCodes.BAD_REQUEST,
                message: "Invalid WebSocket message format.",
                errors: error.errors,
                callback: callback,
              }));
            } else {
              ws.send(JSON.stringify({
                status: HttpCodes.INTERNAL_SERVER_ERROR,
                message: "An internal server error occurred.",
                callback: callback,
              }));
            }
          }
        },
        onClose: (ev, ws) => {
          globalThis.listeners.delete(ws);
          console.log(`WebSocket closed: Code ${ev.code}, Reason: ${ev.reason}`);
        },
        onError: (err) => {
          console.error(`WebSocket Error:`, err);
        },
      };
    })
  );

  return subscriptions;
};