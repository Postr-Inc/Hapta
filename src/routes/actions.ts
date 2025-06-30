// src/routes/actions.ts
//@ts-nocheck
import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import { HttpCodes } from "../Utils/Enums/HttpCodes/index.ts";
import { ErrorCodes, ErrorMessages } from "../Utils/Enums/Errors/index.ts";
import * as schemas from '../utils/validationSchemas.ts'; // Import all schemas
import AuthHandler from "../../Utils/Core/AuthHandler/index.ts";
import RequestHandler from "../../Utils/Core/RequestHandler/index.ts";

const actions = new Hono();

export default (_AuthHandler: AuthHandler, isTokenValidFn: Function, rqHandler: RequestHandler, HttpCodes: any, ErrorCodes: any, ErrorMessages: any, decodeFn: Function) => {

  /**
   * Actions Endpoint (Follow, Like, Bookmark, Block).
   * @route POST /actions/:type/:action_type
   */
  actions.post(
    "/:type/:action_type",
    zValidator('param', schemas.ActionPathParamsSchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.INVALID_REQUEST,
          message: "Invalid path parameters for action.",
          errors: result.error.errors,
        });
      }
    }),
    zValidator('json', schemas.ActionBodySchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error for action body.",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const { type, action_type } = c.req.valid('param');
      const { targetId } = c.req.valid('json');
      const token = c.req.header("Authorization");

      if (!isTokenValidFn(token, _AuthHandler)) {
        return c.json({
          status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
          message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
        }, ErrorCodes.INVALID_OR_MISSING_TOKEN);
      }

      const decodedToken = decodeFn(token) as any;
      const currentUserId = decodedToken.payload?.id;
      const isBasicToken = decodedToken.payload?.isBasicToken;

      if (!currentUserId || isBasicToken) {
        return c.json({
          status: ErrorCodes.UNAUTHORIZED_REQUEST,
          message: ErrorMessages[ErrorCodes.UNAUTHORIZED_REQUEST] || "User actions not permitted with this token type.",
        }, ErrorCodes.UNAUTHORIZED_REQUEST);
      }

      try {
        switch (type) {
          case "users": {
            const [targetUserRecord, currentUserRecord] = await Promise.all([
              rqHandler.crudManager.get({ collection: "users", id: targetId }, token),
              rqHandler.crudManager.get({ collection: "users", id: currentUserId }, token),
            ]);

            if (!targetUserRecord || !currentUserRecord || !targetUserRecord._payload || !currentUserRecord._payload) {
              return c.json({
                status: ErrorCodes.NOT_FOUND,
                message: "User not found.",
              }, ErrorCodes.NOT_FOUND);
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
                throw new Error("Invalid user action type.");
            }

            updateCurrentUserFields.following = currentUser.following;
            updateTargetUserFields.followers = targetUser.followers;
            updateTargetUserFields.blockedBY = targetUser.blockedBY;


            await Promise.all([
              rqHandler.crudManager.update({
                collection: "users",
                id: currentUserId,
                fields: updateCurrentUserFields,
                invalidateCache: [`/u/${currentUser.username}`],
              }, token, true),
              rqHandler.crudManager.update({
                collection: "users",
                id: targetId,
                fields: updateTargetUserFields,
                invalidateCache: [`/u/${targetUser.username}`, ...invalidateCachePaths],
              }, token, true),
            ]);

            break;
          }

          case "posts":
          case "comments": {
            const collection = type;
            const docRecord = await rqHandler.crudManager.get({ collection, id: targetId }, token);

            if (!docRecord || !docRecord._payload) {
              return c.json({
                status: ErrorCodes.NOT_FOUND,
                message: `${collection.slice(0, -1)} not found.`,
              }, ErrorCodes.NOT_FOUND);
            }

            const doc = docRecord._payload;
            doc.likes = Array.isArray(doc.likes) ? doc.likes : [];
            doc.bookmarked = Array.isArray(doc.bookmarked) ? doc.bookmarked : [];

            const fieldsToUpdate: Record<string, any> = {};
            let invalidateCachePaths: string[] = [];

            if (action_type === "like") {
              if (!doc.likes.includes(currentUserId)) {
                doc.likes.push(currentUserId);
              }
              fieldsToUpdate.likes = doc.likes;
            } else if (action_type === "unlike") {
              doc.likes = doc.likes.filter((id: string) => id !== currentUserId);
              fieldsToUpdate.likes = doc.likes;
            } else if (action_type === "bookmark") {
              if (!doc.bookmarked.includes(currentUserId)) {
                doc.bookmarked.push(currentUserId);
              } else {
                doc.bookmarked = doc.bookmarked.filter((id: string) => id !== currentUserId);
              }
              fieldsToUpdate.bookmarked = doc.bookmarked;
            } else {
              throw new Error(`Invalid ${collection.slice(0, -1)} action type.`);
            }

            invalidateCachePaths = [
              `/${collection}_${doc.id}`,
              `${collection}_recommended_feed_${currentUserId}`,
              `_feed_${currentUserId}_bookmarks`
            ];

            const res = await rqHandler.crudManager.update({
              collection,
              id: targetId,
              fields: fieldsToUpdate,
              invalidateCache: invalidateCachePaths,
            }, token, true);

            return c.json({
              status: HttpCodes.OK,
              message: "Action completed successfully.",
              res: res._payload,
            });
          }

          default:
            return c.json({
              status: ErrorCodes.INVALID_REQUEST,
              message: "Unsupported action target type.",
            }, ErrorCodes.INVALID_REQUEST);
        }

        return c.json({ status: HttpCodes.OK, message: "Action completed successfully." });

      } catch (err: any) {
        console.error(`Error performing action on ${type} (ID: ${targetId}):`, err);
        return c.json({
          status: ErrorCodes.SYSTEM_ERROR,
          message: err.message || ErrorMessages[ErrorCodes.SYSTEM_ERROR] || "An unknown error occurred.",
        }, HttpCodes.INTERNAL_SERVER_ERROR);
      }
    }
  );

  return actions;
};