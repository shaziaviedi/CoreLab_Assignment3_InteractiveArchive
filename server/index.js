import { createMemorialServer } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const { httpServer, io } = createMemorialServer(config);

httpServer.on("error", (error) => {
  console.error("Memorial server failed:", error.message);
  process.exitCode = 1;
});
httpServer.listen(config.port, "0.0.0.0", () => {
  console.log(`ELSEWHERE memorial server listening on port ${config.port}`);
});

// Closing Socket.io also closes its attached HTTP server.
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => io.close());
