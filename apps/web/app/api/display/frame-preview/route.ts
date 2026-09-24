import { json } from "@/lib/auth";
import { recordFramePreview, recordFramePreviewClear } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: string; frameId?: string };
    if (body.action === "clear") {
      const preview = await recordFramePreviewClear();
      return json({ preview }, 201);
    }
    const preview = await recordFramePreview(body.frameId);
    return json({ preview }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}
