import { decode } from "hono/jwt";
import CacheController from "../CacheManager";
import Pocketbase from "pocketbase";
import { ErrorCodes, ErrorMessages } from "../../Enums/Errors";
import { HttpCodes } from "../../Enums/HttpCodes";
import Validate from "./Helpers/Validate";
import { generateHashtext } from "../Ai";
import { c } from "../../src";
import { Tasks } from "../Concurrency/Enums/Tasks";

const subscriptions = new Map<string, any>();
const updateQueue = new Map<string, any[]>();
const deleteQueue = new Map<string, any[]>();
const createQueue = new Map<string, any[]>();
const lastUpdated = new Map<string, number>();

type QueueMethod = "create" | "delete" | "update";

function appendToQueue(data: any, cancelPrevious = true, method: QueueMethod) {
  const queueMap =
    method === "create"
      ? createQueue
      : method === "delete"
      ? deleteQueue
      : updateQueue;

  if (cancelPrevious) {
    queueMap.set(data.id, [data.fields]);
  } else {
    const queue = queueMap.get(data.id) || [];
    queue.push(data.fields || data);
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
  }
}

async function processQueue(
  queueMap: Map<string, any[]>,
  id: string,
  pb: Pocketbase,
  method: QueueMethod
) {
  if (!queueMap.has(id)) return;

  const queue = queueMap.get(id);
  if (!queue) return;

  for (const data of queue) {
    if (!data) continue;
    try {
      switch (method) {
        case "create":
          await pb.admins.client
            .collection(data.collection)
            .create(data.record, {
              ...(data.expand && {
                expand: joinExpand(data.expand, data.collection, "create"),
              }),
            });
          break;
        case "update":
          await pb.admins.client
            .collection(data.collection)
            .update(data.id, data.data);
          break;
        case "delete":
          await pb.admins.client.collection(data.collection).delete(data.id);
          break;
      }
    } catch (error) {
      console.error(`Failed to ${method} record for ${id}`, error);
    }
  }

  queueMap.delete(id);
}

setInterval(() => {
  let allKeys = [
    ...createQueue.keys(),
    ...updateQueue.keys(),
    ...deleteQueue.keys(),
  ];
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
      if (!file.data) return;
      const array = new Uint8Array(file.data);
      const blob = new Blob([array]);
      let name =
        Math.random().toString(36).substring(7) + Date.now().toString(36);
      let f = new File([blob], file.name || name, {
        type: file.type || "image/png",
      });
      files.push(f);
    });
  } else {
    const array = new Uint8Array(data.data);
    const blob = new Blob([array]);
    let name =
      Math.random().toString(36).substring(7) + Date.now().toString(36);
    let f = new File([blob], data.name || name, {
      type: data.type || "image/png",
    });

    files.push(f);
  }
  return files;
}

export default class CrudManager {
  private cache: CacheController;
  private pb: Pocketbase;

  constructor(cache: CacheController, pb: Pocketbase) {
    this.cache = cache;
    this.pb = pb;
  }

  public async create(payload: {
    collection: string;
    data: any;
    expand: any[];
  }, token: string) {
    let hasIssue = await Validate(payload, "create", token, this.cache);
    if (hasIssue) return hasIssue;

    try {
      if (payload.data.files && Array.isArray(payload.data.files)) {
        payload.data.files = handleFiles(payload.data.files);
      }

      let res = await this.pb.collection(payload.collection).create(payload.data, {
        ...(payload.expand && {
          expand: joinExpand(payload.expand, payload.collection, "create"),
        }),
      });

      if (payload.collection === "posts") {
        let hashTags = generateHashtext(payload.data.content);
        for (let tag of hashTags) {
          let hashTag = {
            content: tag,
            posts: [res.id],
          };
          console.log("Creating hashtag", hashTag);
          await this.pb.collection("hashtags").create(hashTag);
          await this.pb.collection("posts").update(res.id, { hashtags: [...res.hashtags, tag] });
        }
      }

      return { _payload: res, opCode: HttpCodes.OK , message: "Record created successfully" };
    } catch (error) { 
      console.error("Error creating record", error);
      return {
        _payload: null,
        opCode: ErrorCodes.SYSTEM_ERROR,
        message: ErrorMessages[ErrorCodes.SYSTEM_ERROR],
      };
    }
  }

  public async saveChanges() {
    let allKeys = [
      ...createQueue.keys(),
      ...updateQueue.keys(),
      ...deleteQueue.keys(),
    ];
    for (const key of allKeys) {
      console.log(`Rolling queue for ${key}`);
      await rollQueue(key, this.pb);
    }
  }

  public async list(payload: {
    collection: string;
    page: number;
    limit: number;
    cacheKey?: string;
    options?: {
      order?: "asc" | "desc";
      sort?: string;
      expand?: string[];
      filter: string;
      recommended?: boolean;
    };
  }, token: string) {
    const cacheKey =
      payload.cacheKey ||
      `${payload.collection}_list_${JSON.stringify(payload.options)}_${payload.page}_${payload.limit}_${decode(token).payload.id}`;
     const cacheData = this.cache.get(cacheKey) ? this.cache.get(cacheKey) : null;

    if (cacheData) {
      return { opCode: HttpCodes.OK, ...cacheData };
    }

    let hasIssue = await Validate(payload, "list");
    if (hasIssue) return hasIssue;

    try {
      const data = await this.pb.collection(payload.collection).getList(
        payload.page,
        payload.options?.recommended ? Number.MAX_SAFE_INTEGER : payload.limit,
        {
          sort: payload.options?.order === "asc" ? "created" : "-created",
          filter: payload.options?.filter,
          expand: joinExpand(payload.options?.expand || [], payload.collection, "list"),
          cache: "force-cache",
        }
      );

      let processed = await c.run(Tasks.FILTER_THROUGH_LIST, {
        list: data.items,
        collection: payload.collection,
      });

      console.log(Array.isArray(processed));
      this.cache.set(
        cacheKey,
        {
          _payload: processed,
          totalItems: data.totalItems,
          totalPages: data.totalPages,
        },
        Date.now() + 3600 * 1000 // 1 hour
      );

      return {
        _payload: processed,
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        opCode: HttpCodes.OK,
      };
    } catch (error) {
      console.error("Error listing records", error);
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR, message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
    }
  }

  public async get(payload: {
    collection: string;
    id: string;
    options: { [key: string]: any };
  }, token: string) {
    let hasIssue = await Validate(payload, "get", token, this.cache);
    if (hasIssue) return hasIssue;

    try {
      const cacheKey = `${payload.collection}_${payload.id}_get_${JSON.stringify(payload.options)}_${decode(token).payload.id}`;
      const cacheData = this.cache.get(cacheKey);

      if (cacheData) {
        return { opCode: HttpCodes.OK, ...cacheData };
      }

      const data = await this.pb.collection(payload.collection).getOne(payload.id, {
        ...(payload.options &&  payload.options.expand && {
          expand: joinExpand(payload.options.expand, payload.collection, "get"),
        }),
        cache: "force-cache",
      });

      const processed = await c.run(Tasks.FILTER_THROUGH_LIST, {
        list: [data],
        collection: payload.collection,
      });

      this.cache.set(
        cacheKey,
        {
          _payload: processed[0],
        },
        Date.now() + 3600 * 1000 // 1 hour
      );

      return { _payload: processed[0], opCode: HttpCodes.OK };
    } catch (error) {
      console.error("Error getting record", error);
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR , message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
    }
  }

  public async delete(payload: { collection: string; id: string; callback: any }, token: string) {
    let decoded = decode(token).payload;
    let hasIssue = await Validate(payload, "delete", token, this.cache);
    if (hasIssue) return hasIssue;

    try {
      const keys = this.cache.keys();
      for (let key of keys) {
        let cacheData = this.cache.get(key);
        if (Array.isArray(cacheData._payload)) {
          let exists = cacheData._payload.find((item: any) => item.id === payload.id);
          if (exists) {
            cacheData._payload = cacheData._payload.filter((item: any) => item.id !== payload.id);
            this.cache.set(key, cacheData, Date.now() + 3600 * 1000); // 1 hour
          }
        }
      }

      appendToQueue(
        { collection: payload.collection, id: payload.id },
        false,
        "delete"
      );

      return { _payload: null, opCode: HttpCodes.OK };
    } catch (error) {
      console.error("Error deleting record", error);
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR , message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
    }
  }

  public async update(payload: {
    collection: string;
    id: string;
    fields: any;
    expand: any[];
    callback: any;
  }, token: string) {
    let hasIssue = await Validate(payload, "update", token, this.cache);
    if (hasIssue) return hasIssue;
    try {
      const keys = this.cache.keys();
      
      const res = await this.pb.collection(payload.collection).update(payload.id, payload.fields, {
        ...(payload.expand && {
          expand: joinExpand(payload.expand, payload.collection, "update"),
        }),
      });

      for (let key of keys) { 
        let cacheData = this.cache.get(key);
        if (Array.isArray(cacheData._payload)) {
          let exists = cacheData._payload.find((item: any) => item.id === payload.id);
          if (exists) {
            cacheData._payload = cacheData._payload.map((item: any) => {
              if (item.id === payload.id) {
                return { ...item, ...payload.fields };
              }
              return item;
            }); 
            this.cache.set(key, cacheData, Date.now() + 3600 * 1000); // 1 hour
          }
        }else{ 
          if("_payload" in cacheData && cacheData._payload.id === payload.id){
            cacheData._payload = { ...cacheData._payload, ...payload.fields };
            this.cache.set(key, cacheData, Date.now() + 3600 * 1000); // 1 hour
          }  
        }
      }

      return { _payload: res, opCode: HttpCodes.OK };
    } catch (error) {
      console.error("Error updating record", error);
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR, message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
    }
  }
}
