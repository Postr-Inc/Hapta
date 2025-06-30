// src/index.ts
//@ts-nocheck
import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import Pocketbase from "pocketbase";
import process from 'process';
import { getCookie } from "hono/cookie";
import { decode, sign, verify } from "hono/jwt";

import config from "../config.ts";
import { HttpCodes } from "../Utils/Enums/HttpCodes/index.ts";
import { ErrorCodes, ErrorMessages } from "../Utils/Enums/Errors/index.ts";
import { MessageTypes } from "../Utils/Enums/MessageTypes/index.ts";

import AuthHandler from "../Utils/Core/AuthHandler/index.ts";
import Concurrency from "../Utils/Core/Concurrency/index.ts";
import RequestHandler from "../Utils/Core/RequestHandler/index.ts";
import CacheController from "../Utils/Core/CacheManager/index.ts";
import EmbedEngine from "../Utils/Core/EmbedEngine/index.ts"; // Keep here as it's used globally
import {
  NeuralNetwork,
  summaryToTarget,
  summaryVocabulary,
  textToVector,
  vocabulary,
  neuralNetwork,
} from "../Utils/Core/Ai"
// Import middleware
import { applyGlobalMiddleware, isTokenValid } from "./middleware/index.ts";

// Import routes
import authRoutes from "./routes/auth.ts";
import fileRoutes from "./routes/file.ts";
import collectionRoutes from "./routes/collections.ts";
import actionRoutes from "./routes/actions.ts";
import utilityRoutes from "./routes/utility.ts";
import subscriptionRoutes from "./routes/subscriptions.ts";
import docRoutes from "./routes/docs.ts";
export {
  neuralNetwork,
  summaryToTarget,
  summaryVocabulary,
  textToVector,
  vocabulary,
}
// --- Global Variables and Constants ---
const { upgradeWebSocket, websocket } = createBunWebSocket();
globalThis.version = "1.8.0";
globalThis.listeners = new Map();

export const pb = new Pocketbase(Bun.env.DatabaseURL);

// Disable auto-cancellation for Pocketbase client
pb.admins.client.autoCancellation(false);
pb.autoCancellation(false);

export const _AuthHandler = new AuthHandler(pb);

// --- Configuration Validation ---
/**
 * Validates essential environment variables and configuration settings.
 * Exits the process if any required configuration is missing.
 */
function validateConfig() {
  if (!Bun.env.DatabaseURL) {
    console.error({
      message: "Please set the DatabaseURL in your .env file",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
  }
  if (!Bun.env.AdminEmail || !Bun.env.AdminPassword) {
    console.error({
      message: "Please set the AdminEmail and AdminPassword in your .env file",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
  }
  if (!config.Security || !config.Security.Secret) {
    console.error({
      message: "Please set the Secret in your config file (config.Security.Secret)",
      status: ErrorCodes.CONFIGURATION_ERROR,
    });
    process.exit(1);
  }
}

validateConfig();

// --- Pocketbase Admin Authentication ---
/**
 * Authenticates the Pocketbase admin user.
 * Exits the process if authentication fails.
 */
async function authenticatePocketbaseAdmin() {
  try {
    await pb.admins.authWithPassword(
      Bun.env.AdminEmail,
      Bun.env.AdminPassword,
      {
        autoRefreshThreshold: 1000,
      }
    );
    console.log("Pocketbase admin authenticated successfully.");
  } catch (error) {
    console.error("Pocketbase Admin Authentication Failed:", error);
    console.error({
      message: ErrorMessages[ErrorCodes.DATABASE_AUTH_FAILED],
      status: ErrorCodes.DATABASE_AUTH_FAILED,
    });
    process.exit(1);
  }
}

// Immediately authenticate on startup
authenticatePocketbaseAdmin();

// --- Hono Application Initialization ---
const app = new Hono();


// --- Concurrency and Cache Initialization. ---
export const c = new Concurrency(); // Concurrency manager
export const cache = new CacheController(); // Cache manager
globalThis.cache = cache; // Expose cache globally (useful for debugging/testing)

// --- Request Handler Initialization. ---
export const rqHandler = new RequestHandler();
 
// --- Apply Global Middleware ---
applyGlobalMiddleware(app, config, _AuthHandler, isTokenValid, getCookie);

// --- Register Routes ---
app.route("/", docRoutes(config)); // API documentation routes
app.route("/auth", authRoutes(_AuthHandler, isTokenValid, rqHandler, config)); // Authentication routes
app.route("/api/files", fileRoutes(pb, HttpCodes)); // File serving routes
app.route("/collection", collectionRoutes(_AuthHandler, isTokenValid, rqHandler, HttpCodes, ErrorCodes, ErrorMessages)); // Collection CRUD routes
app.route("/actions", actionRoutes(_AuthHandler, isTokenValid, rqHandler, HttpCodes, ErrorCodes, ErrorMessages, decode)); // Actions routes
app.route("/", utilityRoutes(cache, rqHandler, EmbedEngine, HttpCodes, ErrorCodes, ErrorMessages)); // Utility routes
app.route("/subscriptions", subscriptionRoutes(_AuthHandler, MessageTypes, HttpCodes, ErrorCodes, ErrorMessages, decode, verify, getCookie)); // WebSocket subscriptions

// --- Server Startup ---
/**
 * Starts the Bun HTTP server.
 */
Bun.serve({
  port: config.Server.Port || 3000,
  idleTimeout: 255, // Keep-alive timeout in seconds
  websocket, // Pass the WebSocket handlers
  fetch: app.fetch, // Hono app's fetch handler
});

/**
 * Waits for the server to be ready by polling a health endpoint.
 * Useful for ensuring server is up before running tests.
 * @param {string} url - The URL to poll for readiness.
 * @param {number} timeoutMs - Maximum time to wait in milliseconds.
 * @returns {Promise<void>} Resolves if server becomes ready, rejects on timeout.
 */
async function waitForServerReady(url = `http://localhost:${config.Server.Port || 3000}/health`, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok && res.status === HttpCodes.OK) {
        console.log("Server is ready.");
        return;
      }
    } catch (e) {
      // Server not ready yet or connection refused
    }
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms before next attempt
  }
  throw new Error(`Server not ready after ${timeoutMs} ms.`);
}

// --- Server Information Log ---
console.log(`
  __  __            __
  / / / /___ _____  / /_____ _
 / /_/ / __ / __ \\/ __/ __ / /
/ __  / /_/ / /_/ / /_/ /_/ /
/_/ /_/\__,_/ .___/\\__/\__,_/
            Version: ${globalThis.version || "1.0.0"}
            Port: ${config.Server.Port || 3000}
            SSL: ${config.Server.SSL || false}
`);

// --- Process Event Handlers ---
process.on("beforeExit", async () => {
  console.log("Server shutting down. Saving changes...");
  if (Bun.env.BLUENODE === "true") {
    // Logic for exporting cache data for BLUE/GREEN deployment
    console.log("BlueNode detected: Implementing cache export logic here if needed.");
  }
  if (rqHandler?.crudManager) {
    await rqHandler.crudManager.saveChanges(); // Ensure pending changes are saved
  }
  console.log("Changes saved. Goodbye!");
});

// --- Test Runner Integration ---
// This block runs tests if '--test' argument is passed at startup
if (process.argv[2] && process.argv[2].includes("--test")) {
  (async () => {
    try {
      await waitForServerReady(); // Wait for the server to fully start
      console.log("Running tests...");
      const proc = Bun.spawnSync(["bun", "test", "./TestCases/index.test.ts"], {
        stdio: ["inherit", "inherit", "inherit"], // Pipe stdio to parent process
      });

      if (proc.exitCode === 0) {
        console.log("Tests completed successfully.");
        process.exit(0); // Exit successfully if tests pass
      } else {
        console.error(`Tests failed with exit code: ${proc.exitCode}`);
        process.exit(proc.exitCode); // Exit with failure code if tests fail
      }
    } catch (err) {
      console.error("Failed to run tests:", err);
      process.exit(1); // Exit with failure code if server doesn't become ready or other error
    }
  })();
}