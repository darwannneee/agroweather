drop policy if exists "weather snapshots farmer assigned select"
on public.weather_snapshots;

create policy "weather snapshots farmer assigned select"
on public.weather_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.lahan plot
    where plot.id = weather_snapshots.lahan_id
      and plot.farmer_id = auth.uid()
  )
);
