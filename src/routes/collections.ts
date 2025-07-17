// src/routes/collections.ts
//@ts-nocheck
import { Hono } from "hono";
import { zValidator } from '@hono/zod-validator';

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

    let type: string | undefined;
    let payload: any;
    let security: any;
    let callback: string | undefined;

    const contentType = c.req.header("Content-Type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Parse multipart form
      const form = await c.req.formData();

      type = form.get("type")?.toString();
      callback = form.get("callback")?.toString();

      // Parse security JSON string if present
      const securityField = form.get("security")?.toString();
      if (securityField) {
        try {
          security = JSON.parse(securityField);
        } catch {
          // Log or ignore parsing error
        }
      }

      // Collect payload fields
      payload = {};
      for (const [key, value] of form.entries()) {
        if (["type", "security", "callback", "files"].includes(key)) continue; // skip 'files' here

        if (key === "payload") {
          try {
            const parsed = JSON.parse(value.toString());
            if (typeof parsed === "object" && parsed !== null) {
              Object.assign(payload, parsed);
            }
          } catch {
            console.warn("Could not parse payload field");
          }
        } else {
          try {
            payload[key] = JSON.parse(value.toString());
          } catch {
            payload[key] = value.toString();
          }
        }
      }

      const files = form.getAll("files"); // get all files with key "files"
      if (files.length > 0) {
        if (!payload.data) payload.data = {};
        payload.data.files = files;
      }

      console.log(payload)

      // Inject collection param into payload
      payload.collection = collection;

      // Validate multipart form data
      const result = schemas.MultipartCollectionOperationSchema.safeParse({ type, callback, payload });
      if (!result.success) {
        c.status(400);
        return c.json({
          status: 400,
          message: "Validation Error for Multipart Form",
          errors: result.error.errors,
        });
      }

      ({ type, callback, payload } = result.data);

    } else {
      // Assume JSON body
      const body = await c.req.json();

      // Validate JSON body
      const result = schemas.JsonCollectionOperationSchema.safeParse(body);
      if (!result.success) {
        c.status(400);
        return c.json({
          status: 400,
          message: "Validation Error for JSON Body",
          errors: result.error.errors,
        });
      }

      ({ type, payload, security, callback } = result.data);

      // Inject collection param to payload to ensure consistency
      payload.collection = collection;
    }


    // Extract token from header or security
    const token = c.req.header("Authorization") || security?.token;
    if (!token || !isTokenValidFn(token, _AuthHandler)) {
      c.status(401);
      return c.json({
        status: 401,
        message: "Invalid or missing token",
      });
    }

    if (!type || !payload) {
      c.status(400);
      return c.json({
        status: 400,
        message: "Missing 'type' or 'payload' in request",
      });
    }

    // Pass to your request handler
    const result = await rqHandler.handleMessage({ type, payload, callback }, token);

    c.status(result.opCode || 200);
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
        cacheKey,
        options: {
          filter,
          sort,
          order,
          expand: expandArr,
          recommended, 
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