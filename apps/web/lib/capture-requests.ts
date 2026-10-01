import { query, queryOne } from "./db";
import { getActiveSession, getSessionByCode } from "./sessions";

type CaptureRow = {
  id: string;
  session_id: string;
  status: string;
  created_at: string | Date;
  claimed_at: string | Date | null;
};

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = query(`
      create table if not exists capture_requests (
        id uuid primary key default gen_random_uuid(),
        session_id uuid not null references sessions (id) on delete cascade,
        status text not null default 'PENDING',
        created_at timestamptz not null default now(),
        claimed_at timestamptz null
      );
      create index if not exists capture_requests_status_created_idx
        on capture_requests (status, created_at asc)
    `).then(() => undefined);
  }
  return schemaReady;
}

function iso(value: string | Date): string {
  return typeof value === "string" ? value : value.toISOString();
}

export async function requestCapture(code: string) {
  await ensureSchema();
  const session = await getSessionByCode(code);
  const active = await getActiveSession();
  if (!session || !active || session.id !== active.id) throw new Error("Session is not active");
  if (session.status !== "READY" && session.status !== "SELECTED") {
    throw new Error(`Session is not ready (${session.status})`);
  }

  const recent = await queryOne<CaptureRow>(
    `select * from capture_requests
     where session_id = $1 and created_at > now() - interval '10 seconds'
     order by created_at desc limit 1`,
    [session.id],
  );
  if (recent) return { id: recent.id, createdAt: iso(recent.created_at), duplicate: true };

  const row = await queryOne<CaptureRow>(
    `insert into capture_requests (session_id) values ($1) returning *`,
    [session.id],
  );
  if (!row) throw new Error("Could not create capture request");
  return { id: row.id, createdAt: iso(row.created_at), duplicate: false };
}

export async function claimCaptureRequest() {
  await ensureSchema();
  const row = await queryOne<CaptureRow & { code: string }>(
    `with next as (
       select id from capture_requests
       where status = 'PENDING'
       order by created_at asc
       for update skip locked limit 1
     )
     update capture_requests r
     set status = 'CLAIMED', claimed_at = now()
     from next, sessions s
     where r.id = next.id and s.id = r.session_id
     returning r.*, s.code`,
  );
  if (!row) return null;
  return { id: row.id, sessionCode: row.code, createdAt: iso(row.created_at), countdownMs: 3000 };
}

export async function listCaptureRequestsSince(since: string) {
  await ensureSchema();
  const rows = await query<CaptureRow>(
    `select * from capture_requests where created_at > $1::timestamptz order by created_at asc limit 20`,
    [since],
  );
  return rows.map((row) => ({ type: "capture_requested", createdAt: iso(row.created_at) }));
}
