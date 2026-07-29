# AgroWeather AI Task & Daily Operations Design

**Date:** 2026-07-30  
**Status:** Approved  
**Target:** Existing Expo SDK 54 application and Supabase project

## 1. Goal

Add a daily operations workflow that:

- generates AI task drafts from real plot, crop, phase, recent task, and weather data;
- runs automatically every day at 05:00 Asia/Jakarta and can also be triggered manually;
- requires an internal user to review and approve every AI draft before assignment;
- shows today's attendance and tasks clearly to internal users and farmers;
- lets farmers submit photo, note, and GPS evidence;
- lets internal users accept evidence or request a revision while preserving every attempt.

OpenRouter provides the language model. OpenWeather provides current weather and today's forecast.

## 2. Confirmed Product Decisions

- AI creates drafts only. It never publishes or assigns a task without internal approval.
- The automatic schedule is 05:00 WIB.
- Internal users can manually regenerate today's drafts for selected active plots.
- AI chooses how many drafts a plot needs, from zero through five.
- The proposed assignee defaults to the farmer assigned to the plot and remains editable by internal.
- Active plots without an assigned farmer are skipped and reported as warnings.
- Generate-again supersedes only pending AI drafts for the same plot and date. Approved tasks and historical rejected drafts remain unchanged.
- Weather context contains current conditions and the rest of today's forecast.
- OpenWeather uses the broadly compatible Current Weather and 5 Day / 3 Hour Forecast endpoints instead of assuming One Call access.
- The OpenRouter model slug comes from a server-side `OPENROUTER_MODEL` secret.
- A farmer is considered present today after at least one valid GPS check-in at an assigned active plot that day.
- "Task hari ini" is defined by a dedicated `scheduled_for` date in Asia/Jakarta, not `created_at` or `deadline`.
- Only internal users assign tasks. Farmers cannot claim or create tasks.
- Internal users can accept evidence or request revision with a required reviewer note.

## 3. Architecture

### 3.1 Server boundary

The Expo application never calls OpenRouter or OpenWeather directly. It invokes a Supabase Edge Function with the signed-in user's session. The Edge Function:

1. authenticates the caller;
2. authorizes manual calls to the `internal` role;
3. loads eligible plots, recent task context, and weather;
4. invokes OpenRouter using a strict JSON schema;
5. validates and normalizes the response;
6. replaces only pending drafts in one database transaction;
7. records run, per-plot result, usage, and safe error metadata.

Scheduled calls use a dedicated server credential from Supabase Vault. Provider credentials stay in Edge Function secrets.

### 3.2 Scheduled invocation

Supabase Cron invokes `generate-daily-tasks` at `0 22 * * *` UTC, which is 05:00 Asia/Jakarta on the following local calendar day. The function always derives `scheduled_for` from the current date in `Asia/Jakarta`; it does not trust a date supplied by the cron request.

The cron processes every active plot with an assigned farmer. A failure for one plot does not roll back successful plots.

### 3.3 Manual invocation

An authenticated internal user selects one or more active plots and triggers generation for the current Asia/Jakarta date. Manual generation uses the same orchestration, schema, validation, persistence, and idempotency path as cron.

Manual future-date generation is outside this version because the approved weather context is specifically current conditions plus today's forecast.

### 3.4 Provider adapters

OpenWeather requests, by plot coordinates:

- `GET https://api.openweathermap.org/data/2.5/weather`
- `GET https://api.openweathermap.org/data/2.5/forecast`

Both requests use metric units. Forecast entries are reduced to the current Asia/Jakarta calendar day. The normalized snapshot contains:

- observation and forecast timestamps;
- weather condition code and description;
- current, minimum, and maximum temperature;
- humidity;
- wind speed;
- rain volume or probability when available.

OpenRouter uses:

- `POST https://openrouter.ai/api/v1/chat/completions`;
- model from `OPENROUTER_MODEL`;
- non-streaming structured output with strict JSON schema;
- provider routing that requires support for the requested structured-output parameters;
- bounded input text and bounded output tokens.

The OpenRouter response schema is:

```json
{
  "summary": "string",
  "tasks": [
    {
      "title": "string",
      "instruction": "string",
      "priority": "low | medium | high",
      "requires_location": true,
      "reason": "string"
    }
  ]
}
```

`tasks` may contain zero through five items. Extra fields, invalid enums, excessive lengths, and more than five items reject the whole plot response.

## 4. Data Model

### 4.1 `weather_snapshots`

Stores normalized provider results for cache and audit:

- `id uuid primary key`
- `lahan_id uuid not null`
- `provider text not null check (provider = 'openweather')`
- `observed_at timestamptz not null`
- `expires_at timestamptz not null`
- `current_data jsonb not null`
- `forecast_data jsonb not null`
- `created_at timestamptz not null`

The generator may reuse only a successful snapshot whose `created_at` is no more than six hours old.

### 4.2 `ai_generation_runs`

One row per cron or manual invocation:

- `id uuid primary key`
- `trigger text not null check (trigger in ('cron', 'manual'))`
- `scheduled_for date not null`
- `requested_by uuid null`
- `status text not null check (status in ('running', 'succeeded', 'partial', 'failed'))`
- `model text not null`
- `plot_count integer not null`
- `success_count integer not null default 0`
- `skipped_count integer not null default 0`
- `failed_count integer not null default 0`
- `warning_summary jsonb not null default '[]'`
- `provider_usage jsonb null`
- `started_at timestamptz not null`
- `completed_at timestamptz null`

Technical stack traces and provider bodies stay in server logs. `warning_summary` contains safe operational codes and plot IDs only.

### 4.3 `ai_generation_targets`

One row per plot processed by a run:

- `id uuid primary key`
- `run_id uuid not null`
- `lahan_id uuid not null`
- `scheduled_for date not null`
- `version integer not null`
- `is_current boolean not null default true`
- `status text not null check (status in ('running', 'succeeded', 'skipped', 'failed'))`
- `draft_count integer not null default 0`
- `weather_snapshot_id uuid null`
- `result_summary text null`
- `error_code text null`
- `created_at timestamptz not null`
- `completed_at timestamptz null`

Constraints:

- unique `(lahan_id, scheduled_for, version)`;
- a partial unique index allows only one `is_current = true` target per `(lahan_id, scheduled_for)`;
- unique `(run_id, lahan_id)`.

A database RPC serializes replacement for a plot/date. It marks the previous target non-current, supersedes only its pending drafts, creates the new target version, and inserts zero through five validated drafts atomically.

### 4.4 `ai_task_drafts`

- `id uuid primary key`
- `generation_target_id uuid not null`
- `lahan_id uuid not null`
- `proposed_assignee_id uuid not null`
- `scheduled_for date not null`
- `judul text not null`
- `deskripsi text not null`
- `priority text not null check (priority in ('low', 'medium', 'high'))`
- `requires_location boolean not null`
- `ai_reason text not null`
- `status text not null check (status in ('pending', 'approved', 'rejected', 'superseded'))`
- `model text not null`
- `weather_snapshot_id uuid not null`
- `reviewed_by uuid null`
- `reviewed_at timestamptz null`
- `rejection_reason text null`
- `created_task_id uuid null unique`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Approving a draft uses one transactional RPC that validates the reviewer role, verifies that the selected assignee still exists with role `farmer`, verifies that the plot is still active, inserts the task, and marks the draft approved. The assignee may differ from the plot's primary farmer because internal explicitly chose that override. The unique `created_task_id` plus the RPC prevents double approval.

Rejecting requires a non-empty reason. Superseding is allowed only for pending drafts during regeneration.

### 4.5 Existing `tasks` extensions

Add:

- `scheduled_for date not null`
- `priority text not null default 'medium'`
- `source text not null default 'manual' check (source in ('manual', 'ai'))`
- `source_draft_id uuid null unique`
- `ai_reason text null`

Existing rows are backfilled with `created_at` converted to `Asia/Jakarta`. Existing `task_status` values remain:

- `belum_dikerjakan`: approved but not started;
- `sedang_dikerjakan`: location unlocked, work started, evidence pending review, or revision requested;
- `selesai`: latest evidence accepted by internal.

"Menunggu review" and "Perlu perbaikan" are derived from the latest evidence review status, avoiding conflicting duplicate status sources.

### 4.6 Existing `task_evidence` extensions

Add:

- `attempt_number integer not null`
- `review_status text not null check (review_status in ('pending', 'accepted', 'revision_requested'))`
- `reviewed_by uuid null`
- `review_note text null`
- `reviewed_at timestamptz null`

Rules:

- one partial unique index allows only one pending evidence attempt per task;
- evidence photo, note, coordinates, timestamp, and AI summary are immutable after insert;
- requesting revision requires a reviewer note;
- accepting/rejecting is a database RPC that atomically updates evidence review fields and the task status;
- accepted evidence sets the task to `selesai`;
- requested revision keeps the task `sedang_dikerjakan` and allows a new evidence attempt;
- farmers cannot submit another attempt while one is pending review.

### 4.7 Existing `absensi` extension

Add:

- `attendance_date date not null default ((now() at time zone 'Asia/Jakarta')::date)`

Backfill existing rows from `waktu_masuk` in `Asia/Jakarta`. Add unique `(farmer_id, lahan_id, attendance_date)`.

Dashboard presence is derived by grouping valid attendance rows by farmer and date. At least one valid row means "Sudah absen"; detail shows plot, check-in time, distance, and coordinates.

## 5. State and User Flows

### 5.1 Draft generation

1. Cron or internal starts a generation run.
2. The function selects active plots.
3. Plots without an assigned farmer are marked skipped with a safe warning.
4. Each eligible plot independently loads recent task context.
5. The function loads fresh weather or a cache no older than six hours.
6. OpenRouter returns zero through five structured drafts.
7. The function validates every field.
8. The transactional replacement RPC supersedes pending drafts and persists the new version.
9. The run finishes as succeeded, partial, or failed.

Recent task context is bounded to the latest relevant task summaries and statuses. Evidence images and free-form evidence text are not sent to OpenRouter.

### 5.2 Internal draft review

The internal draft list defaults to today's pending drafts and supports filtering by plot, assignee, and priority. Internal can:

- inspect weather and AI reason;
- edit title, instructions, priority, location requirement, and assignee;
- approve one draft;
- approve multiple reviewed drafts;
- reject with a reason;
- regenerate pending drafts for selected plots.

Approved drafts create real tasks. Farmers never see pending, rejected, or superseded drafts.

### 5.3 Farmer daily dashboard

The farmer dashboard displays:

- an attendance card with "Belum absen" or the first valid check-in time and plot;
- today's tasks where `scheduled_for` is the current Asia/Jakarta date;
- task status derived from task plus latest evidence;
- separate completed and revision-needed states;
- task detail with instruction, plot, priority, AI reason, location requirement, evidence history, and latest reviewer note.

The existing explicit foreground GPS rules remain. No GPS request occurs on screen mount.

### 5.4 Evidence submission and review

1. Farmer opens an assigned task.
2. Location-required tasks perform the existing explicit unlock and submission-time fresh GPS validation.
3. Farmer uploads a photo and note.
4. Evidence is inserted as a new pending attempt; the task remains `sedang_dikerjakan`.
5. Internal opens the task review detail and sees all attempts, photo, note, GPS, distance context, and timestamps.
6. Internal accepts or requests revision.
7. Accepting marks the task complete.
8. Revision keeps the task active and exposes the reviewer note to the farmer.
9. A corrected submission becomes the next immutable attempt.

## 6. Screens and Navigation

### 6.1 Internal

The internal dashboard becomes a daily operational summary:

- attendance count and farmer rows;
- today's task totals by status;
- pending AI draft count;
- generation warnings;
- primary action to generate AI drafts;
- links to draft review, daily operations, and plot management.

Add focused screens:

- AI draft list and generation action;
- AI draft edit/review;
- daily attendance and task list with filters;
- internal task detail with evidence timeline and review actions.

### 6.2 Farmer

The farmer dashboard keeps Field First styling and prioritizes:

- today's attendance status;
- today's task count;
- task cards ordered by revision-needed, high priority, pending, then completed;
- explicit task details and evidence history.

The existing farmer task-detail screen is extended rather than replaced.

## 7. Security and Authorization

Provider secrets:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENWEATHER_API_KEY`

These are Supabase Edge Function secrets and never use `EXPO_PUBLIC_*`.

The existing client `.env` continues to contain only the Supabase URL and publishable key.

The migration replaces broad MVP authenticated policies with role-aware policies:

- internal users may read operational users, plots, tasks, attendance, evidence, drafts, runs, targets, and weather snapshots;
- farmers may read their own profile, plots where they are the primary farmer, plots referenced by tasks assigned to them, their assigned tasks, their attendance, and their evidence;
- farmers may insert only their own attendance/evidence through validated application paths;
- farmers cannot read AI drafts, generation runs, or other farmers' evidence/attendance;
- draft approval/rejection, evidence review, and AI generation require internal authorization;
- AI persistence uses narrowly scoped RPCs and server credentials;
- the private evidence bucket keeps owner-path insert rules and grants internal review access through authenticated signed URLs.

A stable role helper based on `auth.uid()` avoids policy recursion. All privileged RPCs recheck role and row ownership inside the database; UI guards are not treated as security.

Provider data and model output are untrusted:

- input text is length-limited and passed as data, not executable instructions;
- output must match the strict schema and local validator;
- the model never receives database credentials or direct write access;
- raw provider errors and response bodies never reach mobile UI.

## 8. Failure Handling and Idempotency

- OpenWeather calls receive a short bounded retry.
- If both live calls fail, a successful cache no older than six hours may be used.
- If no valid cache exists, that plot is skipped and internal sees a warning.
- OpenRouter errors, unsupported structured output, invalid JSON, or invalid schema create no drafts for that plot.
- A plot failure does not discard other successful plot results.
- Cron and manual overlap are serialized per plot/date by the database replacement RPC.
- Repeated cron delivery does not duplicate drafts.
- Manual regeneration preserves approved tasks and historical rejected drafts.
- Maximum drafts are five per plot/run.
- Output tokens, prompt history, and request duration are bounded.
- The application shows actionable safe messages; technical details remain in Edge Function logs.

## 9. Observability

Internal sees:

- last automatic run time and result;
- successful, skipped, and failed plot counts;
- safe warning codes such as `plot_unassigned`, `weather_unavailable`, `model_error`, or `invalid_model_output`;
- manual retry actions.

Server logs include correlation IDs, provider request IDs when available, latency, model, and safe usage/cost metadata. Logs never include API keys, full authorization headers, or farmer credentials.

## 10. Testing Strategy

### Unit tests

- Asia/Jakarta date conversion;
- OpenWeather normalization and same-day filtering;
- six-hour weather cache rules;
- OpenRouter request and strict response validation;
- zero-to-five task rule and field length limits;
- task/evidence derived status;
- attendance daily grouping;
- generation warning mapping.

### Edge Function integration tests

- internal manual authentication and authorization;
- farmer rejection from generation endpoint;
- cron service authorization;
- active/assigned plot selection;
- OpenWeather current and forecast mocks;
- OpenWeather retry, cache fallback, and no-cache skip;
- OpenRouter success, timeout, malformed output, unsupported model, and more-than-five rejection;
- per-plot partial failure;
- repeated cron idempotency;
- manual regeneration preserving approved/rejected history;
- zero-task valid model response.

### Database tests

- migrations and backfills;
- one current generation target per plot/date;
- transactional replacement and double-approval prevention;
- one pending evidence attempt per task;
- immutable evidence fields;
- evidence accept/revision transitions;
- attendance uniqueness by farmer/plot/date;
- RLS matrix for internal, owning farmer, other farmer, and anonymous caller.

### UI tests

- internal dashboard attendance and task metrics;
- draft list filters and empty/error/loading states;
- edit, approve, reject, bulk approve, and regenerate;
- generation partial warning display;
- farmer today-only task list and ordering;
- attendance already-completed state;
- evidence pending, accepted, and revision-needed states;
- internal evidence timeline and review actions;
- retry behavior without duplicate submissions;
- no GPS or AI request on screen mount.

### Manual device tests

- attendance status across two accounts and date rollover;
- GPS inside/outside behavior;
- camera and gallery evidence;
- internal review reflected after farmer refresh;
- revision resubmission;
- scheduled generation result after 05:00 WIB;
- temporary OpenWeather/OpenRouter failure and retry;
- small-screen keyboard and safe-area behavior.

## 11. Acceptance Criteria

- At 05:00 WIB, eligible active plots receive zero through five pending AI drafts, never published tasks.
- Internal can generate today's drafts manually for selected plots.
- Pending draft regeneration cannot alter approved tasks or historical rejected drafts.
- No OpenRouter or OpenWeather secret is bundled in Expo.
- Invalid or partial model output creates no draft for that plot.
- Internal can edit and approve a draft into exactly one assigned task.
- Farmers see only their own approved tasks for `scheduled_for = today` in Asia/Jakarta.
- Internal sees whether each farmer has at least one valid attendance today and can open attendance detail.
- Farmers see their current-day attendance state without creating a new GPS read on mount.
- Evidence submission does not complete the task until internal accepts it.
- Revision requests preserve old evidence and allow a new numbered attempt.
- Internal can inspect all work details relevant to the task: instructions, status timeline, evidence, note, GPS, time, and review history.
- Cron/manual overlap and retry do not duplicate current drafts.
- Role-aware RLS blocks cross-farmer and farmer-to-internal data access.
- Existing explicit foreground-only GPS behavior remains intact.

## 12. Non-Goals

- Automatic publication or assignment without internal approval.
- Farmer task claiming or self-assignment.
- AI-based evidence acceptance or computer-vision diagnosis.
- Push notifications.
- Chat between internal and farmer.
- Future-date task generation or multi-day weather planning.
- Background or continuous location tracking.
- A separate backend worker or queue platform.
