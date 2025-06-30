import { Hono, HonoRequest } from "hono";
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sign, decode, verify } from "hono/jwt"; // Added decode and sign for basic token and refresh

import { HttpCodes } from "../../Utils/Enums/HttpCodes/index.ts";
import { ErrorCodes, ErrorMessages } from "../../Utils/Enums/Errors/index.ts";
import * as schemas from '../utils/validationSchemas.ts'; // Import all schemas
import RequestHandler from "../../Utils/Core/RequestHandler/index.ts";
import AuthHandler from "../../Utils/Core/AuthHandler/index.ts";

const auth = new Hono();

export default (authHandler: AuthHandler, isTokenValidFn: Function, rqHandler:RequestHandler, config: any) => {

  /**
   * Request Password Reset Endpoint.
   * @route POST /auth/requestPasswordReset
   */
  auth.post(
    "/requestPasswordReset",
    zValidator('json', schemas.RequestPasswordResetSchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const { email } = c.req.valid('json');
      return authHandler.requestPasswordReset(email, c);
    }
  );

  /**
   * Reset Password Endpoint.
   * @route POST /auth/resetPassword
   */
  auth.post(
    "/resetPassword",
    zValidator('json', schemas.ResetPasswordSchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const { resetToken, password } = c.req.valid('json');
      return authHandler.resetPassword(resetToken, password, c);
    }
  );

  /**
   * User Login Endpoint.
   * @route POST /auth/login
   */
 auth.post(
  "/login",
  zValidator("json", schemas.LoginSchema), // ✅ no callback here!
  async (c) => {
    // ✅ This handler ONLY runs if validation passes

    const body = c.req.valid("json"); // 💡 no need to parse manually

    const { emailOrUsername, password, deviceInfo } = body as {
      emailOrUsername: string,
      password: string,
      deviceInfo: Object,
    };
    const ipAddress = c.req.header("CF-Connecting-IP") as string;

    // do login logic
    return authHandler.login(emailOrUsername, password, deviceInfo, ipAddress, c)
  }
), 
 
  /**
   * Generate Basic Auth Token Endpoint.
   * Generates a simple token for programmatic access with specified permissions.
   * @route POST /auth/get-basic-auth-token
   */
  auth.post("/get-basic-auth-token", async (c) => {
    // Use a strong, unique secret for signing each basic token
    const signingSecret = config.Security.Secret + crypto.randomUUID();
    const tokenId = crypto.randomUUID(); // Unique ID for this specific token instance

    // Token payload indicating it's a basic token with permissions
    const token = await sign({
      isBasicToken: true,
      id: tokenId, // Store a unique ID for this token, not a user ID
      permissions: ["read", "write", "delete"]
    }, signingSecret, "HS256") as string;

    // Store the token and its associated signing secret for verification
    authHandler.tokenStore.set(token, signingSecret);

    // Consider storing the IP that requested the basic token for stricter control
    const ipAddress = c.req.header("CF-Connecting-IP");
    if (ipAddress) {
      authHandler.ipStore.set(token, ipAddress);
    }

    c.status(HttpCodes.OK);
    return c.json({ status: HttpCodes.OK, message: "Successfully created basic auth token", token, id: tokenId });
  });

  /**
   * Delete User Account Endpoint.
   * @route DELETE /auth/delete
   */
  auth.delete("/delete", async (c) => {
    try {
      const token = c.req.header("Authorization");
      if (!token || !isTokenValidFn(token, authHandler)) {
        return c.json({
          status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
          message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
        }, ErrorCodes.INVALID_OR_MISSING_TOKEN);
      }

      const decodedToken = decode(token) as any;
      const userId = decodedToken.payload?.id;
      const username = decodedToken.payload?.username;

      if (!userId) {
        return c.json({
          status: ErrorCodes.UNAUTHORIZED_REQUEST,
          message: "User ID not found in token.",
        }, ErrorCodes.UNAUTHORIZED_REQUEST);
      }

      await rqHandler.crudManager.delete({
        collection: "users",
        id: userId,
        invalidateCache: [`u/${username}`, `posts_${userId}`],
        cacheKey: ""
      }, token);

      return c.json({ status: HttpCodes.OK, message: "User account deleted successfully." });

    } catch (error) {
      console.error("Error deleting user account:", error);
      return c.json({
        status: ErrorCodes.INTERNAL_SERVER_ERROR,
        message: ErrorMessages[ErrorCodes.INTERNAL_SERVER_ERROR] || "Issue deleting account.",
      }, HttpCodes.BAD_REQUEST);
    }
  });

  /**
   * Check Email/Username Existence Endpoint.
   * @route POST /auth/check
   */
  auth.post(
    "/check",
    zValidator('json', schemas.CheckUserSchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const { email, username } = c.req.valid('json');
      return authHandler.check(email as string, username as string, c);
    }
  );

  /**
   * User Registration Endpoint.
   * @route POST /auth/register
   */
  auth.post(
    "/register",
    zValidator('json', schemas.RegisterSchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const data = c.req.valid('json');
      return authHandler.register(data, c);
    }
  );

  /**
   * Verify Token Endpoint.
   * Checks the validity of a provided JWT token.
   * @route GET /auth/verify
   */
  auth.get("/verify", async (c) => {
    const token = c.req.header("Authorization");

    try {
      if (isTokenValidFn(token, authHandler)) {
        c.status(HttpCodes.OK);
        return c.json({
          status: HttpCodes.OK,
          message: "Token is valid.",
        });
      } else {
        c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
        return c.json({
          status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
          message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN],
        });
      }
    } catch (error) {
      console.error("Error during token verification:", error);
      c.status(HttpCodes.BAD_REQUEST);
      return c.json({ status: HttpCodes.BAD_REQUEST, message: "Internal Server Error during token verification." });
    }
  });

  /**
   * Refresh Token Endpoint.
   * Allows clients to get a new token when their current one is about to expire.
   * @route POST /auth/refreshtoken
   */
  auth.post(
    "/refreshtoken",
    zValidator('json', schemas.RefreshTokenSchema, (result, c) => {
      if (!result.success) {
        c.status(HttpCodes.BAD_REQUEST);
        return c.json({
          status: ErrorCodes.FIELD_MISSING,
          message: "Validation Error",
          errors: result.error.errors,
        });
      }
    }),
    async (c) => {
      const { token } = c.req.valid('json');
      const clientIp = c.req.header("CF-Connecting-IP");

      // Robust validation before attempting refresh
      if (
        !token ||
        !authHandler.tokenStore.has(token) || // Token must be known to the server
        !await verify(token, authHandler.tokenStore.get(token) as string, "HS256") || // Token must be verifiable
        (authHandler.ipStore.has(token) && authHandler.ipStore.get(token) !== clientIp) // IP address must match the one associated with the token (for basic tokens)
      ) {
        c.status(ErrorCodes.INVALID_OR_MISSING_TOKEN);
        return c.json({
          status: ErrorCodes.INVALID_OR_MISSING_TOKEN,
          message: ErrorMessages[ErrorCodes.INVALID_OR_MISSING_TOKEN] || "Invalid or missing token for refresh, or IP mismatch.",
        });
      }

      try {
        const signedSecret = authHandler.tokenStore.get(token) as string;
        let tokenData = decode(token)?.payload as any; // Decode to get current payload

        if (!tokenData) {
          throw new Error("Could not decode token payload.");
        }

        // Update expiration time for the new token (e.g., 7 days from now)
        tokenData.exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;

        authHandler.tokenStore.delete(token); // Invalidate the old token
        authHandler.ipStore.delete(token); // Remove old token's IP association

        const newToken = await sign(tokenData, signedSecret, "HS256"); // Sign new token
        authHandler.tokenStore.set(newToken, signedSecret); // Store new token and its secret
        authHandler.ipStore.set(newToken, clientIp as string); // Associate new token with client IP

        return c.json({
          status: HttpCodes.OK,
          message: "Token Refreshed.",
          data: {
            token: newToken,
          },
        });
      } catch (error: any) {
        console.error("Error refreshing token:", error);
        c.status(ErrorCodes.REFRESH_TOKEN_FAILED);
        return c.json({
          status: ErrorCodes.REFRESH_TOKEN_FAILED,
          message: ErrorMessages[ErrorCodes.REFRESH_TOKEN_FAILED] || "Failed to refresh token.",
          expanded: error.message,
        });
      }
    }
  );

  return auth;
};