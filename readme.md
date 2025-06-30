# Codename Hapta

**Hapta** is a robust, secure, and highly scalable backend server layer specifically designed for Pocketbase. It acts as an intermediary, enhancing Pocketbase's capabilities by securing connections, providing advanced rate-limiting, and offering granular control over every database CRUD (Create, Read, Update, Delete) operation.

## Why does Postr use this?

Postr, requiring the ability to handle tens of thousands of concurrent connections, cannot afford to serve all requests directly to the database. Hapta addresses this by authenticating, rate-limiting, and caching content before it reaches the database. This multi-layered approach ensures a significantly smoother, more performant, and secure user experience.

## Features

1.  **Token-Based Session Management with Rolling Keys:**
      * Hapta implements advanced token management where session keys change with each authentication call.
      * This prevents unauthorized record creation or manipulation directly outside the application, allowing for better monitoring and security.
2.  **Oauth2 Gateway Streaming:**
      * Supports OAuth2 for secure authentication flows and seamless data streaming.
3.  **Advanced Rate-Limiting:**
      * Unlike Pocketbase's direct per-request cancellation threshold, Hapta provides comprehensive rate-limiting capabilities. This is crucial for handling high volumes of requests (tens of thousands of users) and protecting against spam or abuse.
4.  **Request Validation (Zod Integration):**
      * **ZODDDD for Robust Input Validation:** Integrated Zod, a TypeScript-first schema declaration and validation library, to enforce strict validation rules on all incoming request bodies, query parameters, and path parameters.
      * **Improved Error Handling:** Catches invalid inputs early and provides detailed, structured error messages, making it easier for clients to debug and correct their requests.
5.  **File Upload and Download Handling:**
      * Manages file uploads efficiently, including handling through WebSocket streams, and provides robust file download capabilities with validation.
6.  **Subscription-Based Sessions:**
      * Utilizes subscription-based sessions to randomize user sessions, adding an extra layer of security and preventing unauthorized data access between users.
7.  **Intelligent Caching:**
      * Reduces round trips to the database by caching frequently accessed data.
      * **Normalized Cache Key Structure:** Cache keys now follow a more normalized order (e.g., `u/username`, `posts_recommended_feed_userId`) ensuring that static pages or user-specific data persist effectively across sessions and are only invalidated when relevant data changes. This prevents unnecessary API flooding and provides a smoother experience for individual users.
8.  **Comprehensive Documentation:**
      * **Inline Code Documentation:** The entire codebase is thoroughly commented using JSDoc-style annotations, providing clear explanations for functions, routes, and logic directly within the files.
      * **External API Documentation (Swagger/OpenAPI):**
          * **Swagger UI:** Access interactive API documentation at the root path (`/`).
          * **OpenAPI Specification:** A detailed OpenAPI 3.0.0 JSON specification is available at `/openapi.json`.
          * **Scalar API Reference:** An alternative, interactive documentation interface is provided at `/api-reference`.
9.  **Optimized Code Organization:**
      * **Modular Architecture:** The codebase has been fully optimized into separate, logical files and directories (e.g., `src/middleware/`, `src/routes/auth.ts`, `src/utils/validationSchemas.ts`).
      * **Enhanced Maintainability:** This modular approach significantly improves code readability, simplifies future development, and makes debugging more straightforward by separating concerns into distinct, manageable units.
10. **Soon:** Categorization and advanced metrics for deeper insights.

## Installation

> **Stop** If you do not know how to use [Pocketbase](https://pocketbase.io/docs)

Download a release for your platform.

## Usage

Configure your server by setting the following fields in your `.env` file:

```env
DB_URL=http://localhost:8090 # Your Pocketbase instance URL
ADMIN_EMAIL=admin@example.com # Pocketbase admin email
ADMIN_PASSWORD=your_admin_password # Pocketbase admin password
HAPTA_ADMIN_KEY=your_hapta_admin_key # A secret key for Hapta's internal admin operations (optional/if needed by your setup) 
```

Create a `config.ts` file in your `src` directory (e.g., `src/config.ts`) and paste the following:

```ts
// src/config.ts
export default {
    Server: {
        Port: 3000, // Port for the Hapta server to listen on
        Hostname: "localhost", // Hostname for the server
        SSL: false // Set to true if you are running Hapta with SSL/TLS
    },
    Security: {
        Secret: "your_super_secret_jwt_key", // IMPORTANT: This should be a strong, unique secret for JWT signing.
                                             // It should ideally match the JWT_SECRET from your .env file.
    },
    developmentMode: true, // Enable development-specific features (e.g., verbose logging)
    ratelimit: {
        isEnabled: true, // Set to false to disable all rate limiting
        // Specific rate limits for HTTP and WebSocket are managed in middleware
    },
    rules: './rules.ts', // Path to your custom rules file for advanced validation
};
```

To run the server:

```bash
chmod +x ./hapta-server && ./hapta-server
```


## Build Yourself

1.  Download the source code.
2.  Customize to your specific use case, including expansions, naming conventions, filters, or cache control logic.
3.  Then run `./Scripts/build.sh` (assuming you have a build script named `build.sh`) to package your code into a `hapta-server` executable for various server types.
