import gateway from "./auth";
 
interface Client {
  token: string;
  time: number;
  status: "connected" | "waiting";
  durration: number;
  isOnline: boolean;
}

interface Request {
  token: string;
  time: number;
  status: "pending";
  durration: number;
  isOnline: boolean;
}

class Hapta {
  private clients: Client[] = [];
  private waiting: Client[] = [];
  private maxRoomSize: number;
  private maxConnections: number;
  private droppedClients: Client[] = [];
  private waitingRequests: Request[] = [];
  private should_log: boolean;
  private timeout: number;
  private requests: Request[] = [];
  private pocketbase: any;
  private authorize: (token: string) => { status: boolean };
  
  constructor(config: any = {}) {
    this.maxRoomSize = config.maxRoomSize || 100;
    this.maxConnections = config.maxConnections || 1000;
    this.should_log = config.should_log || false;
    this.timeout = config.timeout || 10000;
    this.pocketbase = config.pocketbase || null;
    this.authorize = new gateway().authorize;

    if (Object.keys(config).length === 0) {
      console.log(
        "\x1b[33m%s\x1b[0m",
        "Hapta is running with default config ",
        {
          maxRoomSize: this.maxRoomSize,
          maxConnections: this.maxConnections,
          should_log: this.should_log,
          timeout: this.timeout,
        }
      );
    } else {
      this.should_log
        ? console.log(
            "\x1b[36m%s\x1b[0m",
            "Hapta using custom config",
            config
          )
        : null;
    }

    setInterval(() => {
      this.handleClientDisconnections();
      this.handleWaitingClients();
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

    this.should_log
      ? console.log("Clients: ", this.clients.length)
      : null;
  }

  private handleWaitingClients() {
    this.waiting = this.waiting.filter((client) => {
      client.durration = Date.now() - client.time;
      if (client.durration > this.timeout || !client.isOnline) {
        this.should_log
          ? console.log(`${client.token} has been dropped`)
          : null;
        this.droppedClients.push(client);
        return false;
      }
      return true;
    });

    this.should_log
      ? console.log("Dropped: ", this.droppedClients.length)
      : null;

    this.waitingRequests.forEach((client) => {
      // Handle waiting requests here.
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
            ? console.log(`Client ${client.token} has been added to clients list`)
            : null;
        }
      });
    }
  }

  handleRequests(data: any) {
    if (!this.pocketbase) {
      throw new Error("No pocketbase instance provided");
    }
    const { type, body } = data;
    // Handle requests here.
  }

  request(data: any) {
    if (this.requests.filter((request) => request.token == data.token).length >= 5) {
      this.waitingRequests.push({
        token: data.token,
        time: Date.now(),
        status: "pending",
        durration: 0,
        isOnline: true,
        type: data.type,
        body: data.body,
      });
      this.should_log
        ? console.log(`Request from ${data.token} has been added to waiting requests list`)
        : null;
      return JSON.stringify({
        status: true,
        message: "This request has been added to wait list",
        clientData: this.waitingRequests.find((client) => client.token == data.token),
      });
    }

    this.requests.push({
      token: data.token,
      time: Date.now(),
      status: "pending",
      durration: 0,
      isOnline: true,
    });
    this.should_log
      ? console.log(`Request from ${data.token} has been added to requests list`)
      : null;
    return JSON.stringify({
      status: true,
      message: "Request added to list",
      clientData: this.requests.find((client) => client.token == data.token),
    });
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
      return { status: "Rejected", message: "Invalid token" };
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
      });
      return false;
    }

    if (this.waiting.find((client) => client.token == clientToken)) {
      const duration = Date.now() - this.waiting.find((client) => client.token == clientToken).time;
      this.should_log
        ? console.log(`Still in waiting list... time: ${duration}`)
        : null;
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

    this.clients.push({
      token: clientToken,
      time: Date.now(),
      status: "connected",
      durration: 0,
      isOnline: true,
    });
    this.should_log
      ? console.log(`Client ${clientToken} has been connected`)
      : null;
    return JSON.stringify({
      status: true,
      message: "Client connected",
      clientData: this.clients.find((client) => client.token == clientToken),
    });
  }
}

export default Hapta;

 