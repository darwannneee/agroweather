# AgroWeather MVP Expo Design Spec

> Status: Approved for MVP design on 2026-07-23.
> Selected approach: MVP Expo Go first.
> Primary platform: Expo managed workflow, Android-first testing through Expo Go.

## Summary

AgroWeather MVP lets internal users map and manage farm plots, then lets farmers check in and work on tasks when they are physically near the assigned plot. The app uses foreground GPS checks, map-based plot selection, task unlocking within a 1 km radius, and photo evidence upload. AI analysis through OpenRouter is represented by a client-safe placeholder/service boundary in this MVP, with production AI automation deferred to a later backend phase.

The implementation must follow the Expo SDK 57 documentation before writing feature code. The current repository is still on Expo SDK 54, so the implementation plan must start by aligning Expo dependencies with SDK 57, then installing SDK-compatible packages for maps, location, and image picking.

## Goals

- Internal users can create, edit, view, and deactivate farm plots.
- A farm plot stores name, farmer assignment, area, crop type, location, attendance radius, and current crop stage/season state.
- Farmers see their assigned plots and daily tasks.
- Farmers are checked against their foreground GPS location when opening the farmer dashboard/task screen.
- Tasks unlock when the farmer is within 1 km of the plot center.
- Farmers can upload a photo as work evidence for an unlocked task.
- The app stores enough structured data for a future daily AI recommendation loop.

## Non-Goals

- No background location tracking while the app is closed.
- No push notifications.
- No production OpenRouter calls from the mobile app.
- No automatic daily Supabase Cron or Edge Function in this MVP.
- No polygon drawing. MVP uses plot center plus radius.
- No offline mode.

## Expo And Library Decisions

- Use Expo managed workflow and keep the app Expo Go friendly for MVP validation.
- Use `react-native-maps` for map UI because the Expo SDK 57 docs list it as included in Expo Go.
- Use `expo-location` for foreground location permission and current location reads.
- Use `expo-image-picker` for camera/library photo evidence.
- Do not use `expo-maps` in MVP because Expo SDK 57 marks it alpha and unavailable in Expo Go.
- Do not use raw `tile.openstreetmap.org` tiles for a public APK because OSM tile servers are best-effort community infrastructure with usage policy constraints.

Reference docs already checked:

- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/versions/v57.0.0/sdk/map-view/
- https://docs.expo.dev/versions/v57.0.0/sdk/location/
- https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- https://docs.expo.dev/versions/v57.0.0/sdk/maps/
- https://openrouter.ai/docs/quickstart
- https://operations.osmfoundation.org/policies/tiles/

## User Flows

### Internal Plot Mapping

1. Internal user logs in and opens the existing internal dashboard.
2. User opens `Penataan Lahan`.
3. User taps `Tambah Lahan`.
4. Form asks for plot name, farmer, area in hectares, crop type, crop stage/season state, and status.
5. User grants foreground location permission or manually positions the map.
6. User selects plot center from the map.
7. Attendance radius defaults to 1000 meters and can be shown as fixed text in MVP.
8. User saves the plot.
9. Plot appears in the plot list with crop, area, farmer, location summary, stage, and active status.

### Farmer Check-In And Task Unlock

1. Farmer logs in and opens the farmer dashboard.
2. App requests foreground location permission if needed.
3. App fetches assigned active plots and today's tasks.
4. App computes distance from farmer location to each plot center.
5. If distance is <= 1000 meters, the app records/checks an attendance row and unlocks tasks for that plot.
6. If distance is > 1000 meters, tasks stay visible as locked with a short distance/status message.

### Evidence Upload

1. Farmer opens an unlocked task.
2. Farmer chooses or captures a photo with `expo-image-picker`.
3. App uploads the image to Supabase Storage.
4. App writes a task evidence row with task id, farmer id, photo path, optional note, and location at upload time.
5. Task status can move to `selesai` after evidence is uploaded.

### AI Placeholder

1. The UI can show an `Analisis AI` section on a task or plot detail.
2. In MVP this section uses a local deterministic helper that summarizes available data as a placeholder recommendation.
3. The helper must be isolated behind an `analysis` service interface so a later Supabase Edge Function can replace it without changing screens.
4. OpenRouter API keys must never be stored in the Expo client.

## Information Architecture

Existing routes remain:

- `/login`
- `/(app)/pegawai`
- `/(app)/petani`
- `/(app)/penataan-lahan`

New or expanded screens for MVP:

- `/(app)/penataan-lahan`: internal plot list and add/edit form.
- `/(app)/petani`: farmer dashboard with proximity status and available tasks.
- `/(app)/task/[id]`: task detail, lock state, evidence upload, AI placeholder.

If route churn needs to stay minimal, `/(app)/task/[id]` can be replaced with an inline modal in the farmer dashboard. The preferred design is a separate task route because evidence upload, lock state, and future AI details are easier to test and maintain separately.

## Data Model

The existing documented Supabase schema already contains `users`, `lahan`, `absensi`, `tasks`, and `rekomendasi_cuaca`. MVP should extend that shape conservatively instead of renaming everything.

### `lahan`

Required fields for MVP:

- `id uuid`
- `nama_lahan text`
- `farmer_id uuid nullable references users(id)`
- `jenis_tanaman text`
- `luas_hektar numeric`
- `lat_center numeric`
- `lng_center numeric`
- `radius_geofence_m integer default 1000`
- `fase_lahan text`
- `status text default 'aktif'`
- `created_at timestamptz`
- `updated_at timestamptz`

### `tasks`

Required fields for MVP:

- `id uuid`
- `lahan_id uuid references lahan(id)`
- `assigned_to uuid references users(id)`
- `assigned_by uuid nullable references users(id)`
- `judul text`
- `deskripsi text nullable`
- `status task_status`
- `deadline date nullable`
- `requires_location boolean default true`
- `unlocked_at timestamptz nullable`
- `created_at timestamptz`

### `absensi`

Required fields for MVP:

- `id uuid`
- `farmer_id uuid references users(id)`
- `lahan_id uuid references lahan(id)`
- `waktu_masuk timestamptz`
- `lat numeric`
- `lng numeric`
- `distance_m numeric`
- `status_geofence geofence_status`

### `task_evidence`

Create this table for photo evidence:

- `id uuid`
- `task_id uuid references tasks(id)`
- `farmer_id uuid references users(id)`
- `lahan_id uuid references lahan(id)`
- `photo_path text`
- `note text nullable`
- `lat numeric nullable`
- `lng numeric nullable`
- `ai_placeholder_summary text nullable`
- `created_at timestamptz`

## Service Boundaries

### Plot Service

Responsibilities:

- Fetch plots for internal users.
- Fetch assigned plots for farmers.
- Create and update plot records.
- Convert Supabase rows into app-level plot objects.

### Location Service

Responsibilities:

- Request foreground location permission.
- Read current location.
- Compute distance in meters using a deterministic haversine helper.
- Return typed states for granted, denied, unavailable, and loading.

### Attendance Service

Responsibilities:

- Decide whether a farmer is within `radius_geofence_m`.
- Insert an attendance row when check-in is valid.
- Avoid duplicate attendance for the same farmer, plot, and local day.
- Return task unlock state to the screen.

### Task Service

Responsibilities:

- Fetch tasks assigned to the current farmer.
- Fetch task detail.
- Mark a task complete after evidence upload.
- Keep locked/unlocked UI decisions explicit.

### Evidence Service

Responsibilities:

- Launch image picker.
- Upload photo to Supabase Storage.
- Insert evidence row.
- Return photo path and evidence id.

### Analysis Service

Responsibilities:

- Generate a deterministic MVP summary from plot, task, weather placeholder, and latest evidence metadata.
- Expose an async function with the same high-level shape a future OpenRouter-backed Edge Function will use.
- Never access secret keys in the mobile client.

## UI Design

The app should keep the existing quiet dashboard style and reusable components:

- `DashboardSection` for grouped dashboard information.
- `PrimaryButton` for primary actions.
- `FormField` and `ThemedInput` for form validation.
- `ThemedText`, `ThemedView`, `useTheme`, and `Spacing` for visual consistency.

The plot list should remain scan-friendly:

- Top stats: total plots, active plots, plots with assigned farmers.
- Plot card: name, location, crop type, area, farmer, stage, status.
- Actions: edit, deactivate, view tasks.

The farmer dashboard should prioritize operational status:

- Current location permission state.
- Nearest assigned plot and distance.
- Attendance state: inside radius, outside radius, permission denied, or unavailable.
- Task list grouped into unlocked and locked.

The task detail should keep evidence upload prominent only after unlock:

- Locked state explains that farmer must be within 1 km of the plot.
- Unlocked state shows task instructions and upload control.
- Completed state shows evidence thumbnail/path and timestamp.

## Validation

Plot form validation:

- Plot name is required.
- Area is required and must be a positive number.
- Crop type is required.
- Plot center latitude and longitude are required.
- Radius must be a positive integer; MVP default is 1000 meters.
- Crop stage/season state is required.

Evidence validation:

- Task must be unlocked before upload.
- Photo asset must exist and have a URI.
- Upload errors show a user-facing alert.
- A task cannot be completed without evidence in MVP.

Location validation:

- If permission is denied, show locked tasks and a permission explanation.
- If location read fails, show locked tasks and retry action.
- If distance cannot be computed, do not unlock tasks.

## Error Handling

- Supabase read/write failures show concise Indonesian error alerts.
- Permission denial never crashes the screen.
- Map unavailable states fall back to manual latitude/longitude fields only if the map component cannot render.
- Duplicate attendance insert should be treated as already checked in for the day.
- Storage upload failure leaves the task incomplete.
- AI placeholder failure never blocks task completion.

## Testing Strategy

Unit tests:

- Plot form validation rejects missing/invalid fields and accepts valid input.
- Haversine distance returns expected distances and geofence unlocks at <= 1000 meters.
- Attendance decision returns locked/unlocked states for inside radius, outside radius, permission denied, and missing location.
- Analysis placeholder returns deterministic text without network calls.

Service tests with mocked Supabase client:

- Plot create maps form values to the `lahan` schema.
- Evidence upload inserts `task_evidence` only after storage upload succeeds.
- Task completion is not called when evidence upload fails.

Manual Expo tests:

- Internal can add a plot from `Penataan Lahan`.
- Farmer sees locked tasks outside radius.
- Farmer sees unlocked tasks inside radius.
- Farmer can upload photo evidence and mark task complete.

## Future Phase

The next phase should add Supabase Edge Functions and Supabase Cron:

- Store `OPENROUTER_API_KEY` in Supabase secrets.
- Generate daily task recommendations through OpenRouter from weather, plot, crop stage, and yesterday's evidence.
- Optionally add BMKG/Open-Meteo/NASA POWER weather ingestion.
- Add production background location only after moving beyond Expo Go into a development build.

## Open Decisions Closed For MVP

- Role split: both internal and farmer are in scope.
- Map approach: Expo-friendly `react-native-maps`.
- Geofence mode: foreground check while app is open.
- Radius: fixed 1 km default for MVP.
- AI: placeholder only in mobile client; production OpenRouter call deferred.
