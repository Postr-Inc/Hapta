import gateway from "./authorization/authorizer";

 
class Hapta{
    maxConnections:number;
    clients:Array<any>;
    waiting: Array<any>;
    maxRoomSize:number;
    rooms:Array<any>;
    droppedClients:Array<any>;
    authorize:any;
    should_log:boolean;
    timeout:number; 
 
   
    constructor(config:any = {}){
       
        this.clients  = [];
        this.waiting = [];
        this.rooms = [];
        this.maxRoomSize =  config.maxRoomSize ||  100
        this.maxConnections =  config.maxConnections || 1000
        this.droppedClients = []
        this.should_log = config.should_log || false
        this.timeout = config.timeout || 10000
       
        this.authorize = new gateway().authorize
        let info  = "\x1b[36m%s\x1b[0m"
        let warning = "\x1b[33m%s\x1b[0m"
        if(config == {}){
            
          console.log(warning, "Hapta is running with default config ", {
                maxRoomSize:this.maxRoomSize,
                maxConnections:this.maxConnections,
                should_log:this.should_log,
                timeout:this.timeout
           
          })  
        }else{
            this.should_log ? console.log(info, "Hapta using custom config", config) : null
        
        }
        setInterval(()=>{
            this.clients.forEach((client, index)=>{
                client.durration = Date.now() - client.time
                if(client.durration >  this.timeout
                || !client.isOnline    
                ){
                    this.should_log ? console.log(client.token, " has been disconnected") : null
                    this.clients.splice(index, 1)
                    this.waiting.push(client)
                    this.qeue()
                }
            })
            this.should_log ? console.log("Clients: ", this.clients.length) : null
            this.should_log ? console.log("Waiting: ", this.waiting.length) : null
        }, 1000)
    }


    connect(clientTOken:string){
         if(!this.authorize(clientTOken).status){
            this.should_log ? console.log({
                client:clientTOken,
                status:"Rejected",
                message:"Invalid token"
            }) : null
            return {status:"Rejected", message:"Invalid token"}
         }
         if(this.clients.length >= this.maxConnections
            && !this.waiting.find(client=>client.token == clientTOken)
            ){
             console.log("Client ", clientTOken, " has been added to waiting list")
             this.waiting.push({
                token:clientTOken,
                time:Date.now(),
                status:"waiting",
                durration:0,
                isOnline:true
             })
             return false;
         }
         if(this.waiting.find(client=>client.token == clientTOken)){
            let durration = Date.now() - this.waiting.find(client=>client.token == clientTOken).time
            this.should_log ? console.log("Still in waiting list... time: ",   durration) : null
            return false;
         }
        
         this.clients.push({
            token:clientTOken,
            time:Date.now(),
            status:"connected",
            durration:0,
            isOnline:true
         })
         this.should_log ? console.log("Client ", clientTOken, " has been connected") : null
         return {status:true, message:"Client connected", clientData:this.clients.find(client=>client.token == clientTOken)}
    }
    qeue(){
       
        if(this.waiting.length > 0 && this.clients.length < this.maxConnections){
            console.log("Shifting waiting list to clients list")
            this.waiting.forEach((client, index)=>{
                if(this.clients.length < this.maxConnections
                    && !this.clients.includes(client)
                ){
                    client.time = Date.now()
                    client.status = "connected"
                    client.durration = 0
                    this.clients.push(client)
                    this.waiting.splice(index, 1)
                    this.should_log ?  console.log("Client ", client.token, " has been added to clients list") : null
                }
            })
            
        }


    }

    

     

}
 
export default Hapta;

const hapta = new Hapta( )
hapta.connect("mykey")
hapta.connect("mykey2")