# FWF Photo Booth — Phase 1–3

Local **Camera Agent** + **LED Display** + **Check-in / Operator** for Face Wash Fox.

## Flow (Phase 3)

```text
Phone /checkin
    ↓
WAITING queue
    ↓
Operator /operator → PREPARE PHOTO
    ↓
Active session = A92X31
    ↓
ZV-E10 shutter
    ↓
Imaging Edge → ~/Pictures
    ↓
Agent process + frame
    ↓
Associate photo → A92X31
    ↓
/display LED + /checkin/A92X31 guest page
```

Still local-only: no cloud database, no auth, no QR hosting yet.

## Run

```bash
npm install
npm run dev
```

Open:

| Page | URL |
| --- | --- |
| LED Display | http://localhost:3010/display |
| Customer check-in | http://localhost:3010/checkin |
| Operator | http://localhost:3010/operator |

Default port is **3010**.

## Test Phase 3

1. Keep `npm run dev` running.
2. Open `/operator` on the Mac.
3. On phone (same Wi‑Fi) or another tab, open `/checkin`.
4. Submit name + phone + consent → get a session code.
5. On operator, click **PREPARE PHOTO** for that guest.
6. Terminal should show `Active session: CODE — Name`.
7. Shoot with ZV-E10.
8. Expect:
   - Agent: `Associated … → CODE`
   - `/display` shows framed photo
   - `/checkin/CODE` shows the photo + download

If you shoot with **no** active session, the photo still processes and displays, but is marked **unassigned**.

## LED column (blueprint)

Active LED area from `public/cot hop den (1).jpg`:

```text
960 × 1280  (portrait 3:4)
Column shell: 1200 × 2620
```

Processed photos and `/display` now target this portrait panel.

- Do not associate photos without an explicit active session.
- Do not process historical Pictures files on startup.
- Processed output stays in `~/FWF_PhotoBooth/processed/` (never inside Pictures).
- Sessions persist in `~/FWF_PhotoBooth/sessions.json`.

## Project structure

```text
src/
  index.ts
  watcher.ts
  processor.ts
  sessions.ts          Active session + queue
  server.ts            HTTP + SSE + APIs
  events.ts
public/
  display.*
  checkin.*
  operator.*
  session.*
  app.css
```

## Later phases

- Phase 4: Database, storage, cloud realtime, customer download hosting
- Phase 5: Production LED ops, offline retry, admin auth, analytics, frame templates
