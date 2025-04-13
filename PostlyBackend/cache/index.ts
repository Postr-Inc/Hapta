export default class Cache {
    type: 'FIFO' | 'LIFO';
    cacheStore: Map<string, any>;
    ttls: Map<string, number>;
    limit: number;

    constructor($: { type: 'FIFO' | 'LIFO', limit: number }) {
        this.type = $.type;
        this.cacheStore = new Map();
        this.ttls = new Map();
        this.limit = $.limit;
        setInterval(() => this.processTTLs(), 1000); // Run TTL expiration every second
    }

    processTTLs() {
        const now = Date.now();
        for (const [key, expiry] of this.ttls.entries()) {
            if (expiry <= now) {
                this.cacheStore.delete(key);
                this.ttls.delete(key);
            }
        }
    }

    insert(key: string, value: any, ttl: number) {
        if (this.cacheStore.has(key)) {
            this.cacheStore.set(key, value);
            this.ttls.set(key, Date.now() + ttl);
            return;
        }

        if (this.cacheStore.size >= this.limit) {
            this.evict();
        }

        this.cacheStore.set(key, value);
        this.ttls.set(key, Date.now() + ttl);
    }

    evict() {
        if (this.type === 'FIFO') {
            const firstKey = this.cacheStore.keys().next().value;
            if (firstKey) {
                this.cacheStore.delete(firstKey);
                this.ttls.delete(firstKey);
            }
        } else if (this.type === 'LIFO') {
            const lastKey = Array.from(this.cacheStore.keys()).pop();
            if (lastKey) {
                this.cacheStore.delete(lastKey);
                this.ttls.delete(lastKey);
            }
        }
    }

    get(key: string) {
        if (!this.cacheStore.has(key)) return null;
        return this.cacheStore.get(key);
    }
}
