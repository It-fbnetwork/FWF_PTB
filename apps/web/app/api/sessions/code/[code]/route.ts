import { json } from "@/lib/auth";
import { getSessionByCode, updateSessionFrameByCode } from "@/lib/sessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { code } = await ctx.params;
    const session = await getSessionByCode(code);
    if (!session) return json({ error: "Session not found" }, 404);
    return json({ session });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { code } = await ctx.params;
    const body = (await req.json()) as { selectedFrameId?: string };
    const session = await updateSessionFrameByCode(code, body.selectedFrameId);
    return json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, message === "Session not found" ? 404 : 400);
  }
}
