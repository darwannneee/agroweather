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
  users?: { nama: string } | { nama: string }[] | null;
};

const PLOT_SELECT =
  'id,nama_lahan,farmer_id,jenis_tanaman,luas_hektar,lat_center,lng_center,radius_geofence_m,fase_lahan,status,users:farmer_id(nama)';

function firstUserName(users: LahanRow['users']): string | null {
  if (Array.isArray(users)) return users[0]?.nama ?? null;
  return users?.nama ?? null;
}

export function mapPlotRow(row: LahanRow): FarmPlot {
  return {
    id: row.id,
    namaLahan: row.nama_lahan,
    farmerId: row.farmer_id,
    farmerName: firstUserName(row.users),
    jenisTanaman: row.jenis_tanaman,
    luasHektar: row.luas_hektar,
    latCenter: Number(row.lat_center),
    lngCenter: Number(row.lng_center),
    radiusGeofenceM: row.radius_geofence_m,
    faseLahan: row.fase_lahan,
    status: row.status,
  };
}

function toPlotValues(values: PlotFormValues) {
  return {
    nama_lahan: values.namaLahan.trim(),
    farmer_id: values.farmerId,
    luas_hektar: Number(values.luasHektar),
    jenis_tanaman: values.jenisTanaman.trim(),
    fase_lahan: values.faseLahan.trim(),
    lat_center: values.latCenter,
    lng_center: values.lngCenter,
    radius_geofence_m: values.radiusGeofenceM,
  };
}

export function toPlotInsert(values: PlotFormValues) {
  return {
    ...toPlotValues(values),
    status: 'aktif',
  };
}

export async function fetchPlots(client: SupabaseClient = supabase): Promise<FarmPlot[]> {
  const { data, error } = await client
    .from('lahan')
    .select(PLOT_SELECT)
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
    .select(PLOT_SELECT)
    .eq('farmer_id', farmerId)
    .eq('status', 'aktif')
    .order('nama_lahan', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as LahanRow[]).map(mapPlotRow);
}

export async function fetchPlotById(
  plotId: string,
  client: SupabaseClient = supabase
): Promise<FarmPlot> {
  const { data, error } = await client.from('lahan').select(PLOT_SELECT).eq('id', plotId).single();
  if (error) throw error;
  return mapPlotRow(data as LahanRow);
}

export async function createPlot(
  values: PlotFormValues,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.from('lahan').insert(toPlotInsert(values));
  if (error) throw error;
}

export async function updatePlot(
  plotId: string,
  values: PlotFormValues,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client
    .from('lahan')
    .update({ ...toPlotValues(values), updated_at: new Date().toISOString() })
    .eq('id', plotId);
  if (error) throw error;
}

export async function setPlotStatus(
  plotId: string,
  status: FarmPlot['status'],
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client
    .from('lahan')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', plotId);
  if (error) throw error;
}
