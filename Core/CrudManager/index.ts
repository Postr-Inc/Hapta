import { decode } from "hono/jwt";
import CacheController from "../CacheManager";
import Pocketbase from "pocketbase";
import { ErrorCodes, ErrorMessages } from "../../Enums/Errors";
import { HttpCodes } from "../../Enums/HttpCodes";
import Validate from "./Helpers/Validate";
import { generateHashtext } from "../Ai";
import { c } from "../../src";
import { Tasks } from "../Concurrency/Enums/Tasks";
import RecommendationAlgorithmHandler from "../RecommendationAlgorithmHandler";
import { Post } from "../../Enums/RecordTypes/post";

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
    invalidateCache?: [string];
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

      if (payload.invalidateCache) {
        let cacheKeys = this.cache.keys();
        console.log({ cacheKeys });

        // Create a list of keys to invalidate by checking if any cache key starts with one of the invalidateCache entries
        let keysToInvalidate = [];

        for (let key of cacheKeys) {
          for (let prefix of payload.invalidateCache) {
            if (key.startsWith(prefix)) {
              keysToInvalidate.push(key);
              break; // No need to check other prefixes once matched
            }
          }
        }

        console.log({ keysToInvalidate });

        for (let key of keysToInvalidate) {
          this.cache.delete(key);
          console.log(`cache invalidated for key: ${key}`);
        }
      }


      // When a post is created, update each feed to include the new post
      if (payload.collection === "posts") {
        // 1. Generate hashtags and update hashtags collection
        let hashTags = generateHashtext(payload.data.content);
        for (let tag of hashTags) {
          let hashTag = {
            content: tag,
            posts: [res.id],
          };
          console.log("Creating hashtag", hashTag);
          var h = await this.pb.collection("hashtags").create(hashTag);
          await this.pb.collection("posts").update(res.id, { hashtags: [...res.hashtags, h.id] });
        }

        // 2. Update each feed in cache to include the new post
        const keys = this.cache.keys();
        for (const key of keys) {
          if (key.includes("feed")) {
            let cacheData = this.cache.get(key);
            if (cacheData && Array.isArray(cacheData._payload)) {
              // Add the new post to the feed's posts array
              cacheData._payload = [res, ...cacheData._payload];
              this.cache.set(key, cacheData, Date.now() + 3600 * 1000); // 1 hour
            }
          }
        }
      }

      return { _payload: res, opCode: HttpCodes.OK, message: "Record created successfully" };
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
    const stableOptions = {
      filter: payload.options?.filter,
      sort: payload.options?.sort,
      order: payload.options?.order,
      expand: payload.options?.expand,
    };
    const cacheKey =
      payload.cacheKey ||
      `${payload.collection}_list_${JSON.stringify(stableOptions)}`;

    let cacheData = this.cache.get(cacheKey)
    if (cacheData) {
      return { opCode: HttpCodes.OK, ...cacheData };
    }
    let hasIssue = await Validate(payload, "list");
    if (hasIssue) return hasIssue;


    try {
      console.log("Listing records for collection:", payload.collection);
      // Build the sort string correctly
      let sortString = "";
      if (payload.options?.sort) {
        sortString = payload.options.sort;
      } else {
        sortString = (payload.options?.order === "asc" ? "created" : "-created");
      }

      var data = await this.pb.collection(payload.collection).getFullList(
        {
          sort: sortString,
          filter: payload.options?.filter,
          expand: joinExpand(payload.options?.expand || [], payload.collection, "list"),
          cache: "force-cache",
        }
      ) as Post[]
      // ...existing code...
      data = await c.run(Tasks.FILTER_THROUGH_LIST, {
        list: data,
        collection: payload.collection,
      })

      console.log(payload.options?.sort, payload.options?.filter)

      // Sort pinned first if needed
      if (
        payload.options?.sort?.includes("-created")) {
        data = data.sort((a: any, b: any) => {
          const dateA = new Date(a.created).getTime();
          const dateB = new Date(b.created).getTime();
          if (payload.options?.order === "asc") {
            return dateA - dateB;
          } else {
            return dateB - dateA;
          }
        });
      }

      if (
        payload.collection === "posts" &&
        data.length > 0 &&
        payload.options?.sort?.includes("-pinned")
      ) {
        data = [
          ...data.filter((post: any) => post.pinned),
          ...data.filter((post: any) => !post.pinned),
        ]; 

      }



      // Now paginate the sorted data
      var paginatedItems = data.slice(
        (payload.page - 1) * payload.limit,
        payload.page * payload.limit
      );
      // ...existing code...


      const response = {
        _payload: paginatedItems,
        totalItems: paginatedItems.length,
        totalPages: Math.round(
          data.length / payload.limit),
        opCode: HttpCodes.OK,
      };




      this.cache.set(
        cacheKey,
        {
          _payload: response._payload,
          totalItems: response.totalItems,
          totalPages: response.totalPages,
        },
        Date.now() + 3600 * 1000 // 1 hour
      );

      return {
        _payload: response._payload,
        totalItems: response.totalItems,
        totalPages: response.totalPages,
        opCode: HttpCodes.OK,
      };
    } catch (error) {
      console.error("Error listing records", error);
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR, message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
    }
  }

  public async get(payload: {
    collection: string;
    isEmbed: boolean;
    id: string;
    options: { [key: string]: any };
  }, token: string) {
    // --- Validation ---
    // Perform validation if the request is not an embed
    if (!payload.isEmbed) {
      const hasIssue = await Validate(payload, "get", token, this.cache);
      if (hasIssue) {
        console.warn("Validation failed for get request:", hasIssue);
        return hasIssue;
      }
    }

    try { 
      let cacheKey: string;
      if (payload.isEmbed) {
        cacheKey = `${payload.collection}_${payload.id}_get_${JSON.stringify(payload.options)}`;
      } else {
        const decodedToken = decode(token) as { payload: { id: string } };
        cacheKey = `${payload.collection}_${payload.id}_get_${JSON.stringify(payload.options)}_${decodedToken.payload.id}`;
      }

      let cacheStatus = this.cache.timesVisited.get(payload.id) || { incremental: 0, cacheType: "six_hour_immediate" };
      cacheStatus.incremental++;
      this.cache.timesVisited.set(payload.id, cacheStatus);
 
      let expirationTime: number;
      if (cacheStatus.incremental > 5) {
        const minMinutes = 15, maxMinutes = 45;
        const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
        expirationTime = Date.now() + randomMinutes * 60 * 1000;
      } else if (cacheStatus.incremental > 0) {
        const minHours = 1, maxHours = 5;
        const randomHours = Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours;
        expirationTime = Date.now() + randomHours * 60 * 60 * 1000;
      } else {
        expirationTime = Date.now() + 6 * 60 * 60 * 1000;
      }
 
      const cacheData = this.cache.get(cacheKey);

      if (cacheData && cacheData.expirationTime > Date.now()) { 
        if (cacheData.expirationTime < expirationTime) { 
          this.cache.set(cacheKey, {
            _payload: cacheData._payload,
            expirationTime,
          });
          console.log(`Extended cache expiration for key: ${cacheKey} to new expiry.`);
        }

        return { opCode: HttpCodes.OK, _payload: cacheData._payload };
      }

      console.log(`Cache miss for key: ${cacheKey}. Fetching data...`);

      const data = await this.pb.collection(payload.collection).getOne(payload.id, {
        ...(payload.options && payload.options.expand && {
          expand: joinExpand(payload.options.expand, payload.collection, "get"),
        }),
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
        expirationTime
      );
 
      return { _payload: processed[0], opCode: HttpCodes.OK };

    } catch (error) { 
      console.error("Error getting record:", error);
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR, message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
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
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR, message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
    }
  }

  public async update(payload: {
    collection: string;
    id: string;
    fields: any;
    expand: any[];
    callback: any;
    invalidateCache: string[]
  }, token: string) {
    let hasIssue = await Validate(payload, "update", token, this.cache);
    if (hasIssue) return hasIssue;
    try {

      for(var i in payload.fields){
        if(payload.fields[i].isFile){
          payload.fields[i] = handleFiles(payload.fields[i])[0]
        }
      } 
      const res = await this.pb.collection(payload.collection).update(payload.id, payload.fields, {
        ...(payload.expand && {
          expand: joinExpand(payload.expand, payload.collection, "update"),
        }),
      });

      if (payload.invalidateCache) {
        let cacheKeys = this.cache.keys();

        // Create a list of keys to invalidate by checking if any cache key starts with one of the invalidateCache entries
        let keysToInvalidate = [];

        for (let key of cacheKeys) {
          for (let prefix of payload.invalidateCache) {
            if (key.startsWith(prefix)) {
              keysToInvalidate.push(key);
              break; // No need to check other prefixes once matched
            }
          }
        }

        for (let key of keysToInvalidate) {
          this.cache.delete(key);
          console.log(`Invalidating : ${key}`)
        }
      }
      this.cache.updateAllOccurrences(payload.collection, { id: payload.id, fields: payload.fields });
      return { _payload: res, opCode: HttpCodes.OK };
    } catch (error) {
      console.error("Error updating record", error);
      return { _payload: null, opCode: ErrorCodes.SYSTEM_ERROR, message: ErrorMessages[ErrorCodes.SYSTEM_ERROR] };
    }
  }
}
