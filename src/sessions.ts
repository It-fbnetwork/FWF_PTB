import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { agentEvents } from "./events.js";
import { log } from "./logger.js";
import type { PhotoSession, SessionPhoto, SessionStatus, UnassignedPhoto } from "./types.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const storePath = join(config.dataDir, "sessions.json");

type StoreShape = {
  activeSessionId: string | null;
  sessions: PhotoSession[];
  unassigned: UnassignedPhoto[];
};

let store: StoreShape = {
  activeSessionId: null,
  sessions: [],
  unassigned: [],
};

let persistTimer: NodeJS.Timeout | null = null;

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    void persistNow();
  }, 200);
}

async function persistNow(): Promise<void> {
  try {
    await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
  } catch (error) {
    log.warn(`Could not persist sessions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function generateCode(): string {
  const existing = new Set(store.sessions.map((s) => s.code));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = "";
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i += 1) {
      code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    }
    if (!existing.has(code)) return code;
  }
  throw new Error("Could not generate unique session code");
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").trim();
}

function emitSession(type: string, session: PhotoSession): void {
  agentEvents.emitSessionEvent({ type, session });
}

export async function loadSessions(): Promise<void> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    store = {
      activeSessionId: parsed.activeSessionId ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      unassigned: Array.isArray(parsed.unassigned) ? parsed.unassigned : [],
    };
    log.info(`Loaded ${store.sessions.length} session(s) from disk.`);
  } catch {
    store = { activeSessionId: null, sessions: [], unassigned: [] };
  }
}

export function listSessions(): PhotoSession[] {
  return [...store.sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSessionById(id: string): PhotoSession | undefined {
  return store.sessions.find((s) => s.id === id);
}

export function getSessionByCode(code: string): PhotoSession | undefined {
  const needle = code.trim().toUpperCase();
  return store.sessions.find((s) => s.code === needle);
}

export function getActiveSession(): PhotoSession | null {
  if (!store.activeSessionId) return null;
  return getSessionById(store.activeSessionId) ?? null;
}

export function getUnassignedPhotos(): UnassignedPhoto[] {
  return [...store.unassigned].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createSession(input: {
  name: string;
  phone: string;
  consent: boolean;
}): PhotoSession {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);

  if (!name) throw new Error("Name is required");
  if (phone.length < 8) throw new Error("Phone number is invalid");
  if (!input.consent) throw new Error("Consent is required");

  const now = new Date().toISOString();
  const session: PhotoSession = {
    id: randomUUID(),
    code: generateCode(),
    name,
    phone,
    status: "WAITING",
    consentAt: now,
    createdAt: now,
    capturedAt: null,
    completedAt: null,
    selectedPhotoId: null,
    photos: [],
  };

  store.sessions.unshift(session);

  const previous = getActiveSession();
  if (previous && previous.id !== session.id) {
    if (previous.status === "READY" || previous.status === "SELECTED") {
      previous.status = previous.photos.length > 0 ? "READY_TO_DISPLAY" : "WAITING";
      emitSession("SESSION_UPDATED", previous);
    }
  }

  // Newest check-in becomes the active guest so the next shutter
  // attaches to them without an extra operator click.
  session.status = "READY";
  store.activeSessionId = session.id;
  schedulePersist();
  emitSession("SESSION_CREATED", session);
  emitSession("SESSION_SELECTED", session);
  log.info(`Session created: ${session.code} — ${session.name}`);
  log.success(`Active session: ${session.code} — ${session.name}`);
  return session;
}

export function prepareSession(sessionId: string): PhotoSession {
  const session = getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  if (session.status === "CANCELLED" || session.status === "COMPLETED") {
    throw new Error(`Cannot prepare session in status ${session.status}`);
  }

  const previous = getActiveSession();
  if (previous && previous.id !== session.id) {
    if (previous.status === "READY" || previous.status === "SELECTED") {
      previous.status = previous.photos.length > 0 ? "READY_TO_DISPLAY" : "WAITING";
      emitSession("SESSION_UPDATED", previous);
    }
  }

  session.status = "READY";
  store.activeSessionId = session.id;
  schedulePersist();
  emitSession("SESSION_SELECTED", session);
  log.success(`Active session: ${session.code} — ${session.name}`);
  return session;
}

export function completeSession(sessionId: string): PhotoSession {
  const session = getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  session.status = "COMPLETED";
  session.completedAt = new Date().toISOString();
  if (store.activeSessionId === session.id) {
    store.activeSessionId = null;
  }
  schedulePersist();
  emitSession("SESSION_COMPLETED", session);
  return session;
}

export function cancelSession(sessionId: string): PhotoSession {
  const session = getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  session.status = "CANCELLED";
  if (store.activeSessionId === session.id) {
    store.activeSessionId = null;
  }
  schedulePersist();
  emitSession("SESSION_UPDATED", session);
  return session;
}

export function attachPhotoToActiveSession(input: {
  originalFilename: string;
  processedFilename: string;
  url: string;
}): { session: PhotoSession | null; photo: SessionPhoto | UnassignedPhoto; assigned: boolean } {
  const now = new Date().toISOString();
  const photoBase = {
    id: randomUUID(),
    originalFilename: input.originalFilename,
    processedFilename: input.processedFilename,
    url: input.url,
    createdAt: now,
  };

  const active = getActiveSession();
  if (!active) {
    const unassigned: UnassignedPhoto = photoBase;
    store.unassigned.unshift(unassigned);
    schedulePersist();
    agentEvents.emitSessionEvent({ type: "PHOTO_UNASSIGNED", photo: unassigned });
    return { session: null, photo: unassigned, assigned: false };
  }

  active.status = "PROCESSING";
  emitSession("PHOTO_PROCESSING", active);

  const photo: SessionPhoto = photoBase;
  active.photos.push(photo);
  active.selectedPhotoId = photo.id;
  active.capturedAt = active.capturedAt ?? now;
  active.status = "READY_TO_DISPLAY";

  // Release active slot so the next shutter cannot attach to the wrong guest.
  // Operator must press PREPARE again for a retake or the next customer.
  if (store.activeSessionId === active.id) {
    store.activeSessionId = null;
  }

  schedulePersist();
  emitSession("PHOTO_READY", active);
  return { session: active, photo, assigned: true };
}

export function setSessionStatus(sessionId: string, status: SessionStatus): PhotoSession | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  session.status = status;
  schedulePersist();
  emitSession("SESSION_UPDATED", session);
  return session;
}

export function getOperatorSnapshot() {
  return {
    activeSessionId: store.activeSessionId,
    activeSession: getActiveSession(),
    sessions: listSessions(),
    unassigned: getUnassignedPhotos(),
  };
}
