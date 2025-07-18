import { Context } from "hono";
import { broadcastAction, getInvalidatePaths, jsonResponse } from "../utils/helpers";
import { HttpCodes } from "../../../Utils/Enums/HttpCodes";
import { ErrorCodes } from "../../../Utils/Enums/Errors";

interface ContentActionParams {
  c: Context;
  token: string;
  currentUserId: string;
  type: "posts" | "comments";
  action_type: string;
  targetId: string;
  reason?: string;
  rqHandler: any;
  httpCodes: any;
  errorCodes: any;
  decodeToken: any;
}

export async function handleContentAction({
  c,
  token,
  currentUserId,
  type,
  action_type,
  targetId,
  reason,
  rqHandler,
  httpCodes,
  errorCodes,
  decodeToken
}: ContentActionParams) {
  const collection = type;
  const docRecord = await rqHandler.crudManager.get({
    collection,
    id: targetId,
    expand: ["author"],
    cacheKey: `${collection}_${targetId}`,
  }, token);

  if (!docRecord?._payload) {
    return jsonResponse(c, ErrorCodes.NOT_FOUND, `${collection.slice(0, -1)} not found.`, {
      status: ErrorCodes.NOT_FOUND,
    });
  }

  const doc = docRecord._payload;
  doc.likes = Array.isArray(doc.likes) ? doc.likes : [];
  doc.bookmarked = Array.isArray(doc.bookmarked) ? doc.bookmarked : [];

  const fieldsToUpdate: Record<string, any> = {};
  const invalidateCachePaths = getInvalidatePaths({
    type: collection,
    docId: doc.id,
    username: decodeToken.payload?.username,
    userId: currentUserId,
    action: action_type,
  });

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
      if (doc.author !== decodeToken.payload?.id) {
        return jsonResponse(c, ErrorCodes.UNAUTHORIZED_REQUEST, "You are unauthorized for this action", {
          status: ErrorCodes.UNAUTHORIZED_REQUEST,
        });
      }
      doc.pinned = action_type === "pin";
      fieldsToUpdate.pinned = doc.pinned;
      break;
    case "delete":
      if (doc.author !== decodeToken.payload?.id) {
        return jsonResponse(c, ErrorCodes.UNAUTHORIZED_REQUEST, "You are unauthorized for this action", {
          status: ErrorCodes.UNAUTHORIZED_REQUEST,
        });
      }
      await rqHandler.crudManager.delete({
        collection,
        id: targetId,
        invalidateCache: invalidateCachePaths,
        cacheKey: ``,
      }, token);

      return jsonResponse(c, HttpCodes.OK, "Deleted successfully.", { success: true });

    case "report":
      if (doc.author === decodeToken.payload?.id) {
        return jsonResponse(c, errorCodes.UNAUTHORIZED_REQUEST, "You cannot report yourself.", {
          status: errorCodes.UNAUTHORIZED_REQUEST,
        });
      }
      await rqHandler.crudManager.create({
        collection: "reports",
        data: {
          reportedBy: currentUserId,
          reason,
          [collection.slice(0, -1)]: doc.id
        },
        cacheKey: `reports-${currentUserId}`,
      }, token);

      return jsonResponse(c, HttpCodes.OK, "Reported successfully.");

    default:
      return jsonResponse(c, ErrorCodes.INVALID_REQUEST, `Invalid ${collection.slice(0, -1)} action type.`, {
        status: ErrorCodes.INVALID_REQUEST,
      });
  }

  const res = await rqHandler.crudManager.update({
    collection,
    id: targetId,
    fields: fieldsToUpdate,
    invalidateCache: invalidateCachePaths,
    cacheKey: "",
  }, token, true);

  if (!["pin", "unpin"].includes(action_type)) {
    broadcastAction({
      type: collection,
      action: action_type,
      targetId,
      userId: currentUserId,
      res: res?._payload,
    });
  }

  return jsonResponse(c,  HttpCodes.OK, "Action completed successfully.", {
    res: res?._payload,
  });
}
