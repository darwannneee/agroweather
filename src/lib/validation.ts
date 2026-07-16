import type { UserRole } from '@/services/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) return 'Email wajib diisi';
  if (!EMAIL_RE.test(trimmed)) return 'Format email tidak valid';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password wajib diisi';
  if (password.length < 8) return 'Password minimal 8 karakter';
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLetter || !hasDigit) return 'Password harus mengandung huruf dan angka';
  return null;
}

export function validateNama(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Nama wajib diisi';
  if (trimmed.length < 2) return 'Nama minimal 2 karakter';
  return null;
}

export function validateRole(role: string): string | null {
  if (!role) return 'Peran wajib dipilih';
  if (role !== 'farmer' && role !== 'internal') return 'Peran tidak valid';
  return null;
}

export type LoginFormValues = { email: string; password: string };
export type LoginFormErrors = { email: string | null; password: string | null };

export function validateLoginForm(values: LoginFormValues): LoginFormErrors {
  return {
    email: validateEmail(values.email),
    password: validatePassword(values.password),
  };
}

export type RegisterFormValues = {
  email: string;
  password: string;
  nama: string;
  role: string;
};
export type RegisterFormErrors = {
  email: string | null;
  password: string | null;
  nama: string | null;
  role: string | null;
};

export function validateRegisterForm(values: RegisterFormValues): RegisterFormErrors {
  return {
    email: validateEmail(values.email),
    password: validatePassword(values.password),
    nama: validateNama(values.nama),
    role: validateRole(values.role),
  };
}

export function hasErrors(errors: Record<string, string | null>): boolean {
  return Object.values(errors).some((v) => v !== null);
}

export type { UserRole };
