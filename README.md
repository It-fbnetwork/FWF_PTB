# FWF Photo Booth — Phase 4 (Cloud)

Cloud **check-in / operator / LED / download** on Vercel + Supabase.  
Local **camera agent** on any store Mac with Sony Imaging Edge + ZV-E10.

```text
Guest QR → Vercel /checkin
              ↓
         Supabase DB + Storage
              ↑
Store Mac agent (watch Pictures → frame → upload)
```

Your personal Mac does **not** need to stay on for QR/check-in.  
A store machine only needs to run the agent **while the booth is open**.

## Repo layout

```text
apps/web/       Next.js app (deploy to Vercel)
apps/agent/     Camera agent (run on store Mac)
supabase/       SQL schema
```

Legacy `src/` + root `public/` are the old Phase 3 local-only stack.

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. SQL Editor → run [`supabase/schema.sql`](supabase/schema.sql).
3. Storage → confirm bucket **`photos`** exists and is **public**.
4. Project Settings → API: copy URL + `service_role` key (+ anon key).

## 2. Vercel

1. Project linked to [It-fbnetwork/FWF_PTB](https://github.com/It-fbnetwork/FWF_PTB).
2. **Root Directory** = `apps/web` (Settings → General).
3. Environment variables:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_URL` | same URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon |
| `OPERATOR_PIN` | e.g. `4821` |
| `AGENT_TOKEN` | long random secret |
| `DISPLAY_DURATION_MS` | `8000` (optional) |
| `DISPLAY_FADE_MS` | `700` (optional) |

4. Redeploy.

Public URLs (QR):

| Page | Path |
| --- | --- |
| Check-in (QR) | `/checkin` |
| Guest session | `/checkin/CODE` |
| Operator | `/operator` (asks for PIN) |
| LED | `/display` |

## 3. Store Mac (any machine)

1. Install Sony Imaging Edge; tether ZV-E10; confirm JPEGs land in Pictures (or your folder).
2. Clone repo and install:

```bash
git clone https://github.com/It-fbnetwork/FWF_PTB.git
cd FWF_PTB
npm install
```

3. Create `apps/agent/.env` (or export vars):

```bash
export FWF_API_URL=https://YOUR_VERCEL_URL
export FWF_AGENT_TOKEN=same-as-AGENT_TOKEN-on-vercel
export FWF_WATCH_DIR="$HOME/Pictures"
export FWF_DATA_DIR="$HOME/FWF_PhotoBooth"
```

4. Start agent:

```bash
npm run agent
```

5. Staff opens cloud `/operator` + PIN. LED browser opens cloud `/display`.  
6. Print QR → `https://YOUR_VERCEL_URL/checkin`.

## Local web dev

```bash
cp .env.example apps/web/.env.local
# fill Supabase + PIN + token
npm install
npm run dev
```

## Verify checklist

1. Open `/checkin` on phone (any network) → submit → get code page.
2. `/operator` + PIN → see session → PREPARE PHOTO.
3. Agent terminal shows active session when polled after prepare.
4. Shoot ZV-E10 → agent processes + uploads.
5. Guest page shows photo + download; `/display` shows framed image.

## Env reference

See [`.env.example`](.env.example).
