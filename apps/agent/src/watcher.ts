import { basename } from "node:path";
import chokidar, { type FSWatcher } from "chokidar";
import { config } from "./config.js";
import { isJpeg } from "./jpeg.js";
import { log } from "./logger.js";

export type NewPhotoHandler = (filePath: string) => Promise<boolean>;

function isIgnoredName(filePath: string): boolean {
  const name = basename(filePath);
  return name.startsWith(".") || name.startsWith("._");
}

export function startWatcher(onNewPhoto: NewPhotoHandler): FSWatcher {
  const inFlight = new Set<string>();
  const completed = new Map<string, number>();

  const watcher = chokidar.watch(config.watchDir, {
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    awaitWriteFinish: false,
    ignorePermissionErrors: true,
    ignored: (watchedPath) => isIgnoredName(watchedPath),
  });

  const enqueue = (filePath: string): void => {
    if (!isJpeg(filePath) || isIgnoredName(filePath)) {
      return;
    }

    if (inFlight.has(filePath)) {
      return;
    }

    inFlight.add(filePath);

    void (async () => {
      try {
        const done = await onNewPhoto(filePath);
        if (done) {
          completed.set(filePath, Date.now());
        }
      } catch (error) {
        log.error(
          `Unhandled error for ${basename(filePath)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        inFlight.delete(filePath);
      }
    })();
  };

  watcher.on("add", enqueue);
  watcher.on("change", (filePath) => {
    if (inFlight.has(filePath)) {
      return;
    }
    if (completed.has(filePath)) {
      return;
    }
    enqueue(filePath);
  });

  watcher.on("error", (error) => {
    log.error(`Watcher error: ${error instanceof Error ? error.message : String(error)}`);
  });

  watcher.on("ready", () => {
    log.success(`Watching:\n${config.watchDir}`);
    log.blank();
    log.info("Waiting for new photo...");
    log.blank();
  });

  return watcher;
}
