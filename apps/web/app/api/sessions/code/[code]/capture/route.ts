import { json } from "@/lib/auth";
import { requestCapture } from "@/lib/capture-requests";

export const runtime = "nodejs";

export async function POST(_req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    return json({ request: await requestCapture(code) }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}
