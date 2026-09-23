import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { agentEvents, type PhotoReadyEvent, type SessionBusEvent } from "./events.js";
import { log } from "./logger.js";
import {
  cancelSession,
  completeSession,
  createSession,
  getOperatorSnapshot,
  getSessionByCode,
  prepareSession,
} from "./sessions.js";

const publicDir = resolve(fileURLToPath(new URL("../public", import.meta.url)));

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res: ServerResponse, status: number, body: string | Buffer, contentType: string): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  send(res, status, JSON.stringify(data), "application/json; charset=utf-8");
}

function isPathInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !normalize(rel).startsWith(`..${sep}`));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readBody(req);
  if (!raw.trim()) return {} as T;
  return JSON.parse(raw) as T;
}

async function serveFile(res: ServerResponse, filePath: string): Promise<void> {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    send(res, 404, "Not found", "text/plain; charset=utf-8");
    return;
  }

  const type = mimeTypes[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": type.startsWith("image/") ? "public, max-age=60" : "no-store",
  });
  createReadStream(filePath).pipe(res);
}

async function serveHtml(res: ServerResponse, filename: string): Promise<void> {
  const html = await readFile(join(publicDir, filename), "utf8");
  send(res, 200, html, "text/html; charset=utf-8");
}

function handleSse(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (typeof (res as ServerResponse & { flushHeaders?: () => void }).flushHeaders === "function") {
    (res as ServerResponse & { flushHeaders: () => void }).flushHeaders();
  }
  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const offPhoto = agentEvents.onPhotoReady((event: PhotoReadyEvent) => {
    res.write(`event: photo_ready\ndata: ${JSON.stringify(event)}\n\n`);
  });
  const offSession = agentEvents.onSessionEvent((event: SessionBusEvent) => {
    res.write(`event: session_event\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 15_000);

  const cleanup = (): void => {
    clearInterval(heartbeat);
    offPhoto();
    offSession();
  };

  req.on("close", cleanup);
  req.on("error", cleanup);
}

async function handleApi(req: IncomingMessage, res: ServerResponse, path: string): Promise<boolean> {
  if (req.method === "GET" && path === "/api/events") {
    handleSse(req, res);
    return true;
  }

  if (req.method === "GET" && path === "/api/config") {
    sendJson(res, 200, {
      displayDurationMs: config.displayDurationMs,
      fadeMs: config.displayFadeMs,
      outputWidth: config.outputWidth,
      outputHeight: config.outputHeight,
    });
    return true;
  }

  if (req.method === "GET" && path === "/api/sessions") {
    sendJson(res, 200, getOperatorSnapshot());
    return true;
  }

  if (req.method === "POST" && path === "/api/sessions") {
    try {
      const body = await readJsonBody<{ name?: string; phone?: string; consent?: boolean }>(req);
      const session = createSession({
        name: body.name ?? "",
        phone: body.phone ?? "",
        consent: Boolean(body.consent),
      });
      sendJson(res, 201, { session });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const sessionByCode = path.match(/^\/api\/sessions\/code\/([^/]+)$/);
  if (req.method === "GET" && sessionByCode) {
    const session = getSessionByCode(decodeURIComponent(sessionByCode[1]!));
    if (!session) {
      sendJson(res, 404, { error: "Session not found" });
      return true;
    }
    sendJson(res, 200, { session });
    return true;
  }

  const prepareMatch = path.match(/^\/api\/sessions\/([^/]+)\/prepare$/);
  if (req.method === "POST" && prepareMatch) {
    try {
      const session = prepareSession(prepareMatch[1]!);
      sendJson(res, 200, { session, activeSessionId: session.id });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const completeMatch = path.match(/^\/api\/sessions\/([^/]+)\/complete$/);
  if (req.method === "POST" && completeMatch) {
    try {
      const session = completeSession(completeMatch[1]!);
      sendJson(res, 200, { session });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  const cancelMatch = path.match(/^\/api\/sessions\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancelMatch) {
    try {
      const session = cancelSession(cancelMatch[1]!);
      sendJson(res, 200, { session });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return true;
  }

  return false;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const host = req.headers.host ?? `localhost:${config.displayPort}`;
  const url = new URL(req.url ?? "/", `http://${host}`);
  const path = url.pathname;

  if (await handleApi(req, res, path)) return;

  if (req.method === "GET" && (path === "/" || path === "/display")) {
    await serveHtml(res, "display.html");
    return;
  }

  if (req.method === "GET" && path === "/checkin") {
    await serveHtml(res, "checkin.html");
    return;
  }

  if (req.method === "GET" && path === "/operator") {
    await serveHtml(res, "operator.html");
    return;
  }

  const guestMatch = path.match(/^\/checkin\/([A-Za-z0-9]+)$/);
  if (req.method === "GET" && guestMatch) {
    await serveHtml(res, "session.html");
    return;
  }

  if (req.method === "GET" && path.startsWith("/media/")) {
    const filename = decodeURIComponent(path.slice("/media/".length));
    const filePath = resolve(join(config.processedDir, filename));
    if (!isPathInside(config.processedDir, filePath)) {
      send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }
    await serveFile(res, filePath);
    return;
  }

  if (req.method === "GET" && path.startsWith("/assets/")) {
    const assetName = decodeURIComponent(path.slice("/assets/".length));
    const filePath = resolve(join(publicDir, assetName));
    if (!isPathInside(publicDir, filePath)) {
      send(res, 403, "Forbidden", "text/plain; charset=utf-8");
      return;
    }
    await serveFile(res, filePath);
    return;
  }

  send(res, 404, "Not found", "text/plain; charset=utf-8");
}

export function startDisplayServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleRequest(req, res).catch((error) => {
        log.error(`HTTP error: ${error instanceof Error ? error.message : String(error)}`);
        if (!res.headersSent) {
          send(res, 500, "Internal Server Error", "text/plain; charset=utf-8");
        } else {
          res.end();
        }
      });
    });

    server.once("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${config.displayPort} is already in use. Stop the other process or set FWF_DISPLAY_PORT to another port.`,
          ),
        );
        return;
      }
      reject(error);
    });

    server.listen(config.displayPort, config.displayHost, () => {
      log.success(`Display ready:\nhttp://localhost:${config.displayPort}/display`);
      log.info(`Check-in: http://localhost:${config.displayPort}/checkin`);
      log.info(`Operator: http://localhost:${config.displayPort}/operator`);
      resolve();
    });
  });
}

export function mediaUrlForProcessedFile(outputPath: string): string {
  const filename = relative(config.processedDir, outputPath).split(sep).join("/");
  return `/media/${encodeURIComponent(filename)}`;
}
