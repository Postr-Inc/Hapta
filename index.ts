import Context from "./helpers/HTTP/Request/Context";
import { serve, FileSystemRouter, type Serve, type Server } from "bun";
import { config, getJwtSecret } from "./src/core/config";
import Pocketbase from "pocketbase";
import path from "path";
import { DatabaseService } from "./src/core/CrudManager";
import Cache from "./src/core/CacheManager";
import process from "process";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import * as z from "zod";
import { watch } from "fs";
import fs from "fs"
import { pathToFileURL } from "url";
import { MemoryState } from "./src/core/MemoryState";

export const memoryState = new MemoryState(5 * 60 * 1000);

// --- Global server and router instances ---
let server: Server;

if (!fs.existsSync(path.join(process.cwd(), "routes"))) {
    console.error("Routes folder not found. Please create a 'routes' directory in the project root.");
    process.exit(1);
}

const router = new FileSystemRouter({
    style: "nextjs",
    dir: path.join(process.cwd(), "routes"),
}); 
// --- Database Configuration Check ---
if (!config.Database?.url || !config.Database?.ADMIN_PASSWORD || !config.Database?.ADMIN_EMAIL) {
    console.error("❌ Please set an admin email and admin password for database authentication");
    process.exit(1);
}

// --- Pocketbase Connection ---
export const pb = new Pocketbase(config.Database?.url || "");
pb.autoCancellation(false)
try {
    await pb.collection("_superusers").authWithPassword(config.Database?.ADMIN_EMAIL || "", config.Database?.ADMIN_PASSWORD || "");
} catch (_) { }

const cache = new Cache();
const db = new DatabaseService(pb, cache);

// --- Route Handler Interface ---
interface RouteHandler {
    GET?: (ctx: Context, db: DatabaseService) => Promise<Response>;
    POST?: (ctx: Context, db: DatabaseService) => Promise<Response>;
    PUT?: (ctx: Context, db: DatabaseService) => Promise<Response>;
    PATCH?: (ctx: Context, db: DatabaseService) => Promise<Response>;
    DELETE?: (ctx: Context, db: DatabaseService) => Promise<Response>;
    onError?: (request: Request, error: any) => Promise<Response> | Response;
    [key: string]: any;
}

// --- CORS Configuration ---
interface CorsConfig {
    origins: string[] | "*";
    methods: string[];
    allowedHeaders: string[];
    exposedHeaders: string[];
    credentials: boolean;
    maxAge: number;
}

const defaultCorsConfig: CorsConfig = {
    origins: config.Server.origin === "*" ? "*" : [config.Server.origin],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    credentials: true,
    maxAge: 86400,
};

// Helper to check if origin is allowed
function isOriginAllowed(origin: string | null, corsConfig: CorsConfig): boolean {
    if (!origin) return false;
    if (corsConfig.origins === "*") return true;
    if (Array.isArray(corsConfig.origins)) {
        return corsConfig.origins.includes(origin);
    }
    return false;
}

// Build CORS headers
function buildCorsHeaders(origin: string | null, corsConfig: CorsConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    if (origin && isOriginAllowed(origin, corsConfig)) {
        headers["Access-Control-Allow-Origin"] = origin;
    } else if (corsConfig.origins === "*") {
        headers["Access-Control-Allow-Origin"] = "*";
    } else if (Array.isArray(corsConfig.origins) && corsConfig.origins.length > 0) {
        // Use first origin as fallback
        headers["Access-Control-Allow-Origin"] = corsConfig.origins[0];
    }

    if (corsConfig.credentials) {
        headers["Access-Control-Allow-Credentials"] = "true";
    }

    headers["Access-Control-Allow-Methods"] = corsConfig.methods.join(", ");
    headers["Access-Control-Allow-Headers"] = corsConfig.allowedHeaders.join(", ");

    if (corsConfig.exposedHeaders.length > 0) {
        headers["Access-Control-Expose-Headers"] = corsConfig.exposedHeaders.join(", ");
    }

    headers["Access-Control-Max-Age"] = corsConfig.maxAge.toString();

    return headers;
}

// --- Server Configuration Builder ---
async function createServeConfig(): Promise<Serve> {
    console.log("🛠️ Building server configuration...");

    // Reload the router to detect new/deleted files
    router.reload();

    const routeHandlers = new Map<string, RouteHandler>();
    const schemas = new Map();
    const middlewares = new Map<string, (ctx: Context) => Promise<Response | boolean>>();

    const reimportModule = async (modulePath: string) => {
        const resolvedPath = path.resolve(modulePath);
        if (require.cache[resolvedPath]) {
            delete require.cache[resolvedPath];
        }
        const module = require(modulePath);
        return module;
    };

    // Load all route modules
    for (const [pathname, routePath] of Object.entries(router.routes)) {
        try {
            const routeModule = await reimportModule(routePath as string); 

            // Store the entire module object for method-based routing
            routeHandlers.set(pathname, routeModule.default || routeModule);

            // Load schema if exists
            const schemaPath = path.join(process.cwd(), "schemas", pathname, "index.ts");
            if (await Bun.file(schemaPath).exists()) {
                const schema = await reimportModule(schemaPath);
                if (schema.default) schemas.set(pathname, schema.default);
            }

            // Load middleware if exists
            const middlewarePath = path.join(path.dirname(routePath as string), "middleware.ts");
            if (await Bun.file(middlewarePath).exists()) {
                const middleware = await reimportModule(middlewarePath);
                if (middleware.default) middlewares.set(pathname, middleware.default);
            }
        } catch (e) {
            console.error(`❌ Error loading module for route ${pathname}:`, e);
        }
    }

    console.log("✅ All modules loaded.");

    return {
        port: config.port,
        async fetch(req: Request) {
            const url = new URL(req.url);
            const origin = req.headers.get("origin");
            const corsHeaders = buildCorsHeaders(origin, defaultCorsConfig);

            if (url.pathname.startsWith("/files")) {
                const filePath = url.pathname.replace("/files", "");

                // 1️⃣ Cache hit
                const cached = cache.get(filePath);
                if (cached) {
                    return new Response(cached.body, {
                        headers: cached.headers,
                    });
                }

                const res = await fetch(config.Database!.url + "/api/files/" + filePath); 

                if (!res.ok) {
                    return new Response("File not found", { status: 404 });
                }

                // 3️⃣ Read once
                const buffer = await res.arrayBuffer();

                const headers = {
                    "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
                    "Cache-Control": "public, max-age=31536000",
                };

                // 4️⃣ Store bytes, not Response
                cache.set(filePath, {
                    body: buffer,
                    headers,
                });

                // 5️⃣ Return fresh Response
                return new Response(buffer, { headers });
            }


            const method = req.method.toUpperCase();
            // Handle CORS preflight
            if (req.method === "OPTIONS") {
                return new Response(null, {
                    status: 204,
                    headers: corsHeaders,
                });
            }


            const routeMatch = router.match(url.pathname)

            if (!routeMatch) {
                return new Response("404 Not Found", {
                    status: 404,
                    headers: corsHeaders
                });
            }
 
            const routeHandler = routeHandlers.get(routeMatch.name);
            const middleware = middlewares.get(routeMatch.name);
            const schema = schemas.get(routeMatch.name);

            if (!routeHandler) {
                return new Response(`Route handler for ${routeMatch.name} not found.`, {
                    status: 404,
                    headers: corsHeaders
                });
            }

            try {
                const context = await buildRequestContext(req, req.headers);
                context.metadata.params = routeMatch.params;
                context.metadata.query = Object.fromEntries(url.searchParams.entries());
                context.metadata.headers = Object.fromEntries(req.headers.entries());

                // Run middleware if exists
                if (middleware) {
                    const result = await middleware(context);
                    if (result instanceof Response) {
                        // Add CORS headers to middleware response
                        const responseHeaders = new Headers(result.headers);
                        for (const [key, value] of Object.entries(corsHeaders)) {
                            responseHeaders.set(key, value);
                        }
                        return new Response(result.body, {
                            status: result.status,
                            statusText: result.statusText,
                            headers: responseHeaders,
                        });
                    }
                    if (result === false) return new Response("Forbidden", {
                        status: 403,
                        headers: corsHeaders
                    });
                }

                // Schema validation
                if (schema) {
                    const methodSchema = schema[method] ?? schema;
                    const bodySchema = methodSchema?.body
                        ?? (typeof methodSchema?.safeParseAsync === "function" ? methodSchema : undefined);
                    const validation = {
                        body: method !== "GET" && method !== "DELETE" && bodySchema
                            ? await bodySchema.safeParseAsync(context.metadata.json)
                            : undefined,
                        query: methodSchema?.query
                            ? await methodSchema.query.safeParseAsync(context.metadata.query)
                            : undefined,
                        headers: methodSchema?.headers
                            ? await methodSchema.headers.safeParseAsync(context.metadata.headers)
                            : undefined,
                    };

                    for (const key of ["body", "query", "headers"] as const) {
                        if (validation[key] && !validation[key]?.success) {
                            routeHandler.onError && routeHandler.onError(req, {
                                name: "ValidationError",
                                message: `Invalid ${key} format`,
                                details: validation[key]?.error.flatten(),
                            });
                            return new Response(
                                JSON.stringify({
                                    success: false,
                                    data: { error: validation[key]?.error.flatten() }
                                }),
                                {
                                    status: 400,
                                    headers: {
                                        "Content-Type": "application/json",
                                        ...corsHeaders
                                    }
                                }
                            );
                        }
                    }
                }

                // Get method-specific handler  well if route
                const methodHandler = typeof routeHandler === "function"
                    ? routeHandler
                    : routeHandler[method] || routeHandler.default;

                if (typeof methodHandler !== "function") {
                    return new Response(
                        `Method ${method} not allowed for ${routeMatch.name}`,
                        {
                            status: 405,
                            headers: {
                                "Allow": Object.keys(routeHandler)
                                    .filter(key => typeof routeHandler[key] === 'function')
                                    .join(", "),
                                ...corsHeaders
                            }
                        }
                    );
                }

                // Execute the route handler
                const response = await methodHandler(context, db);

                // Add CORS headers to the response
                if (response instanceof Response) {
                    const responseHeaders = new Headers(response.headers);
                    for (const [key, value] of Object.entries(corsHeaders)) {
                        responseHeaders.set(key, value);
                    }
                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders,
                    });
                }

                return response;
            } catch (err) {
                console.error(`❌ Error handling ${url.pathname}:`, err);

                // Check if route handler has custom error handler
                if (routeHandler.onError) {
                    try {
                        const errorResponse = await routeHandler.onError(req, err);
                        // Add CORS headers to error response
                        if (errorResponse instanceof Response) {
                            const responseHeaders = new Headers(errorResponse.headers);
                            for (const [key, value] of Object.entries(corsHeaders)) {
                                responseHeaders.set(key, value);
                            }
                            return new Response(errorResponse.body, {
                                status: errorResponse.status,
                                statusText: errorResponse.statusText,
                                headers: responseHeaders,
                            });
                        }
                    } catch (errorHandlerErr) {
                        console.error(`❌ Error handler also failed:`, errorHandlerErr);
                    }
                }

                return new Response("Internal Server Error", {
                    status: 500,
                    headers: corsHeaders
                });
            }
        },
        error(error) {
            const url = new URL(error.request.url);
            const origin = error.request.headers.get("origin");
            const corsHeaders = buildCorsHeaders(origin, defaultCorsConfig);

            const routeMatch = router.match(url.href);

            if (routeMatch) {
                const routeHandler = routeHandlers.get(routeMatch.name);
                if (routeHandler && typeof routeHandler.onError === "function") {
                    try {
                        const errorResponse = routeHandler.onError(error.request, error);
                        if (errorResponse instanceof Response) {
                            const responseHeaders = new Headers(errorResponse.headers);
                            for (const [key, value] of Object.entries(corsHeaders)) {
                                responseHeaders.set(key, value);
                            }
                            return new Response(errorResponse.body, {
                                status: errorResponse.status,
                                statusText: errorResponse.statusText,
                                headers: responseHeaders,
                            });
                        }
                    } catch (e) {
                        console.error("❌ Route error handler failed:", e);
                    }
                }
            }

            return new Response("Something went wrong!", {
                status: 500,
                headers: corsHeaders
            });
        },
    };
}

// --- Debounced File Watcher ---
let reloadTimeout: Timer | null = null;
function watchFiles() {
    const watchDirs = [
        path.join(process.cwd(), "routes"),
        fs.existsSync(path.join(process.cwd(), "schemas")) ? path.join(process.cwd(), "schemas") : null,
    ];

    const triggerReload = (changeType: string, filename: string | null) => {
        if (!filename) return;
        if (reloadTimeout) clearTimeout(reloadTimeout);

        reloadTimeout = setTimeout(async () => {
            console.log(`\n🔁 Change detected in ${changeType}: ${filename}.`);
            try {
                const newConfig = await createServeConfig();
                server.reload(newConfig);
                console.log("✅ Server reloaded successfully.");
            } catch (e) {
                console.error("❌ Server reload failed:", e);
            }
        }, 100);
    };

    for (const dir of watchDirs) {
        if (dir === null) continue;
        watch(dir, { recursive: true }, (changeType, filename) => triggerReload(changeType, filename));
    }

    console.log("👀 Watching for file changes in routes/ and schemas/...");
}

// --- Helper Functions ---
function validateToken(token: string) {
    try {
        return jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
    } catch {
        return null;
    }
}
async function Register(data: { username: string; email: string; password: string }) {
    try {
        data.passwordConfirm = data.password
        const response = await pb.collection("users").create(data);
        return { success: true, data: response, status: 200 };
    } catch (err: any) {
        const fieldErrors: Record<string, { code: string; message: string }> = {};

        if (err?.data) {
            for (const key in err.data) {
                let value = err.data[key];

                // If value is a stringified JSON, parse it
                if (typeof value === "string" && value.startsWith("{")) {
                    try {
                        value = JSON.parse(value);
                    } catch (_) {
                        // fallback: leave as string
                    }
                }

                // If value is now an object of field errors
                if (typeof value === "object" && !Array.isArray(value)) {
                    for (const field in value) {
                        const msg = value[field];
                        fieldErrors[field] = {
                            code: msg.code || "validation_error",
                            message: msg.message || String(msg),
                        };
                    }
                } else if (Array.isArray(value)) {
                    fieldErrors[key] = {
                        code: "validation_error",
                        message: value.join(" "),
                    };
                } else {
                    fieldErrors[key] = {
                        code: "validation_error",
                        message: String(value),
                    };
                }
            }
        }

        return {
            success: false,
            data: {
                error: {
                    fieldErrors,
                    formErrors: [err?.message || "Failed to create record."],
                },
            },
            status: err?.status || 400,
        };
    }
}


async function buildRequestContext(req: Request, headers: Headers): Promise<Context> {
    const reqJSON = await req.json().catch(() => ({}));

    const authHeader = headers.get("Authorization");
    const token = authHeader
        ? authHeader.replace(/^Bearer\s+/i, "").trim()
        : null;

    let isAuthenticated = false;
    let principal: any = { isAuthenticated };

    if (token) {
        try {
            const validated = jwt.verify(token, getJwtSecret());
            principal = { ...validated, isAuthenticated: true };
            isAuthenticated = true;
        } catch (error) {
            console.log(error)
            isAuthenticated = false;
        }
    }

    return {
        principal: { ...principal, isAuthenticated },
        services: {
            async Authenticate(options) {
                const { type } = options;
                if (type === "passwordAuth") {
                    const { emailOrUsername, password } = options
                    const login = await pb.collection("users").authWithPassword(emailOrUsername, password);
                    // make a token 
                    const token = jwt.sign({ id: login.record.id, username: login.record.username }, getJwtSecret(), { expiresIn: '1h' });

                    return { isAuthenticated: true, token, ...login.record };
                }
            },
            Register,
            async Verify(token: string) {
                try {
                    // Returns the decoded payload if valid, throws if expired/tampered
                    return jwt.verify(token, getJwtSecret());
                } catch (error) {
                    // Specifically catching JsonWebTokenError or TokenExpiredError
                    return false;
                }
            },

            Decode(token: string) {
                // decode() just reads the data without checking the signature.
                // Useful for checking expiration or UI logic without needing the Secret.
                return jwt.decode(token);
            }

        },
        metadata: {
            requestID: crypto.randomUUID(),
            timestamp: new Date(),
            token,
            params: {},
            query: {},
            json: reqJSON,
            headers: {}
        },
        json: (value: any, status?: number, statusText?: string) => {
            return Response.json(value, {
                ...(status && { status }),
                ...(statusText && { statusText }),
            });
        },
        html: (value: string, status?: number, statusText?: string) => {
            return new Response(value, {
                ...(status && { status }),
                ...(statusText && { statusText }),
                headers: {
                    "Content-Type": "text/html",
                }
            });
        }
    } as Context;
}

// --- Initial Server Start --- 
server = Bun.serve(await createServeConfig());
console.log(`🚀 Hapta listening at http://localhost:${server.port}`);
console.log(`🌐 CORS configured for origins: ${defaultCorsConfig.origins === "*" ? "* (all)" : defaultCorsConfig.origins.join(", ")}`);
console.log(`🔧 Allowed methods: ${defaultCorsConfig.methods.join(", ")}`);
watchFiles();

const Hapta = {
    DatabaseService,
    Context,
    config,
    server,
    pb,
};

export default Hapta;