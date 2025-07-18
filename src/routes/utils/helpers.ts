// src/routes/utils/helpers.ts
import { Context } from 'hono';
import { WebSocket } from 'ws';
import { HttpCodes } from '../../../Utils/Enums/HttpCodes';
import { StatusCode } from 'hono/utils/http-status';

export function validateToken(token: string | undefined, handler: any): boolean {
  if (!token) return false;
  return handler.verify(token);
}

export function jsonResponse(c: Context, status: number, message: string, extra: Record<string, any> = {}) {
  c.status(status as StatusCode);
  return c.json({ status, message, ...extra });
}

export function broadcastAction(data: any) {
  globalThis.listeners?.forEach((listener: any) => {
    if (listener.ws.readyState === WebSocket.OPEN) {
      listener.ws.send(JSON.stringify({
        status: HttpCodes.OK,
        message: "Action completed successfully.",
        data,
      }));
    }
  });
}

export function getInvalidatePaths({
  type,
  docId,
  username,
  userId,
  action,
}: {
  type: string;
  docId: string;
  username?: string;
  userId: string;
  action: string;
}): string[] {
  const paths: (string | undefined)[] = [
    `/${type}_${docId}`,
    `${type}_recommended_feed_${userId}`,
    `_feed_${userId}_bookmarks`,
  ];

  if (["pin", "unpin", "delete"].includes(action) && username) {
    paths.push(`/u/${username}_posts`, `/u/${username}`);
  }

  if (action === "delete") {
    paths.push(
      `posts_recommended_feed`,
      `posts_trending_feed`,
      `posts_following_feed`
    );
  }

  return paths.filter((v): v is string => typeof v === "string");
}