import { json } from "@/lib/auth";
import { listRecentFramePreviewsSince, listRecentPhotosSince } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const since =
      url.searchParams.get("since") ?? new Date(Date.now() - 60_000).toISOString();
    const [photos, framePreviews] = await Promise.all([
      listRecentPhotosSince(since),
      listRecentFramePreviewsSince(since),
    ]);
    return json({
      serverTime: new Date().toISOString(),
      framePreviews,
      photos: photos.map((p) => ({
        type: "photo_ready",
        filename: p.filename,
        url: p.url,
        sessionCode: p.sessionCode,
        sessionName: p.sessionName,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
