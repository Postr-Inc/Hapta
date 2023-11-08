import Hapta from ".";
import gateway from "./auth/.";
import Pocketbase from "pocketbase";
const balancer = new Hapta({
  maxRoomSize: 10,
  maxConnections: 1000,
  should_log: true,
  timeout: 10000,
  pocketbase: new Pocketbase(`https://postrapi.pockethost.io`),
});

function getSession(){
  return balancer.getSession()
}
 function handleRequests(data) {
  switch (data.type) {
    case "connect":
      return  balancer.connect(data.token)
      

    case "request":
       
      
      return balancer.request(data.requestBody)
       
      
      break;
    default:
      return JSON.stringify({
        status: 403,
        message: "Invalid request type",
      });
      break;
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
    return new Response(
      JSON.stringify({ status: 200, body: "Hapta is running" }, 2),
    );
  },
  websocket: {
    async message(ws, d) {
      d = d.toString();
      d = JSON.parse(d);

      switch (d.type) {
        case "connect":
          if (!d.token) {
            ws.send(
              JSON.stringify({
                status: 403,
                type: "connect",
                message: "Unauthorized",
              }),
            );
            return;
          }
          ws.send(handleRequests(d));
          break;
        case "authorize":
          if (!d.payload.userId) {
            ws.send(
              JSON.stringify({
                status: 403,
                message: "Missing userId for authorization signature",
              }),
            );
            return;
          }
          ws.send(
            JSON.stringify({
              status: 200,
              message: "Success",
              type: "authorize",
              token: new gateway().sign(d.payload.userId),
            }),
          );
          break;

        case "request":
          if (!d.requestBody) {
            ws.send(
              JSON.stringify({
                status: 403,
                message: "Missing requestBody",
              }),
            );
            return;
          }

          if (!d.requestBody.token) {
            ws.send(
              JSON.stringify({
                status: 403,
                message: "Missing token",
              }),
            );
            return;
          }

         

           

         ws.send(await handleRequests(d))
        
      }
    },
  },
});
console.log("Hapta Webserver started");

export let ws = new WebSocket("ws://localhost:8080");
ws.onmessage = async (e) => {
  let data = JSON.parse(e.data.toString());
 

  if (data.status == 200 
    && data.type == "authorize"
    ) {
    console.log("Authorized");
    ws.send(
      JSON.stringify({
        type: "connect",
        token: data.token,
      }),
    );
  }

 
 
    if(data.wsType == "request" && data.status == 200 && data.data){
      console.log(data)
    }
   
   if(data.status == 200 && data.type == "connect"){
    let client = data.clientData
   
    setInterval(() => {
      ws.send(
        JSON.stringify({
          type: "request",
          requestBody: {
            token: client.token,
            body: {
              collection: "users",
              type: "getList",
              page: 0,
              count: 10,
              expand: ["followers"],
            },
          },
        }),
      );
    }, 1000);
   }
};

ws.onopen = () => {
  console.log("Connected");
  ws.send(
    JSON.stringify({
      type: "authorize",
      payload: {
        userId: Math.random().toString(36).substring(7),
      },
    }),
  );
};
