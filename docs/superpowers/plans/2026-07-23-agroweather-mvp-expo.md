# AgroWeather MVP Expo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Expo Go MVP where internal users map farm plots, farmers unlock tasks inside a 1 km radius, and farmers upload photo evidence.

**Architecture:** Keep UI in Expo Router screens, put reusable business rules in `src/lib`, and put Supabase access behind focused services in `src/services`. MVP uses foreground location only; OpenRouter is represented by an isolated deterministic analysis helper so a future Edge Function can replace it without changing screens.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, Expo Router, Supabase, `react-native-maps`, `expo-location`, `expo-image-picker`, Jest.

---

## Baseline Rules

- Treat the current dirty worktree as user work. Do not revert `src/app/(app)/penataan-lahan.tsx`, the route registration changes, or the removed register screen.
- Stage only the files listed in each task before each commit.
- Read `AGENTS.md` and the Expo SDK 57 docs before editing feature code.
- Use TDD for business behavior: write failing tests, watch them fail, implement, then watch them pass.
- Use `npx expo install` for Expo SDK packages so package versions match SDK 57.

## File Structure

- Modify `package.json` and `package-lock.json`: upgrade Expo SDK and add compatible Expo packages.
- Modify `app.json`: permission strings for location and image picker config plugins.
- Create `supabase/migrations/0003_agroweather_mvp.sql`: MVP schema extension and storage bucket policy.
- Create `src/lib/farm-types.ts`: shared plot/task/evidence types.
- Create `src/lib/farm-validation.ts`: plot and evidence validation.
- Create `src/lib/geofence.ts`: distance and unlock decisions.
- Create `src/lib/analysis.ts`: deterministic AI placeholder.
- Create tests in `src/lib/__tests__/farm-validation.test.ts`, `geofence.test.ts`, and `analysis.test.ts`.
- Create `src/services/plots.ts`, `tasks.ts`, `attendance.ts`, `evidence.ts`, and `location.ts`: Supabase and device service boundaries.
- Create `src/components/map-picker.tsx`: Expo Go friendly map center selector.
- Create `src/components/evidence-picker.tsx`: image picker/upload UI wrapper.
- Modify `src/app/(app)/_layout.tsx`: register task detail route.
- Modify `src/app/(app)/penataan-lahan.tsx`: internal plot CRUD screen.
- Modify `src/app/(app)/petani.tsx`: proximity check and task list.
- Create `src/app/(app)/task/[id].tsx`: task detail and evidence upload.

## Task 1: Upgrade Expo SDK 57 And Device Packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [ ] **Step 1: Capture baseline test result**

Run:

```bash
npm test -- --runInBand
```

Expected: existing validation and routing suites pass.

- [ ] **Step 2: Upgrade Expo packages using SDK-aware installer**

Run:

```bash
npx expo install expo@^57.0.0 react@19.2.3 react-dom@19.2.3 react-native@0.86.0 jest-expo@~57.0.0 react-test-renderer@19.2.3 expo-location expo-image-picker react-native-maps
```

Expected: `package.json` and `package-lock.json` update. If the command reports dependency mismatches, run:

```bash
npx expo install --fix
```

Expected: Expo package versions align with SDK 57.

- [ ] **Step 3: Configure permissions in `app.json`**

Update the `plugins` array to include `expo-location` and `expo-image-picker`:

```json
"plugins": [
  "expo-router",
  [
    "expo-splash-screen",
    {
      "backgroundColor": "#208AEF",
      "image": "./assets/images/splash-icon.png",
      "imageWidth": 76
    }
  ],
  [
    "expo-location",
    {
      "locationWhenInUsePermission": "AgroWeather menggunakan lokasi untuk mengecek kehadiran petani di sekitar lahan."
    }
  ],
  [
    "expo-image-picker",
    {
      "photosPermission": "AgroWeather membutuhkan akses foto untuk mengunggah bukti pekerjaan.",
      "cameraPermission": "AgroWeather membutuhkan kamera untuk mengambil foto bukti pekerjaan.",
      "microphonePermission": false
    }
  ]
]
```

- [ ] **Step 4: Verify dependency state**

Run:

```bash
npm test -- --runInBand
npm run typecheck
```

Expected: tests pass. Typecheck may reveal SDK migration issues; fix only SDK migration errors in this task.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: align expo sdk for agroweather mvp"
```

## Task 2: Add Supabase MVP Schema

**Files:**
- Create: `supabase/migrations/0003_agroweather_mvp.sql`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/0003_agroweather_mvp.sql`:

```sql
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
```

- [ ] **Step 2: Validate migration syntax locally if Supabase CLI is available**

Run:

```bash
supabase db lint
```

Expected: no SQL syntax errors. If Supabase CLI is not installed, record that and continue; the migration is plain SQL and can be run in Supabase SQL Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_agroweather_mvp.sql
git commit -m "feat: add agroweather mvp schema"
```

## Task 3: Add Farm Types And Validation With TDD

**Files:**
- Create: `src/lib/farm-types.ts`
- Create: `src/lib/farm-validation.ts`
- Test: `src/lib/__tests__/farm-validation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Create `src/lib/__tests__/farm-validation.test.ts`:

```typescript
import {
  validateEvidenceUpload,
  validatePlotForm,
} from '../farm-validation';

describe('validatePlotForm', () => {
  const valid = {
    namaLahan: 'Sawah Utara',
    farmerId: 'farmer-1',
    luasHektar: '2.5',
    jenisTanaman: 'Padi',
    faseLahan: 'Penyiraman',
    latCenter: -7.250445,
    lngCenter: 112.768845,
    radiusGeofenceM: 1000,
  };

  test('accepts valid plot form values', () => {
    expect(validatePlotForm(valid)).toEqual({
      namaLahan: null,
      luasHektar: null,
      jenisTanaman: null,
      faseLahan: null,
      latCenter: null,
      lngCenter: null,
      radiusGeofenceM: null,
    });
  });

  test('rejects missing required text fields', () => {
    expect(
      validatePlotForm({
        ...valid,
        namaLahan: ' ',
        jenisTanaman: '',
        faseLahan: '',
      })
    ).toMatchObject({
      namaLahan: 'Nama lahan wajib diisi',
      jenisTanaman: 'Jenis tanaman wajib diisi',
      faseLahan: 'Fase lahan wajib diisi',
    });
  });

  test('rejects invalid area and geofence radius', () => {
    expect(
      validatePlotForm({
        ...valid,
        luasHektar: '0',
        radiusGeofenceM: 0,
      })
    ).toMatchObject({
      luasHektar: 'Luas lahan harus lebih dari 0',
      radiusGeofenceM: 'Radius harus lebih dari 0 meter',
    });
  });

  test('rejects missing map center', () => {
    expect(
      validatePlotForm({
        ...valid,
        latCenter: null,
        lngCenter: null,
      })
    ).toMatchObject({
      latCenter: 'Latitude lahan wajib dipilih',
      lngCenter: 'Longitude lahan wajib dipilih',
    });
  });
});

describe('validateEvidenceUpload', () => {
  test('requires unlocked task', () => {
    expect(validateEvidenceUpload({ unlocked: false, photoUri: 'file://photo.jpg' })).toBe(
      'Task belum terbuka karena petani belum berada dalam radius lahan'
    );
  });

  test('requires selected photo', () => {
    expect(validateEvidenceUpload({ unlocked: true, photoUri: null })).toBe(
      'Foto bukti wajib dipilih'
    );
  });

  test('accepts unlocked task with photo', () => {
    expect(validateEvidenceUpload({ unlocked: true, photoUri: 'file://photo.jpg' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/__tests__/farm-validation.test.ts --runInBand
```

Expected: FAIL because `../farm-validation` does not exist.

- [ ] **Step 3: Implement types and validation**

Create `src/lib/farm-types.ts`:

```typescript
export type PlotStatus = 'aktif' | 'tidak aktif';

export type PlotFormValues = {
  namaLahan: string;
  farmerId: string | null;
  luasHektar: string;
  jenisTanaman: string;
  faseLahan: string;
  latCenter: number | null;
  lngCenter: number | null;
  radiusGeofenceM: number;
};

export type PlotFormErrors = {
  namaLahan: string | null;
  luasHektar: string | null;
  jenisTanaman: string | null;
  faseLahan: string | null;
  latCenter: string | null;
  lngCenter: string | null;
  radiusGeofenceM: string | null;
};

export type FarmPlot = {
  id: string;
  namaLahan: string;
  farmerId: string | null;
  farmerName?: string | null;
  luasHektar: number | null;
  jenisTanaman: string;
  faseLahan: string | null;
  latCenter: number;
  lngCenter: number;
  radiusGeofenceM: number;
  status: PlotStatus;
};

export type FarmTaskStatus = 'belum_dikerjakan' | 'sedang_dikerjakan' | 'selesai';

export type FarmTask = {
  id: string;
  lahanId: string;
  assignedTo: string;
  assignedBy: string | null;
  judul: string;
  deskripsi: string | null;
  status: FarmTaskStatus;
  deadline: string | null;
  requiresLocation: boolean;
  unlockedAt: string | null;
};

export type TaskEvidence = {
  id: string;
  taskId: string;
  farmerId: string;
  lahanId: string;
  photoPath: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  aiPlaceholderSummary: string | null;
  createdAt: string;
};
```

Create `src/lib/farm-validation.ts`:

```typescript
import type { PlotFormErrors, PlotFormValues } from './farm-types';

export function validatePlotForm(values: PlotFormValues): PlotFormErrors {
  const area = Number(values.luasHektar);

  return {
    namaLahan: values.namaLahan.trim() ? null : 'Nama lahan wajib diisi',
    luasHektar:
      values.luasHektar.trim() && Number.isFinite(area) && area > 0
        ? null
        : 'Luas lahan harus lebih dari 0',
    jenisTanaman: values.jenisTanaman.trim() ? null : 'Jenis tanaman wajib diisi',
    faseLahan: values.faseLahan.trim() ? null : 'Fase lahan wajib diisi',
    latCenter:
      typeof values.latCenter === 'number' && Number.isFinite(values.latCenter)
        ? null
        : 'Latitude lahan wajib dipilih',
    lngCenter:
      typeof values.lngCenter === 'number' && Number.isFinite(values.lngCenter)
        ? null
        : 'Longitude lahan wajib dipilih',
    radiusGeofenceM:
      Number.isInteger(values.radiusGeofenceM) && values.radiusGeofenceM > 0
        ? null
        : 'Radius harus lebih dari 0 meter',
  };
}

export function validateEvidenceUpload(input: {
  unlocked: boolean;
  photoUri: string | null;
}): string | null {
  if (!input.unlocked) {
    return 'Task belum terbuka karena petani belum berada dalam radius lahan';
  }
  if (!input.photoUri) return 'Foto bukti wajib dipilih';
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/lib/__tests__/farm-validation.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/farm-types.ts src/lib/farm-validation.ts src/lib/__tests__/farm-validation.test.ts
git commit -m "feat: add farm form validation"
```

## Task 4: Add Geofence And Analysis Helpers With TDD

**Files:**
- Create: `src/lib/geofence.ts`
- Create: `src/lib/analysis.ts`
- Test: `src/lib/__tests__/geofence.test.ts`
- Test: `src/lib/__tests__/analysis.test.ts`

- [ ] **Step 1: Write failing geofence tests**

Create `src/lib/__tests__/geofence.test.ts`:

```typescript
import { distanceMeters, evaluateGeofence } from '../geofence';

describe('distanceMeters', () => {
  test('returns 0 for identical points', () => {
    expect(
      distanceMeters(
        { latitude: -7.250445, longitude: 112.768845 },
        { latitude: -7.250445, longitude: 112.768845 }
      )
    ).toBe(0);
  });

  test('returns about 111 meters for 0.001 latitude degrees', () => {
    const distance = distanceMeters(
      { latitude: 0, longitude: 0 },
      { latitude: 0.001, longitude: 0 }
    );
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });
});

describe('evaluateGeofence', () => {
  const plot = { latitude: -7.250445, longitude: 112.768845, radiusMeters: 1000 };

  test('unlocks inside radius', () => {
    expect(
      evaluateGeofence({
        user: { latitude: -7.2509, longitude: 112.769 },
        plot,
      })
    ).toMatchObject({ status: 'inside', unlocked: true });
  });

  test('locks outside radius', () => {
    expect(
      evaluateGeofence({
        user: { latitude: -7.270445, longitude: 112.768845 },
        plot,
      })
    ).toMatchObject({ status: 'outside', unlocked: false });
  });

  test('locks when location is missing', () => {
    expect(evaluateGeofence({ user: null, plot })).toEqual({
      status: 'missing-location',
      unlocked: false,
      distanceM: null,
    });
  });
});
```

- [ ] **Step 2: Write failing analysis tests**

Create `src/lib/__tests__/analysis.test.ts`:

```typescript
import { buildMvpAnalysisSummary } from '../analysis';

describe('buildMvpAnalysisSummary', () => {
  test('returns deterministic Indonesian recommendation text', () => {
    expect(
      buildMvpAnalysisSummary({
        plotName: 'Sawah Utara',
        cropType: 'Padi',
        phase: 'Penyiraman',
        taskTitle: 'Cek saluran air',
        evidenceCount: 2,
      })
    ).toBe(
      'Analisis MVP: Sawah Utara menanam Padi dan sedang pada fase Penyiraman. Fokus hari ini: Cek saluran air. Ada 2 bukti kerja sebelumnya untuk bahan evaluasi besok.'
    );
  });

  test('handles zero previous evidence', () => {
    expect(
      buildMvpAnalysisSummary({
        plotName: 'Kebun Cabai',
        cropType: 'Cabai',
        phase: null,
        taskTitle: 'Foto kondisi tanaman',
        evidenceCount: 0,
      })
    ).toContain('Belum ada bukti kerja sebelumnya');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/__tests__/geofence.test.ts src/lib/__tests__/analysis.test.ts --runInBand
```

Expected: FAIL because `geofence` and `analysis` modules do not exist.

- [ ] **Step 4: Implement geofence and analysis helpers**

Create `src/lib/geofence.ts`:

```typescript
export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GeofenceStatus = 'inside' | 'outside' | 'missing-location';

export type GeofenceResult = {
  status: GeofenceStatus;
  unlocked: boolean;
  distanceM: number | null;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  if (a.latitude === b.latitude && a.longitude === b.longitude) return 0;

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function evaluateGeofence(input: {
  user: Coordinates | null;
  plot: Coordinates & { radiusMeters: number };
}): GeofenceResult {
  if (!input.user) {
    return { status: 'missing-location', unlocked: false, distanceM: null };
  }

  const distanceM = distanceMeters(input.user, input.plot);
  if (distanceM <= input.plot.radiusMeters) {
    return { status: 'inside', unlocked: true, distanceM };
  }

  return { status: 'outside', unlocked: false, distanceM };
}
```

Create `src/lib/analysis.ts`:

```typescript
export type MvpAnalysisInput = {
  plotName: string;
  cropType: string;
  phase: string | null;
  taskTitle: string;
  evidenceCount: number;
};

export function buildMvpAnalysisSummary(input: MvpAnalysisInput): string {
  const phase = input.phase?.trim() ? input.phase.trim() : 'belum dicatat';
  const evidence =
    input.evidenceCount > 0
      ? `Ada ${input.evidenceCount} bukti kerja sebelumnya untuk bahan evaluasi besok.`
      : 'Belum ada bukti kerja sebelumnya untuk bahan evaluasi besok.';

  return `Analisis MVP: ${input.plotName} menanam ${input.cropType} dan sedang pada fase ${phase}. Fokus hari ini: ${input.taskTitle}. ${evidence}`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
npm test -- src/lib/__tests__/geofence.test.ts src/lib/__tests__/analysis.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/geofence.ts src/lib/analysis.ts src/lib/__tests__/geofence.test.ts src/lib/__tests__/analysis.test.ts
git commit -m "feat: add geofence and mvp analysis helpers"
```

## Task 5: Add Supabase Farm Services

**Files:**
- Create: `src/services/plots.ts`
- Create: `src/services/tasks.ts`
- Create: `src/services/attendance.ts`
- Create: `src/services/evidence.ts`
- Create: `src/services/location.ts`
- Test: `src/services/__tests__/farm-services.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/services/__tests__/farm-services.test.ts` with small injected-client tests:

```typescript
import { mapPlotRow, toPlotInsert } from '../plots';
import { buildEvidencePath } from '../evidence';

describe('plot service mapping', () => {
  test('maps Supabase lahan row into app plot shape', () => {
    expect(
      mapPlotRow({
        id: 'plot-1',
        nama_lahan: 'Sawah Utara',
        farmer_id: 'farmer-1',
        jenis_tanaman: 'Padi',
        luas_hektar: 2.5,
        lat_center: -7.25,
        lng_center: 112.76,
        radius_geofence_m: 1000,
        fase_lahan: 'Penyiraman',
        status: 'aktif',
      })
    ).toEqual({
      id: 'plot-1',
      namaLahan: 'Sawah Utara',
      farmerId: 'farmer-1',
      farmerName: null,
      jenisTanaman: 'Padi',
      luasHektar: 2.5,
      latCenter: -7.25,
      lngCenter: 112.76,
      radiusGeofenceM: 1000,
      faseLahan: 'Penyiraman',
      status: 'aktif',
    });
  });

  test('converts validated form values into lahan insert payload', () => {
    expect(
      toPlotInsert({
        namaLahan: 'Sawah Utara',
        farmerId: 'farmer-1',
        luasHektar: '2.5',
        jenisTanaman: 'Padi',
        faseLahan: 'Penyiraman',
        latCenter: -7.25,
        lngCenter: 112.76,
        radiusGeofenceM: 1000,
      })
    ).toEqual({
      nama_lahan: 'Sawah Utara',
      farmer_id: 'farmer-1',
      luas_hektar: 2.5,
      jenis_tanaman: 'Padi',
      fase_lahan: 'Penyiraman',
      lat_center: -7.25,
      lng_center: 112.76,
      radius_geofence_m: 1000,
      status: 'aktif',
    });
  });
});

describe('evidence service helpers', () => {
  test('builds owner-scoped storage path', () => {
    expect(buildEvidencePath('farmer-1', 'task-1', 'jpg')).toMatch(
      /^farmer-1\/task-1\/[0-9]+\.jpg$/
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/services/__tests__/farm-services.test.ts --runInBand
```

Expected: FAIL because service modules do not exist.

- [ ] **Step 3: Implement service modules**

Create `src/services/plots.ts` with exported mappers and Supabase functions:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

import type { FarmPlot, PlotFormValues } from '@/lib/farm-types';
import { supabase } from './supabase';

export type LahanRow = {
  id: string;
  nama_lahan: string;
  farmer_id: string | null;
  jenis_tanaman: string;
  luas_hektar: number | null;
  lat_center: number;
  lng_center: number;
  radius_geofence_m: number;
  fase_lahan: string | null;
  status: 'aktif' | 'tidak aktif';
  users?: { nama: string } | null;
};

export function mapPlotRow(row: LahanRow): FarmPlot {
  return {
    id: row.id,
    namaLahan: row.nama_lahan,
    farmerId: row.farmer_id,
    farmerName: row.users?.nama ?? null,
    jenisTanaman: row.jenis_tanaman,
    luasHektar: row.luas_hektar,
    latCenter: Number(row.lat_center),
    lngCenter: Number(row.lng_center),
    radiusGeofenceM: row.radius_geofence_m,
    faseLahan: row.fase_lahan,
    status: row.status,
  };
}

export function toPlotInsert(values: PlotFormValues) {
  return {
    nama_lahan: values.namaLahan.trim(),
    farmer_id: values.farmerId,
    luas_hektar: Number(values.luasHektar),
    jenis_tanaman: values.jenisTanaman.trim(),
    fase_lahan: values.faseLahan.trim(),
    lat_center: values.latCenter,
    lng_center: values.lngCenter,
    radius_geofence_m: values.radiusGeofenceM,
    status: 'aktif',
  };
}

export async function fetchPlots(client: SupabaseClient = supabase): Promise<FarmPlot[]> {
  const { data, error } = await client
    .from('lahan')
    .select('id,nama_lahan,farmer_id,jenis_tanaman,luas_hektar,lat_center,lng_center,radius_geofence_m,fase_lahan,status,users:farmer_id(nama)')
    .order('nama_lahan', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as LahanRow[]).map(mapPlotRow);
}

export async function fetchAssignedPlots(
  farmerId: string,
  client: SupabaseClient = supabase
): Promise<FarmPlot[]> {
  const { data, error } = await client
    .from('lahan')
    .select('id,nama_lahan,farmer_id,jenis_tanaman,luas_hektar,lat_center,lng_center,radius_geofence_m,fase_lahan,status')
    .eq('farmer_id', farmerId)
    .eq('status', 'aktif')
    .order('nama_lahan', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as LahanRow[]).map(mapPlotRow);
}

export async function createPlot(values: PlotFormValues, client: SupabaseClient = supabase) {
  const { error } = await client.from('lahan').insert(toPlotInsert(values));
  if (error) throw error;
}
```

Create `src/services/evidence.ts` with the helper and upload boundary. Use `fetch(photoUri).arrayBuffer()` for Expo/React Native upload:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from './supabase';

export function buildEvidencePath(farmerId: string, taskId: string, extension: string): string {
  return `${farmerId}/${taskId}/${Date.now()}.${extension.replace(/^\./, '')}`;
}

export async function uploadTaskEvidence(input: {
  taskId: string;
  farmerId: string;
  lahanId: string;
  photoUri: string;
  contentType: string;
  note: string | null;
  lat: number | null;
  lng: number | null;
  aiPlaceholderSummary: string | null;
  client?: SupabaseClient;
}) {
  const client = input.client ?? supabase;
  const extension = input.contentType === 'image/png' ? 'png' : 'jpg';
  const path = buildEvidencePath(input.farmerId, input.taskId, extension);
  const bytes = await fetch(input.photoUri).then((response) => response.arrayBuffer());

  const { error: uploadError } = await client.storage
    .from('task-evidence')
    .upload(path, bytes, { contentType: input.contentType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from('task_evidence')
    .insert({
      task_id: input.taskId,
      farmer_id: input.farmerId,
      lahan_id: input.lahanId,
      photo_path: path,
      note: input.note,
      lat: input.lat,
      lng: input.lng,
      ai_placeholder_summary: input.aiPlaceholderSummary,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id as string, path };
}
```

Create `src/services/tasks.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

import type { FarmTask, FarmTaskStatus } from '@/lib/farm-types';
import { supabase } from './supabase';

export type TaskRow = {
  id: string;
  lahan_id: string;
  assigned_to: string;
  assigned_by: string | null;
  judul: string;
  deskripsi: string | null;
  status: FarmTaskStatus;
  deadline: string | null;
  requires_location: boolean | null;
  unlocked_at: string | null;
};

export function mapTaskRow(row: TaskRow): FarmTask {
  return {
    id: row.id,
    lahanId: row.lahan_id,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by,
    judul: row.judul,
    deskripsi: row.deskripsi,
    status: row.status,
    deadline: row.deadline,
    requiresLocation: row.requires_location ?? true,
    unlockedAt: row.unlocked_at,
  };
}

export async function fetchFarmerTasks(
  farmerId: string,
  client: SupabaseClient = supabase
): Promise<FarmTask[]> {
  const { data, error } = await client
    .from('tasks')
    .select('id,lahan_id,assigned_to,assigned_by,judul,deskripsi,status,deadline,requires_location,unlocked_at')
    .eq('assigned_to', farmerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as TaskRow[]).map(mapTaskRow);
}

export async function fetchTaskDetail(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<FarmTask> {
  const { data, error } = await client
    .from('tasks')
    .select('id,lahan_id,assigned_to,assigned_by,judul,deskripsi,status,deadline,requires_location,unlocked_at')
    .eq('id', taskId)
    .single();
  if (error) throw error;
  return mapTaskRow(data as TaskRow);
}

export async function markTaskComplete(
  taskId: string,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client
    .from('tasks')
    .update({ status: 'selesai' satisfies FarmTaskStatus })
    .eq('id', taskId);
  if (error) throw error;
}
```

Create `src/services/attendance.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';

import type { FarmPlot } from '@/lib/farm-types';
import {
  evaluateGeofence,
  type Coordinates,
  type GeofenceResult,
} from '@/lib/geofence';
import { supabase } from './supabase';

export type CheckInResult = GeofenceResult & {
  attendanceCreated: boolean;
};

function localDayRange(now = new Date()): { start: string; end: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function checkInIfInsideRadius(input: {
  farmerId: string;
  plot: FarmPlot;
  userLocation: Coordinates | null;
  client?: SupabaseClient;
}): Promise<CheckInResult> {
  const result = evaluateGeofence({
    user: input.userLocation,
    plot: {
      latitude: input.plot.latCenter,
      longitude: input.plot.lngCenter,
      radiusMeters: input.plot.radiusGeofenceM,
    },
  });

  if (!result.unlocked || !input.userLocation || result.distanceM === null) {
    return { ...result, attendanceCreated: false };
  }

  const client = input.client ?? supabase;
  const range = localDayRange();
  const { data: existing, error: readError } = await client
    .from('absensi')
    .select('id')
    .eq('farmer_id', input.farmerId)
    .eq('lahan_id', input.plot.id)
    .gte('waktu_masuk', range.start)
    .lt('waktu_masuk', range.end)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return { ...result, attendanceCreated: false };

  const { error } = await client.from('absensi').insert({
    farmer_id: input.farmerId,
    lahan_id: input.plot.id,
    lat: input.userLocation.latitude,
    lng: input.userLocation.longitude,
    distance_m: result.distanceM,
    status_geofence: 'valid',
  });
  if (error) throw error;

  return { ...result, attendanceCreated: true };
}
```

Create `src/services/location.ts`:

```typescript
import * as Location from 'expo-location';

import type { Coordinates } from '@/lib/geofence';

export type CurrentLocationResult =
  | { status: 'granted'; coords: Coordinates; message: null }
  | { status: 'denied' | 'unavailable'; coords: null; message: string };

export async function requestCurrentLocation(): Promise<CurrentLocationResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return {
      status: 'denied',
      coords: null,
      message: 'Izin lokasi dibutuhkan untuk membuka task di sekitar lahan.',
    };
  }

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      status: 'granted',
      coords: {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      },
      message: null,
    };
  } catch {
    return {
      status: 'unavailable',
      coords: null,
      message: 'Lokasi tidak tersedia. Coba lagi beberapa saat.',
    };
  }
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
npm test -- src/services/__tests__/farm-services.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run all unit tests**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/plots.ts src/services/tasks.ts src/services/attendance.ts src/services/evidence.ts src/services/location.ts src/services/__tests__/farm-services.test.ts
git commit -m "feat: add agroweather farm services"
```

## Task 6: Build Internal Plot Mapping Screen

**Files:**
- Create: `src/components/map-picker.tsx`
- Modify: `src/app/(app)/penataan-lahan.tsx`

- [ ] **Step 1: Add component smoke test through TypeScript**

Run before implementation:

```bash
npm run typecheck
```

Expected: PASS before adding the new component.

- [ ] **Step 2: Create `MapPicker`**

Create `src/components/map-picker.tsx`:

```typescript
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Circle, type Region } from 'react-native-maps';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';
import { ThemedInput } from './form-field';

type MapPickerProps = {
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
};

const DEFAULT_REGION: Region = {
  latitude: -7.250445,
  longitude: 112.768845,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export function MapPicker({ latitude, longitude, radiusM, onChange }: MapPickerProps) {
  const selected = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const region = useMemo<Region>(
    () => ({
      ...DEFAULT_REGION,
      latitude: selected?.latitude ?? DEFAULT_REGION.latitude,
      longitude: selected?.longitude ?? DEFAULT_REGION.longitude,
    }),
    [selected]
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.fallback}>
        <ThemedText type="smallBold">Koordinat Lahan</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Map native tidak tersedia di web. Isi koordinat manual untuk preview web.
        </ThemedText>
        <ThemedInput
          value={latitude === null ? '' : String(latitude)}
          keyboardType="decimal-pad"
          placeholder="Latitude"
          onChangeText={(value) => onChange({ latitude: Number(value), longitude: longitude ?? 0 })}
        />
        <ThemedInput
          value={longitude === null ? '' : String(longitude)}
          keyboardType="decimal-pad"
          placeholder="Longitude"
          onChangeText={(value) => onChange({ latitude: latitude ?? 0, longitude: Number(value) })}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <MapView
        style={styles.map}
        initialRegion={region}
        onPress={(event) => onChange(event.nativeEvent.coordinate)}
      >
        {selected ? (
          <>
            <Marker coordinate={selected} />
            <Circle
              center={selected}
              radius={radiusM}
              fillColor="rgba(32, 138, 239, 0.14)"
              strokeColor="#208AEF"
              strokeWidth={2}
            />
          </>
        ) : null}
      </MapView>
      <Pressable style={styles.currentPin} onPress={() => onChange(region)}>
        <ThemedText type="smallBold" style={{ color: '#fff' }}>
          Pakai titik tengah
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  currentPin: {
    position: 'absolute',
    right: Spacing.two,
    bottom: Spacing.two,
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  fallback: {
    gap: Spacing.two,
  },
});
```

- [ ] **Step 3: Replace local dummy plot logic with service-backed form**

In `src/app/(app)/penataan-lahan.tsx`:

- Preserve the existing route and header behavior.
- Replace `DATA_AWAL` as the source of truth with `fetchPlots()`.
- Expand form state to match `PlotFormValues`.
- Use `validatePlotForm` before save.
- Render `MapPicker` in the modal.
- Call `createPlot` for new plots.
- Keep edit/deactivate UI visible; if update service is not ready, disable edit save with an alert that this MVP step supports add and list first.

The final screen must still show:

```typescript
<PrimaryButton label="+ Tambah Lahan" onPress={openAdd} />
```

and each plot card must show:

```typescript
<ThemedText type="smallBold">{item.namaLahan}</ThemedText>
<ThemedText type="small" themeColor="textSecondary">
  {item.jenisTanaman} - {item.faseLahan ?? 'Fase belum dicatat'}
</ThemedText>
```

- [ ] **Step 4: Verify screen compiles**

Run:

```bash
npm run typecheck
npm test -- --runInBand
```

Expected: typecheck and tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/map-picker.tsx 'src/app/(app)/penataan-lahan.tsx'
git commit -m "feat: add internal plot mapping screen"
```

## Task 7: Build Farmer Dashboard, Task Detail, And Evidence Upload

**Files:**
- Create: `src/components/evidence-picker.tsx`
- Modify: `src/app/(app)/_layout.tsx`
- Modify: `src/app/(app)/petani.tsx`
- Create: `src/app/(app)/task/[id].tsx`

- [ ] **Step 1: Write failing route test**

Update `src/lib/__tests__/routing.test.ts`:

```typescript
import { pickDashboardRoute } from '../routing';

describe('pickDashboardRoute', () => {
  test('returns petani dashboard path for farmer role', () => {
    expect(pickDashboardRoute('farmer')).toBe('/(app)/petani');
  });

  test('returns pegawai dashboard path for internal role', () => {
    expect(pickDashboardRoute('internal')).toBe('/(app)/pegawai');
  });

  test('throws for unknown role (fail-fast)', () => {
    expect(() => pickDashboardRoute('supervisor' as never)).toThrow(/Invalid role/);
  });

  test('throws for empty string', () => {
    expect(() => pickDashboardRoute('' as never)).toThrow(/Invalid role/);
  });

  test('throws for legacy role "worker"', () => {
    expect(() => pickDashboardRoute('worker' as never)).toThrow(/Invalid role/);
  });

  test('throws for legacy role "admin"', () => {
    expect(() => pickDashboardRoute('admin' as never)).toThrow(/Invalid role/);
  });
});
```

Run:

```bash
npm test -- src/lib/__tests__/routing.test.ts --runInBand
```

Expected: PASS. This confirms route role behavior is unchanged before UI work.

- [ ] **Step 2: Create `EvidencePicker`**

Create `src/components/evidence-picker.tsx`:

```typescript
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { Spacing } from '@/constants/theme';
import { PrimaryButton } from './primary-button';
import { ThemedText } from './themed-text';

type EvidencePickerProps = {
  uri: string | null;
  disabled?: boolean;
  onChange: (asset: { uri: string; mimeType: string }) => void;
};

export function EvidencePicker({ uri, disabled, onChange }: EvidencePickerProps) {
  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onChange({
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? 'image/jpeg',
      });
    }
  }

  return (
    <View style={styles.wrapper}>
      {uri ? <Image source={{ uri }} style={styles.preview} /> : null}
      <PrimaryButton
        label={uri ? 'Ganti Foto Bukti' : 'Pilih Foto Bukti'}
        onPress={pickImage}
        disabled={disabled}
      />
      {uri ? (
        <Pressable onPress={() => onChange({ uri: '', mimeType: 'image/jpeg' })}>
          <ThemedText type="small" themeColor="textSecondary">
            Hapus pilihan
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.two,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
  },
});
```

- [ ] **Step 3: Register task route**

In `src/app/(app)/_layout.tsx`, add:

```typescript
<Stack.Screen name="task/[id]" options={{ title: 'Detail Task' }} />
```

- [ ] **Step 4: Update farmer dashboard**

In `src/app/(app)/petani.tsx`:

- Fetch `profile`, assigned plots, current location, and farmer tasks.
- Use `evaluateGeofence` to compute nearest plot state.
- Show distance and unlocked status in `DashboardSection title="Absensi GPS"`.
- Show task cards in `DashboardSection title="Tugas Hari Ini"`.
- Route unlocked task cards to `router.push({ pathname: '/task/[id]', params: { id: task.id } })`.
- Keep locked cards visible with text: `Datang ke radius 1 km dari lahan untuk membuka task ini.`

- [ ] **Step 5: Create task detail screen**

Create `src/app/(app)/task/[id].tsx`:

- Load task detail by `id`.
- Load related plot.
- Recompute foreground geofence.
- If locked, render locked state and retry location button.
- If unlocked, render instructions, `EvidencePicker`, note field, AI placeholder text from `buildMvpAnalysisSummary`, and submit button.
- On submit, call `validateEvidenceUpload`, `uploadTaskEvidence`, then `markTaskComplete`.
- Show success alert and route back to farmer dashboard.

- [ ] **Step 6: Verify**

Run:

```bash
npm run typecheck
npm test -- --runInBand
```

Expected: typecheck and tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/evidence-picker.tsx 'src/app/(app)/_layout.tsx' 'src/app/(app)/petani.tsx' 'src/app/(app)/task/[id].tsx' src/lib/__tests__/routing.test.ts
git commit -m "feat: add farmer task evidence flow"
```

## Task 8: End-To-End Verification

**Files:**
- Modify only files needed to fix verification failures from prior tasks.

- [ ] **Step 1: Run full automated checks**

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
```

Expected: all pass.

- [ ] **Step 2: Start Expo dev server**

```bash
npm run start
```

Expected: Expo starts and prints a local QR/dev URL.

- [ ] **Step 3: Manual Android Expo Go checks**

Use Expo Go and verify:

- Internal login reaches dashboard internal.
- Internal opens `Penataan Lahan`.
- Internal can create plot with map-selected location, area, crop type, and phase.
- Farmer login reaches dashboard petani.
- Farmer sees assigned plot status.
- Farmer outside radius sees locked tasks.
- Farmer inside radius sees unlocked tasks.
- Farmer can select photo evidence and submit task.

- [ ] **Step 4: Fix verification failures**

For any failure, write a focused failing test if the failure is in business logic. Fix the smallest code path and rerun:

```bash
npm test -- --runInBand
npm run typecheck
npm run lint
```

Expected: all pass.

- [ ] **Step 5: Final commit**

```bash
git status --short
git add package.json package-lock.json app.json supabase/migrations/0003_agroweather_mvp.sql src/lib src/services src/components 'src/app/(app)'
git commit -m "feat: implement agroweather expo mvp"
```

If all feature changes were already committed task-by-task and no files remain, skip this final commit.

## Plan Self-Review

- Spec coverage: internal plot mapping is covered by Tasks 2, 3, 5, and 6; farmer foreground geofence and task unlocking by Tasks 4, 5, and 7; photo evidence by Tasks 2, 3, 5, and 7; Expo SDK 57 alignment by Task 1; future OpenRouter boundary by Task 4.
- Placeholder scan: no task asks the implementer to invent an unnamed module or leave unfinished code.
- Type consistency: plot naming uses app camelCase types and Supabase snake_case mappers; geofence radius is consistently `radiusGeofenceM` in app code and `radius_geofence_m` in SQL.
