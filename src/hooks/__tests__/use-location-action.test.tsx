import { act, renderHook } from '@testing-library/react-native';
import { StrictMode, type PropsWithChildren } from 'react';

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

function StrictModeWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

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

  test('updates state after Strict Mode replays effects', async () => {
    const request = jest.fn().mockResolvedValue(granted);
    const { result } = renderHook(() => useLocationAction(request), {
      wrapper: StrictModeWrapper,
      // @ts-expect-error react-test-renderer's strict-root option is not exposed by renderHook.
      unstable_strictMode: true,
    });

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.state.status).toBe('success');
  });
});
