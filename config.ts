export default {
    port: 3000,
    hostname: "localhost",
    developmentMode: false,
    dashboard: {
        port: 3001,
        hostname: "localhost",
        developmentMode: false 
    },
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
        update:{
            limit: 10,
            every: 1000,
            maxUses: 0
        },
        delete:{
            limit: 10,
            every: 1000,
            maxUses: 0
        },
        create:{
            limit: 10,
            every: 1000,
            maxUses: 0
        },
        authUpdate:{
            limit: 10,
            every: 1000,
            maxUses: 0
        }

    },
      
    rules: '/rules.ts',
    
}