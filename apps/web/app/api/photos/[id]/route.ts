import { json, requireOperatorPin } from "@/lib/auth";
import { deletePhotoById } from "@/lib/sessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const denied = requireOperatorPin(req);
  if (denied) return denied;

  try {
    const { id } = await ctx.params;
    const deleted = await deletePhotoById(id);
    if (!deleted) return json({ error: "Photo not found" }, 404);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
