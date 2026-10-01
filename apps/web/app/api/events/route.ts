import { listRecentPhotosSince } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return new Response("code is required", { status: 400 });
  }

  const encoder = new TextEncoder();
  let since = new Date(Date.now() - 5_000).toISOString();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const enqueue = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };

      enqueue(encodeEvent("connected", { ok: true }));

      const sendPhotos = async () => {
        try {
          const photos = await listRecentPhotosSince(since);
          for (const photo of photos) {
            if (photo.createdAt > since) since = photo.createdAt;
            if (photo.sessionCode !== code) continue;
            enqueue(
              encodeEvent("photo_ready", {
                type: "photo_ready",
                filename: photo.filename,
                url: photo.url,
                sessionCode: photo.sessionCode,
                sessionName: photo.sessionName,
                createdAt: photo.createdAt,
              }),
            );
          }
        } catch {
          // Poll fallback in session.js will keep the page fresh.
        }
      };

      void sendPhotos();
      const interval = setInterval(() => {
        void sendPhotos();
      }, 1000);
      const heartbeat = setInterval(() => {
        enqueue(`: ping ${Date.now()}\n\n`);
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
