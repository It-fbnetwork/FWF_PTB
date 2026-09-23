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

Local agent (camera + LED + sessions on Mac). For a **public QR link** that works on any phone (4G/Wi‑Fi), use Cloudflare Tunnel below — Mac must stay online during the event. Full cloud DB/hosting is still Phase 4.

## Run

```bash
npm install
npm run start
```

Open on the booth Mac:

| Page | URL |
| --- | --- |
| LED Display | http://localhost:3010/display |
| Customer check-in | http://localhost:3010/checkin |
| Operator | http://localhost:3010/operator |

Default port is **3010**.

## Public QR (Cloudflare Tunnel)

Keeps the Phase 3 agent on the Mac; exposes HTTPS so guests can check in from any network.

1. Install once: `brew install cloudflared`
2. Keep `npm run start` running (agent on port 3010).
3. In a **second** terminal:

```bash
npm run tunnel
```

4. Copy the printed URL, e.g. `https://….trycloudflare.com`
5. QR for guests → `https://….trycloudflare.com/checkin`

| Page | Public path |
| --- | --- |
| Check-in (QR) | `/checkin` |
| Guest session / download | `/checkin/CODE` |
| Operator (booth only — do not print on guest QR) | `/operator` |
| LED | `/display` |

Notes:

- Quick tunnel URL **changes every time** you restart `npm run tunnel`. Regenerate the QR after each restart.
- For a **stable** hostname (production events), create a named Cloudflare Tunnel + custom domain instead of quick tunnel.
- `/operator` is also exposed via the tunnel — use only on staff devices; Phase 5 adds auth.
- Do **not** rely on Vercel for this agent: it needs local Pictures watch + a long-running process.

## Test Phase 3

1. Keep `npm run start` running.
2. (Optional public QR) Run `npm run tunnel` and open `/checkin` on the printed HTTPS URL from any phone.
3. Open `/operator` on the Mac (or staff device).
4. Submit name + phone + consent on check-in → get a session code.
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
