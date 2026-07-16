import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { fetchUserProfile, signIn as svcSignIn, signOut as svcSignOut, signUp as svcSignUp } from '@/services/auth';
import { supabase, type AppUser, type UserRole } from '@/services/supabase';

export type SignUpInput = {
  email: string;
  password: string;
  nama: string;
  role: UserRole;
};

export type AuthState = {
  session: Session | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
};

export function useAuthInternal(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        try {
          const p = await fetchUserProfile(data.session.user.id);
          if (mounted) setProfile(p);
        } catch (e) {
          console.warn('Gagal load profile:', e);
        }
      }
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        try {
          const p = await fetchUserProfile(newSession.user.id);
          setProfile(p);
        } catch (e) {
          console.warn('Gagal load profile on change:', e);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const newSession = await svcSignIn({ email, password });
    setSession(newSession);
    if (newSession?.user) {
      const p = await fetchUserProfile(newSession.user.id);
      setProfile(p);
    }
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    await svcSignUp(input);
  }, []);

  const signOut = useCallback(async () => {
    await svcSignOut();
    setProfile(null);
  }, []);

  return { session, profile, loading, signIn, signUp, signOut };
}
