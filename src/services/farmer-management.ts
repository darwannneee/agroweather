import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from './supabase';

export type CreateInternalFarmerInput = {
  nama: string;
  email: string;
  password: string;
  plotIds: string[];
};

export type UpdateInternalFarmerProfileInput = {
  farmerId: string;
  nama: string;
  email: string;
  plotIds: string[];
};

function normalizePlotIds(plotIds: string[]): string[] {
  return [...new Set(plotIds.filter(Boolean))];
}

export async function createInternalFarmer(
  input: CreateInternalFarmerInput,
  client: SupabaseClient = supabase
): Promise<string> {
  const { data, error } = await client.rpc('create_internal_farmer', {
    p_nama: input.nama.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_password: input.password,
    p_lahan_ids: normalizePlotIds(input.plotIds),
  });
  if (error) throw error;
  return data as string;
}

export async function updateInternalFarmerProfile(
  input: UpdateInternalFarmerProfileInput,
  client: SupabaseClient = supabase
): Promise<void> {
  const { error } = await client.rpc('update_internal_farmer_profile', {
    p_farmer_id: input.farmerId,
    p_nama: input.nama.trim(),
    p_email: input.email.trim().toLowerCase(),
    p_lahan_ids: normalizePlotIds(input.plotIds),
  });
  if (error) throw error;
}
