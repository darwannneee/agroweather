import type { Session } from '@supabase/supabase-js';

import { supabase, type AppUser, type UserRole } from './supabase';

export type SignUpInput = {
  email: string;
  password: string;
  nama: string;
  role: UserRole;
};

export type SignInInput = {
  email: string;
  password: string;
};

/**
 * Signup via RPC function `sign_up_user` di Supabase.
 *
 * Why RPC bukan `supabase.auth.signUp`:
 * - Bypass rate limit Auth (free tier limit ~3-5 signup/jam per IP)
 * - Bypass email confirmation (langsung aktif)
 * - Atomic: insert auth.users + public.users barengan, gak setengah jalan
 *
 * Function definition ada di `supabase/migrations/0001_init_users.sql`.
 */
export async function signUp(input: SignUpInput): Promise<void> {
  const { error } = await supabase.rpc('sign_up_user', {
    p_email: input.email.trim().toLowerCase(),
    p_password: input.password,
    p_nama: input.nama.trim(),
    p_role: input.role,
  });
  if (error) throw error;
}

export async function signIn(input: SignInInput): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error) throw error;
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function fetchUserProfile(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, nama, role, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as AppUser | null;
}
