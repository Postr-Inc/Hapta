// src/routes/files.ts
//@ts-nocheck
import { Hono } from "hono";

const files = new Hono();

export default (pb: any, HttpCodes: any) => {

  /**
   * CORS Preflight for File Endpoint.
   * Specific OPTIONS handler for /api/files/:collection/:id/:file to ensure proper headers.
   * @route OPTIONS /api/files/:collection/:id/:file
   */
  files.options("/:collection/:id/:file", (c) => {
    return new Response(null, {
      status: HttpCodes.NO_CONTENT,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type, Authorization",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin, Accept-Encoding"
      }
    });
  });

  /**
   * File Serving Endpoint.
   * Serves files from Pocketbase, with robust support for video streaming (Range requests).
   * @route GET /api/files/:collection/:id/:file
   */
  files.get("/:collection/:id/:file", async (c) => {
    const { collection, id, file } = c.req.param();
    if (!collection || !id || !file) {
      c.status(HttpCodes.NOT_FOUND);
      return c.json({ error: true, message: "File path incomplete or file not found" });
    }

    const fileUrl = `${pb.baseUrl}/api/files/${collection}/${id}/${file}`;
    const isVideo = /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(file);
    const rangeHeader = c.req.header("Range");

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      "Accept-Ranges": "bytes",
      "Vary": "Origin, Accept-Encoding"
    };

    // 1. Handle HEAD requests (for metadata, e.g., by iOS video players)
    if (c.req.method === "HEAD") {
      try {
        const headRes = await fetch(fileUrl, { method: "HEAD" });
        if (!headRes.ok) {
          c.status(headRes.status);
          return c.json({ error: "File not found or inaccessible for HEAD request." });
        }
        return new Response(null, {
          headers: {
            ...Object.fromEntries(headRes.headers.entries()),
            ...corsHeaders,
          }
        });
      } catch (error) {
        console.error("Error handling HEAD request for file:", error);
        c.status(HttpCodes.INTERNAL_SERVER_ERROR);
        return c.json({ error: "Failed to retrieve file metadata." });
      }
    }

    // 2. Handle Range (partial content) requests for videos
    if (isVideo && rangeHeader) {
      try {
        const headRes = await fetch(fileUrl, { method: "HEAD" });
        if (!headRes.ok) {
          c.status(headRes.status);
          return c.json({ error: "File not found or inaccessible for Range request." });
        }

        const totalSize = parseInt(headRes.headers.get("content-length") || "0", 10);
        if (!totalSize) {
          c.status(HttpCodes.INTERNAL_SERVER_ERROR);
          return c.json({ error: "File size unavailable for range request." });
        }

        const ranges = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(ranges[0], 10);
        const end = ranges[1] ? parseInt(ranges[1], 10) : totalSize - 1;

        // Validate range values
        if (isNaN(start) || isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
          c.status(HttpCodes.RANGE_NOT_SATISFIABLE); // 416
          c.header("Content-Range", `bytes */${totalSize}`); // Indicate invalid range
          return c.json({ error: "Invalid byte range requested." });
        }

        const contentLength = end - start + 1;

        const fileRes = await fetch(fileUrl, {
          headers: {
            Range: `bytes=${start}-${end}`
          }
        });

        if (!fileRes.ok || !fileRes.body) {
          console.error(`Failed to fetch file slice from Pocketbase: ${fileRes.status}`);
          c.status(HttpCodes.INTERNAL_SERVER_ERROR);
          return c.json({ error: "Failed to fetch file slice from backend." });
        }

        const responseHeaders = {
          ...corsHeaders,
          "Content-Type": fileRes.headers.get("content-type") || "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Length": contentLength.toString(),
          "Cache-Control": "no-cache",
        };

        return new Response(fileRes.body, {
          status: HttpCodes.PARTIAL_CONTENT,
          headers: responseHeaders
        });
      } catch (error) {
        console.error("Error handling video range request:", error);
        c.status(HttpCodes.INTERNAL_SERVER_ERROR);
        return c.json({ error: "An error occurred during video streaming." });
      }
    }

    // 3. Fallback for full file response (non-Range requests or non-video files)
    try {
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok || !fileRes.body) {
        c.status(HttpCodes.NOT_FOUND);
        return c.json({ error: true, message: "File not found or accessible for full request." });
      }

      const headers = new Headers(fileRes.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Accept-Ranges", "bytes");
      headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
      headers.set("Cache-Control", "public, max-age=31536000");

      return new Response(fileRes.body, {
        status: fileRes.status,
        headers
      });
    } catch (error) {
      console.error("Error serving full file:", error);
      c.status(HttpCodes.INTERNAL_SERVER_ERROR);
      return c.json({ error: "An error occurred while serving the file." });
    }
  });

  return files;
};