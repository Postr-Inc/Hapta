import { Database } from "bun:sqlite";

/**
 * @class CacheController
 * @description Cache Controller for storing and retrieving data from an SQLite cache.
 */
export default class CacheController {
  private db: Database;

  constructor() {  
    this.db = new Database(":memory:");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.createTable('cache', ["key TEXT PRIMARY KEY", "data TEXT", "ttl INTEGER"]);
    this.startExpirationCheck();
  }

  /**
   * Sets a cache entry with an optional TTL.
   * @param key The cache key.
   * @param data The data to store.
   * @param ttl The time-to-live in milliseconds. 0 means no expiration.
   * @returns The stored data or an error message.
   */
  public set(key: string, data: any, ttl: number = 0): any {
    key = this.sanitizeKey(key);
    try {
      const now = Date.now();
      const expiry = ttl > 0 ? now + ttl : 0;
      const serializedData = typeof data === "object" ? JSON.stringify(data) : data;
      
      if (this.exists(key)) {
        this.db.prepare(`UPDATE cache SET data = ?, ttl = ? WHERE key = ?`).run(serializedData, expiry, key);
      } else {
        this.db.prepare(`INSERT INTO cache (key, data, ttl) VALUES (?, ?, ?)`).run(key, serializedData, expiry);
      }

      return this.get(key);
    } catch (error) {
      console.error("Error setting cache:", error);
      return { error: true, message: error.message };
    }
  }

  /**
   * Deletes a cache entry.
   * @param key The cache key to delete.
   * @returns True if the deletion was successful, otherwise false.
   */
  public delete(key: string): boolean {
    key = this.sanitizeKey(key);
    return this.clear(key);
  }

  /**
   * Retrieves a cache entry.
   * @param key The cache key to retrieve.
   * @returns The cached data or null if not found or expired.
   */
  public get(key: string): any {
    key = this.sanitizeKey(key);
    try {
      const result = this.db.prepare(`SELECT data FROM cache WHERE key = ?`).get(key);
      if (!result) return null; 
      const data = JSON.parse(result.data);
      return data;
    } catch (error) {
      console.error("Error getting cache:", error);
      return null;
    }
  }

  /**
   * Lists all cache keys.
   * @returns An array of cache keys.
   */
  public keys(): string[] {
    try {
      const keys = this.db.prepare(`SELECT key FROM cache`).all();
      return keys.map((row: any) => row.key);
    } catch (error) {
      console.error("Error listing all keys:", error);
      return [];
    }
  }

  private sanitizeKey(key: string): string {
    return key.toString().replace(/[^a-zA-Z0-9]/g, "");
  }

  private clear(key: string): boolean {
    try {
      this.db.prepare(`DELETE FROM cache WHERE key = ?`).run(key);
      return true;
    } catch (error) {
      console.error("Error clearing cache:", error);
      return false;
    }
  }

  private exists(key: string): boolean {
    try {
      const result = this.db.prepare(`SELECT key FROM cache WHERE key = ?`).get(key);
      return !!result;
    } catch (error) {
      console.error("Error checking if cache exists:", error);
      return false;
    }
  }

  private createTable(name: string, columns: string[]): boolean {
    try {
      this.db.prepare(`CREATE TABLE IF NOT EXISTS ${name} (${columns.join(", ")})`).run();
      return true;
    } catch (error) {
      console.error("Error creating table:", error);
      return false;
    }
  }

  private startExpirationCheck(): void {
    setInterval(() => {
      const now = Date.now();
      this.db.exec(`DELETE FROM cache WHERE ttl > 0 AND ttl < ${now}`);
    }, 60000); // Check every minute
  }
}
