import { json, requireAgentToken } from "@/lib/auth";
import { claimCaptureRequest } from "@/lib/capture-requests";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = requireAgentToken(req);
  if (denied) return denied;
  try {
    return json({ command: await claimCaptureRequest() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
