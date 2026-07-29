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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
