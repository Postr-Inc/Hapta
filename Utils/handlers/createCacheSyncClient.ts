import config from "../../config";
import CacheController from "../Core/CacheManager";
export function createCacheSyncClient(cacheController: CacheController, wsUrl: string) {
  let ws: WebSocket | null = null;
  let reconnectDelay = 1000; // start with 1s
  const maxDelay = 10000;     // cap the delay to 10s

  const connect = () => {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[CacheSync] Connected to cache-sync server");
      reconnectDelay = 1000; // reset on successful connection
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
         

        if (!msg || !msg.action) return;
        if (msg.source === config.Server.NodeId) return; 
        console.log(msg)
        switch (msg.action) {
          case "set":
            cacheController.set(msg.key, msg.data, msg.expiresAt, true);
            break;
          case "delete":
            cacheController.delete(msg.key);
            break;
          case "invalidate":
            cacheController.invalidateCacheByNormalizedKeys([msg.key], true);
            break;
        }
      } catch (err) {
        console.error("[CacheSync] Failed to process message:", err);
      }
    };

    ws.onclose = () => {
      console.warn("[CacheSync] Connection closed, retrying...");
      retryConnect();
    };

    ws.onerror = (err) => {
      console.error("[CacheSync] Connection error:", err);
      // Let the onclose handle reconnecting
    };
  };

  const retryConnect = () => {
    setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
      connect();
    }, reconnectDelay);
  };

  connect();

  return {
    getSocket: () => ws,
    close: () => ws?.close(),
  };
}
