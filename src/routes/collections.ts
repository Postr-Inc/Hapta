// src/routes/collections.ts
//@ts-nocheck
import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import * as schemas from '../utils/validationSchemas.ts'; // Import all schemas
import RequestHandler from "../../Utils/Core/RequestHandler/index.ts";

const collections = new Hono();

export default (_AuthHandler: any, isTokenValidFn: Function, rqHandler: RequestHandler, HttpCodes: any, ErrorCodes: any, ErrorMessages: any) => {

  /**
   * Collection Operations Endpoint (CRUD).
   * Supports JSON and multipart/form-data for various CRUD operations.
   * @route POST /collection/:collection
   */
  collections.post("/:collection", async (c) => {
    const { collection } = c.req.param();
    let type: string | undefined, payload: any, security: any, callback: string | undefined;

    const contentType = c.req.header("Content-Type") || "";

    // Parse request body based on Content-Type
    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      type = form.get("type")?.toString();
      callback = form.get("callback")?.toString();

      payload = {};
      for (const [key, value] of form.entries()) {
        if (["type", "security", "callback"].includes(key)) continue;

        if (value instanceof File) {
          if (!payload.files) payload.files = [];
          payload.files.push(value);
        } else {
          try {
            payload[key] = JSON.parse(value.toString()); // Attempt to parse nested JSON
          } catch {
            payload[key] = value.toString(); // Fallback to string if not JSON
          }
        }
      }
      // Extract token from a hypothetical 'security' field in multipart or header
      const securityField = form.get("security")?.toString();
      if (securityField) {
        try {
          security = JSON.parse(securityField);
        } catch (e) {
          console.warn("Could not parse multipart security field:", e);
        }
      }

      // Validate multipart data using Zod
      const parseResult = schemas.MultipartCollectionOperationSchema.safeParse({ type, callback, payload });
      if (!parseResult.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error for Multipart Form",
          errors: parseResult.error.errors,
        });
      }
      ({ type, callback, payload } = parseResult.data);


    } else { // Assume application/json
      const body = await c.req.json();
      const parseResult = schemas.JsonCollectionOperationSchema.safeParse(body);

      if (!parseResult.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error for JSON Body",
          errors: parseResult.error.errors,
        });
      }
      ({ type, payload, security, callback } = parseResult.data);
    }

    const token = c.req.header("Authorization") || security?.token;

    if (!isTokenValidFn(token, _AuthHandler)) {
      c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
      return c.json({
        status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
        message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
      });
    }

    if (!type || !payload) { // This check should ideally be redundant with Zod validation
      c.status(HttpCodes.BAD_REQUEST);
      return c.json({
        status: HttpCodes.BAD_REQUEST,
        message: "Missing 'type' or 'payload' in request body.",
      });
    }

    payload.collection = collection; // Inject collection into payload

    const result = await rqHandler.handleMessage({ type, payload, callback }, token);

    c.status(result.opCode || HttpCodes.OK);
    return c.json(result);
  });
  collections.get("/:collection", async (c) => {
    const { collection } = c.req.param();

    const id = c.req.query("id"); // if id is present, get single item

    const token = c.req.header("Authorization");
    if (!isTokenValidFn(token, _AuthHandler)) {
      c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
      return c.json({
        status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
        message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
      });
    }

    if (id) {
      // Handle GET single item
      const optionsRaw = c.req.query("options") || "{}";
      let options = {};
      try {
        options = JSON.parse(optionsRaw);
      } catch {
        options = {};
      }

      const payload = {
        collection,
        id,
        options,
      };

      const result = await rqHandler.handleMessage(
        {
          type: "get",
          payload,
        },
        token
      );

      return c.json(result);
    } else {
      // Handle list
      const page = c.req.query("page") ? parseInt(c.req.query("page")!, 10) : 1;
      const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : 10;

      let optionsRaw = c.req.query("options") || "{}";
      let options = {};
      try {
        options = JSON.parse(optionsRaw);
      } catch {
        options = {};
      }

      const {
        order,
        expand,
        recommended = false,
        cacheKey,
      } = options;

      const filter = typeof options.filter === "string" ? options.filter : JSON.stringify(options.filter || "{}");
      const sort = typeof options.sort === "string" ? options.sort : undefined;

      const expandArr = Array.isArray(expand) ? expand : expand ? [expand] : [];

      const payload = {
        collection,
        page,
        limit,
        options: {
          filter,
          sort,
          order,
          expand: expandArr,
          recommended,
          cacheKey,
        },
      };

      const result = await rqHandler.handleMessage(
        {
          type: "list",
          payload,
        },
        token
      );

      // Return result
      return c.json(result);
    }
  });




  return collections;
};
