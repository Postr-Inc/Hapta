// src/utils/validationSchemas.ts
//@ts-nocheck
import { z } from 'zod';
import { MessageTypes } from '../../Utils/Enums/MessageTypes';
// --- Authentication Schemas ---

export const RequestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email format."),
});

export const ResetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required."),
  password: z.string().min(8, "Password must be at least 8 characters long."),
});

export const LoginSchema = z.object({
  emailOrUsername: z.string().min(1, "Email or Username is required").superRefine((val, ctx) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const usernameRegex = /^[a-zA-Z0-9_]{3,}$/; // e.g. 3+ chars, alphanumeric+underscore

    if (emailRegex.test(val)) return; // valid email

    if (usernameRegex.test(val)) return; // valid username

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Must be a valid email or username",
    });
  }),
  password: z.string().min(1, "Password is required"),
  deviceInfo: z.object({}).optional(),
});

export const CheckUserSchema = z.object({
  email: z.string().email("Invalid email format.").optional(),
  username: z.string()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username cannot exceed 30 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.")
    .optional(),
}).refine(data => data.email || data.username, {
  message: "You must provide at least an email or username.",
  path: ["email", "username"],
});

export const RegisterSchema = z.discriminatedUnion("isBusinessAccount", [
  z.object({
    isBusinessAccount: z.literal(false),
    email: z.string().email("Invalid email format."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    username: z.string()
      .min(3, "Username must be at least 3 characters.")
      .max(30, "Username cannot exceed 30 characters.")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format."),
  }),
  z.object({
    isBusinessAccount: z.literal(true),
    email: z.string().email("Invalid business email format."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    username: z.string().min(3, "Business name must be at least 3 characters."),
    first_last_name: z.string().min(3, "Your name is required."),
    social: z.string().url("Website must be a valid URL."),
    niche: z.string().min(1, "Please select your niche."),
    postlyUse: z.string().min(1, "Please tell us how you plan to use Postly."),
  }),
]);

export const RefreshTokenSchema = z.object({
  token: z.string().min(1, "Token is required for refresh."),
});

// --- Collection Operations Schemas ---

export const CrudOperationTypeSchema = z.enum(["create", "get", "update", "delete", "list"]);

// Schema for JSON payload in collection operations
export const JsonCollectionOperationSchema = z.object({
  type: CrudOperationTypeSchema,
  payload: z.record(z.any()), // Loosely typed, as payload structure varies greatly
  security: z.object({
    token: z.string().optional(),
  }).optional(),
  callback: z.string().optional(),
});

// Schema for Multipart Form Data in collection operations
export const MultipartCollectionOperationSchema = z.object({
  type: CrudOperationTypeSchema,
  callback: z.string().optional(),
  // For multipart, payload fields are usually sent as separate form fields.
  // The parsing logic in the route will handle combining them into a 'payload' object.
  // Zod can validate the *expected* structure of form fields if known, but for a generic handler,
  // we might validate the 'payload' object after it's constructed.
  // For now, we'll validate the 'type' and 'callback' directly from form data,
  // and the actual 'payload' content validation happens implicitly by `rqHandler`.
  payload: z.record(z.any()).optional(), // The `payload` will be constructed from other form fields
});

// --- Actions Schemas ---

export const ActionPathParamsSchema = z.object({
  type: z.enum(["users", "posts", "comments"]),
  action_type: z.enum(["follow", "unfollow", "block", "unblock", "like", "unlike", "bookmark"]),
});

export const ActionBodySchema = z.object({
  targetId: z.string().min(1, "Target ID is required."),
});

// --- Utility Schemas ---

export const DeepSearchSchema = z.object({
  type: z.string().min(1, "Search type is required."),
  payload: z.record(z.any()).optional(), // Search payload can be very dynamic
  callback: z.string().optional(),
});

export const OpenGraphEmbedQuerySchema = z.object({
  url: z.string().url("Invalid URL format for OpenGraph embed."),
});

export const EmbedPathParamsSchema = z.object({
  collection: z.string().min(1, "Collection is required."),
  id: z.string().min(1, "ID is required."),
  type: z.string().min(1, "Embed type is required."),
});

// --- WebSocket Message Schema ---

export const WebSocketPayloadSchema = z.object({
  type: z.nativeEnum(MessageTypes), // Use the MessageTypes enum directly
  // Add other properties that a WebSocket payload might have
  // e.g., for AUTH_ROLL_TOKEN, no additional payload is strictly needed here
  // For other message types, you'd define specific sub-schemas
});

export const WebSocketSecuritySchema = z.object({
  token: z.string().min(1, "Token is required for WebSocket security."),
});

export const WebSocketMessageSchema = z.object({
  payload: WebSocketPayloadSchema,
  security: WebSocketSecuritySchema,
  callback: z.string().optional(),
});