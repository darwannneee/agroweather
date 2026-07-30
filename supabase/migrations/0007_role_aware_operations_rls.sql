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

alter table public.users enable row level security;
alter table public.lahan enable row level security;
alter table public.absensi enable row level security;
alter table public.tasks enable row level security;
alter table public.rekomendasi_cuaca enable row level security;
alter table public.task_evidence enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.ai_generation_runs enable row level security;
alter table public.ai_generation_targets enable row level security;
alter table public.ai_task_drafts enable row level security;

drop policy if exists "users self select" on public.users;
drop policy if exists "users self insert" on public.users;
drop policy if exists "users self update" on public.users;
drop policy if exists "auth read users for assignment" on public.users;
drop policy if exists "logged_in_full_access" on public.users;
drop policy if exists "users scoped select" on public.users;

drop policy if exists "auth read lahan" on public.lahan;
drop policy if exists "auth write lahan" on public.lahan;
drop policy if exists "logged_in_full_access" on public.lahan;

drop policy if exists "auth read absensi" on public.absensi;
drop policy if exists "auth write absensi" on public.absensi;
drop policy if exists "logged_in_full_access" on public.absensi;

drop policy if exists "auth read tasks" on public.tasks;
drop policy if exists "auth write tasks" on public.tasks;
drop policy if exists "logged_in_full_access" on public.tasks;

drop policy if exists "auth read cuaca" on public.rekomendasi_cuaca;
drop policy if exists "auth write cuaca" on public.rekomendasi_cuaca;
drop policy if exists "logged_in_full_access"
on public.rekomendasi_cuaca;

drop policy if exists "auth read task evidence"
on public.task_evidence;
drop policy if exists "auth write own task evidence"
on public.task_evidence;

drop policy if exists "task evidence authenticated read"
on storage.objects;
drop policy if exists "task evidence owner insert"
on storage.objects;
drop policy if exists "task evidence owner delete"
on storage.objects;
drop policy if exists "task evidence scoped read"
on storage.objects;
drop policy if exists "task evidence scoped insert"
on storage.objects;
drop policy if exists "task evidence orphan cleanup"
on storage.objects;

revoke all on table public.users from anon, authenticated;
revoke all on table public.lahan from anon, authenticated;
revoke all on table public.absensi from anon, authenticated;
revoke all on table public.tasks from anon, authenticated;
revoke all on table public.rekomendasi_cuaca from anon, authenticated;
revoke all on table public.task_evidence from anon, authenticated;
revoke all on table public.weather_snapshots from anon, authenticated;
revoke all on table public.ai_generation_runs from anon, authenticated;
revoke all on table public.ai_generation_targets from anon, authenticated;
revoke all on table public.ai_task_drafts from anon, authenticated;

grant select on table public.users to authenticated;
grant select, insert, update, delete on table public.lahan
to authenticated;
grant select on table public.absensi to authenticated;
grant select, insert on table public.tasks to authenticated;
grant select, insert, update, delete
on table public.rekomendasi_cuaca
to authenticated;
grant select on table public.task_evidence to authenticated;
grant select on table public.weather_snapshots to authenticated;
grant select on table public.ai_generation_runs to authenticated;
grant select on table public.ai_generation_targets to authenticated;
grant select on table public.ai_task_drafts to authenticated;

grant all on table public.users to service_role;
grant all on table public.lahan to service_role;
grant all on table public.absensi to service_role;
grant all on table public.tasks to service_role;
grant all on table public.rekomendasi_cuaca to service_role;
grant all on table public.task_evidence to service_role;
grant all on table public.weather_snapshots to service_role;
grant all on table public.ai_generation_runs to service_role;
grant all on table public.ai_generation_targets to service_role;
grant all on table public.ai_task_drafts to service_role;

create policy "users scoped select"
on public.users
for select
to authenticated
using (
  auth.uid() = id
  or public.is_internal()
);

create policy "lahan scoped select"
on public.lahan
for select
to authenticated
using (public.can_access_plot(id));

create policy "lahan internal insert"
on public.lahan
for insert
to authenticated
with check (public.is_internal());

create policy "lahan internal update"
on public.lahan
for update
to authenticated
using (public.is_internal())
with check (public.is_internal());

create policy "lahan internal delete"
on public.lahan
for delete
to authenticated
using (public.is_internal());

create policy "tasks scoped select"
on public.tasks
for select
to authenticated
using (
  public.is_internal()
  or assigned_to = auth.uid()
);

create policy "tasks internal manual insert"
on public.tasks
for insert
to authenticated
with check (
  public.is_internal()
  and status = 'belum_dikerjakan'::public.task_status
  and source = 'manual'
  and source_draft_id is null
  and assigned_by = auth.uid()
  and exists (
    select 1
    from public.users assignee
    where assignee.id = assigned_to
      and assignee.role = 'farmer'::public.user_role
  )
  and exists (
    select 1
    from public.lahan plot
    where plot.id = lahan_id
      and plot.status = 'aktif'
  )
);

create policy "attendance scoped select"
on public.absensi
for select
to authenticated
using (
  public.is_internal()
  or farmer_id = auth.uid()
);

create policy "task evidence scoped select"
on public.task_evidence
for select
to authenticated
using (
  public.is_internal()
  or farmer_id = auth.uid()
);

create policy "weather snapshots internal select"
on public.weather_snapshots
for select
to authenticated
using (public.is_internal());

create policy "AI generation runs internal select"
on public.ai_generation_runs
for select
to authenticated
using (public.is_internal());

create policy "AI generation targets internal select"
on public.ai_generation_targets
for select
to authenticated
using (public.is_internal());

create policy "AI task drafts internal select"
on public.ai_task_drafts
for select
to authenticated
using (public.is_internal());

create policy "weather recommendations scoped select"
on public.rekomendasi_cuaca
for select
to authenticated
using (public.can_access_plot(lahan_id));

create policy "weather recommendations internal insert"
on public.rekomendasi_cuaca
for insert
to authenticated
with check (public.is_internal());

create policy "weather recommendations internal update"
on public.rekomendasi_cuaca
for update
to authenticated
using (public.is_internal())
with check (public.is_internal());

create policy "weather recommendations internal delete"
on public.rekomendasi_cuaca
for delete
to authenticated
using (public.is_internal());

create policy "task evidence scoped read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-evidence'
  and (
    public.is_internal()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

create policy "task evidence scoped insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-evidence'
  and pg_catalog.cardinality(storage.foldername(name)) = 2
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.tasks task
    where task.id::text = (storage.foldername(name))[2]
      and task.assigned_to = auth.uid()
      and task.status <> 'selesai'::public.task_status
  )
);

create policy "task evidence orphan cleanup"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-evidence'
  and pg_catalog.cardinality(storage.foldername(name)) = 2
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.tasks task
    where task.id::text = (storage.foldername(name))[2]
      and task.assigned_to = auth.uid()
  )
);
