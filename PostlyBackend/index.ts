//@ts-nocheck
import fs from 'fs';
import path from 'path'
import Bun from 'bun'
import Health from './HealthStatus';
import { type Serve} from "bun";
import pocketbase from 'pocketbase'
import TokenManager from './TokenManager';
import Headers from './Headers';
import { DataTypes } from 'sequelize';
import Cache from './cache';
import RateLimiter from './RateLimiter';
const { Sequelize } = require('sequelize');
export const sequelize = new Sequelize('postgres://postgres:asapy67890*@localhost:5432/postly', {
    logging: false
})  



export const User = sequelize.define(
    'User',
    {
      // Model attributes are defined here
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password:{
        type: DataTypes.STRING,
        allowNull: false,
      },

      avatar_path:{
        type: DataTypes.STRING
      },
      banner_path:{
        type: DataTypes.STRING
      },
      dob:{
        type: DataTypes.DATE
      },
      tier: {
        type: DataTypes.STRING
      },
      verified:{
        type: DataTypes.BOOLEAN
      },
      createdAt: {
        type:DataTypes.DATE,
        allowNull: false,
      }
      
    },
    {
      // Other model options go here
    },
);
 

export const Post = sequelize.define('Post', {
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  content: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, { 
  tableName: 'posts',  
  timestamps: true, 
}); 



declare global { 
    interface Request {
      ipAddress?: string; // Or your desired type
      // Add other custom properties here
    } 
}

const associations = [
  { source: User, target: Post, type: 'hasMany', options: { foreignKey: 'authorId' } },
  { source: Post, target: User, type: 'belongsTo', options: { foreignKey: 'authorId' } },
];

associations.forEach(({ source, target, type, options }) => {
  source[type](target, options);
});
 


(()=>{
  sequelize.sync()
})
 
sequelize
  .authenticate()
  .then(() => {
    console.log('Connection has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });


if(!fs.existsSync(process.cwd() + '/config.toml')) {
    console.error('Ensure that you have a config.toml file in the root of your project');
    process.exit(1);
}
export const config = require(process.cwd() + '/config.toml');


let routes = new Bun.FileSystemRouter({
    dir: path.join(process.cwd(), '/routes'),
    style: 'nextjs'
})

if(!fs.existsSync(path.join(process.cwd(), "/logs/health"))){
    fs.mkdirSync(path.join(process.cwd(), "/logs"))
    fs.mkdirSync(path.join(process.cwd(), "/logs/health"))
}
if(!fs.existsSync(path.join(process.cwd(), "/logs/health/healthstatus.json"))){  
    Bun.write(path.join(process.cwd(), "/logs/health/healthstatus.json"), "{\"logs\":[]}")
}


const h = new Health({outputFile:'./logs/health/healthstatus.json', CheckInterval: 6000})
const t = new TokenManager()
const r = new RateLimiter()
const c = new Cache({type:'FIFO'})
 
export default { 
    async fetch(req) {
        const startTime = performance.now(); // Record the start time

        try {
            const url = new URL(req.url);
            var route = routes.match(url.pathname);
            if (!route) {
                h.error('404 Page not found')
                return new Response("404 Page not found", {
                    status: 400,
                });
            }
            var method = await import(route?.filePath).then((j) => j);
 
            const keys = Object.keys(method)

            if(req.method.toLowerCase() == "options"){
              return  new Response("Continue", {
                  status: 200, 
                  headers:{
                      ...Headers.Cors,
                      "Access-Control-Allow-Headers": "body"
                  }
              });
          }


            if(keys.length  > 1){
              for await(var i  of keys){
                if(req.method == i){
                  console.log(i)
                  method = method[i]
                }
              }
            }else{
              method = method.default;

              if (req.method != method.name) {
                h.error('Invalid method expected');
                return new Response("Invalid method expected " + method.name + " instead of " + req.method, {
                    status: 400,
                });
              }
            }
            
             
            

            // Process the request
            req.ipAddress = this.requestIP(req)
            const response = await method(req, h, t, r, c);
            
            const endTime = performance.now(); 
            const elapsedTime = endTime - startTime;  
 
            if (elapsedTime > 1000) {  
                h.slowRequest();  
                console.log(`Slow request detected: ${elapsedTime.toFixed(2)} ms`);
            }

            return response;

        } catch (error) {
            console.log(error)
            h.systemError(error.message)
            return new Response("Server Error Occurred", {
                status: 500,
                statusText: "Server Error Occurred",
            });
        }
    },
} satisfies Serve;
