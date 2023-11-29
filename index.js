import Pocketbase from 'pocketbase';
import WebSocket, { WebSocketServer } from 'ws';
import eventsource from 'eventsource';
import './router.js';
import dotenv from 'dotenv';
import { Requests } from './controllers/Requests.js';
dotenv.config();
global.EventSource = eventsource;
global.shouldLog = false
import { program} from 'commander'
import fs from 'fs'
import path from 'path';
let config =   null
class Hapta {
  constructor(data = {shouldLog: false, Init: {email: "", password: "", DbUrl: ""}, Port: 8080, RateLimits: {}}) {
    const {Init, Port } = data;
    if (!Init || !Port) {
      throw new Error('Provide all required fields');
    }

    this.pb = new Pocketbase(Init.DbUrl).admins.client.autoCancellation(false)
    this.port = Port;
    try{
      this.wss = new WebSocketServer({ port: this.port });
    }
    catch(err){
      if(err.code === 'EADDRINUSE'){
        throw new Error('Port is already in use')
      }

      throw new Error(`Could not start server: ${err.message}`)
    }
    this.auth = Init;
    this.rateLimitsList = new Map();
    this.rules =  []
    this.shouldLog =   data.shouldLog || false;
    global.pb = this.pb
    global.shouldLog = this.shouldLog;
  }

  async start() {
    let email = process.env.EMAIL || this.auth.email || config.email
    let password = process.env.PASSWORD || this.auth.password || config.password
    try {
      await this.pb.admins.authWithPassword(email, password)
    } catch (error) {
      throw new Error(`Could not authenticate with Pocketbase: ${error.message}`)
    }
    for (let key in config.RateLimits) {
      this.addRateLimit(key, config.RateLimits[key].RequestLimit, config.RateLimits[key].Duration);
    }

    for(let key in config.Rules){
      this.restrictAccessTo(key, config.Rules[key])
    }
    new Requests(this.wss, this.pb, this.rateLimitsList, this.auth, this.rules);
      
  }

  addRateLimit(CrudMethod, RequestLimit, Duration) {
    global.shouldLog ? console.log(`\n🛠️  Added rate limit for ${CrudMethod} with ${RequestLimit} requests per ${Duration}ms ${Duration < 60000 ? `🚀` : `🐢`}
    `) : null;
    this.rateLimitsList.set(CrudMethod, { RequestLimit:RequestLimit, Duration: Duration });
  }

 
  restrictAccessTo(key,  rule){
    this.rules.push({key, rule})
  }
  
  
}
 
 
 
program
  .option('-p, --port <number>', 'Port to run server on')
  .option('-d, --dbUrl <string>', 'Database url')
  .option('-l, --log', 'Log requests')
  .option('-r, --rateLimits <string>', 'Rate limits')
  .option('-c, --config <string>', 'Config file')
  .parse(process.argv);

 

if(program.rateLimits){
 console.log(program.rateLimits)
}


const options = program.opts();
let required = ['port', 'dbUrl', 'config']
let missing = []
required.forEach((r)=>{
  if(!options[r]){
    missing.push(r)
  }
})

if(missing.length > 0){
  throw new Error(`Missing required options: ${missing.join(', ')}`)
}

if(options.config){
  try{
    config = JSON.parse(fs.readFileSync(path.join(process.cwd(), options.config)))
  }
  catch(err){
    throw new Error(`Could not read config file: ${err.message}`)
  }
}

if(options.log){
  global.shouldLog = true
}

 

let e = new Hapta({shouldLog: options.log, Init: {email: process.env.EMAIL, password: process.env.PASSWORD, DbUrl: options.dbUrl}, Port: options.port, RateLimits: config.RateLimits})
e.start()
 
global.shouldLog ? console.log(`
 
     __  __            __       
    / / / /___ _____  / /_____ _
   / /_/ / __ / __ \/ __/ __ / /
  / __  / /_/ / /_/ / /_/ /_/ / 
 /_/ /_/\__,_/ .___/\__/\__,_/  
              
        
Version: 1.0.0

Gateway is running on port ${options.port}
`)
: null


 
 
 