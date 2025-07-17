import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { WSContext } from "hono/ws";

const manager = new Hono();
const { upgradeWebSocket } = createBunWebSocket();
const clients = new Set<WSContext>();

export default () => {
  manager.get(
    "/",
    upgradeWebSocket((c) => {
      return {
        onOpen: (ev, ws) => {
          clients.add(ws);
          console.log("WebSocket connected, total clients:", clients.size);
        },
        async onMessage(event, ws) {
          const msg = event.data;
          for (const client of clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(msg as string);
            }
          }
        },
        onClose: (ev, ws) => {
          clients.delete(ws);
          console.log(`WebSocket closed: Code ${ev.code}, Reason: ${ev.reason}`);
        },
        onError: (err) => {
          console.error(`WebSocket Error:`, err);
        },
      };
    })
  );

  return manager;
};
