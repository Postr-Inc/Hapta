// src/routes/handlers/userActions.ts
import { Context } from "hono";
import { jsonResponse, broadcastAction } from "../utils/helpers.ts";

interface UserActionParams {
  c: Context;
  token: string;
  currentUserId: string;
  targetId: string;
  action_type: string;
  rqHandler: any;
  httpCodes: any;
  errorCodes: any;
}

export async function handleUserAction({
  c,
  token,
  currentUserId,
  targetId,
  action_type,
  rqHandler,
  httpCodes,
  errorCodes,
}: UserActionParams) {
  const [targetUserRecord, currentUserRecord] = await Promise.all([
    rqHandler.crudManager.get({ collection: "users", id: targetId }, token),
    rqHandler.crudManager.get({ collection: "users", id: currentUserId }, token),
  ]);

  if (!targetUserRecord?._payload || !currentUserRecord?._payload) {
    return jsonResponse(c, errorCodes.NOT_FOUND, "User not found.", {
      status: errorCodes.NOT_FOUND,
    });
  }

  const targetUser = targetUserRecord._payload;
  const currentUser = currentUserRecord._payload;

  targetUser.followers = Array.isArray(targetUser.followers) ? targetUser.followers : [];
  currentUser.following = Array.isArray(currentUser.following) ? currentUser.following : [];
  targetUser.blockedBY = Array.isArray(targetUser.blockedBY) ? targetUser.blockedBY : [];

  let invalidateCachePaths: string[] = [];

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
      return jsonResponse(c, errorCodes.INVALID_REQUEST, "Invalid user action type.", {
        status: errorCodes.INVALID_REQUEST,
      });
  }

  await Promise.all([
    rqHandler.crudManager.update({
      collection: "users",
      id: currentUserId,
      fields: { following: currentUser.following },
      cacheKey: ``,
      invalidateCache: [`/u/${currentUser.username}`],
    }, token, true),
    rqHandler.crudManager.update({
      collection: "users",
      id: targetId,
      fields: {
        followers: targetUser.followers,
        blockedBY: targetUser.blockedBY,
      },
      cacheKey: ``,
      invalidateCache: [`/u/${targetUser.username}`, ...invalidateCachePaths],
    }, token, true),
  ]);

  broadcastAction({
    type: "users",
    action: action_type,
    targetId,
    userId: currentUserId,
    res: ["follow", "unfollow"].includes(action_type)
      ? { targetUser, currentUser }
      : {},
  });

  return jsonResponse(c, httpCodes.OK, "Action completed successfully.");
}
