-- Allow authenticated app users to read user rows for MVP farmer assignment UI.
-- Existing MVP policies already allow authenticated reads on lahan/tasks/absensi.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'users'
      and policyname = 'auth read users for assignment'
  ) then
    create policy "auth read users for assignment" on public.users
      for select using (auth.role() = 'authenticated');
  end if;
end $$;
