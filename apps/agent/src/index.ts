import { access, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fetchActiveSession, pingCloud, uploadProcessedPhoto } from "./cloud.js";
import { config } from "./config.js";
import { ensureLocalFolders } from "./ensure-dirs.js";
import { ensureDefaultFrame } from "./ensure-frame.js";
import { isJpeg } from "./jpeg.js";
import { log } from "./logger.js";
import { processPhotoSafely } from "./processor.js";
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
  log.blank();
  log.info(`New photo detected:\n${name}`);

  try {
    const active = await fetchActiveSession();
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

  const result = await processPhotoSafely(filePath);
  if (!result) return true;

  try {
    const uploaded = await uploadProcessedPhoto({
      filePath: result.outputPath,
      originalFilename: name,
      processedFilename: basename(result.outputPath),
    });
    if (uploaded.assigned && uploaded.sessionCode) {
      log.success(`Uploaded + linked → ${uploaded.sessionCode}`);
    } else {
      log.warn("Uploaded as unassigned (still shown on LED when polled).");
    }
    if (uploaded.url) log.info(`Public URL:\n${uploaded.url}`);
    log.success("DONE");
  } catch (error) {
    log.error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }

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
  const uploaded = await uploadProcessedPhoto({
    filePath: result.outputPath,
    originalFilename: basename(filePath),
    processedFilename: basename(result.outputPath),
  });
  log.success(uploaded.assigned ? `Linked → ${uploaded.sessionCode}` : "Uploaded unassigned");
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
  await pingCloud();

  log.banner("FWF Camera Agent (cloud) started");

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

  log.info(`JPEG files that already exist in the watch folder will be ignored.`);
  startWatcher(handleNewPhoto);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
