# FWF Photo Booth — Phase 4 (Cloud)

Cloud **check-in / operator / LED / download** on Vercel.  
**Postgres** on Railway + **photo files** on Cloudflare R2.  
Local **camera agent** on any store Mac with Sony Imaging Edge + ZV-E10.

```text
Guest QR → Vercel /checkin
              ↓
     Railway Postgres + R2
              ↑
Store Mac agent (watch Pictures → frame → upload)
```

## Repo layout

```text
apps/web/       Next.js (deploy Vercel)
apps/agent/     Camera agent (store Mac)
db/schema.sql   Railway Postgres schema
```

## 1. Railway Postgres

1. Create a Railway project → add **PostgreSQL**.
2. Copy `DATABASE_URL`.
3. Open Query / `psql` and run [`db/schema.sql`](db/schema.sql).

## 2. Cloudflare R2

1. R2 → Create bucket (e.g. `fwf-photobooth`).
2. Enable **public access** (R2.dev subdomain or custom domain).
3. Create API token: Object Read & Write for that bucket.
4. Note: Account ID, Access Key ID, Secret, public base URL  
   (e.g. `https://pub-xxxxx.r2.dev` or `https://photos.yourdomain.com`).

## 3. Vercel

1. Project linked to [It-fbnetwork/FWF_PTB](https://github.com/It-fbnetwork/FWF_PTB).
2. **Root Directory** = `apps/web`.
3. Environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Railway Postgres URL |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret |
| `R2_BUCKET` | bucket name |
| `R2_PUBLIC_BASE_URL` | public base (no trailing slash) |
| `OPERATOR_PIN` | e.g. `4821` |
| `AGENT_TOKEN` | long random secret |

4. Redeploy.

Public URLs (QR):

| Page | Path |
| --- | --- |
| Check-in (QR) | `/checkin` |
| Guest session | `/checkin/CODE` |
| Operator | `/operator` (PIN) |
| LED | `/display` |

## 4. Store Mac

```bash
git clone https://github.com/It-fbnetwork/FWF_PTB.git
cd FWF_PTB && npm install

export FWF_API_URL=https://YOUR_VERCEL_URL
export FWF_AGENT_TOKEN=same-as-AGENT_TOKEN
export FWF_WATCH_DIR="$HOME/Pictures"
export FWF_DATA_DIR="$HOME/FWF_PhotoBooth"

npm run agent
```

Staff: cloud `/operator` + PIN. LED: cloud `/display`.  
QR: `https://YOUR_VERCEL_URL/checkin`.

## Local web dev

```bash
cp .env.example apps/web/.env.local
# fill DATABASE_URL + R2_* + PIN + token
npm install
npm run dev
```

## Verify

See [`docs/VERIFY.md`](docs/VERIFY.md).
