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
    type: string;
    body: any;
    expand?: string[];
    from?: number;
    to?: number;
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
            client.durration = Date.now() - client.time;
            if (client.durration > this.timeout || !client.isOnline) {
                this.should_log
                    ? console.log(`${client.token}  request has been dropped`)
                    : null;
                this.waitingRequests = this.waitingRequests.filter((c) => c.token != client.token)

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
                        ? console.log(`Client ${client.token} has been added to clients list`)
                        : null;
                }
            });
        }
    }

    handleRequests() {
        if (!this.pocketbase) {
            throw new Error("No pocketbase instance provided");
        }
        this.requests.forEach((request, index) => {
            if (!request.body) {
                console.log("Request body is missing")
                return JSON.stringify({ wsType: 'request', status: false, message: "Request body is missing" });
            }
        });
    }

    request(data) {
        if (
            this.requests.filter((request) => request.token === data.token).length >= 5 &&
            !this.waitingRequests.find((client) => client.token === data.token)
        ) {
            this.waitingRequests.push({
                token: data.token,
                time: Date.now(),
                status: "pending",
                durration: 0,
                isOnline: true,
                type: data.type,
                body: data.body,
            });
            if (this.should_log) {
                console.log(`Request from ${data.token} has been added to waiting requests list`);
            }
            return JSON.stringify({ wsType: 'request', status: false, message: "Request added to waiting list" });
        } else {

            if (this.should_log) {
                console.log(`Request from ${data.token} has been added to requests list`);
            }
            this.requests.push({
                token: data.token,
                time: Date.now(),
                status: "pending",
                durration: 0,
                isOnline: true,
                type: data.type,
                body: data.body,
                expand: data.expand || [],
                from: data.from || 0,
                to: data.to || 10,
            })
            this.handleRequests();
            return JSON.stringify({ wsType: 'request', status: true, message: "Request added to queue" });
        }
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

        let waitingClient = this.waiting.find((client) => client.token == clientToken);
        if (waitingClient && waitingClient.status == "waiting" && waitingClient.time < Date.now()) {
            let duration = Date.now() - waitingClient.time;
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

