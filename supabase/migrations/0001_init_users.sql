-- AgroWeather — Schema Referensi (versi terbaru, sesuai DB aktual)
-- Jangan dijalankan kalau sudah ada di DB. File ini untuk dokumentasi tim.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enum: user_role (farmer | internal)
-- Display labels di app: 'farmer' → "Petani" (pekerja lapangan), 'internal' → "Internal" (admin/pemilik lahan)
CREATE TYPE user_role AS ENUM ('farmer', 'internal');

-- Enum: task_status — values perlu konfirmasi user (default 'belum_dikerjakan')
CREATE TYPE task_status AS ENUM ('belum_dikerjakan', 'sedang_dikerjakan', 'selesai');
-- ⚠️ ASUMSI: ubah kalau enum aktual berbeda. Cek via:
--   SELECT enum_range(NULL::task_status);

-- Enum: kondisi_tanaman (baik | cukup | buruk)
CREATE TYPE kondisi_tanaman AS ENUM ('baik', 'cukup', 'buruk');

-- Enum: geofence_status — values perlu konfirmasi user (default 'valid')
CREATE TYPE geofence_status AS ENUM ('valid', 'invalid');
-- ⚠️ ASUMSI: ubah kalau enum aktual berbeda. Cek via:
--   SELECT enum_range(NULL::geofence_status);

-- USERS
CREATE TABLE public.users (
    id uuid NOT NULL,
    nama text NOT NULL,
    email text NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'farmer'::user_role,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- LAHAN (geofence = circle, NOT polygon)
CREATE TABLE public.lahan (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    nama_lahan text NOT NULL,
    farmer_id uuid,                       -- nullable sekarang
    jenis_tanaman text NOT NULL,
    lat_center numeric NOT NULL,
    lng_center numeric NOT NULL,
    radius_geofence_m integer NOT NULL DEFAULT 100,
    CONSTRAINT lahan_pkey PRIMARY KEY (id),
    CONSTRAINT lahan_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id)
);

-- ABSENSI
CREATE TABLE public.absensi (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    farmer_id uuid NOT NULL,
    lahan_id uuid NOT NULL,
    waktu_masuk timestamptz NOT NULL DEFAULT now(),
    waktu_keluar timestamptz,
    lat numeric NOT NULL,
    lng numeric NOT NULL,
    status_geofence geofence_status NOT NULL DEFAULT 'valid'::geofence_status,
    CONSTRAINT absensi_pkey PRIMARY KEY (id),
    CONSTRAINT absensi_farmer_id_fkey FOREIGN KEY (farmer_id) REFERENCES public.users(id),
    CONSTRAINT absensi_lahan_id_fkey FOREIGN KEY (lahan_id) REFERENCES public.lahan(id)
);

-- TASKS
CREATE TABLE public.tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lahan_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    assigned_by uuid,                     -- nullable sekarang
    judul text NOT NULL,
    deskripsi text,
    status task_status NOT NULL DEFAULT 'belum_dikerjakan'::task_status,
    deadline date,
    url_foto text,
    kondisi_tanaman kondisi_tanaman,
    hasil_analisis_ai text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tasks_pkey PRIMARY KEY (id),
    CONSTRAINT tasks_lahan_id_fkey FOREIGN KEY (lahan_id) REFERENCES public.lahan(id),
    CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id),
    CONSTRAINT tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id)
);

-- REKOMENDASI CUACA
CREATE TABLE public.rekomendasi_cuaca (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lahan_id uuid NOT NULL,
    tanggal date NOT NULL DEFAULT CURRENT_DATE,
    suhu_c numeric,
    kelembaban_persen numeric,
    curah_hujan_mm numeric,
    kondisi_cuaca text,
    rekomendasi_aktivitas text,
    CONSTRAINT rekomendasi_cuaca_pkey PRIMARY KEY (id),
    CONSTRAINT rekomendasi_cuaca_lahan_id_fkey FOREIGN KEY (lahan_id) REFERENCES public.lahan(id)
);

-- INDEXES
CREATE INDEX idx_lahan_farmer       ON public.lahan(farmer_id);
CREATE INDEX idx_absensi_farmer     ON public.absensi(farmer_id);
CREATE INDEX idx_absensi_lahan      ON public.absensi(lahan_id);
CREATE INDEX idx_tasks_lahan        ON public.tasks(lahan_id);
CREATE INDEX idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by  ON public.tasks(assigned_by);
CREATE INDEX idx_rekomendasi_lahan  ON public.rekomendasi_cuaca(lahan_id);
CREATE INDEX idx_rekomendasi_tanggal ON public.rekomendasi_cuaca(tanggal);

-- ===========================================
-- RLS POLICIES (CRITICAL — tanpa ini, client gak bisa read/write)
-- ===========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users self select" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users self insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users self update" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Untuk MVP/demo: allow authenticated users baca semua lahan, absensi, tasks,
-- rekomendasi_cuaca. Tighten nanti sesuai kebutuhan (per-farmer, per-assigned).
ALTER TABLE public.lahan             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rekomendasi_cuaca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read lahan"   ON public.lahan   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read absensi" ON public.absensi FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read tasks"   ON public.tasks   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth read cuaca"   ON public.rekomendasi_cuaca FOR SELECT USING (auth.role() = 'authenticated');

-- Write policies: hanya authenticated user boleh insert/update row mereka sendiri.
-- (Sesuaikan dengan logic app saat implementasi modul lahan/tasks/absensi.)
CREATE POLICY "auth write lahan"   ON public.lahan   FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth write absensi" ON public.absensi FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth write tasks"   ON public.tasks   FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "auth write cuaca"   ON public.rekomendasi_cuaca FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
