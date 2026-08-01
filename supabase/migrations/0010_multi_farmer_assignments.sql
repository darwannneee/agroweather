-- Multi-farmer plot assignments and internal farmer management.

create table if not exists public.lahan_petani (
  lahan_id uuid not null,
  farmer_id uuid not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lahan_petani_pkey primary key (lahan_id, farmer_id),
  constraint lahan_petani_lahan_id_fkey
    foreign key (lahan_id) references public.lahan(id) on delete cascade,
  constraint lahan_petani_farmer_id_fkey
    foreign key (farmer_id) references public.users(id) on delete cascade
);

create index if not exists idx_lahan_petani_farmer_id
  on public.lahan_petani(farmer_id);

create index if not exists idx_lahan_petani_lahan_id
  on public.lahan_petani(lahan_id);

create unique index if not exists idx_lahan_petani_one_primary
  on public.lahan_petani(lahan_id)
  where is_primary;

insert into public.lahan_petani (lahan_id, farmer_id, is_primary)
select plot.id, plot.farmer_id, true
from public.lahan plot
where plot.farmer_id is not null
on conflict (lahan_id, farmer_id) do update
set is_primary = true,
    updated_at = pg_catalog.now();

alter table public.lahan_petani enable row level security;

drop policy if exists "lahan petani scoped select"
on public.lahan_petani;

revoke all on table public.lahan_petani from anon, authenticated;
grant select on table public.lahan_petani to authenticated;
grant all on table public.lahan_petani to service_role;

create policy "lahan petani scoped select"
on public.lahan_petani
for select
to authenticated
using (
  public.is_internal()
  or farmer_id = auth.uid()
);

create or replace function public.repair_plot_primary(p_lahan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  primary_farmer_id uuid;
begin
  select assignment.farmer_id
  into primary_farmer_id
  from public.lahan_petani assignment
  where assignment.lahan_id = p_lahan_id
    and assignment.is_primary
  order by assignment.updated_at desc, assignment.created_at desc
  limit 1;

  if primary_farmer_id is null then
    select assignment.farmer_id
    into primary_farmer_id
    from public.lahan_petani assignment
    where assignment.lahan_id = p_lahan_id
    order by assignment.created_at asc, assignment.farmer_id asc
    limit 1;

    if primary_farmer_id is not null then
      update public.lahan_petani assignment
      set is_primary = assignment.farmer_id = primary_farmer_id,
          updated_at = pg_catalog.now()
      where assignment.lahan_id = p_lahan_id;
    end if;
  end if;

  update public.lahan plot
  set farmer_id = primary_farmer_id,
      updated_at = pg_catalog.now()
  where plot.id = p_lahan_id
    and plot.farmer_id is distinct from primary_farmer_id;
end;
$$;

revoke all on function public.repair_plot_primary(uuid)
from public, anon, authenticated;

create or replace function public.set_plot_farmer_assignments(
  p_lahan_id uuid,
  p_farmer_ids uuid[],
  p_primary_farmer_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_farmer_ids uuid[];
  effective_primary_farmer_id uuid;
  farmer_count bigint;
begin
  if not public.is_internal() then
    raise exception 'INTERNAL_REQUIRED';
  end if;

  if p_lahan_id is null or not exists (
    select 1
    from public.lahan plot
    where plot.id = p_lahan_id
  ) then
    raise exception 'PLOT_NOT_FOUND';
  end if;

  with normalized as (
    select distinct on (raw_id) raw_id as id, ord
    from pg_catalog.unnest(
      coalesce(p_farmer_ids, array[]::uuid[])
    ) with ordinality as raw(raw_id, ord)
    where raw_id is not null
    order by raw_id, ord
  )
  select coalesce(
    pg_catalog.array_agg(normalized.id order by normalized.ord),
    array[]::uuid[]
  )
  into normalized_farmer_ids
  from normalized;

  if pg_catalog.cardinality(normalized_farmer_ids) = 0 then
    if p_primary_farmer_id is not null then
      raise exception 'ASSIGNMENT_PRIMARY_INVALID';
    end if;
    effective_primary_farmer_id := null;
  elsif p_primary_farmer_id is null then
    effective_primary_farmer_id := normalized_farmer_ids[1];
  elsif p_primary_farmer_id = any(normalized_farmer_ids) then
    effective_primary_farmer_id := p_primary_farmer_id;
  else
    raise exception 'ASSIGNMENT_PRIMARY_INVALID';
  end if;

  select pg_catalog.count(*)
  into farmer_count
  from public.users app_user
  where app_user.id = any(normalized_farmer_ids)
    and app_user.role = 'farmer'::public.user_role;

  if farmer_count <> pg_catalog.cardinality(normalized_farmer_ids) then
    raise exception 'ASSIGNMENT_FARMER_INVALID';
  end if;

  update public.lahan_petani assignment
  set is_primary = false,
      updated_at = pg_catalog.now()
  where assignment.lahan_id = p_lahan_id
    and assignment.is_primary;

  delete from public.lahan_petani assignment
  where assignment.lahan_id = p_lahan_id
    and not (assignment.farmer_id = any(normalized_farmer_ids));

  insert into public.lahan_petani (lahan_id, farmer_id, is_primary)
  select p_lahan_id, farmer_id, false
  from pg_catalog.unnest(normalized_farmer_ids) as farmer_ids(farmer_id)
  on conflict (lahan_id, farmer_id) do update
  set updated_at = pg_catalog.now();

  if effective_primary_farmer_id is not null then
    update public.lahan_petani assignment
    set is_primary = true,
        updated_at = pg_catalog.now()
    where assignment.lahan_id = p_lahan_id
      and assignment.farmer_id = effective_primary_farmer_id;
  end if;

  perform public.repair_plot_primary(p_lahan_id);
end;
$$;

revoke all on function public.set_plot_farmer_assignments(uuid, uuid[], uuid)
from public, anon, authenticated;
grant execute on function public.set_plot_farmer_assignments(uuid, uuid[], uuid)
to authenticated;

create or replace function public.create_internal_farmer(
  p_email text,
  p_password text,
  p_nama text,
  p_lahan_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_farmer_id uuid;
  normalized_lahan_ids uuid[];
  plot_count bigint;
  plot_id uuid;
begin
  if not public.is_internal() then
    raise exception 'INTERNAL_REQUIRED';
  end if;

  with normalized as (
    select distinct on (raw_id) raw_id as id, ord
    from pg_catalog.unnest(
      coalesce(p_lahan_ids, array[]::uuid[])
    ) with ordinality as raw(raw_id, ord)
    where raw_id is not null
    order by raw_id, ord
  )
  select coalesce(
    pg_catalog.array_agg(normalized.id order by normalized.ord),
    array[]::uuid[]
  )
  into normalized_lahan_ids
  from normalized;

  select pg_catalog.count(*)
  into plot_count
  from public.lahan plot
  where plot.id = any(normalized_lahan_ids);

  if plot_count <> pg_catalog.cardinality(normalized_lahan_ids) then
    raise exception 'PLOT_NOT_FOUND';
  end if;

  new_farmer_id := public.sign_up_user(
    p_email,
    p_password,
    p_nama,
    'farmer'::public.user_role
  );

  foreach plot_id in array normalized_lahan_ids
  loop
    insert into public.lahan_petani (lahan_id, farmer_id, is_primary)
    values (plot_id, new_farmer_id, false)
    on conflict (lahan_id, farmer_id) do update
    set updated_at = pg_catalog.now();

    perform public.repair_plot_primary(plot_id);
  end loop;

  return new_farmer_id;
end;
$$;

revoke all on function public.create_internal_farmer(text, text, text, uuid[])
from public, anon, authenticated;
grant execute on function public.create_internal_farmer(text, text, text, uuid[])
to authenticated;

create or replace function public.update_internal_farmer_profile(
  p_farmer_id uuid,
  p_email text,
  p_nama text,
  p_lahan_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(p_email));
  normalized_name text := pg_catalog.btrim(p_nama);
  normalized_lahan_ids uuid[];
  previous_lahan_ids uuid[];
  affected_lahan_ids uuid[];
  plot_count bigint;
  plot_id uuid;
begin
  if not public.is_internal() then
    raise exception 'INTERNAL_REQUIRED';
  end if;

  if p_farmer_id is null or not exists (
    select 1
    from public.users app_user
    where app_user.id = p_farmer_id
      and app_user.role = 'farmer'::public.user_role
  ) then
    raise exception 'FARMER_NOT_FOUND';
  end if;

  if normalized_email is null
    or pg_catalog.char_length(normalized_email) not between 5 and 254
    or normalized_email !~
      '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'
  then
    raise exception 'FARMER_EMAIL_INVALID';
  end if;

  if normalized_name is null
    or pg_catalog.char_length(normalized_name) not between 2 and 120
  then
    raise exception 'FARMER_NAME_INVALID';
  end if;

  if exists (
    select 1
    from auth.users existing
    where pg_catalog.lower(existing.email) = normalized_email
      and existing.id <> p_farmer_id
  ) or exists (
    select 1
    from public.users existing_profile
    where pg_catalog.lower(existing_profile.email) = normalized_email
      and existing_profile.id <> p_farmer_id
  ) then
    raise exception 'FARMER_EMAIL_EXISTS';
  end if;

  with normalized as (
    select distinct on (raw_id) raw_id as id, ord
    from pg_catalog.unnest(
      coalesce(p_lahan_ids, array[]::uuid[])
    ) with ordinality as raw(raw_id, ord)
    where raw_id is not null
    order by raw_id, ord
  )
  select coalesce(
    pg_catalog.array_agg(normalized.id order by normalized.ord),
    array[]::uuid[]
  )
  into normalized_lahan_ids
  from normalized;

  select pg_catalog.count(*)
  into plot_count
  from public.lahan plot
  where plot.id = any(normalized_lahan_ids);

  if plot_count <> pg_catalog.cardinality(normalized_lahan_ids) then
    raise exception 'PLOT_NOT_FOUND';
  end if;

  select coalesce(
    pg_catalog.array_agg(assignment.lahan_id),
    array[]::uuid[]
  )
  into previous_lahan_ids
  from public.lahan_petani assignment
  where assignment.farmer_id = p_farmer_id;

  update auth.users auth_user
  set email = normalized_email,
      email_confirmed_at = coalesce(
        auth_user.email_confirmed_at,
        pg_catalog.now()
      ),
      updated_at = pg_catalog.now()
  where auth_user.id = p_farmer_id;

  update auth.identities identity
  set identity_data =
        coalesce(identity.identity_data, '{}'::jsonb)
        || pg_catalog.jsonb_build_object(
          'sub',
          p_farmer_id::text,
          'email',
          normalized_email
        ),
      updated_at = pg_catalog.now()
  where identity.user_id = p_farmer_id
    and identity.provider = 'email';

  update public.users app_user
  set email = normalized_email,
      nama = normalized_name
  where app_user.id = p_farmer_id;

  delete from public.lahan_petani assignment
  where assignment.farmer_id = p_farmer_id
    and not (assignment.lahan_id = any(normalized_lahan_ids));

  insert into public.lahan_petani (lahan_id, farmer_id, is_primary)
  select plot_id, p_farmer_id, false
  from pg_catalog.unnest(normalized_lahan_ids) as plot_ids(plot_id)
  on conflict (lahan_id, farmer_id) do update
  set updated_at = pg_catalog.now();

  select coalesce(
    pg_catalog.array_agg(distinct affected.id),
    array[]::uuid[]
  )
  into affected_lahan_ids
  from (
    select pg_catalog.unnest(previous_lahan_ids) as id
    union
    select pg_catalog.unnest(normalized_lahan_ids) as id
  ) affected
  where affected.id is not null;

  foreach plot_id in array affected_lahan_ids
  loop
    perform public.repair_plot_primary(plot_id);
  end loop;
end;
$$;

revoke all on function public.update_internal_farmer_profile(uuid, text, text, uuid[])
from public, anon, authenticated;
grant execute on function public.update_internal_farmer_profile(uuid, text, text, uuid[])
to authenticated;

create or replace function public.can_access_plot(p_lahan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_internal()
    or exists (
      select 1
      from public.lahan plot
      where plot.id = p_lahan_id
        and plot.farmer_id = auth.uid()
    )
    or exists (
      select 1
      from public.lahan_petani assignment
      where assignment.lahan_id = p_lahan_id
        and assignment.farmer_id = auth.uid()
    )
    or exists (
      select 1
      from public.tasks task
      where task.lahan_id = p_lahan_id
        and task.assigned_to = auth.uid()
    ),
    false
  )
$$;

revoke all on function public.can_access_plot(uuid)
from public, anon, authenticated;
grant execute on function public.can_access_plot(uuid)
to authenticated;

drop policy if exists "weather snapshots farmer assigned select"
on public.weather_snapshots;

create policy "weather snapshots farmer assigned select"
on public.weather_snapshots
for select
to authenticated
using (public.can_access_plot(lahan_id));

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

  if plot.farmer_id is distinct from caller_farmer_id
    and not exists (
      select 1
      from public.lahan_petani assignment
      where assignment.lahan_id = p_lahan_id
        and assignment.farmer_id = caller_farmer_id
    )
  then
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
