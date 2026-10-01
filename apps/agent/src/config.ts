import { homedir } from "node:os";
import { join } from "node:path";

const dataDir = process.env.FWF_DATA_DIR ?? join(homedir(), "FWF_PhotoBooth");
const frameOutputWidth = 900;
const frameOutputHeight = 1600;

export const config = {
  apiUrl: (process.env.FWF_API_URL ?? "https://ptb.facewashfox.com").replace(/\/$/, ""),
  agentToken: process.env.FWF_AGENT_TOKEN ?? process.env.AGENT_TOKEN ?? "",
  watchDir: process.env.FWF_WATCH_DIR ?? join(homedir(), "Pictures"),
  dataDir,
  incomingDir: join(dataDir, "incoming"),
  processedDir: join(dataDir, "processed"),
  failedDir: join(dataDir, "failed"),
  framesDir: join(dataDir, "frames"),
  logsDir: join(dataDir, "logs"),
  framePath: join(dataDir, "frames", "default.png"),
  // Supplied artwork is 4500×8000 (9:16). Keep output locked to the same ratio.
  outputWidth: frameOutputWidth,
  outputHeight: frameOutputHeight,
  photoFit: process.env.FWF_PHOTO_FIT === "contain" ? "contain" : "cover",
  jpegQuality: Number(process.env.FWF_JPEG_QUALITY ?? 90),
  transferPollMs: Number(process.env.FWF_TRANSFER_POLL_MS ?? 300),
  transferStableChecks: Number(process.env.FWF_TRANSFER_STABLE_CHECKS ?? 3),
  transferTimeoutMs: Number(process.env.FWF_TRANSFER_TIMEOUT_MS ?? 60_000),
  /** Local LED page (offline-capable). Default 3020 avoids Next.js on 3010. */
  displayHost: process.env.FWF_DISPLAY_HOST ?? "0.0.0.0",
  displayPort: Number(process.env.FWF_DISPLAY_PORT ?? 3020),
  displayDurationMs: Number(process.env.FWF_DISPLAY_DURATION_MS ?? 8000),
  displayFadeMs: Number(process.env.FWF_DISPLAY_FADE_MS ?? 700),
  localDisplay: (process.env.FWF_LOCAL_DISPLAY ?? "1") !== "0",
  jpegExtensions: [".jpg", ".jpeg", ".JPG", ".JPEG"] as const,
} as const;

export type Config = typeof config;
