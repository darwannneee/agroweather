# AgroWeather Field-First UI and Explicit GPS Design

> Status: Approved in conversation on 2026-07-29.
> Selected approach: targeted UX restructure.
> Runtime target: Expo SDK 54 for compatibility with the current Expo Go store build.

## Summary

AgroWeather will replace its current starter-style interface with a cohesive, light-only, field-first experience for farmers and internal staff. The redesign prioritizes outdoor readability, explicit actions, large touch targets, clear operational states, and reusable components.

GPS access will never be requested when a screen mounts. A user must press a clearly labeled location action before the app requests foreground permission or reads a position. Every important location-dependent action obtains a fresh position rather than reusing an earlier location or running continuous tracking.

This design supersedes the UI and automatic-GPS portions of `2026-07-23-agroweather-mvp-design.md`. It does not supersede the existing MVP domain model or service boundaries unless this document says so explicitly.

## Goals

- Rewrite every current screen with one consistent Field First visual language.
- Make the farmer workflow fast to understand under outdoor conditions.
- Give internal users a more structured but visually consistent operational dashboard.
- Trigger foreground GPS only after an explicit user action.
- Obtain a fresh position for check-in, task unlock, evidence submission, and map recentering.
- Let internal users map a plot manually when GPS is denied or unavailable.
- Keep attendance and location-locked tasks unavailable when GPS validation fails.
- Split oversized screens into small UI and domain components with clear responsibilities.
- Preserve the current Expo SDK 54, Expo Router, and Supabase service stack.
- Restore successful Android, iOS, and web bundling.

## Non-Goals

- Expo SDK 57 migration.
- Dark mode.
- Background or continuous location tracking.
- Offline queues or resumable uploads.
- Supabase RLS, RPC, or anti-spoof security changes.
- New weather API or real AI implementation.
- Bottom-tab navigation.
- New product features beyond the screens and flows that already exist.

The client redesign improves consent, clarity, and location freshness. It does not make client-provided GPS tamper-proof.

## Platform and Documentation Constraints

- Use Expo SDK 54-compatible package versions because the physical-device Expo Go build currently available through the stores targets SDK 54.
- Keep the project in Expo managed workflow and compatible with Expo Go.
- Follow the repository instruction to read the exact Expo SDK 57 documentation before code changes.
- Also use the exact Expo SDK 54 API reference for implementation details because SDK 54 is the actual runtime.
- Use foreground permission and current-position APIs from `expo-location`.
- Do not add `expo-task-manager`, background permissions, or background location configuration.
- Keep `react-native-maps` for native maps, but isolate it behind a native platform file so web never imports the native-only package.

Documentation references:

- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/versions/v57.0.0/sdk/location/
- https://docs.expo.dev/versions/v54.0.0/
- https://docs.expo.dev/versions/v54.0.0/sdk/location/
- https://docs.expo.dev/versions/v54.0.0/sdk/map-view/
- https://docs.expo.dev/versions/v54.0.0/sdk/imagepicker/

## Selected Visual Direction: Field First

### Principles

- Light-only interface optimized for outdoor visibility.
- Strong green surfaces for location and operational actions.
- Warm yellow for the single most important action in a section.
- Near-black green text rather than pure black.
- Clear icons and labels so status never depends on color alone.
- Minimum body size of 15–16 px.
- Minimum interactive target of 44 by 44 points.
- Short Indonesian labels and actionable error messages.
- Progressive disclosure: task evidence is hidden until location validation succeeds.

### Color Roles

- `forest`: `#1F542E`, primary brand and high-emphasis operational surfaces.
- `forestPressed`: `#173F23`, pressed/active state for forest controls.
- `harvest`: `#F3BF4F`, primary call-to-action and location trigger.
- `harvestPressed`: `#DDA936`, pressed state for harvest controls.
- `canvas`: `#F6F8F3`, app background.
- `surface`: `#FFFFFF`, cards, forms, and sheets.
- `ink`: `#203026`, primary text.
- `muted`: `#657165`, secondary text.
- `border`: `#DFE7DC`, surface separation.
- `success`: background `#DCEBD8`, border `#BDD4B8`, text `#21492A`.
- `warning`: background `#FFF3D8`, border `#EBD298`, text `#71541D`.
- `danger`: background `#FDE7E1`, border `#EBC1B6`, text `#633027`.
- Semantic success, warning, and danger palettes each include background, border, and text colors.

These values will be centralized in the theme file. Components must not introduce one-off hardcoded surface or text colors.

### Spacing and Shape

- Spacing scale: 4, 8, 12, 16, 24, and 32.
- Card radii: 16–20.
- Input and button radii: 12–14.
- Screen horizontal padding: 20 below 390 points wide and 24 at 390 points or wider.
- Standard cards use a one-point border without elevation. The primary location card may use a single subtle shadow.

## Information Architecture

### Entry and Role Routing

1. Root screen resolves the current auth session and profile.
2. Unauthenticated users go to login.
3. Farmers go to the farmer dashboard.
4. Internal users go to the internal dashboard.
5. Protected screens also enforce the expected role in the client to prevent accidental cross-role navigation.

Client-side role routing is a UX safeguard, not a replacement for database authorization.

### Navigation

Keep stack navigation. The current feature set does not justify bottom tabs without filling them with placeholders.

Routes:

- `/login`
- `/(app)/petani`
- `/(app)/pegawai`
- `/(app)/penataan-lahan`
- `/(app)/penataan-lahan/form`
- `/(app)/task/[id]`

The plot form becomes a full-screen route instead of a long modal. It accepts an optional plot identifier for edit mode. Back navigation must warn before discarding a dirty form.

## Screen Designs

### Login

- Compact AgroWeather brand mark and one-line product context.
- Email and password inputs with persistent labels.
- Password visibility control.
- Large primary login action.
- Inline field validation.
- Authentication failures use a concise inline error panel; raw Supabase messages are not shown directly.
- No registration link because public registration is intentionally unavailable.

### Farmer Dashboard

Order of content:

1. Greeting and compact account action.
2. `LocationActionCard`.
3. Summary cards for active plots and relevant tasks.
4. Task groups: location-ready, requires-location-check, and completed.

Initial load fetches plots and tasks but does not request location.

The location card begins in `idle` with the action:

`Aktifkan GPS & Cek Kehadiran`

After a successful read, the app compares the position with assigned active plots and selects the nearest plot as the attendance target. The result shows plot name, distance, dynamic configured radius, and check-in outcome.

`Periksa Lagi` always starts a new location request.

The task section is titled `Tugas Saya` and contains all assigned tasks. Before GPS is checked, required-location tasks are labeled `Perlu cek lokasi`; they are not described as outside the radius. After GPS is checked, task cards may show ready/outside status for the matching plot, but task detail still revalidates location. Task copy uses the plot's actual radius, deadline, and status.

### Internal Dashboard

- Greeting and role context.
- Compact metrics for plots and assigned farmers using real fetched data.
- Prominent `Kelola Lahan` action.
- Weather, verification, activity, and assignment placeholders are removed until those flows have real data and actions.
- No GPS request occurs on this dashboard.

### Plot List

- Screen header with description and `Tambah Lahan` action.
- Summary metrics.
- Search and filtering are omitted in this phase.
- Plot cards show name, crop, phase, farmer, area, radius, status, and concise coordinates.
- Edit and status actions are explicit.
- Loading skeleton, empty state, error state, and retry use shared components.

### Plot Form

Sections:

1. Plot identity: name, area, crop, phase.
2. Farmer assignment.
3. Location and attendance radius.
4. Review and save.

The form uses normal screen scrolling and keyboard avoidance. Saving is blocked until validation succeeds.

### Map Picker

Native flow:

1. The map renders without requesting permission.
2. User taps `Gunakan Lokasi Saya`.
3. The app requests a fresh foreground location.
4. The map animates to that position but does not yet save it.
5. A fixed center crosshair represents the candidate point while the user pans.
6. User taps `Pilih Titik Ini`.
7. Only then does the coordinate enter the form.

The user can also position the map manually without granting location permission.

Web flow:

- The web component never imports `react-native-maps`.
- It provides bounded latitude and longitude fields.
- Empty input remains empty; it never becomes zero automatically.
- A coordinate is valid only when latitude is between -90 and 90 and longitude is between -180 and 180.

### Task Detail

Initial state:

- Load task, plot, existing evidence count, and instructions.
- Do not request location.
- Location-dependent evidence controls stay locked.

Unlock flow:

1. User taps `Periksa Lokasi Task`.
2. The app gets a fresh position.
3. It evaluates the configured plot radius.
4. If inside, evidence controls become available.
5. If outside or invalid, the draft stays untouched and the state explains how to retry.

Submission flow:

1. User chooses or captures a photo and optionally adds a note.
2. User taps `Periksa GPS & Kirim Bukti`.
3. The app obtains another fresh position.
4. It revalidates the task radius.
5. If validation succeeds, upload continues.
6. If validation fails, upload is cancelled and the selected photo/note remain.

Tasks with `requires_location = false` skip both location gates and use a normal submit action.

## Component Architecture

### UI Primitives

Place general visual primitives under `src/components/ui`:

- `AppScreen`
- `ScreenHeader`
- `AppText`
- `AppButton`
- `SurfaceCard`
- `StatusPill`
- `FormField`
- `LoadingSkeleton`
- `EmptyState`
- `ErrorState`

Each primitive has one visual responsibility and does not import Supabase or Expo Location.

### Domain Components

Place feature-aware components under `src/components/domain`:

- `LocationActionCard`
- `TaskCard`
- `PlotCard`
- `PlotStats`
- `EvidencePicker`
- `MapPicker`

Domain components receive data and callbacks through props. Screens own orchestration and service calls.

### Screen Responsibility

Screens:

- Fetch domain data.
- Compose UI and domain components.
- Trigger actions through hooks/services.
- Navigate between routes.

Screens must not duplicate theme colors, location permission branches, or card-state copy.

## Location Architecture

### Typed Result

The location service returns a typed result that distinguishes:

- `granted`
- `permission-denied`
- `permission-blocked`
- `services-disabled`
- `unavailable`
- `low-accuracy`

A granted result contains:

- latitude
- longitude
- accuracy in meters when provided
- timestamp

Errors contain a stable code and user-safe Indonesian message. Raw native errors are retained only for development logging.

### Location Action Hook

A reusable `useLocationAction` hook owns transient action state:

- `idle`
- `checking`
- `success`
- `error`

It exposes a function that always starts a new request. It does not cache a coordinate for use by later critical actions.

It prevents duplicate taps while a request is active and ignores stale async completion after unmount or after a newer request starts.

### Permission Flow

1. Check whether location services are enabled.
2. Read existing foreground permission.
3. Request foreground permission only when it can still be requested.
4. If permission is blocked, show `Buka Pengaturan`.
5. Read current position with high accuracy.
6. Validate coordinate bounds, accuracy, and timestamp.

Use `Linking.openSettings()` for permanently blocked permission. On Android, allow Expo Location to show the user settings dialog when supported.

### Accuracy Policy

A location result that is too imprecise must not unlock a task or create attendance. The initial threshold is the smaller of:

- half the plot radius; or
- 200 meters.

A missing accuracy value also fails attendance/task validation. A returned position must be no more than 60 seconds old when received. The implementation must isolate these rules in pure helpers with unit tests so thresholds can be adjusted without changing screens.

Mapping may still use a low-accuracy position to center the map because the user must manually confirm the final point.

### No Continuous Tracking

Do not call `watchPositionAsync`, request background permission, register tasks, or persist a live location subscription.

## Location Data Flows

### Farmer Attendance

1. Fetch plots and tasks without GPS.
2. User taps the location action.
3. Get a fresh position.
4. Evaluate active assigned plots.
5. Choose the nearest plot.
6. If within its radius and accuracy is acceptable, call the existing attendance service.
7. Render the database result separately from the GPS result.

A network failure must not be presented as a GPS failure.

### Task Unlock and Submission

Task unlock uses one fresh location read. Submission uses a second fresh read. The earlier result is for UI enablement only and is never trusted as the upload position.

### Plot Mapping

The GPS result only sets the map viewport. The selected plot coordinate comes from the user's confirmed crosshair position.

## Error Handling

- Location permission and sensor issues use inline `LocationActionCard` states.
- A permission that can be requested again shows `Coba Lagi`.
- Permanently blocked permission shows `Buka Pengaturan`.
- Disabled services explain that device GPS must be turned on.
- Unavailable/timeout states show retry; only plot mapping offers manual continuation.
- Low accuracy explains that the user should move to an open area and retry.
- Network failures use `ErrorState` or a concise non-location message.
- Destructive plot status changes keep confirmation dialogs.
- Routine validation and recoverable errors avoid modal alerts.
- Raw Supabase and native error messages are not displayed to users.
- Async results from abandoned screens or superseded requests are ignored.

## Form Validation

Plot validation:

- Name required.
- Area finite and greater than zero.
- Crop required.
- Phase required.
- Latitude between -90 and 90.
- Longitude between -180 and 180.
- Radius is a positive integer.

Evidence validation:

- Task exists and belongs to the current UI context.
- Required location gate has succeeded.
- Photo asset exists.
- Note remains optional.
- Submission-time location must pass a fresh geofence and accuracy check.

## Testing Strategy

### Unit Tests

- Coordinate-bound validation.
- Accuracy threshold calculation.
- Nearest active plot selection.
- Dynamic geofence copy/formatting.
- Location result to UI-state mapping.
- Existing geofence, form, routing, and analysis tests remain green.

### Hook and Component Tests

- Mounting dashboard, task detail, or map picker does not call Expo Location.
- Pressing each GPS action calls the location service once.
- Repeated actions obtain separate fresh results.
- Checking state prevents duplicate taps.
- Denied, blocked, disabled, unavailable, low-accuracy, inside, and outside states render correct actions.
- Manual mapping remains available after a GPS error.
- Evidence draft remains after submission-time location failure.

Add an Expo SDK 54-compatible React Native Testing Library version and use it for interactive component tests.

### Service-Orchestration Tests

- Dashboard attendance uses the nearest active assigned plot.
- A GPS success followed by attendance network failure renders the network failure separately.
- Task submission does not upload when the second geofence validation fails.
- Non-location tasks skip location reads.
- Map GPS results center the native map but do not mutate form coordinates before confirmation.

### Build and Manual Verification

Automated:

- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand`
- `npx expo install --check`
- Android export bundle.
- iOS export bundle.
- Web static export bundle.

Physical-device Expo Go:

- First-time foreground permission grant.
- Permission denial and permanent block.
- Device location services disabled.
- Inside/outside radius behavior.
- Repeated fresh location checks.
- Camera and library evidence flows.
- Map panning and candidate confirmation.
- Small-screen keyboard and safe-area behavior.

## Acceptance Criteria

- All current screens use the Field First light theme.
- No screen requests permission or reads GPS on mount.
- Every GPS read follows a visible user action.
- Attendance targets the nearest active assigned plot.
- A task revalidates location immediately before upload.
- Plot mapping never silently stores the GPS position, `0,0`, or the default viewport.
- Manual mapping works without location permission.
- Attendance and required-location tasks remain locked after location failure.
- All displayed distance/radius copy uses actual data.
- Android, iOS, and web bundling succeed.
- Typecheck, lint, existing tests, and new tests pass without warnings caused by the rewrite.
- No background location capability is introduced.

## Implementation Boundaries

The rewrite may reorganize React components, introduce a full-screen plot-form route, add pure location helpers, and change client orchestration. It must not:

- modify Supabase policies or migrations;
- upgrade Expo;
- add background capabilities;
- implement weather/AI services;
- discard unrelated working-tree changes;
- include visual companion files in commits.
