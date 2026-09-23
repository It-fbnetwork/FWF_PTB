import { json, requireOperatorPin } from "@/lib/auth";
import { completeSession } from "@/lib/sessions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const denied = requireOperatorPin(req);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const session = await completeSession(id);
    return json({ session });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}
