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
      this.db.prepare(`DELETE FROM ${collection} WHERE key='${key}'`).run();
      return true;
    } catch (error) {
      return false;
    }
  }
  public  getCache(collection: string, key: string) {
    try {
      this.db.prepare(`SELECT ttl FROM ${collection} WHERE key='${key}'`).get();

      this.db
        .prepare(
          `UPDATE ${collection} SET ttl = ${Date.now()} WHERE key='${key}'`
        )
        .run();

      return this.db
        .prepare(`SELECT data FROM ${collection} WHERE key='${key}'`)
        .get();
    } catch (error) {
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

  public async exists(collection: string, key: string) {
    try {
      this.db.prepare(`SELECT * FROM '${collection}' WHERE key='${key}'`).get();
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
        .prepare(`UPDATE ${collection} SET data = '${data}' WHERE key='${key}'`)
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
        this.db
          .query(
            `CREATE TABLE ${collection} (key TEXT, data TEXT, ttl INTEGER)`
          )
          .run();
      }
      this.db.run(
        `INSERT INTO ${collection} (key, data, ttl) VALUES ('${key}', '${data}', '${ttl}')`
      );
      this.removeExpired(collection)
    } catch (error) {
      console.log(error);
      return { error: true, message: error };
    }
  }

  public async tables() {
    try {
      let t = this.db
        .prepare(`SELECT * FROM sqlite_master WHERE type='table'`)
        .all();
        console.log(await t)
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
     // remove collections that expired
    public async removeExpired(collection: string) {
        try {
            this.db.prepare(`DELETE FROM ${collection} WHERE ttl < ${Date.now()}`).run()
            let timer = setTimeout(() => {
                this.removeExpired(collection)
            }, 20000) // run every 2 seconds
            return true
        } catch (error) {
            return false
        }
    }
}
 