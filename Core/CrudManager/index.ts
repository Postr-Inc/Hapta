//@ts-nocheck
import { decode } from "hono/jwt";
import CacheController from "../CacheManager";
import Pocketbase from "pocketbase";
import { ErrorCodes, ErrorMessages } from "../../Enums/Errors";
import { HttpCodes } from "../../Enums/HttpCodes";
import Validate from "./Helpers/Validate";
import { generateHashtext } from "../Ai";
import { c, cache } from "../../src";
import { Tasks } from "../Concurrency/Enums/Tasks";
import RecommendationAlgorithmHandler from "../RecommendationAlgorithmHandler";
import { Post } from "../../Enums/RecordTypes/post";
const batchQueue = []


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
    expand?: string[];
    invalidateCache?: string[];
  }, token: string) {
    // Validate input data early
    const hasIssue = await Validate(payload.data, "create", token, this.cache);
    if (hasIssue) return hasIssue;

    try {
      // Handle files in data if any
      if (payload.data.files && Array.isArray(payload.data.files)) {
        payload.data.files = handleFiles(payload.data.files);
      }

      // Create record in Pocketbase
      const res = await this.pb.collection(payload.collection).create(payload.data, {
        ...(payload.expand && { expand: joinExpand(payload.expand, payload.collection, "create") }),
      });

      // Invalidate cache keys matching prefixes if needed
      if (payload.invalidateCache?.length) {
        this.invalidateCacheByMatch(payload.invalidateCache, true);
      }

      // Special logic for posts collection
      if (payload.collection === "posts") {
        // 1. Generate and update hashtags
        const hashTags = generateHashtext(payload.data.content);
        for (const tag of hashTags) {
          const hashTag = { content: tag, posts: [res.id] };
          const h = await this.pb.collection("hashtags").create(hashTag);
          await this.pb.collection("posts").update(res.id, { hashtags: [...res.hashtags, h.id] });
        }

        // 2. Update all cached feeds by prepending new post
        for (const key of this.cache.keys()) {
          if (key.includes("feed")) {
            const cacheData = this.cache.get(key);
            if (cacheData?._payload && Array.isArray(cacheData._payload)) {
              cacheData._payload = [res, ...cacheData._payload];
              this.cache.set(key, cacheData, Date.now() + 3600 * 1000); // 1 hour cache
            }
          }
        }
      }

      return { _payload: res, opCode: HttpCodes.OK, message: "Record created successfully" };
    } catch (error) {
      console.error("Error creating record:", error);
      return {
        _payload: null,
        opCode: ErrorCodes.SYSTEM_ERROR,
        message: ErrorMessages[ErrorCodes.SYSTEM_ERROR],
      };
    }
  }

 private invalidateCacheByMatch(matchers: string[], verbose = false) {
  const keysToDelete: string[] = [];

  for (const key of this.cache.keys()) {
    for (const match of matchers) {
      if (key.includes(match)) {
        keysToDelete.push(key);
        break; // Prevent multiple matches
      }
    }
  }

  for (const key of keysToDelete) {
    this.cache.delete(key);
    if (verbose) {
      console.log(`[CacheController] Invalidated key: ${key}`);
    }
  }

  if (verbose && keysToDelete.length === 0) {
    console.log(`[CacheController] No keys matched for invalidation using patterns: ${matchers.join(", ")}`);
  }
}


  public async saveChanges() {
    const allKeys = [
      ...createQueue.keys(),
      ...updateQueue.keys(),
      ...deleteQueue.keys(),
    ];

    for (const key of allKeys) {
      console.log(`Rolling queue for ${key}`);
      try {
        await rollQueue(key, this.pb);
      } catch (err) {
        console.error(`Error rolling queue for ${key}:`, err);
      }
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
      filter?: string;
      recommended?: boolean;
    };
  }, token: string) {
    // Decode token once, handle errors gracefully
    let decodedToken: { payload: { id: string } } | null = null;
    try {
      decodedToken = decode(token) as { payload: { id: string } };
    } catch {
      console.warn("Invalid token provided in list");
    }

    const stableOptions = {
      filter: payload.options?.filter,
      sort: payload.options?.sort,
      order: payload.options?.order,
      expand: payload.options?.expand,
    };

    // Compose cacheKey with fallback
    const cacheKey =
      payload.cacheKey ||
      `${payload.collection}_${payload.page}_list_${JSON.stringify(stableOptions)}_${decodedToken?.payload.id ?? "guest"}`;

    let cacheStatus = this.cache.timesVisited.get(cacheKey) ?? { incremental: 0, cacheType: "six_hour_immediate" };
    cacheStatus.incremental++;
    this.cache.timesVisited.set(cacheKey, cacheStatus);

    // Determine expiration time dynamically based on frequency
    let expirationTime: number;
    if (cacheStatus.incremental > 5) {
      const minMinutes = 15, maxMinutes = 45;
      expirationTime = Date.now() + (Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes) * 60 * 1000;
    } else if (cacheStatus.incremental > 0) {
      const minHours = 1, maxHours = 5;
      expirationTime = Date.now() + (Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours) * 60 * 60 * 1000;
    } else {
      expirationTime = Date.now() + 6 * 60 * 60 * 1000;
    }

    // Check cached data
    const cachedData = this.cache.get(cacheKey);
    if (cachedData && cachedData.expirationTime > Date.now()) {
      if (cachedData.expirationTime < expirationTime) {
        this.cache.set(cacheKey, { ...cachedData, expirationTime });
        console.log(`Extended cache expiration for key: ${cacheKey}`);
      }
      return { opCode: HttpCodes.OK, _payload: cachedData._payload };
    }

    // Validate request
    const hasIssue = await Validate(payload, "list", token, this.cache);
    if (hasIssue) return hasIssue;

    try {
      // Sort string with default fallback
      const sortString = payload.options?.sort || (payload.options?.order === "asc" ? "created" : "-created");

      let data = await this.pb.collection(payload.collection).getFullList({
        sort: sortString,
        filter: payload.options?.filter,
        expand: joinExpand(payload.options?.expand || [], payload.collection, "list"),
        cache: "force-cache",
      }) as any[];

      // Custom filtering step
      data = await c.run(Tasks.FILTER_THROUGH_LIST, { list: data, collection: payload.collection });

      // Sort pinned posts first if applicable
      if (payload.options?.sort?.includes("-pinned") && payload.collection === "posts" && data.length > 0) {
        data = [
          ...data.filter(post => post.pinned),
          ...data.filter(post => !post.pinned),
        ];
      }

      // Paginate
      const startIdx = (payload.page - 1) * payload.limit;
      const paginatedItems = data.slice(startIdx, startIdx + payload.limit);

      const response = {
        _payload: paginatedItems,
        totalItems: data.length,
        totalPages: Math.ceil(data.length / payload.limit),
        opCode: HttpCodes.OK,
      };

      // Cache response
      this.cache.set(cacheKey, {
        ...response,
        expirationTime,
      });

      return response;
    } catch (error) {
      console.error("Error listing records:", error);
      return {
        _payload: null,
        opCode: ErrorCodes.SYSTEM_ERROR,
        message: ErrorMessages[ErrorCodes.SYSTEM_ERROR],
      };
    }
  }

  public async get(payload: {
    collection: string;
    isEmbed: boolean;
    id: string;
    options?: { [key: string]: any };
  }, token: string) {
    if (!payload.isEmbed) {
      const hasIssue = await Validate(payload, "get", token, this.cache);
      if (hasIssue) {
        console.warn("Validation failed for get request:", hasIssue);
        return hasIssue;
      }
    }



 

    try {
      // Compose cacheKey including user id if not embed
      const decodedToken = decode(token) as { payload: { id: string } };
      const cacheKey = payload.isEmbed
        ? `${payload.collection}_${payload.id}_get_${JSON.stringify(payload.options)}`
        : `${payload.collection}_${payload.id}_get_${JSON.stringify(payload.options)}_${decodedToken.payload.id}`;

      // Cache frequency management
      let cacheStatus = this.cache.timesVisited.get(cacheKey) ?? { incremental: 0, cacheType: "six_hour_immediate" };
      cacheStatus.incremental++;
      this.cache.timesVisited.set(cacheKey, cacheStatus);

      let expirationTime: number;
      if (cacheStatus.incremental > 5) {
        const minMinutes = 15, maxMinutes = 45;
        expirationTime = Date.now() + (Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes) * 60 * 1000;
      } else if (cacheStatus.incremental > 0) {
        const minHours = 1, maxHours = 5;
        expirationTime = Date.now() + (Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours) * 60 * 60 * 1000;
      } else {
        expirationTime = Date.now() + 6 * 60 * 60 * 1000;
      }

      // Try cache hit
      const cachedData = this.cache.get(cacheKey);
      if (cachedData && cachedData.expirationTime > Date.now()) {
        if (cachedData.expirationTime < expirationTime) {
          this.cache.set(cacheKey, { ...cachedData, expirationTime });
          console.log(`Extended cache expiration for key: ${cacheKey}`);
        }
        return { opCode: HttpCodes.OK, _payload: cachedData._payload };
      }

      console.log(`Cache miss for key: ${cacheKey}. Fetching data...`);

      const data = await this.pb.collection(payload.collection).getOne(payload.id, {
        ...(payload.options?.expand && { expand: joinExpand(payload.options.expand, payload.collection, "get") }),
      });

      const processed = await c.run(Tasks.FILTER_THROUGH_LIST, {
        list: [data],
        collection: payload.collection,
      });

      this.cache.set(cacheKey, {
        _payload: processed[0],
        expirationTime,
      });

      return { _payload: processed[0], opCode: HttpCodes.OK };
    } catch (error) {
      console.error("Error getting record:", error);
      return {
        _payload: null,
        opCode: ErrorCodes.SYSTEM_ERROR,
        message: ErrorMessages[ErrorCodes.SYSTEM_ERROR],
      };
    }
  }

  public async delete(payload: {
    collection: string;
    id: string;
    invalidateCache?: string[];
  }, token: string) {
    const hasIssue = await Validate(payload, "delete", token, this.cache);
    if (hasIssue) return hasIssue;

    try {
      // Remove item from cached lists
      for (const key of this.cache.keys()) {
        const cacheData = this.cache.get(key);
        if (cacheData?._payload && Array.isArray(cacheData._payload)) {
          if (cacheData._payload.find((item: any) => item.id === payload.id)) {
            cacheData._payload = cacheData._payload.filter((item: any) => item.id !== payload.id);
            this.cache.set(key, cacheData, Date.now() + 3600 * 1000);
          }
        }
      }

      // Invalidate cache keys by prefixes if requested
 
      await this.pb.admins.client.collection("users").delete(payload.id)
      if (payload.invalidateCache?.length) {
         this.invalidateCacheByMatch(payload.invalidateCache)
      }
 

      return { _payload: null, opCode: HttpCodes.OK };
    } catch (error) {
      console.error("Error deleting record:", error);
      return {
        _payload: null,
        opCode: ErrorCodes.SYSTEM_ERROR,
        message: ErrorMessages[ErrorCodes.SYSTEM_ERROR],
      };
    }
  }

  public async update(payload: {
    collection: string;
    id: string;
    fields: any;
    expand?: string[];
    invalidateCache?: string[];
  }, token: string) {
    const hasIssue = await Validate(payload, "update", token, this.cache);
    if (hasIssue) return hasIssue;

    try {
      // Handle files in fields if any
      for (const key in payload.fields) {
        if (payload.fields[key]?.isFile) {
          payload.fields[key] = handleFiles(payload.fields[key])[0];
        }
      }

      // Queue update first (assuming appendToQueue returns a promise) 
      const res = await this.pb.collection(payload.collection).update(payload.id, payload.fields, {
        ...(payload.expand && { expand: joinExpand(payload.expand, payload.collection, "update") }),
      });

      // Invalidate cache keys by prefixes if needed
      if (payload.invalidateCache) {
        this.invalidateCacheByMatch(payload.invalidateCache);
      }

      // Update all cached entries for this collection and id
      this.cache.updateAllOccurrences(payload.collection, {
  id: res.id,
  fields: res,
});

      return { _payload: res, opCode: HttpCodes.OK };
    } catch (error) {
      console.error("Error updating record:", error);
      return {
        _payload: null,
        opCode: ErrorCodes.SYSTEM_ERROR,
        message: ErrorMessages[ErrorCodes.SYSTEM_ERROR],
      };
    }
  }
}
