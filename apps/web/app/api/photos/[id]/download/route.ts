import { json, requireOperatorPin } from "@/lib/auth";
import { getPhotoById } from "@/lib/sessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function safeFilename(value: string): string {
  const cleaned = value.replace(/[\r\n"\\/]/g, "_").trim();
  return cleaned || "fwf-photo.jpg";
}

export async function GET(req: Request, ctx: Ctx) {
  const denied = requireOperatorPin(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const photo = await getPhotoById(id);
    if (!photo) return json({ error: "Photo not found" }, 404);

    const source = await fetch(photo.url, { cache: "no-store" });
    if (!source.ok) return json({ error: "Photo storage is unavailable" }, 502);

    const filename = safeFilename(photo.processedFilename);
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_");
    return new Response(source.body, {
      headers: {
        "Content-Type": source.headers.get("content-type") ?? "image/jpeg",
        "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
