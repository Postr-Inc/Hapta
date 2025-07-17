// src/routes/utility.ts
//@ts-nocheck
import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod'; 

import * as schemas from '../utils/validationSchemas.ts'; // Import all schemas

const utility = new Hono();

export default (cache: any, rqHandler: any, EmbedEngine: any, HttpCodes: any, ErrorCodes: any, ErrorMessages: any) => {

  /**
   * Deep Search Endpoint.
   * Handles complex search queries.
   * @route POST /deepsearch
   */
  utility.post(
    "/deepsearch",
    zValidator('json', schemas.DeepSearchSchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error for deep search.",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const token = c.req.header("Authorization"); // Token validation handled by middleware

      const { type, payload, callback } = c.req.valid('json');
      const result = await rqHandler.handleMessage({ type, payload, callback }, token);

      c.status(result.opCode || HttpCodes.OK);
      return c.json(result);
    }
  );

  /**
   * OpenGraph Embed Endpoint.
   * Fetches and caches OpenGraph metadata for a given URL.
   * @route GET /opengraph/embed
   */
  utility.get(
    '/opengraph/embed',
    zValidator('query', schemas.OpenGraphEmbedQuerySchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error for OpenGraph embed URL.",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const { url } = c.req.valid('query');

      const cached = cache.get(url);
      if (cached) {
        return c.json(cached);
      }

      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to fetch URL: ${res.status} ${res.statusText}`);
        }

        const metadata = {
          title: '',
          description: '',
          image: '',
          url,
        };

        const rewriter = new HTMLRewriter()
          .on('title', {
            text(text) {
              if (!metadata.title) metadata.title = text.text.trim();
            },
          })
          .on('meta', {
            element(el) {
              const prop = el.getAttribute('property') || el.getAttribute('name');
              const content = el.getAttribute('content');

              switch (prop) {
                case 'og:title':
                  metadata.title ||= content || '';
                  break;
                case 'og:description':
                  metadata.description ||= content || '';
                  break;
                case 'og:image':
                  metadata.image ||= content || '';
                  break;
              }
            },
          });

        const rewrittenStream = rewriter.transform(res);
        await rewrittenStream.text();

        cache.set(url, metadata, 172800);
        return c.json(metadata);
      } catch (err) {
        console.error('Failed to fetch or parse OG metadata:', err);
        c.status(HttpCodes.INTERNAL_SERVER_ERROR);
        return c.json({ error: 'Failed to fetch metadata' });
      }
    }
  );

  /**
   * Embed Content Endpoint.
   * Renders dynamic HTML content for embedding.
   * @route GET /embed/:collection/:id/:type
   */
   

  /**
   * Health Check Endpoint.
   * @route GET /health
   */
  utility.get("/health", (c) => {
    return c.json({ status: HttpCodes.OK, message: "Server is running" });
  });

  return utility;
};