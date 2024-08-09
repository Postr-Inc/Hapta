import { decode } from "hono/jwt";
import { c, cache, pb } from "../../src";
import CacheController from "../CacheManager"; 
import { ErrorCodes, ErrorMessages } from "../../Enums/Errors";
import { Tasks } from "../Concurrency/Enums/Tasks";
import { HttpCodes } from "../../Enums/HttpCodes";
import Validate from "./Helpers/Validate";
import Pocketbase from "pocketbase"
const subscriptions = new Map<string, any>();
const updateQueue = new Map<string, any[]>();
const deleteQueue = new Map<string, any[]>();
const createQueue = new Map<string, any[]>();
const lastUpdated = new Map<string, number>();

type QueueMethod = "create" | "delete" | "update";

function appendToQueue(data: any, cancelPrevious = true, method: QueueMethod) {
  const queueMap = method === "create" ? createQueue : method === "delete" ? deleteQueue : updateQueue;

  if (cancelPrevious) {
    queueMap.set(data.id, [data.fields]);
  } else { 
    const queue = queueMap.get(data.id) || [];
    queue.push(data.fields || data)
    queueMap.set(data.id, queue);
  }

  lastUpdated.set(data.id, Date.now());
}

function removeFromQueue(data: any) {
  const queue = updateQueue.get(data.id);
  if (queue) {
    const index = queue.findIndex((d: any) => d.key === data.key);
    if (index > -1) {
      queue.splice(index, 1);
    }
  }
}

async function rollQueue(id: string, pb: Pocketbase): Promise<void> {
  const now = Date.now();
  const lastTime = lastUpdated.get(id) || 0;

  if (now - lastTime < 1000) {
    console.log(`Skipping rollQueue for ${id} due to recent update`);
    return;
  }

  try {  
    await processQueue(createQueue, id, pb, "create");
    await processQueue(updateQueue, id, pb, "update");
    await processQueue(deleteQueue, id, pb, "delete");
    lastUpdated.delete(id);
  } catch (error) {
    console.error(`Failed to process queue for ${id}`, error);
    throw error;
  }
}

async function processQueue(queueMap: Map<string, any[]>, id: string, pb: Pocketbase, method: QueueMethod) {
  if (!queueMap.has(id)) return;

  const queue = queueMap.get(id);  
  if (!queue) return;

  for (const data of queue) {
    if(!data) return; 
    try {
      switch (method) {
        case 'create':
          await pb.admins.client.collection(data.collection).create(data.record, {
            ...(data.expand && { expand: joinExpand(data.expand, data.collection, "create") }),
          });
          break;
        case 'update':
          await pb.admins.client.collection(data.collection).update(data.id, data.data);
          break;
        case 'delete':
          await pb.admins.client.collection(data.collection).delete(data.id);
          break;
      }
    } catch (error) {
      console.error(`Failed to ${method} record for ${id}`, error);
      throw error;
    }
  }

  queueMap.delete(id);
}

setInterval(() => {
  //@ts-ignore
  let allKeys = [...createQueue.keys(), ...updateQueue.keys(), ...deleteQueue.keys()];
  for (const key of allKeys) {
    console.log(`Rolling queue for ${key}`);
    rollQueue(key, pb);
  }
}, 30000); // 30 seconds

function joinExpand(expand: Array<string>, collection: string, method: string) {
    return expand
      .map((e, index) => {
        if (index === expand.length - 1) {
          if (
            collection === "users" &&
            method === "list" &&
            e === "developer_account"
          ) {
            return "";
          }
          return e;
        }
        return e + ",";
      })
      .join("");
}

function handleFiles(data: any) {
  let files: any = [];
  if (Array.isArray(data)) {
    data.forEach((file: any) => {
      if (!file.data) return false;
      const array = new Uint8Array(file.data);
      const blob = new Blob([array]);
      let name =
        Math.random().toString(36).substring(7) + Date.now().toString(36);
      let f = new File([blob], file.name || name, {
        type: file.type || "image/png",
      });
      files.push(f);
    }); 
    return files;
  } else {
    const array = new Uint8Array(data.data);
    const blob = new Blob([array]);
    let name =
      Math.random().toString(36).substring(7) + Date.now().toString(36);
    let f = new File([blob], data.name || name, {
      type: data.type || "image/png",
    });

    return f;
  }
}

export default class CrudManager {
    cache: CacheController;
    constructor(){
       this.cache =  cache;
    }

    public async create(payload: any, token: string){
       let hasIssue = await Validate(payload, "create", token, this.cache)
       if(hasIssue) return hasIssue;
       try {
         let res = {}
         if(payload.data.hasOwnProperty('files') && Array.isArray(payload.data.files)){ 
            payload.data.files = handleFiles(payload.data.files);
         } 
        res = await pb.collection(payload.collection).create(payload.data, {
            ...(payload.hasOwnProperty('expand') && { expand: joinExpand(payload.expand, payload.collection, "create") }),
        }); 
        return { _payload: res, opCode: HttpCodes.OK}
       }catch(error){
        console.log("Error creating record", error)
          return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR, message: ErrorMessages[ErrorCodes.SYSTEM_ERROR]}
       }
    }

    public async list(payload: {
        collection: string,
        page: number,
        limit: number,
        cacheKey?: string,
        options?: { order?: "asc" | "dec", sort?: string, expand?: string[], filter: string, recommended?: boolean }, 
    }, token: string){

         
        let cacheKey = payload.cacheKey || `${payload.collection}_list_${JSON.stringify(payload.options)}_${payload.page}_${payload.limit}_${decode(token).payload.id}`
        let cacheData = this.cache.get(cacheKey);
        if(cacheData) {  
            return {opCode: HttpCodes.OK, ...cacheData}
        }

        let hasIssue = await Validate(payload, "list")
        if(hasIssue) return hasIssue;
  
        try {
            let data = await pb.collection(payload.collection).getList(payload.page, payload.options?.recommended ? Number.MAX_SAFE_INTEGER : payload.limit, {
                sort: payload.options?.order === "asc" ? "created" : "-created",
                filter: payload.options?.filter,
                expand: joinExpand(payload.options?.expand || [], payload.collection, "list"),
                cache: "force-cache"
            });  
            // remove emails from the data :}
            let  processed = await c.run(Tasks.FILTER_THROUGH_LIST,  {list: data.items, collection: payload.collection})   
            this.cache.set(cacheKey,  {_payload: processed, totalItems: data.totalItems, totalPages: data.totalPages},  new Date().getTime() + 3600); 
            return { _payload: processed, totalItems: data.totalItems, totalPages: data.totalPages, opCode: HttpCodes.OK}
        } catch (error) { 
            return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR}
            
        }

    }
    
    public async get(payload: {collection: string, id: string, options:{[key: string] : any}}, token: string){
      let hasIssue = await Validate(payload, "get", token, this.cache)
      if(hasIssue) return hasIssue;
      try {
        let cacheKey = `${payload.collection}_${payload.id}_get_${JSON.stringify(payload.options)}_${decode(token).payload.id}`
        let cacheData = this.cache.get(cacheKey);
        if(cacheData) {  
            return {opCode: HttpCodes.OK, ...cacheData}
        }

        let data = await pb.collection(payload.collection).getOne(payload.id, {
            ...(payload.options.expand && { expand: joinExpand(payload.options.expand, payload.collection, "get") }),
            cache: "force-cache"
        }); 
        let processed = await c.run(Tasks.FILTER_THROUGH_LIST,  {list: [data], collection: payload.collection})  
        this.cache.set(cacheKey,  {_payload: processed[0]},  new Date().getTime() + 3600); 
        return { _payload: processed[0], opCode: HttpCodes.OK}
      } catch (error) { 
        return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR}
      }
    }
    public async delete(payload: {collection: string, id: string, callback: any}, token: string){
      let decoded = decode(token).payload;
      let hasIssue = await Validate(payload, "delete", token, this.cache)
      if(hasIssue) return hasIssue;
      try {
        let keys = this.cache.keys()
        for(let key of keys){
           let cacheData = this.cache.get(key); 
           if(Array.isArray(cacheData._payload)){
              let exists = cacheData._payload.find((item: any) => item.id ===  payload.id)
              if(exists){
                 cacheData._payload = cacheData._payload.filter((item: any) => item.id !==  payload.id)
                 this.cache.set(key, cacheData, new Date().getTime() + 3600) 
              }
           }
        }
        appendToQueue({collection: payload.collection, id: payload.id}, false, "delete")
        return { _payload: null, opCode: HttpCodes.OK}
      } catch (error) {
        console.log("Error deleting record", error)
        return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR}
      }
    }  

    public async update(payload: {collection: string, id: string, fields: any, expand: any[], callback: any}, token: string){
      let hasIssue = await Validate(payload, "update", token, this.cache) 
      if(hasIssue) return hasIssue; 

      try { 
        let keys = this.cache.keys()
        for(let key of keys){
           let cacheData = this.cache.get(key); 
           if(Array.isArray(cacheData._payload)){
              let exists = cacheData._payload.find((item: any) => item.id ===  payload.id)
              if(exists){
                 let updated = {...exists, ...payload.fields}
                 cacheData._payload = cacheData._payload.map((item: any) => item.id ===  payload.id ? updated : item)
                 this.cache.set(key, cacheData, new Date().getTime() + 3600) 
              }
           }
        }
        appendToQueue({collection: payload.collection, id: payload.id, data: payload.fields}, false, "update")
       
        return { _payload: payload.fields, opCode: HttpCodes.OK}
      } catch (error) {
        console.log("Error updating record", error)
        return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR}
      }
    }
}