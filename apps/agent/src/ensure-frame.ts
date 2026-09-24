import { access, copyFile, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { config } from "./config.js";
import { generateDefaultFramePng } from "./default-frame.js";
import { frameOptions } from "./frames.js";
import { log } from "./logger.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function frameMatchesOutputSize(path: string): Promise<boolean> {
  try {
    const meta = await sharp(path).metadata();
    return meta.width === config.outputWidth && meta.height === config.outputHeight;
  } catch {
    return false;
  }
}

export async function ensureDefaultFrame(): Promise<boolean> {
  await mkdir(config.framesDir, { recursive: true });

  const publicDir = fileURLToPath(new URL("../public", import.meta.url));
  for (const frameId of frameOptions) {
    const source = join(publicDir, "frames", `${frameId}.png`);
    const target = join(config.framesDir, `${frameId}.png`);
    if (await exists(source)) {
      await copyFile(source, target);
    }
  }

  const hasFrame = await exists(config.framePath);
  const sizeOk = hasFrame ? await frameMatchesOutputSize(config.framePath) : false;

  if (hasFrame && sizeOk) {
    return true;
  }

  const png = await generateDefaultFramePng();
  await writeFile(config.framePath, png);

  if (!hasFrame) {
    log.warn(`No frame found. Created a default FWF frame at: ${config.framePath}`);
  } else {
    log.warn(
      `Frame size updated to ${config.outputWidth}×${config.outputHeight} at: ${config.framePath}`,
    );
  }
  log.info("Replace this PNG with your branded overlay anytime (transparent PNG).");
  return true;
}
