# Runbook rollout AI Task Operations — Supabase KPU

Runbook ini adalah satu-satunya urutan rollout untuk fitur task harian, absensi,
bukti task, dan generator AI pada project hosted Supabase **KPU**
(`sxzuifhcmxakpeyqacze`). Semua waktu operasional memakai `Asia/Jakarta`.

## Aturan keras

- JANGAN jalankan Docker, `supabase start`, `supabase db reset`,
  `supabase test db`, atau `supabase functions serve`.
- JANGAN jalankan `npx supabase db push`. Ledger migration remote KPU kosong,
  sedangkan tabel baseline sudah ada; push mentah tidak dapat membedakan schema
  yang sudah terpasang dan dapat gagal atau menerapkan ulang baseline.
- JANGAN jalankan `supabase migration repair`. Ledger tidak boleh dibuat seolah
  sinkron tanpa audit schema dan deployment record.
- Perubahan schema harus melalui forward SQL yang direview, satu tahap pada satu
  waktu, dalam transaksi. Jangan drop tabel operasional atau histori bukti.
- Jangan aktifkan Cron sebelum schema, secrets, Edge Function, dan smoke test
  manual semuanya lulus.

## Secrets produksi

Empat secret yang wajib tersedia di Edge Function:

```text
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENWEATHER_API_KEY
CRON_SHARED_SECRET
```

Ketentuan:

- Jangan pernah memberi prefix `EXPO_PUBLIC_`. Semua nilai hanya untuk server.
- Jangan menempelkan nilainya ke `.env`, `.env.local`, `app.json`, screenshot,
  log, chat, issue, deployment record, terminal history, atau Git.
- File contoh `supabase/functions/.env.example` hanya boleh berisi nama dengan
  nilai kosong.
- Model pada `OPENROUTER_MODEL` wajib mendukung
  `response_format.type=json_schema` dengan strict structured output.
- `OPENWEATHER_API_KEY` harus mempunyai akses ke **Current Weather** dan
  **5 Day / 3 Hour Forecast**. Implementasi tidak memakai Open-Meteo atau
  One Call.
- Buat `CRON_SHARED_SECRET` acak dan panjang. Nilai ini berbeda dari anon key,
  publishable key, service-role key, dan password database.
- Secret bawaan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan
  `SUPABASE_SERVICE_ROLE_KEY` disediakan oleh hosted Edge Functions; jangan
  menyalinnya ke source app.

Masukkan nilainya hanya melalui Dashboard **Edge Functions → Secrets**. Setelah
itu, CLI boleh dipakai untuk memastikan keempat **nama** tersedia:

```bash
npx supabase secrets list --project-ref sxzuifhcmxakpeyqacze
```

Jangan memakai `supabase secrets set --env-file` pada rollout ini.
`supabase secrets list` hanya dipakai untuk memeriksa nama; jangan mencetak atau
menguji nilainya.

## Deployment record

Buat catatan privat untuk setiap rollout dengan field berikut, tanpa secret:

```text
Project: KPU / sxzuifhcmxakpeyqacze
Tanggal dan operator:
Commit aplikasi:
Checksum 0005:
Checksum 0006:
Checksum 0007:
Hasil preflight duplicate attendance (group + IDs):
Hasil preflight legacy completed tasks (task IDs):
Hasil preflight missing evidence objects (evidence IDs/path):
Hasil rollback-only pgTAP:
Waktu mulai/selesai schema:
Edge deployment version:
Manual smoke test:
Cron job ID dan first-run result:
Keputusan go/no-go:
```

## Urutan rollout

### 1. Kunci artefak dan verifikasi link

Semua command dijalankan dari root repository. Pastikan worktree dan commit yang
akan dirilis tercatat, lalu autentikasi dan link ke ref yang eksplisit:

```bash
git status --short
git rev-parse HEAD
npx supabase login
npx supabase link --project-ref sxzuifhcmxakpeyqacze
```

Jika hasil link bukan project KPU atau ref berbeda, berhenti.

Catat checksum migration:

```bash
shasum -a 256 supabase/migrations/0005_daily_operations_schema.sql
shasum -a 256 supabase/migrations/0006_daily_operations_rpcs.sql
shasum -a 256 supabase/migrations/0007_role_aware_operations_rls.sql
```

### 2. Jalankan preflight read-only pada hosted KPU

Jalankan query berikut di Supabase Dashboard **SQL Editor**. Query ini hanya
membaca data. Ekspor semua row dan ID ke deployment record.

#### Duplicate attendance per petani/lahan/tanggal Jakarta

```sql
select
  farmer_id,
  lahan_id,
  (waktu_masuk at time zone 'Asia/Jakarta')::date as attendance_date,
  count(*) as row_count,
  array_agg(id order by waktu_masuk, id) as attendance_ids
from public.absensi
group by
  farmer_id,
  lahan_id,
  (waktu_masuk at time zone 'Asia/Jakarta')::date
having count(*) > 1
order by attendance_date, farmer_id, lahan_id;
```

Hasil wajib kosong sebelum migration `0005`. Jika tidak kosong, tentukan row
kanonik bersama pemilik data, ekspor seluruh row terkait, lalu selesaikan dengan
forward data-fix yang direview. Jangan menghapus row hanya karena timestamp-nya
lebih baru/lama. Migration sengaja berhenti dengan `DUPLICATE_ATTENDANCE_ROWS`
sampai konflik diselesaikan.

#### Task legacy selesai tanpa bukti

```sql
select
  task.id,
  task.assigned_to,
  task.lahan_id,
  task.created_at
from public.tasks task
where task.status = 'selesai'
  and not exists (
    select 1
    from public.task_evidence evidence
    where evidence.task_id = task.id
  )
order by task.created_at, task.id;
```

Hasil boleh ada, tetapi seluruh ID harus dicatat sebagai histori grandfathered.
Jangan membuat bukti palsu dan jangan membuka ulang task. Aplikasi menampilkan
copy khusus “Diselesaikan sebelum alur review bukti diberlakukan.”

#### Bukti yang file Storage-nya hilang

```sql
select evidence.id, evidence.task_id, evidence.photo_path
from public.task_evidence evidence
left join storage.objects object
  on object.bucket_id = 'task-evidence'
 and object.name = evidence.photo_path
where object.id is null
order by evidence.created_at, evidence.id;
```

Hasil wajib kosong. Jika ada, pulihkan object yang benar atau selesaikan lewat
forward data-fix yang direview. Migration sengaja berhenti dengan
`EVIDENCE_STORAGE_OBJECT_MISSING` bila object belum tersedia.

#### Baseline schema dan ledger

```sql
select
  to_regclass('supabase_migrations.schema_migrations')
    as migration_ledger_relation;

select
  to_regclass('public.users') as users,
  to_regclass('public.lahan') as lahan,
  to_regclass('public.tasks') as tasks,
  to_regclass('public.absensi') as absensi,
  to_regclass('public.task_evidence') as task_evidence;
```

Jika `migration_ledger_relation` tidak `null`, jalankan query ledger berikut dan
catat seluruh row. Jika hasilnya `null`, catat kondisi itu dan jangan menjalankan
query ini:

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

Pada KPU, ledger kosong atau relasi ledger belum ada dengan tabel baseline yang
sudah ada adalah kondisi yang diketahui. Ini alasan `db push` dan
`migration repair` tetap dilarang.

### 3. Hosted rollback-only database test

Database test hanya boleh dijalankan terhadap hosted KPU dalam satu transaksi
yang dimulai dengan `BEGIN;` dan selalu berakhir dengan `ROLLBACK;`.

Buat satu file bundle sementara di luar repository dengan urutan isi berikut:

1. `BEGIN;`
2. isi persis migration `0005`, lalu `0006`, lalu `0007` dari commit rilis;
3. isi `supabase/tests/database/0005_daily_operations.test.sql` tanpa baris
   `begin;` pertama dan `rollback;` terakhir;
4. `ROLLBACK;` sebagai statement terakhir.

Jalankan hanya command hosted berikut:

```bash
npx supabase db query --linked --file /path/di-luar-repo/agroweather-hosted-rollback.sql
```

Gate lulus hanya jika pgTAP melaporkan plan `1..219`, seluruh 219 assertion
lulus, dan `ROLLBACK` tercapai. Setelah itu jalankan probe `to_regclass` untuk
`public.weather_snapshots`, `public.ai_generation_runs`,
`public.ai_generation_targets`, dan `public.ai_task_drafts`; semuanya harus
tetap `null`. Jika salah satu ada, transaksi tidak benar-benar rollback: stop.

Jangan mengganti langkah ini dengan `npm run db:reset` atau `npm run db:test`;
keduanya memakai local Supabase/Docker dan dilarang untuk rollout ini.

### 4. Terapkan foundation schema secara terkontrol

Ambil backup/snapshot hosted sebelum perubahan. Di Dashboard SQL Editor, buka
dua query terpisah. Untuk masing-masing file, paste isi dari commit rilis di
antara transaksi berikut dan jalankan satu per satu:

```sql
begin;
-- isi persis satu file migration yang sudah dicatat checksum-nya
commit;
```

Urutannya wajib:

1. `0005_daily_operations_schema.sql`
2. `0006_daily_operations_rpcs.sql`

Jika satu tahap gagal, jangan lanjut ke tahap berikutnya. Simpan error yang sudah
disanitasi, cek apakah transaksi rollback, lalu gunakan forward fix yang
direview. Jangan edit migration secara ad-hoc di Dashboard.

**Jangan terapkan `0007` pada tahap ini.** Migration `0007` mencabut direct
writes yang masih dipakai binary lama. Foundation `0005`–`0006` sengaja dipasang
lebih dulu agar binary baru yang RPC-compatible bisa dirilis tanpa langsung
memutus binary lama.

Ledger KPU tetap tidak boleh “diperbaiki” manual pada rollout ini. Setelah
schema terverifikasi, buat pekerjaan terpisah untuk menghasilkan baseline
ledger yang diaudit. Sampai pekerjaan itu selesai, `db push` tetap dilarang.

Post-foundation gate:

```sql
select
  to_regclass('public.weather_snapshots') as weather_snapshots,
  to_regclass('public.ai_generation_runs') as ai_generation_runs,
  to_regclass('public.ai_generation_targets') as ai_generation_targets,
  to_regclass('public.ai_task_drafts') as ai_task_drafts;

with expected(routine_name) as (
  values
    ('approve_ai_task_draft'),
    ('bulk_approve_ai_task_drafts'),
    ('current_user_role'),
    ('is_internal'),
    ('record_ai_generation_target'),
    ('register_attendance'),
    ('register_task_evidence'),
    ('reject_ai_task_draft'),
    ('replace_ai_task_drafts'),
    ('review_task_evidence'),
    ('sign_up_user'),
    ('start_assigned_task')
), actual as (
  select distinct routine.routine_name
  from information_schema.routines routine
  where routine.routine_schema = 'public'
    and routine.routine_type = 'FUNCTION'
    and routine.routine_name in (
      select routine_name from expected
      union all
      values ('check_in_attendance'), ('start_task')
    )
)
select
  (
    select array_agg(routine_name order by routine_name)
    from expected
  ) as expected_rpc_names,
  (
    select array_agg(routine_name order by routine_name)
    from actual
  ) as actual_checked_rpc_names,
  (
    select count(*)
    from expected
  ) as expected_count,
  (
    select count(*)
    from actual
  ) as actual_count,
  not exists (
    select routine_name from expected
    except
    select routine_name from actual
  )
  and not exists (
    select routine_name from actual
    except
    select routine_name from expected
  ) as exact_expected_set;
```

Gate RPC lulus hanya jika `expected_count = 12`, `actual_count = 12`,
`exact_expected_set = true`, dan `actual_checked_rpc_names` sama persis dengan
`expected_rpc_names`. Nama attendance/start yang benar adalah
`register_attendance` dan `start_assigned_task`; `check_in_attendance` atau
`start_task` pada `actual_checked_rpc_names` berarti gate gagal.

### 5. Cutover client RPC-compatible, lalu terapkan `0007`

Commit rilis Expo SDK 54 harus sudah menggunakan RPC untuk absensi, transisi
task, registrasi bukti, dan review. Lakukan langkah berikut sebelum menyentuh
`0007`:

1. Export dan uji Android, iOS, dan web dari commit rilis.
2. Publikasikan build/update RPC-compatible ke channel produksi yang dipakai.
3. Pastikan build tersebut sudah tersedia untuk install/update, bukan masih
   menunggu review App Store.
4. Tetapkan versi/commit itu sebagai minimum supported version dan umumkan
   maintenance window. Pastikan seluruh perangkat operasional telah update atau
   dapat dipaksa berhenti memakai binary lama.
5. Verifikasi satu internal dan dua farmer dapat login pada build baru serta
   melakukan absensi/task/bukti melalui RPC saat `0005`–`0006` sudah terpasang.

Jika masih ada binary direct-write yang harus tetap berfungsi dan tidak ada
mekanisme mandatory update, keputusan wajib **NO-GO**: jangan terapkan `0007`,
jangan deploy generator, dan jangan aktifkan Cron.

Pada maintenance window yang sudah disetujui, jalankan isi persis
`0007_role_aware_operations_rls.sql` di Dashboard SQL Editor:

```sql
begin;
-- isi persis 0007 dari commit/checksum deployment record
commit;
```

Setelah commit, jalankan pgTAP yang sudah memiliki `begin; ... rollback;`:

```bash
npx supabase db query --linked --file supabase/tests/database/0005_daily_operations.test.sql
```

Hasil wajib 219/219 dan tidak meninggalkan fixture. Ulangi role smoke dengan
dua farmer: farmer A tidak boleh membaca/mengubah task, absensi, atau evidence
farmer B; farmer tidak boleh memanggil RPC internal.

Setelah `0007` terpasang, **jangan pernah rollback aplikasi ke build sebelum
cutover RPC**. Perbaikan harus berupa forward client release atau forward SQL
yang tetap kompatibel dengan kontrak RPC/RLS.

### 6. Set secrets dan deploy Edge Function

Set empat secret hanya melalui Dashboard seperti pada bagian Secrets. Setelah
nama-namanya terverifikasi, deploy hanya function yang dimaksud:

```bash
npx supabase functions deploy generate-daily-tasks --project-ref sxzuifhcmxakpeyqacze --no-verify-jwt
```

`--no-verify-jwt` diperlukan karena endpoint menerima dua jalur: cron memakai
shared secret, sedangkan manual memvalidasi Bearer token dan role `internal` di
dalam function. Konfigurasi yang sama juga tercatat di `supabase/config.toml`.

Endpoint produksi:

```text
https://sxzuifhcmxakpeyqacze.supabase.co/functions/v1/generate-daily-tasks
```

Deploy belum berarti Cron boleh aktif. Lanjut ke smoke test manual.

### 7. Smoke test sebelum Cron

Gunakan akun dan lahan uji yang dapat dibersihkan secara terkontrol. Jangan
memakai JWT, API key, atau shared secret di screenshot/log. Catat ID run, target,
draft, task, dan evidence—bukan token.

1. Masuk sebagai internal, buka **Draft Task AI**, pilih satu lahan aktif, dan
   tekan **Generate Task AI**. Response sukses dan draft berjumlah 0–5.
2. Ulangi manual untuk target lahan/tanggal Jakarta yang sama. Query di bawah
   harus menunjukkan tepat satu target `is_current = true`.
3. Coba invoke manual sebagai farmer. Hasil wajib HTTP 403 / “Akses ditolak”,
   tanpa generation run baru.
4. Buka review draft internal. Pastikan belum ada row task sebelum approve.
5. Approve tepat satu draft. Pastikan tepat satu task dibuat dan approve ulang
   tidak menduplikasi task.
6. Masuk sebagai farmer yang ditugaskan. Dashboard hanya menampilkan task milik
   farmer tersebut untuk tanggal Jakarta hari ini dan status absensi hari ini.
7. Kirim foto bukti setelah GPS foreground lolos. Task tetap belum `selesai` dan
   bukti berstatus `pending`.
8. Sebagai internal, minta revisi. Farmer melihat catatan dan dapat mengirim
   attempt berikutnya; attempt lama tetap terlihat dan immutable.
9. Terima attempt terbaru. Baru setelah itu task menjadi `selesai`; seluruh
   riwayat attempt tetap terlihat.

Query idempotensi target:

```sql
select lahan_id, scheduled_for,
       count(*) filter (where is_current) as current_count,
       array_agg(id order by version) as target_ids
from public.ai_generation_targets
where lahan_id = '<UUID_LAHAN_UJI>'
  and scheduled_for = (now() at time zone 'Asia/Jakarta')::date
group by lahan_id, scheduled_for;
```

Query approve tepat satu task:

```sql
select draft.id as draft_id,
       draft.status as draft_status,
       draft.created_task_id,
       count(task.id) as task_count
from public.ai_task_drafts draft
left join public.tasks task on task.source_draft_id = draft.id
where draft.id = '<UUID_DRAFT_UJI>'
group by draft.id, draft.status, draft.created_task_id;
```

### 8. Buat Cron dengan binding Vault, lalu nonaktifkan

Aktifkan integrasi **Cron** (`pg_cron`) dan `pg_net`. Di Dashboard **Vault**,
buat tepat satu entry untuk masing-masing nama berikut:

- `agroweather_project_url` berisi
  `https://sxzuifhcmxakpeyqacze.supabase.co`;
- `agroweather_cron_shared_secret` berisi nilai yang sama dengan Edge secret
  `CRON_SHARED_SECRET`.

Nilai secret dimasukkan lewat UI Vault; jangan menaruh nilainya di SQL Editor.
Verifikasi nama dan jumlah tanpa membaca `decrypted_secret`:

```sql
select name, count(*) as secret_count
from vault.secrets
where name in (
  'agroweather_project_url',
  'agroweather_cron_shared_secret'
)
group by name
order by name;
```

Masing-masing nama wajib tepat satu. Pastikan belum ada job bernama sama:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'agroweather-daily-ai-tasks';
```

Hasil harus kosong. Buat job melalui SQL eksak berikut agar command tersimpan
sebagai referensi Vault, bukan secret literal:

```sql
select cron.schedule(
  'agroweather-daily-ai-tasks',
  '0 22 * * *',
  $job$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'agroweather_project_url'
    ) || '/functions/v1/generate-daily-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-agroweather-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'agroweather_cron_shared_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) as request_id;
  $job$
);
```

Jangan membuat job di sekitar 21:55–22:05 UTC. Segera buka Dashboard
**Integrations → Cron → Jobs** dan ubah toggle job menjadi **Inactive**. Verifikasi:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'agroweather-daily-ai-tasks';
```

Gate: tepat satu row, schedule `0 22 * * *`, dan `active = false`. Jangan
menyalin kolom `command` ke log atau deployment record.

Timeout `120000` ms memberi ruang untuk dua request OpenWeather (masing-masing
dapat menunggu 8 detik), request OpenRouter (dapat menunggu 20 detik), dan kerja
database, tetapi tetap di bawah batas wall-clock Edge Function hosted.

Cron Supabase memakai UTC. Ekspresi `0 22 * * *` berarti 22:00 UTC, yaitu 05:00
WIB pada tanggal kalender berikutnya. Function tetap menghitung
`scheduled_for` dari `Asia/Jakarta` dan tidak menerima tanggal dari request.

Nama job bersifat case-sensitive; jangan membuat job kedua dengan nama sama.

### 9. Cron first-run dan aktivasi

Aktifkan job pada jendela observasi. Setelah invocation pertama:

Periksa hasil transport `pg_net` terlebih dahulu. `request_id` berasal dari
hasil `net.http_post` yang dieksekusi job:

```sql
select id as request_id, status_code, timed_out, error_msg, created
from net._http_response
where created >= now() - interval '24 hours'
order by created desc
limit 20;
```

Temukan request pada waktu Cron berjalan. Gate transport: `status_code = 200`,
`timed_out = false`, dan `error_msg is null`. Jangan menyalin kolom `content`
atau headers ke log/deployment record.

Setelah itu periksa generation run:

```sql
select id, trigger, scheduled_for, status, model,
       plot_count, success_count, skipped_count, failed_count,
       started_at, completed_at
from public.ai_generation_runs
where trigger = 'cron'
order by started_at desc
limit 5;
```

Gate first-run:

- `scheduled_for` sama dengan `(now() at time zone 'Asia/Jakarta')::date`;
- run selesai dan kegagalan per lahan dapat ditelusuri tanpa provider body;
- Cron membuat draft, bukan task;
- setiap lahan/tanggal hanya mempunyai satu current target;
- rerun Cron untuk target sukses tidak membuat draft duplikat.

Jika semua gate lulus, biarkan job aktif. Pantau Cron job run dan Edge Function
logs pada dua jadwal pertama tanpa mencetak request header atau secret.

## Rollback

Rollback dilakukan sebagai berikut:

1. Nonaktifkan Cron `agroweather-daily-ai-tasks` terlebih dahulu.
2. Ekspor metadata/log yang sudah disanitasi, lalu enforce penghentian manual dan
   Cron call dengan menghapus **deployment remote** function (source tetap di
   Git dan dapat di-deploy ulang):

   ```bash
   npx supabase functions delete generate-daily-tasks --project-ref sxzuifhcmxakpeyqacze
   ```

   Rotasi `CRON_SHARED_SECRET` setelah function dihentikan. Jangan mengandalkan
   instruksi lisan untuk “jangan klik generate”; client internal masih dapat
   memanggil endpoint selama deployment aktif.
3. Jika masalah hanya pada aplikasi, rilis forward fix. Revert UI/service hanya
   boleh menuju commit yang tetap RPC-compatible. Setelah `0007`, jangan pernah
   merilis kembali binary direct-write sebelum cutover.
4. Jangan drop tabel operasional, task, attendance, generation run, draft, atau
   evidence. Histori bukti dan review harus tetap immutable.
5. Jangan menjalankan down migration. Pulihkan read behavior lama hanya melalui
   forward migration yang direview dan diuji rollback-only.
6. Jika ada dugaan secret terlihat di log, screenshot, terminal history, atau
   pihak lain, rotate `CRON_SHARED_SECRET`, `OPENROUTER_API_KEY`, dan
   `OPENWEATHER_API_KEY`; perbarui Vault dan Edge secrets sebelum membuka trafik.
7. Catat incident, ID row terdampak, versi function, commit, dan keputusan
   pemulihan di deployment record.

## Referensi resmi

- Supabase Edge Function deployment:
  https://supabase.com/docs/guides/functions/deploy
- Supabase Edge Function secrets:
  https://supabase.com/docs/guides/functions/secrets
- Supabase Cron:
  https://supabase.com/docs/guides/cron
- Scheduling Edge Functions dengan Cron, `pg_net`, dan Vault:
  https://supabase.com/docs/guides/functions/schedule-functions
