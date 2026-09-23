import { access, stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { config } from "./config.js";
import { ensureLocalFolders } from "./ensure-dirs.js";
import { ensureDefaultFrame } from "./ensure-frame.js";
import { agentEvents } from "./events.js";
import { isJpeg } from "./jpeg.js";
import { log } from "./logger.js";
import { processPhotoSafely } from "./processor.js";
import { mediaUrlForProcessedFile, startDisplayServer } from "./server.js";
import { attachPhotoToActiveSession, getActiveSession, loadSessions } from "./sessions.js";
import { waitUntilFileComplete } from "./wait-for-file.js";
import { startWatcher } from "./watcher.js";

function publishReady(outputPath: string, originalFilename: string): void {
  const url = mediaUrlForProcessedFile(outputPath);
  const processedFilename = basename(outputPath);
  const attachment = attachPhotoToActiveSession({
    originalFilename,
    processedFilename,
    url,
  });

  if (attachment.assigned && attachment.session) {
    log.success(
      `Associated ${processedFilename} → ${attachment.session.code} (${attachment.session.name})`,
    );
  } else {
    log.warn("No active session. Photo saved as unassigned (still shown on display).");
  }

  const event = agentEvents.emitPhotoReady({
    filename: processedFilename,
    url,
    sessionCode: attachment.session?.code ?? null,
    sessionName: attachment.session?.name ?? null,
  });
  log.success(`Display queued: ${event.filename}`);
}

async function handleNewPhoto(filePath: string): Promise<boolean> {
  const name = basename(filePath);

  log.blank();
  log.info(`New photo detected:\n${name}`);

  const active = getActiveSession();
  if (active) {
    log.info(`Active session: ${active.code} — ${active.name}`);
  } else {
    log.warn("No active session selected in operator dashboard.");
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
  if (result) {
    publishReady(result.outputPath, name);
    log.success("DONE");
  }
  log.blank();
  log.info("Waiting for new photo...");
  return true;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

async function processOnce(inputPath: string): Promise<void> {
  const filePath = resolve(inputPath);

  await access(filePath);
  if (!isJpeg(filePath)) {
    throw new Error(`Not a JPEG: ${filePath}`);
  }

  const { size } = await stat(filePath);
  log.info(`Processing existing file:\n${basename(filePath)} (${formatBytes(size)})`);
  const result = await processPhotoSafely(filePath);
  if (!result) {
    process.exitCode = 1;
  } else {
    publishReady(result.outputPath, basename(filePath));
    log.success("DONE");
  }
}

async function main(): Promise<void> {
  await ensureLocalFolders();
  await ensureDefaultFrame();
  await loadSessions();

  log.banner("FWF Camera Agent started");

  const onceIndex = process.argv.indexOf("--once");
  if (onceIndex !== -1) {
    const input = process.argv[onceIndex + 1];
    if (!input) {
      throw new Error("Usage: npm run process -- /path/to/photo.jpg");
    }
    await processOnce(input);
    return;
  }

  try {
    await access(config.watchDir);
  } catch {
    throw new Error(`Watch folder does not exist: ${config.watchDir}`);
  }

  await startDisplayServer();
  log.info(`JPEG files that already exist in the watch folder will be ignored.`);
  startWatcher(handleNewPhoto);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
