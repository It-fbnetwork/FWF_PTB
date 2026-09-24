import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import { log } from "./logger.js";

export type ActiveSession = {
  id: string;
  code: string;
  name: string;
  status: string;
  selectedFrameId?: string | null;
} | null;

async function agentFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!config.agentToken) {
    throw new Error("FWF_AGENT_TOKEN is required");
  }
  const headers = new Headers(init.headers);
  headers.set("x-agent-token", config.agentToken);
  return fetch(`${config.apiUrl}${path}`, { ...init, headers });
}

export async function fetchActiveSession(): Promise<ActiveSession> {
  const res = await agentFetch("/api/agent/active-session");
  const json = (await res.json()) as { activeSession?: ActiveSession; error?: string };
  if (!res.ok) throw new Error(json.error || `active-session failed (${res.status})`);
  return json.activeSession ?? null;
}

export async function uploadProcessedPhoto(input: {
  filePath: string;
  originalFilename: string;
  processedFilename: string;
}): Promise<{
  assigned: boolean;
  sessionCode: string | null;
  url: string;
}> {
  const bytes = await readFile(input.filePath);
  const form = new FormData();
  form.set("originalFilename", input.originalFilename);
  form.set("processedFilename", input.processedFilename);
  form.set(
    "file",
    new File([new Uint8Array(bytes)], input.processedFilename, { type: "image/jpeg" }),
  );

  const res = await agentFetch("/api/agent/photos", { method: "POST", body: form });
  const json = (await res.json()) as {
    error?: string;
    assigned?: boolean;
    session?: { code?: string } | null;
    photoReady?: { url?: string };
    photo?: { url?: string };
  };
  if (!res.ok) throw new Error(json.error || `upload failed (${res.status})`);

  return {
    assigned: Boolean(json.assigned),
    sessionCode: json.session?.code ?? null,
    url: json.photoReady?.url ?? json.photo?.url ?? "",
  };
}

export async function pingCloud(): Promise<void> {
  log.info(`Cloud API: ${config.apiUrl}`);
  const active = await fetchActiveSession();
  if (active) {
    log.success(`Active session on cloud: ${active.code} — ${active.name}`);
  } else {
    log.info("No active session on cloud yet.");
  }
}
