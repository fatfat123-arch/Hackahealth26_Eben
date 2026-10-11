import { Server } from "node:http";

// Nitro 3's generated node-server entry does not retain the Server instance.
// Keep it alive explicitly so managed hosts do not see a clean, immediate exit.
const listen = Server.prototype.listen;

Server.prototype.listen = function (...args) {
  globalThis.__ehPassportServer = this;
  this.on("error", (error) => console.error("Node.js server error:", error));
  return listen.apply(this, args);
};

await import("../.output/server/index.mjs");
