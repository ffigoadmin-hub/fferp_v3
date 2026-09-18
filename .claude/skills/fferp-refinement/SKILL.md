---
name: fferp-refinement
description: >
  Refinement skill for the Farmers Factory ERP — how to safely change or extend an EXISTING workflow,
  chain, or module without breaking historical data or the roles/pages that already depend on it.
  Load it whenever the request is "add a stage to", "change the approval chain", "refine the X
  workflow", "we want to modify how X works", "insert a new step between", "rename this status", "the
  process needs to change", or any request that alters behavior of something already live (as opposed
  to building something new — for that, load fferp-module-builder instead). This codebase has done
  this exact kind of change several times (the payment chain has been refined at least twice); load
  fferp-payments or fferp-purchase alongside this for the specific chain/table facts, and
  fferp-database for the additive-migration template.
---

# FFERP — Refining an Existing Workflow

## Why this is a different discipline from building new

A refinement changes something roles, pages, historical rows, and other apps (mobile, scanner)
already depend on. The risk isn't "does the new code work" — it's "did I find every place that
assumed the old behavior, and did I handle the rows that are already mid-flight under it." This
repo's own history is the proof this matters: the payment chain has been refined twice
(`REFINE_PAYMENT_APPROVAL_CHAIN.sql`, 2026-09-03), and each time, follow-up commits fixed sidebar
labels, badge counts, and report pages that were missed in the first pass. A recent test of adding a
hypothetical new stage to the same chain found the DB notification trigger was *already* stale from
the previous refinement (never updated to the current stages) — years-old refinements leave debris if
this discipline isn't followed.

## Step 1 — find every consumer before changing anything

The thing you're refining almost certainly has more than one place that encodes its current
behavior. Grep broadly, not narrowly:

```bash
rg -n "pending_l1|pending_admin|NEXT_STATUS|STATUS_LABELS|APPROVAL_CHAIN" src   # e.g. for the payment chain
rg -n "<old-status-string>" src supabase *.sql                                  # every literal, including SQL/triggers
rg -n "<table-name>" src --include=*.tsx --include=*.ts | cut -d: -f1 | sort -u  # every file touching the table
```

Build a table before writing any code: **file → what it has that encodes the old behavior → what
needs to change**. The canonical example, confirmed live in this repo for the payment chain:

| File | What it has |
|---|---|
| `FFPaymentApprovals.tsx` | Canonical `NEXT_STATUS`/`APPROVED_BY_COL`/`MY_PENDING_STATUS` exports, plus its own `STATUS_COLORS`/`STATUS_LABELS`/`APPROVAL_CHAIN` |
| `useFFPaymentCount.ts` | `ROLE_STATUS_MAP`, `BADGE_KEY_STATUS` — sidebar badge counts |
| `MySubmittedPayments.tsx` | **Duplicates** its own copy of the status maps instead of importing the canonical ones |
| `PurchaseReportPage.tsx` | Imports the canonical maps — no duplicate logic, only its own label/color config |
| `FFPaymentsReport.tsx`, `CEOFFOverview.tsx` | Each has its **own** third/fourth copy of status labels — confirmed stale after the last refinement (missing labels for stages that already existed) |
| `Sidebar.tsx` | Nav item per stage, `badgeKey` per stage — confirmed some active stages have no badge wired at all |
| `notify_next_payment_approver()` (DB trigger) | `CASE` branches per stage — confirmed missing branches for stages added in the last refinement |
| `App.tsx`, `RedirectPage.tsx`, `constants/departments.ts` | Route guards, landing routes, role dropdown — only relevant if a role is involved |

Every one of these needs to be checked, even if the change feels like "just add one more status
value." Assume duplication exists until you've grepped for it — this codebase does not have a single
source of truth for most things by default; centralizing it is usually part of the refinement itself.

## Step 2 — design the change as additive, never destructive

- **Extend, don't replace, CHECK constraints.** `DROP CONSTRAINT` + `ADD CONSTRAINT` with the
  **superset** of old values plus new ones. A historical row must never become invalid.
- **New columns, not renamed/repurposed ones.** `ADD COLUMN IF NOT EXISTS` for any new stage's
  `_approved_by/_at/_remarks`. If a stage is being "reused" under a new label (like "FF Ops Manager"
  becoming "Manager" without a schema change), say so explicitly and reuse the underlying column
  deliberately — don't invent a new column for something that's only a label change.
- **Retire, don't delete, old values.** If a stage is being removed from the *active* chain
  (GM and Auditor were removed this way), its status value and columns stay valid for historical
  rows; nothing routes into them going forward. Never write a migration that would make an existing
  row's stored status suddenly invalid.
- **Decide the in-flight-row question explicitly, and say so to the user before running it.** Any
  row currently mid-flight under the old chain needs a decision: does it (a) get auto-advanced to the
  equivalent point in the new chain (right when a stage is *removed* — there's nowhere else for it to
  be), or (b) get left alone to finish under the old rule (right when a stage is *inserted* — forcing
  it backward would ask someone to re-review work already approved)? Write the migration to match
  whichever the user confirms, and include the untaken option as a commented-out alternative so it's
  visible, not silently decided for them.

## Step 3 — the migration file

Model it exactly on `REFINE_PAYMENT_APPROVAL_CHAIN.sql` (or `ADD_FF_PAYMENT_BATCHES.sql` for a purely
additive case): a header explaining the OLD state and the NEW state in one sentence each, the column
additions, the constraint extension, the in-flight row handling from Step 2, and a verify block at
the end that shows a per-status count so the user can paste back proof. See `fferp-database` for the
idempotency rules (`IF NOT EXISTS`, `DROP ... IF EXISTS` before recreate) — a refinement migration
gets re-run more often than a fresh one, because it's iterated on as gaps are found.

## Step 4 — ship the migration and every consumer edit atomically

A refinement is not done when the SQL runs — it's done when every file from Step 1's table is
updated in the **same deploy**. A stale duplicate copy of a status map mid-rollout is worse than not
shipping yet: it lets data move into a state some pages don't recognize, which looks exactly like a
bug report ("payment says Pending Unknown"). If the codebase currently duplicates something that
should be centralized (like the four separate copies of the payment status labels), fixing that
duplication is a legitimate and encouraged part of the refinement — flag it as a deliberate
improvement in the commit body, the way this repo's own commits do ("also fixes a pre-existing gap
found while touching this file").

## Step 5 — state what you did NOT change

This repo's commit convention explicitly calls out deferred scope rather than silently leaving it
(see `fferp-release`): "NOT YET DONE (flagged, not silently skipped): ...". Do the same — if you
found a stale consumer that's out of scope for this change, say so in the plan/commit rather than
quietly fixing or quietly ignoring it.

## Step 6 — test it as a refinement, not as new code

Use `fferp-testing`'s payment-chain/approval-workflow checklist if it's an approval chain, or the
general per-role checklist otherwise — but add: log in as a role on **both sides** of the change
(the stage before and the stage after) and confirm the handoff between them works, and pull up a
row that was already mid-flight before the migration ran to confirm it landed where Step 2's decision
said it should.

## Worked precedent to copy the shape of

`REFINE_PAYMENT_APPROVAL_CHAIN.sql`'s own header states the old chain, the new chain, which stages
are relabeled vs. retired vs. new, and why the blast radius was kept small (reusing `pending_ff_ops`
under a new label instead of introducing a new status for a pure rename). Read that file once before
writing a refinement migration of your own — it is the canonical example this whole skill generalizes
from.
