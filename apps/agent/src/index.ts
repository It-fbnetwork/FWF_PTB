import { access, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fetchActiveSession, pingCloud, type ActiveSession } from "./cloud.js";
import { config } from "./config.js";
import { ensureLocalFolders } from "./ensure-dirs.js";
import { ensureDefaultFrame } from "./ensure-frame.js";
import { isJpeg } from "./jpeg.js";
import { broadcastLocalPhoto, localMediaUrl, startLocalDisplay } from "./local-display.js";
import { log } from "./logger.js";
import { processPhotoSafely } from "./processor.js";
import { enqueueUpload, initUploadQueue } from "./upload-queue.js";
import { waitUntilFileComplete } from "./wait-for-file.js";
import { startWatcher } from "./watcher.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

async function handleNewPhoto(filePath: string): Promise<boolean> {
  const name = basename(filePath);
  let active: ActiveSession = null;
  log.blank();
  log.info(`New photo detected:\n${name}`);

  try {
    active = await fetchActiveSession();
    if (active) {
      log.info(`Active session: ${active.code} — ${active.name}`);
    } else {
      log.warn("No active session on cloud. Photo will upload as unassigned.");
    }
  } catch (error) {
    log.warn(`Could not fetch active session: ${error instanceof Error ? error.message : String(error)}`);
  }

  log.info("Waiting for transfer...");
  try {
    const size = await waitUntilFileComplete(filePath, {
      pollMs: config.transferPollMs,
      stableChecks: config.transferStableChecks,
      timeoutMs: config.transferTimeoutMs,
    });
    log.success(`Transfer complete. (${formatBytes(size)})`);
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error));
    log.info("Will retry if the file keeps changing.");
    return false;
  }

  const result = await processPhotoSafely(filePath, active?.selectedFrameId);
  if (!result) return true;

  // Local LED first (works offline).
  if (config.localDisplay) {
    const url = localMediaUrl(result.outputPath);
    broadcastLocalPhoto({
      filename: basename(result.outputPath),
      url,
      createdAt: new Date().toISOString(),
    });
    log.success(`Local display queued: ${basename(result.outputPath)}`);
  }

  // Cloud upload with retry queue.
  await enqueueUpload({
    filePath: result.outputPath,
    originalFilename: name,
    processedFilename: basename(result.outputPath),
  });

  log.success("DONE");
  log.blank();
  log.info("Waiting for new photo...");
  return true;
}

async function processOnce(inputPath: string): Promise<void> {
  const filePath = resolve(inputPath);
  await access(filePath);
  if (!isJpeg(filePath)) throw new Error(`Not a JPEG: ${filePath}`);
  const { size } = await stat(filePath);
  log.info(`Processing existing file:\n${basename(filePath)} (${formatBytes(size)})`);
  const result = await processPhotoSafely(filePath);
  if (!result) {
    process.exitCode = 1;
    return;
  }
  await enqueueUpload({
    filePath: result.outputPath,
    originalFilename: basename(filePath),
    processedFilename: basename(result.outputPath),
  });
}

async function main(): Promise<void> {
  if (!config.agentToken) {
    throw new Error("Set FWF_AGENT_TOKEN (same value as AGENT_TOKEN on Vercel).");
  }
  if (!config.apiUrl) {
    throw new Error("Set FWF_API_URL to your Vercel deployment URL.");
  }

  await ensureLocalFolders();
  await ensureDefaultFrame();
  await initUploadQueue();

  try {
    await pingCloud();
  } catch (error) {
    log.warn(`Cloud unreachable at start: ${error instanceof Error ? error.message : String(error)}`);
    log.info("Agent will keep processing locally and retry uploads.");
  }

  log.banner("FWF Camera Agent (Phase 4) started");

  const onceIndex = process.argv.indexOf("--once");
  if (onceIndex !== -1) {
    const input = process.argv[onceIndex + 1];
    if (!input) throw new Error("Usage: npm run agent -- --once /path/to/photo.jpg");
    await processOnce(input);
    return;
  }

  try {
    await access(config.watchDir);
  } catch {
    throw new Error(`Watch folder does not exist: ${config.watchDir}`);
  }

  if (config.localDisplay) {
    try {
      await startLocalDisplay();
    } catch (error) {
      log.warn(`Local display failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  log.info(`JPEG files that already exist in the watch folder will be ignored.`);
  log.info(`Cloud API: ${config.apiUrl}`);
  startWatcher(handleNewPhoto);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
