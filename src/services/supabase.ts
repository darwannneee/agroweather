import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in .env.local'
  );
}

export function resolveAuthStorage(hasWindow: boolean): typeof AsyncStorage | undefined {
  return hasWindow ? AsyncStorage : undefined;
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: resolveAuthStorage(typeof window !== 'undefined'),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type UserRole = 'farmer' | 'internal';

export type AppUser = {
  id: string;
  email: string;
  nama: string;
  role: UserRole;
  created_at?: string;
};
