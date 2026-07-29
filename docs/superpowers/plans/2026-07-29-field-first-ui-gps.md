# Field-First UI and Explicit GPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite every current AgroWeather screen with the approved Field First UI and make every GPS read occur only after an explicit user action.

**Architecture:** Keep Expo Router, Expo SDK 54, and existing Supabase services. Introduce a light-only UI foundation, pure location-policy helpers, a typed foreground-location service, and a reusable action hook; screens orchestrate those units without requesting location on mount. Native and web maps use platform-specific files so web never imports `react-native-maps`.

**Tech Stack:** Expo SDK 54, React Native 0.81, React 19.1, Expo Router 6, TypeScript, `expo-location`, `react-native-maps`, Supabase JS, Jest Expo, React Native Testing Library 13.3.3.

---

## File Structure

### Create

- `src/lib/location-policy.ts` — coordinate, age, accuracy, and nearest-plot rules.
- `src/lib/__tests__/location-policy.test.ts` — pure location-policy coverage.
- `src/services/__tests__/location.test.ts` — permission and native GPS service coverage.
- `src/hooks/use-location-action.ts` — reusable explicit location action state.
- `src/hooks/__tests__/use-location-action.test.tsx` — hook concurrency and freshness tests.
- `src/components/ui/app-text.tsx` — light-only Field First typography.
- `src/components/ui/app-button.tsx` — accessible action variants.
- `src/components/ui/app-screen.tsx` — safe-area and keyboard-aware screen shell.
- `src/components/ui/surface-card.tsx` — standard bordered surface.
- `src/components/ui/screen-header.tsx` — consistent heading/action composition.
- `src/components/ui/status-pill.tsx` — semantic status label.
- `src/components/ui/feedback-state.tsx` — loading, empty, and recoverable error states.
- `src/components/ui/form-field.tsx` — accessible label, input, help, and error.
- `src/components/ui/__tests__/app-button.test.tsx` — button behavior and accessibility.
- `src/components/domain/location-action-card.tsx` — all GPS action states.
- `src/components/domain/__tests__/location-action-card.test.tsx` — rendered GPS states.
- `src/components/domain/evidence-picker.tsx` — Field First photo evidence and permission recovery.
- `src/components/domain/task-card.tsx` — task summary and lock/status presentation.
- `src/components/domain/plot-card.tsx` — plot summary and actions.
- `src/components/domain/plot-stats.tsx` — real plot/farmer metrics.
- `src/components/domain/__tests__/plot-card.test.tsx` — plot status and actions.
- `src/components/domain/__tests__/task-card.test.tsx` — task location/status presentation.
- `src/components/domain/role-guard.tsx` — role-aware render boundary that prevents wrong-role screen effects from mounting.
- `src/components/domain/__tests__/role-guard.test.tsx` — role redirect behavior.
- `src/components/domain/map-picker.types.ts` — shared platform map props.
- `src/components/domain/map-picker.tsx` — native map and fixed-center candidate.
- `src/components/domain/map-picker.web.tsx` — bounded manual coordinate fields.
- `src/components/domain/__tests__/map-picker.test.tsx` — native explicit-GPS and confirm boundary.
- `src/components/domain/__tests__/map-picker.web.test.tsx` — web coordinate behavior.
- `src/app/(app)/penataan-lahan/form.tsx` — full-screen add/edit plot form.

### Modify

- `package.json` and `package-lock.json` — lock SDK 54 baseline and add test tooling.
- `app.json` — retain foreground-only permission messaging.
- `src/constants/theme.ts` — approved Field First tokens.
- `src/lib/farm-validation.ts` — latitude and longitude bounds.
- `src/lib/__tests__/farm-validation.test.ts` — coordinate-bound tests.
- `src/services/location.ts` — explicit typed foreground location read.
- `src/app/_layout.tsx` — light status bar and rewritten route declarations.
- `src/app/index.tsx` — Field First auth-loading state.
- `src/app/login.tsx` — Field First login.
- `src/app/(app)/_layout.tsx` — route headers and role-aware navigation.
- `src/app/(app)/index.tsx` — Field First app auth-loading state.
- `src/app/(app)/petani.tsx` — explicit attendance GPS and grouped tasks.
- `src/app/(app)/pegawai.tsx` — real operational summary.
- `src/app/(app)/penataan-lahan.tsx` — plot list only; move form out.
- `src/app/(app)/task/[id].tsx` — explicit unlock and submission-time recheck.

### Delete After All Imports Move

- `src/components/map-picker.tsx`
- `src/components/primary-button.tsx`
- `src/components/dashboard-section.tsx`
- `src/components/form-field.tsx`
- `src/components/themed-text.tsx`
- `src/components/themed-view.tsx`
- `src/components/evidence-picker.tsx` after it is moved to `src/components/domain/evidence-picker.tsx`
- `src/hooks/use-theme.ts`
- `src/hooks/use-color-scheme.ts`
- `src/hooks/use-color-scheme.web.ts`
- `src/global.css`

Do not delete a legacy component until `rg` proves that no source file imports it.

## Task 1: Lock the Expo 54 Baseline and Test Tooling

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`

- [ ] **Step 1: Re-read the required versioned Expo references**

Read:

- `https://docs.expo.dev/versions/v57.0.0/`
- `https://docs.expo.dev/versions/v57.0.0/sdk/location/`
- `https://docs.expo.dev/versions/v54.0.0/`
- `https://docs.expo.dev/versions/v54.0.0/sdk/location/`
- `https://docs.expo.dev/versions/v54.0.0/sdk/map-view/`

Confirm SDK 54 uses `Location.hasServicesEnabledAsync()`, `getForegroundPermissionsAsync()`, `requestForegroundPermissionsAsync()`, and `getCurrentPositionAsync()`.

- [ ] **Step 2: Verify the current intentional SDK 54 dependency diff**

Run:

```bash
git diff -- app.json package.json package-lock.json
npx expo install --check
npx expo-doctor
```

Expected:

- Expo dependency check reports `Dependencies are up to date`.
- Expo Doctor passes every project check except the known local CocoaPods/tooling check.
- No Expo SDK 57 package remains in the working dependency manifest.

- [ ] **Step 3: Add the component-test dependency**

Run:

```bash
npm install --save-dev @testing-library/react-native@13.3.3
```

Expected: `package.json` contains:

```json
"@testing-library/react-native": "13.3.3"
```

- [ ] **Step 4: Verify the baseline before UI code**

Run:

```bash
npm run typecheck
npm test -- --runInBand
```

Expected: typecheck passes and the existing 50 tests pass.

- [ ] **Step 5: Commit only the dependency/config baseline**

Run:

```bash
git add app.json package.json package-lock.json
git diff --cached --check
git commit -m "chore: lock Expo 54 UI test baseline"
```

Do not stage login, register, map picker, or location source changes in this commit.

## Task 2: Add Pure Location Policy Rules

**Files:**

- Create: `src/lib/location-policy.ts`
- Create: `src/lib/__tests__/location-policy.test.ts`

- [ ] **Step 1: Write the failing policy tests**

Create `src/lib/__tests__/location-policy.test.ts`:

```ts
import type { FarmPlot } from '../farm-types';
import {
  accuracyLimitForRadius,
  findNearestActivePlot,
  isCoordinateInBounds,
  validateLocationReading,
} from '../location-policy';

const basePlot: FarmPlot = {
  id: 'plot-a',
  namaLahan: 'Sawah A',
  farmerId: 'farmer-1',
  farmerName: 'Budi',
  luasHektar: 1,
  jenisTanaman: 'Padi',
  faseLahan: 'Tanam',
  latCenter: -7.25,
  lngCenter: 112.76,
  radiusGeofenceM: 1000,
  status: 'aktif',
};

describe('location policy', () => {
  test.each([
    [-90, -180],
    [0, 0],
    [90, 180],
  ])('accepts bounded coordinate %p, %p', (latitude, longitude) => {
    expect(isCoordinateInBounds({ latitude, longitude })).toBe(true);
  });

  test.each([
    [-90.01, 0],
    [90.01, 0],
    [0, -180.01],
    [0, 180.01],
    [Number.NaN, 0],
  ])('rejects invalid coordinate %p, %p', (latitude, longitude) => {
    expect(isCoordinateInBounds({ latitude, longitude })).toBe(false);
  });

  test('caps accepted accuracy at 200 meters', () => {
    expect(accuracyLimitForRadius(1000)).toBe(200);
    expect(accuracyLimitForRadius(100)).toBe(50);
  });

  test('rejects missing, stale, and imprecise readings', () => {
    const now = 1_000_000;
    expect(
      validateLocationReading(
        { latitude: -7.25, longitude: 112.76, accuracyM: null, timestamp: now },
        1000,
        now
      )
    ).toBe('missing-accuracy');
    expect(
      validateLocationReading(
        { latitude: -7.25, longitude: 112.76, accuracyM: 20, timestamp: now - 60_001 },
        1000,
        now
      )
    ).toBe('stale');
    expect(
      validateLocationReading(
        { latitude: -7.25, longitude: 112.76, accuracyM: 250, timestamp: now },
        1000,
        now
      )
    ).toBe('low-accuracy');
  });

  test('finds the nearest active plot and ignores inactive plots', () => {
    const nearest = findNearestActivePlot(
      [
        { ...basePlot, id: 'inactive', latCenter: -7.25, status: 'tidak aktif' },
        { ...basePlot, id: 'far', latCenter: -7.35 },
        { ...basePlot, id: 'near', latCenter: -7.251 },
      ],
      { latitude: -7.25, longitude: 112.76 }
    );

    expect(nearest?.plot.id).toBe('near');
    expect(nearest?.distanceM).toBeLessThan(200);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/location-policy.test.ts
```

Expected: FAIL because `../location-policy` does not exist.

- [ ] **Step 3: Implement the pure policy module**

Create `src/lib/location-policy.ts`:

```ts
import type { FarmPlot } from './farm-types';
import { distanceMeters, type Coordinates } from './geofence';

export const LOCATION_MAX_AGE_MS = 60_000;
export const LOCATION_MAX_ACCURACY_M = 200;

export type LocationReading = Coordinates & {
  accuracyM: number | null;
  timestamp: number;
};

export type LocationReadingIssue =
  | 'invalid-coordinates'
  | 'missing-accuracy'
  | 'low-accuracy'
  | 'stale';

export function isCoordinateInBounds(coords: Coordinates): boolean {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

export function accuracyLimitForRadius(radiusM: number): number {
  return Math.min(radiusM / 2, LOCATION_MAX_ACCURACY_M);
}

export function validateLocationReading(
  reading: LocationReading,
  radiusM: number,
  now = Date.now()
): LocationReadingIssue | null {
  if (!isCoordinateInBounds(reading)) return 'invalid-coordinates';
  if (reading.accuracyM === null) return 'missing-accuracy';
  if (now - reading.timestamp > LOCATION_MAX_AGE_MS) return 'stale';
  if (reading.accuracyM > accuracyLimitForRadius(radiusM)) return 'low-accuracy';
  return null;
}

export function findNearestActivePlot(
  plots: FarmPlot[],
  user: Coordinates
): { plot: FarmPlot; distanceM: number } | null {
  return plots
    .filter((plot) => plot.status === 'aktif')
    .map((plot) => ({
      plot,
      distanceM: distanceMeters(user, {
        latitude: plot.latCenter,
        longitude: plot.lngCenter,
      }),
    }))
    .sort((a, b) => a.distanceM - b.distanceM)[0] ?? null;
}
```

- [ ] **Step 4: Run policy and existing geofence tests**

Run:

```bash
npm test -- --runInBand src/lib/__tests__/location-policy.test.ts src/lib/__tests__/geofence.test.ts
```

Expected: both suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/location-policy.ts src/lib/__tests__/location-policy.test.ts
git commit -m "feat: add foreground location policy rules"
```

## Task 3: Rewrite the Foreground Location Service

**Files:**

- Modify: `src/services/location.ts`
- Create: `src/services/__tests__/location.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/services/__tests__/location.test.ts`:

```ts
import * as Location from 'expo-location';

import { requestCurrentLocation } from '../location';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getCurrentPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

const mockedLocation = jest.mocked(Location);

describe('requestCurrentLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLocation.hasServicesEnabledAsync.mockResolvedValue(true);
  });

  test('requests permission only when the existing permission is not granted', async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
      expires: 'never',
    });
    mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    });
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: -7.25,
        longitude: 112.76,
        accuracy: 12,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1_000,
    });

    await expect(requestCurrentLocation()).resolves.toMatchObject({
      status: 'granted',
      coords: { latitude: -7.25, longitude: 112.76 },
      accuracyM: 12,
      timestamp: 1_000,
    });
    expect(mockedLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  test('returns permission-blocked without requesting again', async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
      canAskAgain: false,
      expires: 'never',
    });

    await expect(requestCurrentLocation()).resolves.toMatchObject({
      status: 'permission-blocked',
      canOpenSettings: true,
    });
    expect(mockedLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  test('returns services-disabled before asking permission', async () => {
    mockedLocation.hasServicesEnabledAsync.mockResolvedValue(false);

    await expect(requestCurrentLocation()).resolves.toMatchObject({
      status: 'services-disabled',
    });
    expect(mockedLocation.getForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  test('returns low-accuracy when a maximum is provided', async () => {
    mockedLocation.getForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
      canAskAgain: true,
      expires: 'never',
    });
    mockedLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: -7.25,
        longitude: 112.76,
        accuracy: 250,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });

    await expect(requestCurrentLocation({ maxAccuracyM: 200 })).resolves.toMatchObject({
      status: 'low-accuracy',
      accuracyM: 250,
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
npm test -- --runInBand src/services/__tests__/location.test.ts
```

Expected: FAIL because the current result union and permission sequence do not match.

- [ ] **Step 3: Replace the location service**

Replace `src/services/location.ts` with:

```ts
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import type { Coordinates } from '@/lib/geofence';

export type GrantedLocationResult = {
  status: 'granted';
  coords: Coordinates;
  accuracyM: number | null;
  timestamp: number;
  message: null;
  canOpenSettings: false;
};

export type CurrentLocationResult =
  | GrantedLocationResult
  | {
      status:
        | 'permission-denied'
        | 'permission-blocked'
        | 'services-disabled'
        | 'unavailable';
      coords: null;
      accuracyM: null;
      timestamp: null;
      message: string;
      canOpenSettings: boolean;
    }
  | {
      status: 'low-accuracy';
      coords: Coordinates;
      accuracyM: number | null;
      timestamp: number;
      message: string;
      canOpenSettings: false;
    };

type RequestCurrentLocationOptions = {
  maxAccuracyM?: number;
};

function failure(
  status: Exclude<CurrentLocationResult['status'], 'granted' | 'low-accuracy'>,
  message: string,
  canOpenSettings = false
): CurrentLocationResult {
  return {
    status,
    coords: null,
    accuracyM: null,
    timestamp: null,
    message,
    canOpenSettings,
  };
}

export async function requestCurrentLocation(
  options: RequestCurrentLocationOptions = {}
): Promise<CurrentLocationResult> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return failure(
        'services-disabled',
        'GPS perangkat belum aktif. Nyalakan layanan lokasi lalu coba lagi.',
        true
      );
    }

    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) {
        return failure(
          'permission-blocked',
          'Izin lokasi diblokir. Aktifkan izin lokasi AgroWeather di Pengaturan.',
          true
        );
      }
      permission = await Location.requestForegroundPermissionsAsync();
    }

    if (!permission.granted) {
      return failure(
        permission.canAskAgain ? 'permission-denied' : 'permission-blocked',
        permission.canAskAgain
          ? 'Izin lokasi diperlukan untuk melanjutkan aksi ini.'
          : 'Izin lokasi diblokir. Aktifkan izin lokasi AgroWeather di Pengaturan.',
        !permission.canAskAgain
      );
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });
    const coords = {
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
    };
    const accuracyM = current.coords.accuracy;

    if (
      options.maxAccuracyM !== undefined &&
      (accuracyM === null || accuracyM > options.maxAccuracyM)
    ) {
      return {
        status: 'low-accuracy',
        coords,
        accuracyM,
        timestamp: current.timestamp,
        message: 'Akurasi GPS belum cukup baik. Pindah ke area terbuka lalu periksa lagi.',
        canOpenSettings: false,
      };
    }

    return {
      status: 'granted',
      coords,
      accuracyM,
      timestamp: current.timestamp,
      message: null,
      canOpenSettings: false,
    };
  } catch {
    return failure(
      'unavailable',
      'Lokasi belum ditemukan. Coba lagi di area dengan sinyal GPS yang lebih baik.'
    );
  }
}

export async function openLocationSettings(): Promise<void> {
  await Linking.openSettings();
}
```

- [ ] **Step 4: Run the service tests**

```bash
npm test -- --runInBand src/services/__tests__/location.test.ts
npm run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/location.ts src/services/__tests__/location.test.ts
git commit -m "feat: make foreground GPS an explicit typed action"
```

## Task 4: Add the Reusable Location Action Hook

**Files:**

- Create: `src/hooks/use-location-action.ts`
- Create: `src/hooks/__tests__/use-location-action.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Create `src/hooks/__tests__/use-location-action.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native';

import { useLocationAction } from '../use-location-action';
import type { CurrentLocationResult } from '@/services/location';

const granted: CurrentLocationResult = {
  status: 'granted',
  coords: { latitude: -7.25, longitude: 112.76 },
  accuracyM: 10,
  timestamp: 1_000,
  message: null,
  canOpenSettings: false,
};

describe('useLocationAction', () => {
  test('does not request location on mount', () => {
    const request = jest.fn();
    renderHook(() => useLocationAction(request));
    expect(request).not.toHaveBeenCalled();
  });

  test('requests a new reading for every completed action', async () => {
    const request = jest.fn().mockResolvedValue(granted);
    const { result } = renderHook(() => useLocationAction(request));

    await act(async () => {
      await result.current.run();
      await result.current.run();
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe('success');
  });

  test('ignores duplicate taps while checking', async () => {
    let resolveRequest!: (value: CurrentLocationResult) => void;
    const request = jest.fn(
      () => new Promise<CurrentLocationResult>((resolve) => (resolveRequest = resolve))
    );
    const { result } = renderHook(() => useLocationAction(request));

    let first!: Promise<CurrentLocationResult>;
    act(() => {
      first = result.current.run();
      void result.current.run();
    });
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest(granted);
      await first;
    });
  });

  test('ignores an abandoned request after reset', async () => {
    let resolveRequest!: (value: CurrentLocationResult) => void;
    const request = jest.fn(
      () => new Promise<CurrentLocationResult>((resolve) => (resolveRequest = resolve))
    );
    const { result } = renderHook(() => useLocationAction(request));

    let pending!: Promise<CurrentLocationResult>;
    act(() => {
      pending = result.current.run();
      result.current.reset();
    });

    await act(async () => {
      resolveRequest(granted);
      await pending;
    });
    expect(result.current.state.status).toBe('idle');
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- --runInBand src/hooks/__tests__/use-location-action.test.tsx
```

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/use-location-action.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  requestCurrentLocation,
  type CurrentLocationResult,
} from '@/services/location';

export type LocationActionState =
  | { status: 'idle'; result: null }
  | { status: 'checking'; result: null }
  | { status: 'success'; result: CurrentLocationResult }
  | { status: 'error'; result: CurrentLocationResult };

type RequestLocation = typeof requestCurrentLocation;

export function useLocationAction(request: RequestLocation = requestCurrentLocation) {
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  const activeRequest = useRef<Promise<CurrentLocationResult> | null>(null);
  const [state, setState] = useState<LocationActionState>({ status: 'idle', result: null });

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const run = useCallback(
    async (options?: Parameters<RequestLocation>[0]) => {
      if (activeRequest.current) return activeRequest.current;

      const version = ++requestVersion.current;
      setState({ status: 'checking', result: null });
      const pending = request(options);
      activeRequest.current = pending;

      try {
        const result = await pending;
        if (mounted.current && requestVersion.current === version) {
          setState({
            status: result.status === 'granted' ? 'success' : 'error',
            result,
          });
        }
        return result;
      } finally {
        if (activeRequest.current === pending) activeRequest.current = null;
      }
    },
    [request]
  );

  const reset = useCallback(() => {
    requestVersion.current += 1;
    activeRequest.current = null;
    setState({ status: 'idle', result: null });
  }, []);

  return { state, run, reset };
}
```

- [ ] **Step 4: Run hook tests**

```bash
npm test -- --runInBand src/hooks/__tests__/use-location-action.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-location-action.ts src/hooks/__tests__/use-location-action.test.tsx
git commit -m "feat: add explicit location action hook"
```

## Task 5: Build the Field First UI Foundation

**Files:**

- Modify: `app.json`
- Modify: `src/constants/theme.ts`
- Create: `src/components/ui/app-text.tsx`
- Create: `src/components/ui/app-button.tsx`
- Create: `src/components/ui/app-screen.tsx`
- Create: `src/components/ui/surface-card.tsx`
- Create: `src/components/ui/screen-header.tsx`
- Create: `src/components/ui/status-pill.tsx`
- Create: `src/components/ui/feedback-state.tsx`
- Create: `src/components/ui/form-field.tsx`
- Create: `src/components/ui/__tests__/app-button.test.tsx`

- [ ] **Step 1: Write the failing button tests**

Create `src/components/ui/__tests__/app-button.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppButton } from '../app-button';

describe('AppButton', () => {
  test('exposes button semantics and runs its action', () => {
    const onPress = jest.fn();
    render(<AppButton label="Aktifkan GPS" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Aktifkan GPS' });
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('disables presses and announces busy state while loading', () => {
    const onPress = jest.fn();
    render(<AppButton label="Menyimpan" onPress={onPress} loading />);

    const button = screen.getByRole('button', { name: 'Menyimpan' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibilityState({ busy: true, disabled: true });
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- --runInBand src/components/ui/__tests__/app-button.test.tsx
```

Expected: FAIL because `AppButton` does not exist.

- [ ] **Step 3: Replace the theme with exact approved tokens**

Replace `src/constants/theme.ts` with:

```ts
import { Platform } from 'react-native';

export const Colors = {
  forest: '#1F542E',
  forestPressed: '#173F23',
  forestMuted: '#314A38',
  harvest: '#F3BF4F',
  harvestPressed: '#DDA936',
  canvas: '#F6F8F3',
  surface: '#FFFFFF',
  ink: '#203026',
  muted: '#657165',
  border: '#DFE7DC',
  successBackground: '#DCEBD8',
  successBorder: '#BDD4B8',
  successText: '#21492A',
  warningBackground: '#FFF3D8',
  warningBorder: '#EBD298',
  warningText: '#71541D',
  dangerBackground: '#FDE7E1',
  dangerBorder: '#EBC1B6',
  dangerText: '#633027',
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  input: 12,
  button: 14,
  card: 18,
  hero: 20,
  pill: 999,
} as const;

export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  smallStrong: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '800' as const },
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: 'system-ui, sans-serif', mono: 'ui-monospace, monospace' },
});
```

In `app.json`, change only these exact values:

| JSON path | Value |
| --- | --- |
| `expo.userInterfaceStyle` | `"light"` |
| `expo.android.adaptiveIcon.backgroundColor` | `"#F6F8F3"` |
| `expo.plugins[expo-splash-screen].backgroundColor` | `"#1F542E"` |
| `expo.plugins[expo-location].locationWhenInUsePermission` | `"AgroWeather memakai lokasi hanya saat Anda meminta cek kehadiran, tugas, atau titik lahan."` |

Preserve all image paths, the other plugin entries, and experiment flags.

- [ ] **Step 4: Create the text and button primitives**

Create `src/components/ui/app-text.tsx`:

```tsx
import { Text, type TextProps } from 'react-native';

import { Colors, Typography } from '@/constants/theme';

type AppTextVariant = keyof typeof Typography;

export function AppText({
  variant = 'body',
  color = Colors.ink,
  style,
  ...props
}: TextProps & { variant?: AppTextVariant; color?: string }) {
  return <Text style={[Typography[variant], { color }, style]} {...props} />;
}
```

Create `src/components/ui/app-button.tsx`:

```tsx
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

type ButtonVariant = 'primary' | 'forest' | 'secondary' | 'danger';

const palette = {
  primary: { background: Colors.harvest, pressed: Colors.harvestPressed, text: Colors.ink },
  forest: { background: Colors.forest, pressed: Colors.forestPressed, text: Colors.surface },
  secondary: { background: Colors.surface, pressed: Colors.canvas, text: Colors.forest },
  danger: { background: Colors.dangerBackground, pressed: Colors.dangerBorder, text: Colors.dangerText },
} satisfies Record<ButtonVariant, { background: string; pressed: string; text: string }>;

export function AppButton({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  ...props
}: Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  const colors = palette[variant];
  const blocked = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled: blocked }}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? colors.pressed : colors.background },
        variant === 'secondary' && styles.outline,
        blocked && styles.disabled,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <AppText variant="bodyStrong" color={colors.text}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: { borderWidth: 1, borderColor: Colors.border },
  disabled: { opacity: 0.55 },
});
```

- [ ] **Step 5: Create the remaining UI primitives**

Create `src/components/ui/app-screen.tsx`:

```tsx
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

export function AppScreen({
  children,
  scroll = true,
  contentContainerStyle,
  ...scrollProps
}: ScrollViewProps & { children: ReactNode; scroll?: boolean }) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 390 ? 20 : Spacing.five;
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: horizontalPadding },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        styles.flex,
        { paddingHorizontal: horizontalPadding },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  flex: { flex: 1 },
  content: {
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
});
```

Create `src/components/ui/surface-card.tsx`:

```tsx
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function SurfaceCard({ style, ...props }: ViewProps) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
```

Create `src/components/ui/screen-header.tsx`:

```tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { AppText } from './app-text';

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        {eyebrow ? <AppText variant="label">{eyebrow.toUpperCase()}</AppText> : null}
        <AppText variant="title">{title}</AppText>
        {description ? <AppText variant="small">{description}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  copy: { flex: 1, gap: Spacing.one },
});
```

Create `src/components/ui/status-pill.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

const tones = {
  success: [Colors.successBackground, Colors.successText],
  warning: [Colors.warningBackground, Colors.warningText],
  danger: [Colors.dangerBackground, Colors.dangerText],
  neutral: [Colors.canvas, Colors.muted],
} as const;

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: keyof typeof tones;
}) {
  const [backgroundColor, color] = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <AppText variant="label" color={color}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
```

Create `src/components/ui/feedback-state.tsx`:

```tsx
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import { AppButton } from './app-button';
import { AppText } from './app-text';

export function FeedbackState({
  title,
  message,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrapper}>
      {loading ? <ActivityIndicator color={Colors.forest} /> : null}
      <AppText variant="subtitle">{title}</AppText>
      {message ? <AppText variant="small" color={Colors.muted}>{message}</AppText> : null}
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.six },
});
```

Create `src/components/ui/form-field.tsx`:

```tsx
import { useId } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

import { AppText } from './app-text';

export function FormField({
  label,
  error,
  help,
  inputProps,
}: {
  label: string;
  error?: string | null;
  help?: string;
  inputProps: TextInputProps;
}) {
  const nativeID = useId();
  return (
    <View style={styles.wrapper}>
      <AppText nativeID={nativeID} variant="smallStrong">{label}</AppText>
      <TextInput
        accessibilityLabelledBy={nativeID}
        accessibilityState={{ disabled: Boolean(inputProps.editable === false) }}
        placeholderTextColor={Colors.muted}
        style={[styles.input, error && styles.inputError, inputProps.multiline && styles.multiline]}
        {...inputProps}
      />
      {error ? (
        <AppText variant="small" color={Colors.dangerText}>{error}</AppText>
      ) : help ? (
        <AppText variant="small" color={Colors.muted}>{help}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.two },
  input: {
    ...Typography.body,
    minHeight: 48,
    color: Colors.ink,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.input,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  inputError: { borderColor: Colors.dangerText },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
```

- [ ] **Step 6: Run foundation tests**

```bash
npm test -- --runInBand src/components/ui/__tests__/app-button.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app.json src/constants/theme.ts src/components/ui
git commit -m "feat: add Field First UI foundation"
```

## Task 6: Add the Reusable GPS Action Card

**Files:**

- Create: `src/components/domain/location-action-card.tsx`
- Create: `src/components/domain/__tests__/location-action-card.test.tsx`

- [ ] **Step 1: Write failing rendered-state tests**

Create `src/components/domain/__tests__/location-action-card.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LocationActionCard } from '../location-action-card';

describe('LocationActionCard', () => {
  test('renders an explicit idle action', () => {
    const onAction = jest.fn();
    render(
      <LocationActionCard
        state="idle"
        title="Aktifkan lokasi"
        message="Lokasi hanya diambil saat diminta."
        actionLabel="Aktifkan GPS"
        onAction={onAction}
      />
    );
    expect(screen.getByText('GPS BELUM AKTIF')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Aktifkan GPS' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('announces checking without an active button', () => {
    render(
      <LocationActionCard
        state="checking"
        title="Mencari sinyal GPS…"
        message="Pastikan lokasi perangkat menyala."
      />
    );
    expect(screen.getByText('MENGAMBIL LOKASI')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('renders settings action for a blocked permission', () => {
    render(
      <LocationActionCard
        state="danger"
        title="GPS tidak dapat digunakan"
        message="Aktifkan izin lokasi di Pengaturan."
        actionLabel="Buka Pengaturan"
        onAction={() => undefined}
      />
    );
    expect(screen.getByRole('button', { name: 'Buka Pengaturan' })).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- --runInBand src/components/domain/__tests__/location-action-card.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the card**

Create `src/components/domain/location-action-card.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';

type CardState = 'idle' | 'checking' | 'success' | 'warning' | 'danger' | 'neutral';

const stateConfig = {
  idle: { eyebrow: 'GPS BELUM AKTIF', background: Colors.forest, text: Colors.surface },
  checking: { eyebrow: 'MENGAMBIL LOKASI', background: Colors.forestMuted, text: Colors.surface },
  success: { eyebrow: 'DI DALAM RADIUS', background: Colors.successBackground, text: Colors.successText },
  warning: { eyebrow: 'PERIKSA LOKASI', background: Colors.warningBackground, text: Colors.warningText },
  danger: { eyebrow: 'LOKASI BERMASALAH', background: Colors.dangerBackground, text: Colors.dangerText },
  neutral: { eyebrow: 'STATUS LOKASI', background: Colors.surface, text: Colors.ink },
} as const;

export function LocationActionCard({
  state,
  title,
  message,
  meta,
  actionLabel,
  onAction,
}: {
  state: CardState;
  title: string;
  message: string;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const config = stateConfig[state];
  const dark = state === 'idle' || state === 'checking';

  return (
    <View style={[styles.card, { backgroundColor: config.background }]}>
      <AppText variant="label" color={config.text}>{config.eyebrow}</AppText>
      <AppText variant="subtitle" color={config.text}>{title}</AppText>
      <AppText variant="small" color={config.text}>{message}</AppText>
      {meta ? <AppText variant="label" color={config.text}>{meta}</AppText> : null}
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          variant={dark ? 'primary' : 'secondary'}
          onPress={onAction}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.hero,
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
```

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- --runInBand src/components/domain/__tests__/location-action-card.test.tsx
npm run typecheck
git add src/components/domain/location-action-card.tsx src/components/domain/__tests__/location-action-card.test.tsx
git commit -m "feat: add explicit GPS status card"
```

Expected: tests and typecheck pass before commit.

## Task 7: Split the Map Picker by Platform and Fix Coordinate Validation

**Files:**

- Modify: `src/lib/farm-validation.ts`
- Modify: `src/lib/__tests__/farm-validation.test.ts`
- Create: `src/components/domain/map-picker.types.ts`
- Create: `src/components/domain/map-picker.tsx`
- Create: `src/components/domain/map-picker.web.tsx`
- Create: `src/components/domain/__tests__/map-picker.test.tsx`
- Create: `src/components/domain/__tests__/map-picker.web.test.tsx`

- [ ] **Step 1: Add failing latitude/longitude boundary tests**

Append to `src/lib/__tests__/farm-validation.test.ts`:

```ts
test('rejects coordinates outside geographic bounds', () => {
  expect(validatePlotForm({ ...valid, latCenter: 90.01 }).latCenter).toBe(
    'Latitude harus berada di antara -90 dan 90'
  );
  expect(validatePlotForm({ ...valid, lngCenter: 180.01 }).lngCenter).toBe(
    'Longitude harus berada di antara -180 dan 180'
  );
});
```

- [ ] **Step 2: Add the bounded validation**

Replace the coordinate branches in `validatePlotForm` with:

```ts
latCenter:
  typeof values.latCenter !== 'number' || !Number.isFinite(values.latCenter)
    ? 'Latitude lahan wajib dipilih'
    : values.latCenter < -90 || values.latCenter > 90
      ? 'Latitude harus berada di antara -90 dan 90'
      : null,
lngCenter:
  typeof values.lngCenter !== 'number' || !Number.isFinite(values.lngCenter)
    ? 'Longitude lahan wajib dipilih'
    : values.lngCenter < -180 || values.lngCenter > 180
      ? 'Longitude harus berada di antara -180 dan 180'
      : null,
```

- [ ] **Step 3: Write the failing web map tests**

Create `src/components/domain/__tests__/map-picker.web.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MapPicker } from '../map-picker.web';

describe('web MapPicker', () => {
  test('does not turn an empty latitude into zero', () => {
    const onConfirm = jest.fn();
    render(<MapPicker value={null} radiusM={1000} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByLabelText('Latitude'), '');
    fireEvent.changeText(screen.getByLabelText('Longitude'), '112.76');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Masukkan koordinat yang valid.')).toBeOnTheScreen();
  });

  test('confirms only bounded coordinates', () => {
    const onConfirm = jest.fn();
    render(<MapPicker value={null} radiusM={1000} onConfirm={onConfirm} />);

    fireEvent.changeText(screen.getByLabelText('Latitude'), '-7.25');
    fireEvent.changeText(screen.getByLabelText('Longitude'), '112.76');
    fireEvent.press(screen.getByRole('button', { name: 'Pilih Titik Ini' }));

    expect(onConfirm).toHaveBeenCalledWith({ latitude: -7.25, longitude: 112.76 });
  });
});
```

- [ ] **Step 4: Create shared props**

Create `src/components/domain/map-picker.types.ts`:

```ts
import type { Coordinates } from '@/lib/geofence';

export type MapPickerProps = {
  value: Coordinates | null;
  radiusM: number;
  onConfirm: (coords: Coordinates) => void;
  requestedLocation?: Coordinates | null;
  locating?: boolean;
  locationError?: string | null;
  onRequestLocation?: () => void;
};
```

- [ ] **Step 5: Implement the web map**

Create `src/components/domain/map-picker.web.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isCoordinateInBounds } from '@/lib/location-policy';
import { Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { FormField } from '@/components/ui/form-field';
import { SurfaceCard } from '@/components/ui/surface-card';

import type { MapPickerProps } from './map-picker.types';

export function MapPicker({ value, radiusM, onConfirm }: MapPickerProps) {
  const [latitude, setLatitude] = useState(value ? String(value.latitude) : '');
  const [longitude, setLongitude] = useState(value ? String(value.longitude) : '');
  const candidate = useMemo(() => {
    if (!latitude.trim() || !longitude.trim()) return null;
    const coords = { latitude: Number(latitude), longitude: Number(longitude) };
    return isCoordinateInBounds(coords) ? coords : null;
  }, [latitude, longitude]);

  return (
    <SurfaceCard>
      <AppText variant="subtitle">Koordinat Lahan</AppText>
      <AppText variant="small">Peta native tidak tersedia di web. Isi koordinat manual.</AppText>
      <View style={styles.fields}>
        <FormField
          label="Latitude"
          inputProps={{
            accessibilityLabel: 'Latitude',
            value: latitude,
            onChangeText: setLatitude,
            keyboardType: 'numbers-and-punctuation',
          }}
        />
        <FormField
          label="Longitude"
          inputProps={{
            accessibilityLabel: 'Longitude',
            value: longitude,
            onChangeText: setLongitude,
            keyboardType: 'numbers-and-punctuation',
          }}
        />
      </View>
      {!candidate ? (
        <AppText variant="small">Masukkan koordinat yang valid.</AppText>
      ) : (
        <AppText variant="small">Radius kehadiran: {radiusM} meter.</AppText>
      )}
      <AppButton
        label="Pilih Titik Ini"
        onPress={() => candidate && onConfirm(candidate)}
        disabled={!candidate}
      />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({ fields: { gap: Spacing.three } });
```

- [ ] **Step 6: Implement the native fixed-center map**

Create `src/components/domain/map-picker.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, type Region } from 'react-native-maps';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';

import type { MapPickerProps } from './map-picker.types';

const DEFAULT_REGION: Region = {
  latitude: -7.250445,
  longitude: 112.768845,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export function MapPicker({
  value,
  radiusM,
  onConfirm,
  requestedLocation,
  locating,
  locationError,
  onRequestLocation,
}: MapPickerProps) {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({
    ...DEFAULT_REGION,
    latitude: value?.latitude ?? DEFAULT_REGION.latitude,
    longitude: value?.longitude ?? DEFAULT_REGION.longitude,
  });
  const candidate = useMemo(
    () => ({ latitude: region.latitude, longitude: region.longitude }),
    [region.latitude, region.longitude]
  );

  useEffect(() => {
    if (!requestedLocation) return;
    setRegion((current) => {
      const next = { ...current, ...requestedLocation };
      mapRef.current?.animateToRegion(next, 350);
      return next;
    });
  }, [requestedLocation]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.mapShell}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
        >
          <Circle
            center={candidate}
            radius={radiusM}
            fillColor="rgba(31,84,46,0.12)"
            strokeColor={Colors.forest}
            strokeWidth={2}
          />
        </MapView>
        <View pointerEvents="none" style={styles.crosshair}>
          <AppText variant="title" color={Colors.forest}>＋</AppText>
        </View>
      </View>
      {locationError ? <AppText variant="small" color={Colors.dangerText}>{locationError}</AppText> : null}
      {onRequestLocation ? (
        <AppButton
          label={locating ? 'Mencari Lokasi…' : 'Gunakan Lokasi Saya'}
          variant="secondary"
          loading={locating}
          onPress={onRequestLocation}
        />
      ) : null}
      <AppText variant="small" color={Colors.muted}>
        Geser peta sampai tanda plus tepat di lokasi lahan.
      </AppText>
      <AppButton label="Pilih Titik Ini" onPress={() => onConfirm(candidate)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.three },
  mapShell: {
    height: 280,
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderColor: Colors.border,
    borderWidth: 1,
  },
  crosshair: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 7: Test that native GPS only changes the viewport candidate**

Create `src/components/domain/__tests__/map-picker.test.tsx`. Mock `react-native-maps` with a `forwardRef` view whose imperative handle exposes `animateToRegion: jest.fn()`, and render `Circle` as `null`. Then add:

```tsx
test('does not request or confirm a coordinate on mount or GPS recenter', () => {
  const onRequestLocation = jest.fn();
  const onConfirm = jest.fn();
  const { rerender } = render(
    <MapPicker
      value={null}
      radiusM={1000}
      onConfirm={onConfirm}
      onRequestLocation={onRequestLocation}
    />
  );

  expect(onRequestLocation).not.toHaveBeenCalled();
  expect(onConfirm).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Gunakan Lokasi Saya' }));
  expect(onRequestLocation).toHaveBeenCalledTimes(1);

  rerender(
    <MapPicker
      value={null}
      radiusM={1000}
      requestedLocation={{ latitude: -7.25, longitude: 112.76 }}
      onConfirm={onConfirm}
      onRequestLocation={onRequestLocation}
    />
  );
  expect(onConfirm).not.toHaveBeenCalled();

  fireEvent.press(screen.getByRole('button', { name: 'Pilih Titik Ini' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 8: Run tests and bundles**

```bash
npm test -- --runInBand src/lib/__tests__/farm-validation.test.ts src/components/domain/__tests__/map-picker.test.tsx src/components/domain/__tests__/map-picker.web.test.tsx
npm run typecheck
npx expo export --platform web --output-dir /private/tmp/agroweather-map-web
```

Expected: tests, typecheck, and web export pass with no `react-native-maps` import error.

- [ ] **Step 9: Commit**

```bash
git add src/lib/farm-validation.ts src/lib/__tests__/farm-validation.test.ts src/components/domain/map-picker*
git commit -m "feat: add explicit cross-platform plot mapping"
```

## Task 8: Move Plot Editing to a Full-Screen Route

**Files:**

- Create: `src/app/(app)/penataan-lahan/form.tsx`
- Modify: `src/app/(app)/penataan-lahan.tsx`
- Modify: `src/app/(app)/_layout.tsx`

- [ ] **Step 1: Add route-level behavior tests through pure helpers**

In `src/lib/farm-validation.ts`, export this helper and test it in the existing test file:

```ts
export function plotFormIsDirty(current: PlotFormValues, initial: PlotFormValues): boolean {
  return JSON.stringify(current) !== JSON.stringify(initial);
}
```

Test:

```ts
test('detects dirty plot forms', () => {
  expect(plotFormIsDirty(valid, valid)).toBe(false);
  expect(plotFormIsDirty({ ...valid, namaLahan: 'Nama Baru' }, valid)).toBe(true);
});
```

Run the test first and confirm it fails before adding the helper.

- [ ] **Step 2: Create the full-screen form**

Create `src/app/(app)/penataan-lahan/form.tsx` with this orchestration:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import { MapPicker } from '@/components/domain/map-picker';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Spacing } from '@/constants/theme';
import { useLocationAction } from '@/hooks/use-location-action';
import type { PlotFormErrors, PlotFormValues } from '@/lib/farm-types';
import { validatePlotForm, plotFormIsDirty } from '@/lib/farm-validation';
import { hasErrors } from '@/lib/validation';
import { fetchFarmers } from '@/services/auth';
import { createPlot, fetchPlotById, updatePlot } from '@/services/plots';
import type { AppUser } from '@/services/supabase';

const EMPTY_FORM: PlotFormValues = {
  namaLahan: '',
  farmerId: null,
  luasHektar: '',
  jenisTanaman: '',
  faseLahan: '',
  latCenter: null,
  lngCenter: null,
  radiusGeofenceM: 1000,
};

const EMPTY_ERRORS: PlotFormErrors = {
  namaLahan: null,
  luasHektar: null,
  jenisTanaman: null,
  faseLahan: null,
  latCenter: null,
  lngCenter: null,
  radiusGeofenceM: null,
};

export default function PlotFormScreen() {
  const { plotId } = useLocalSearchParams<{ plotId?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const location = useLocationAction();
  const [farmers, setFarmers] = useState<AppUser[]>([]);
  const [initial, setInitial] = useState<PlotFormValues>(EMPTY_FORM);
  const [form, setForm] = useState<PlotFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<PlotFormErrors>(EMPTY_ERRORS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => plotFormIsDirty(form, initial), [form, initial]);

  useEffect(() => {
    let active = true;
    async function loadForm() {
      setLoading(true);
      setLoadError(null);
      try {
        const [nextFarmers, plot] = await Promise.all([
          fetchFarmers(),
          plotId ? fetchPlotById(plotId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setFarmers(nextFarmers);
        if (plot) {
          const values: PlotFormValues = {
            namaLahan: plot.namaLahan,
            farmerId: plot.farmerId,
            luasHektar: plot.luasHektar === null ? '' : String(plot.luasHektar),
            jenisTanaman: plot.jenisTanaman,
            faseLahan: plot.faseLahan ?? '',
            latCenter: plot.latCenter,
            lngCenter: plot.lngCenter,
            radiusGeofenceM: plot.radiusGeofenceM,
          };
          setInitial(values);
          setForm(values);
        }
      } catch {
        if (active) {
          setLoadError('Form lahan belum dapat dimuat. Periksa koneksi lalu coba lagi.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadForm();
    return () => { active = false; };
  }, [loadAttempt, plotId]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (!dirty || saving) return;
      event.preventDefault();
      Alert.alert('Buang perubahan?', 'Perubahan yang belum disimpan akan hilang.', [
        { text: 'Tetap di sini', style: 'cancel' },
        { text: 'Buang', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
      ]);
    });
  }, [dirty, navigation, saving]);

  const setField = useCallback(<K extends keyof PlotFormValues>(key: K, value: PlotFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  async function handleSave() {
    const nextErrors = validatePlotForm(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    setSaving(true);
    try {
      if (plotId) await updatePlot(plotId, form);
      else await createPlot(form);
      setInitial(form);
      router.replace('/(app)/penataan-lahan');
    } catch {
      Alert.alert('Lahan belum tersimpan', 'Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  const grantedLocation =
    location.state.result?.status === 'granted' ? location.state.result.coords : null;

  if (loading) {
    return (
      <AppScreen scroll={false}>
        <FeedbackState title="Memuat form lahan…" loading />
      </AppScreen>
    );
  }

  if (loadError) {
    return (
      <AppScreen scroll={false}>
        <FeedbackState
          title="Form lahan belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => setLoadAttempt((attempt) => attempt + 1)}
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Penataan Lahan"
        title={plotId ? 'Edit Lahan' : 'Tambah Lahan'}
        description="Lengkapi data dan konfirmasi titik lahan."
      />

      <SurfaceCard>
        <AppText variant="subtitle">Informasi Lahan</AppText>
        <FormField label="Nama Lahan" error={errors.namaLahan} inputProps={{
          value: form.namaLahan,
          onChangeText: (value) => setField('namaLahan', value),
          placeholder: 'Contoh: Sawah Utara',
        }} />
        <FormField label="Luas Lahan (ha)" error={errors.luasHektar} inputProps={{
          value: form.luasHektar,
          onChangeText: (value) => setField('luasHektar', value),
          keyboardType: 'decimal-pad',
          placeholder: 'Contoh: 2.5',
        }} />
        <FormField label="Jenis Tanaman" error={errors.jenisTanaman} inputProps={{
          value: form.jenisTanaman,
          onChangeText: (value) => setField('jenisTanaman', value),
          placeholder: 'Contoh: Padi',
        }} />
        <FormField label="Fase Lahan" error={errors.faseLahan} inputProps={{
          value: form.faseLahan,
          onChangeText: (value) => setField('faseLahan', value),
          placeholder: 'Contoh: Penyiraman',
        }} />
      </SurfaceCard>

      <SurfaceCard>
        <AppText variant="subtitle">Petani Penanggung Jawab</AppText>
        <View style={styles.chips}>
          <Pressable onPress={() => setField('farmerId', null)} style={styles.chip}>
            <AppText variant="smallStrong">Belum assign</AppText>
          </Pressable>
          {farmers.map((farmer) => (
            <Pressable
              key={farmer.id}
              onPress={() => setField('farmerId', farmer.id)}
              style={[styles.chip, form.farmerId === farmer.id && styles.chipSelected]}
            >
              <AppText
                variant="smallStrong"
                color={form.farmerId === farmer.id ? Colors.surface : Colors.ink}
              >
                {farmer.nama}
              </AppText>
            </Pressable>
          ))}
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <AppText variant="subtitle">Lokasi Lahan</AppText>
        <MapPicker
          value={
            form.latCenter !== null && form.lngCenter !== null
              ? { latitude: form.latCenter, longitude: form.lngCenter }
              : null
          }
          radiusM={form.radiusGeofenceM}
          requestedLocation={grantedLocation}
          locating={location.state.status === 'checking'}
          locationError={
            location.state.status === 'error' ? location.state.result.message : null
          }
          onRequestLocation={() => void location.run()}
          onConfirm={(coords) => {
            setField('latCenter', coords.latitude);
            setField('lngCenter', coords.longitude);
          }}
        />
        {errors.latCenter || errors.lngCenter ? (
          <AppText variant="small" color={Colors.dangerText}>
            {errors.latCenter ?? errors.lngCenter}
          </AppText>
        ) : null}
      </SurfaceCard>

      <AppButton
        label={plotId ? 'Simpan Perubahan' : 'Simpan Lahan'}
        loading={saving}
        onPress={handleSave}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.canvas,
  },
  chipSelected: { backgroundColor: Colors.forest },
});
```

- [ ] **Step 3: Convert the plot list screen to navigation-only editing**

Remove the modal and all form state from `src/app/(app)/penataan-lahan.tsx`. Use:

```tsx
<AppButton
  label="Tambah Lahan"
  onPress={() => router.push('/(app)/penataan-lahan/form')}
/>
```

and edit actions:

```tsx
onEdit={() =>
  router.push({
    pathname: '/(app)/penataan-lahan/form',
    params: { plotId: plot.id },
  })
}
```

Keep load, retry, metrics, and status mutation in the list screen.

- [ ] **Step 4: Declare the route**

Add to `src/app/(app)/_layout.tsx`:

```tsx
<Stack.Screen
  name="penataan-lahan/form"
  options={{ title: 'Form Lahan', presentation: 'card' }}
/>
```

- [ ] **Step 5: Run focused verification**

```bash
npm test -- --runInBand src/lib/__tests__/farm-validation.test.ts
npm run typecheck
npm run lint
```

Expected: PASS with no warnings from plot form or map picker.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(app)'/penataan-lahan.tsx src/app/'(app)'/penataan-lahan/form.tsx src/app/'(app)'/_layout.tsx src/lib/farm-validation.ts src/lib/__tests__/farm-validation.test.ts
git commit -m "feat: move plot editing to a full-screen flow"
```

## Task 9: Add Plot and Task Domain Cards

**Files:**

- Create: `src/components/domain/plot-card.tsx`
- Create: `src/components/domain/plot-stats.tsx`
- Create: `src/components/domain/task-card.tsx`
- Create: `src/components/domain/__tests__/plot-card.test.tsx`
- Create: `src/components/domain/__tests__/task-card.test.tsx`

- [ ] **Step 1: Write failing card behavior tests**

Create the two test files with typed `FarmPlot` and `FarmTask` fixtures. The assertions are:

```tsx
test('plot card exposes edit and status actions', () => {
  const onEdit = jest.fn();
  const onToggleStatus = jest.fn();
  render(<PlotCard plot={plot} onEdit={onEdit} onToggleStatus={onToggleStatus} />);

  expect(screen.getByText('Sawah A')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('button', { name: 'Edit Sawah A' }));
  fireEvent.press(screen.getByRole('button', { name: 'Nonaktifkan Sawah A' }));
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onToggleStatus).toHaveBeenCalledTimes(1);
});

test('task card announces that location must be checked', () => {
  render(
    <TaskCard
      task={task}
      plotName="Sawah A"
      state="check-location"
      radiusM={750}
      onPress={() => undefined}
    />
  );

  expect(screen.getByText('Perlu cek lokasi')).toBeOnTheScreen();
  expect(screen.getByText('Radius lahan: 750 meter')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Buka tugas Bersihkan saluran' })).toBeOnTheScreen();
});
```

Run:

```bash
npm test -- --runInBand src/components/domain/__tests__/plot-card.test.tsx src/components/domain/__tests__/task-card.test.tsx
```

Expected: FAIL because the cards do not exist.

- [ ] **Step 2: Implement `PlotStats`**

```tsx
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { AppText } from '@/components/ui/app-text';
import { SurfaceCard } from '@/components/ui/surface-card';

export function PlotStats({ total, active, assigned }: { total: number; active: number; assigned: number }) {
  return (
    <View style={styles.row}>
      {[
        ['Total', total],
        ['Aktif', active],
        ['Petani', assigned],
      ].map(([label, value]) => (
        <SurfaceCard key={String(label)} style={styles.card}>
          <AppText variant="title">{String(value)}</AppText>
          <AppText variant="small">{String(label)}</AppText>
        </SurfaceCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  card: { flex: 1, alignItems: 'center', padding: Spacing.three },
});
```

- [ ] **Step 3: Implement `PlotCard`**

Create `src/components/domain/plot-card.tsx` with this public API:

```ts
type PlotCardProps = {
  plot: FarmPlot;
  onEdit: () => void;
  onToggleStatus: () => void;
};
```

The outer card uses `accessibilityLabel={`Lahan ${plot.namaLahan}`}`. Give the actions these exact accessible labels:

```tsx
accessibilityLabel={`Edit ${plot.namaLahan}`}
accessibilityLabel={`${plot.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'} ${plot.namaLahan}`}
```

The complete rendered content must include:

```tsx
<SurfaceCard>
  <View style={styles.header}>
    <View style={styles.copy}>
      <AppText variant="subtitle">{plot.namaLahan}</AppText>
      <AppText variant="small" color={Colors.muted}>
        {plot.jenisTanaman} · {plot.faseLahan ?? 'Fase belum dicatat'}
      </AppText>
    </View>
    <StatusPill
      label={plot.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
      tone={plot.status === 'aktif' ? 'success' : 'danger'}
    />
  </View>
  <AppText variant="small">Petani: {plot.farmerName ?? 'Belum diassign'}</AppText>
  <AppText variant="small">Luas: {plot.luasHektar ?? '-'} ha</AppText>
  <AppText variant="small">Radius: {plot.radiusGeofenceM} meter</AppText>
  <AppText variant="small" color={Colors.muted}>
    {plot.latCenter.toFixed(5)}, {plot.lngCenter.toFixed(5)}
  </AppText>
  <View style={styles.actions}>
    <AppButton label="Edit" variant="secondary" onPress={onEdit} />
    <AppButton
      label={plot.status === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
      variant={plot.status === 'aktif' ? 'danger' : 'forest'}
      onPress={onToggleStatus}
    />
  </View>
</SurfaceCard>
```

Use `header`, `copy`, and `actions` styles with `flexDirection: 'row'`, `gap: Spacing.two`, and `copy: { flex: 1 }`.

- [ ] **Step 4: Implement `TaskCard`**

Use this public API:

```ts
type TaskCardState = 'ready' | 'check-location' | 'outside' | 'completed';
type TaskCardProps = {
  task: FarmTask;
  plotName: string;
  state: TaskCardState;
  radiusM?: number;
  onPress: () => void;
};
```

Map states exactly:

```ts
const taskState = {
  ready: { label: 'Siap', tone: 'success' },
  'check-location': { label: 'Perlu cek lokasi', tone: 'warning' },
  outside: { label: 'Di luar radius', tone: 'danger' },
  completed: { label: 'Selesai', tone: 'neutral' },
} as const;
```

The card renders title, plot name, deadline when present, actual radius as `Radius lahan: ${radiusM} meter` when outside/checking, status pill, and a 44-point press target with:

```tsx
accessibilityRole="button"
accessibilityLabel={`Buka tugas ${task.judul}`}
```

- [ ] **Step 5: Integrate cards into plot list and run checks**

Replace inline plot-card JSX in `penataan-lahan.tsx` with `PlotStats` and `PlotCard`.

Run:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand src/components/domain/__tests__/plot-card.test.tsx src/components/domain/__tests__/task-card.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/domain/plot-card.tsx src/components/domain/plot-stats.tsx src/components/domain/task-card.tsx src/components/domain/__tests__/plot-card.test.tsx src/components/domain/__tests__/task-card.test.tsx src/app/'(app)'/penataan-lahan.tsx
git commit -m "feat: add reusable plot and task cards"
```

## Task 10: Rewrite the Farmer Dashboard with Explicit Attendance GPS

**Files:**

- Modify: `src/app/(app)/petani.tsx`
- Create: `src/app/(app)/__tests__/petani.test.tsx`

- [ ] **Step 1: Write the failing interaction test**

Create `src/app/(app)/__tests__/petani.test.tsx`. Mock `@/services/auth-context`, `@/services/plots`, `@/services/tasks`, `@/services/attendance`, and `@/services/location` at module level, then bind each exported mock with `jest.mocked`. Return a farmer profile and a `logout` mock from `useAuth`. The key test:

```tsx
test('does not request GPS until the farmer presses the location action', async () => {
  mockedFetchAssignedPlots.mockResolvedValue([plot]);
  mockedFetchFarmerTasks.mockResolvedValue([]);
  mockedRequestCurrentLocation.mockResolvedValue(grantedLocation);

  render(<PetaniDashboard />);

  await screen.findByText('Aktifkan lokasi');
  expect(mockedRequestCurrentLocation).not.toHaveBeenCalled();

  fireEvent.press(
    screen.getByRole('button', { name: 'Aktifkan GPS & Cek Kehadiran' })
  );

  await waitFor(() => expect(mockedRequestCurrentLocation).toHaveBeenCalledTimes(1));
});
```

Also add:

```tsx
test('checks attendance against the nearest active plot only', async () => {
  mockedFetchAssignedPlots.mockResolvedValue([farPlot, nearPlot]);
  mockedFetchFarmerTasks.mockResolvedValue([]);
  mockedRequestCurrentLocation.mockResolvedValue(grantedLocation);
  render(<PetaniDashboard />);

  fireEvent.press(await screen.findByRole('button', {
    name: 'Aktifkan GPS & Cek Kehadiran',
  }));

  await waitFor(() =>
    expect(mockedCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({ plot: nearPlot })
    )
  );
  expect(mockedCheckIn).toHaveBeenCalledTimes(1);
});

test('renders an attendance network failure separately from GPS success', async () => {
  mockedFetchAssignedPlots.mockResolvedValue([nearPlot]);
  mockedFetchFarmerTasks.mockResolvedValue([]);
  mockedRequestCurrentLocation.mockResolvedValue(grantedLocation);
  mockedCheckIn.mockRejectedValue(new Error('offline'));
  render(<PetaniDashboard />);

  fireEvent.press(await screen.findByRole('button', {
    name: 'Aktifkan GPS & Cek Kehadiran',
  }));

  expect(
    await screen.findByText('GPS berhasil, tetapi absensi belum tersimpan. Coba lagi.')
  ).toBeOnTheScreen();
  expect(screen.queryByText('GPS tidak dapat digunakan')).toBeNull();
});
```

- [ ] **Step 2: Verify the tests fail**

```bash
npm test -- --runInBand 'src/app/(app)/__tests__/petani.test.tsx'
```

Expected: FAIL because the current dashboard requests GPS during `loadDashboard`.

- [ ] **Step 3: Refactor dashboard data loading**

Change initial loading to:

```ts
const loadDashboard = useCallback(async () => {
  if (!profile) return;
  setLoadError(null);
  try {
    const [nextPlots, nextTasks] = await Promise.all([
      fetchAssignedPlots(profile.id),
      fetchFarmerTasks(profile.id),
    ]);
    setPlots(nextPlots);
    setTasks(nextTasks);
  } catch {
    setLoadError('Dashboard belum dapat dimuat. Periksa koneksi lalu coba lagi.');
  } finally {
    setLoading(false);
  }
}, [profile]);
```

Do not import or call `requestCurrentLocation` from this callback.

- [ ] **Step 4: Add the explicit attendance action**

Use `useLocationAction` and:

```ts
async function handleCheckAttendance() {
  const result = await locationAction.run({ maxAccuracyM: 200 });
  if (result.status !== 'granted') return;

  const nearest = findNearestActivePlot(plots, result.coords);
  if (!nearest) {
    setAttendanceOutcome({ kind: 'no-plot' });
    return;
  }

  const readingIssue = validateLocationReading(
    {
      ...result.coords,
      accuracyM: result.accuracyM,
      timestamp: result.timestamp,
    },
    nearest.plot.radiusGeofenceM
  );
  if (readingIssue) {
    setAttendanceOutcome({ kind: 'low-accuracy', plot: nearest.plot });
    return;
  }

  try {
    const checkIn = await checkInIfInsideRadius({
      farmerId: profile!.id,
      plot: nearest.plot,
      userLocation: result.coords,
    });
    setAttendanceOutcome({ kind: 'checked', plot: nearest.plot, checkIn });
  } catch {
    setAttendanceOutcome({
      kind: 'network-error',
      plot: nearest.plot,
      message: 'GPS berhasil, tetapi absensi belum tersimpan. Coba lagi.',
    });
  }
}
```

Render a `LocationActionCard` whose idle action is exactly `Aktifkan GPS & Cek Kehadiran`. Checking, granted-inside, granted-outside, permission, low-accuracy, and network states must have different copy. `Buka Pengaturan` calls `openLocationSettings`.

- [ ] **Step 5: Group tasks without claiming they are “today”**

Use heading `Tugas Saya`.

Before a location check:

- `selesai` → `completed`.
- `requiresLocation` → `check-location`.
- non-location → `ready`.

After a successful check, derive ready/outside for each task from its matching plot and the latest dashboard result. Keep task-detail revalidation regardless of dashboard state.

- [ ] **Step 6: Compose the screen with approved primitives**

The JSX order is:

```tsx
<AppScreen>
  <ScreenHeader
    eyebrow="Dashboard Petani"
    title={`Pagi, ${profile?.nama ?? 'Petani'}`}
    description="Cek lokasi sebelum memulai pekerjaan lapangan."
    action={<AppButton label="Keluar" variant="secondary" onPress={handleLogout} />}
  />
  <LocationActionCard {...locationCardProps} />
  <View style={styles.metrics}>
    <SurfaceCard style={styles.metric}>
      <AppText variant="title">{plots.filter(isActive).length}</AppText>
      <AppText variant="small">Lahan aktif</AppText>
    </SurfaceCard>
    <SurfaceCard style={styles.metric}>
      <AppText variant="title">{tasks.length}</AppText>
      <AppText variant="small">Total tugas</AppText>
    </SurfaceCard>
  </View>
  <View>
    <AppText variant="subtitle">Tugas Saya</AppText>
    {tasks.map((task) => <TaskCard key={task.id} {...taskCardProps(task)} />)}
  </View>
</AppScreen>
```

Add:

```ts
const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', gap: Spacing.two },
  metric: { flex: 1, alignItems: 'center' },
});
```

When there are no tasks, use `FeedbackState` with title `Belum ada tugas`.

- [ ] **Step 7: Run tests and commit**

```bash
npm test -- --runInBand 'src/app/(app)/__tests__/petani.test.tsx' src/lib/__tests__/location-policy.test.ts
npm run typecheck
npm run lint
git add src/app/'(app)'/petani.tsx src/app/'(app)'/__tests__/petani.test.tsx
git commit -m "feat: require explicit GPS for farmer attendance"
```

Expected: all commands pass.

## Task 11: Rewrite Task Detail with Unlock and Submission Recheck

**Files:**

- Modify: `src/app/(app)/task/[id].tsx`
- Move: `src/components/evidence-picker.tsx` → `src/components/domain/evidence-picker.tsx`
- Create: `src/app/(app)/task/__tests__/task-detail.test.tsx`

- [ ] **Step 1: Write failing behavior tests**

Tests must cover:

```tsx
test('does not request GPS while loading task detail', async () => {
  render(<TaskDetailScreen />);
  await screen.findByText('Periksa Lokasi Task');
  expect(mockedRequestCurrentLocation).not.toHaveBeenCalled();
});

test('requests GPS once to unlock and again before upload', async () => {
  mockedRequestCurrentLocation
    .mockResolvedValueOnce(grantedInside)
    .mockResolvedValueOnce(grantedInside);
  render(<TaskDetailScreen />);

  fireEvent.press(await screen.findByRole('button', { name: 'Periksa Lokasi Task' }));
  await screen.findByText('Task siap dikerjakan');

  fireEvent.press(screen.getByRole('button', { name: 'Periksa GPS & Kirim Bukti' }));
  await waitFor(() => expect(mockedRequestCurrentLocation).toHaveBeenCalledTimes(2));
});

test('keeps the draft and skips upload when the second reading is outside', async () => {
  mockedRequestCurrentLocation
    .mockResolvedValueOnce(grantedInside)
    .mockResolvedValueOnce(grantedOutside);
  render(<TaskDetailScreen />);

  fireEvent.press(await screen.findByRole('button', { name: 'Periksa Lokasi Task' }));
  fireEvent.changeText(screen.getByLabelText('Catatan Bukti'), 'Saluran sudah bersih');
  fireEvent.press(screen.getByRole('button', { name: 'Periksa GPS & Kirim Bukti' }));

  await screen.findByText('Lokasi berubah. Bukti belum dikirim.');
  expect(screen.getByDisplayValue('Saluran sudah bersih')).toBeOnTheScreen();
  expect(mockedUploadEvidence).not.toHaveBeenCalled();
});

test('shows a normal submit action without GPS for a non-location task', async () => {
  mockedFetchTaskDetail.mockResolvedValue({ ...task, requiresLocation: false });
  render(<TaskDetailScreen />);

  await screen.findByRole('button', { name: 'Kirim Bukti' });
  expect(screen.queryByRole('button', { name: 'Periksa Lokasi Task' })).toBeNull();
  expect(mockedRequestCurrentLocation).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify failure**

```bash
npm test -- --runInBand 'src/app/(app)/task/__tests__/task-detail.test.tsx'
```

Expected: FAIL because current detail requests location on load and does not recheck before upload.

- [ ] **Step 3: Separate data load from location**

Load only:

```ts
const nextTask = await fetchTaskDetail(taskId);
const [nextPlot, nextEvidenceCount] = await Promise.all([
  fetchPlotById(nextTask.lahanId),
  countTaskEvidence(nextTask.id),
]);
setUnlocked(!nextTask.requiresLocation);
```

Remove `requestCurrentLocation()` from `loadDetail`.
For a non-location task, omit `LocationActionCard` entirely and show the evidence controls immediately.

- [ ] **Step 4: Add an unlock function**

Import:

```ts
import {
  accuracyLimitForRadius,
  validateLocationReading,
} from '@/lib/location-policy';
```

Add:

```ts
const [unlockLocationError, setUnlockLocationError] = useState<string | null>(null);
```

```ts
async function handleUnlock() {
  if (!task || !plot) return;
  setUnlockLocationError(null);
  if (!task.requiresLocation) {
    setUnlocked(true);
    return;
  }

  const result = await locationAction.run({
    maxAccuracyM: accuracyLimitForRadius(plot.radiusGeofenceM),
  });
  if (result.status !== 'granted') return;

  const readingIssue = validateLocationReading(
    {
      ...result.coords,
      accuracyM: result.accuracyM,
      timestamp: result.timestamp,
    },
    plot.radiusGeofenceM
  );
  if (readingIssue) {
    setUnlockLocationError(
      'Akurasi GPS belum cukup baik. Pindah ke area terbuka lalu periksa lagi.'
    );
    return;
  }

  const nextGeofence = evaluateGeofence({
    user: result.coords,
    plot: {
      latitude: plot.latCenter,
      longitude: plot.lngCenter,
      radiusMeters: plot.radiusGeofenceM,
    },
  });
  setUnlockReading(result);
  setGeofence(nextGeofence);
  setUnlocked(nextGeofence.unlocked);
}
```

- [ ] **Step 5: Recheck immediately before upload**

At the start of submit:

```ts
let submissionLocation = unlockReading;
if (task.requiresLocation) {
  const fresh = await requestCurrentLocation({
    maxAccuracyM: accuracyLimitForRadius(plot.radiusGeofenceM),
  });
  if (fresh.status !== 'granted') {
    setSubmitLocationError(fresh.message);
    return;
  }
  const readingIssue = validateLocationReading(
    {
      ...fresh.coords,
      accuracyM: fresh.accuracyM,
      timestamp: fresh.timestamp,
    },
    plot.radiusGeofenceM
  );
  if (readingIssue) {
    setSubmitLocationError(
      'Akurasi GPS berubah. Bukti belum dikirim; pindah ke area terbuka lalu coba lagi.'
    );
    return;
  }
  const freshGeofence = evaluateGeofence({
    user: fresh.coords,
    plot: {
      latitude: plot.latCenter,
      longitude: plot.lngCenter,
      radiusMeters: plot.radiusGeofenceM,
    },
  });
  if (!freshGeofence.unlocked) {
    setSubmitLocationError('Lokasi berubah. Bukti belum dikirim.');
    return;
  }
  submissionLocation = fresh;
}
```

Use `submissionLocation` for evidence latitude and longitude. Do not clear `asset` or `note` on failure.

- [ ] **Step 6: Replace the screen hierarchy**

Use:

```tsx
<AppScreen>
  <ScreenHeader eyebrow="Detail Tugas" title={task.judul} description={`${plot.namaLahan} · ${plot.jenisTanaman}`} />
  <LocationActionCard {...taskLocationCardProps} />
  <SurfaceCard>
    <AppText variant="subtitle">Instruksi</AppText>
    <AppText>{task.deskripsi ?? 'Kerjakan sesuai arahan internal.'}</AppText>
  </SurfaceCard>
  {unlocked ? (
    <>
      <EvidencePicker asset={asset} onChange={setAsset} disabled={submitting} />
      <FormField label="Catatan Bukti" inputProps={{
        accessibilityLabel: 'Catatan Bukti',
        value: note,
        onChangeText: setNote,
        multiline: true,
      }} />
      <AppButton
        label={task.requiresLocation ? 'Periksa GPS & Kirim Bukti' : 'Kirim Bukti'}
        loading={submitting}
        onPress={handleSubmit}
      />
    </>
  ) : null}
</AppScreen>
```

Remove the misleading `Analisis AI MVP` card from the active task workflow.
Move the picker and update the import:

```bash
git mv src/components/evidence-picker.tsx src/components/domain/evidence-picker.tsx
```

```ts
import { EvidencePicker, type EvidenceAsset } from '@/components/domain/evidence-picker';
```

- [ ] **Step 7: Run tests and commit**

```bash
npm test -- --runInBand 'src/app/(app)/task/__tests__/task-detail.test.tsx'
npm run typecheck
npm run lint
git add src/app/'(app)'/task/'[id].tsx' src/app/'(app)'/task/__tests__/task-detail.test.tsx src/components/evidence-picker.tsx src/components/domain/evidence-picker.tsx
git commit -m "feat: revalidate GPS before task evidence upload"
```

Expected: PASS.

## Task 12: Rewrite Internal Dashboard and Plot List

**Files:**

- Modify: `src/app/(app)/pegawai.tsx`
- Modify: `src/app/(app)/penataan-lahan.tsx`

- [ ] **Step 1: Replace hardcoded internal placeholders with real metrics**

Load `fetchPlots()` and `fetchFarmers()` on the internal dashboard. Compute:

```ts
const metrics = {
  plots: plots.length,
  activePlots: plots.filter((plot) => plot.status === 'aktif').length,
  assignedFarmers: new Set(plots.map((plot) => plot.farmerId).filter(Boolean)).size,
};
```

Do not render weather, verification, activity, or assignment cards until those flows have real data/actions.

- [ ] **Step 2: Compose the internal dashboard**

```tsx
<AppScreen>
  <ScreenHeader
    eyebrow="Dashboard Internal"
    title={`Pagi, ${profile?.nama ?? 'Internal'}`}
    description="Pantau lahan dan penanggung jawab lapangan."
    action={<AppButton label="Keluar" variant="secondary" onPress={handleLogout} />}
  />
  <PlotStats
    total={metrics.plots}
    active={metrics.activePlots}
    assigned={metrics.assignedFarmers}
  />
  <SurfaceCard style={{ backgroundColor: Colors.forest }}>
    <AppText variant="subtitle" color={Colors.surface}>Penataan Lahan</AppText>
    <AppText variant="small" color={Colors.surface}>
      Kelola titik, radius, komoditas, dan petani penanggung jawab.
    </AppText>
    <AppButton label="Kelola Lahan" onPress={() => router.push('/(app)/penataan-lahan')} />
  </SurfaceCard>
</AppScreen>
```

Render `FeedbackState` for loading and network failure.

- [ ] **Step 3: Finish plot-list states**

Use:

- `FeedbackState` with `Memuat data lahan…` while loading.
- `FeedbackState` with `Belum ada lahan` when empty.
- `FeedbackState` with `Data lahan belum tersedia` and `Coba Lagi` on error.
- `PlotStats` and `PlotCard` for loaded data.

Keep the existing confirmation before status toggles.

- [ ] **Step 4: Run checks and commit**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
git add src/app/'(app)'/pegawai.tsx src/app/'(app)'/penataan-lahan.tsx
git commit -m "feat: redesign internal plot operations"
```

Expected: PASS.

## Task 13: Rewrite Login, Headers, and Role Guards

**Files:**

- Create: `src/components/domain/role-guard.tsx`
- Create: `src/components/domain/__tests__/role-guard.test.tsx`
- Modify: `src/app/index.tsx`
- Modify: `src/app/login.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/(app)/index.tsx`
- Modify: `src/app/(app)/_layout.tsx`
- Modify: `src/app/(app)/petani.tsx`
- Modify: `src/app/(app)/pegawai.tsx`
- Modify: `src/app/(app)/penataan-lahan.tsx`
- Modify: `src/app/(app)/penataan-lahan/form.tsx`
- Modify: `src/app/(app)/task/[id].tsx`
- Delete: `src/app/register.tsx` if it is still present in Git.

- [ ] **Step 1: Write failing role-boundary tests**

Create `src/components/domain/__tests__/role-guard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useAuth } from '@/services/auth-context';

import { RoleGuard } from '../role-guard';

jest.mock('@/services/auth-context');
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
}));

const mockedUseAuth = jest.mocked(useAuth);

describe('RoleGuard', () => {
  test('does not mount internal content for a farmer', () => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      session: { user: { id: 'farmer-1' } },
      profile: { id: 'farmer-1', nama: 'Budi', email: 'budi@example.com', role: 'farmer' },
    } as ReturnType<typeof useAuth>);

    render(
      <RoleGuard requiredRole="internal">
        <Text>internal effect owner</Text>
      </RoleGuard>
    );

    expect(screen.getByText('redirect:/(app)/petani')).toBeOnTheScreen();
    expect(screen.queryByText('internal effect owner')).toBeNull();
  });

  test('renders matching-role content', () => {
    mockedUseAuth.mockReturnValue({
      loading: false,
      session: { user: { id: 'internal-1' } },
      profile: {
        id: 'internal-1',
        nama: 'Sari',
        email: 'sari@example.com',
        role: 'internal',
      },
    } as ReturnType<typeof useAuth>);

    render(
      <RoleGuard requiredRole="internal">
        <Text>internal content</Text>
      </RoleGuard>
    );

    expect(screen.getByText('internal content')).toBeOnTheScreen();
  });
});
```

Run:

```bash
npm test -- --runInBand src/components/domain/__tests__/role-guard.test.tsx
```

Expected: FAIL because `RoleGuard` does not exist.

- [ ] **Step 2: Implement a render boundary that blocks wrong-role effects**

Create `src/components/domain/role-guard.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';

import { pickDashboardRoute } from '@/lib/routing';
import { useAuth } from '@/services/auth-context';
import type { UserRole } from '@/services/supabase';

import { AppScreen } from '../ui/app-screen';
import { FeedbackState } from '../ui/feedback-state';

export function RoleGuard({
  requiredRole,
  children,
}: {
  requiredRole: UserRole;
  children: ReactNode;
}) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <AppScreen scroll={false}>
        <FeedbackState title="Menyiapkan akun…" loading />
      </AppScreen>
    );
  }
  if (!session || !profile) return <Redirect href="/login" />;
  if (profile.role !== requiredRole) {
    return <Redirect href={pickDashboardRoute(profile.role)} />;
  }
  return children;
}
```

- [ ] **Step 3: Put each role screen behind the boundary**

Change each current default content function to the named export in this table:

| File | Named content function |
| --- | --- |
| `src/app/(app)/petani.tsx` | `export function PetaniDashboard()` |
| `src/app/(app)/task/[id].tsx` | `export function TaskDetailScreen()` |
| `src/app/(app)/pegawai.tsx` | `export function PegawaiDashboard()` |
| `src/app/(app)/penataan-lahan.tsx` | `export function PlotListScreen()` |
| `src/app/(app)/penataan-lahan/form.tsx` | `export function PlotFormContent()` |

Then add the matching default route wrapper to each file:

```tsx
export default function PetaniScreen() {
  return <RoleGuard requiredRole="farmer"><PetaniDashboard /></RoleGuard>;
}

export default function TaskDetailRoute() {
  return <RoleGuard requiredRole="farmer"><TaskDetailScreen /></RoleGuard>;
}

export default function PegawaiScreen() {
  return <RoleGuard requiredRole="internal"><PegawaiDashboard /></RoleGuard>;
}

export default function PlotListRoute() {
  return <RoleGuard requiredRole="internal"><PlotListScreen /></RoleGuard>;
}

export default function PlotFormRoute() {
  return <RoleGuard requiredRole="internal"><PlotFormContent /></RoleGuard>;
}
```

Do not change hook order inside the renamed content functions. Because the content element is below `RoleGuard`, wrong-role data effects never mount.

- [ ] **Step 4: Add a pure safe auth-message helper and tests**

Add to `src/lib/validation.ts`:

```ts
export function safeAuthErrorMessage(): string {
  return 'Email atau password tidak cocok. Periksa kembali lalu coba lagi.';
}
```

Test:

```ts
test('returns a user-safe login error', () => {
  expect(safeAuthErrorMessage()).toBe(
    'Email atau password tidak cocok. Periksa kembali lalu coba lagi.'
  );
});
```

Run the focused test before and after adding the helper.

- [ ] **Step 5: Rewrite login with inline errors**

Use `AppScreen`, `AppText`, `FormField`, `SurfaceCard`, and `AppButton`. Track:

```ts
const [submitError, setSubmitError] = useState<string | null>(null);
const [passwordVisible, setPasswordVisible] = useState(false);
```

The screen includes:

```tsx
<AppScreen>
  <View style={styles.brand}>
    <AppText variant="label" color={Colors.forest}>AGROWEATHER</AppText>
    <AppText variant="display">Kerja lapangan, lebih terarah.</AppText>
    <AppText color={Colors.muted}>Masuk untuk melihat lahan dan tugas Anda.</AppText>
  </View>
  <SurfaceCard>
    {submitError ? (
      <AppText variant="small" color={Colors.dangerText}>{submitError}</AppText>
    ) : null}
    <FormField label="Email" error={errors.email} inputProps={{
      value: email,
      onChangeText: setEmail,
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoCorrect: false,
    }} />
    <FormField label="Password" error={errors.password} inputProps={{
      value: password,
      onChangeText: setPassword,
      secureTextEntry: !passwordVisible,
    }} />
    <AppButton
      label={passwordVisible ? 'Sembunyikan Password' : 'Lihat Password'}
      variant="secondary"
      onPress={() => setPasswordVisible((value) => !value)}
    />
    <AppButton label="Masuk" loading={submitting} onPress={handleSubmit} />
  </SurfaceCard>
</AppScreen>
```

In `catch`, set `safeAuthErrorMessage()` instead of showing the raw exception.

- [ ] **Step 6: Make root navigation and both redirect screens light-only**

In `src/app/_layout.tsx`:

```tsx
<StatusBar style="dark" backgroundColor={Colors.canvas} />
```

Remove `useColorScheme`. Keep the register route absent.

Replace the loading branches in both `src/app/index.tsx` and `src/app/(app)/index.tsx` with:

```tsx
if (loading) {
  return (
    <AppScreen scroll={false}>
      <FeedbackState title="Menyiapkan AgroWeather…" loading />
    </AppScreen>
  );
}
```

Remove all imports of `ThemedText`, `ThemedView`, `ActivityIndicator`, `StyleSheet`, and `View` from those two redirect screens.

In `src/app/(app)/_layout.tsx`, require both session and profile:

```ts
const { session, profile, loading } = useAuth();
if (loading) return null;
if (!session || !profile) return <Redirect href="/login" />;
```

Use light Field First stack headers:

```tsx
<Stack
  screenOptions={{
    headerStyle: { backgroundColor: Colors.canvas },
    headerTintColor: Colors.ink,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: Colors.canvas },
  }}
>
```

This role boundary is a UX guard only; database authorization remains Supabase RLS.

- [ ] **Step 7: Run and commit**

```bash
npm test -- --runInBand src/components/domain/__tests__/role-guard.test.tsx
npm test -- --runInBand src/lib/__tests__/validation.test.ts src/lib/__tests__/routing.test.ts
npm run typecheck
npm run lint
git add src/components/domain/role-guard.tsx src/components/domain/__tests__/role-guard.test.tsx src/app/index.tsx src/app/login.tsx src/app/_layout.tsx src/app/'(app)'/index.tsx src/app/'(app)'/_layout.tsx src/app/'(app)'/petani.tsx src/app/'(app)'/pegawai.tsx src/app/'(app)'/penataan-lahan.tsx src/app/'(app)'/penataan-lahan/form.tsx src/app/'(app)'/task/'[id].tsx' src/app/register.tsx src/lib/validation.ts src/lib/__tests__/validation.test.ts
git commit -m "feat: redesign login and protect role routes"
```

If `src/app/register.tsx` is already deleted, `git add` records the deletion.

## Task 14: Restyle Evidence Picking and Remove Legacy UI Components

**Files:**

- Modify: `src/components/domain/evidence-picker.tsx`
- Delete legacy components listed in the file-structure section.

- [ ] **Step 1: Replace silent permission failures**

In `EvidencePicker`, add `permissionError` state:

```ts
const [permissionError, setPermissionError] = useState<string | null>(null);
```

For denied media/camera permission:

```ts
setPermissionError(
  permission.canAskAgain
    ? 'Izin foto diperlukan untuk memilih bukti.'
    : 'Izin foto diblokir. Aktifkan izin AgroWeather di Pengaturan.'
);
```

Render the error inline with an optional `Buka Pengaturan` button using `Linking.openSettings`.

- [ ] **Step 2: Restyle the evidence component**

Use `SurfaceCard`, `AppText`, and `AppButton`. The component order:

```tsx
<SurfaceCard>
  <AppText variant="subtitle">Foto Bukti</AppText>
  <AppText variant="small" color={Colors.muted}>
    Ambil foto terbaru atau pilih dari galeri.
  </AppText>
  {asset ? <Image source={{ uri: asset.uri }} style={styles.preview} /> : null}
  {permissionError ? <AppText color={Colors.dangerText}>{permissionError}</AppText> : null}
  <AppButton
    label={asset ? 'Ganti Foto' : 'Pilih dari Galeri'}
    onPress={pickImage}
    disabled={disabled}
  />
  <AppButton
    label="Ambil Foto"
    variant="secondary"
    onPress={captureImage}
    disabled={disabled}
  />
  {asset ? (
    <AppButton
      label="Hapus Foto"
      variant="danger"
      onPress={() => onChange(null)}
      disabled={disabled}
    />
  ) : null}
</SurfaceCard>
```

- [ ] **Step 3: Prove legacy components and theme hooks are unused**

Run:

```bash
rg -n "components/(map-picker|primary-button|dashboard-section|form-field|themed-text|themed-view|evidence-picker)|use-theme|use-color-scheme|global\\.css" src
```

Expected: no imports remain.

- [ ] **Step 4: Delete legacy files and run all static checks**

Delete only:

```text
src/components/map-picker.tsx
src/components/primary-button.tsx
src/components/dashboard-section.tsx
src/components/form-field.tsx
src/components/themed-text.tsx
src/components/themed-view.tsx
src/hooks/use-theme.ts
src/hooks/use-color-scheme.ts
src/hooks/use-color-scheme.web.ts
src/global.css
```

Run:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
```

Expected: PASS with zero lint warnings.

- [ ] **Step 5: Commit**

```bash
git add src/components/domain/evidence-picker.tsx src/components/evidence-picker.tsx src/components/map-picker.tsx src/components/primary-button.tsx src/components/dashboard-section.tsx src/components/form-field.tsx src/components/themed-text.tsx src/components/themed-view.tsx src/hooks/use-theme.ts src/hooks/use-color-scheme.ts src/hooks/use-color-scheme.web.ts src/global.css src/app/'(app)'/task/'[id].tsx'
git commit -m "refactor: finish Field First component migration"
```

## Task 15: Cross-Platform Build and Physical GPS Verification

**Files:**

- Modify only files required by failures proven in this task.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo install --check
npx expo-doctor
```

Expected:

- Typecheck passes.
- Lint passes with zero warnings.
- All existing and new tests pass.
- Expo dependencies are up to date for SDK 54.
- Expo Doctor may report only the already-known local CocoaPods/full-Xcode tooling limitation.

- [ ] **Step 2: Build every declared platform**

```bash
npx expo export --platform android --output-dir /private/tmp/agroweather-field-android
npx expo export --platform ios --output-dir /private/tmp/agroweather-field-ios
npx expo export --platform web --output-dir /private/tmp/agroweather-field-web
```

Expected: all three exports succeed. Web must not contain the previous native-only `react-native-maps` error.

- [ ] **Step 3: Run Expo Go manual checks on a physical device**

Checklist:

- Open login; confirm no GPS prompt.
- Login as farmer; confirm no GPS prompt.
- Tap `Aktifkan GPS & Cek Kehadiran`; verify the system permission prompt appears.
- Deny once; verify inline retry.
- Block permission; verify `Buka Pengaturan`.
- Grant permission; verify nearest-plot distance and dynamic radius.
- Tap `Periksa Lagi`; verify a new checking state appears.
- Open a task; confirm no automatic GPS read.
- Unlock task with the explicit button.
- Choose a photo and submit; verify a second GPS check occurs.
- Open plot form as internal; confirm no automatic GPS read.
- Tap `Gunakan Lokasi Saya`; verify the map recenters without saving a point.
- Pan the map and tap `Pilih Titik Ini`; verify the confirmed coordinates change.
- Disable device GPS; verify mapping can continue manually while attendance/task stay locked.

- [ ] **Step 4: Review the final diff for scope and secrets**

```bash
git diff --check
git status --short
git diff --stat 1d87354..HEAD
rg -n "watchPositionAsync|requestBackgroundPermissionsAsync|startLocationUpdatesAsync|TaskManager" src app.json
```

Expected:

- No whitespace errors.
- No background-location API.
- No `.env` or credential file is staged.
- Only the approved UI/GPS scope changed.

- [ ] **Step 5: Commit only proven verification fixes**

If Steps 1–4 expose a failure, identify its exact source path from the failing command, add a regression test first, apply the smallest fix, and rerun the complete failed command. List the literal changed paths with `git status --short`, stage each of those paths explicitly, then commit:

```bash
git commit -m "fix: close Field First verification gaps"
```

Do not use `git add .` and do not create an empty commit when verification required no source changes.

## Task 16: Final Requirement Review

**Files:**

- Review: `docs/superpowers/specs/2026-07-29-field-first-ui-gps-design.md`
- Review: all commits created by Tasks 1–15.

- [ ] **Step 1: Map every acceptance criterion to evidence**

Record in the implementation handoff:

- Explicit no-GPS-on-mount tests.
- Fresh attendance GPS test.
- Submission-time task GPS test.
- Manual map fallback test.
- Dynamic radius rendering location.
- Android/iOS/web export results.
- Typecheck/lint/test counts.
- Physical-device checks completed or explicitly left for the user because no device was connected.

- [ ] **Step 2: Inspect final working tree ownership**

Run:

```bash
git status --short
git log --oneline --decorate -15
```

Do not stage or rewrite unrelated user changes. Report any remaining pre-existing changes separately.

- [ ] **Step 3: Request final code review**

Review for:

- Critical: location requested on mount, task upload without a second location check, or role/data leakage introduced by UI changes.
- Important: stale async updates, dynamic radius replaced by hardcoded copy, web importing native maps, or inaccessible touch targets.
- Minor: copy consistency and removable legacy assets/dependencies.

Fix Critical and Important findings before declaring completion.
