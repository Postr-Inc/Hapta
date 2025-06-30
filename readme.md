# Codename Hapta

What is hapta? - hapta is a backend server layer for pocketbase, it helps you secure connections to your pocketbase database, aswell as allows ratelimit spam protection and total controll over every database crud method.

Why does postr use this? - Postr requires 10's of thousands of connections at once - we would not want all those requests to be served to the database directly. Instead we can authenticate - ratelimit - cache  - then serve the content from the database which provides a smoother experience.
# Features
1. Token based session management - rolling keys - these change each authentication call,
    - This prevents users from creating records outside of the app itself, allowing better monitoring.
3. Oauth2 gateway streaming
4. Ratelimiting - this is not built into pocketbase directly - it only limits per request action up to a specific cancellation threshold which is not feasible for 10's of thousands of users
5. Request validation - create custom validation code to validate the record before sent to client or database
6. File upload handling through websocket stream - and file download handling - file validation
7. Subscription based sessions - used to randomize sessions per user so no user can grab ones data
8. Cache - less round trips to the database 
9. Soon: Categorizing / metrics 
# Installation
> **Stop** If you do not know how to use [pocketbase](https://pocketbase.io/docs)

Download a release

# Usage
In your env file you can edit the following needed fields
```env
DB_URL=
ADMIN_EMAIL=
ADMIN_PASSWORD= 
HAPTA_ADMIN_KEY=
SSL_ENABLED=true
JWT_SECRET=
```
Create a config.ts file and paste the following

```ts

export default {
    port: 3000,
    hostname: "localhost",
    developmentMode: true, 
    ratelimits:{
        default:{
            limit: 10,
            every: 1000,
            maxUses: 0
        },
        list:{
            limit: 10,
            every: 1000,
            maxUses: 0
        }, 
    }, 
    rules: '/rules.ts',
}

```

# Custom rules
You can write a rules entry file to validate all records before and or after they are returned to db/user

```ts

console.log('worker started');

declare var self: Worker;
declare var TokenManager: globalThis.TokenManager;
declare var ErrorCodes: globalThis.ErrorCodes

self.onmessage = (event: MessageEvent) => {
    const { type, data, id, token } = event.data.record;

     
    const checkOwnership = () => {
        const authID = TokenManager.decode(token).id;

        if (authID !== id) {
            self.postMessage({ error: true, code: ErrorCodes.OWNERSHIP_REQUIRED });
            return false;
        }
        return true;
    };

    switch (type) {
        case 'update':
            try {
                if (!checkOwnership()) return;

                if (data.collection === "users" && TokenManager.decode(token).id  == id) {
                    
                        const cannotUpdate = ['validVerified', 'postr_plus', 'followers', 'postr_subscriber_since'];
                         
    
                        for (const key in data.record) {
                            if (cannotUpdate.includes(key)) {
                                self.postMessage({ error: true, code: ErrorCodes.OWNERSHIP_REQUIRED });
                                return;
                            }
                        }
    
                    
                }else{
                    const others = ['username', 'email', 'verified', 'validVerified', 'postr_plus', 'following', 'bio', 'postr_subscriber_since'];
                    for (const key in data.record) {
                        if (!others.includes(key)) {
                            self.postMessage({ error: true, code: ErrorCodes.OWNERSHIP_REQUIRED });
                            return;
                        }
                    }
                }
    
                self.postMessage({ error: false, message: 'success' });
            } catch (error) {
                console.log(error);
            }
            break;

        case 'delete':
            if (!checkTokenValidity() || !checkOwnership()) return;

            self.postMessage({ error: false, message: 'success' });
            break;
    }
};

```
```bash
chmod +x ./hapta-server && ./hapta-server
```

# Build yourself

1. Download the source code
2. Customize to your use case - things like expansions - name - filters - or cache controll logic
3. Then run `./build.sh` and your code will be packaged to a  hapta-server file for several server types 

