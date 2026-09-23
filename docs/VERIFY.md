# Phase 4 verify checklist

- [ ] Supabase schema applied (`supabase/schema.sql`)
- [ ] Bucket `photos` is public
- [ ] Vercel Root Directory = `apps/web`
- [ ] Vercel env: SUPABASE_*, OPERATOR_PIN, AGENT_TOKEN
- [ ] Redeploy succeeds
- [ ] Phone opens `/checkin` over cellular → session code page
- [ ] `/operator` accepts PIN and lists session
- [ ] Store Mac: `npm run agent` connects and logs cloud API
- [ ] PREPARE → shoot → guest page + `/display` show photo
