# AI Task & Daily Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build secure OpenRouter-generated daily task drafts, OpenWeather context, internal approval/evidence review, and date-correct attendance/task dashboards on top of the existing Expo SDK 54 and Supabase application.

**Architecture:** A Supabase Edge Function is the only component allowed to call OpenWeather and OpenRouter. PostgreSQL migrations own role-aware RLS, idempotent draft replacement, task approval, evidence state transitions, and Asia/Jakarta dates. Expo screens consume typed Supabase services and preserve the existing explicit foreground-only GPS behavior.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native 0.81, TypeScript 5.9, Supabase Postgres/Auth/Storage/Edge Functions/Cron, Supabase CLI 2.110.0, OpenWeather Current + 5 Day/3 Hour Forecast APIs, OpenRouter Chat Completions structured outputs, Jest 29, React Native Testing Library, pgTAP.

**Approved spec:** `docs/superpowers/specs/2026-07-30-ai-task-operations-design.md`

---

## Guardrails

- Keep Expo at SDK 54. Do not migrate SDK versions in this plan.
- Read `https://docs.expo.dev/versions/v57.0.0/` before code changes, as required by `AGENTS.md`, then use the installed SDK 54 APIs for implementation.
- Never place OpenRouter or OpenWeather credentials in `.env`, `app.json`, or any `EXPO_PUBLIC_*` variable.
- Do not request location, camera, weather, or AI generation on screen mount unless the design explicitly calls for a data read. GPS remains user-triggered.
- Never let a model response write directly to a task table. Validate it and persist through the database RPC.
- Make each database transition idempotent and enforce authorization again in PostgreSQL.
- Use safe Indonesian UI errors. Provider/database details stay in Edge Function logs.
- Apply migrations to a local Supabase stack and run pgTAP before applying them to the hosted project.

## File Map

### Database and backend

- Create `supabase/config.toml` — local Supabase and function configuration.
- Create `supabase/migrations/0005_daily_operations_schema.sql` — new tables, columns, indexes, and backfills.
- Create `supabase/migrations/0006_daily_operations_rpcs.sql` — task draft, evidence, and task-start transitions.
- Create `supabase/migrations/0007_role_aware_operations_rls.sql` — replace broad MVP policies with role-aware policies.
- Create `supabase/tests/database/0005_daily_operations.test.sql` — schema, RPC, and RLS pgTAP coverage.
- Create `supabase/functions/_shared/daily-date.ts` — Asia/Jakarta date helper usable by Edge tests.
- Create `supabase/functions/_shared/weather.ts` — OpenWeather normalization and bounded retry.
- Create `supabase/functions/_shared/openrouter.ts` — prompt, JSON schema, and response validation.
- Create `supabase/functions/_shared/generator.ts` — dependency-injected per-plot generation orchestration.
- Create `supabase/functions/_shared/supabase-generation.ts` — service-role database adapter for generation dependencies.
- Create `supabase/functions/generate-daily-tasks/index.ts` — authenticated Edge Function entry point.
- Create `supabase/functions/_shared/__tests__/*.test.ts` — Node/Jest tests for pure Edge modules.
- Create `supabase/functions/.env.example` — secret names without values.

### Shared app domain and services

- Modify `src/lib/farm-types.ts` — operational task, draft, attendance, generation, and evidence types.
- Create `src/lib/daily-operations.ts` — task state derivation, ordering, and Jakarta date.
- Create `src/lib/__tests__/daily-operations.test.ts`.
- Modify `src/services/tasks.ts` — daily task reads and task-start RPC.
- Modify `src/services/attendance.ts` — date-based attendance read.
- Modify `src/services/evidence.ts` — evidence attempts, signed URLs, registration cleanup, and review.
- Create `src/services/ai-drafts.ts` — list, invoke generation, approve, reject.
- Create `src/services/daily-operations.ts` — internal dashboard aggregation.
- Create `src/services/__tests__/ai-drafts.test.ts`.
- Create `src/services/__tests__/daily-operations.test.ts`.
- Create `src/services/__tests__/evidence-review.test.ts`.

### Components and routes

- Modify `src/components/domain/task-card.tsx`.
- Create `src/components/domain/attendance-row.tsx`.
- Create `src/components/domain/ai-draft-card.tsx`.
- Create `src/components/domain/evidence-attempt-card.tsx`.
- Create matching tests under `src/components/domain/__tests__/`.
- Modify `src/app/(app)/pegawai.tsx`.
- Create `src/app/(app)/daily-operations.tsx`.
- Create `src/app/(app)/ai-tasks/index.tsx`.
- Create `src/app/(app)/ai-tasks/[id].tsx`.
- Create `src/app/(app)/task-review/[id].tsx`.
- Modify `src/app/(app)/petani.tsx`.
- Modify `src/app/(app)/task/[id].tsx`.
- Modify `src/app/(app)/_layout.tsx`.
- Add or update route/screen tests under `src/__tests__/` and co-located route test folders.

### Operations

- Modify `package.json` and `package-lock.json` — pinned Supabase CLI and scripts.
- Modify `tsconfig.json` and `eslint.config.js` — keep Deno entry points out of Expo typecheck/lint.
- Create `docs/runbooks/ai-task-operations-deploy.md` — secrets, migration, Edge deployment, Cron, smoke tests, and rollback.

---

### Task 1: Add reproducible Supabase tooling without changing the Expo runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `eslint.config.js`
- Create: `supabase/config.toml`

- [ ] **Step 1: Capture the green baseline**

Run:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo install --check
```

Expected: typecheck, lint, all 186 existing tests, and Expo dependency validation pass.

- [ ] **Step 2: Install the pinned Supabase CLI**

Run:

```bash
npm install --save-dev supabase@2.110.0
```

Expected: `package.json` and `package-lock.json` change; Expo runtime dependencies do not change.

- [ ] **Step 3: Add local backend scripts**

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db",
    "test:edge": "jest --runInBand supabase/functions/_shared/__tests__"
  }
}
```

Keep all existing scripts.

- [ ] **Step 4: Isolate Deno-only entry points from Expo tooling**

Add an `exclude` key to `tsconfig.json`:

```json
{
  "exclude": [
    "supabase/functions/**/*.ts"
  ]
}
```

Change the ignore block in `eslint.config.js` to:

```js
{
  ignores: ["dist/*", "supabase/functions/**"],
}
```

Pure Edge modules are still tested by Jest explicitly; the thin Deno entry point is compiled by the Supabase Edge runtime.

- [ ] **Step 5: Initialize the local Supabase project**

Run:

```bash
npx supabase init
```

Keep the generated `supabase/config.toml`, then add:

```toml
[functions.generate-daily-tasks]
verify_jwt = false
```

The function performs its own dual authentication: user JWT for manual calls and a shared server secret for Cron.

- [ ] **Step 6: Verify tooling**

Run:

```bash
npx supabase --version
npm run typecheck
npm run lint
```

Expected: Supabase reports `2.110.0`; Expo checks stay green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json eslint.config.js supabase/config.toml
git commit -m "chore: add Supabase operations tooling"
```

---

### Task 2: Add daily operations schema, dates, and immutable evidence fields

**Files:**
- Create: `supabase/migrations/0005_daily_operations_schema.sql`
- Create: `supabase/tests/database/0005_daily_operations.test.sql`

- [ ] **Step 1: Write the failing pgTAP schema assertions**

Create `supabase/tests/database/0005_daily_operations.test.sql` with the initial schema block:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

select has_table('public', 'weather_snapshots', 'weather snapshots exist');
select has_table('public', 'ai_generation_runs', 'generation runs exist');
select has_table('public', 'ai_generation_targets', 'generation targets exist');
select has_table('public', 'ai_task_drafts', 'AI drafts exist');

select has_column('public', 'tasks', 'scheduled_for', 'tasks have work date');
select has_column('public', 'tasks', 'priority', 'tasks have priority');
select has_column('public', 'tasks', 'source', 'tasks have source');
select has_column('public', 'tasks', 'source_draft_id', 'tasks link to draft');
select has_column('public', 'tasks', 'ai_reason', 'tasks keep AI reason');

select has_column('public', 'task_evidence', 'attempt_number', 'evidence has attempt');
select has_column('public', 'task_evidence', 'review_status', 'evidence has review status');
select has_column('public', 'task_evidence', 'reviewed_by', 'evidence has reviewer');
select has_column('public', 'task_evidence', 'review_note', 'evidence has review note');
select has_column('public', 'task_evidence', 'reviewed_at', 'evidence has review time');
select has_column('public', 'absensi', 'attendance_date', 'attendance has Jakarta date');

select col_not_null('public', 'tasks', 'scheduled_for', 'task date is required');
select col_not_null('public', 'task_evidence', 'attempt_number', 'attempt is required');
select col_not_null('public', 'task_evidence', 'review_status', 'review status is required');
select col_not_null('public', 'absensi', 'attendance_date', 'attendance date is required');

select has_index('public', 'ai_generation_targets_one_current_idx', 'one current target index exists');
select has_index('public', 'task_evidence_one_pending_idx', 'one pending evidence index exists');
select has_index('public', 'absensi_farmer_plot_date_idx', 'daily attendance uniqueness exists');
select has_index('public', 'tasks_scheduled_assignee_idx', 'daily farmer task index exists');

select col_has_check('public', 'ai_task_drafts', 'status', 'draft status is constrained');
select col_has_check('public', 'ai_task_drafts', 'priority', 'draft priority is constrained');
select col_has_check('public', 'task_evidence', 'review_status', 'review status is constrained');
select col_has_check('public', 'tasks', 'priority', 'task priority is constrained');
select col_has_check('public', 'tasks', 'source', 'task source is constrained');

select * from finish();
rollback;
```

- [ ] **Step 2: Run the database test and verify RED**

Run:

```bash
npm run supabase:start
npm run db:reset
npm run db:test
```

Expected: pgTAP reports missing daily operations tables/columns.

- [ ] **Step 3: Create the schema migration**

Create `supabase/migrations/0005_daily_operations_schema.sql`. Use this structure and exact constraints:

```sql
create table public.weather_snapshots (
  id uuid primary key default gen_random_uuid(),
  lahan_id uuid not null references public.lahan(id) on delete cascade,
  provider text not null default 'openweather'
    check (provider = 'openweather'),
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  current_data jsonb not null,
  forecast_data jsonb not null,
  created_at timestamptz not null default now()
);

create table public.ai_generation_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron', 'manual')),
  scheduled_for date not null,
  requested_by uuid references public.users(id) on delete set null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  model text not null,
  plot_count integer not null check (plot_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  warning_summary jsonb not null default '[]'::jsonb,
  provider_usage jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.ai_generation_targets (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_generation_runs(id) on delete cascade,
  lahan_id uuid not null references public.lahan(id) on delete cascade,
  scheduled_for date not null,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'skipped', 'failed')),
  draft_count integer not null default 0 check (draft_count between 0 and 5),
  weather_snapshot_id uuid references public.weather_snapshots(id) on delete set null,
  result_summary text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (run_id, lahan_id),
  unique (lahan_id, scheduled_for, version)
);

create unique index ai_generation_targets_one_current_idx
  on public.ai_generation_targets(lahan_id, scheduled_for)
  where is_current;

create table public.ai_task_drafts (
  id uuid primary key default gen_random_uuid(),
  generation_target_id uuid not null
    references public.ai_generation_targets(id) on delete cascade,
  lahan_id uuid not null references public.lahan(id) on delete cascade,
  proposed_assignee_id uuid not null references public.users(id),
  scheduled_for date not null,
  judul text not null check (char_length(judul) between 3 and 120),
  deskripsi text not null check (char_length(deskripsi) between 10 and 1500),
  priority text not null check (priority in ('low', 'medium', 'high')),
  requires_location boolean not null default true,
  ai_reason text not null check (char_length(ai_reason) between 3 and 800),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'superseded')),
  model text not null,
  weather_snapshot_id uuid not null references public.weather_snapshots(id),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_task_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column scheduled_for date,
  add column priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  add column source text not null default 'manual'
    check (source in ('manual', 'ai')),
  add column source_draft_id uuid unique
    references public.ai_task_drafts(id) on delete set null,
  add column ai_reason text;

update public.tasks
set scheduled_for = (created_at at time zone 'Asia/Jakarta')::date
where scheduled_for is null;

alter table public.tasks alter column scheduled_for set not null;

alter table public.ai_task_drafts
  add constraint ai_task_drafts_created_task_fkey
  foreign key (created_task_id) references public.tasks(id) on delete set null;

alter table public.task_evidence
  add column attempt_number integer,
  add column review_status text,
  add column reviewed_by uuid references public.users(id) on delete set null,
  add column review_note text,
  add column reviewed_at timestamptz;

with numbered as (
  select e.id,
         t.status as task_status,
         row_number() over (
           partition by e.task_id order by e.created_at, e.id
         )::integer as attempt_number,
         row_number() over (
           partition by e.task_id order by e.created_at desc, e.id desc
         )::integer as latest_number
  from public.task_evidence e
  join public.tasks t on t.id = e.task_id
)
update public.task_evidence e
set attempt_number = n.attempt_number,
    review_status = case
      when n.task_status = 'selesai' then 'accepted'
      when n.latest_number = 1 then 'pending'
      else 'revision_requested'
    end,
    review_note = case
      when n.task_status <> 'selesai' and n.latest_number > 1
        then 'Bukti historis sebelum alur review.'
      else null
    end
from numbered n
where e.id = n.id;

alter table public.task_evidence
  alter column attempt_number set not null,
  alter column review_status set not null,
  add constraint task_evidence_attempt_positive check (attempt_number > 0),
  add constraint task_evidence_review_status_check
    check (review_status in ('pending', 'accepted', 'revision_requested')),
  add constraint task_evidence_task_attempt_unique unique (task_id, attempt_number);

create unique index task_evidence_one_pending_idx
  on public.task_evidence(task_id)
  where review_status = 'pending';

alter table public.absensi add column attendance_date date;

update public.absensi
set attendance_date = (waktu_masuk at time zone 'Asia/Jakarta')::date
where attendance_date is null;

alter table public.absensi
  alter column attendance_date
    set default ((now() at time zone 'Asia/Jakarta')::date),
  alter column attendance_date set not null;

create unique index absensi_farmer_plot_date_idx
  on public.absensi(farmer_id, lahan_id, attendance_date);

create index tasks_scheduled_assignee_idx
  on public.tasks(scheduled_for, assigned_to, status);

create index ai_task_drafts_review_idx
  on public.ai_task_drafts(scheduled_for, status, proposed_assignee_id);

create index weather_snapshots_plot_created_idx
  on public.weather_snapshots(lahan_id, created_at desc);
```

If hosted data contains duplicate same-day attendance rows, stop before applying the unique index, report those IDs, and resolve them explicitly; do not silently delete operational records.

- [ ] **Step 4: Reset and verify GREEN**

Run:

```bash
npm run db:reset
npm run db:test
```

Expected: all 28 pgTAP assertions pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_daily_operations_schema.sql supabase/tests/database/0005_daily_operations.test.sql
git commit -m "feat: add daily operations schema"
```

---

### Task 3: Add transactional draft, task, and evidence RPCs

**Files:**
- Create: `supabase/migrations/0006_daily_operations_rpcs.sql`
- Modify: `supabase/tests/database/0005_daily_operations.test.sql`

- [ ] **Step 1: Extend pgTAP with RPC and transition tests**

Increase the pgTAP plan count and add assertions for these exact signatures:

```sql
select has_function(
  'public',
  'replace_ai_task_drafts',
  array['uuid', 'uuid', 'date', 'uuid', 'text', 'text', 'jsonb'],
  'replace draft RPC exists'
);
select has_function(
  'public',
  'record_ai_generation_target',
  array['uuid', 'uuid', 'date', 'text', 'text', 'text', 'uuid'],
  'record skipped or failed generation target RPC exists'
);
select has_function(
  'public',
  'approve_ai_task_draft',
  array['uuid', 'uuid', 'text', 'text', 'text', 'boolean'],
  'approve draft RPC exists'
);
select has_function(
  'public',
  'bulk_approve_ai_task_drafts',
  array['uuid[]'],
  'bulk approve draft RPC exists'
);
select has_function(
  'public',
  'reject_ai_task_draft',
  array['uuid', 'text'],
  'reject draft RPC exists'
);
select has_function(
  'public',
  'start_assigned_task',
  array['uuid'],
  'start task RPC exists'
);
select has_function(
  'public',
  'register_task_evidence',
  array['uuid', 'text', 'text', 'numeric', 'numeric', 'text'],
  'register evidence RPC exists'
);
select has_function(
  'public',
  'review_task_evidence',
  array['uuid', 'text', 'text'],
  'review evidence RPC exists'
);
```

Add fixtures for one internal user, two farmers, one plot, one run, one weather snapshot, and one pending draft. Assert:

- replacing with six drafts throws `AI_DRAFT_LIMIT`;
- approving twice throws `DRAFT_NOT_PENDING`;
- bulk approval creates one task per selected pending draft and rolls back all
  inserts if any selected draft is not pending;
- a farmer cannot approve a draft;
- evidence registration derives `farmer_id`, `lahan_id`, and attempt number from the assigned task;
- location-required evidence rejects missing or outside-radius coordinates;
- a second pending attempt throws `EVIDENCE_PENDING_REVIEW`;
- accepting evidence changes the task to `selesai`;
- revision requires a note and keeps the task `sedang_dikerjakan`.

- [ ] **Step 2: Run pgTAP and verify RED**

Run:

```bash
npm run db:reset
npm run db:test
```

Expected: missing RPC assertions fail.

- [ ] **Step 3: Implement role and generation helpers**

Create `supabase/migrations/0006_daily_operations_rpcs.sql` beginning with:

```sql
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role from public.users u where u.id = auth.uid()
$$;

create or replace function public.is_internal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'internal'::public.user_role, false)
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_internal() to authenticated;
```

Implement
`replace_ai_task_drafts(p_run_id uuid, p_lahan_id uuid, p_scheduled_for date,
p_weather_snapshot_id uuid, p_model text, p_result_summary text, p_drafts jsonb)`
as `security definer`, granted only to `service_role`. The proposed assignee is
derived from the active plot's current `farmer_id`. It must:

1. reject `jsonb_array_length(p_drafts) > 5` with `AI_DRAFT_LIMIT`;
2. take `pg_advisory_xact_lock(hashtextextended(p_lahan_id::text || ':' || p_scheduled_for::text, 0))`;
3. verify the run, active plot, farmer assignee, and weather snapshot;
4. mark the previous target non-current;
5. update only previous `pending` drafts to `superseded`;
6. create the next target version;
7. validate every JSON record while inserting drafts;
8. mark the target succeeded with the exact draft count;
9. return the new target ID.

Use this JSON extraction shape:

```sql
from jsonb_to_recordset(p_drafts) as draft(
  judul text,
  deskripsi text,
  priority text,
  requires_location boolean,
  ai_reason text
)
```

Revoke public access explicitly:

```sql
revoke all on function public.replace_ai_task_drafts(
  uuid, uuid, date, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_ai_task_drafts(
  uuid, uuid, date, uuid, text, text, jsonb
) to service_role;
```

Implement `record_ai_generation_target` with parameters
`(p_run_id uuid, p_lahan_id uuid, p_scheduled_for date, p_status text,
p_error_code text, p_result_summary text, p_weather_snapshot_id uuid)`.
It must allow only `skipped` or `failed`, acquire the same advisory lock used by
`replace_ai_task_drafts`, mark the previous target non-current, supersede only its
pending drafts, insert the next version with zero drafts, and set `completed_at`.
Revoke it from `public`, `anon`, and `authenticated`; grant it only to
`service_role`.

- [ ] **Step 4: Implement approval and rejection**

`approve_ai_task_draft` must lock the draft, require `public.is_internal()`, require `pending`, verify an active plot and a `farmer` assignee, insert one task, then link both rows:

```sql
insert into public.tasks (
  lahan_id,
  assigned_to,
  assigned_by,
  judul,
  deskripsi,
  status,
  scheduled_for,
  priority,
  source,
  source_draft_id,
  ai_reason,
  requires_location
) values (
  draft.lahan_id,
  p_assignee_id,
  auth.uid(),
  trim(p_judul),
  nullif(trim(p_deskripsi), ''),
  'belum_dikerjakan',
  draft.scheduled_for,
  p_priority,
  'ai',
  draft.id,
  draft.ai_reason,
  p_requires_location
) returning id into task_id;

update public.ai_task_drafts
set status = 'approved',
    proposed_assignee_id = p_assignee_id,
    judul = trim(p_judul),
    deskripsi = trim(p_deskripsi),
    priority = p_priority,
    requires_location = p_requires_location,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    created_task_id = task_id,
    updated_at = now()
where id = draft.id;
```

`reject_ai_task_draft` must require internal role, pending status, and a trimmed reason of at least three characters. Grant both RPCs to `authenticated`.

`bulk_approve_ai_task_drafts(p_draft_ids uuid[])` must require internal role,
between one and 50 unique IDs, lock all selected drafts in deterministic ID order,
and reject the entire transaction unless every requested draft is still pending.
For each row, call the same approval transition with the stored proposed
assignee, title, description, priority, and location requirement. Return the
created task UUIDs in input order. Grant it to `authenticated`; a duplicate or
stale selection must create zero tasks.

- [ ] **Step 5: Implement farmer task/evidence transitions**

`start_assigned_task` must require `assigned_to = auth.uid()`, reject a completed task, and update only:

```sql
status = 'sedang_dikerjakan',
unlocked_at = coalesce(unlocked_at, now())
```

`register_task_evidence` must:

- lock the assigned task;
- reject completed or non-owned tasks;
- reject when a pending attempt exists;
- require `p_photo_path` to start with
  `auth.uid()::text || '/' || p_task_id::text || '/'`;
- require a trimmed optional note of at most 1,500 characters;
- reject one-sided, non-finite, or out-of-range coordinates;
- when `requires_location` is true, require both coordinates and reject a
  haversine distance greater than the assigned plot's
  `radius_geofence_m`;
- derive `farmer_id`, `lahan_id`, and `attempt_number`;
- insert `review_status = 'pending'`;
- set task status to `sedang_dikerjakan`;
- return the evidence row.

`review_task_evidence` must require internal role, lock a pending evidence row, accept only `accepted` or `revision_requested`, require a non-empty revision note, update review metadata, and atomically set the task:

```sql
status = case
  when p_decision = 'accepted' then 'selesai'::task_status
  else 'sedang_dikerjakan'::task_status
end
```

Grant farmer transition RPCs to `authenticated`; authorization remains inside each function.
Bound a revision note to 3–1,000 characters and a rejection reason to 3–1,000
characters before writing either field.

- [ ] **Step 6: Verify all database transitions**

Run:

```bash
npm run db:reset
npm run db:test
```

Expected: schema and RPC tests pass, including double-submit and role failures.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0006_daily_operations_rpcs.sql supabase/tests/database/0005_daily_operations.test.sql
git commit -m "feat: add operational task transitions"
```

---

### Task 4: Replace broad MVP policies with role-aware RLS

**Files:**
- Create: `supabase/migrations/0007_role_aware_operations_rls.sql`
- Modify: `supabase/tests/database/0005_daily_operations.test.sql`

- [ ] **Step 1: Add the failing RLS matrix**

Add pgTAP fixtures with:

- internal user;
- farmer A owning plot A and task A;
- farmer B owning plot B;
- task B assigned to farmer A but referencing plot B;
- attendance and evidence for both farmers;
- one AI draft/run/target/weather snapshot.

Use `set_config('request.jwt.claims', ...)` to impersonate each user. Assert:

- internal reads all operational rows;
- farmer A reads plot A and plot B because task B is assigned to A;
- farmer A reads only tasks, attendance, and evidence owned by A;
- farmer B cannot read farmer A rows;
- no farmer reads AI drafts/runs/targets/weather snapshots;
- farmer cannot update task to `selesai` directly;
- internal cannot bypass evidence review with a direct task status update;
- farmer cannot insert `task_evidence` directly or forge review fields;
- farmer cannot update evidence review fields directly;
- farmer can delete an unregistered own-path storage object after an RPC failure
  but cannot delete an object referenced by immutable evidence;
- anonymous cannot read operational tables.

- [ ] **Step 2: Verify RED against broad MVP policies**

Run:

```bash
npm run db:reset
npm run db:test
```

Expected: cross-farmer and AI-table privacy assertions fail.

- [ ] **Step 3: Implement role-aware policies**

Create `supabase/migrations/0007_role_aware_operations_rls.sql`. Enable RLS on all new tables, then drop the broad policies by their existing names:

```sql
drop policy if exists "auth read users for assignment" on public.users;
drop policy if exists "auth read lahan" on public.lahan;
drop policy if exists "auth write lahan" on public.lahan;
drop policy if exists "auth read absensi" on public.absensi;
drop policy if exists "auth write absensi" on public.absensi;
drop policy if exists "auth read tasks" on public.tasks;
drop policy if exists "auth write tasks" on public.tasks;
drop policy if exists "auth read task evidence" on public.task_evidence;
drop policy if exists "auth write own task evidence" on public.task_evidence;
drop policy if exists "task evidence authenticated read" on storage.objects;
drop policy if exists "task evidence owner insert" on storage.objects;
drop policy if exists "task evidence owner delete" on storage.objects;
```

Add `security definer` helpers:

```sql
create or replace function public.can_access_plot(p_lahan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_internal()
    or exists (
      select 1 from public.lahan l
      where l.id = p_lahan_id and l.farmer_id = auth.uid()
    )
    or exists (
      select 1 from public.tasks t
      where t.lahan_id = p_lahan_id and t.assigned_to = auth.uid()
    )
$$;
```

Create policies with these predicates:

```sql
-- users select
auth.uid() = id or public.is_internal()

-- lahan select
public.can_access_plot(id)

-- lahan insert/update/delete
public.is_internal()

-- tasks select
public.is_internal() or assigned_to = auth.uid()

-- tasks insert
-- insert: manual tasks only start unstarted
public.is_internal()
and status = 'belum_dikerjakan'
and source = 'manual'
and source_draft_id is null

-- absensi select
public.is_internal() or farmer_id = auth.uid()

-- absensi insert
farmer_id = auth.uid()
and status_geofence = 'valid'
and exists (
  select 1 from public.lahan l
  where l.id = lahan_id
    and l.farmer_id = auth.uid()
    and l.status = 'aktif'
)

-- task_evidence select
public.is_internal() or farmer_id = auth.uid()

-- AI tables and weather snapshots select
public.is_internal()
```

Do not create direct insert/update/delete policies on `task_evidence` for
authenticated users. Registration and review use the constrained RPCs only.
Do not create direct update/delete policies on `tasks`; preserving task/evidence
audit history takes precedence over direct table mutation. AI approval, farmer
start, and evidence review remain constrained `security definer` transitions.

Replace storage read policy with:

```sql
create policy "task evidence scoped read" on storage.objects
for select using (
  bucket_id = 'task-evidence'
  and (
    public.is_internal()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);
```

Keep the existing owner-path insert policy.
Replace the existing owner-path insert policy so its second path segment must be
the UUID of a non-completed task assigned to the current farmer:

```sql
bucket_id = 'task-evidence'
and auth.uid()::text = (storage.foldername(name))[1]
and exists (
  select 1 from public.tasks t
  where t.id::text = (storage.foldername(name))[2]
    and t.assigned_to = auth.uid()
    and t.status <> 'selesai'
)
```

Add a narrowly scoped owner-path delete policy for cleanup only. It must require
the same farmer/task path ownership and refuse deletion once any evidence row
references the object:

```sql
bucket_id = 'task-evidence'
and auth.uid()::text = (storage.foldername(name))[1]
and exists (
  select 1 from public.tasks t
  where t.id::text = (storage.foldername(name))[2]
    and t.assigned_to = auth.uid()
)
and not exists (
  select 1 from public.task_evidence e
  where e.photo_path = storage.objects.name
)
```

- [ ] **Step 4: Verify RLS GREEN**

Run:

```bash
npm run db:reset
npm run db:test
```

Expected: all role matrix assertions pass.

- [ ] **Step 5: Run existing client service tests**

Run:

```bash
npm test -- --runInBand src/services/__tests__/farm-services.test.ts
```

Expected: existing mapping and storage path tests pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_role_aware_operations_rls.sql supabase/tests/database/0005_daily_operations.test.sql
git commit -m "feat: enforce operational role policies"
```

---

### Task 5: Add Jakarta dates and operational domain types

**Files:**
- Modify: `src/lib/farm-types.ts`
- Create: `src/lib/daily-operations.ts`
- Create: `src/lib/__tests__/daily-operations.test.ts`

- [ ] **Step 1: Write failing date and state tests**

Create `src/lib/__tests__/daily-operations.test.ts`:

```ts
import {
  deriveTaskOperationalState,
  jakartaDate,
  sortDailyTasks,
} from '../daily-operations';
import type { FarmTask } from '../farm-types';

const task = (overrides: Partial<FarmTask> = {}): FarmTask => ({
  id: 'task-1',
  lahanId: 'plot-1',
  assignedTo: 'farmer-1',
  assignedBy: 'internal-1',
  judul: 'Periksa irigasi',
  deskripsi: null,
  status: 'belum_dikerjakan',
  deadline: null,
  scheduledFor: '2026-07-30',
  priority: 'medium',
  source: 'ai',
  aiReason: 'Hujan rendah.',
  requiresLocation: true,
  unlockedAt: null,
  latestEvidence: null,
  ...overrides,
});

test('formats the calendar date in Asia/Jakarta', () => {
  expect(jakartaDate(new Date('2026-07-29T22:00:00.000Z'))).toBe('2026-07-30');
});

test.each([
  [task(), 'not-started'],
  [task({ latestEvidence: { status: 'pending', reviewNote: null } }), 'pending-review'],
  [task({ latestEvidence: { status: 'revision_requested', reviewNote: 'Foto ulang' } }), 'revision-needed'],
  [task({ status: 'selesai', latestEvidence: { status: 'accepted', reviewNote: null } }), 'completed'],
])('derives evidence-aware task state', (input, expected) => {
  expect(deriveTaskOperationalState(input)).toBe(expected);
});

test('orders revision, high priority, pending, then completed', () => {
  const result = sortDailyTasks([
    task({ id: 'done', status: 'selesai', latestEvidence: { status: 'accepted', reviewNote: null } }),
    task({ id: 'pending', latestEvidence: { status: 'pending', reviewNote: null } }),
    task({ id: 'normal' }),
    task({ id: 'high', priority: 'high' }),
    task({ id: 'revision', latestEvidence: { status: 'revision_requested', reviewNote: 'Ulangi' } }),
  ]);
  expect(result.map(({ id }) => id)).toEqual([
    'revision',
    'high',
    'normal',
    'pending',
    'done',
  ]);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/daily-operations.test.ts
```

Expected: module/types are missing.

- [ ] **Step 3: Add the domain types**

Extend `src/lib/farm-types.ts` with:

```ts
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskSource = 'manual' | 'ai';
export type EvidenceReviewStatus =
  | 'pending'
  | 'accepted'
  | 'revision_requested';
export type AiDraftStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'superseded';
export type GenerationStatus = 'running' | 'succeeded' | 'partial' | 'failed';

export type LatestEvidenceSummary = {
  status: EvidenceReviewStatus;
  reviewNote: string | null;
};

export type AttendanceRecord = {
  id: string;
  farmerId: string;
  farmerName: string;
  plotId: string;
  plotName: string;
  attendanceDate: string;
  checkedInAt: string;
  distanceM: number | null;
  latitude: number;
  longitude: number;
};

export type DraftWeatherSummary = {
  observedAt: string;
  description: string;
  temperatureC: number;
  humidityPercent: number;
  windSpeedMps: number;
  rainMm: number;
  forecastMinTemperatureC: number | null;
  forecastMaxTemperatureC: number | null;
  forecastMaxRainProbability: number | null;
};

export type AiTaskDraft = {
  id: string;
  plotId: string;
  plotName: string;
  proposedAssigneeId: string;
  proposedAssigneeName: string;
  scheduledFor: string;
  title: string;
  description: string;
  priority: TaskPriority;
  requiresLocation: boolean;
  aiReason: string;
  status: AiDraftStatus;
  model: string;
  weather: DraftWeatherSummary;
  createdAt: string;
};

export type EvidenceAttempt = {
  id: string;
  taskId: string;
  attemptNumber: number;
  photoPath: string;
  photoUrl: string | null;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  status: EvidenceReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type OperationalTask = {
  task: FarmTask;
  plotName: string;
  farmerName: string;
};
```

Extend `FarmTask` with:

```ts
scheduledFor: string;
priority: TaskPriority;
source: TaskSource;
aiReason: string | null;
latestEvidence: LatestEvidenceSummary | null;
```

- [ ] **Step 4: Implement the pure helper**

Create `src/lib/daily-operations.ts`:

```ts
import type { FarmTask } from './farm-types';

export type TaskOperationalState =
  | 'not-started'
  | 'ready'
  | 'pending-review'
  | 'revision-needed'
  | 'completed';

export function jakartaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function deriveTaskOperationalState(task: FarmTask): TaskOperationalState {
  if (task.latestEvidence?.status === 'revision_requested') return 'revision-needed';
  if (task.latestEvidence?.status === 'pending') return 'pending-review';
  if (task.status === 'selesai' || task.latestEvidence?.status === 'accepted') {
    return 'completed';
  }
  return task.status === 'sedang_dikerjakan' ? 'ready' : 'not-started';
}

const stateRank: Record<TaskOperationalState, number> = {
  'revision-needed': 0,
  'not-started': 2,
  ready: 2,
  'pending-review': 3,
  completed: 4,
};
const priorityRank = { high: 0, medium: 1, low: 2 } as const;

export function sortDailyTasks(tasks: FarmTask[]): FarmTask[] {
  return [...tasks].sort((a, b) => {
    const stateDifference =
      stateRank[deriveTaskOperationalState(a)] -
      stateRank[deriveTaskOperationalState(b)];
    return stateDifference || priorityRank[a.priority] - priorityRank[b.priority];
  });
}
```

- [ ] **Step 5: Update existing task fixtures**

Update every `FarmTask` fixture in current tests with:

```ts
scheduledFor: '2026-07-30',
priority: 'medium',
source: 'manual',
aiReason: null,
latestEvidence: null,
```

Do not change the behavior asserted by existing GPS tests.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/daily-operations.test.ts src/components/domain/__tests__/task-card.test.tsx src/__tests__/petani-dashboard.test.tsx
npm run typecheck
```

Expected: new helper tests and updated existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/farm-types.ts src/lib/daily-operations.ts src/lib/__tests__/daily-operations.test.ts src/__tests__/petani-dashboard.test.tsx src/app/'(app)'/task/__tests__/task-detail.test.tsx src/components/domain/__tests__/task-card.test.tsx
git commit -m "feat: add daily operations domain model"
```

---

### Task 6: Implement and test the OpenWeather adapter

**Files:**
- Create: `supabase/functions/_shared/daily-date.ts`
- Create: `supabase/functions/_shared/weather.ts`
- Create: `supabase/functions/_shared/__tests__/weather.test.ts`

- [ ] **Step 1: Write failing normalization and retry tests**

Create `supabase/functions/_shared/__tests__/weather.test.ts` using injected `fetch`:

```ts
import {
  fetchOpenWeather,
  normalizeOpenWeather,
} from '../weather';

test('keeps only forecast entries on the requested Jakarta date', () => {
  const result = normalizeOpenWeather({
    scheduledFor: '2026-07-30',
    current: {
      dt: 1785362400,
      main: { temp: 28, humidity: 80 },
      wind: { speed: 2.5 },
      weather: [{ id: 500, description: 'hujan ringan' }],
      rain: { '1h': 0.4 },
    },
    forecast: {
      list: [
        {
          dt: 1785362400,
          main: { temp: 28, temp_min: 27, temp_max: 29, humidity: 80 },
          wind: { speed: 2.5 },
          weather: [{ id: 500, description: 'hujan ringan' }],
          pop: 0.7,
          rain: { '3h': 1.2 },
        },
        {
          dt: 1785448800,
          main: { temp: 27, temp_min: 26, temp_max: 28, humidity: 84 },
          wind: { speed: 2 },
          weather: [{ id: 801, description: 'berawan' }],
          pop: 0.2,
        },
      ],
    },
  });
  expect(result.forecast).toHaveLength(1);
  expect(result.current.temperatureC).toBe(28);
});

test('retries one transient failure and returns normalized weather', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(new Response('temporary', { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      dt: 1785362400,
      main: { temp: 28, humidity: 80 },
      wind: { speed: 2 },
      weather: [{ id: 800, description: 'cerah' }],
    })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ list: [] })));

  await expect(fetchOpenWeather({
    latitude: -7.25,
    longitude: 112.76,
    scheduledFor: '2026-07-30',
    apiKey: 'test-key',
    fetcher,
  })).resolves.toMatchObject({ current: { temperatureC: 28 } });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand supabase/functions/_shared/__tests__/weather.test.ts
```

Expected: adapter modules are missing.

- [ ] **Step 3: Implement date conversion and normalized weather**

`supabase/functions/_shared/daily-date.ts` exports:

```ts
export function jakartaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function epochToJakartaDate(seconds: number): string {
  return jakartaDate(new Date(seconds * 1000));
}
```

`weather.ts` must:

- build both `/data/2.5/weather` and `/data/2.5/forecast` URLs with `units=metric` and `lang=id`;
- retry only `429` and `5xx` once;
- apply a per-request timeout with `AbortController`;
- reject non-JSON and non-success responses with safe internal error codes;
- normalize fields into bounded JSON;
- filter forecast entries with `epochToJakartaDate(entry.dt) === scheduledFor`.

Export:

```ts
export type NormalizedWeather = {
  observedAt: string;
  current: {
    conditionCode: number;
    description: string;
    temperatureC: number;
    humidityPercent: number;
    windSpeedMps: number;
    rainMm: number;
  };
  forecast: Array<{
    timestamp: string;
    conditionCode: number;
    description: string;
    temperatureC: number;
    minTemperatureC: number;
    maxTemperatureC: number;
    humidityPercent: number;
    windSpeedMps: number;
    rainProbability: number;
    rainMm: number;
  }>;
};
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm test -- --runInBand supabase/functions/_shared/__tests__/weather.test.ts
```

Expected: current/forecast normalization, date filtering, retry, timeout, and safe errors pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/daily-date.ts supabase/functions/_shared/weather.ts supabase/functions/_shared/__tests__/weather.test.ts
git commit -m "feat: add OpenWeather task context"
```

---

### Task 7: Implement strict OpenRouter task generation

**Files:**
- Create: `supabase/functions/_shared/openrouter.ts`
- Create: `supabase/functions/_shared/__tests__/openrouter.test.ts`

- [ ] **Step 1: Write failing request and validator tests**

Cover:

```ts
import {
  buildOpenRouterRequest,
  parseOpenRouterDrafts,
} from '../openrouter';

test('requires strict structured output from the configured model', () => {
  const request = buildOpenRouterRequest({
    model: 'provider/model',
    plot: {
      name: 'Sawah Utara',
      crop: 'Padi',
      phase: 'Vegetatif',
      areaHectares: 2,
    },
    weather: {
      current: {
        conditionCode: 500,
        description: 'hujan ringan',
        temperatureC: 28,
        humidityPercent: 80,
        windSpeedMps: 2,
        rainMm: 0.4,
      },
      forecast: [],
    },
    recentTasks: [],
  });
  expect(request.model).toBe('provider/model');
  expect(request.response_format).toMatchObject({
    type: 'json_schema',
    json_schema: { strict: true },
  });
  expect(request.provider).toEqual({ require_parameters: true });
});

test('accepts zero through five validated drafts', () => {
  expect(parseOpenRouterDrafts(JSON.stringify({
    summary: 'Tidak ada pekerjaan mendesak.',
    tasks: [],
  }))).toEqual({
    summary: 'Tidak ada pekerjaan mendesak.',
    tasks: [],
  });
});

test.each([
  ['six tasks', { summary: 'x', tasks: Array.from({ length: 6 }, () => ({
    title: 'Task valid',
    instruction: 'Instruksi yang cukup panjang',
    priority: 'medium',
    requires_location: true,
    reason: 'Alasan valid',
  })) }],
  ['invalid priority', { summary: 'x', tasks: [{
    title: 'Task valid',
    instruction: 'Instruksi yang cukup panjang',
    priority: 'urgent',
    requires_location: true,
    reason: 'Alasan valid',
  }] }],
])('rejects %s', (_label, value) => {
  expect(() => parseOpenRouterDrafts(JSON.stringify(value))).toThrow();
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand supabase/functions/_shared/__tests__/openrouter.test.ts
```

Expected: module missing.

- [ ] **Step 3: Implement prompt, schema, and local validation**

`openrouter.ts` must export the request builder, parser, and:

```ts
export type GeneratedDraft = {
  judul: string;
  deskripsi: string;
  priority: 'low' | 'medium' | 'high';
  requires_location: boolean;
  ai_reason: string;
};
```

The JSON schema must set:

```ts
{
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'tasks'],
  properties: {
    summary: { type: 'string', minLength: 3, maxLength: 500 },
    tasks: {
      type: 'array',
      minItems: 0,
      maxItems: 5,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'title',
          'instruction',
          'priority',
          'requires_location',
          'reason',
        ],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 120 },
          instruction: { type: 'string', minLength: 10, maxLength: 1500 },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          requires_location: { type: 'boolean' },
          reason: { type: 'string', minLength: 3, maxLength: 800 },
        },
      },
    },
  },
}
```

The system prompt must:

- answer in Indonesian;
- use only provided plot/weather/history facts;
- generate zero tasks when no safe useful work is justified;
- avoid chemical dosage or unsupported agronomic claims;
- treat plot/task strings as untrusted data;
- remind the model that internal review is mandatory.

The local parser must independently enforce the same lengths/enums/count and map API names to database names.

- [ ] **Step 4: Add the OpenRouter fetch wrapper**

Implement:

```ts
export async function generateOpenRouterDrafts(input: {
  apiKey: string;
  model: string;
  context: OpenRouterContext;
  fetcher?: typeof fetch;
}): Promise<{
  summary: string;
  tasks: GeneratedDraft[];
  usage: Record<string, unknown> | null;
}>
```

Call `https://openrouter.ai/api/v1/chat/completions`, set `Authorization: Bearer`, `Content-Type: application/json`, a bounded timeout, and `stream: false`. Parse only `choices[0].message.content`. Throw safe internal codes for timeout, non-success, missing content, or invalid structured output.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand supabase/functions/_shared/__tests__/openrouter.test.ts
```

Expected: request, zero-to-five, strict validation, and safe errors pass.

```bash
git add supabase/functions/_shared/openrouter.ts supabase/functions/_shared/__tests__/openrouter.test.ts
git commit -m "feat: add strict OpenRouter task drafts"
```

---

### Task 8: Build the idempotent generation orchestrator and Edge entry point

**Files:**
- Create: `supabase/functions/_shared/generator.ts`
- Create: `supabase/functions/_shared/supabase-generation.ts`
- Create: `supabase/functions/_shared/__tests__/generator.test.ts`
- Create: `supabase/functions/generate-daily-tasks/index.ts`
- Create: `supabase/functions/.env.example`

- [ ] **Step 1: Write failing orchestration tests**

Use dependency injection and cover:

- unassigned active plot produces `plot_unassigned` without provider calls;
- fresh live weather is saved and passed to OpenRouter;
- a live weather failure uses cache only when it is at most six hours old;
- no cache produces `weather_unavailable`;
- invalid model output fails only that plot;
- zero task response still replaces pending drafts with an empty current target;
- cron skips a plot/date that already has a successful current target without
  replacing/superseding that target;
- manual generation replaces pending drafts;
- successful and failed plot counts produce `succeeded`, `partial`, or `failed`.

The core test shape:

```ts
const result = await generateDailyTasks(
  {
    trigger: 'manual',
    scheduledFor: '2026-07-30',
    requestedBy: 'internal-1',
    plotIds: ['plot-1'],
  },
  {
    listPlots: jest.fn().mockResolvedValue([plot]),
    listRecentTasks: jest.fn().mockResolvedValue([]),
    findCurrentTarget: jest.fn().mockResolvedValue(null),
    findWeatherCache: jest.fn().mockResolvedValue(null),
    saveWeather: jest.fn().mockResolvedValue('weather-1'),
    fetchWeather: jest.fn().mockResolvedValue(weather),
    generateDrafts: jest.fn().mockResolvedValue({
      summary: 'Dua pekerjaan',
      tasks: generatedTasks,
      usage: null,
    }),
    createRun: jest.fn().mockResolvedValue('run-1'),
    replaceDrafts: jest.fn().mockResolvedValue('target-1'),
    recordTargetResult: jest.fn().mockResolvedValue(undefined),
    finishRun: jest.fn().mockResolvedValue(undefined),
    now: () => new Date('2026-07-29T22:00:00.000Z'),
  }
);
expect(result).toMatchObject({ status: 'succeeded', successCount: 1 });
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand supabase/functions/_shared/__tests__/generator.test.ts
```

Expected: generator module missing.

- [ ] **Step 3: Implement the dependency-injected generator**

`generator.ts` must expose explicit request/result/dependency types. Process plots with bounded concurrency of three. Never log raw provider bodies. Normalize warning codes to:

```ts
type GenerationWarningCode =
  | 'plot_unassigned'
  | 'weather_unavailable'
  | 'model_error'
  | 'invalid_model_output'
  | 'persistence_error';
```

For cron, skip an existing successful current target without calling
`recordTargetResult` or changing which target/drafts are current. Count that plot
as skipped in the run only. For manual calls, regenerate. Save a fresh weather
snapshot before draft persistence. Pass validated drafts to the replacement RPC.
Finish the run even when one target fails.

- [ ] **Step 4: Implement the service-role database adapter**

Create `supabase/functions/_shared/supabase-generation.ts` and export:

```ts
export function createSupabaseGenerationDependencies(input: {
  admin: SupabaseClient;
  openWeatherApiKey: string;
  openRouterApiKey: string;
  openRouterModel: string;
}): GenerationDependencies
```

Implement every `GenerationDependencies` member with these exact operations:

- `listPlots(plotIds)` selects
  `id,nama_lahan,farmer_id,jenis_tanaman,luas_hektar,lat_center,lng_center,radius_geofence_m,fase_lahan,status`
  from active `lahan`, optionally applying `.in('id', plotIds)`, ordered by `id`;
- `listRecentTasks(plotId)` selects the ten newest rows from `tasks` with
  `judul,deskripsi,status,scheduled_for,priority,source`;
- `findCurrentTarget(plotId, scheduledFor)` selects the current
  `ai_generation_targets` row and returns null for PostgREST code `PGRST116`;
- `findWeatherCache(plotId, now)` selects the newest `weather_snapshots` row with
  `expires_at >= now.toISOString()`, then normalizes its JSON into the same
  `WeatherContext` returned by `fetchOpenWeather`;
- `saveWeather(plotId, weather)` inserts provider, observed/expiry times, current
  JSON, and forecast JSON, returning the snapshot UUID;
- `fetchWeather(plot)` calls `fetchOpenWeather` with `lat_center`, `lng_center`,
  `OPENWEATHER_API_KEY`, metric units, and Indonesian language;
- `generateDrafts(context)` calls `generateOpenRouterDrafts` with
  `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`;
- `createRun(request, plotCount)` inserts one `ai_generation_runs` row with status
  `running` and returns its UUID;
- `replaceDrafts(...)` calls `replace_ai_task_drafts` and returns the target UUID;
- `recordTargetResult(...)` inserts skipped/failed target outcomes without draft
  rows, with a monotonically increasing version obtained while holding the same
  per-plot/date advisory lock through a service-role RPC added to migration
  `0006_daily_operations_rpcs.sql`;
- `finishRun(...)` updates counts, warning summary, provider usage, final status,
  and `completed_at`.

Every Supabase operation must pass through:

```ts
function unwrap<T>(result: {
  data: T;
  error: { code?: string; message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.code ?? 'DATABASE_ERROR');
  return result.data;
}
```

Do not put provider response bodies, credentials, plot notes, or raw database
messages into returned errors.

- [ ] **Step 5: Implement Edge authentication and entry point**

Create `supabase/functions/generate-daily-tasks/index.ts` as a thin entry point:

```ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import { jakartaDate } from '../_shared/daily-date.ts';
import { generateDailyTasks } from '../_shared/generator.ts';
import { createSupabaseGenerationDependencies } from '../_shared/supabase-generation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-agroweather-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const required = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server secret: ${name}`);
  return value;
};

const safeJson = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(code);
  }
}

const parsePlotIds = async (request: Request): Promise<string[] | undefined> => {
  const raw = await request.json().catch(() => {
    throw new HttpError(400, 'INVALID_JSON');
  });
  if (
    raw === null ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).some((key) => key !== 'plotIds')
  ) {
    throw new HttpError(400, 'INVALID_BODY');
  }
  const body = raw as Record<string, unknown>;
  if (body.plotIds === undefined) return undefined;
  if (!Array.isArray(body.plotIds) || body.plotIds.length > 100) {
    throw new HttpError(400, 'INVALID_PLOT_IDS');
  }
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (body.plotIds.some((id: unknown) => typeof id !== 'string' || !uuid.test(id))) {
    throw new HttpError(400, 'INVALID_PLOT_IDS');
  }
  return [...new Set(body.plotIds as string[])];
};

const authenticateRequest = async (
  request: Request,
  supabaseUrl: string,
  anonKey: string
): Promise<{ trigger: 'cron' | 'manual'; requestedBy: string | null }> => {
  const cronSecret = request.headers.get('x-agroweather-cron-secret');
  if (cronSecret && cronSecret === required('CRON_SHARED_SECRET')) {
    return { trigger: 'cron', requestedBy: null };
  }
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHENTICATED');
  }
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) throw new HttpError(401, 'UNAUTHENTICATED');
  const { data: profile, error: profileError } = await userClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || profile?.role !== 'internal') {
    throw new HttpError(403, 'FORBIDDEN');
  }
  return { trigger: 'manual', requestedBy: user.id };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return safeJson(405, { error: 'Metode tidak didukung.' });
  }
  try {
    const supabaseUrl = required('SUPABASE_URL');
    const anonKey = required('SUPABASE_ANON_KEY');
    const auth = await authenticateRequest(request, supabaseUrl, anonKey);
    const plotIds = await parsePlotIds(request);
    const admin = createClient(
      supabaseUrl,
      required('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const dependencies = createSupabaseGenerationDependencies({
      admin,
      openWeatherApiKey: required('OPENWEATHER_API_KEY'),
      openRouterApiKey: required('OPENROUTER_API_KEY'),
      openRouterModel: required('OPENROUTER_MODEL'),
    });
    const result = await generateDailyTasks(
      {
        trigger: auth.trigger,
        requestedBy: auth.requestedBy,
        scheduledFor: jakartaDate(),
        plotIds,
      },
      dependencies
    );
    return safeJson(200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      const message =
        error.status === 401
          ? 'Silakan masuk kembali.'
          : error.status === 403
            ? 'Akses ditolak.'
            : 'Permintaan tidak valid.';
      return safeJson(error.status, { error: message, code: error.code });
    }
    console.error('generate-daily-tasks failed', {
      code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });
    return safeJson(500, { error: 'Generate task belum berhasil. Coba lagi.' });
  }
});
```

Authentication rules:

- Cron: `x-agroweather-cron-secret` must equal `CRON_SHARED_SECRET`.
- Manual: validate `Authorization` with `supabase.auth.getUser()` and require `public.users.role = internal`.
- Otherwise return `401` or `403`.

Create `supabase/functions/.env.example`:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENWEATHER_API_KEY=
CRON_SHARED_SECRET=
```

This file contains names only and is force-added if the repository ignore rule matches it.

- [ ] **Step 6: Verify shared tests and Edge compilation**

Run:

```bash
npm run test:edge
npx supabase functions serve generate-daily-tasks --env-file supabase/functions/.env.local
```

Expected: all pure Edge tests pass. With local secrets supplied outside Git, the function starts without a Deno/bundle error. Stop the server after the smoke check.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/generator.ts supabase/functions/_shared/supabase-generation.ts supabase/functions/_shared/__tests__/generator.test.ts supabase/functions/generate-daily-tasks/index.ts
git add -f supabase/functions/.env.example
git commit -m "feat: generate idempotent AI task drafts"
```

---

### Task 9: Add typed daily operations and AI draft services

**Files:**
- Modify: `src/services/tasks.ts`
- Modify: `src/services/attendance.ts`
- Create: `src/services/ai-drafts.ts`
- Create: `src/services/daily-operations.ts`
- Create: `src/services/__tests__/ai-drafts.test.ts`
- Create: `src/services/__tests__/daily-operations.test.ts`
- Modify: `src/services/__tests__/farm-services.test.ts`

- [ ] **Step 1: Write failing service mapping tests**

Test exact row-to-domain mappings and payloads:

```ts
expect(mapTaskRow(taskRow, latestEvidence)).toMatchObject({
  scheduledFor: '2026-07-30',
  priority: 'high',
  source: 'ai',
  aiReason: 'Hujan diperkirakan siang hari.',
  latestEvidence: {
    status: 'revision_requested',
    reviewNote: 'Foto terlalu gelap.',
  },
});

await fetchFarmerTasks('farmer-1', '2026-07-30', client);
expect(taskQuery.eq).toHaveBeenCalledWith('scheduled_for', '2026-07-30');

await createTaskForPlot({
  lahanId: 'plot-1',
  assignedTo: 'farmer-1',
  assignedBy: 'internal-1',
  judul: 'Periksa saluran',
  deskripsi: null,
  deadline: null,
  scheduledFor: '2026-07-30',
  priority: 'medium',
  requiresLocation: true,
}, client);
expect(taskInsert).toHaveBeenCalledWith(expect.objectContaining({
  scheduled_for: '2026-07-30',
  priority: 'medium',
  source: 'manual',
  requires_location: true,
}));

await invokeAiGeneration(['plot-1', 'plot-2'], client);
expect(client.functions.invoke).toHaveBeenCalledWith('generate-daily-tasks', {
  body: { plotIds: ['plot-1', 'plot-2'] },
});

await approveAiDraft({
  draftId: 'draft-1',
  assigneeId: 'farmer-1',
  title: 'Periksa irigasi',
  description: 'Pastikan saluran tidak tersumbat.',
  priority: 'high',
  requiresLocation: true,
}, client);
expect(client.rpc).toHaveBeenCalledWith('approve_ai_task_draft', expect.any(Object));

await approveAiDrafts(['draft-1', 'draft-2'], client);
expect(client.rpc).toHaveBeenCalledWith('bulk_approve_ai_task_drafts', {
  p_draft_ids: ['draft-1', 'draft-2'],
});
```

Also test that the draft mapper derives a bounded `DraftWeatherSummary` from its
joined `weather_snapshots(current_data,forecast_data)`. Test attendance
aggregation: all farmers appear, a farmer with one valid row is `present`, and
other farmers are `absent`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/services/__tests__/ai-drafts.test.ts src/services/__tests__/daily-operations.test.ts
```

Expected: new service modules/types are missing.

- [ ] **Step 3: Extend task and attendance services**

Change `TASK_SELECT` to include new task fields. `fetchFarmerTasks` now accepts `scheduledFor` and:

1. queries only that date;
2. loads matching evidence ordered by `created_at desc`;
3. assigns only the latest evidence summary per task;
4. maps safe domain values.

Extend `createTaskForPlot` so `scheduledFor`, `priority`, and
`requiresLocation` are explicit inputs; insert them with `source = manual`.
Do not let the client supply `status`, `sourceDraftId`, or `aiReason`.

Add:

```ts
export async function startTask(taskId: string, client = supabase): Promise<void> {
  const { error } = await client.rpc('start_assigned_task', {
    p_task_id: taskId,
  });
  if (error) throw error;
}
```

In `attendance.ts`, export:

```ts
export async function fetchFarmerAttendanceForDate(
  farmerId: string,
  attendanceDate: string,
  client = supabase
): Promise<AttendanceRecord | null>
```

Query the exact `attendance_date`, filter `status_geofence = valid`, join
`lahan(nama_lahan)` and `users(nama)`, order `waktu_masuk` ascending, limit one,
and return the first valid row.

Refactor `checkInIfInsideRadius` to derive `attendanceDate = jakartaDate()`,
check an existing row with
`.eq('farmer_id', input.farmerId).eq('lahan_id', input.plot.id).eq('attendance_date', attendanceDate)`,
and insert the same `attendance_date` when no row exists. Remove the old
device-local `localDayRange` filtering. If concurrent requests race and the
`absensi_farmer_plot_date_idx` unique index wins, re-read that exact date and
return the existing attendance instead of surfacing a duplicate error.

- [ ] **Step 4: Implement `ai-drafts.ts`**

Export:

```ts
export async function fetchAiDrafts(input: {
  scheduledFor: string;
  status?: AiDraftStatus;
  client?: SupabaseClient;
}): Promise<AiTaskDraft[]>;

export async function fetchAiDraftById(
  draftId: string,
  client?: SupabaseClient
): Promise<AiTaskDraft>;

export async function invokeAiGeneration(
  plotIds: string[],
  client?: SupabaseClient
): Promise<GenerationInvocationResult>;

export async function approveAiDraft(
  input: ApproveAiDraftInput,
  client?: SupabaseClient
): Promise<string>;

export async function approveAiDrafts(
  draftIds: string[],
  client?: SupabaseClient
): Promise<string[]>;

export async function rejectAiDraft(
  draftId: string,
  reason: string,
  client?: SupabaseClient
): Promise<void>;
```

Draft reads join
`weather_snapshots!ai_task_drafts_weather_snapshot_id_fkey(observed_at,current_data,forecast_data)`.
Map current conditions plus today's forecast minimum, maximum, and maximum rain
probability into `DraftWeatherSummary`; never expose arbitrary provider JSON to a
screen.

All UI-facing thrown errors are caught by screens and replaced with safe Indonesian copy.

- [ ] **Step 5: Implement internal daily aggregation**

`daily-operations.ts` loads in parallel:

- all farmers;
- attendance for `attendance_date`;
- tasks for `scheduled_for`;
- pending draft count;
- latest generation run.

Attendance aggregation must filter `status_geofence = valid`, order
`waktu_masuk` ascending, and keep the first valid row per farmer so the displayed
time/plot matches the approved definition of “Sudah absen”.

Export a stable result:

```ts
export type DailyOperations = {
  scheduledFor: string;
  attendance: Array<{
    farmerId: string;
    farmerName: string;
    status: 'present' | 'absent';
    record: AttendanceRecord | null;
  }>;
  tasks: OperationalTask[];
  pendingDraftCount: number;
  lastGeneration: {
    status: GenerationStatus;
    completedAt: string | null;
    successCount: number;
    skippedCount: number;
    failedCount: number;
  } | null;
};
```

The task query must join `lahan(nama_lahan)` and
`users:assigned_to(nama)`, map each row to
`{ task: FarmTask; plotName: string; farmerName: string }`, and fail the entire
daily task section safely if either required display name is missing. This keeps
internal cards typed without adding internal-only names to the farmer task model.
Load matching evidence newest-first in the same service operation and attach
only the latest status/review note to each nested `FarmTask`, using the same
mapper as `fetchFarmerTasks`.

- [ ] **Step 6: Verify GREEN**

Run:

```bash
npm test -- --runInBand src/services/__tests__/ai-drafts.test.ts src/services/__tests__/daily-operations.test.ts src/services/__tests__/farm-services.test.ts
npm run typecheck
```

Expected: new and existing service tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/tasks.ts src/services/attendance.ts src/services/ai-drafts.ts src/services/daily-operations.ts src/services/__tests__/ai-drafts.test.ts src/services/__tests__/daily-operations.test.ts src/services/__tests__/farm-services.test.ts
git commit -m "feat: add daily operations services"
```

---

### Task 10: Add evidence attempts, cleanup, signed URLs, and internal review services

**Files:**
- Modify: `src/services/evidence.ts`
- Create: `src/services/__tests__/evidence-review.test.ts`

- [ ] **Step 1: Write failing evidence workflow tests**

Cover:

- upload succeeds, registration succeeds, and returns pending attempt;
- registration failure removes the uploaded storage object;
- signed URL generation maps each attempt without exposing the private path as a public URL;
- review calls `review_task_evidence`;
- a raw Supabase error is never converted into display copy inside the service.

The cleanup assertion:

```ts
await expect(uploadTaskEvidence(input, client)).rejects.toThrow();
expect(client.storage.from('task-evidence').remove).toHaveBeenCalledWith([
  expect.stringMatching(/^farmer-1\/task-1\//),
]);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/services/__tests__/evidence-review.test.ts
```

Expected: evidence registration/review functions are missing.

- [ ] **Step 3: Replace direct evidence insert with constrained registration**

After storage upload, call:

```ts
const { data, error } = await client.rpc('register_task_evidence', {
  p_task_id: input.taskId,
  p_photo_path: path,
  p_note: input.note,
  p_lat: input.lat,
  p_lng: input.lng,
  p_ai_placeholder_summary: input.aiPlaceholderSummary,
});
```

On RPC failure, best-effort delete `path`, then rethrow the original registration error. Remove `farmerId` and `lahanId` from the database insert payload because the RPC derives ownership; keep `farmerId` only for the storage path.

Add:

```ts
export async function fetchTaskEvidenceAttempts(
  taskId: string,
  client = supabase
): Promise<EvidenceAttempt[]>;

export async function reviewTaskEvidence(
  evidenceId: string,
  decision: 'accepted' | 'revision_requested',
  note: string | null,
  client = supabase
): Promise<void>;
```

For each attempt, call `createSignedUrl(photo_path, 600)` and set `photoUrl` to null if signing fails while preserving the rest of the attempt.

- [ ] **Step 4: Preserve the current caller until the screen migration**

Keep `markTaskComplete` temporarily because the current task-detail screen still
imports it. Do not call it from the new evidence service. The database transition
remains constrained so only `review_task_evidence(..., 'accepted', ...)` can
complete a task. Task 16 removes the old screen call and then deletes the helper
in the same green commit.

- [ ] **Step 5: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand src/services/__tests__/evidence-review.test.ts src/app/'(app)'/task/__tests__/task-detail.test.tsx
npm run typecheck
```

Expected: the new service workflow and the unchanged task-detail tests both pass.

```bash
git add src/services/evidence.ts src/services/__tests__/evidence-review.test.ts
git commit -m "feat: add reviewable evidence attempts"
```

---

### Task 11: Add reusable attendance, draft, evidence, and task-state components

**Files:**
- Modify: `src/components/domain/task-card.tsx`
- Modify: `src/components/domain/__tests__/task-card.test.tsx`
- Create: `src/components/domain/attendance-row.tsx`
- Create: `src/components/domain/ai-draft-card.tsx`
- Create: `src/components/domain/evidence-attempt-card.tsx`
- Create: `src/components/domain/__tests__/attendance-row.test.tsx`
- Create: `src/components/domain/__tests__/ai-draft-card.test.tsx`
- Create: `src/components/domain/__tests__/evidence-attempt-card.test.tsx`

- [ ] **Step 1: Write accessible component tests**

Assert:

- attendance rows announce farmer, present/absent, time, and plot;
- present attendance rows expose an accessible detail action;
- draft cards announce plot, assignee, priority, and open action;
- evidence cards announce attempt, pending/accepted/revision, photo, note, and reviewer note;
- task cards support `pending-review` and `revision-needed`;
- task priority and `scheduledFor` are domain data, not hardcoded labels.

Example:

```tsx
render(
  <EvidenceAttemptCard
    attempt={{
      id: 'evidence-1',
      taskId: 'task-1',
      attemptNumber: 2,
      photoPath: 'farmer-1/task-1/photo.jpg',
      photoUrl: 'https://signed.example/photo',
      note: 'Saluran dibersihkan',
      latitude: -7.25,
      longitude: 112.76,
      status: 'revision_requested',
      reviewNote: 'Ambil foto lebih dekat',
      reviewedAt: '2026-07-30T02:00:00Z',
      createdAt: '2026-07-30T01:00:00Z',
    }}
  />
);
expect(screen.getByText('Percobaan 2')).toBeOnTheScreen();
expect(screen.getByText('Perlu perbaikan')).toBeOnTheScreen();
expect(screen.getByText('Ambil foto lebih dekat')).toBeOnTheScreen();
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/components/domain/__tests__/attendance-row.test.tsx src/components/domain/__tests__/ai-draft-card.test.tsx src/components/domain/__tests__/evidence-attempt-card.test.tsx src/components/domain/__tests__/task-card.test.tsx
```

Expected: new components/states are missing.

- [ ] **Step 3: Implement Field First cards**

Use only existing UI primitives, colors, spacing, and `StatusPill`. Keep touch targets at least 44 points. Map:

```ts
const evidenceTone = {
  pending: { label: 'Menunggu review', tone: 'warning' },
  accepted: { label: 'Diterima', tone: 'success' },
  revision_requested: { label: 'Perlu perbaikan', tone: 'danger' },
} as const;
```

Extend `TaskCardState`:

```ts
export type TaskCardState =
  | 'not-started'
  | 'ready'
  | 'check-location'
  | 'outside'
  | 'pending-review'
  | 'revision-needed'
  | 'completed';
```

No card performs data fetching or navigation internally.
Map `not-started` to the neutral label `Belum dimulai`; keep the existing
farmer-only GPS labels for `ready`, `check-location`, and `outside`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand src/components/domain/__tests__
npm run typecheck
```

Expected: all domain component tests pass.

```bash
git add src/components/domain/task-card.tsx src/components/domain/attendance-row.tsx src/components/domain/ai-draft-card.tsx src/components/domain/evidence-attempt-card.tsx src/components/domain/__tests__/task-card.test.tsx src/components/domain/__tests__/attendance-row.test.tsx src/components/domain/__tests__/ai-draft-card.test.tsx src/components/domain/__tests__/evidence-attempt-card.test.tsx
git commit -m "feat: add daily operations cards"
```

---

### Task 12: Rewrite the internal dashboard and daily operations screen

**Files:**
- Modify: `src/app/(app)/pegawai.tsx`
- Create: `src/app/(app)/daily-operations.tsx`
- Modify: `src/__tests__/pegawai-dashboard.test.tsx`
- Create: `src/__tests__/daily-operations-screen.test.tsx`

- [ ] **Step 1: Write failing internal dashboard tests**

Mock `fetchDailyOperations`. Assert:

- no GPS, weather, or AI request on mount;
- `6/8 Sudah absen`, today's task count, and pending draft count render;
- generation warning count renders safely;
- actions navigate to `/ai-tasks`, `/daily-operations`, and `/penataan-lahan`;
- stale requests do not update after unmount/profile change;
- retry refetches all daily data.

- [ ] **Step 2: Write failing daily operations tests**

Assert:

- attendance rows show present/absent;
- opening a present attendance row shows plot, check-in time, distance, and
  coordinates while absent rows remain non-interactive;
- tasks can be filtered by status;
- pressing a task opens `/task-review/[id]`;
- loading, empty, partial, and safe error states render;
- no provider/GPS call occurs on mount.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- --runInBand src/__tests__/pegawai-dashboard.test.tsx src/__tests__/daily-operations-screen.test.tsx
```

Expected: old dashboard has plot-only metrics and route is missing.

- [ ] **Step 4: Implement the internal summary**

Use `jakartaDate()` and `fetchDailyOperations(date)`. Preserve request-version cancellation. Dashboard sections:

1. header and logout;
2. daily attendance ratio;
3. today's task count;
4. pending AI draft count;
5. last generation warning/success card;
6. buttons for AI drafts, daily operations, and plot management.

Provider details and raw errors must never render.

- [ ] **Step 5: Implement the daily operations list**

Create a role-guarded internal screen. Keep local filters:

```ts
type OperationsFilter =
  | 'all'
  | 'not-started'
  | 'pending-review'
  | 'revision-needed'
  | 'completed';
```

Use accessible AppButtons as filter chips, `AttendanceRow`, and `TaskCard`. The screen reads database state only.
Filter each `OperationalTask` with
`deriveTaskOperationalState(item.task)`, pass that state plus `item.task` data to
`TaskCard`, render `item.plotName` and `item.farmerName` beside it, and navigate
with `item.task.id`.
Keep the selected attendance record in screen state. Pressing a present
`AttendanceRow` opens an inline `SurfaceCard` with plot, WIB check-in time,
distance in meters, and six-decimal coordinates; closing it does not refetch or
request GPS.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand src/__tests__/pegawai-dashboard.test.tsx src/__tests__/daily-operations-screen.test.tsx
npm run typecheck
npm run lint
```

Expected: internal summary and detail list tests pass with zero lint warnings.

```bash
git add src/app/'(app)'/pegawai.tsx src/app/'(app)'/daily-operations.tsx src/__tests__/pegawai-dashboard.test.tsx src/__tests__/daily-operations-screen.test.tsx
git commit -m "feat: show daily internal operations"
```

---

### Task 13: Add AI draft generation, list, edit, approval, and rejection screens

**Files:**
- Create: `src/app/(app)/ai-tasks/index.tsx`
- Create: `src/app/(app)/ai-tasks/[id].tsx`
- Create: `src/app/(app)/ai-tasks/__tests__/ai-task-list.test.tsx`
- Create: `src/app/(app)/ai-tasks/__tests__/ai-task-review.test.tsx`

- [ ] **Step 1: Write failing AI task list tests**

Assert:

- list loads pending drafts for `jakartaDate()`;
- active assigned plots can be selected accessibly;
- an empty plot selection never invokes generation and shows safe validation;
- generation starts only after explicit “Generate Task AI” press;
- a second press while pending does not invoke twice;
- successful, partial, and failed generation results show safe copy;
- regenerate refreshes the list;
- plot, assignee, and priority filters compose without mutating source data;
- accessible multi-select plus `Setujui Terpilih` calls one transactional bulk
  RPC after confirmation and disables every approval action while pending;
- draft cards open the review route;
- no OpenWeather/OpenRouter key or direct network call exists in the screen.

- [ ] **Step 2: Write failing review tests**

Assert:

- title, description, priority, location requirement, and farmer are editable;
- normalized current/today weather and AI reason render without raw provider JSON;
- approve invokes the RPC once and dismisses to the list;
- reject requires at least three characters;
- wrong-role content does not mount;
- async approve/reject actions are serialized;
- raw backend errors never render.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- --runInBand src/app/'(app)'/ai-tasks/__tests__
```

Expected: routes missing.

- [ ] **Step 4: Implement the list/generation screen**

Use:

```ts
const [selectedPlotIds, setSelectedPlotIds] = useState<Set<string>>(new Set());
const generationActive = useRef(false);
```

Show only active plots with a farmer. Surface skipped/unassigned plot warnings separately from selectable rows. After `invokeAiGeneration`, display counts and reload drafts. Keep database list reads and the explicit generation mutation separate.

Add local `plotId`, `assigneeId`, and `priority` filters. Keep selected draft IDs
in a separate `Set<string>` and remove IDs that disappear after a reload. The
bulk action must call `approveAiDrafts([...selectedIds])` once, show a
confirmation with the exact count, clear selection only after success, and reload
the list. A stale draft causes the database transaction to fail atomically; show
safe copy and reload rather than retrying individual approvals.

- [ ] **Step 5: Implement the review form**

Load draft and farmers in parallel. Validate:

- title 3–120;
- description 10–1500;
- assignee selected;
- priority enum;
- rejection reason at least 3.

Approval uses the edited values. Rejection uses a confirmation alert and reason. Draft status changes after the RPC, never optimistically before success.
Render the mapped weather summary (observation time, condition, temperature,
humidity, wind, rain, today's min/max, and maximum rain probability) above
`aiReason`. Do not render the model slug or raw JSON as operational guidance.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand src/app/'(app)'/ai-tasks/__tests__
npm run typecheck
npm run lint
```

Expected: generation/list/review tests pass.

```bash
git add src/app/'(app)'/ai-tasks/index.tsx src/app/'(app)'/ai-tasks/'[id].tsx src/app/'(app)'/ai-tasks/__tests__/ai-task-list.test.tsx src/app/'(app)'/ai-tasks/__tests__/ai-task-review.test.tsx
git commit -m "feat: review and approve AI task drafts"
```

---

### Task 14: Add internal task detail and evidence review

**Files:**
- Create: `src/app/(app)/task-review/[id].tsx`
- Create: `src/app/(app)/task-review/__tests__/task-review.test.tsx`

- [ ] **Step 1: Write failing task-review tests**

Assert:

- task, plot, assignee, instructions, AI reason, priority, and scheduled date render;
- every evidence attempt renders with signed image, note, GPS, distance from the
  plot center/radius context, and time;
- only latest pending evidence exposes review actions;
- accept calls `reviewTaskEvidence(id, 'accepted', null)`;
- revision requires a note and calls `revision_requested`;
- evidence history remains after review refresh;
- overlapping review actions are blocked;
- raw service errors never render;
- no GPS or provider request occurs.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/app/'(app)'/task-review/__tests__/task-review.test.tsx
```

Expected: route missing.

- [ ] **Step 3: Implement the internal review screen**

The screen loads task detail, plot, farmer, and `fetchTaskEvidenceAttempts`. Render immutable attempts oldest-to-newest. For pending evidence:

- `Terima Bukti` asks for confirmation;
- `Minta Perbaikan` requires a `FormField` review note;
- disable both while mutation is active;
- refresh after success;
- show controlled Indonesian messages.

Wrap the route in `RoleGuard requiredRole="internal"`.
For attempts with coordinates, calculate distance with the existing pure
`evaluateGeofence` helper using the loaded plot center/radius and render both
distance and whether it is inside/outside the configured radius. Missing
coordinates render `Lokasi tidak tersedia`; no device GPS read occurs.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand src/app/'(app)'/task-review/__tests__/task-review.test.tsx
npm run typecheck
```

Expected: review and state-transition UI tests pass.

```bash
git add src/app/'(app)'/task-review/'[id].tsx src/app/'(app)'/task-review/__tests__/task-review.test.tsx
git commit -m "feat: review farmer task evidence"
```

---

### Task 15: Make the farmer dashboard date-aware and attendance-aware

**Files:**
- Modify: `src/app/(app)/petani.tsx`
- Modify: `src/__tests__/petani-dashboard.test.tsx`

- [ ] **Step 1: Add failing farmer dashboard tests**

Assert:

- dashboard calls `fetchFarmerTasks(farmerId, jakartaDate())`;
- existing attendance loads on mount without a GPS request;
- “Sudah absen · 05:42 WIB” renders from database state;
- “Belum absen” still exposes the explicit GPS action;
- only today's tasks render;
- revision-needed appears before high priority, pending, then completed;
- task status uses latest evidence;
- successful new check-in updates the attendance card;
- existing concurrency/version protections remain.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/__tests__/petani-dashboard.test.tsx
```

Expected: current dashboard does not read attendance and fetches all tasks.

- [ ] **Step 3: Implement today-only reads**

In `loadDashboard`, derive one date and load:

```ts
const date = jakartaDate();
const [nextPlots, nextTasks, nextAttendance] = await Promise.all([
  fetchAssignedPlots(farmerId),
  fetchFarmerTasks(farmerId, date),
  fetchFarmerAttendanceForDate(farmerId, date),
]);
```

Store attendance separately from the transient GPS action outcome. A database attendance row renders success immediately but never triggers location. After a valid check-in, reload or construct the current attendance record from the insert result.

Use `sortDailyTasks` and evidence-aware states. Rename headings to “Task Hari Ini”.

Preserve the existing foreground GPS-derived state for actionable tasks by
combining both state machines:

```ts
function farmerTaskCardState(
  task: FarmTask,
  plot: FarmPlot | null,
  reading: GrantedLocationResult | null
): TaskCardState {
  const operational = deriveTaskOperationalState(task);
  if (operational === 'pending-review') return 'pending-review';
  if (operational === 'revision-needed') return 'revision-needed';
  if (operational === 'completed') return 'completed';
  return taskState(task, plot, reading);
}
```

Do not convert `not-started` directly to `ready`: a location-required farmer
task must still render `check-location` or `outside` until an explicit fresh GPS
action proves it is actionable.

- [ ] **Step 4: Preserve GPS policy tests**

Run:

```bash
npm test -- --runInBand src/__tests__/petani-dashboard.test.tsx src/services/__tests__/location.test.ts src/hooks/__tests__/use-location-action.test.tsx
```

Expected: all explicit/fresh GPS tests still pass.

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck
npm run lint
git add src/app/'(app)'/petani.tsx src/__tests__/petani-dashboard.test.tsx
git commit -m "feat: show farmer daily attendance and tasks"
```

---

### Task 16: Convert farmer task submission into reviewable attempts

**Files:**
- Modify: `src/app/(app)/task/[id].tsx`
- Modify: `src/app/(app)/task/__tests__/task-detail.test.tsx`
- Modify: `src/services/tasks.ts`

- [ ] **Step 1: Replace immediate-completion tests**

Keep all existing ownership, sanitized-error, serialization, and fresh GPS tests. Replace “mark complete after upload” expectations with:

- task instruction, plot, priority, scheduled date, AI reason, location
  requirement, and evidence history render;
- first valid unlock calls `startTask`;
- pending evidence blocks a new picker/submission and shows “Menunggu review internal”;
- accepted evidence renders completed state;
- revision evidence renders reviewer note and enables a new attempt;
- valid submission uploads once, reloads detail, and shows pending state;
- upload registration failure preserves photo/note;
- no `markTaskComplete` call exists;
- no direct `unlockTask` table update exists;
- task still performs a second fresh GPS read immediately before every new evidence upload.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/app/'(app)'/task/__tests__/task-detail.test.tsx
```

Expected: current route still completes tasks after upload and lacks evidence states.

- [ ] **Step 3: Refactor load and unlock**

Load task, plot, and evidence attempts. Retain the client ownership check before plot/evidence effects. After a valid location unlock, call `startTask(task.id)` once; keep the local GPS reading for the submission-time validation.

Derived rendering:

```ts
const latestAttempt = attempts.at(-1) ?? null;
const pendingReview = latestAttempt?.status === 'pending';
const revisionNeeded = latestAttempt?.status === 'revision_requested';
const completed =
  task.status === 'selesai' || latestAttempt?.status === 'accepted';
```

Above the evidence workflow, render a read-only task summary with instruction,
plot, priority, scheduled date, optional AI reason, and whether location proof is
required.

- [ ] **Step 4: Refactor submission**

Keep validation and the fresh second GPS read. After `uploadTaskEvidence` succeeds:

- clear only the local draft after the server confirms registration;
- reload attempts/task;
- show “Bukti terkirim dan menunggu review internal”;
- do not set task complete;
- do not allow another upload while the latest attempt is pending.

Remove `completionPending`, its retry branch, and the route's old
`unlockTask`/`markTaskComplete` calls and imports. Delete both now-unused direct
update helpers from `src/services/tasks.ts`; `startTask` and the review RPC are
the only task state transitions.

- [ ] **Step 5: Render evidence history and revision**

Render `EvidenceAttemptCard` for every attempt. For revision:

- show the latest review note in a danger/warning card;
- allow a new photo and note;
- use the same GPS gates as the original task.

For accepted/completed tasks, show a read-only success state and history.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand src/app/'(app)'/task/__tests__/task-detail.test.tsx src/components/domain/__tests__/evidence-picker.test.tsx
npm run typecheck
npm run lint
```

Expected: all task/evidence/GPS tests pass.

```bash
git add src/app/'(app)'/task/'[id].tsx src/app/'(app)'/task/__tests__/task-detail.test.tsx src/services/tasks.ts
git commit -m "feat: submit task evidence for review"
```

---

### Task 17: Register routes and prove role boundaries

**Files:**
- Modify: `src/app/(app)/_layout.tsx`
- Modify: `src/__tests__/role-route-wrappers.test.tsx`
- Modify: `src/__tests__/auth-routing-shell.test.tsx`

- [ ] **Step 1: Add failing route-boundary tests**

Import each new route default and assert:

- AI list/review, daily operations, and task review require `internal`;
- farmer dashboard/task detail remain `farmer`;
- wrong-role children do not mount and therefore do not fetch data;
- the stack registers every route with an Indonesian title.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --runInBand src/__tests__/role-route-wrappers.test.tsx src/__tests__/auth-routing-shell.test.tsx
```

Expected: new routes are not registered or covered.

- [ ] **Step 3: Register stack screens**

Add:

```tsx
<Stack.Screen name="daily-operations" options={{ title: 'Operasional Harian' }} />
<Stack.Screen name="ai-tasks/index" options={{ title: 'Draft Task AI' }} />
<Stack.Screen name="ai-tasks/[id]" options={{ title: 'Review Draft AI' }} />
<Stack.Screen name="task-review/[id]" options={{ title: 'Review Bukti Task' }} />
```

Every new screen's default export must wrap named content in `RoleGuard`.

- [ ] **Step 4: Verify GREEN and commit**

Run:

```bash
npm test -- --runInBand src/__tests__/role-route-wrappers.test.tsx src/__tests__/auth-routing-shell.test.tsx
npm run typecheck
```

Expected: route and side-effect boundaries pass.

```bash
git add src/app/'(app)'/_layout.tsx src/__tests__/role-route-wrappers.test.tsx src/__tests__/auth-routing-shell.test.tsx
git commit -m "feat: register daily operations routes"
```

---

### Task 18: Add production secrets, Edge deployment, Cron, and rollback runbook

**Files:**
- Create: `docs/runbooks/ai-task-operations-deploy.md`

- [ ] **Step 1: Write the runbook with exact secret names**

Document these production Edge secrets:

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENWEATHER_API_KEY
CRON_SHARED_SECRET
```

The runbook must explicitly say:

- never prefix them with `EXPO_PUBLIC_`;
- never paste them into `.env`, `app.json`, screenshots, logs, or Git;
- the OpenRouter model must support `response_format=json_schema`;
- the OpenWeather key uses Current Weather and 5 Day/3 Hour Forecast access.

- [ ] **Step 2: Document exact deployment order**

Include:

```bash
npx supabase login
npx supabase link
npx supabase db push
npx supabase secrets set --env-file supabase/functions/.env.local
npx supabase functions deploy generate-daily-tasks --no-verify-jwt
```

Before `db push`, require:

```bash
npm run db:reset
npm run db:test
```

- [ ] **Step 3: Document the Cron job**

In Supabase Dashboard:

1. store project function URL and `CRON_SHARED_SECRET` in Vault;
2. create a Cron HTTP POST job named `agroweather-daily-ai-tasks`;
3. use expression `0 22 * * *`;
4. target `/functions/v1/generate-daily-tasks`;
5. add `x-agroweather-cron-secret` from Vault;
6. send `{}` as JSON body;
7. verify `ai_generation_runs.scheduled_for` equals the current Asia/Jakarta date.

Do not write the actual secret value into the runbook.

- [ ] **Step 4: Document smoke tests**

Include safe checks:

- manual generation as internal succeeds;
- manual generation as farmer returns 403;
- repeated manual generation leaves only one current target;
- Cron creates drafts but no task rows;
- approve creates exactly one task;
- farmer sees only assigned today's task;
- evidence remains pending until internal accepts;
- revision preserves attempt history.

- [ ] **Step 5: Document rollback**

Rollback order:

1. disable the Cron job;
2. keep the Edge Function deployed but stop calls;
3. revert Expo UI/service commits if needed;
4. do not drop operational tables or evidence;
5. restore old read behavior only through a reviewed forward migration;
6. rotate `CRON_SHARED_SECRET` and provider keys if exposure is suspected.

- [ ] **Step 6: Commit**

```bash
git add -f docs/runbooks/ai-task-operations-deploy.md
git commit -m "docs: add AI operations deployment runbook"
```

---

### Task 19: Run the complete release gate and independent reviews

**Files:**
- Modify only files required by failures proven in this task.

- [ ] **Step 1: Run all automated tests**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:edge
npm run db:reset
npm run db:test
npx expo install --check
npx expo-doctor
```

Expected:

- TypeScript passes.
- Lint has zero warnings.
- All app, Edge pure-module, and pgTAP tests pass.
- Expo dependencies match SDK 54.
- Expo Doctor may report only known host-tooling issues such as CocoaPods; investigate every new failure.

- [ ] **Step 2: Export all three platforms**

Use fresh output directories:

```bash
npx expo export --platform android --output-dir /private/tmp/agroweather-ai-ops-android
npx expo export --platform ios --output-dir /private/tmp/agroweather-ai-ops-ios
npx expo export --platform web --output-dir /private/tmp/agroweather-ai-ops-web
```

Expected: Android, iOS, and static web exports pass. Web must not import native-only `react-native-maps`.

- [ ] **Step 3: Run static safety checks**

```bash
rg -n "OPENROUTER_API_KEY|OPENWEATHER_API_KEY|CRON_SHARED_SECRET" src app.json .env.example
rg -n "watchPositionAsync|requestBackgroundPermissionsAsync|startLocationUpdatesAsync|TaskManager|expo-task-manager" src app.json package.json
git diff --check
git status --short
```

Expected:

- No provider/Cron secret is referenced by Expo client files.
- No background/watch location capability exists.
- Diff check is clean.
- Worktree contains only intended changes before final commit.

- [ ] **Step 4: Perform local integration smoke tests**

With local Supabase and mock/test provider credentials:

- invoke function as internal;
- invoke as farmer and confirm 403;
- force weather failure and confirm cache/skip behavior;
- force malformed OpenRouter output and confirm no draft insert;
- approve/reject drafts;
- submit/review/revise evidence;
- verify cross-farmer RLS through Supabase client sessions.

- [ ] **Step 5: Perform physical-device acceptance**

On Expo Go with two farmer accounts and one internal account:

- verify no GPS request on dashboard/task mount;
- verify existing attendance is visible before any new GPS action;
- verify explicit inside/outside attendance;
- verify today-only tasks and midnight/date behavior in WIB;
- capture/select evidence;
- review as internal;
- refresh farmer and verify accepted/revision state;
- verify small-screen keyboard and safe areas.

- [ ] **Step 6: Request independent code and acceptance review**

Reviewer severity:

- Critical: secret bundled in client, authorization/RLS bypass, task auto-published without approval, evidence completing task before review, or GPS requested on mount.
- Important: duplicate generation/evidence, incorrect WIB date, missing provider fallback, lost evidence history, raw provider error, or stale async mutation.
- Minor: copy, polish, or non-blocking maintainability.

Fix all Critical and Important findings, rerun relevant focused tests, then rerun the complete gate.

- [ ] **Step 7: Verify the release-ready commit sequence**

```bash
git status --short
git log --oneline -20
```

Expected: `git status --short` is empty and the task-sized commits above form a
reviewable release-ready sequence. If Step 6 required fixes, stage only the exact
files changed for each finding and commit those fixes before this verification;
do not use a catch-all final commit.
