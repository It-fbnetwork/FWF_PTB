import { extname } from "node:path";
import { config } from "./config.js";

const jpegExtensions = new Set(
  config.jpegExtensions.map((ext) => ext.toLowerCase()),
);

export function isJpeg(filePath: string): boolean {
  return jpegExtensions.has(extname(filePath).toLowerCase());
}
