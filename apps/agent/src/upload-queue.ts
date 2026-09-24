import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { uploadProcessedPhoto } from "./cloud.js";
import { config } from "./config.js";
import { log } from "./logger.js";

type QueueItem = {
  id: string;
  filePath: string;
  originalFilename: string;
  processedFilename: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
};

const queuePath = join(config.dataDir, "upload-queue.json");
const MAX_ATTEMPTS = 12;
const RETRY_MS = 15_000;

let queue: QueueItem[] = [];
let flushing = false;
let timer: NodeJS.Timeout | null = null;

async function loadQueue(): Promise<void> {
  try {
    const raw = await readFile(queuePath, "utf8");
    const parsed = JSON.parse(raw) as QueueItem[];
    queue = Array.isArray(parsed) ? parsed : [];
  } catch {
    queue = [];
  }
}

async function saveQueue(): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(queuePath, JSON.stringify(queue, null, 2), "utf8");
}

async function flushOnce(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const item = queue[0]!;
      try {
        const uploaded = await uploadProcessedPhoto({
          filePath: item.filePath,
          originalFilename: item.originalFilename,
          processedFilename: item.processedFilename,
        });
        queue.shift();
        await saveQueue();
        if (uploaded.assigned && uploaded.sessionCode) {
          log.success(`Upload OK → ${uploaded.sessionCode} (${item.processedFilename})`);
        } else {
          log.warn(`Upload OK (unassigned): ${item.processedFilename}`);
        }
        if (uploaded.url) log.info(`Public URL:\n${uploaded.url}`);
      } catch (error) {
        item.attempts += 1;
        item.lastError = error instanceof Error ? error.message : String(error);
        await saveQueue();
        log.warn(
          `Upload pending (${item.attempts}/${MAX_ATTEMPTS}): ${item.processedFilename} — ${item.lastError}`,
        );
        if (item.attempts >= MAX_ATTEMPTS) {
          queue.shift();
          await saveQueue();
          log.error(`Gave up uploading ${item.processedFilename}`);
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

export async function initUploadQueue(): Promise<void> {
  await loadQueue();
  if (queue.length > 0) {
    log.info(`Resume upload queue: ${queue.length} item(s).`);
  }
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void flushOnce();
  }, RETRY_MS);
  await flushOnce();
}

export async function enqueueUpload(input: {
  filePath: string;
  originalFilename: string;
  processedFilename: string;
}): Promise<void> {
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filePath: input.filePath,
    originalFilename: input.originalFilename,
    processedFilename: input.processedFilename,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  await saveQueue();
  await flushOnce();
}
