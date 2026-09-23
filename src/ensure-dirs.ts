import { mkdir } from "node:fs/promises";
import { config } from "./config.js";

export async function ensureLocalFolders(): Promise<void> {
  await Promise.all(
    [
      config.incomingDir,
      config.processedDir,
      config.failedDir,
      config.framesDir,
      config.logsDir,
    ].map((dir) => mkdir(dir, { recursive: true })),
  );
}
