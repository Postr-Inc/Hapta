import crypto from "crypto";
 
export default { 
  Server:{
    Port: 8080,
    Nodes: [], // `localhost:3025` 
    NodeId:0,
    MainNode: "ws://localhost:8080/ws/cache-sync",
    threads: 4,
    nodeEnabled: false
  },
  Security:{
    Secret: crypto.randomUUID()
  },
  ratelimit:{
    Max: 10,
    Duration: 60000,
    IP: true,
    isEnabled: true,
    Message:"You have reached the maximum number of requests per minute"
  }
}
