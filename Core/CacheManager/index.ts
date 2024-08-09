//@ts-nocheck
import { Database } from "bun:sqlite";
import fs from "fs";
/**
 * @class CacheController
 * @description Cache Controller for storing and retrieving data from the cache based on SQLite
 */
export default class CacheController {
  db: Database;

  constructor() {  
    this.db = new Database(":memory:");
    this.db.exec("PRAGMA journal_mode = WAL;");
    // create cache table
    this.createTable('cache', ["key TEXT PRIMARY KEY", "data TEXT", "ttl INTEGER"]);
    this.startExpirationCheck();
  }

  public set(key: string, data:  any, ttl: number = 0): any { 
    key = key.toString().replace(/[^a-zA-Z0-9]/g, "");
    try {
      key = key.toString().replace(/[^a-zA-Z0-9]/g, "");
      if (!this.tableExists('cache')) {
        this.createTable('cache', ["key TEXT PRIMARY KEY", "data TEXT", "ttl INTEGER"]);
      }

      const now = Date.now();
      const expiry = ttl > 0 ? now + ttl : 0;
      const exists =  this.exists(key);

      if (exists) {
        this.db.prepare(`UPDATE cache SET data = ?, ttl = ? WHERE key = ?`).run(typeof data === "object" ? JSON.stringify(data) : data, expiry, key);
      } else {
        this.db.prepare(`INSERT INTO cache (key, data, ttl) VALUES (?, ?, ?)`).run(key, typeof data === "object" ? JSON.stringify(data) : data, expiry);
      }

      return this.get(key);
    } catch (error) {
      console.error("Error setting cache:", error);
      return { error: true, message: error.message };
    }
  }

  public delete(key: string): boolean {
    key = key.toString().replace(/[^a-zA-Z0-9]/g, "");
    return this.clear(key);
  }

  public get(key: string): any { 
    key = key.toString().replace(/[^a-zA-Z0-9]/g, "");
    try {
      key = key.toString().replace(/[^a-zA-Z0-9]/g, "");
      const entry = this.db.prepare(`SELECT data, ttl FROM cache WHERE key = ?`).get(key);

      if (!entry) return null;

      const now = Date.now();
      if (entry.ttl && entry.ttl < now) {
        this.clear('cache', key);
        return null;
      }

     return JSON.parse(entry.data);
    } catch (error) {
      console.error("Error getting cache:", error);
      return { error: true, message: error.message };
    }
  }

  public keys(): string[] {
    try {
      const keys = this.db.prepare(`SELECT key FROM cache`).all();
      return keys.map((row: any) => row.key);
    } catch (error) {
      console.error("Error listing all keys:", error);
      return [];
    }
  }

  private clear(key: string): boolean {
    key = key.toString().replace(/[^a-zA-Z0-9]/g, "");
    try {
      this.db.prepare(`DELETE FROM cache WHERE key = ?`).run(key);
      return true;
    } catch (error) {
      console.error("Error clearing cache:", error);
      return false;
    }
  }

  private exists(key: string): boolean {
    key = key.toString().replace(/[^a-zA-Z0-9]/g, "");
    try {
      const result = this.db.prepare(`SELECT key FROM cache WHERE key = ?`).get(key);
      return result ? true : false;
    } catch (error) {
      console.error("Error checking if cache exists:", error);
      return false;
    }
  }

  private tableExists(collection: string): boolean {
    try {
      const result = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(collection);
      return !!result;
    } catch (error) {
      console.error("Error checking if table exists:", error);
      return false;
    }
  }

  private createTable(collection: string, fields: string[]): boolean {
    try {
      this.db.prepare(`CREATE TABLE IF NOT EXISTS ${collection} (${fields.join(", ")})`).run();
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
    }, 60000);
  }
}
