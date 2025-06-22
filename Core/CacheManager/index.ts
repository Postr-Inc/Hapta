//@ts-nocheck
/**
 * @class CacheController
 * @description Cache Controller for storing and retrieving data in-memory.
 */
export default class CacheController {
  private cache: Map<string, { data: any; ttl: number }>;
  public timesVisited: Map<String, { incremental: number, cacheType: string }>;
  constructor() {
    this.cache = new Map();
    this.startExpirationCheck();
    this.timesVisited = new Map()
  }

  updateAllOccurrences(collection, payload) {
  const keys = this.keys();

  for (const key of keys) {
    const cacheData = this.get(key);
    if (!cacheData) continue;

    const payloadId = payload?.id;
    const fields = payload?.fields;

    // Handle array in _payload
    if (Array.isArray(cacheData?._payload)) {
      let modified = false;
      cacheData._payload = cacheData._payload.map((item) => {
        if (item.id === payloadId) {
          modified = true;
          return { ...item, ...fields };
        }
        return item;
      });

      if (modified) {
        const meta = this.timesVisited.get(payloadId) || { incremental: 0, cacheType: "" };
        let expirationTime = Date.now() + 6 * 60 * 60 * 1000; // Default: 6 hours

        if (meta.cacheType === "six_hour_immediate") {
          if (meta.incremental > 5) {
            expirationTime = Date.now() + (15 + Math.random() * 30) * 60 * 1000; // 15-45 min
          } else if (meta.incremental > 0) {
            expirationTime = Date.now() + (1 + Math.random() * 4) * 60 * 60 * 1000; // 1-5 hrs
          }
        }

        this.set(key, cacheData, expirationTime);
        console.log(`[Cache] Updated array payload for key ${key}`);
        continue;
      }
    }

    // Handle object _payload
    if (typeof cacheData === "object" && cacheData !== null) {
      if ("_payload" in cacheData && cacheData._payload?.id === payloadId) {
        cacheData._payload = { ...cacheData._payload, ...fields };
        this.set(key, cacheData, Date.now() + 60000); // Short 1 min cache
        console.log(`[Cache] Updated object _payload for key ${key}`);
        continue;
      }

      // Fallback recursive update
      const updatedData = this.recursivelyUpdate(cacheData, payloadId, fields);
      if (JSON.stringify(updatedData) !== JSON.stringify(cacheData)) {
        this.set(key, updatedData); // overwrite cache with updated version
        console.log(`[Cache] Recursively updated and set for key ${key}`);
      }
    }
  }
}


  /**
   * Recursively updates occurrences of `id` within a data structure.
   */
  private recursivelyUpdate(data: any, id: string, fields: any, key: string): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.recursivelyUpdate(item, id, fields));
    } else if (typeof data === "object" && data !== null) {
      if (data.id === id) {
        console.log("Updating object with id:", id, "with fields:", fields);
        return { ...data, ...fields, key: key ? data[key] : undefined };
      }
      const updatedObject = { ...data };
      for (const key in updatedObject) {
        if (updatedObject.hasOwnProperty(key)) {
          updatedObject[key] = this.recursivelyUpdate(updatedObject[key], id, fields);
        }
      }
      return updatedObject;
    }
    return data;
  }

public set(key: string, data: any, expiresAt: number = 0): any {
  const expiry = expiresAt > 0 ? expiresAt : 0; // ✅ don’t add Date.now()
  this.cache.set(key, { data, ttl: expiry });
  return data;
}


  public updateCache(updatedItem: any) {
    const keys = this.keys();
    for (const key of keys) {
      let cacheEntry = this.get(key);
      if (Array.isArray(cacheEntry)) {
        let index = cacheEntry.findIndex((item: any) => item.id === updatedItem.id);
        if (index > -1) {
          cacheEntry[index] = updatedItem;
          this.set(key, cacheEntry);
        }
      } else if (cacheEntry.id === updatedItem.id) {
        this.delete(key);
      }
    }
  }

  public delete(key: string): boolean { 
    return this.cache.delete(key);
  }

  public get(key: string): any { 
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry) return null;

    const now = Date.now();
    if (cacheEntry.ttl > 0 && cacheEntry.ttl < now) {
      this.cache.delete(key);
      return null;
    }

    return cacheEntry.data;
  }

  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  private sanitizeKey(key: string): string {
    return key.toString().replace(/[^a-zA-Z0-9]/g, "");
  }

  private startExpirationCheck(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, { ttl }] of this.cache.entries()) {
        if (ttl > 0 && ttl < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Check every minute
  }
}
