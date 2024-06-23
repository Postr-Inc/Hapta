interface CacheEntry<T> {
  value: T;
  expires: number;
}

export default class CacheController<T> {
  private maxAge: number;
  private cacheStore: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private evictionPolicy: 'LRU' | 'FIFO';
  public keysQueue: string[];

  constructor(maxAge: number = 1000 * 60 * 60 * 24, maxSize: number = 100, evictionPolicy: 'LRU' | 'FIFO' = 'LRU') {
    this.maxAge = maxAge;
    this.cacheStore = new Map();
    this.maxSize = maxSize;
    this.evictionPolicy = evictionPolicy;
    this.keysQueue = [];
  }

  private evictIfNecessary() {
    if (this.cacheStore.size >= this.maxSize) {
      let keyToEvict;
      if (this.evictionPolicy === 'LRU') {
        keyToEvict = this.keysQueue.shift();
      } else {
        keyToEvict = this.keysQueue.pop();
      }
      if (keyToEvict) {
        this.cacheStore.delete(keyToEvict);
      }
    }
  }
  exists(key: string): boolean {
    return this.cacheStore.has(key);
  }

  set(key: string, value: T, maxAge: number = this.maxAge) {
    const expires = Date.now() + maxAge;
    this.evictIfNecessary();
    this.cacheStore.set(key, { value, expires });
    this.keysQueue.push(key);
    return { value, expires };
  }

  get(key: string): T | null {
    const cache = this.cacheStore.get(key);
    if (cache) {
      if (cache.expires > Date.now()) {
        return cache.value;
      } else {
        console.log('Cache expired');
        this.cacheStore.delete(key);
        const index = this.keysQueue.indexOf(key);
        if (index > -1) {
          this.keysQueue.splice(index, 1);
        }
      }
    }
    return null;
  }

  delete(key: string) {
    this.cacheStore.delete(key);
    const index = this.keysQueue.indexOf(key);
    if (index > -1) {
      this.keysQueue.splice(index, 1);
    } 
  }

  clear() {
    this.cacheStore.clear();
    this.keysQueue = [];
  }
  getKeys() {
    return Array.from(this.cacheStore.keys());
  }
}
