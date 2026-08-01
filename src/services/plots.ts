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
  assignments?: PlotAssignmentRow[] | null;
};

type FarmerRelation = { nama: string } | { nama: string }[] | null;

export type PlotAssignmentRow = {
  farmer_id: string;
  is_primary: boolean;
  farmer?: FarmerRelation;
};

const PLOT_SELECT =
  'id,nama_lahan,farmer_id,jenis_tanaman,luas_hektar,lat_center,lng_center,radius_geofence_m,fase_lahan,status,users:farmer_id(nama),assignments:lahan_petani(farmer_id,is_primary,farmer:users!lahan_petani_farmer_id_fkey(nama))';

const ASSIGNED_PLOT_SELECT =
  'id,nama_lahan,farmer_id,jenis_tanaman,luas_hektar,lat_center,lng_center,radius_geofence_m,fase_lahan,status,users:farmer_id(nama),assignments:lahan_petani!inner(farmer_id,is_primary,farmer:users!lahan_petani_farmer_id_fkey(nama))';

function firstUserName(users: FarmerRelation | undefined): string | null {
  if (Array.isArray(users)) return users[0]?.nama ?? null;
  return users?.nama ?? null;
}

function normalizeFarmerIds(values: PlotFormValues): string[] {
  const ids = [
    ...values.farmerIds,
    values.primaryFarmerId,
    values.farmerId,
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)];
}

function resolvePrimaryFarmerId(values: PlotFormValues): string | null {
  const farmerIds = normalizeFarmerIds(values);
  if (values.primaryFarmerId && farmerIds.includes(values.primaryFarmerId)) {
    return values.primaryFarmerId;
  }
  if (values.farmerId && farmerIds.includes(values.farmerId)) {
    return values.farmerId;
  }
  return farmerIds[0] ?? null;
}

export function mapPlotRow(row: LahanRow): FarmPlot {
  const assignments = row.assignments ?? [];
  const farmerIds = assignments.map((assignment) => assignment.farmer_id);
  const farmerNames = assignments
    .map((assignment) => firstUserName(assignment.farmer))
    .filter((name): name is string => Boolean(name));
  const primaryAssignment =
    assignments.find((assignment) => assignment.is_primary)
    ?? assignments.find((assignment) => assignment.farmer_id === row.farmer_id)
    ?? null;
  const primaryFarmerId = primaryAssignment?.farmer_id ?? row.farmer_id ?? null;
  const primaryFarmerName =
    primaryAssignment ? firstUserName(primaryAssignment.farmer) : null;
  const legacyFarmerName = firstUserName(row.users);

  return {
    id: row.id,
    namaLahan: row.nama_lahan,
    farmerId: primaryFarmerId,
    farmerName: primaryFarmerName ?? legacyFarmerName,
    farmerIds: farmerIds.length > 0 ? farmerIds : row.farmer_id ? [row.farmer_id] : [],
    farmerNames:
      farmerNames.length > 0
        ? farmerNames
        : legacyFarmerName
          ? [legacyFarmerName]
          : [],
    primaryFarmerId,
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
    farmer_id: resolvePrimaryFarmerId(values),
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
    .select(ASSIGNED_PLOT_SELECT)
    .eq('assignments.farmer_id', farmerId)
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
  const { data, error } = await client
    .from('lahan')
    .insert(toPlotInsert(values))
    .select('id')
    .single();
  if (error) throw error;

  await setPlotFarmerAssignments((data as { id: string }).id, values, client);
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

  await setPlotFarmerAssignments(plotId, values, client);
}

async function setPlotFarmerAssignments(
  plotId: string,
  values: PlotFormValues,
  client: SupabaseClient
): Promise<void> {
  const farmerIds = normalizeFarmerIds(values);
  const primaryFarmerId = resolvePrimaryFarmerId(values);
  const { error } = await client.rpc('set_plot_farmer_assignments', {
    p_lahan_id: plotId,
    p_farmer_ids: farmerIds,
    p_primary_farmer_id: primaryFarmerId,
  });
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
