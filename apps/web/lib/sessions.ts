import { randomBytes, randomUUID } from "node:crypto";
import { query, queryOne } from "./db";
import { uploadPhotoObject } from "./r2";
import type { PhotoSession, SessionPhoto, SessionStatus, UnassignedPhoto } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FRAME_OPTIONS = new Set(["frame-1", "frame-2", "frame-3", "frame-4", "frame-5"]);
const CLEAR_FRAME_PREVIEW_ID = "__clear__";

type SessionRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  status: SessionStatus;
  consent_at: string;
  created_at: string;
  captured_at: string | null;
  completed_at: string | null;
  selected_photo_id: string | null;
  selected_frame_id: string;
};

type PhotoRow = {
  id: string;
  session_id: string | null;
  original_filename: string;
  processed_filename: string;
  storage_path: string;
  public_url: string;
  created_at: string;
};

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").trim();
}

function normalizeFrameId(value: unknown): string {
  return FRAME_OPTIONS.has(String(value)) ? String(value) : "frame-1";
}

function generateCode(): string {
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function normalizeSessionRow(row: SessionRow): SessionRow {
  return {
    ...row,
    consent_at: iso(row.consent_at)!,
    created_at: iso(row.created_at)!,
    captured_at: iso(row.captured_at),
    completed_at: iso(row.completed_at),
  };
}

function normalizePhotoRow(row: PhotoRow): PhotoRow {
  return {
    ...row,
    created_at: iso(row.created_at)!,
  };
}

function mapPhoto(row: PhotoRow): SessionPhoto {
  const n = normalizePhotoRow(row);
  return {
    id: n.id,
    originalFilename: n.original_filename,
    processedFilename: n.processed_filename,
    url: n.public_url,
    createdAt: n.created_at,
  };
}

async function loadPhotosForSessions(sessionIds: string[]): Promise<Map<string, SessionPhoto[]>> {
  const map = new Map<string, SessionPhoto[]>();
  if (sessionIds.length === 0) return map;

  const rows = await query<PhotoRow>(
    `select * from photos
     where session_id = any($1::uuid[])
     order by created_at asc`,
    [sessionIds],
  );

  for (const row of rows) {
    if (!row.session_id) continue;
    const list = map.get(row.session_id) ?? [];
    list.push(mapPhoto(row));
    map.set(row.session_id, list);
  }
  return map;
}

async function mapSession(row: SessionRow, photos?: SessionPhoto[]): Promise<PhotoSession> {
  const n = normalizeSessionRow(row);
  let sessionPhotos = photos;
  if (!sessionPhotos) {
    const loaded = await loadPhotosForSessions([n.id]);
    sessionPhotos = loaded.get(n.id) ?? [];
  }
  return {
    id: n.id,
    code: n.code,
    name: n.name,
    phone: n.phone,
    status: n.status,
    selectedFrameId: normalizeFrameId(n.selected_frame_id),
    consentAt: n.consent_at,
    createdAt: n.created_at,
    capturedAt: n.captured_at,
    completedAt: n.completed_at,
    selectedPhotoId: n.selected_photo_id,
    photos: sessionPhotos,
  };
}

async function getActiveSessionId(): Promise<string | null> {
  const row = await queryOne<{ active_session_id: string | null }>(
    `select active_session_id from booth_state where id = 1`,
  );
  return row?.active_session_id ?? null;
}

async function setActiveSessionId(sessionId: string | null): Promise<void> {
  await query(
    `insert into booth_state (id, active_session_id, updated_at)
     values (1, $1, now())
     on conflict (id) do update
       set active_session_id = excluded.active_session_id,
           updated_at = excluded.updated_at`,
    [sessionId],
  );
}

export async function listSessions(): Promise<PhotoSession[]> {
  const rows = await query<SessionRow>(
    `select * from sessions order by created_at desc limit 100`,
  );
  const photos = await loadPhotosForSessions(rows.map((r) => r.id));
  return Promise.all(rows.map((row) => mapSession(row, photos.get(row.id) ?? [])));
}

export async function getSessionById(id: string): Promise<PhotoSession | null> {
  const row = await queryOne<SessionRow>(`select * from sessions where id = $1`, [id]);
  if (!row) return null;
  return mapSession(row);
}

export async function getSessionByCode(code: string): Promise<PhotoSession | null> {
  const needle = code.trim().toUpperCase();
  const row = await queryOne<SessionRow>(`select * from sessions where code = $1`, [needle]);
  if (!row) return null;
  return mapSession(row);
}

export async function updateSessionFrameByCode(
  code: string,
  selectedFrameIdInput: unknown,
): Promise<PhotoSession> {
  const selectedFrameId = normalizeFrameId(selectedFrameIdInput);
  const row = await queryOne<SessionRow>(
    `update sessions
     set selected_frame_id = $2
     where code = $1
     returning *`,
    [code.trim().toUpperCase(), selectedFrameId],
  );
  if (!row) throw new Error("Session not found");
  return mapSession(row);
}

export async function getActiveSession(): Promise<PhotoSession | null> {
  const activeId = await getActiveSessionId();
  if (!activeId) return null;
  return getSessionById(activeId);
}

export async function getUnassignedPhotos(): Promise<UnassignedPhoto[]> {
  const rows = await query<PhotoRow>(
    `select * from photos
     where session_id is null
     order by created_at desc
     limit 50`,
  );
  return rows.map((row) => {
    const photo = mapPhoto(row);
    return {
      id: photo.id,
      originalFilename: photo.originalFilename,
      processedFilename: photo.processedFilename,
      url: photo.url,
      createdAt: photo.createdAt,
    };
  });
}

export async function createSession(input: {
  name: string;
  phone: string;
  consent: boolean;
  selectedFrameId?: string;
}): Promise<PhotoSession> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  const selectedFrameId = normalizeFrameId(input.selectedFrameId);
  if (!name) throw new Error("Name is required");
  if (phone.length < 8) throw new Error("Phone number is invalid");
  if (!input.consent) throw new Error("Consent is required");

  const now = new Date().toISOString();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = randomUUID();
    const code = generateCode();
    try {
      const row = await queryOne<SessionRow>(
        `insert into sessions
           (id, code, name, phone, status, consent_at, created_at, selected_frame_id)
         values ($1, $2, $3, $4, 'READY', $5, $5, $6)
         returning *`,
        [id, code, name, phone, now, selectedFrameId],
      );
      if (!row) throw new Error("Insert session failed");

      const session = await mapSession(row, []);
      const previous = await getActiveSession();
      if (previous && previous.id !== session.id) {
        if (previous.status === "READY" || previous.status === "SELECTED") {
          await query(`update sessions set status = $2 where id = $1`, [
            previous.id,
            previous.photos.length > 0 ? "READY_TO_DISPLAY" : "WAITING",
          ]);
        }
      }

      await setActiveSessionId(session.id);
      return session;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!lastError.message.includes("sessions_code_key") && !lastError.message.includes("unique")) {
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Could not generate unique session code");
}

export async function prepareSession(sessionId: string): Promise<PhotoSession> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status === "CANCELLED" || session.status === "COMPLETED") {
    throw new Error(`Cannot prepare session in status ${session.status}`);
  }

  const previous = await getActiveSession();
  if (previous && previous.id !== session.id) {
    if (previous.status === "READY" || previous.status === "SELECTED") {
      await query(`update sessions set status = $2 where id = $1`, [
        previous.id,
        previous.photos.length > 0 ? "READY_TO_DISPLAY" : "WAITING",
      ]);
    }
  }

  await query(`update sessions set status = 'READY' where id = $1`, [session.id]);
  await setActiveSessionId(session.id);
  return (await getSessionById(session.id))!;
}

export async function completeSession(sessionId: string): Promise<PhotoSession> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  const now = new Date().toISOString();
  await query(`update sessions set status = 'COMPLETED', completed_at = $2 where id = $1`, [
    session.id,
    now,
  ]);

  const activeId = await getActiveSessionId();
  if (activeId === session.id) await setActiveSessionId(null);
  return (await getSessionById(session.id))!;
}

export async function cancelSession(sessionId: string): Promise<PhotoSession> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  await query(`update sessions set status = 'CANCELLED' where id = $1`, [session.id]);

  const activeId = await getActiveSessionId();
  if (activeId === session.id) await setActiveSessionId(null);
  return (await getSessionById(session.id))!;
}

export async function getOperatorSnapshot() {
  const [activeSessionId, activeSession, sessions, unassigned] = await Promise.all([
    getActiveSessionId(),
    getActiveSession(),
    listSessions(),
    getUnassignedPhotos(),
  ]);
  return { activeSessionId, activeSession, sessions, unassigned };
}

export async function attachUploadedPhoto(input: {
  originalFilename: string;
  processedFilename: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<{
  session: PhotoSession | null;
  photo: SessionPhoto | UnassignedPhoto;
  assigned: boolean;
  photoReady: {
    filename: string;
    url: string;
    sessionCode: string | null;
    sessionName: string | null;
    createdAt: string;
  };
}> {
  const photoId = randomUUID();
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${photoId}_${input.processedFilename}`;
  const uploaded = await uploadPhotoObject({
    key: storagePath,
    bytes: input.bytes,
    contentType: input.contentType ?? "image/jpeg",
  });

  const now = new Date().toISOString();
  const active = await getActiveSession();

  const photoRow = await queryOne<PhotoRow>(
    `insert into photos
       (id, session_id, original_filename, processed_filename, storage_path, public_url, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      photoId,
      active?.id ?? null,
      input.originalFilename,
      input.processedFilename,
      uploaded.key,
      uploaded.publicUrl,
      now,
    ],
  );
  if (!photoRow) throw new Error("Insert photo failed");
  const photo = mapPhoto(photoRow);

  if (!active) {
    return {
      session: null,
      photo,
      assigned: false,
      photoReady: {
        filename: photo.processedFilename,
        url: photo.url,
        sessionCode: null,
        sessionName: null,
        createdAt: photo.createdAt,
      },
    };
  }

  await query(
    `update sessions
     set status = 'READY_TO_DISPLAY',
         selected_photo_id = $2,
         captured_at = coalesce(captured_at, $3)
     where id = $1`,
    [active.id, photo.id, now],
  );
  await setActiveSessionId(null);
  const updated = await getSessionById(active.id);

  return {
    session: updated,
    photo,
    assigned: true,
    photoReady: {
      filename: photo.processedFilename,
      url: photo.url,
      sessionCode: updated?.code ?? null,
      sessionName: updated?.name ?? null,
      createdAt: photo.createdAt,
    },
  };
}

export async function listRecentPhotosSince(sinceIso: string): Promise<
  Array<{
    filename: string;
    url: string;
    sessionCode: string | null;
    sessionName: string | null;
    createdAt: string;
  }>
> {
  const rows = await query<{
    processed_filename: string;
    public_url: string;
    created_at: string | Date;
    session_id: string | null;
  }>(
    `select processed_filename, public_url, created_at, session_id
     from photos
     where created_at > $1::timestamptz
     order by created_at asc
     limit 50`,
    [sinceIso],
  );

  const sessionIds = [...new Set(rows.map((r) => r.session_id).filter(Boolean))] as string[];
  const sessionMap = new Map<string, PhotoSession>();
  if (sessionIds.length > 0) {
    const sessions = await Promise.all(sessionIds.map((id) => getSessionById(id)));
    for (const s of sessions) {
      if (s) sessionMap.set(s.id, s);
    }
  }

  return rows.map((row) => {
    const session = row.session_id ? sessionMap.get(row.session_id) : null;
    return {
      filename: row.processed_filename,
      url: row.public_url,
      sessionCode: session?.code ?? null,
      sessionName: session?.name ?? null,
      createdAt: iso(row.created_at)!,
    };
  });
}

export async function recordFramePreview(frameIdInput: unknown): Promise<{
  frameId: string;
  frameUrl: string;
  createdAt: string;
}> {
  const frameId = normalizeFrameId(frameIdInput);
  const row = await queryOne<{ frame_id: string; created_at: string | Date }>(
    `insert into frame_preview_events (frame_id)
     values ($1)
     returning frame_id, created_at`,
    [frameId],
  );
  const createdAt = iso(row?.created_at) ?? new Date().toISOString();
  return { frameId, frameUrl: `/frames/${frameId}.png`, createdAt };
}

export async function recordFramePreviewClear(): Promise<{ createdAt: string }> {
  const row = await queryOne<{ created_at: string | Date }>(
    `insert into frame_preview_events (frame_id)
     values ($1)
     returning created_at`,
    [CLEAR_FRAME_PREVIEW_ID],
  );
  return { createdAt: iso(row?.created_at) ?? new Date().toISOString() };
}

export async function listRecentFramePreviewsSince(sinceIso: string): Promise<
  Array<
    | { type: "frame_preview"; frameId: string; frameUrl: string; createdAt: string }
    | { type: "frame_preview_clear"; createdAt: string }
  >
> {
  const rows = await query<{ frame_id: string; created_at: string | Date }>(
    `select frame_id, created_at
     from frame_preview_events
     where created_at > $1::timestamptz
     order by created_at asc
     limit 50`,
    [sinceIso],
  );

  return rows.map((row) => {
    const createdAt = iso(row.created_at)!;
    if (row.frame_id === CLEAR_FRAME_PREVIEW_ID) {
      return { type: "frame_preview_clear", createdAt };
    }
    const frameId = normalizeFrameId(row.frame_id);
    return {
      type: "frame_preview",
      frameId,
      frameUrl: `/frames/${frameId}.png`,
      createdAt,
    };
  });
}
