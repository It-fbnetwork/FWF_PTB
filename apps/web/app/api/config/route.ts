import { json } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return json({
    displayDurationMs: Number(process.env.DISPLAY_DURATION_MS ?? 8000),
    fadeMs: Number(process.env.DISPLAY_FADE_MS ?? 700),
    outputWidth: Number(process.env.FWF_OUTPUT_WIDTH ?? 1080),
    outputHeight: Number(process.env.FWF_OUTPUT_HEIGHT ?? 1920),
  });
}
