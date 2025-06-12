 
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
        Secret: ""
    },
    ratelimits:{
        Max: 10,
        Duration: 60,
        IP: true,
        Message:"You have reached the maximum number of requests per minute"
    }
}
