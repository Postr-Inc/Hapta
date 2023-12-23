# Codename Hapta

What is hapta? - hapta is a backend websocket server layer for pocketbase, it helps you secure connections to your pocketbase database, aswell as allows ratelimit spam protection and total controll over every database crud method.

# Features
1. Token based session management - rolling keys - these change each authentication call,
    - This prevents users from creating records outside of the app itself, allowing better monitoring.
3. Oauth2 gateway streaming
4. Ratelimiting - this is not built into pocketbase directly - it only limits per request action up to a specific cancellation threshold which is not feasible for 10's of thousands of users
5. Request validation - requests such as update requests to user records is validated to ensure the user matches who they say they are and if they are valid to change the data
6. File upload handling through websocket stream - and file download handling 
7. Subscription based sessions - used to randomize sessions per user so no user can grab ones data
8. Sqlite memory cache with bun - less round trips to the database, hapta client cache using sdk
# Installation
> **Stop** If you do not know how to use [pocketbase](https://pocketbase.io/docs)

Download a copy of the code and follow the instructions below.

# Usage
In your env file you can edit the following needed fields
```env
PORT=
DB_URL=http://127.0.0.1:8090
ADMIN_EMAIL=
ADMIN_PASSWORD=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
```
```bash
bun run ./server.ts
```
