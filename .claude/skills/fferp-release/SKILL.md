---
name: fferp-release
description: >
  How work is finished and shipped in the Farmers Factory ERP repo — build verification, git commit
  message conventions (root-cause bodies, Co-Authored-By), what to commit alongside code (CHECK_/FIX_
  SQL files, schema-fact updates), environment variables and dev server, Vercel deployment, edge
  function deploy, Supabase types regeneration, and updating the hand-off docs. Load it whenever the
  user says commit, push, deploy, release, build, "is it live", "update vercel", "write the commit",
  "hand-off", "document what we did", env, .env, port, or when you are about to finish any change in
  this repo. Also load it at the start of a session on a new machine to set up correctly.
---

# FFERP — Build, commit, deploy, hand-off

## Definition of done (every change)

1. `npx vite build` passes (≈75 s, ~1.1 MB main chunk is normal; `chunkSizeWarningLimit` is 3000).
   Do **not** gate on `npx tsc --noEmit` — it takes >10 minutes on this repo and the FF tables are
   untyped anyway.
2. Reproduced/tested in the running app (port 8081) as each role the change affects.
3. Any SQL the change depends on is a committed root-level file (`ADD_*/FIX_*/REFINE_*/CHECK_*.sql`)
   with a verify block, and the commit body says whether the user already ran it.
4. Schema facts learned are recorded in `.claude/skills/fferp-database/references/live-schema-facts.md`.
5. Sidebar (single config) and routes updated together; role guards match RLS.
6. Commit message written per the convention below.

## Commit message convention (this repo's history is its documentation)

Subject: imperative, specific, ≤ 72 chars, no prefix jargon required
(`Fix Purchase Report reading PO date from created_at instead of eod_date`).

Body (wrap ~72): explain like a colleague reading it in six months —
- what the user saw,
- what was actually wrong and **why** (name the column/constraint/trigger),
- what the fix does and what it deliberately does not do ("NOT YET DONE — flagged, not silently skipped"),
- side effects / other places fixed in the same class,
- SQL the user must run, and whether it was applied ("applied via SQL Editor per FIX_X.sql"),
- verification performed ("confirmed via information_schema", "0 rows at quantity = 2023").

Trailer, when the work was done with Claude:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Examples of good subjects from history: "Fix root cause: vendors.gstin/pan don't exist, silently
breaking every vendor lookup", "Unify desktop and mobile sidebars onto one navigationConfig",
"Add Revoke button for pending/verified FF payment batches".

Git hygiene: commit on `main` only when the user asks; never `--no-verify`; never rewrite history;
`deliverables/` and other generated outputs are untracked unless the user wants them.

## Environment setup on a machine

```
git clone https://github.com/ffigoadmin-hub/fferp_v3.git "D:\FF ERP"
npm install --legacy-peer-deps          # same flag Vercel uses; npm 11 may block postinstall scripts — build still works
.env  ←  VITE_SUPABASE_URL=https://qwiumswrbddwmlraktvy.supabase.co
        VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…   # the key the code reads
        VITE_SUPABASE_ANON_KEY=eyJ…
        VITE_APP_BASE_URL=http://localhost:8081
npm run dev                             # http://localhost:8081  (Vite reads .env only at startup — restart after edits)
```

`.env.example` also lists `VITE_SUPABASE_SERVICE_ROLE_KEY` and Resend keys — those belong to edge
function secrets, never to the browser build. Keys are verified with
`curl -H "apikey: $KEY" -H "Authorization: Bearer $KEY" $URL/rest/v1/hubs?select=code` → 200.

## Deploy

- **Web**: push to `main` → Vercel builds with `vercel.json` (`npm install --legacy-peer-deps`,
  `npm run build`, SPA rewrite to `index.html`, security headers). Env vars are set in the Vercel
  project (same names as `.env`). A change to `vite.config.ts` externals can break production while
  dev works — always run a real `vite build` before pushing build-config changes.
- **Database**: the user pastes SQL files into the Supabase SQL Editor (project
  `qwiumswrbddwmlraktvy`). Order matters only for dependent files; each file is idempotent.
- **Edge functions**: `supabase functions deploy <name> --project-ref qwiumswrbddwmlraktvy`;
  secrets in Dashboard → Edge Functions → Secrets.
- **Types**: `npx supabase gen types typescript --project-id qwiumswrbddwmlraktvy >
  src/integrations/supabase/types.ts` (needs CLI login to the owning account). Expect new type errors
  in FF pages afterwards; fix them page by page.
- **Mobile / scanner apps** are separate repos on the same DB — schema changes must stay
  backward-compatible (additive columns, superset CHECK lists) or coordinate a release.

## Hand-off documentation

- `CLAUDE_CODE_HANDOFF.md` sections 3–6 are the architecture reference; its "open work queue" is
  historical. When finishing a large piece of work, add a dated entry to `AGENT_CHANGELOG.md`
  (files affected, validation done) rather than rewriting the handoff.
- The root `README.md` is a stray Supabase-CLI readme; if the user asks for a README, write a
  project one (stack, run, env, module map) instead of editing that.
- Skills in `.claude/skills/fferp-*` are the living manuals — update the relevant one in the same
  commit when a rule or fact changes (e.g. a new payment stage → `fferp-payments` + `fferp-database`).

## Session start checklist (new laptop or long gap)

1. `git pull`; read `git log --format='%ad %s' --date=short | head -40` for what changed recently.
2. Confirm `.env` exists and the dev server starts.
3. Load `fferp-core`, then the domain skill for the task.
4. Ask which SQL files from recent commits have already been applied to production if the commit
   bodies don't say.
