# 🚀 **Codename: Hapta**

**Hapta** is a robust, secure, and highly scalable backend server layer built specifically for **Pocketbase**. Acting as an intelligent intermediary, it enhances Pocketbase’s core capabilities by adding security, advanced rate-limiting, granular request validation, and intelligent caching for tens of thousands of concurrent users.


## ✨ **Why does Postr use Hapta?**

Postr requires handling **tens of thousands of concurrent connections** efficiently — but directly hitting the database for every request is unsustainable and insecure. **Hapta** solves this with:

✅ **Smart authentication**
✅ **Session management with rolling keys**
✅ **OAuth2 streaming**
✅ **Granular rate-limiting**
✅ **Intelligent caching and normalization**

The result: a smoother, faster, more secure user experience **without hammering your Pocketbase instance directly**.

---

## ⚙️ **Key Features**

### 🔑 1. Token-Based Session Management with Rolling Keys

* Advanced tokens rotate with every auth call.
* Prevents unauthorized record creation or manipulation outside your official app.
* Better security and monitoring.

### 🔐 2. OAuth2 Gateway Streaming

* Native support for secure OAuth2 flows.
* Streaming capability for real-time data.

### 🚦 3. Advanced Rate-Limiting

* Go beyond Pocketbase’s basic request threshold.
* Hapta implements **IP-aware**, global, and per-user rate limits.
* Stops spam and abuse under heavy loads.

### ✅ 4. Robust Input Validation (Zod)

* Integrated **Zod** for strict schema validation.
* Validates all **bodies**, **query params**, and **path params**.
* Helpful, structured error messages for clients.

### 📁 5. Secure File Uploads & Downloads

* Streams large uploads efficiently.
* Handles robust download flows with validation.

### 🔄 6. Subscription-Based Sessions

* Randomized session allocation.
* Prevents unauthorized data cross-access between users.

### ⚡️ 7. Intelligent Edge Caching

* Caches frequently accessed data to reduce DB round trips.
* **Normalized cache keys** (e.g., `u/username`, `posts_recommended_feed_userId`) ensure:

  * Static or user-specific data persists logically.
  * Cache only invalidates on real data changes.
  * Smoother experience and reduced API flooding.

### 📚 8. Comprehensive Documentation

* **Inline JSDoc:** Detailed code comments.
* **OpenAPI & Swagger:**

  * Interactive API docs at `/`
  * OpenAPI JSON at `/openapi.json`
  * Scalar UI at `/api-reference`

### 🗂️ 9. Clean, Modular Codebase

* Organized into logical modules: `src/middleware/`, `src/routes/auth.ts`, `src/utils/validationSchemas.ts`.
* Easier to debug, extend, and maintain.

### 📊 10. Coming Soon: Categorization & Deep Metrics

* Gain deeper insight into usage patterns, API trends, and abuse detection.

---

## 🚀 **Getting Started**

### 📦 **1. Install**

> 📌 **Note:** You must already be familiar with [Pocketbase](https://pocketbase.io/docs).

Download a pre-built release for your platform.
Or build from source — see **Build Yourself** below.

---

### 🛠️ **2. Configure**

Create a `.env` file:

```dotenv
DB_URL=http://localhost:8090           # Your Pocketbase instance URL
ADMIN_EMAIL=admin@example.com          # Pocketbase admin email
ADMIN_PASSWORD=your_admin_password     # Pocketbase admin password
HAPTA_ADMIN_KEY=your_hapta_admin_key   # Optional: secret key for internal admin ops
```

Create `src/config.ts`:

```ts
// src/config.ts
import crypto from "crypto";

export default {
  Server: {
    Port: 3599,
    Nodes: [], // e.g., `localhost:3025`
    NodeId: 0,
    MainNode: "ws://localhost:3599/ws/cache-sync",
    threads: 4,
    nodeEnabled: false
  },
  Security: {
    Secret: crypto.randomUUID()
  },
  ratelimit: {
    Max: 10,
    Duration: 60000,
    IP: true,
    isEnabled: true,
    Message: "You have reached the maximum number of requests per minute"
  }
};
```

---

### ⚡ **3. Run**

```bash
chmod +x ./hapta-server
./hapta-server
```

✅ **Your secure gateway is now running.**

---

### ⚙️ **Optional: Multi-Node Cluster**

To scale horizontally:

1. Start each **node** with:

   ```bash
   ./hapta-server --mainNode false --NodeId 2
   ```

   `NodeId` must be unique for each.

2. Your **main node** should have:

   ```ts
   Nodes: ["localhost:3025"], // example other nodes
   ```

3. Start the **main node** with:

   ```bash
   bun run dev --mainNode true
   ```

Users are **round-robin assigned** to a node on auth — sessions persist and nodes sync via WebSocket.

---

## 🔨 **Build Yourself**

Prefer to build from source?

1. Clone the repo.
2. Customize logic, expansions, or naming.
3. Run:

   ```bash
   ./Scripts/build.sh
   ```
4. Deploy your new `hapta-server` binary.

---

## ✅ **Why Hapta + Pocketbase = Better**

* 🧱 **More secure**: Rolling tokens and OAuth2 streams.
* 🏎️ **Faster**: Edge caching and normalized keys.
* 🔐 **Safer**: Strong input validation and granular rate limits.
* 🗂️ **Cleaner**: Well-organized, documented code.

---

## 📄 **License**

Open source — MIT. Build, fork, extend as you wish!

---

**Built for Postr. Powered by Hapta.**

--- 
