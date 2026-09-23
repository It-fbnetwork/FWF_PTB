import { access, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, extname, join } from "node:path";
import sharp from "sharp";
import { config } from "./config.js";
import { log } from "./logger.js";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export type ProcessResult = {
  outputPath: string;
  frameApplied: boolean;
};

function outputName(inputPath: string): string {
  const original = basename(inputPath, extname(inputPath));
  return `${original}_final.jpg`;
}

async function saveFailedCopy(inputPath: string): Promise<void> {
  const dest = join(config.failedDir, basename(inputPath));
  try {
    await copyFile(inputPath, dest);
    log.info(`Copied failed original to: ${dest}`);
  } catch (error) {
    log.warn(`Could not copy failed original: ${String(error)}`);
  }
}

export async function processPhoto(inputPath: string): Promise<ProcessResult> {
  const outputPath = join(config.processedDir, outputName(inputPath));
  let frameApplied = false;

  const photo = sharp(inputPath, { failOn: "none" })
    .rotate()
    .resize(config.outputWidth, config.outputHeight, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: false,
    });

  let pipeline = photo;
  const frameExists = await fileExists(config.framePath);

  if (frameExists) {
    const frameBuffer = await sharp(config.framePath)
      .resize(config.outputWidth, config.outputHeight, {
        fit: "fill",
      })
      .ensureAlpha()
      .png()
      .toBuffer();

    pipeline = photo.composite([
      {
        input: frameBuffer,
        gravity: "centre",
      },
    ]);
    frameApplied = true;
  } else {
    log.warn(`Frame not found at ${config.framePath}. Processing without frame.`);
  }

  await pipeline
    .jpeg({
      quality: config.jpegQuality,
      mozjpeg: true,
    })
    .toFile(outputPath);

  return { outputPath, frameApplied };
}

export async function processPhotoSafely(inputPath: string): Promise<ProcessResult | null> {
  try {
    log.info("Processing...");
    const result = await processPhoto(inputPath);
    if (result.frameApplied) {
      log.success("Frame applied.");
    } else {
      log.warn("Processed without frame.");
    }
    log.success(`Output saved: ${result.outputPath}`);
    return result;
  } catch (error) {
    log.error(`Image processing failed: ${error instanceof Error ? error.message : String(error)}`);
    await saveFailedCopy(inputPath);
    return null;
  }
}
