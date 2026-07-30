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
  request_payload jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_generation_targets_request_payload_check check (
    (
      status = 'succeeded'
      and request_payload is not null
      and pg_catalog.jsonb_typeof(request_payload) = 'object'
      and request_payload ?& array['model', 'result_summary', 'drafts']
      and request_payload - array['model', 'result_summary', 'drafts']
        = '{}'::jsonb
      and pg_catalog.jsonb_typeof(request_payload -> 'model') = 'string'
      and pg_catalog.char_length(request_payload ->> 'model')
        between 1 and 200
      and request_payload ->> 'model' =
        pg_catalog.btrim(request_payload ->> 'model')
      and (
        request_payload -> 'result_summary' = 'null'::jsonb
        or (
          pg_catalog.jsonb_typeof(request_payload -> 'result_summary') =
            'string'
          and pg_catalog.char_length(
            request_payload ->> 'result_summary'
          ) between 1 and 2000
          and request_payload ->> 'result_summary' =
            pg_catalog.btrim(request_payload ->> 'result_summary')
        )
      )
      and pg_catalog.jsonb_typeof(request_payload -> 'drafts') = 'array'
      and pg_catalog.jsonb_array_length(request_payload -> 'drafts')
        between 0 and 5
    )
    or (
      status <> 'succeeded'
      and request_payload is null
    )
  ),
  unique (run_id, lahan_id),
  unique (lahan_id, scheduled_for, version)
);

create or replace function
  public.protect_ai_generation_target_request_payload()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.request_payload is null and new.request_payload is not null then
    if old.status <> 'running' or new.status <> 'succeeded' then
      raise exception 'GENERATION_REQUEST_PAYLOAD_TRANSITION_INVALID';
    end if;

    return new;
  end if;

  if old.request_payload is not null
    and (
      new.request_payload is distinct from old.request_payload
      or new.status is distinct from old.status
    )
  then
    raise exception 'GENERATION_REQUEST_PAYLOAD_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function
  public.protect_ai_generation_target_request_payload()
from public, anon, authenticated;

create trigger ai_generation_targets_request_payload_immutable
before update of status, request_payload
on public.ai_generation_targets
for each row
execute function public.protect_ai_generation_target_request_payload();

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

alter table public.tasks
  alter column scheduled_for
    set default ((now() at time zone 'Asia/Jakarta')::date),
  alter column scheduled_for set not null;

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
  select
    evidence.id,
    task.status as task_status,
    row_number() over (
      partition by evidence.task_id
      order by evidence.created_at, evidence.id
    )::integer as attempt_number,
    row_number() over (
      partition by evidence.task_id
      order by evidence.created_at desc, evidence.id desc
    )::integer as latest_number
  from public.task_evidence evidence
  join public.tasks task on task.id = evidence.task_id
)
update public.task_evidence evidence
set attempt_number = numbered.attempt_number,
    review_status = case
      when numbered.task_status = 'selesai' then 'accepted'
      when numbered.latest_number = 1 then 'pending'
      else 'revision_requested'
    end,
    review_note = case
      when numbered.task_status <> 'selesai' and numbered.latest_number > 1
        then 'Bukti historis sebelum alur review.'
      else null
    end
from numbered
where evidence.id = numbered.id;

alter table public.task_evidence
  alter column attempt_number set not null,
  alter column review_status set not null,
  add constraint task_evidence_attempt_positive
    check (attempt_number > 0),
  add constraint task_evidence_review_status_check
    check (review_status in ('pending', 'accepted', 'revision_requested')),
  add constraint task_evidence_task_attempt_unique
    unique (task_id, attempt_number);

create unique index task_evidence_one_pending_idx
  on public.task_evidence(task_id)
  where review_status = 'pending';

alter table public.absensi
  add column attendance_date date;

update public.absensi
set attendance_date = (waktu_masuk at time zone 'Asia/Jakarta')::date
where attendance_date is null;

alter table public.absensi
  alter column attendance_date
    set default ((now() at time zone 'Asia/Jakarta')::date),
  alter column attendance_date set not null;

do $$
declare
  duplicate_groups jsonb;
begin
  select jsonb_agg(
    jsonb_build_object(
      'farmer_id', duplicates.farmer_id,
      'lahan_id', duplicates.lahan_id,
      'attendance_date', duplicates.attendance_date,
      'ids', duplicates.ids
    )
    order by
      duplicates.farmer_id,
      duplicates.lahan_id,
      duplicates.attendance_date
  )
  into duplicate_groups
  from (
    select
      farmer_id,
      lahan_id,
      (waktu_masuk at time zone 'Asia/Jakarta')::date as attendance_date,
      array_agg(id order by waktu_masuk) as ids
    from public.absensi
    group by
      farmer_id,
      lahan_id,
      (waktu_masuk at time zone 'Asia/Jakarta')::date
    having count(*) > 1
  ) duplicates;

  if duplicate_groups is not null then
    raise exception using
      message = 'DUPLICATE_ATTENDANCE_ROWS',
      detail = duplicate_groups::text,
      hint = 'Resolve the reported attendance IDs explicitly before rerunning this migration.';
  end if;
end;
$$;

create unique index absensi_farmer_plot_date_idx
  on public.absensi(farmer_id, lahan_id, attendance_date);

create index tasks_scheduled_assignee_idx
  on public.tasks(scheduled_for, assigned_to, status);

create index ai_task_drafts_review_idx
  on public.ai_task_drafts(scheduled_for, status, proposed_assignee_id);

create index weather_snapshots_plot_created_idx
  on public.weather_snapshots(lahan_id, created_at desc);

select task.id, task.assigned_to, task.lahan_id, task.created_at
from public.tasks task
where task.status = 'selesai'
  and not exists (
    select 1
    from public.task_evidence evidence
    where evidence.task_id = task.id
  )
order by task.created_at;
