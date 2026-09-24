import { homedir } from "node:os";
import { join } from "node:path";

const dataDir = process.env.FWF_DATA_DIR ?? join(homedir(), "FWF_PhotoBooth");

export const config = {
  watchDir: process.env.FWF_WATCH_DIR ?? "/Users/lehoanganh/Pictures",
  dataDir,
  incomingDir: join(dataDir, "incoming"),
  processedDir: join(dataDir, "processed"),
  failedDir: join(dataDir, "failed"),
  framesDir: join(dataDir, "frames"),
  logsDir: join(dataDir, "logs"),
  framePath: join(dataDir, "frames", "default.png"),
  // Portrait LED frame — 8:16 (1080 × 2160)
  outputWidth: Number(process.env.FWF_OUTPUT_WIDTH ?? 1080),
  outputHeight: Number(process.env.FWF_OUTPUT_HEIGHT ?? 2160),
  jpegQuality: Number(process.env.FWF_JPEG_QUALITY ?? 90),
  /** How often to re-check file size while the camera is still writing. */
  transferPollMs: Number(process.env.FWF_TRANSFER_POLL_MS ?? 300),
  /** Consecutive unchanged-size checks required before processing. */
  transferStableChecks: Number(process.env.FWF_TRANSFER_STABLE_CHECKS ?? 3),
  transferTimeoutMs: Number(process.env.FWF_TRANSFER_TIMEOUT_MS ?? 60_000),
  displayHost: process.env.FWF_DISPLAY_HOST ?? "0.0.0.0",
  displayPort: Number(process.env.FWF_DISPLAY_PORT ?? 3010),
  displayDurationMs: Number(process.env.FWF_DISPLAY_DURATION_MS ?? 8000),
  displayFadeMs: Number(process.env.FWF_DISPLAY_FADE_MS ?? 700),
  jpegExtensions: [".jpg", ".jpeg", ".JPG", ".JPEG"] as const,
} as const;

export type Config = typeof config;
