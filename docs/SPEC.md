# FWF PHOTO BOOTH — Technical Spec notes

**Current implementation: Phase 4 (cloud)**

## Stack

| Layer | Tech |
| --- | --- |
| Web | Next.js on Vercel (`apps/web`) |
| DB | Railway Postgres (`db/schema.sql`) |
| Storage | Cloudflare R2 |
| Store Mac | `@fwf/agent` — Imaging Edge → watch Pictures → Sharp → local LED + cloud upload |

## Flow

```text
QR /checkin (Vercel)
      ↓
Railway sessions (READY + active)
      ↓
Operator /operator (PIN)
      ↓
ZV-E10 → Imaging Edge → ~/Pictures
      ↓
Agent frame (960×1280)
      ├─ Local LED http://localhost:3020/display  (offline OK)
      └─ Upload queue → Vercel → R2 + Postgres
            ↓
Guest /checkin/CODE download + cloud /display
```

## Phases

- Phase 1–3: local prototype (legacy `src/` + `public/`)
- Phase 4: cloud DB/storage + agent upload + customer download ← **now**
- Phase 5: production hardening (auth admin, analytics, multi-frame, etc.)

## Rules

```text
DO NOT attempt direct Sony camera control yet.
DO NOT replace Sony Imaging Edge.
DO NOT process historical images on startup.
DO NOT process partially transferred files.
DO NOT put processed images inside watched Pictures folder.
DO NOT require Internet for local image processing / local LED.
DO NOT stretch image aspect ratio.
DO NOT associate photos with customers without an explicit active session.
```
