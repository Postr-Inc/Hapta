import gateway from "./auth";
import crypto from "crypto";
interface Client {
  token: string;
  time: number;
  status: any;
  durration: number;
  isOnline: boolean;
  id:string
}

interface Request {
  token: string;
  time: number;
  durration: number;
  isOnline: boolean;
  type: string;
  body: any;
  expand?: string[];
  page?: number;
  count?: number;
  id: Number;
  from: number;
}

interface WaitingRequest {
  time: number;
  client:any;
  req:any;
  status: string;
  durration: number;
  id: Number;
}
class Hapta {
  private clients: Client[] = [];
  private waiting: Client[] = [];
  private maxRoomSize: number;
  private maxConnections: number;
  private droppedClients: number = 0;
  private waitingRequests: WaitingRequest[] = [];
  private should_log: boolean;
  private timeout: number;
  private requests: Request[] = [];
  private active_pings: any[];
  private ratelimited: any[];
  private pocketbase: any;
  private authorize: (token: string) => { status: boolean };

  constructor(config: any = {}) {
    this.maxRoomSize = config.maxRoomSize || 100;
    this.maxConnections = config.maxConnections || 1000;
    this.should_log = config.should_log || false;
    this.timeout = config.timeout || 10000;
    this.pocketbase = config.pocketbase || null;
    this.authorize = new gateway().authorize;
    this.active_pings = [];
    this.ratelimited = [];
    this.pocketbase ? this.pocketbase.autoCancellation(false) : null;

    if (Object.keys(config).length === 0) {
      console.log(
        "\x1b[33m%s\x1b[0m",
        "Hapta is running with default config ",
        {
          maxRoomSize: this.maxRoomSize,
          maxConnections: this.maxConnections,
          should_log: this.should_log,
          timeout: this.timeout,
        },
      );
    } else {
      this.should_log
        ? console.log("\x1b[36m%s\x1b[0m", "Hapta using custom config", config)
        : null;
    }

    setInterval(() => {
      this.handleClientDisconnections();
      this.handleWaitingClients();
      this.handleWaitingRequests();
    }, 1000);
  }

  private handleClientDisconnections() {
    this.clients = this.clients.filter((client) => {
      client.durration = Date.now() - client.time;
      if (client.durration > this.timeout || !client.isOnline) {
        this.should_log
          ? console.log(`${client.token} has been disconnected`)
          : null;
        this.waiting.push(client);

        this.qeue();
        return false;
      }
      return true;
    });

    this.should_log ? console.log("Clients: ", this.clients.length) : null;
  }

  public getSession(){
    return {
      clients: this.clients,
      waiting: this.waiting,
      waitingRequests: this.waitingRequests,
      requests: this.requests,
      active_pings: this.active_pings,
      ratelimited: this.ratelimited,
      pocketbase: this.pocketbase,
      authorize: this.authorize
    }
  }

  private handleWaitingClients() {
    this.waiting = this.waiting.filter((client) => {
      client.durration = Date.now() - client.time;
      if (
        (this.clients.includes(client) && client.durration > this.timeout) ||
        (!client.isOnline && this.clients.includes(client))
      ) {
        this.should_log
          ? console.log(`Client: ${client.id} has been dropped`)
          : null;

        this.clients = this.clients.filter((i) => i.token !== client.token);
        this.droppedClients+=1

        return false;
      }
      return true;
    });

    this.should_log ? console.log("Dropped: ", this.droppedClients) : null;
    this.should_log  ? console.log("Qeued requests: " + this.waitingRequests.length) : null;
    this.should_log ? console.log("Requests: " + this.requests.length) : null;
  }

  private handleWaitingRequests() {
    this.waitingRequests.forEach((r) => {
      console.log(r);
      r.durration = Date.now() - r.time;
      if (
        r.durration > this.timeout ||
        (!this.clients.find((client) => client.token == r.token) &&
          r.status == "pending")
      ) {
        this.should_log
          ? console.log(`Request -> ${r.id}   has been dropped`)
          : null;
        this.waitingRequests = this.waitingRequests.filter((c) => c.id != r.id);
      } else if (
        this.requests.filter((request) => request.token === r.token).length <
          5 &&
        r.status == "pending"
      ) {
        console.log(r)
        this.requests.push(r);
        this.waitingRequests = this.waitingRequests.filter((c) => c.id != r.id);
        this.should_log
          ? console.log(`Request -> ${r.id}:  has been added to requests list`)
          : null;
      } else if (r.status == "completed") {
        this.should_log
          ? console.log(`Request ->  ${r.id}    has been completed`)
          : null;
        this.waitingRequests = this.waitingRequests.filter((c) => c.id != r.id);
        
       
      }
    });
  }

  private qeue() {
    if (this.waiting.length > 0 && this.clients.length < this.maxConnections) {
      console.log("Shifting waiting list to clients list");
      this.waiting.forEach((client, index) => {
        if (
          this.clients.length < this.maxConnections &&
          !this.clients.includes(client)
        ) {
          client.time = Date.now();
          client.status = "connected";
          client.durration = 0;
          this.clients.push(client);
          this.waiting.splice(index, 1);
          this.should_log
            ? console.log(
                `Client ${client.token} has been added to clients list`,
              )
            : null;
        }
      });
    }
  }

  private validateRequest(request: Request) {
    if (!request.token || !this.authorize(request.token).status) {
      console.log("Invalid token");
      return JSON.stringify({
        wsType: "request",
        status: false,
        message: "Invalid token",
      });
    }
    if (!request.body) {
      console.log("Request body is missing");
      return JSON.stringify({
        wsType: "request",
        status: false,
        message: "Request body is missing",
      });
    } else if (!request.body.collection) {
      console.log("Request body is missing collection");
      return JSON.stringify({
        wsType: "request",
        status: false,
        message: "Request body is missing collection",
      });
    } else if (
      (request.type == "getList" && !request.page) ||
      (request.type == "getList" && !request.count)
    ) {
      console.log("Request body is missing  page or count");
      return JSON.stringify({
        wsType: "request",
        status: false,
        message: "Request body is missing page or count",
      });
    }

    return JSON.stringify({
      wsType: "request",
      status: true,
      message: "Request is valid",
    });
  }

  private async fileRequest(request: Request) {
    let { token, body, id } = request;
    let { collection, type, page, count, expand, filter, sort } = body;
    switch (type) {
      case "getList":
        try {
          let data = await this.pocketbase
            .collection(collection)
            .getList(page, count, {
              expand: expand || [],
              filter: filter || ``,
              sort: sort || ``,
            });

          
          this.should_log
            ? console.log(request.id + " Has been completed")
            : null;
          
          let half_count = count / 2
          let half_items = data.items.slice(0, half_count)
          let other_half = data.items.slice(half_count, count)
          let response = {
            half: half_items,
            other_half: other_half
          }

          return JSON.stringify({
            wsType: "request",
            status: true,
            message: "Request completed",
            response: response,
          });


        } catch (error) {
          return JSON.stringify({
            wsType: "request",
            status: false,
            message: error,
          });
        }
        break;
      default:
        break;
    }
  }
  private async handleRequests(req) {
    let r;
    if (!this.pocketbase) {
      throw new Error("No pocketbase instance provided");
    }


 

    if(this.waitingRequests.find((c)=> c.client.token == req.token)
    ){
       this.waitingRequests.forEach((r)=>{
         
       })
    }
    

    return JSON.stringify({})

     
  }

  async request(data) {

    let client = this.clients.find((u)=> u.token == data.token)
   
    if(
    this.waitingRequests.filter((i)=> i.client.token == data.token).length >= 5
    && client?.isOnline && this.ratelimited.includes(client.id)
    ){
      console.log(`Client with id ${client.id} has been ratelimited`)
      this.ratelimited.push(client)
      return JSON.stringify({status:400, ratelimit:true})
    }

    if(!data.token || this.authorize(data.token).status == false){
      return JSON.stringify({status:400, type:"request",  message:"Invalid request" })
    }


    if(this.waitingRequests.filter((r)=> r.client.token == client?.token).length  < 5
    && client?.isOnline
    ){
      let id = crypto.randomUUID()
      this.waitingRequests.push({
        client: client,
        time: Date.now(),
        status: "pending",
        durration: 0,
        id: id,
        req: data,
      })

      this.should_log ? console.log(`Request with ${id} added to waiting list`) : null;
      return  await this.handleRequests(data)
    }else if(
    this.waitingRequests.filter((r)=> r.client.token == client?.token).length   >= 5 
    || !client?.isOnline
    ){
      return JSON.stringify({status:400, type:"request", message:"Wait until all other requests are done!"})
    }

    console.log(this.waitingRequests.length)

    
     
  }

  connect(clientToken: string) {
    if (!this.authorize(clientToken).status) {
      this.should_log
        ? console.log({
            client: clientToken,
            status: "Rejected",
            message: "Invalid token",
          })
        : null;
      return JSON.stringify({ status: "Rejected", message: "Invalid token" });
    }

    if (
      this.clients.length >= this.maxConnections &&
      !this.waiting.find((client) => client.token == clientToken)
    ) {
      console.log(`Client ${clientToken} has been added to waiting list`);
      this.waiting.push({
        token: clientToken,
        time: Date.now(),
        status: "waiting",
        durration: 0,
        isOnline: true,
        id: crypto.randomUUID(),
      });
      return false;
    }

    let waitingClient = this.waiting.find(
      (client) => client.token == clientToken,
    );
    if (
      waitingClient &&
      waitingClient.status == "waiting" &&
      waitingClient.time < Date.now()
    ) {connect
      return false;
    }

    if (this.clients.find((client) => client.token == clientToken)) {
      this.should_log
        ? console.log(`Client ${clientToken} is already connected`)
        : null;
      return JSON.stringify({
        status: true,
        message: "Client already connected",
        clientData: this.clients.find((client) => client.token == clientToken),
      });
    }


    let id = crypto.randomUUID()
    this.clients.push({
      token: clientToken,
      time: Date.now(),
      status: "connected",
      durration: 0,
      isOnline: true,
      id: id,
    });
    this.should_log
      ? console.log(`Client ${id} has been connected`)
      : null;
      
    return JSON.stringify({
      status: 200,
      type:"connect",
      message: "Client connected",
      clientData:  this.clients.find((client) => client.token == clientToken) ,
    });
  }

  ping(clientToken: string) {
 

    if(this.active_pings.filter((token) => token == clientToken).length > 5){
      return JSON.stringify({
        status: false,
        message: "Too many pings",
      });
    }else if (!this.authorize(clientToken).status) {
      this.clients = this.clients.filter((client) => client.token != clientToken);
      return JSON.stringify({
        status: false,
        message: "Invalid token or token expired",
      });
    }
    if(!clientToken){
      return JSON.stringify({
        status: false,
        message: "Missing client token",
      });
    }

    let client = this.clients.find((client) => client.token == clientToken);
    this.active_pings.push(clientToken);
    if (!client) {
      return JSON.stringify({
        status: false,
        message: "Client not found",
      });
    }

    client.time = Date.now();
    client.isOnline = true;
    client.durration = 0;
    client[client.findIndex((i) => i.token == clientToken)] = client;
    this.should_log
      ? console.log(`Client ${clientToken} has been pinged`)
      : null;
    
    this.active_pings = this.active_pings.filter((token) => token != clientToken);
       
    return JSON.stringify({ status: true, message: "Client pinged" });
  }
}

export default Hapta;
