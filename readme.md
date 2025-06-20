# 🚀 Codename: **Hapta**

**Hapta** is an advanced backend server layer for [PocketBase](https://pocketbase.io), purpose-built to handle scale, security, and performance—without compromising flexibility or developer control.

> **Built for scale. Hardened for security. Designed for speed.**

---

## 🔍 What Is Hapta?

Hapta acts as a secure, intelligent middle-layer between your PocketBase database and the outside world. It introduces caching, request validation, rate limiting, and secure session handling to dramatically reduce database load, mitigate abuse, and enable fine-grained control over CRUD operations.

---

## 🧠 Why Postly Uses Hapta

Postly processes **tens of thousands of requests per minute**. Serving every one of those directly to the database would be inefficient and dangerous. Hapta solves that with a **smart gatekeeping model**:

* ✅ Authenticates users
* ✅ Applies rate limits
* ✅ Fetches or updates cached data
* ✅ Only hits the database **when truly necessary**

> 📊 **Performance Snapshot**:
> In one stress test, **50,000 API requests** were made.
> Only **\~430 needed to touch the database**.
> That’s **less than 1%**.
> On a **single server**, with no vertical scaling.

---

## 🛠️ Features

### ✅ Completed

* **🪪 Token-based Session Management**
  Rolling keys that rotate on each auth attempt. Blocks unauthorized direct database access.

* **📦 Custom Cache Layer**
  All reads/writes hit the cache first. Only syncs to database as needed.

* **🧠 Algorithmic API**
  Dynamic ranking of content based on relevance, freshness, and user interaction.

* **📤 File Uploads**
  Secure file handling with customizable validation.

* **🧵 Threading Support**
  Run compute-heavy tasks off the main thread using Bun’s built-in worker support.

* **🔐 Request Validation**
  Middleware-style hooks to validate payloads before hitting DB or responding to client.

---

### 🔮 Upcoming

* **📡 Intelligent Caching**
  Cache only highly-accessed records with automated eviction.

* **📨 Notification Engine**
  Push delivery for mentions, likes, and updates.

* **🔁 Node Replication**
  Run multiple Hapta instances and sync them via shared memory/cache layer.

* **🧭 Load Balancing**
  Central coordinator + edge node distribution with fallback logic.

* **🔑 One-Pass MFA Authentication**
  Secure authentication flow built with real-time token invalidation and OTP.

* **🧠 AI-Based Moderation & Validation**
  Auto-categorization of content and media moderation via ML models.

* **🔒 End-to-End Encrypted Messaging**
  Clients generate their own keys. Server can’t read the messages.

---

## ⚙️ Installation

> **Note**: You should be familiar with [PocketBase](https://pocketbase.io/docs) before proceeding.

### 1. Download a Release

Check the [releases tab](#) or build from source.

### 2. Configuration

#### `config.ts`

```ts
export default {
  Server: {
    Port: 8080,
    Nodes: ["current"],
    threads: 4
  },
  Security: {
    Secret: "bunjinkson@bongle"
  },
  ratelimit: {
    Max: 10,
    Duration: 60000,
    IP: true,
    isEnabled: true,
    Message: "You have reached the maximum number of requests per minute"
  }
}
```

#### `.env`

```env
AdminEmail="your@email.com"
AdminPassword="supersecurepassword"
DatabaseURL="http://localhost:8090"
TestUserEmail="tester@postly.app"
TestUserPassword="testpass123"
```

---

## 🚀 Usage

Start the server:

```bash
bun run dev
```

Run tests:

```bash
bun run dev --test
```

---

## 🔧 Build Yourself

1. Download the source
2. Customize expansions, filtering logic, name, caching, etc.
3. Run `./build.sh`
4. Set up your `.env`
5. Make it executable:

```bash
chmod +x ./hapta-server && AdminEmail=email AdminPassword=password DatabaseURL=url ./hapta-server
```

---

## 📈 Why Hapta Matters

> You *don’t* want 50k database hits when only 1% need real-time data.

Hapta ensures:

* Reduced **CPU** and **IO** usage on DB layer
* Safer, cleaner API exposure
* Greater **observability**, **auditability**, and **control**
* More **flexibility** than using PocketBase directly in production

---


Want to contribute? Have ideas?
Join us on GitHub and help shape the next-gen API layer.

--- 
