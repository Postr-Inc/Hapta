import { Hono } from "hono";
import Pocketbase from 'pocketbase'
import { rqHandler } from "..";
import { decode } from "hono/utils/jwt/jwt";
const search = new Hono()
 
export default () => {
  search.post("/deepSearch", async (ctx) => {
    const { collections, query } = await ctx.req.json();
    const token = ctx.req.header("Authorization") as string;
    const userId = decode(token)?.payload?.id;

    const searchResponse = [];

    for (const collection of collections) {
      let filter = "";

      if (collection === "users") {
        filter = `username~"${query}"`;
      } else if (collection === "posts") {
        filter = `content~"${query}"`;
      } else {
        filter = `content~"${query}"`;
      }

      const results = await rqHandler.crudManager.list({
        collection,
        page: 0,
        limit: Number.MAX_SAFE_INTEGER,
        cacheKey: `SEARCH-${query}-${userId}`,
        options: {
          filter,
        },
      }, token, true);
 
      // Push items, not the whole response (optional depending on your needs)
      searchResponse.push(...(results?._payload || []));
    }

    return ctx.json({ results: searchResponse });
  });

  return search;
};
