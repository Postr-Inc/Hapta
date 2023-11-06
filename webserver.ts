import Hapta from "."
import gateway from "./auth/."
import Pocketbase from 'pocketbase'
const balancer = new Hapta({
    maxRoomSize:10,
    maxConnections:1000,
    should_log:false,
    timeout:10000,
    pocketbase: new Pocketbase(`https://postr.pockethost.io`),
})

function authorize(token){
    return balancer.authorize(token).status
}
function handleRequests(data){
    if(data.type == "connect"){
       return balancer.connect(data.token)
    }
}
let server = Bun.serve({
    port: 8080,
    fetch(req) {
        const success = server.upgrade(req);
        if (success) {
          // Bun automatically returns a 101 Switching Protocols
          // if the upgrade succeeds
          return undefined;
        }
        return new Response(JSON.stringify({status: 200, body: "Hapta is running"}, 2))
    },
    websocket: {
        
        async message(ws, d) {
         d = d.toString()
         d = JSON.parse(d)
        
         switch(d.type){
            case "connect":
                if(!d.token){
                    ws.send(JSON.stringify({
                        status:403,
                        message:"Unauthorized"
                    }))
                    return
                }
                break;
            case "authorize":
                if(!d.payload.userId){
                    ws.send(JSON.stringify({
                        status:403,
                        message:"Missing userId for authorization signature"
                    }))
                    return
                }
                ws.send(JSON.stringify({
                    status:200,
                    message:"Success",
                    token:new gateway().sign(d.payload.userId)
                }))
                break;
         }
        
         authorize(d.token) ? 
         ws.send(handleRequests(d))
         : ws.send(JSON.stringify({
                status:403,
                message:"Unauthorized"
            }))
        },
     },
})
console.log("Hapta Webserver started")


let ws = new WebSocket("ws://localhost:8080")
ws.onmessage = (e)=>{
   let data = e.data.toString()
   data = JSON.parse(data)
   if(data.status == 200){
       console.log("Authorized")
       ws.send(JSON.stringify({
           type:"connect",
           token:data.token
       }))
   }
  
   if(data.status == 403){
       console.log("Unauthorized")
   }
   if(data.clientData){
       console.log("Client data: ", data.clientData)
   }

}

ws.onopen = ()=>{
    console.log("Connected")
     ws.send(JSON.stringify({
        type:"authorize",
        payload:{
             userId: Math.random().toString(36).substring(7),
        }
    }))
 
}