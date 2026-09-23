import { homedir } from "node:os";
import { join } from "node:path";

const dataDir = process.env.FWF_DATA_DIR ?? join(homedir(), "FWF_PhotoBooth");

export const config = {
  apiUrl: (process.env.FWF_API_URL ?? "http://localhost:3010").replace(/\/$/, ""),
  agentToken: process.env.FWF_AGENT_TOKEN ?? "",
  watchDir: process.env.FWF_WATCH_DIR ?? join(homedir(), "Pictures"),
  dataDir,
  incomingDir: join(dataDir, "incoming"),
  processedDir: join(dataDir, "processed"),
  failedDir: join(dataDir, "failed"),
  framesDir: join(dataDir, "frames"),
  logsDir: join(dataDir, "logs"),
  framePath: join(dataDir, "frames", "default.png"),
  outputWidth: Number(process.env.FWF_OUTPUT_WIDTH ?? 960),
  outputHeight: Number(process.env.FWF_OUTPUT_HEIGHT ?? 1280),
  jpegQuality: Number(process.env.FWF_JPEG_QUALITY ?? 90),
  transferPollMs: Number(process.env.FWF_TRANSFER_POLL_MS ?? 300),
  transferStableChecks: Number(process.env.FWF_TRANSFER_STABLE_CHECKS ?? 3),
  transferTimeoutMs: Number(process.env.FWF_TRANSFER_TIMEOUT_MS ?? 60_000),
  jpegExtensions: [".jpg", ".jpeg", ".JPG", ".JPEG"] as const,
} as const;

export type Config = typeof config;
