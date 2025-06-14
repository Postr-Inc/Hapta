# Codename Hapta

What is hapta? - hapta is a backend server layer for pocketbase, it helps you secure connections to your pocketbase database, aswell as allows ratelimit spam protection and total controll over every database crud method.

Why does Postly use this? - Postly equires 10's of thousands of connections at once - we would not want all those requests to be served to the database directly. Instead we can authenticate - ratelimit - cache  - then serve the content from the database which provides a smoother experience.

# Feature List

## Upcoming    
- [ ] Relevant caching - only caching records frequently visited
- [ ] Notifications - push notification sending
- [ ] Node, replication - ability to run several hapta instances and each share cache and communicate between
- [ ] Improved load balancing - central server and node servers
- [ ] One pass - high level security mfa authentication
- [ ] Advanced security, ai image validation, ai post categorizing
- [ ] Message encryption, on device messaging - server only used to initialize and users communicate between the server does not know individual keys


## Features that are finished
- [x] Token based session management - rolling keys - these change each authentication call,
    - This prevents users from creating records outside of the app itself, allowing better monitoring.
- [x] Request validation -  custom validation code to validate the record before sent to client or database
- [x] File upload handling
- [x] Cache - full custom cache setup that hardly has to depend on the database, all updates go through cache first then backend last
- [x] Algorithmic Api - A ranking system, to rank posts and content based on relevancy to ensure the user gets a fresh feed each time!
- [x] Relevant who to follow side view 
- [x] Threading - Ability to offload several cpu intensive tasks on seperate threads, to ensure the main thread does not get clogged 

# Installation
> **Stop** If you do not know how to use [pocketbase](https://pocketbase.io/docs)

Download a release

# Usage
In your config.ts
```ts
 
export default {
    database:{
        AdminEmail: "",
        AdminPassword:"",
        DatabaseURL: ""
    },
    Server:{
        Port: 8080,
        Nodes: ["current"],
        threads: 4 
    },
    Security:{
        Secret: "bunjinkson@bongle"
    },
    ratelimit:{
        Max: 10,
        Duration: 60000,
        IP: true,
        isEnabled: true,
        Message:"You have reached the maximum number of requests per minute"
    }
}
```

```bash
chmod +x ./hapta-server && ./hapta-server
```

# Build yourself

1. Download the source code
2. Customize to your use case - things like expansions - name - filters - or cache controll logic
3. Then run `./build.sh` and your code will be packaged to a  hapta-server file for several server types 

