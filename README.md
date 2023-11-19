# Codename Hapta

What is hapta? - hapta is a backend websocket server layer for pocketbase, it helps make requesting data efficient/secure by handling all data organization security rules on backend away from frontend.

# Features
1. Token based session management - used to identify the user throughout the methods
    - This prevents users from creating records outside of the app itself, allowing better monitoring.
3. Oauth2 gateway streaming
4. Ratelimiting - this is not built into pocketbase directly - it only limits per request action up to a specific cancellation threshold which is not feasible for 10's of thousands of users
5. Request validation - requests such as update requests to user records is validated to ensure the user matches who they say they are and if they are valid to change the data


# Usage

```js
import Hapta from '/path/index.js'
const h = new Hapta({
    shouldLog: true,
    Init: {
    email:  process.env.EMAIL,
    password: process.env.PASSWORD,
    DbUrl: 'pocketbase instance url',
  },
  Port: 8080,
  RateLimits: {
    list: {
      RequestLimit: 10,
      Duration: 20000,
    },
    update: {
      RequestLimit: 2,
      Duration: 20000,
    },
  }
});


```
