
# 🛠️ **Hapta**

**Hapta** is a modular, scalable, and feature-rich backend framework designed to extend [Pocketbase](https://pocketbase.io) with authentication, schema validation, caching, and tenant-based service orchestration.

> Designed to integrate easily into any modern Node.js backend — and purpose-built to unlock Pocketbase for production-scale deployments.

---

## 📦 Installation

```bash
npm install hapta
# or
bun add hapta
# or
yarn add hapta
```

---

## 🚀 Key Features

* ✅ **Authentication via Clover or Pocketbase Directly**
  Multi-strategy login (OAuth, password, OTP, MFA) with tenant role/clearance support.

* 🔐 **Context-Based Auth (`ctx.principal`)**
  Automatically injects authenticated user state and metadata into each request.

* 📦 **Zod-Based Schema Validation**
  Auto-validates route inputs with fully typed schema files.

* ⚡ **Smart Caching Layer**
  Dynamic TTL, auto-invalidation, optimistic scaffolds, and memory-based caching.

* 🧱 **Modular Context System**
  Unified `Context` class handles services, request metadata, auth, and responses.

* 🏗️ **Batch Write Mode**
  Queue DB changes, defer execution, and optimize complex flows.

---

## 📁 Project Structure (Recommended)

```
/
  └── routes/
      └── auth/
          └── index.ts        # Example auth endpoint
  └── schemas/
      └── auth/
          └── index.ts        # Zod validation for auth route
 
```

---

## 🧠 Quick Start

### 🧩 Set up config
> hapta-config.json
- Note: Remove Clover_Tenant_ID if you want to handle login state yourself - disables clover authentication methods
```json 
{
    "port": 8080,
    "logLevel": "info",
    "origin":"http://localhost:8081",
    "AI_ENABLED": false,
    "Clover_Tenant_ID": "",
    "Clover_Secret":"",
    "Clover_Server_Url":"clover.postlyapp.com",
    "JWT_SECRET":"*",
    "DatabaseUrl":"http://localhost:8080",
    "ADMIN_EMAIL":"email@something.com",
    "ADMIN_PASSWORD":""
}

```

### 🔐 Use the `principal`

```ts
if (ctx.principal.isAuthenticated) {
  const username = ctx.principal.username;
  const clearance = ctx.principal.highest_clearance;
}
```

---

## ⚙️ Usage Example

### `/routes/auth/index.ts`

```ts
import Context from "hapta";
import { Database } from "hapta";

export default async function POST(ctx: Context, DB: Database) {
  const { type } = ctx.metadata.query as any;

  if (type === "oauth") {
    const result = await ctx.services.Authenticate({ type: "oauth", ...ctx.metadata.query });

    return result.isAuthenticated
      ? ctx.json(result)
      : ctx.json({ error: true, message: "OAuth failed" }, 401);

  } else if (type === "password") {
    const result = await ctx.services.Clover.Authenticate({
      type: "passwordAuth",
      ...ctx.metadata.json
    });

    return result.isAuthenticated
      ? ctx.json(result)
      : ctx.json({ error: true, message: "Invalid credentials" }, 400);
  }

  return ctx.json({ error: true, message: "Unsupported auth type" }, 400);
}
```

## Then simply run

```bash
bun --hot run hapta
```

---

## 🧬 Database API

```ts
import { DatabaseService } from "hapta";

const DB = new DatabaseService(pocketbase, cacheHandler);
```

### 🔹 Get one (cached)

```ts
const record = await DB.get("users", "abc123");
```

### 🔹 List (cached + paginated)

```ts
await DB.list("posts", { page: 1, limit: 20 });
```

### 🔹 Create with scaffold

```ts
DB.setBatch(true);
await DB.create("comments", { body: "Hello!" }, true);
await DB.saveChanges();
```

---

## 🧰 Built-in Response Helpers

```ts
ctx.json({ success: true }, 200);
ctx.html("<h1>Welcome</h1>");
ctx.text("Hello world");
```

All responses include CORS headers out of the box:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## 🧪 Validation with Zod

```ts
// /schemas/auth/index.ts
import { z } from "zod";

export default z.object({
  emailOrUsername: z.string().min(3),
  password: z.string().min(6),
});
```

Hapta automatically loads and validates this schema for `/auth` requests before your handler runs.

---

## 🔄 Batch Mode

```ts
DB.setBatch(true);
await DB.create("logs", { message: "Init" });
await DB.update("users", "abc", { active: false });
await DB.delete("sessions", "xyz");
await DB.saveChanges(); // executes all queued ops
```

---

## 📦 Caching Details

| Method     | Caches | TTL     | Invalidation                    |
| ---------- | ------ | ------- | ------------------------------- |
| `get()`    | ✅      | dynamic | on `update`, `delete`           |
| `list()`   | ✅      | dynamic | on `create`, `update`, `delete` |
| `create()` | ➖      | ➖       | invalidates all list caches     |
| `update()` | ➖      | ➖       | invalidates list + get cache    |
| `delete()` | ➖      | ➖       | invalidates list + get cache    |

---

## 🧱 Integrating with Express, Bun, or Custom Server

You can wire Hapta into any server environment:

```ts
const ctx = new Context();
// inject principal, services, metadata, etc.
ctx.metadata = {
  requestID: "xyz",
  timestamp: new Date(),
  json: await req.json(),
  headers: req.headers,
  ...
};

// call route handler
const res = await handler(ctx, DB);
return res;
```

---

## 🧾 License

MIT © Postr-Inc — Built for scale.

---

## 💬 Questions?

* Open an issue
* PRs welcome
* Built with ❤️ by the Postr-Inc team
 
