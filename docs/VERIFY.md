# Phase 4 verify checklist (Railway + R2)

- [ ] Railway Postgres created; `db/schema.sql` applied
- [ ] R2 bucket public; `R2_PUBLIC_BASE_URL` works in browser
- [ ] Vercel Root Directory = `apps/web`
- [ ] Vercel env: `DATABASE_URL`, `R2_*`, `OPERATOR_PIN`, `AGENT_TOKEN`
- [ ] Redeploy succeeds
- [ ] `GET /api/health` returns `{ ok: true, db: true }`
- [ ] Phone `/checkin` (cellular) → session page
- [ ] `/operator` + PIN lists session
- [ ] Store Mac `npm run agent` connects
- [ ] Local LED `http://localhost:3020/display` opens
- [ ] PREPARE → shoot → local LED shows photo
- [ ] Guest page + cloud `/display` show photo after upload
- [ ] Unplug network briefly → shoot still shows on local LED; reconnect → upload retries
