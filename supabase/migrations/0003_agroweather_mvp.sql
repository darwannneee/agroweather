-- AgroWeather MVP schema additions for Expo foreground geofence + task evidence.

alter table public.lahan
  add column if not exists luas_hektar numeric,
  add column if not exists fase_lahan text,
  add column if not exists status text not null default 'aktif',
  add column if not exists updated_at timestamptz not null default now();

alter table public.lahan
  alter column radius_geofence_m set default 1000;

alter table public.tasks
  add column if not exists requires_location boolean not null default true,
  add column if not exists unlocked_at timestamptz;

alter table public.absensi
  add column if not exists distance_m numeric;

create table if not exists public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  farmer_id uuid not null references public.users(id) on delete cascade,
  lahan_id uuid not null references public.lahan(id) on delete cascade,
  photo_path text not null,
  note text,
  lat numeric,
  lng numeric,
  ai_placeholder_summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_evidence_task on public.task_evidence(task_id);
create index if not exists idx_task_evidence_farmer on public.task_evidence(farmer_id);
create index if not exists idx_task_evidence_lahan on public.task_evidence(lahan_id);

alter table public.task_evidence enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_evidence'
      and policyname = 'auth read task evidence'
  ) then
    create policy "auth read task evidence" on public.task_evidence
      for select using (auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'task_evidence'
      and policyname = 'auth write own task evidence'
  ) then
    create policy "auth write own task evidence" on public.task_evidence
      for insert with check (auth.uid() = farmer_id);
  end if;
end $$;

insert into storage.buckets (id, name, public)
values ('task-evidence', 'task-evidence', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'task evidence authenticated read'
  ) then
    create policy "task evidence authenticated read" on storage.objects
      for select using (
        bucket_id = 'task-evidence'
        and auth.role() = 'authenticated'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'task evidence owner insert'
  ) then
    create policy "task evidence owner insert" on storage.objects
      for insert with check (
        bucket_id = 'task-evidence'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
