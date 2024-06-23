//@ts-nocheck
import { pb } from "../../server";
import { TokenManager } from "../utils/jwt/JWT";
import EventEmitter from "events";
import CacheController from "./CacheController";
import { ErrorCodes, ErrorHandler } from "./ErrorHandler";
import Pocketbase from "pocketbase";
import { file } from "bun";
import { Session } from "inspector";
import { col } from "sequelize";
let config = await import(process.cwd() + "/config.ts").then(
  (res) => res.default
);

const updateQueue = new Map<string, any[]>();
const lastUpdated = new Map<string, number>();

function appendToQueue(data: any, cancelPrevious = true) {
  if (cancelPrevious && updateQueue.has(data.id)) {
    // If cancelPrevious is true, replace existing updates for the same ID
    updateQueue.set(data.id, [data]);
  } else {
    if (updateQueue.has(data.id)) {
      updateQueue.get(data.id)?.push(data);
    } else {
      console.log("Queue appended");
      updateQueue.set(data.id, [data]);
    }
  }
  // Update the last updated timestamp
  lastUpdated.set(data.id, Date.now());
}

function removeFromQueue(data: any) {
  if (updateQueue.has(data.id)) {
    const queue = updateQueue.get(data.id);
    if (queue) {
      const index = queue.findIndex((d: any) => d.key === data.key);
      if (index > -1) {
        queue.splice(index, 1);
      }
    }
  }
}

let count = 0;

async function rollQueue(id: string, pb: Pocketbase) {
  if (updateQueue.has(id)) {
    const queue = updateQueue.get(id);
    if (queue) {
      const lastTime = lastUpdated.get(id) || 0;
      if (Date.now() - lastTime < 1000) {
        console.log(`Skipping rollQueue for ${id} due to recent update`);
        return;
      }

      count++;
      for (const d of queue) {
        await pb.admins.client.collection(d.collection).update(d.id, d.data);
        console.log(`Queue rolled ${count} times`);
      }
      updateQueue.delete(id);
    }
  }
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

function joinExpand(expand: Array<string>) {
  return expand
    .map((e, index) => {
      if (index === expand.length - 1) {
        return e;
      }
      return e + ",";
    })
    .join("");
}

function handle(item: any, returnable: Array<string>) {
  let newRecord = {};
  function recursiveObject(item: any) {
    switch (true) {
      case item.emailVisibility === false && item.email && item.email !== null:
        delete item.email;
        break;
      case item.expand && item.expand !== null:
        Object.keys(item.expand).forEach((key) => {
          recursiveObject(item.expand[key]);
        });
        break;
      case Array.isArray(item):
        item.forEach((d) => {
          recursiveObject(d);
        });
        break;
      default:
        break;
    }
  }

  if (item.expand && item.expand !== null) {
    Object.keys(item.expand).forEach((key) => {
      recursiveObject(item.expand[key]);
    });
  }

  if (item.emailVisibility === false && item.email && item.email !== null) {
    delete item.email;
  } else if (
    item.emailVisibility === true &&
    item.email &&
    item.email !== null
  ) {
    newRecord["email"] = item.email;
  }

  Object.keys(item).forEach((key) => {
    if (returnable && returnable.includes(key)) {
      newRecord[key] = item[key];
    }
    newRecord[key] = item[key];
  });

  return newRecord;
}

function cannotUpdate(data: any, isSameUser: boolean) {
  const cannotUpdate = [
    "validVerified",
    "postr_plus",
    "followers",
    "postr_subscriber_since",
  ];
  const others = [
    "username",
    "email",
    "verified",
    "validVerified",
    "postr_plus", 
    "followers",
    "bio",
    "postr_subscriber_since",
  ];

  if (new TokenManager().decodeToken(data.token).id == data.id) {
    for (const key in data.record) {
      if (cannotUpdate.includes(key)) {
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.OWNERSHIP_REQUIRED,
          }),
          key: data.key,
          session: data.session,
        };
      }
    }
  } else {
    for (const key in data.record) {
      if (!others.includes(key)) {
        return {
          ...new ErrorHandler(data).handle({
            code: ErrorCodes.OWNERSHIP_REQUIRED,
          }),
          key: data.key,
          session: data.session,
        };
      }
    }
  }
  return false;
}
export default class CrudManager {
  pb: Pocketbase;
  Config: any;
  tokenManager: TokenManager;
  evt: EventEmitter;
  subscriptions: Map<string, any>; 
  constructor(pb: any, Config: any, tokenManager: TokenManager) {
    this.pb = pb;
    this.Config = Config;
    this.tokenManager = tokenManager;
    this.subscriptions = new Map();
    this.evt = new EventEmitter();
    this.Cache = new CacheController();
    this.worker = config.rules
      ? new Worker(new URL(process.cwd() + config.rules, import.meta.url))
      : null;
    // Run rollQueue every 5 minutes
    setInterval(() => {
      if (updateQueue.size > 0) {
        for (const key of updateQueue.keys()) {
          rollQueue(key, this.pb);
        }
        console.log("Queue rolled");
      } else {
        count = 0;
      }
    }, 300000);
  }

  public async create(data: {
    key: string;
    expand: Array<string>;
    record: {
      [key: string]: any;
    };
    collection: string;
    token: string;
    id: string;
    session: string;
  }) {
    switch (true) {
      case !data.key ||
        !data.collection ||
        !data.token ||
        !data.id ||
        !data.session ||
        !data.record:
        return {
          error: true,
          message:
            "key, collection, token, id, session, and record are required",
        };
      case !(await this.tokenManager.isValid(data.token, true)) ||
        this.tokenManager.decodeToken(data.token).id !== data.id:
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.INVALID_TOKEN }),
          key: data.key,
          session: data.session,
          isValid: false,
        };
      default:
        try {
          let d = await this.pb.admins.client
            .collection(data.collection)
            .create(data.record, {
              ...(data.expand && { expand: joinExpand(data.expand) }),
            });
          return {
            error: false,
            message: "success",
            key: data.key,
            data: d,
            session: data.session,
          };
        } catch (error) {
          console.log(error);
          return {
            ...new ErrorHandler(error).handle({
              code: ErrorCodes.AUTHORIZATION_FAILED,
            }),
            key: data.key,
            session: data.session,
          };
        }
    }
  }
  public async read(data: {
    type?: string;
    key?: string;
    collection?: string;
    token?: string;
    id?: string;
    expand?: Array<string>;
    session?: string;
    cacheKey?: string;
    isAdmin?: boolean;
  }) {
    switch (true) {
      case (!data.collection && !data.isAdmin) ||
        (!data.token && !data.isAdmin) ||
        (!data.id && !data.isAdmin) ||
        (!data.session && !data.isAdmin):
        return {
          error: true,
          message: "collection, token, id, session, and cacheKey are required",
          key: data.key,
          session: data.session,
          isValid: false,
        };
      case (!data.token == process.env.HAPTA_ADMIN_KEY &&
        !(await this.tokenManager.isValid(data.token, true))) ||
        (!data.token == process.env.HAPTA_ADMIN_KEY &&
          this.tokenManager.decodeToken(data.token).id !== data.id): // bypass token check
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.INVALID_TOKEN }),
          key: data.key,
          session: data.session,
          isValid: false,
        };
      default:
        let existsinCache = this.Cache.exists(data.cacheKey);
        if (existsinCache) {
          let d = this.Cache.get(data.cacheKey);
          if (d) {
            return {
              error: false,
              message: "success",
              key: data.key,
              data:  d,
              session: data.session,
            };
          }
        }
        let d = handle(
          await this.pb.admins.client
            .collection(data.collection)
            .getOne(data.id, {
              ...(data.expand && { expand: joinExpand(data.expand) }),
            }),
          data.returnable
        ); 
        if(!this.Cache.exists(data.cacheKey)){
          this.Cache.set(data.cacheKey, d,  new Date().getTime() + 3600)
        }
        return {
          error: false,
          message: "success",
          key: data.key,
          data: d,
          session: data.session,
        };
    }
  }
  public async update(data: {
    key: string;
    data: { [key: string]: any };
    expand: Array<string>;
    collection: string;
    sort: string;
    skipDataUpdate: boolean;
    immediatelyUpdate: boolean;
    invalidateCache: string,
    filter: string;
    token: string;
    id: string;
    session: string; 
    cacheKey: string;
  }) {
    let { key, token, session, id, cacheKey, collection } = data;

    // Check for required parameters
    if (!key || !token || !session || !data.data || !collection || !id) {
      console.log("Missing required parameters:", data);
      return {
        error: true,
        message:
          "key, collection, token, id, session, returnable, sort, filter, limit, offset, expand, and cacheKey are required",
      };
    }

    // Validate token
    if (!(await this.tokenManager.isValid(token, true))) {
      return {
        ...new ErrorHandler(data).handle({ code: ErrorCodes.INVALID_TOKEN }),
        key: key,
        session: session,
        isValid: false,
      };
    }

    try {
      // Check if the update is allowed
      if (cannotUpdate(data, true)) {
        console.log("Cannot update data:", data);
        return cannotUpdate(data, true);
      }
 
      for (let i in data.data) {
        if (data.data[i].isFile && data.data[i].file) {
          let files = handleFiles(data.data[i].file);
          if (files) {
            data.data[i] = files;
          } else {
            return {
              ...new ErrorHandler(data).handle({
                code: ErrorCodes.UPDATE_FAILED,
              }),
              key: data.key,
              session: data.session,
              message: "Invalid file type or size",
              type: "update",
            };
          }
        }
      }

      let existsinCache = this.Cache.exists(cacheKey);
      let final = null
      if (existsinCache && !data.invalidateCache) {
        let keys = this.Cache.getKeys();
        for (const key of  keys) { 
          const cachedData = this.Cache.get(key); 
          if (cachedData && cachedData.collectionName === collection && cachedData.items) {
            const itemId = cachedData.items.findIndex(
              (item: { id: string }) => item.id === id
            );   
            if (itemId > -1 && cachedData.collectionName === collection) { 
              cachedData.items[itemId] = {
                ...cachedData.items[itemId],
                ...data.data, 
              } 
            }
            final = cachedData
          }else if(cachedData && cachedData.collectionName === collection && !cachedData.items && !data.invalidateCache){
            if(collection === "users"){
               let keys = this.Cache.getKeys();
                for (const key of keys) {
                  const cachedData = this.Cache.get(key); 
                  if (cachedData && cachedData.collectionName === "posts" && cachedData.items) {
                    let dupdated = cachedData.items.map((item: any) => {
                      if (item.author === id) {
                        item.expand.author = {
                          ...item.expand.author,
                          ...data.data,
                        };
                      }
                      return item;
                    });
                    cachedData.items = dupdated; 
                    console.log("Updating cache" + key)
                    this.Cache.set(key, cachedData, new Date().getTime() + 3600)
                  }
                }
            }
            final = {
              ...cachedData,
              ...data.data
            }  
          }
        }
      }

      if (data.invalidateCache) {
        let keys = this.Cache.getKeys();
        let invalidateParts = data.invalidateCache.split("-");
      
        for (const key of keys) {
          let keyParts = key.split("-");
          let matches = true;
      
          // Ensure all parts of the invalidateCache string are in the key and in order
          for (const part of invalidateParts) {
            if (!keyParts.includes(part)) {
              matches = false;
              break;
            }
          }
      
          // Additionally, ensure the length and structure match
          if (matches && keyParts.length >= invalidateParts.length) {
            // Invalidate the cache key
            this.Cache.delete(key);
            console.log(`Cache key invalidated: ${key}`);
          } else {
            console.log(`Key: ${key} does not match invalidate criteria`);
          }
        }
      }
      

      if(final){
        console.log("Updating cache" + cacheKey)
        this.Cache.set(cacheKey, final, new Date().getTime() + 3600) // 
      }
      if(!data.skipDataUpdate && !data.immediatelyUpdate){
        appendToQueue(data);
      }
      else if(data.immediatelyUpdate){
        await this.pb.admins.client.collection(collection).update(id, data.data);
      }else{
        console.log("Skipping data update")
      }
 
      return {
        error: false,
        message: "success",
        key: key, 
        data: final,
        session: session,
      };
    } catch (error) {
      console.log(error);
      return {
        ...new ErrorHandler(error).handle({
          code: ErrorCodes.AUTHORIZATION_FAILED,
        }),
        key: key,
        session: session,
      };
    }
  }

  public async delete(data: {}) {}
  public async get(data: {
    key: string;
    token: string;
    data: {
      returnable: Array<string>;
      collection: string;
      sort: string;
      filter: string;
      refresh: boolean;
      refreshEvery: number;
      limit: number;
      offset: number;
      id: string;
      expand: Array<string>;
      cacheKey: string;
    };
    session: string;
  }) {
    let { key, token, session } = data;
    let {
      returnable,
      collection,
      sort,
      filter,
      limit,
      offset,
      id,
      expand,
      cacheKey,
    } = data.data;
    switch (true) {
      case !key ||
        !collection ||
        !token ||
        !id ||
        !session ||
        !data.data.hasOwnProperty("limit") ||
        !data.data.hasOwnProperty("offset"):
        console.log(
          "Missing field " +
            (!key
              ? " key"
              : !collection
              ? " collection"
              : !token
              ? " token"
              : !id
              ? " id"
              : !session
              ? " session"
              : !limit
              ? " limit"
              : !offset
              ? " offset"
              : " returnable, sort, filter, limit, offset, expand, and cacheKey")
        );
        return {
          error: true,
          message: !key
            ? "key is required"
            : !collection
            ? "collection is required"
            : !token
            ? "token is required"
            : !id
            ? "id is required"
            : !session
            ? "session is required"
            : !limit
            ? "limit is required"
            : !offset
            ? "offset is required"
            : "returnable, sort, filter, limit, offset, expand, and cacheKey are required",
        };
      case (!(await this.tokenManager.isValid(token, true)) &&
        !token == process.env.HAPTA_ADMIN_KEY) ||
        (this.tokenManager.decodeToken(token).id !== id &&
          !token == process.env.HAPTA_ADMIN_KEY): // bypass token check if token is the admin key
        return {
          ...new ErrorHandler(data).handle({ code: ErrorCodes.INVALID_TOKEN }),
          key: key,
          session: session,
          isValid: false,
        };
      default:
        let existsinCache = this.Cache.exists(cacheKey);
        if (existsinCache && !data.data.refresh) { 
          console.log("Cache exists")
          let d = this.Cache.get(cacheKey); 
          if (d) {
            return {
              error: false,
              message: "success",
              key: key,
              data: d,
              session: session,
            };
          }
        }
        let d = handle(
          await this.pb.admins.client
            .collection(collection)
            .getList(offset, limit, {
              ...(sort && { sort: sort }),
              ...(filter && { filter: filter }),
              ...(expand && { expand: joinExpand(expand) }),
            }),
          returnable
        ); 
        let keys = this.Cache.getKeys();
        for (const key of keys) {
          const cachedData = this.Cache.get(key);  
          if (cachedData && cachedData.collectionName === collection && cachedData.items) {
             let dupdated = d.items.map((item: any) => {
              const itemId = cachedData.items.findIndex(
                (i: { id: string }) => i.id === item.id
              ); 
              if (itemId > -1) {
                item = cachedData.items[itemId];
              }
               return item;
             });
              d.items = dupdated;
          }
        }
        d.collectionName = collection;
        if(!this.Cache.exists(cacheKey)){   
          this.Cache.set(cacheKey, d,  new Date().getTime() + 3600)
        }  
        return {
          error: false,
          message: "success",
          key: key,
          data: d,
          session: session,
        };
    }
  }
}
