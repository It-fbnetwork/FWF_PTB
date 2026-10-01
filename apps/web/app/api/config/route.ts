import { json } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  return json({
    displayDurationMs: Number(process.env.DISPLAY_DURATION_MS ?? 8000),
    fadeMs: Number(process.env.DISPLAY_FADE_MS ?? 700),
    outputWidth: 900,
    outputHeight: 1600,
  });
}
