---
name: fferp-testing
description: >
  Testing skill for the Farmers Factory ERP — how to verify a new page, a fix, or a migration
  actually works without risking the live production app or the live Supabase database. Load it
  whenever the request is "test this", "how do I verify", "make sure this doesn't break production",
  "can we test this safely", "I don't want this touching live data", "dry run", "before we ship this",
  or whenever you are about to run something that writes data (a migration, a bulk action, the EOD
  engine, a batch payout) and need a safe way to check it first. It gives the disposable-sandbox
  technique for anything that must not touch production, the manual per-role smoke-test checklist,
  and what "tested" has to mean before a change in this repo is called done.
---

# FFERP — Testing Safely

## The core problem this skill solves

FFERPv2 has exactly one Supabase project (`qwiumswrbddwmlraktvy`) and it is production — used by
real hub managers, purchase executives, and Accounts every day. There is no separate staging
database. That means two different testing needs require two different techniques:

1. **"Will this code do the right thing?"** — test in an isolated copy, never touching the real repo
   or the real database.
2. **"Does this actually work against real data?"** — the user runs it, in the real app, as a real
   role, and reports back. You cannot substitute for this by "testing" against production yourself.

Never blur these two. Never run a migration, a bulk action, `run_eod_po_engine()`, a batch payout, or
anything else that writes rows "just to test it" against the live project — several of those
functions create real purchase orders or move real money, and this codebase's own rules say so
(`fferp-purchase`, `fferp-payments`).

## Technique 1 — the disposable sandbox (for anything code-level, or anything you'd otherwise be
tempted to test against production)

This is exactly how the `fferp-*` skills themselves were validated before being handed over — it
works for testing a diagnosis, a proposed fix, a new page, or a subagent's understanding of the
codebase, with zero risk to the real repo or real data.

1. **Copy the repo, not clone it.** A `git worktree` only checks out committed files — anything
   untracked (like new skills, a `.env`, work in progress) won't be there. Use a real file copy:
   ```bash
   robocopy "D:\FF ERP" "<scratch>\fferp-test-sandbox" /E /XD node_modules .git deliverables /XF "*.env"
   ```
   (robocopy exit codes 0–7 are all success — don't treat a nonzero code as failure.)
   Excluding `.env` means the sandbox has **no live Supabase credentials at all** — even a test that
   ignores instructions and tries to write to the database cannot reach it.
2. **Give it its own disposable git history** (`cd sandbox && git init && git add -A && git commit`)
   so a test agent can diff/commit freely without ever touching the real repo's history.
3. **Frame every test prompt as diagnose/propose-only**, explicitly: no SQL execution, no calling the
   Supabase REST API, no `npm run dev`, no commits/pushes anywhere outside the sandbox, no editing
   files outside the sandbox path. State the sandbox path explicitly in the prompt.
4. **Verify anything the test claims against the real repo before trusting it.** A test agent
   (yours or a subagent's) can still misread code or state something plausible-sounding but wrong.
   Spot-check surprising or high-stakes claims with a `grep`/`Read` against `D:\FF ERP` itself —
   this caught a real factual error during the last skill-testing round (a baseline run confidently
   claimed a notification trigger didn't exist; it did).
5. **Delete the sandbox when done**, or leave it — it's disposable by construction, nothing depends
   on it surviving.

Use this for: testing a bug diagnosis, testing a proposed migration's logic, comparing two
approaches, or validating that a subagent/skill understands the codebase correctly — anything where
you want a real, working copy of the app to reason against without any chance of a side effect
reaching the user's actual project.

## Technique 2 — manual smoke test in the real app (for "does this actually work")

This cannot be delegated to an isolated copy — it needs the real Supabase auth, the real role
accounts, and (for anything hub-scoped) the real hub data. The user runs this; you tell them exactly
what to check.

**Per-role checklist** — for every role the change's `allowedRoles` includes:
- [ ] Log in as that role. Land on the expected page (check `RedirectPage.tsx`'s `roleRoutes`).
- [ ] The sidebar shows the new/changed item, on both desktop and the phone-width view.
- [ ] The route is reachable directly by URL and **not** reachable by a role that shouldn't have it
      (confirm the bounce to `/redirect` actually happens — `ProtectedRoute` really redirects).
- [ ] For hub-scoped roles: log in as a hub manager/purchase executive for **hub A**, confirm hub
      B's rows are never visible, not even by editing the URL or the network request.
- [ ] Trigger every error path on purpose (submit with a required field empty, a duplicate, a value
      outside a CHECK constraint) and confirm the error is visible on screen, not a silent no-op.

**Data-writing changes** (payments, POs, inventory): the user should verify the *database* row
matches expectations, not just what the UI shows afterward — screens can render a stale cache. Give
them the exact `SELECT` to run.

**Migrations**: never assume a SQL file applied. Every migration in this repo ends with a verify
`SELECT` for exactly this reason — get the user to paste that output back before writing code that
depends on the new column/table/constraint existing.

## Build verification (always, before either kind of test)

```bash
npx vite build          # ~75s; this is what Vercel actually runs — use this as the gate
```
Do **not** use `npx tsc --noEmit` as a gate — it runs 10+ minutes on this repo and most FF pages are
`@ts-nocheck` anyway (see `fferp-database` for why). If you need type-correctness on a specific file,
check that file in isolation, not the whole project.

## Testing a payment-chain or approval-workflow change specifically

Because these changes affect real money movement, test the **full chain**, not just the stage you
changed: raise → every intermediate approval → the final stage → Mark Paid/disbursement, checking at
each hop that (a) the row's status is exactly the expected string, (b) the next approver's queue and
sidebar badge show the row, (c) the submitter's own "My Submitted Payments" timeline reflects it, and
(d) rejecting at any stage produces a `rejection_reason` and doesn't advance the row. See
`fferp-payments` for the exact write payloads to check against.

## Testing an EOD PO Engine or bulk-action change

`run_eod_po_engine()` and bulk approvals/deletes create or modify real rows and cannot be
"dry run" safely against production. Test the query logic (the `SELECT` the function builds) against
production read-only first; test the actual `INSERT`/`UPDATE` path only in the sandbox (technique 1)
or with the user's explicit sign-off to run it once against production on a date/scope they choose.

## What "tested" means before calling a change done

Matches `fferp-release`'s definition of done, with the testing specifics above folded in: build
passes, every affected role smoke-tested (technique 2), any migration's verify output confirmed by
the user, hub scoping checked with a real cross-hub account, and — for anything you tested with an
isolated agent or sandbox first — the sandbox's key claims spot-checked against the real repo before
you report them as fact.
