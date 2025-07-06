import config from "../../../config";

//@ts-nocheck
const COMPRESSION_THRESHOLD = 1024;
interface CacheSyncMessage {
  action: "set" | "delete" | "invalidate";
  key: string;
  data?: any; // For 'set', the new cache value
  expiresAt?: number;
  source: number;
}
export default class CacheController {
  private cache: Map<string, { data: any; ttl: number; compressed?: boolean }>;
  public timesVisited: Map<string, { incremental: number; cacheType: string }>;
  private broadcastCallback?: (msg: CacheSyncMessage) => void;

  constructor() {
    this.cache = new Map();
    this.timesVisited = new Map();
    this.startExpirationCheck();
  }
  public setBroadcastCallback(callback: (msg: CacheSyncMessage) => void) {
    this.broadcastCallback = callback;
  }
  // ==== CACHE KEY HELPERS ====

  /** 
   * Build cache key with userId and page (optional).
   * Ensures no undefined or null parts in key.
   */
  buildCacheKey(baseKey: string, userId?: string, page?: number): string {
    if (!userId) return baseKey; // no user, no userId in key
    const pagePart = typeof page === "number" ? `_${page}` : "";
    return `${baseKey}_${userId}${pagePart}`;
  }

  /**
   * Normalize cache key by removing page numbers from pattern: _<number>_feed
   * and removing undefined/null parts.
   */
  normalizeCacheKey(key: string): string {
    let k = key.toLowerCase().trim();

    // Remove leading slash if present
    if (k.startsWith("/")) k = k.slice(1);

    const parts = k.split("_");
    if (parts.includes("feed")) {
      const feedIdx = parts.indexOf("feed");
      if (feedIdx >= 2 && Number.isInteger(Number(parts[feedIdx - 1]))) {
        parts.splice(feedIdx - 1, 1); // remove page
      }
    }
    return parts.join("_");
  }


  // ==== CACHE SET/GET/DELETE ====

  public set(key: string, data: any, expiresAt: number = 0, isInternal?: false): any {
    if (!key || key.includes("undefined") || key.includes("null")) {
      console.warn(`[CacheController] WARNING: cache key contains undefined or null: ${key}`);
    }

    const expiry = expiresAt > 0 ? expiresAt : 0;

    try {
      const jsonStr = JSON.stringify(data);

      if (jsonStr.length > COMPRESSION_THRESHOLD) {
        // Compress JSON string using Bun gzipSync
        const compressed = Bun.gzipSync(new TextEncoder().encode(jsonStr));
        this.cache.set(key, { data: compressed, ttl: expiry, compressed: true });
      } else {
        this.cache.set(key, { data, ttl: expiry, compressed: false });
      }
    } catch {
      // Fallback: store raw data if stringify fails
      this.cache.set(key, { data, ttl: expiry, compressed: false });
    }

    if (this.broadcastCallback && !isInternal) {
      console.log("true")
      this.broadcastCallback({ action: "set", key, data, expiresAt, source:  parseInt(config.Server.NodeId as any) });
    }
    return data;
  }

  public get(key: string): any {
    const cacheEntry = this.cache.get(key);
    if (!cacheEntry) return null;

    const now = Date.now();
    if (cacheEntry.ttl > 0 && cacheEntry.ttl < now) {
      this.cache.delete(key);
      return null;
    }

    if (cacheEntry.compressed) {
      try {
        const decompressed = Bun.gunzipSync(cacheEntry.data);
        const jsonStr = new TextDecoder().decode(decompressed);
        return JSON.parse(jsonStr);
      } catch {
        this.cache.delete(key);
        return null;
      }
    }

    return cacheEntry.data;
  }

  public delete(key: string): boolean {
    if (this.broadcastCallback) {
      this.broadcastCallback({ action: "delete", key, source:  parseInt(config.Server.NodeId as any)  });
    }
    return this.cache.delete(key);
  }

  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  // ==== CACHE INVALIDATION ====

  /**
   * Invalidate cache keys matching any of the normalized raw keys.
   * Uses regex to match keys ignoring page numbers and handles undefined/null.
   */
  public invalidateCacheByNormalizedKeys(rawKeys: string[], isInternal = false, verbose = false)
 {
    const normalizedTargets = rawKeys.map((key) => this.normalizeCacheKey(key.trim()));
    const keysToDelete: string[] = [];
    if (this.broadcastCallback && !isInternal) {
      for (const key of rawKeys) {
        this.broadcastCallback({ action: "invalidate", key, source:  parseInt(config.Server.NodeId as any)  });
      }
    }
    for (const key of this.cache.keys()) {
      const normalizedKey = this.normalizeCacheKey(key);

      for (const target of normalizedTargets) {
        if (normalizedKey.startsWith(target) || normalizedKey.includes(target) || normalizedKey.endsWith(target)) {
          keysToDelete.push(key);
          break;
        }
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      if (verbose) console.log(`[CacheController] Invalidated normalized cache key: ${key}`);
    }

    if (verbose && keysToDelete.length === 0) {
      console.log(`[CacheController] No cache keys matched for normalized invalidation on: ${rawKeys.join(", ")}`);
    }
  }



  /**
   * Base invalidation logic using string prefix or regex.
   */
  private invalidateCache(matchers: (string | RegExp)[], verbose = false) {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      for (const matcher of matchers) {
        let isMatch = false;

        if (typeof matcher === "string") {
          if (key.startsWith(matcher)) isMatch = true;
        } else if (matcher instanceof RegExp) {
          if (matcher.test(key)) isMatch = true;
        }

        if (isMatch) {
          keysToDelete.push(key);
          break;
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
      console.log(
        `[CacheController] No keys matched for invalidation using: ${matchers
          .map((m) => (typeof m === "string" ? m : m.toString()))
          .join(", ")}`
      );
    }
  }

  /**
   * Clears all user-specific caches for a given userId.
   * Call this on login/logout to reset user caches.
   */
  public clearUserCache(userId: string, verbose = false) {
    if (!userId) return;

    const userCachePrefixes = [
      `posts_recommended_feed_${userId}`,
      `posts_recommended_feed_${userId}_home`,
      `profile_${userId}`,
      // add more user-specific cache key prefixes here
    ];

    this.invalidateCacheByNormalizedKeys(userCachePrefixes, verbose);
  }

  // ==== CACHE UPDATES ====

  updateAllOccurrences(collection: string, payload: any) {
    const keys = this.keys();

    for (const key of keys) {
      const cacheData = this.get(key);
      if (!cacheData) continue;

      const payloadId = payload?.id;
      const fields = payload?.fields;

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

      if (typeof cacheData === "object" && cacheData !== null) {
        if ("_payload" in cacheData && cacheData._payload?.id === payloadId) {
          cacheData._payload = { ...cacheData._payload, ...fields };
          this.set(key, cacheData, Date.now() + 60000); // Short 1 min cache
          console.log(`[Cache] Updated object _payload for key ${key}`);
          continue;
        }

        const updatedData = this.recursivelyUpdate(cacheData, payloadId, fields);
        if (JSON.stringify(updatedData) !== JSON.stringify(cacheData)) {
          this.set(key, updatedData);
          console.log(`[Cache] Recursively updated and set for key ${key}`);
        }
      }
    }
  }

  private recursivelyUpdate(data: any, id: string, fields: any): any {
    if (Array.isArray(data)) {
      return data.map((item) => this.recursivelyUpdate(item, id, fields));
    } else if (typeof data === "object" && data !== null) {
      if (data.id === id) {
        return { ...data, ...fields };
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

  private startExpirationCheck(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, { ttl }] of this.cache.entries()) {
        if (ttl > 0 && ttl < now) {
          this.cache.delete(key);
        }
      }
    }, 60000);
  }
}
