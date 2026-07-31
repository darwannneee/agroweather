create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.role
  from public.users app_user
  where app_user.id = auth.uid()
$$;

revoke all on function public.current_user_role()
  from public, anon, authenticated;
grant execute on function public.current_user_role()
  to authenticated;

create or replace function public.is_internal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.current_user_role() = 'internal'::public.user_role,
    false
  )
$$;

revoke all on function public.is_internal()
  from public, anon, authenticated;
grant execute on function public.is_internal()
  to authenticated;

alter table public.users enable row level security;

drop policy if exists "users self select" on public.users;
drop policy if exists "users self insert" on public.users;
drop policy if exists "users self update" on public.users;
drop policy if exists "auth read users for assignment" on public.users;
drop policy if exists "logged_in_full_access" on public.users;
drop policy if exists "users scoped select" on public.users;

revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;
grant all on table public.users to service_role;

create policy "users scoped select"
on public.users
for select
to authenticated
using (
  auth.uid() = id
  or public.is_internal()
);

create or replace function public.sign_up_user(
  p_email text,
  p_password text,
  p_nama text,
  p_role public.user_role
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  normalized_name text := pg_catalog.btrim(p_nama);
begin
  if p_role is distinct from 'farmer'::public.user_role then
    raise exception 'SIGNUP_ROLE_FORBIDDEN';
  end if;

  if normalized_email is null
    or pg_catalog.char_length(normalized_email) not between 5 and 254
    or normalized_email !~
      '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'
  then
    raise exception 'SIGNUP_EMAIL_INVALID';
  end if;

  if p_password is null
    or pg_catalog.octet_length(p_password) not between 8 and 72
  then
    raise exception 'SIGNUP_PASSWORD_INVALID';
  end if;

  if normalized_name is null
    or pg_catalog.char_length(normalized_name) not between 2 and 120
  then
    raise exception 'SIGNUP_NAME_INVALID';
  end if;

  if exists (
    select 1
    from auth.users existing
    where pg_catalog.lower(existing.email) = normalized_email
  ) then
    raise exception 'SIGNUP_EMAIL_EXISTS';
  end if;

  user_id := pg_catalog.gen_random_uuid();

  insert into auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role
  ) values (
    user_id,
    normalized_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    pg_catalog.now(),
    pg_catalog.now(),
    pg_catalog.now(),
    'authenticated',
    'authenticated'
  );

  insert into auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    user_id,
    user_id::text,
    pg_catalog.jsonb_build_object(
      'sub',
      user_id::text,
      'email',
      normalized_email
    ),
    'email',
    pg_catalog.now(),
    pg_catalog.now(),
    pg_catalog.now()
  );

  insert into public.users (id, email, nama, role)
  values (
    user_id,
    normalized_email,
    normalized_name,
    'farmer'::public.user_role
  );

  return user_id;
end;
$$;

revoke all on function public.sign_up_user(
  text, text, text, public.user_role
) from public, anon, authenticated, service_role;
grant execute on function public.sign_up_user(
  text, text, text, public.user_role
) to anon;

create or replace function public.replace_ai_task_drafts(
  p_run_id uuid,
  p_lahan_id uuid,
  p_scheduled_for date,
  p_weather_snapshot_id uuid,
  p_model text,
  p_result_summary text,
  p_drafts jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  generation_run public.ai_generation_runs%rowtype;
  plot public.lahan%rowtype;
  snapshot public.weather_snapshots%rowtype;
  existing_target public.ai_generation_targets%rowtype;
  current_succeeded_target_id uuid;
  previous_target_id uuid;
  next_version integer;
  target_id uuid;
  inserted_count integer := 0;
  requested_count integer;
  normalized_model text;
  normalized_summary text;
  incoming_canonical jsonb := '[]'::jsonb;
  incoming_payload jsonb;
  draft record;
begin
  if p_run_id is null
    or p_lahan_id is null
    or p_scheduled_for is null
    or p_weather_snapshot_id is null
  then
    raise exception 'GENERATION_INPUT_INVALID';
  end if;

  if p_drafts is null
    or pg_catalog.jsonb_typeof(p_drafts) <> 'array'
  then
    raise exception 'AI_DRAFTS_NOT_ARRAY';
  end if;

  requested_count := pg_catalog.jsonb_array_length(p_drafts);
  if requested_count > 5 then
    raise exception 'AI_DRAFT_LIMIT';
  end if;

  if p_model is null
    or pg_catalog.char_length(pg_catalog.btrim(p_model)) not between 1 and 200
  then
    raise exception 'AI_MODEL_INVALID';
  end if;
  normalized_model := pg_catalog.btrim(p_model);

  if p_result_summary is not null
    and pg_catalog.char_length(pg_catalog.btrim(p_result_summary)) > 2000
  then
    raise exception 'GENERATION_SUMMARY_INVALID';
  end if;
  normalized_summary := nullif(pg_catalog.btrim(p_result_summary), '');

  for draft in
    select parsed.*
    from pg_catalog.jsonb_to_recordset(p_drafts) as parsed(
      judul text,
      deskripsi text,
      priority text,
      requires_location boolean,
      ai_reason text
    )
  loop
    if draft.judul is null
      or pg_catalog.char_length(pg_catalog.btrim(draft.judul))
        not between 3 and 120
      or draft.deskripsi is null
      or pg_catalog.char_length(pg_catalog.btrim(draft.deskripsi))
        not between 10 and 1500
      or draft.priority is null
      or draft.priority not in ('low', 'medium', 'high')
      or draft.requires_location is null
      or draft.ai_reason is null
      or pg_catalog.char_length(pg_catalog.btrim(draft.ai_reason))
        not between 3 and 800
    then
      raise exception 'AI_DRAFT_INVALID';
    end if;

    incoming_canonical := incoming_canonical
      || pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'judul', pg_catalog.btrim(draft.judul),
          'deskripsi', pg_catalog.btrim(draft.deskripsi),
          'priority', draft.priority,
          'requires_location', draft.requires_location,
          'ai_reason', pg_catalog.btrim(draft.ai_reason)
        )
      );
  end loop;

  select coalesce(
    pg_catalog.jsonb_agg(element.item order by element.item::text),
    '[]'::jsonb
  )
  into incoming_canonical
  from pg_catalog.jsonb_array_elements(incoming_canonical) element(item);

  incoming_payload := pg_catalog.jsonb_build_object(
    'model', normalized_model,
    'result_summary', normalized_summary,
    'drafts', incoming_canonical
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_lahan_id::text || ':' || p_scheduled_for::text,
      0
    )
  );

  select run.*
  into generation_run
  from public.ai_generation_runs run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception 'GENERATION_RUN_NOT_FOUND';
  end if;

  if generation_run.scheduled_for <> p_scheduled_for then
    raise exception 'GENERATION_RUN_INVALID';
  end if;

  select target.*
  into existing_target
  from public.ai_generation_targets target
  where target.run_id = p_run_id
    and target.lahan_id = p_lahan_id
  for update;

  if found then
    if existing_target.status = 'succeeded'
      and existing_target.scheduled_for = p_scheduled_for
      and existing_target.weather_snapshot_id = p_weather_snapshot_id
      and existing_target.draft_count = requested_count
      and existing_target.request_payload = incoming_payload
    then
      return existing_target.id;
    end if;

    raise exception 'GENERATION_RETRY_MISMATCH';
  end if;

  if generation_run.status <> 'running'
    or generation_run.model <> normalized_model
  then
    raise exception 'GENERATION_RUN_INVALID';
  end if;

  if generation_run.trigger = 'cron' then
    select current_target.id
    into current_succeeded_target_id
    from public.ai_generation_targets current_target
    where current_target.lahan_id = p_lahan_id
      and current_target.scheduled_for = p_scheduled_for
      and current_target.is_current
      and current_target.status = 'succeeded'
    for update;

    if found then
      return current_succeeded_target_id;
    end if;
  end if;

  select candidate.*
  into plot
  from public.lahan candidate
  where candidate.id = p_lahan_id
  for update;

  if not found then
    raise exception 'PLOT_NOT_FOUND';
  end if;

  if plot.status <> 'aktif' then
    raise exception 'PLOT_INACTIVE';
  end if;

  if plot.farmer_id is null
    or not exists (
      select 1
      from public.users farmer
      where farmer.id = plot.farmer_id
        and farmer.role = 'farmer'::public.user_role
    )
  then
    raise exception 'PLOT_FARMER_INVALID';
  end if;

  select weather.*
  into snapshot
  from public.weather_snapshots weather
  where weather.id = p_weather_snapshot_id;

  if not found or snapshot.lahan_id <> p_lahan_id then
    raise exception 'WEATHER_SNAPSHOT_INVALID';
  end if;

  select current_target.id
  into previous_target_id
  from public.ai_generation_targets current_target
  where current_target.lahan_id = p_lahan_id
    and current_target.scheduled_for = p_scheduled_for
    and current_target.is_current
  for update;

  if previous_target_id is not null then
    update public.ai_generation_targets
    set is_current = false
    where id = previous_target_id;

    update public.ai_task_drafts
    set status = 'superseded',
        updated_at = pg_catalog.now()
    where generation_target_id = previous_target_id
      and status = 'pending';
  end if;

  select coalesce(pg_catalog.max(target.version), 0) + 1
  into next_version
  from public.ai_generation_targets target
  where target.lahan_id = p_lahan_id
    and target.scheduled_for = p_scheduled_for;

  insert into public.ai_generation_targets (
    run_id,
    lahan_id,
    scheduled_for,
    version,
    is_current,
    status,
    draft_count,
    weather_snapshot_id,
    result_summary
  ) values (
    p_run_id,
    p_lahan_id,
    p_scheduled_for,
    next_version,
    true,
    'running',
    0,
    p_weather_snapshot_id,
    normalized_summary
  )
  returning id into target_id;

  for draft in
    select parsed.*
    from pg_catalog.jsonb_to_recordset(incoming_canonical) as parsed(
      judul text,
      deskripsi text,
      priority text,
      requires_location boolean,
      ai_reason text
    )
  loop
    insert into public.ai_task_drafts (
      generation_target_id,
      lahan_id,
      proposed_assignee_id,
      scheduled_for,
      judul,
      deskripsi,
      priority,
      requires_location,
      ai_reason,
      model,
      weather_snapshot_id
    ) values (
      target_id,
      p_lahan_id,
      plot.farmer_id,
      p_scheduled_for,
      draft.judul,
      draft.deskripsi,
      draft.priority,
      draft.requires_location,
      draft.ai_reason,
      normalized_model,
      p_weather_snapshot_id
    );

    inserted_count := inserted_count + 1;
  end loop;

  if inserted_count <> requested_count then
    raise exception 'AI_DRAFT_COUNT_MISMATCH';
  end if;

  update public.ai_generation_targets
  set status = 'succeeded',
      draft_count = inserted_count,
      request_payload = incoming_payload,
      completed_at = pg_catalog.now()
  where id = target_id;

  return target_id;
end;
$$;

revoke all on function public.replace_ai_task_drafts(
  uuid, uuid, date, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.replace_ai_task_drafts(
  uuid, uuid, date, uuid, text, text, jsonb
) to service_role;

create or replace function public.record_ai_generation_target(
  p_run_id uuid,
  p_lahan_id uuid,
  p_scheduled_for date,
  p_status text,
  p_error_code text,
  p_result_summary text,
  p_weather_snapshot_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  generation_run public.ai_generation_runs%rowtype;
  plot public.lahan%rowtype;
  snapshot public.weather_snapshots%rowtype;
  existing_target public.ai_generation_targets%rowtype;
  current_succeeded_target_id uuid;
  previous_target_id uuid;
  next_version integer;
  target_id uuid;
  normalized_error_code text;
  normalized_summary text;
begin
  if p_run_id is null
    or p_lahan_id is null
    or p_scheduled_for is null
  then
    raise exception 'GENERATION_INPUT_INVALID';
  end if;

  if p_status is null or p_status not in ('skipped', 'failed') then
    raise exception 'GENERATION_TARGET_STATUS_INVALID';
  end if;

  normalized_error_code := nullif(pg_catalog.btrim(p_error_code), '');
  normalized_summary := nullif(pg_catalog.btrim(p_result_summary), '');

  if normalized_error_code is not null
    and pg_catalog.char_length(normalized_error_code) > 120
  then
    raise exception 'GENERATION_ERROR_CODE_INVALID';
  end if;

  if normalized_summary is not null
    and pg_catalog.char_length(normalized_summary) > 2000
  then
    raise exception 'GENERATION_SUMMARY_INVALID';
  end if;

  if p_status = 'failed' and normalized_error_code is null then
    raise exception 'GENERATION_ERROR_CODE_REQUIRED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_lahan_id::text || ':' || p_scheduled_for::text,
      0
    )
  );

  select target.*
  into existing_target
  from public.ai_generation_targets target
  where target.run_id = p_run_id
    and target.lahan_id = p_lahan_id
  for update;

  if found then
    if existing_target.status = p_status
      and existing_target.scheduled_for = p_scheduled_for
      and existing_target.weather_snapshot_id is not distinct from
        p_weather_snapshot_id
      and existing_target.error_code is not distinct from normalized_error_code
      and existing_target.result_summary is not distinct from normalized_summary
    then
      return existing_target.id;
    end if;

    raise exception 'GENERATION_RETRY_MISMATCH';
  end if;

  select run.*
  into generation_run
  from public.ai_generation_runs run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception 'GENERATION_RUN_NOT_FOUND';
  end if;

  if generation_run.status <> 'running'
    or generation_run.scheduled_for <> p_scheduled_for
  then
    raise exception 'GENERATION_RUN_INVALID';
  end if;

  if generation_run.trigger = 'cron' then
    select current_target.id
    into current_succeeded_target_id
    from public.ai_generation_targets current_target
    where current_target.lahan_id = p_lahan_id
      and current_target.scheduled_for = p_scheduled_for
      and current_target.is_current
      and current_target.status = 'succeeded'
    for update;

    if found then
      return current_succeeded_target_id;
    end if;
  end if;

  select candidate.*
  into plot
  from public.lahan candidate
  where candidate.id = p_lahan_id
  for update;

  if not found then
    raise exception 'PLOT_NOT_FOUND';
  end if;

  if p_weather_snapshot_id is not null then
    select weather.*
    into snapshot
    from public.weather_snapshots weather
    where weather.id = p_weather_snapshot_id;

    if not found or snapshot.lahan_id <> p_lahan_id then
      raise exception 'WEATHER_SNAPSHOT_INVALID';
    end if;
  end if;

  select current_target.id
  into previous_target_id
  from public.ai_generation_targets current_target
  where current_target.lahan_id = p_lahan_id
    and current_target.scheduled_for = p_scheduled_for
    and current_target.is_current
  for update;

  if previous_target_id is not null then
    update public.ai_generation_targets
    set is_current = false
    where id = previous_target_id;

    update public.ai_task_drafts
    set status = 'superseded',
        updated_at = pg_catalog.now()
    where generation_target_id = previous_target_id
      and status = 'pending';
  end if;

  select coalesce(pg_catalog.max(target.version), 0) + 1
  into next_version
  from public.ai_generation_targets target
  where target.lahan_id = p_lahan_id
    and target.scheduled_for = p_scheduled_for;

  insert into public.ai_generation_targets (
    run_id,
    lahan_id,
    scheduled_for,
    version,
    is_current,
    status,
    draft_count,
    weather_snapshot_id,
    result_summary,
    error_code,
    completed_at
  ) values (
    p_run_id,
    p_lahan_id,
    p_scheduled_for,
    next_version,
    true,
    p_status,
    0,
    p_weather_snapshot_id,
    normalized_summary,
    normalized_error_code,
    pg_catalog.now()
  )
  returning id into target_id;

  return target_id;
end;
$$;

revoke all on function public.record_ai_generation_target(
  uuid, uuid, date, text, text, text, uuid
) from public, anon, authenticated;
grant execute on function public.record_ai_generation_target(
  uuid, uuid, date, text, text, text, uuid
) to service_role;

create or replace function public.approve_ai_task_draft(
  p_draft_id uuid,
  p_assignee_id uuid,
  p_judul text,
  p_deskripsi text,
  p_priority text,
  p_requires_location boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.ai_task_drafts%rowtype;
  approval_plot public.lahan%rowtype;
  assignee public.users%rowtype;
  draft_lahan_id uuid;
  draft_scheduled_for date;
  task_id uuid;
begin
  if not public.is_internal() then
    raise exception 'INTERNAL_REQUIRED';
  end if;

  if p_draft_id is null
    or p_assignee_id is null
    or p_judul is null
    or pg_catalog.char_length(pg_catalog.btrim(p_judul))
      not between 3 and 120
    or p_deskripsi is null
    or pg_catalog.char_length(pg_catalog.btrim(p_deskripsi))
      not between 10 and 1500
    or p_priority is null
    or p_priority not in ('low', 'medium', 'high')
    or p_requires_location is null
  then
    raise exception 'DRAFT_APPROVAL_INPUT_INVALID';
  end if;

  select candidate.lahan_id, candidate.scheduled_for
  into draft_lahan_id, draft_scheduled_for
  from public.ai_task_drafts candidate
  where candidate.id = p_draft_id;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      draft_lahan_id::text || ':' || draft_scheduled_for::text,
      0
    )
  );

  select candidate.*
  into draft
  from public.ai_task_drafts candidate
  where candidate.id = p_draft_id
  for update;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  if draft.status <> 'pending' then
    raise exception 'DRAFT_NOT_PENDING';
  end if;

  select plot.*
  into approval_plot
  from public.lahan plot
  where plot.id = draft.lahan_id
  for share;

  if not found or approval_plot.status <> 'aktif' then
    raise exception 'PLOT_INACTIVE';
  end if;

  select farmer.*
  into assignee
  from public.users farmer
  where farmer.id = p_assignee_id
  for share;

  if not found or assignee.role <> 'farmer'::public.user_role then
    raise exception 'ASSIGNEE_NOT_FARMER';
  end if;

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
    pg_catalog.btrim(p_judul),
    pg_catalog.btrim(p_deskripsi),
    'belum_dikerjakan'::public.task_status,
    draft.scheduled_for,
    p_priority,
    'ai',
    draft.id,
    draft.ai_reason,
    p_requires_location
  )
  returning id into task_id;

  update public.ai_task_drafts
  set status = 'approved',
      proposed_assignee_id = p_assignee_id,
      judul = pg_catalog.btrim(p_judul),
      deskripsi = pg_catalog.btrim(p_deskripsi),
      priority = p_priority,
      requires_location = p_requires_location,
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      created_task_id = task_id,
      updated_at = pg_catalog.now()
  where id = draft.id;

  return task_id;
end;
$$;

revoke all on function public.approve_ai_task_draft(
  uuid, uuid, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.approve_ai_task_draft(
  uuid, uuid, text, text, text, boolean
) to authenticated;

create or replace function public.bulk_approve_ai_task_drafts(
  p_draft_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_count integer;
  found_count integer;
  pending_count integer;
  draft_id uuid;
  draft public.ai_task_drafts%rowtype;
  draft_key record;
  task_ids uuid[] := array[]::uuid[];
begin
  if not public.is_internal() then
    raise exception 'INTERNAL_REQUIRED';
  end if;

  requested_count := pg_catalog.cardinality(p_draft_ids);
  if p_draft_ids is null
    or requested_count is null
    or requested_count not between 1 and 50
  then
    raise exception 'DRAFT_SELECTION_INVALID';
  end if;

  if pg_catalog.array_position(p_draft_ids, null::uuid) is not null then
    raise exception 'DRAFT_SELECTION_INVALID';
  end if;

  select pg_catalog.count(distinct selected_id)
  into found_count
  from pg_catalog.unnest(p_draft_ids) selected_id;

  if found_count <> requested_count then
    raise exception 'DRAFT_SELECTION_DUPLICATE';
  end if;

  select pg_catalog.count(*)
  into found_count
  from public.ai_task_drafts candidate
  where candidate.id = any(p_draft_ids);

  if found_count <> requested_count then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  for draft_key in
    select distinct candidate.lahan_id, candidate.scheduled_for
    from public.ai_task_drafts candidate
    where candidate.id = any(p_draft_ids)
    order by candidate.lahan_id, candidate.scheduled_for
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        draft_key.lahan_id::text || ':' || draft_key.scheduled_for::text,
        0
      )
    );
  end loop;

  select pg_catalog.count(*)
  into found_count
  from (
    select candidate.id
    from public.ai_task_drafts candidate
    where candidate.id = any(p_draft_ids)
    order by candidate.id
    for update
  ) locked_drafts;

  if found_count <> requested_count then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  select pg_catalog.count(*)
  into pending_count
  from public.ai_task_drafts candidate
  where candidate.id = any(p_draft_ids)
    and candidate.status = 'pending';

  if pending_count <> requested_count then
    raise exception 'DRAFT_NOT_PENDING';
  end if;

  foreach draft_id in array p_draft_ids
  loop
    select candidate.*
    into draft
    from public.ai_task_drafts candidate
    where candidate.id = draft_id;

    task_ids := pg_catalog.array_append(
      task_ids,
      public.approve_ai_task_draft(
        draft.id,
        draft.proposed_assignee_id,
        draft.judul,
        draft.deskripsi,
        draft.priority,
        draft.requires_location
      )
    );
  end loop;

  return task_ids;
end;
$$;

revoke all on function public.bulk_approve_ai_task_drafts(uuid[])
  from public, anon, authenticated;
grant execute on function public.bulk_approve_ai_task_drafts(uuid[])
  to authenticated;

create or replace function public.reject_ai_task_draft(
  p_draft_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft public.ai_task_drafts%rowtype;
  normalized_reason text;
begin
  if not public.is_internal() then
    raise exception 'INTERNAL_REQUIRED';
  end if;

  normalized_reason := nullif(pg_catalog.btrim(p_reason), '');
  if normalized_reason is null
    or pg_catalog.char_length(normalized_reason) not between 3 and 1000
  then
    raise exception 'REJECTION_REASON_INVALID';
  end if;

  select candidate.*
  into draft
  from public.ai_task_drafts candidate
  where candidate.id = p_draft_id
  for update;

  if not found then
    raise exception 'DRAFT_NOT_FOUND';
  end if;

  if draft.status <> 'pending' then
    raise exception 'DRAFT_NOT_PENDING';
  end if;

  update public.ai_task_drafts
  set status = 'rejected',
      rejection_reason = normalized_reason,
      reviewed_by = auth.uid(),
      reviewed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where id = draft.id;

  return draft.id;
end;
$$;

revoke all on function public.reject_ai_task_draft(uuid, text)
  from public, anon, authenticated;
grant execute on function public.reject_ai_task_draft(uuid, text)
  to authenticated;

create or replace function public.register_attendance(
  p_lahan_id uuid,
  p_lat numeric,
  p_lng numeric
)
returns public.absensi
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_farmer_id uuid := auth.uid();
  plot public.lahan%rowtype;
  attendance public.absensi%rowtype;
  work_date date;
  attendance_time timestamptz;
  haversine_a double precision;
  distance_m numeric;
begin
  if caller_farmer_id is null
    or public.current_user_role()
      is distinct from 'farmer'::public.user_role
  then
    raise exception 'FARMER_REQUIRED';
  end if;

  if p_lahan_id is null
    or p_lat is null
    or not (p_lat between -90 and 90)
    or p_lng is null
    or not (p_lng between -180 and 180)
  then
    raise exception 'COORDINATES_INVALID';
  end if;

  select candidate.*
  into plot
  from public.lahan candidate
  where candidate.id = p_lahan_id
  for update;

  if not found then
    raise exception 'PLOT_NOT_FOUND';
  end if;

  if plot.status <> 'aktif' then
    raise exception 'PLOT_INACTIVE';
  end if;

  if plot.farmer_id is distinct from caller_farmer_id then
    raise exception 'PLOT_NOT_ASSIGNED';
  end if;

  if plot.lat_center is null
    or not (plot.lat_center between -90 and 90)
    or plot.lng_center is null
    or not (plot.lng_center between -180 and 180)
    or plot.radius_geofence_m is null
    or plot.radius_geofence_m <= 0
  then
    raise exception 'PLOT_GEOFENCE_INVALID';
  end if;

  attendance_time := pg_catalog.statement_timestamp();
  work_date :=
    (attendance_time at time zone 'Asia/Jakarta')::date;

  haversine_a :=
    pg_catalog.power(
      pg_catalog.sin(
        pg_catalog.radians(
          (p_lat::double precision - plot.lat_center::double precision) / 2
        )
      ),
      2
    )
    + pg_catalog.cos(pg_catalog.radians(plot.lat_center::double precision))
      * pg_catalog.cos(pg_catalog.radians(p_lat::double precision))
      * pg_catalog.power(
        pg_catalog.sin(
          pg_catalog.radians(
            (p_lng::double precision - plot.lng_center::double precision) / 2
          )
        ),
        2
      );

  haversine_a := case
    when haversine_a < 0 then 0
    when haversine_a > 1 then 1
    else haversine_a
  end;
  distance_m := (
    6371000::double precision
    * 2
    * pg_catalog.asin(pg_catalog.sqrt(haversine_a))
  )::numeric;

  if distance_m > plot.radius_geofence_m then
    raise exception 'OUTSIDE_GEOFENCE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      caller_farmer_id::text
        || ':' || p_lahan_id::text
        || ':' || work_date::text,
      0
    )
  );

  select existing.*
  into attendance
  from public.absensi existing
  where existing.farmer_id = caller_farmer_id
    and existing.lahan_id = p_lahan_id
    and existing.attendance_date = work_date
  for update;

  if found then
    if attendance.status_geofence <> 'valid'::public.geofence_status then
      raise exception 'ATTENDANCE_CONFLICT_INVALID';
    end if;
    return attendance;
  end if;

  insert into public.absensi (
    farmer_id,
    lahan_id,
    waktu_masuk,
    attendance_date,
    lat,
    lng,
    distance_m,
    status_geofence
  ) values (
    caller_farmer_id,
    p_lahan_id,
    attendance_time,
    work_date,
    p_lat,
    p_lng,
    distance_m,
    'valid'::public.geofence_status
  )
  on conflict (farmer_id, lahan_id, attendance_date) do nothing
  returning * into attendance;

  if not found then
    select existing.*
    into attendance
    from public.absensi existing
    where existing.farmer_id = caller_farmer_id
      and existing.lahan_id = p_lahan_id
      and existing.attendance_date = work_date
    for update;
  end if;

  if attendance.id is null
    or attendance.status_geofence <> 'valid'::public.geofence_status
  then
    raise exception 'ATTENDANCE_CONFLICT_INVALID';
  end if;

  return attendance;
end;
$$;

revoke all on function public.register_attendance(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.register_attendance(uuid, numeric, numeric)
  to authenticated;

create or replace function public.start_assigned_task(
  p_task_id uuid
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_farmer_id uuid := auth.uid();
  task public.tasks%rowtype;
begin
  if caller_farmer_id is null
    or public.current_user_role()
      is distinct from 'farmer'::public.user_role
  then
    raise exception 'FARMER_REQUIRED';
  end if;

  select candidate.*
  into task
  from public.tasks candidate
  where candidate.id = p_task_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if task.assigned_to is distinct from caller_farmer_id then
    raise exception 'TASK_NOT_ASSIGNED';
  end if;

  if task.status = 'selesai'::public.task_status then
    raise exception 'TASK_ALREADY_COMPLETED';
  end if;

  update public.tasks
  set status = 'sedang_dikerjakan'::public.task_status,
      unlocked_at = coalesce(unlocked_at, pg_catalog.now())
  where id = task.id
  returning * into task;

  return task;
end;
$$;

revoke all on function public.start_assigned_task(uuid)
  from public, anon, authenticated;
grant execute on function public.start_assigned_task(uuid)
  to authenticated;

create or replace function public.register_task_evidence(
  p_task_id uuid,
  p_photo_path text,
  p_note text,
  p_lat numeric,
  p_lng numeric,
  p_ai_placeholder_summary text
)
returns public.task_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_farmer_id uuid := auth.uid();
  task public.tasks%rowtype;
  plot public.lahan%rowtype;
  evidence public.task_evidence%rowtype;
  attempt_number integer;
  normalized_path text;
  normalized_note text;
  normalized_summary text;
  storage_object_id uuid;
  required_path_pattern text;
  haversine_a double precision;
  distance_m numeric;
begin
  if caller_farmer_id is null
    or public.current_user_role()
      is distinct from 'farmer'::public.user_role
  then
    raise exception 'FARMER_REQUIRED';
  end if;

  select candidate.*
  into task
  from public.tasks candidate
  where candidate.id = p_task_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if task.assigned_to is distinct from caller_farmer_id then
    raise exception 'TASK_NOT_ASSIGNED';
  end if;

  if task.status = 'selesai'::public.task_status then
    raise exception 'TASK_ALREADY_COMPLETED';
  end if;

  normalized_path := pg_catalog.btrim(p_photo_path);
  normalized_note := nullif(pg_catalog.btrim(p_note), '');
  normalized_summary :=
    nullif(pg_catalog.btrim(p_ai_placeholder_summary), '');

  if normalized_note is not null
    and pg_catalog.char_length(normalized_note) > 1500
  then
    raise exception 'EVIDENCE_NOTE_INVALID';
  end if;

  if normalized_summary is not null
    and pg_catalog.char_length(normalized_summary) > 1500
  then
    raise exception 'EVIDENCE_AI_SUMMARY_INVALID';
  end if;

  required_path_pattern :=
    '^' || caller_farmer_id::text || '/' || task.id::text
    || '/[A-Za-z0-9][A-Za-z0-9._-]{0,180}\.(jpg|jpeg|png)$';

  if normalized_path is null
    or pg_catalog.char_length(normalized_path) > 300
    or pg_catalog.strpos(normalized_path, '..') > 0
    or pg_catalog.strpos(normalized_path, E'\\') > 0
    or normalized_path !~ required_path_pattern
  then
    raise exception 'EVIDENCE_PHOTO_PATH_INVALID';
  end if;

  select object.id
    into storage_object_id
    from storage.objects object
    where object.bucket_id = 'task-evidence'
      and object.name = normalized_path
    for key share;

  if not found then
    raise exception 'EVIDENCE_PHOTO_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.task_evidence existing
    where existing.photo_path = normalized_path
  ) then
    raise exception 'EVIDENCE_PHOTO_ALREADY_USED';
  end if;

  if (p_lat is null) <> (p_lng is null) then
    raise exception 'EVIDENCE_COORDINATES_INCOMPLETE';
  end if;

  if p_lat is not null
    and (
      not (p_lat between -90 and 90)
      or not (p_lng between -180 and 180)
    )
  then
    raise exception 'EVIDENCE_COORDINATES_INVALID';
  end if;

  select candidate.*
  into plot
  from public.lahan candidate
  where candidate.id = task.lahan_id;

  if not found then
    raise exception 'PLOT_NOT_FOUND';
  end if;

  if task.requires_location and p_lat is null then
    raise exception 'EVIDENCE_LOCATION_REQUIRED';
  end if;

  if p_lat is not null then
    if plot.lat_center is null
      or not (plot.lat_center between -90 and 90)
      or plot.lng_center is null
      or not (plot.lng_center between -180 and 180)
      or plot.radius_geofence_m is null
      or plot.radius_geofence_m <= 0
    then
      raise exception 'PLOT_GEOFENCE_INVALID';
    end if;

    haversine_a :=
      pg_catalog.power(
        pg_catalog.sin(
          pg_catalog.radians(
            (p_lat::double precision - plot.lat_center::double precision) / 2
          )
        ),
        2
      )
      + pg_catalog.cos(pg_catalog.radians(plot.lat_center::double precision))
        * pg_catalog.cos(pg_catalog.radians(p_lat::double precision))
        * pg_catalog.power(
          pg_catalog.sin(
            pg_catalog.radians(
              (p_lng::double precision - plot.lng_center::double precision) / 2
            )
          ),
          2
        );

    haversine_a := case
      when haversine_a < 0 then 0
      when haversine_a > 1 then 1
      else haversine_a
    end;
    distance_m := (
      6371000::double precision
      * 2
      * pg_catalog.asin(pg_catalog.sqrt(haversine_a))
    )::numeric;

    if task.requires_location and distance_m > plot.radius_geofence_m then
      raise exception 'EVIDENCE_OUTSIDE_GEOFENCE';
    end if;
  end if;

  if exists (
    select 1
    from public.task_evidence pending
    where pending.task_id = task.id
      and pending.review_status = 'pending'
  ) then
    raise exception 'EVIDENCE_PENDING_REVIEW';
  end if;

  select coalesce(pg_catalog.max(previous.attempt_number), 0) + 1
  into attempt_number
  from public.task_evidence previous
  where previous.task_id = task.id;

  insert into public.task_evidence (
    task_id,
    farmer_id,
    lahan_id,
    photo_path,
    storage_object_id,
    note,
    lat,
    lng,
    ai_placeholder_summary,
    attempt_number,
    review_status
  ) values (
    task.id,
    caller_farmer_id,
    task.lahan_id,
    normalized_path,
    storage_object_id,
    normalized_note,
    p_lat,
    p_lng,
    normalized_summary,
    attempt_number,
    'pending'
  )
  returning * into evidence;

  update public.tasks
  set status = 'sedang_dikerjakan'::public.task_status,
      unlocked_at = coalesce(unlocked_at, pg_catalog.now())
  where id = task.id;

  return evidence;
end;
$$;

revoke all on function public.register_task_evidence(
  uuid, text, text, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.register_task_evidence(
  uuid, text, text, numeric, numeric, text
) to authenticated;

create or replace function public.review_task_evidence(
  p_evidence_id uuid,
  p_decision text,
  p_note text
)
returns public.task_evidence
language plpgsql
security definer
set search_path = ''
as $$
declare
  evidence public.task_evidence%rowtype;
  task public.tasks%rowtype;
  task_id uuid;
  normalized_note text;
begin
  if not public.is_internal() then
    raise exception 'INTERNAL_REQUIRED';
  end if;

  if p_decision is null
    or p_decision not in ('accepted', 'revision_requested')
  then
    raise exception 'EVIDENCE_DECISION_INVALID';
  end if;

  normalized_note := nullif(pg_catalog.btrim(p_note), '');
  if p_decision = 'revision_requested'
    and (
      normalized_note is null
      or pg_catalog.char_length(normalized_note) not between 3 and 1000
    )
  then
    raise exception 'REVIEW_NOTE_REQUIRED';
  end if;

  if normalized_note is not null
    and pg_catalog.char_length(normalized_note) > 1000
  then
    raise exception 'REVIEW_NOTE_INVALID';
  end if;

  select candidate.task_id
  into task_id
  from public.task_evidence candidate
  where candidate.id = p_evidence_id;

  if not found then
    raise exception 'EVIDENCE_NOT_FOUND';
  end if;

  select candidate.*
  into task
  from public.tasks candidate
  where candidate.id = task_id
  for update;

  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  select candidate.*
  into evidence
  from public.task_evidence candidate
  where candidate.id = p_evidence_id
  for update;

  if not found then
    raise exception 'EVIDENCE_NOT_FOUND';
  end if;

  if evidence.review_status <> 'pending' then
    raise exception 'EVIDENCE_NOT_PENDING';
  end if;

  update public.task_evidence
  set review_status = p_decision,
      reviewed_by = auth.uid(),
      review_note = normalized_note,
      reviewed_at = pg_catalog.now()
  where id = evidence.id
  returning * into evidence;

  update public.tasks
  set status = case
    when p_decision = 'accepted'
      then 'selesai'::public.task_status
    else 'sedang_dikerjakan'::public.task_status
  end
  where id = task.id;

  return evidence;
end;
$$;

revoke all on function public.review_task_evidence(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_task_evidence(uuid, text, text)
  to authenticated;
