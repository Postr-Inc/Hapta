// src/routes/actions.ts
import { Hono, Context } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
 
import * as schemas from '../utils/validationSchemas.ts';
import AuthHandler from "../../Utils/Core/AuthHandler/index.ts";
import RequestHandler from "../../Utils/Core/RequestHandler/index.ts";
import { decode } from "hono/jwt";
import { HttpCodes } from "../../Utils/Enums/HttpCodes/index.ts";
import { ErrorCodes, ErrorMessages } from "../../Utils/Enums/Errors/index.ts"; 
const actions = new Hono();

type ActionType = "follow" | "unfollow" | "block" | "unblock" | "like" | "unlike" | "bookmark" | "pin" | "unpin" | "delete";
type TargetType = "users" | "posts" | "comments";

interface DecodedToken {
  payload?: {
    id?: string;
    isBasicToken?: boolean;
    username?: string;
  };
}

export default (
  _AuthHandler: AuthHandler,
  isTokenValidFn: (token: string | undefined, handler: AuthHandler) => boolean,
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
        c.status(httpCodes.BAD_REQUEST);
        return c.json({
          status: errorCodes.INVALID_REQUEST,
          message: "Invalid path parameters for action.",
          errors: result.error.errors,
        });
      }
    }),
    zValidator('json', schemas.ActionBodySchema, (result, c) => {
      if (!result.success) {
        c.status(httpCodes.BAD_REQUEST);
        return c.json({
          status: errorCodes.FIELD_MISSING,
          message: "Validation Error for action body.",
          errors: result.error.errors,
        });
      }
    }),
    async (c: Context) => {
      const { type, action_type } = c.req.valid('param') as { type: TargetType, action_type: ActionType };
      const { targetId } = c.req.valid('json') as { targetId: string };
      const token = c.req.header("Authorization");

      if (!isTokenValidFn(token, _AuthHandler)) {
        return c.json({
          status: errorCodes.INVALID_OR_MISSING_TOKEN,
          message: errorMessages[errorCodes.INVALID_OR_MISSING_TOKEN],
        }, errorCodes.INVALID_OR_MISSING_TOKEN);
      }

      const decodedToken = decodeFn(token) as DecodedToken;
      const currentUserId = decodedToken.payload?.id;
      const isBasicToken = decodedToken.payload?.isBasicToken;

      if (!currentUserId || isBasicToken) {
        return c.json({
          status: errorCodes.UNAUTHORIZED_REQUEST,
          message: errorMessages[errorCodes.UNAUTHORIZED_REQUEST] || "User actions not permitted with this token type.",
        }, errorCodes.UNAUTHORIZED_REQUEST);
      }

      try {
        if (type === "users") {
          const [targetUserRecord, currentUserRecord] = await Promise.all([
            rqHandler.crudManager.get({ collection: "users", id: targetId }, token),
            rqHandler.crudManager.get({ collection: "users", id: currentUserId }, token),
          ]);

          if (!targetUserRecord?._payload || !currentUserRecord?._payload) {
            return c.json({
              status: errorCodes.NOT_FOUND,
              message: "User not found.",
            }, errorCodes.NOT_FOUND);
          }

          const targetUser = targetUserRecord._payload;
          const currentUser = currentUserRecord._payload;

          targetUser.followers = Array.isArray(targetUser.followers) ? targetUser.followers : [];
          currentUser.following = Array.isArray(currentUser.following) ? currentUser.following : [];
          targetUser.blockedBY = Array.isArray(targetUser.blockedBY) ? targetUser.blockedBY : [];

          let invalidateCachePaths: string[] = [];
          let updateCurrentUserFields: Record<string, any> = {};
          let updateTargetUserFields: Record<string, any> = {};

          switch (action_type) {
            case "follow":
              if (!targetUser.followers.includes(currentUserId)) {
                targetUser.followers.push(currentUserId);
              }
              if (!currentUser.following.includes(targetId)) {
                currentUser.following.push(targetId);
              }
              break;
            case "unfollow":
              targetUser.followers = targetUser.followers.filter((id: string) => id !== currentUserId);
              currentUser.following = currentUser.following.filter((id: string) => id !== targetId);
              break;
            case "block":
              if (!targetUser.blockedBY.includes(currentUserId)) {
                targetUser.blockedBY.push(currentUserId);
              }
              targetUser.followers = targetUser.followers.filter((id: string) => id !== currentUserId);
              currentUser.following = currentUser.following.filter((id: string) => id !== targetId);
              invalidateCachePaths.push(
                `/u/user_${targetUser.username}`,
                `posts_recommended_feed_${currentUserId}_home`,
                `posts_recommended_feed_${currentUserId}`
              );
              break;
            case "unblock":
              targetUser.blockedBY = targetUser.blockedBY.filter((id: string) => id !== currentUserId);
              break;
            default:
              return c.json({
                status: errorCodes.INVALID_REQUEST,
                message: "Invalid user action type.",
              }, errorCodes.INVALID_REQUEST);
          }

          updateCurrentUserFields.following = currentUser.following;
          updateTargetUserFields.followers = targetUser.followers;
          updateTargetUserFields.blockedBY = targetUser.blockedBY;

          globalThis.listeners?.forEach((listener: any) => {
            if (listener.ws.readyState === WebSocket.OPEN) {
              listener.ws.send(JSON.stringify({
                status: httpCodes.OK,
                message: "Action completed successfully.",
                data: {
                  type: "users",
                  action: action_type,
                  targetId,
                  userId: currentUserId,
                  res: (action_type === "follow" || action_type === "unfollow")
                    ? { targetUser, currentUser }
                    : {},
                },
              }));
            }
          });

          await Promise.all([
            rqHandler.crudManager.update({
              collection: "users",
              id: currentUserId, 
              
              cacheKey: ``,
              fields: updateCurrentUserFields,
              invalidateCache: [`/u/${currentUser.username}`],
            }, token as any, true),
            rqHandler.crudManager.update({
              collection: "users",
              id: targetId,
              fields: updateTargetUserFields,
              cacheKey: ``,
              invalidateCache: [`/u/${targetUser.username}`, ...invalidateCachePaths],
            }, token as any, true),
          ]);

          return c.json({ status: httpCodes.OK, message: "Action completed successfully." });
        }

        if (type === "posts" || type === "comments") {
          const collection = type;
          const docRecord = await rqHandler.crudManager.get({ collection, id: targetId, expand: ["author"] , cacheKey: `posts_${targetId}`}, token as any);

          if (!docRecord?._payload) {
            return c.json({
              status: errorCodes.NOT_FOUND,
              message: `${collection.slice(0, -1)} not found.`,
            }, errorCodes.NOT_FOUND);
          }

          const doc = docRecord._payload;
          doc.likes = Array.isArray(doc.likes) ? doc.likes : [];
          doc.bookmarked = Array.isArray(doc.bookmarked) ? doc.bookmarked : [];

          const fieldsToUpdate: Record<string, any> = {};
          let invalidateCachePaths: string[] = [];
          let res: any = null;
          invalidateCachePaths = [
            `/${collection}_${doc.id}`,
            `${collection}_recommended_feed_${currentUserId}`,
            `_feed_${currentUserId}_bookmarks`,
            (["pin", "unpin"].includes(action_type) && decodedToken.payload?.username) ? `/u/${decodedToken.payload.username}_posts` : undefined,
            (["pin", "unpin"].includes(action_type) && decodedToken.payload?.username) ? `/u/${decodedToken.payload.username}` : undefined,
            (["delete"].includes(action_type) && decodedToken.payload?.username) ? `/u/${decodedToken.payload.username}_posts` : undefined,
             (["delete"].includes(action_type) && decodedToken.payload?.username) ? `/u/${decodedToken.payload.username}` : undefined
          ].filter((v): v is string => typeof v === "string");  
          switch (action_type) {
            case "like":
              if (!doc.likes.includes(currentUserId)) doc.likes.push(currentUserId);
              fieldsToUpdate.likes = doc.likes;
              break;
            case "unlike":
              doc.likes = doc.likes.filter((id: string) => id !== currentUserId);
              fieldsToUpdate.likes = doc.likes;
              break;
            case "bookmark":
              if (!doc.bookmarked.includes(currentUserId)) {
                doc.bookmarked.push(currentUserId);
              } else {
                doc.bookmarked = doc.bookmarked.filter((id: string) => id !== currentUserId);
              }
              fieldsToUpdate.bookmarked = doc.bookmarked;
              break;
            case "pin":
            case "unpin":
              if (doc.author !== decodedToken.payload?.id) {
                return c.json({
                  status: errorCodes.UNAUTHORIZED_REQUEST,
                  message: "You are unauthorized for this action",
                }, errorCodes.UNAUTHORIZED_REQUEST);
              }
              doc.pinned = action_type === "pin";
              fieldsToUpdate.pinned = doc.pinned;
              break;
            case "delete":
              if(doc.author !== decodedToken.payload?.id){
                return c.json({
                  status: errorCodes.UNAUTHORIZED_REQUEST,
                  message: "You are unathorized for this action"
                }, errorCodes.UNAUTHORIZED_REQUEST)
              }
              await rqHandler.crudManager.delete({collection, id: targetId, invalidateCache:invalidateCachePaths, cacheKey: ``}, token as any);
              return c.json({ status: httpCodes.OK, message: "Deleted successfully.", success: true });
            default:
              return c.json({
                status: errorCodes.INVALID_REQUEST,
                message: `Invalid ${collection.slice(0, -1)} action type.`,
              }, errorCodes.INVALID_REQUEST);
          }

           

          res = await rqHandler.crudManager.update({
            collection,
            id: targetId,
            fields: fieldsToUpdate,
            invalidateCache: invalidateCachePaths,
            cacheKey: ""
          }, token as any, true);

          if (!["pin", "unpin"].includes(action_type)) {
            globalThis.listeners?.forEach((listener: any) => {
              if (listener.ws.readyState === WebSocket.OPEN) {
                listener.ws.send(JSON.stringify({
                  status: httpCodes.OK,
                  message: "Action completed successfully.",
                  data: {
                    type: collection,
                    action: action_type,
                    targetId,
                    userId: currentUserId,
                    res: res?._payload,
                  },
                }));
              }
            });
          }

          return c.json({
            status: httpCodes.OK,
            message: "Action completed successfully.",
            res: res?._payload,
          });
        }

        return c.json({
          status: errorCodes.INVALID_REQUEST,
          message: "Unsupported action target type.",
        }, errorCodes.INVALID_REQUEST);

      } catch (err: any) {
        console.error(`Error performing action on ${type} (ID: ${targetId}):`, err);
        return c.json({
          status: errorCodes.SYSTEM_ERROR,
          message: err.message || errorMessages[errorCodes.SYSTEM_ERROR] || "An unknown error occurred.",
        }, httpCodes.INTERNAL_SERVER_ERROR);
      }
    }
  );

  return actions;
};
