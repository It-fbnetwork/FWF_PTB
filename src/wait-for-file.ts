import { stat } from "node:fs/promises";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TransferTimeoutError extends Error {
  constructor(filePath: string, timeoutMs: number) {
    super(`File transfer timed out after ${timeoutMs}ms: ${filePath}`);
    this.name = "TransferTimeoutError";
  }
}

/**
 * Sony Imaging Edge may still be writing a 5–10 MB JPEG when the
 * filesystem first reports `add`. Wait until size is stable.
 */
export async function waitUntilFileComplete(
  filePath: string,
  options: {
    pollMs: number;
    stableChecks: number;
    timeoutMs: number;
  },
): Promise<number> {
  let lastSize = -1;
  let stableCount = 0;
  const startedAt = Date.now();

  while (Date.now() - startedAt < options.timeoutMs) {
    const { size } = await stat(filePath);

    if (size > 0 && size === lastSize) {
      stableCount += 1;
      if (stableCount >= options.stableChecks) {
        return size;
      }
    } else {
      stableCount = 0;
      lastSize = size;
    }

    await sleep(options.pollMs);
  }

  throw new TransferTimeoutError(filePath, options.timeoutMs);
}
