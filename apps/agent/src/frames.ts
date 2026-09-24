import { join } from "node:path";
import { config } from "./config.js";

export const frameOptions = ["frame-1", "frame-2", "frame-3", "frame-4", "frame-5"] as const;

export type FrameId = (typeof frameOptions)[number];

export function normalizeFrameId(value: unknown): FrameId {
  return frameOptions.includes(value as FrameId) ? (value as FrameId) : "frame-1";
}

export function framePathForId(frameId: unknown): string {
  return join(config.framesDir, `${normalizeFrameId(frameId)}.png`);
}
