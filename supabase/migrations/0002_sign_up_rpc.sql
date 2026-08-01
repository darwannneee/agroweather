-- AgroWeather — RPC signup function
-- Bypass rate limit Auth Supabase + skip email confirmation + RLS-safe insert.
-- Run SEKALI di Supabase SQL Editor.

-- ===========================================
-- FUNCTION: sign_up_user
-- ===========================================
-- Buat user baru secara atomic:
--   1. Insert ke auth.users (bcrypt password via crypt())
--   2. Insert ke public.users (role + nama)
--   3. Skip email confirmation (email_confirmedat = now())
--
-- SECURITY DEFINER = jalan sebagai superuser, bypass RLS.
-- Diperlukan supaya anon (belum login) bisa insert ke auth.users
-- tanpa kena rate limit Supabase Auth (free tier ~3-5 signup/jam/IP).
--
-- Args:
--   p_email    text  -- email user baru
--   p_password text  -- password plain text (akan di-hash bcrypt)
--   p_nama     text  -- nama lengkap
--   p_role     user_role  -- 'farmer' | 'worker' (bukan 'admin')
--
-- Returns: uuid id user baru
-- Throws: exception kalau email sudah dipakai atau role tidak valid.

CREATE OR REPLACE FUNCTION public.sign_up_user(
  p_email    text,
  p_password text,
  p_nama     text,
  p_role     user_role
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email_lower text := lower(trim(p_email));
BEGIN
  -- Validate role: hanya farmer / internal yang boleh didaftarkan via signup
  IF p_role NOT IN ('farmer', 'internal') THEN
    RAISE EXCEPTION 'Role tidak valid: %', p_role;
  END IF;

  -- Cek email unik
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email_lower) THEN
    RAISE EXCEPTION 'Email sudah terdaftar: %', v_email_lower;
  END IF;

  -- Insert ke auth.users (bcrypt password, email sudah confirmed)
  v_user_id := gen_random_uuid();
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    aud,
    role
  ) VALUES (
    v_user_id,
    v_email_lower,
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    'authenticated',
    'authenticated'
  );

  -- Insert identities (diperlukan Supabase supaya user bisa sign-in)
  INSERT INTO auth.identities (
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email_lower),
    'email',
    now(),
    now(),
    now()
  );

  -- Insert ke public.users
  INSERT INTO public.users (id, email, nama, role)
  VALUES (v_user_id, v_email_lower, p_nama, p_role);

  RETURN v_user_id;
END;
$$;

-- ===========================================
-- GRANT EXECUTE ke anon + authenticated
-- ===========================================
-- Tanpa GRANT ini, client Supabase anon key gak bisa panggil function-nya.
GRANT EXECUTE ON FUNCTION public.sign_up_user TO anon, authenticated;
