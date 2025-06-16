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

  public updateAllOccurrences(collection: string, payload: { id: string; fields: any }) {
    const keys = this.keys();

    for (const key of keys) {
      let cacheData = this.get(key); 
      if(!cacheData) return;
      const CacheData = this.timesVisited.get(cacheData._payload.id)?.cacheType == "six_hour_immediate"
      // Handle arrays in _payload
      if (Array.isArray(cacheData?._payload)) {
        const exists = cacheData._payload.some((item: any) => item.id === payload.id);
        if (exists) {

          cacheData._payload = cacheData._payload.map((item: any) =>
            item.id === payload.id ? { ...item, ...payload.fields } : item
          );
          //@ts-ignore
          var expirationTime = 0;
          if (CacheData.incremental > 5) {
            const minMinutes = 15, maxMinutes = 45;
            const randomMinutes = Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes;
            expirationTime = Date.now() + randomMinutes * 60 * 1000;
          } else if (CacheData.incremental > 0) {
            const minHours = 1, maxHours = 5;
            const randomHours = Math.floor(Math.random() * (maxHours - minHours + 1)) + minHours;
            expirationTime = Date.now() + randomHours * 60 * 60 * 1000;
          } else {
            expirationTime = Date.now() + 6 * 60 * 60 * 1000;
          }
          this.set(key, cacheData, expirationTime); // Update cache with expanded fields
        }
      }
      // Handle objects with _payload
      else if (typeof cacheData === "object" && cacheData !== null) {

        // Check if _payload exists and matches the id
        if ("_payload" in cacheData && cacheData._payload.id === payload.id) {
          cacheData._payload = { ...cacheData._payload, ...payload.fields };
          this.set(key, cacheData, 60000); // Update cache with expanded fields
        } else {
          // check if item is in cache and delete cache for that item
          const updatedData = this.recursivelyUpdate(cacheData, payload.id, payload.fields, key);
          if (updatedData !== cacheData) {
            // delete the cache entry if the id is found
            this.delete(key);
            console.log("Cache updated for id:", payload.id);
          } else {
            console.log("No matching id found in cache for update:", payload.id);
            console.log("Cache data:", cacheData);
          }
        }
      } else {
        console.log("Cache data is not an object or array:", cacheData);
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
