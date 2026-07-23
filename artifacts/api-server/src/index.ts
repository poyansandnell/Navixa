import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { createSocketServer } from "./realtime/socket";
import { startTimeoutSweep } from "./game/timeout";
import { seedDatabase } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main(): Promise<void> {
  // Dev-only: seed reference data (cosmetics, quests, etc.) before serving.
  if (process.env.NODE_ENV !== "production") {
    try {
      await seedDatabase();
      logger.info("database seeded (dev)");
    } catch (err) {
      logger.error({ err }, "seedDatabase failed");
    }
  }

  const httpServer = createServer(app);
  createSocketServer(httpServer);

  // Server-authoritative turn-timeout sweep (~1s).
  startTimeoutSweep();

  httpServer.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  httpServer.on("error", (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

void main();
