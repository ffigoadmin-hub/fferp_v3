# Workspace Audit Report

Generated: 2026-05-22

**System Overview and Tech Stack**
- **Primary languages:** TypeScript, JavaScript, Python, SQL, Deno (for Supabase functions)
- **Frontend:** React + Vite (TypeScript) — [package.json](package.json) lists `vite`, `react`, `react-dom`, and many Radix/UI and Tailwind related deps.
- **Mobile / Web apps:** React Native / Expo-style `mobile-app` and a Next.js app `farmers_factory_mobile_app` (Next config and app folders present).
- **Backend / API / Auth:** Supabase (Postgres + edge functions). Serverless functions live under `supabase/functions/` and a `supabase/config.toml` is present.
- **Database:** Postgres (managed locally via Supabase; migrations in `supabase/migrations/` and SQL schema files like `supabase/MANUAL_SETUP.sql`).
- **Other runtimes/tools:** Node tooling (npm/yarn via `package.json`), Python scripts in `execution/`, numerous SQL migration scripts, and build/deploy config for Vercel (`vercel.json`).

**High-level Architecture & Directory Structure**
- **Root:** docs, scripts, and project-level configs (`package.json`, `tsconfig*.json`, `vite.config.ts`, `vercel.json`).
- **Frontend app:** `src/` — React app source (components, pages, hooks, services, contexts, lib). Key entry points: [src/main.tsx](src/main.tsx), [src/App.tsx](src/App.tsx).
- **Supabase:** `supabase/` — contains `functions/` (edge functions in Deno/TS), `migrations/`, `config.toml`, storage `.temp` and seed SQL. This directory is the primary backend and DB schema source.
- **Mobile clients / microsites:** `mobile-app/`, `farmers_factory_mobile_app/`, `ffwebsite-main/` — separate codebases and build configs with their own `package.json` / `tsconfig`.
- **Execution + automation:** `execution/` (deterministic Python scripts used for verification and automation), `scripts/` (SQL and TS helper scripts).
- **Design system:** `design-system/` contains component documentation and static pages for UI design guidance.

**Core Business Logic & Data Flow (summary)**
- **Authentication flow:** Client uses a Supabase client ([src/integrations/supabase/client.ts](src/integrations/supabase/client.ts)) to authenticate users. `AuthContext` (`src/contexts/AuthContext.tsx`) subscribes to `supabase.auth.onAuthStateChange`, fetches `profiles` from the DB and sets the application user. Login/logout events are inserted into `audit_logs` and day-starts are recorded in `day_starts`.
- **User profile and RBAC:** Application maps DB role strings to unified `UserRole` inside `AuthContext`. Authorization at UI-level uses mapped role values; server-side enforcement should rely on Postgres RLS and function guards in `supabase/`.
- **Server-side operations:** Serverless functions (e.g., `create-onboarding-user`, `activate-employee-account`, `delete-user`, and many analysis/cron functions) implement sensitive operations. Many functions are found under `supabase/functions/` and are invoked for onboarding, reporting, alarms and business jobs.
- **Data pipelines:** Inbound mutations happen through the front-end (supabase client) and via functions; DB migrations in `supabase/migrations/` manage schema changes. Analytical jobs and exports are in `src/services` (e.g., `PaymentExportService.ts`, `PaymentConversionService.ts`) and scheduled/triggered via functions or cron jobs.
- **Audit & observability:** The codebase records audit events to `audit_logs` (see `src/lib/audit.ts` and usage in `AuthContext`). There are reporting services and monitoring helpers across `src/lib` and `src/services`.

**Authentication & Security Review — Current State**
This section lists observed settings, risks, and immediate remediation recommendations.

- **Supabase client configuration**: [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts)
  - Uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from client-side environment. Stores sessions in `localStorage` and uses `autoRefreshToken: true`.
  - Risk: storing auth tokens in `localStorage` exposes tokens to XSS. Consider using HttpOnly cookies (if Supabase cookie auth is supported for your deployment) or enforce strict CSP and input sanitization.

- **Supabase config**: [supabase/config.toml](supabase/config.toml)
  - `jwt_expiry = 3600` (1 hour) and `enable_refresh_token_rotation = true` — good to have rotation enabled.
  - Many `functions.*` entries set `verify_jwt = false` (e.g., `create-onboarding-user`, `delete-user`, `activate-employee-account`, `evaluate-selfie-compliance`, etc.).
  - Risk: functions that perform sensitive changes should verify JWTs and enforce authorization. `verify_jwt = false` allows unauthenticated calls — high priority to fix.

- **Audit logging & PII**
  - Login/logout and other user actions are logged to `audit_logs` (`AuthContext` inserts records). This is good for traceability.
  - Recommendation: ensure logs are redacted for PII (avoid storing passwords or full sensitive profiles), set retention policies and restrict access to audit tables.

- **Demo/backdoor flows**
  - `AuthContext` supports a demo session stored in `localStorage` (`ff_erp_demo_session_v1`). Ensure this code path is gated to non-production builds and cannot be enabled in production environments.

- **RLS and DB policy posture**
  - The repo includes RLS-related migrations and scripts (many `migrations/` files with `rls` in names). However, a manual review is required of published policies to confirm correct enforcement on tables like `profiles`, `audit_logs`, `payments`, and `day_starts`.
  - Action: review `supabase/migrations/` SQL files and the DB console to confirm RLS policies block unauthorized access to sensitive rows.

- **Secrets & configuration management**
  - There is a `.env.example` but no `.env` checked in (good). Still: scan git history and CI variables for accidental secrets. Ensure service role keys are only used in server-side contexts (e.g., in edge functions with environment variables, not in client bundles).

- **Edge functions & verify_jwt=false** (critical)
  - Several edge functions marked `verify_jwt = false` are used for onboarding, payroll, analytics and delete/create operations. These need immediate attention: enable `verify_jwt` for functions that should only be callable by authenticated users, and implement additional server-side role checks inside the functions using the JWT claims.

- **Dependency & supply chain**
  - `package.json` lists many third-party libraries (UI, parsers, charting, Supabase client). Run `npm audit` or use a scanner to find known vulnerabilities and upgrade critical packages regularly.

- **Client-side security patterns**
  - Use of `localStorage` for session tokens increases attack surface. The app has many rich client interactions and file export libraries (`html2canvas`, `jspdf`) — ensure data sanitization before rendering user content.


**Missing Pieces & Prioritized Recommendations**
1. **Enable JWT verification for serverless functions** (High) — change `verify_jwt` to `true` for all functions that change data or manage users. Validate user role claims inside each function.
2. **Review RLS policies and least-privilege DB roles** (High) — confirm `profiles`, `audit_logs`, `payments` and sensitive tables have correct RLS policies. Use separate service role for admin operations.
3. **Secret management & key audit** (High) — rotate any compromised keys, ensure service role keys are not present in client bundles or committed. Scan git history for secrets.
4. **Move away from localStorage for tokens where possible** (Medium) — adopt HttpOnly cookies or strong XSS mitigations + CSP. If localStorage must be used, apply strict CSP and input escaping.
5. **Harden audit logging & retention** (Medium) — redact PII, set retention, and apply access controls for logs.
6. **CI/CD checks: dependency scanning and SAST** (Medium) — add automated `npm audit`, dependency pinning, and static analysis in pipelines.
7. **Limit public function exposure & rate limit** (Medium) — add rate limiting or usage guards for functions that perform heavy operations or could be abused.
8. **Document and disable demo mode in prod** (Low) — ensure `DEMO_SESSION_KEY` path is disabled via build-time flags.

**Appendix — Key files inspected**
- [package.json](package.json)
- [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts)
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- [supabase/config.toml](supabase/config.toml)
- `supabase/functions/` (many serverless function handlers)
- `supabase/migrations/` (DB schema & RLS migrations)
- `src/services/` and `src/lib/` (business services and helpers)

If you want, I can now:
- run a focused scan for any committed secrets (quick `git grep` across the repo)
- open and summarize the RLS migration files that refer to `profiles`, `audit_logs` or `payments`
- produce a prioritized remediation PR that updates `supabase/config.toml` function flags and adds JWT checks to functions
