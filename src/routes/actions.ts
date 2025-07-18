// src/routes/actions.ts
import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import * as schemas from '../utils/validationSchemas.ts';
import { HttpCodes } from "../../Utils/Enums/HttpCodes/index.ts";
import { ErrorCodes, ErrorMessages } from "../../Utils/Enums/Errors/index.ts";

import { decode } from "hono/jwt";
import AuthHandler from "../../Utils/Core/AuthHandler/index.ts";
import RequestHandler from "../../Utils/Core/RequestHandler/index.ts";  
import { validateToken, jsonResponse } from "./utils/helpers.ts";
import { handleContentAction } from "./handlers/contentActions.ts";
import { handleUserAction } from "./handlers/userActions.ts";

const actions = new Hono();

export default (
  _AuthHandler: AuthHandler,
  isTokenValidFn: typeof validateToken,
  rqHandler: RequestHandler,
  httpCodes: typeof HttpCodes,
  errorCodes: typeof ErrorCodes,
  errorMessages: typeof ErrorMessages,
  decodeFn: typeof decode
) => {
  actions.post(
    "/:type/:action_type",
    zValidator('param', schemas.ActionPathParamsSchema, (result, c) => {
      if (!result.success) {
        return jsonResponse(c, httpCodes.BAD_REQUEST, "Invalid path parameters for action.", {
          status: errorCodes.INVALID_REQUEST,
          errors: result.error.errors,
        });
      }
    }),
    zValidator('json', schemas.ActionBodySchema, (result, c) => {
      if (!result.success) {
        return jsonResponse(c, httpCodes.BAD_REQUEST, "Validation Error for action body.", {
          status: errorCodes.FIELD_MISSING,
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const { type, action_type } = c.req.valid('param');
      const { targetId, reason } = c.req.valid('json');
      const token = c.req.header("Authorization");

      if (!isTokenValidFn(token, _AuthHandler)) {
        return jsonResponse(c, errorCodes.INVALID_OR_MISSING_TOKEN, errorMessages[errorCodes.INVALID_OR_MISSING_TOKEN], {
          status: errorCodes.INVALID_OR_MISSING_TOKEN,
        });
      }

      const decodedToken = decodeFn(token as string);
      const currentUserId = decodedToken.payload?.id;
      const isBasicToken = decodedToken.payload?.isBasicToken;

      if (!currentUserId || isBasicToken) {
        return jsonResponse(c, errorCodes.UNAUTHORIZED_REQUEST, errorMessages[errorCodes.UNAUTHORIZED_REQUEST], {
          status: errorCodes.UNAUTHORIZED_REQUEST,
        });
      }

      try {
        if (type === "users") {
          return await handleUserAction({
            c,
            token,
            currentUserId,
            targetId,
            action_type,
            rqHandler,
            httpCodes,
            errorCodes,
          });
        }

        if (type === "posts" || type === "comments") {
          return await handleContentAction({
            c,
            token,
            currentUserId,
            type,
            action_type,
            targetId,
            reason,
            rqHandler,
            HttpCodes,
            ErrorCodes,
            decodeToken: decodedToken,
          });
        }

        return jsonResponse(c, errorCodes.INVALID_REQUEST, "Unsupported action target type.", {
          status: errorCodes.INVALID_REQUEST,
        });
      } catch (err: any) {
        console.error(`Error performing action on ${type} (ID: ${targetId}):`, err);
        return jsonResponse(c, ErrorCodes.INTERNAL_SERVER_ERROR, err.message || errorMessages[ErrorCodes.SYSTEM_ERROR], {
          status: ErrorCodes.SYSTEM_ERROR,
        });
      }
    }
  );

  return actions;
};
