import { json, requireOperatorPin } from "@/lib/auth";
import { createSession, getOperatorSnapshot } from "@/lib/sessions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const denied = requireOperatorPin(req);
  if (denied) return denied;
  try {
    return json(await getOperatorSnapshot());
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      consent?: boolean;
      selectedFrameId?: string;
    };
    const session = await createSession({
      name: body.name ?? "",
      phone: body.phone ?? "",
      consent: Boolean(body.consent),
      selectedFrameId: body.selectedFrameId,
    });
    return json({ session }, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}
