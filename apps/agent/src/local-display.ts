import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { log } from "./logger.js";

const publicDir = resolve(fileURLToPath(new URL("../public", import.meta.url)));

type LocalPhotoEvent = {
  filename: string;
  url: string;
  createdAt: string;
};

const listeners = new Set<(event: LocalPhotoEvent) => void>();
let lastEvent: LocalPhotoEvent | null = null;

export function broadcastLocalPhoto(event: LocalPhotoEvent): void {
  lastEvent = event;
  for (const listener of listeners) listener(event);
}

function send(res: ServerResponse, status: number, body: string | Buffer, type: string): void {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !normalize(rel).startsWith(`..${sep}`));
}

async function serveFile(res: ServerResponse, filePath: string): Promise<void> {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }
  const mime =
    extname(filePath).toLowerCase() === ".css"
      ? "text/css; charset=utf-8"
      : extname(filePath).toLowerCase() === ".js"
        ? "text/javascript; charset=utf-8"
        : extname(filePath).toLowerCase() === ".html"
          ? "text/html; charset=utf-8"
          : extname(filePath).toLowerCase() === ".png"
            ? "image/png"
            : "image/jpeg";
  res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-store" });
  createReadStream(filePath).pipe(res);
}

function handleSse(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
  if (lastEvent) {
    res.write(`event: photo_ready\ndata: ${JSON.stringify(lastEvent)}\n\n`);
  }
  const onEvent = (event: LocalPhotoEvent): void => {
    res.write(`event: photo_ready\ndata: ${JSON.stringify(event)}\n\n`);
  };
  listeners.add(onEvent);
  const heartbeat = setInterval(() => res.write(`: ping ${Date.now()}\n\n`), 15_000);
  const cleanup = (): void => {
    clearInterval(heartbeat);
    listeners.delete(onEvent);
  };
  req.on("close", cleanup);
  req.on("error", cleanup);
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? `localhost:${config.displayPort}`;
  const url = new URL(req.url ?? "/", `http://${host}`);
  const path = url.pathname;

  if (req.method === "GET" && (path === "/" || path === "/display")) {
    send(res, 200, await readFile(join(publicDir, "display.html"), "utf8"), "text/html; charset=utf-8");
    return;
  }
  if (req.method === "GET" && path === "/api/events") {
    handleSse(req, res);
    return;
  }
  if (req.method === "GET" && path === "/api/config") {
    send(
      res,
      200,
      JSON.stringify({
        displayDurationMs: config.displayDurationMs,
        fadeMs: config.displayFadeMs,
        outputWidth: config.outputWidth,
        outputHeight: config.outputHeight,
      }),
      "application/json; charset=utf-8",
    );
    return;
  }
  if (req.method === "GET" && path.startsWith("/media/")) {
    const name = decodeURIComponent(path.slice("/media/".length));
    const filePath = resolve(join(config.processedDir, name));
    if (!isInside(config.processedDir, filePath)) {
      send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }
    await serveFile(res, filePath);
    return;
  }
  if (req.method === "GET" && path.startsWith("/assets/")) {
    const name = decodeURIComponent(path.slice("/assets/".length));
    const filePath = resolve(join(publicDir, name));
    if (!isInside(publicDir, filePath)) {
      send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }
    await serveFile(res, filePath);
    return;
  }
  if (req.method === "GET" && path.startsWith("/vincom/")) {
    const name = decodeURIComponent(path.slice("/vincom/".length));
    const filePath = resolve(join(publicDir, "vincom", name));
    if (!isInside(join(publicDir, "vincom"), filePath)) {
      send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }
    await serveFile(res, filePath);
    return;
  }
  send(res, 404, "Not found", "text/plain; charset=utf-8");
}

export function startLocalDisplay(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handle(req, res).catch((error) => {
        log.error(`Local display HTTP error: ${error instanceof Error ? error.message : String(error)}`);
        if (!res.headersSent) send(res, 500, "Internal Server Error", "text/plain; charset=utf-8");
      });
    });
    server.once("error", reject);
    server.listen(config.displayPort, config.displayHost, () => {
      log.success(`Local LED display:\nhttp://localhost:${config.displayPort}/display`);
      resolve();
    });
  });
}

export function localMediaUrl(outputPath: string): string {
  return `/media/${encodeURIComponent(basename(outputPath))}`;
}
