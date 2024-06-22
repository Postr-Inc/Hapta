//@ts-nocheck
import { Database } from "bun:sqlite";
/**
 * @class CacheController
 * @description Haptas Cache Controller for storing and retrieving data from the cache based on sqlite
 */
export default class CacheController {
  db: Database;
  constructor() {
    this.db = new Database(":memory:"); 
    this.db.exec("PRAGMA journal_mode = WAL;"); 
  }


  public clear(collection: string, key: string) {
    try { 
      this.db.exec(`DELETE FROM ${collection} WHERE key='${key}'`);
      return true;
    } catch (error) {
      return false;
    }
  }
  public getCache(collection: string, key: string) {
    try {  
      // Fetch the entry with the TTL
      const entry = this.db.prepare(`SELECT data  FROM ${collection} WHERE key = ?`).get(key);
  
      if (!entry) {
        // If entry does not exist, return null
        return null;
      }
  
      // Check if the entry has expired
      const now = Date.now();
      //@ts-ignore
      if (entry.ttl && entry.ttl < now) {
        // Entry has expired, delete it
        this.clear(collection, key);
        return null;
      }
  
      // If entry is valid, update its TTL (if necessary)
      // Assuming TTL needs to be refreshed on access, otherwise this can be omitted 
      if (entry.ttl) {
        this.db
          .prepare(`UPDATE ${collection} SET ttl = ? WHERE key = ?`)
          .run(now + entry.ttl);
      }
      //@ts-ignore  
      return { data: entry.data };
    } catch (error) {
      console.log(error);
      return { error: true, message: error };
    }
  }
  
  public async update(collection: string, key: string, data: string) {
    try {
      this.db
        .prepare(`UPDATE ${collection} SET data = '${data}' WHERE key='${key}'`)
        .run();
      return this.db
        .prepare(`SELECT data FROM ${collection} WHERE key='${key}'`)
        .get();
    } catch (error) {
      return false;
    }
  }

  public async list(collection: string, offset: number, limit: number, order: string) {
    try {
      return this.db
        .prepare(`SELECT * FROM  ${collection} LIMIT ${offset}, ${limit} ORDER BY  ${order}`)
        .all();
    } catch (error) {
      return { error: true, message: error };
    }
  }

  public  exists(collection: string, key: string) {
    try { 
       this.db.prepare(`SELECT * FROM ${collection} WHERE key='${key}'`).get();
      return true;
    } catch (error) { 
      return false;
    }
  }
  public tableExists(collection: string) {
    try {
      return this.db
        .query(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${collection}'`
        )
        .get();
    } catch (error) { 
      return { error: true, message: error };
    }
  }
   
  public async updateCache(collection: string, key: string, data: string) {
    try {
      this.db
        .prepare(`UPDATE ${collection} SET data = '${JSON.stringify(data)}' WHERE key='${key}'`)
        .run();
      return this.db
        .prepare(`SELECT data FROM ${collection} WHERE key='${key}'`)
        .get();
    } catch (error) {
      return false;
    }
  }
  public async setCache(collection: string, key: string, data: string, ttl: number = 0) {
    
    try { 
       
      if (!this.tableExists(collection)) {
         this.db.prepare(`CREATE TABLE ${collection} (key TEXT, data TEXT, ttl INTEGER)`).run();
      }
      this.db
        .prepare(
          `INSERT INTO ${collection} (key, data, ttl) VALUES ('${key}', '${JSON.stringify(data)}', ${ttl ? Date.now() + ttl : 0})`
        )
        .run();
      return this.db
        .prepare(`SELECT data FROM ${collection} WHERE key='${key}'`)
        .get();
    } catch (error) {
      console.log(error);
      return { error: true, message: error };
    }
  }

  public async deleteTable(collection: string) {
    try {
      this.db.prepare(`DROP TABLE ${collection}`).run();
      return true;
    } catch (error) {
      return false;
    }
  }

  public async tables() {
    try {
      let t = this.db
        .prepare(`SELECT * FROM sqlite_master WHERE type='table'`)
        .all(); 
    } catch (error) {
      return { error: true, message: error };
    }
  }

  public async createTable(collection: string, fields: string[]) {
    try {
      this.db
        .prepare(
          `CREATE TABLE IF NOT EXISTS ${collection} (${fields.join(", ")})`
        )
        .run();
      return true;
    } catch (error) {
      return false;
    }
  }

  public flatten(collection: string) {
    // return an array of all the items in the collection 
    /**
     *  {items:[], totalPage: 0, totalItems: 0}
     */
    if(!this.tableExists(collection)) return
    let items = this.db.prepare(`SELECT * FROM ${collection}`).all()
    let flattened: any = []
    items.forEach((item: any) => {
        let data = JSON.parse(item.data)
        flattened.push(data)
    })
    
    
    return flattened
  }
  startExpirationCheck() {
    setInterval(async () => {
      const now = Date.now();
      await this.db.exec(`DELETE FROM cache WHERE  ttl < ${now}`);
    }, 60000); // Run every minute
  }
} 