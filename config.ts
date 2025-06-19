 
export default { 
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
