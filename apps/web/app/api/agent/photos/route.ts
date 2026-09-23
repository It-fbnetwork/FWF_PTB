import { json, requireAgentToken } from "@/lib/auth";
import { attachUploadedPhoto } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireAgentToken(req);
  if (denied) return denied;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const originalFilename = String(form.get("originalFilename") ?? "capture.jpg");
    const processedFilename = String(form.get("processedFilename") ?? "capture_final.jpg");

    if (!(file instanceof File)) {
      return json({ error: "file is required" }, 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await attachUploadedPhoto({
      originalFilename,
      processedFilename,
      bytes,
      contentType: file.type || "image/jpeg",
    });

    return json(result, 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
}
