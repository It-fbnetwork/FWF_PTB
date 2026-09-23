import { randomBytes, randomUUID } from "node:crypto";
import { getAdminClient } from "./supabase";
import type { PhotoSession, SessionPhoto, SessionStatus, UnassignedPhoto } from "./types";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PHOTO_BUCKET = "photos";

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

function generateCode(): string {
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

function mapPhoto(row: PhotoRow): SessionPhoto {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    processedFilename: row.processed_filename,
    url: row.public_url,
    createdAt: row.created_at,
  };
}

async function loadPhotosForSessions(sessionIds: string[]): Promise<Map<string, SessionPhoto[]>> {
  const map = new Map<string, SessionPhoto[]>();
  if (sessionIds.length === 0) return map;

  const db = getAdminClient();
  const { data, error } = await db
    .from("photos")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as PhotoRow[]) {
    if (!row.session_id) continue;
    const list = map.get(row.session_id) ?? [];
    list.push(mapPhoto(row));
    map.set(row.session_id, list);
  }
  return map;
}

async function mapSession(row: SessionRow, photos?: SessionPhoto[]): Promise<PhotoSession> {
  let sessionPhotos = photos;
  if (!sessionPhotos) {
    const loaded = await loadPhotosForSessions([row.id]);
    sessionPhotos = loaded.get(row.id) ?? [];
  }
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    phone: row.phone,
    status: row.status,
    consentAt: row.consent_at,
    createdAt: row.created_at,
    capturedAt: row.captured_at,
    completedAt: row.completed_at,
    selectedPhotoId: row.selected_photo_id,
    photos: sessionPhotos,
  };
}

async function getActiveSessionId(): Promise<string | null> {
  const db = getAdminClient();
  const { data, error } = await db.from("booth_state").select("active_session_id").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.active_session_id as string | null | undefined) ?? null;
}

async function setActiveSessionId(sessionId: string | null): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from("booth_state")
    .upsert({ id: 1, active_session_id: sessionId, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function listSessions(): Promise<PhotoSession[]> {
  const db = getAdminClient();
  const { data, error } = await db.from("sessions").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as SessionRow[];
  const photos = await loadPhotosForSessions(rows.map((r) => r.id));
  return Promise.all(rows.map((row) => mapSession(row, photos.get(row.id) ?? [])));
}

export async function getSessionById(id: string): Promise<PhotoSession | null> {
  const db = getAdminClient();
  const { data, error } = await db.from("sessions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapSession(data as SessionRow);
}

export async function getSessionByCode(code: string): Promise<PhotoSession | null> {
  const db = getAdminClient();
  const needle = code.trim().toUpperCase();
  const { data, error } = await db.from("sessions").select("*").eq("code", needle).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapSession(data as SessionRow);
}

export async function getActiveSession(): Promise<PhotoSession | null> {
  const activeId = await getActiveSessionId();
  if (!activeId) return null;
  return getSessionById(activeId);
}

export async function getUnassignedPhotos(): Promise<UnassignedPhoto[]> {
  const db = getAdminClient();
  const { data, error } = await db
    .from("photos")
    .select("*")
    .is("session_id", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as PhotoRow[]).map((row) => ({
    id: row.id,
    originalFilename: row.original_filename,
    processedFilename: row.processed_filename,
    url: row.public_url,
    createdAt: row.created_at,
  }));
}

export async function createSession(input: {
  name: string;
  phone: string;
  consent: boolean;
}): Promise<PhotoSession> {
  const name = input.name.trim();
  const phone = normalizePhone(input.phone);
  if (!name) throw new Error("Name is required");
  if (phone.length < 8) throw new Error("Phone number is invalid");
  if (!input.consent) throw new Error("Consent is required");

  const db = getAdminClient();
  const now = new Date().toISOString();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateCode();
    const { data, error } = await db
      .from("sessions")
      .insert({
        id: randomUUID(),
        code,
        name,
        phone,
        status: "READY",
        consent_at: now,
        created_at: now,
      })
      .select("*")
      .single();

    if (error) {
      lastError = new Error(error.message);
      if (error.code === "23505") continue;
      throw lastError;
    }

    const session = await mapSession(data as SessionRow, []);
    const previous = await getActiveSession();
    if (previous && previous.id !== session.id) {
      if (previous.status === "READY" || previous.status === "SELECTED") {
        await db
          .from("sessions")
          .update({
            status: previous.photos.length > 0 ? "READY_TO_DISPLAY" : "WAITING",
          })
          .eq("id", previous.id);
      }
    }

    await setActiveSessionId(session.id);
    return session;
  }

  throw lastError ?? new Error("Could not generate unique session code");
}

export async function prepareSession(sessionId: string): Promise<PhotoSession> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status === "CANCELLED" || session.status === "COMPLETED") {
    throw new Error(`Cannot prepare session in status ${session.status}`);
  }

  const db = getAdminClient();
  const previous = await getActiveSession();
  if (previous && previous.id !== session.id) {
    if (previous.status === "READY" || previous.status === "SELECTED") {
      await db
        .from("sessions")
        .update({
          status: previous.photos.length > 0 ? "READY_TO_DISPLAY" : "WAITING",
        })
        .eq("id", previous.id);
    }
  }

  const { error } = await db.from("sessions").update({ status: "READY" }).eq("id", session.id);
  if (error) throw new Error(error.message);
  await setActiveSessionId(session.id);
  return (await getSessionById(session.id))!;
}

export async function completeSession(sessionId: string): Promise<PhotoSession> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  const db = getAdminClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("sessions")
    .update({ status: "COMPLETED", completed_at: now })
    .eq("id", session.id);
  if (error) throw new Error(error.message);

  const activeId = await getActiveSessionId();
  if (activeId === session.id) await setActiveSessionId(null);
  return (await getSessionById(session.id))!;
}

export async function cancelSession(sessionId: string): Promise<PhotoSession> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  const db = getAdminClient();
  const { error } = await db.from("sessions").update({ status: "CANCELLED" }).eq("id", session.id);
  if (error) throw new Error(error.message);

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
  const db = getAdminClient();
  const photoId = randomUUID();
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${photoId}_${input.processedFilename}`;

  const { error: uploadError } = await db.storage.from(PHOTO_BUCKET).upload(storagePath, input.bytes, {
    contentType: input.contentType ?? "image/jpeg",
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicData } = db.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicData.publicUrl;
  const now = new Date().toISOString();
  const active = await getActiveSession();

  const { data: photoRow, error: photoError } = await db
    .from("photos")
    .insert({
      id: photoId,
      session_id: active?.id ?? null,
      original_filename: input.originalFilename,
      processed_filename: input.processedFilename,
      storage_path: storagePath,
      public_url: publicUrl,
      created_at: now,
    })
    .select("*")
    .single();

  if (photoError) throw new Error(photoError.message);
  const photo = mapPhoto(photoRow as PhotoRow);

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

  const { error: updateError } = await db
    .from("sessions")
    .update({
      status: "READY_TO_DISPLAY",
      selected_photo_id: photo.id,
      captured_at: active.capturedAt ?? now,
    })
    .eq("id", active.id);
  if (updateError) throw new Error(updateError.message);

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
  const db = getAdminClient();
  const { data, error } = await db
    .from("photos")
    .select("processed_filename, public_url, created_at, session_id")
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    processed_filename: string;
    public_url: string;
    created_at: string;
    session_id: string | null;
  }>;

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
      createdAt: row.created_at,
    };
  });
}
