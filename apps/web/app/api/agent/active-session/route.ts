import { json, requireAgentToken } from "@/lib/auth";
import { getActiveSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = requireAgentToken(req);
  if (denied) return denied;
  try {
    const session = await getActiveSession();
    return json({ activeSession: session });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
