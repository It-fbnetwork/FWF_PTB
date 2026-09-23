import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { config } from "./config.js";
import { generateDefaultFramePng } from "./default-frame.js";
import { log } from "./logger.js";

async function main(): Promise<void> {
  await mkdir(dirname(config.framePath), { recursive: true });
  const png = await generateDefaultFramePng();
  await writeFile(config.framePath, png);
  log.success(`Wrote default frame: ${config.framePath}`);
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
