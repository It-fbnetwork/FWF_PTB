import { access, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import sharp from "sharp";
import { config } from "./config.js";
import { generateDefaultFramePng } from "./default-frame.js";
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
