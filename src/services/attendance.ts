import type { SupabaseClient } from '@supabase/supabase-js';

import type { AttendanceRecord, FarmPlot } from '@/lib/farm-types';
import { evaluateGeofence, type Coordinates, type GeofenceResult } from '@/lib/geofence';

import { supabase } from './supabase';

export type CheckInResult = GeofenceResult & {
  attendanceRecorded: boolean;
  attendance: AttendanceRecord | null;
};

type FarmerRelation = { nama: string } | { nama: string }[] | null;
type PlotRelation =
  | { nama_lahan: string }
  | { nama_lahan: string }[]
  | null;

export type AttendanceRow = {
  id: string;
  farmer_id: string;
  lahan_id: string;
  attendance_date: string;
  waktu_masuk: string;
  distance_m: number | null;
  lat: number;
  lng: number;
  lahan?: PlotRelation;
  users?: FarmerRelation;
};

const ATTENDANCE_SELECT =
  'id,farmer_id,lahan_id,attendance_date,waktu_masuk,distance_m,lat,lng,lahan(nama_lahan),users!absensi_farmer_id_fkey(nama)';

function relationName(
  relation: FarmerRelation | PlotRelation | undefined,
  key: 'nama' | 'nama_lahan'
): string | null {
  const value = Array.isArray(relation) ? relation[0] : relation;
  if (!value) return null;
  const name = value[key as keyof typeof value];
  return typeof name === 'string' ? name : null;
}

export function mapAttendanceRow(
  row: AttendanceRow,
  fallback: { farmerName?: string; plotName?: string } = {}
): AttendanceRecord {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    farmerName: relationName(row.users, 'nama') ?? fallback.farmerName ?? '',
    plotId: row.lahan_id,
    plotName: relationName(row.lahan, 'nama_lahan') ?? fallback.plotName ?? '',
    attendanceDate: row.attendance_date,
    checkedInAt: row.waktu_masuk,
    distanceM: row.distance_m,
    latitude: row.lat,
    longitude: row.lng,
  };
}

export async function fetchFarmerAttendanceForDate(
  farmerId: string,
  attendanceDate: string,
  client: SupabaseClient = supabase
): Promise<AttendanceRecord | null> {
  const { data, error } = await client
    .from('absensi')
    .select(ATTENDANCE_SELECT)
    .eq('farmer_id', farmerId)
    .eq('attendance_date', attendanceDate)
    .eq('status_geofence', 'valid')
    .order('waktu_masuk', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  return data ? mapAttendanceRow(data as unknown as AttendanceRow) : null;
}

export async function checkInIfInsideRadius(input: {
  farmerId: string;
  plot: FarmPlot;
  userLocation: Coordinates | null;
  client?: SupabaseClient;
}, clientOverride?: SupabaseClient): Promise<CheckInResult> {
  const result = evaluateGeofence({
    user: input.userLocation,
    plot: {
      latitude: input.plot.latCenter,
      longitude: input.plot.lngCenter,
      radiusMeters: input.plot.radiusGeofenceM,
    },
  });

  if (!result.unlocked || !input.userLocation || result.distanceM === null) {
    return { ...result, attendanceRecorded: false, attendance: null };
  }

  const client = clientOverride ?? input.client ?? supabase;
  const { data, error } = await client.rpc('register_attendance', {
    p_lahan_id: input.plot.id,
    p_lat: input.userLocation.latitude,
    p_lng: input.userLocation.longitude,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as AttendanceRow | undefined;
  if (!row) throw new Error('ATTENDANCE_REGISTRATION_EMPTY');

  return {
    ...result,
    attendanceRecorded: true,
    attendance: mapAttendanceRow(row, {
      plotName: input.plot.namaLahan,
    }),
  };
}
