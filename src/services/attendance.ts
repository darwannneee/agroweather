import type { SupabaseClient } from '@supabase/supabase-js';

import type { FarmPlot } from '@/lib/farm-types';
import { evaluateGeofence, type Coordinates, type GeofenceResult } from '@/lib/geofence';

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
