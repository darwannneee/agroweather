import {
  validateEmail,
  validatePassword,
  validateNama,
  validateRole,
  validateLoginForm,
  validateRegisterForm,
} from '../validation';

describe('validateEmail', () => {
  test('rejects empty string', () => {
    expect(validateEmail('')).toBe('Email wajib diisi');
  });

  test('rejects whitespace-only', () => {
    expect(validateEmail('   ')).toBe('Email wajib diisi');
  });

  test('rejects missing @', () => {
    expect(validateEmail('petanigmail.com')).toBe('Format email tidak valid');
  });

  test('rejects missing domain', () => {
    expect(validateEmail('petani@')).toBe('Format email tidak valid');
  });

  test('rejects missing local part', () => {
    expect(validateEmail('@gmail.com')).toBe('Format email tidak valid');
  });

  test('accepts valid email (trim whitespace)', () => {
    expect(validateEmail('  petani@gmail.com  ')).toBeNull();
  });
});

describe('validatePassword', () => {
  test('rejects empty', () => {
    expect(validatePassword('')).toBe('Password wajib diisi');
  });

  test('rejects shorter than 8 chars', () => {
    expect(validatePassword('abc123')).toBe('Password minimal 8 karakter');
  });

  test('rejects letters-only (no digit)', () => {
    expect(validatePassword('abcdefgh')).toBe('Password harus mengandung huruf dan angka');
  });

  test('rejects digits-only (no letter)', () => {
    expect(validatePassword('12345678')).toBe('Password harus mengandung huruf dan angka');
  });

  test('accepts mixed letters+digits, 8+ chars', () => {
    expect(validatePassword('petani123')).toBeNull();
  });
});

describe('validateNama', () => {
  test('rejects empty', () => {
    expect(validateNama('')).toBe('Nama wajib diisi');
  });

  test('rejects whitespace-only', () => {
    expect(validateNama('   ')).toBe('Nama wajib diisi');
  });

  test('rejects single character', () => {
    expect(validateNama('A')).toBe('Nama minimal 2 karakter');
  });

  test('accepts valid name (trimmed)', () => {
    expect(validateNama('  Budi Santoso  ')).toBeNull();
  });
});

describe('validateRole', () => {
  test('rejects empty string', () => {
    expect(validateRole('')).toBe('Peran wajib dipilih');
  });

  test('rejects legacy "admin" value', () => {
    expect(validateRole('admin')).toBe('Peran tidak valid');
  });

  test('rejects legacy "worker" value', () => {
    expect(validateRole('worker')).toBe('Peran tidak valid');
  });

  test('accepts farmer (label "Petani")', () => {
    expect(validateRole('farmer')).toBeNull();
  });

  test('accepts internal', () => {
    expect(validateRole('internal')).toBeNull();
  });
});

describe('validateLoginForm', () => {
  test('returns errors for empty input', () => {
    expect(validateLoginForm({ email: '', password: '' })).toEqual({
      email: 'Email wajib diisi',
      password: 'Password wajib diisi',
    });
  });

  test('returns null errors for valid input', () => {
    expect(
      validateLoginForm({ email: 'budi@gmail.com', password: 'password123' })
    ).toEqual({ email: null, password: null });
  });

  test('returns mixed errors for partial invalid input', () => {
    expect(
      validateLoginForm({ email: 'budi@gmail.com', password: 'short' })
    ).toEqual({ email: null, password: 'Password minimal 8 karakter' });
  });
});

describe('validateRegisterForm', () => {
  const valid = {
    email: 'budi@gmail.com',
    password: 'password123',
    nama: 'Budi Santoso',
    role: 'farmer' as const,
  };

  test('returns null errors for fully valid input', () => {
    expect(validateRegisterForm(valid)).toEqual({
      email: null,
      password: null,
      nama: null,
      role: null,
    });
  });

  test('returns all errors for empty input', () => {
    expect(
      validateRegisterForm({ email: '', password: '', nama: '', role: '' })
    ).toEqual({
      email: 'Email wajib diisi',
      password: 'Password wajib diisi',
      nama: 'Nama wajib diisi',
      role: 'Peran wajib dipilih',
    });
  });

  test('returns single error when only role is empty', () => {
    expect(validateRegisterForm({ ...valid, role: '' })).toEqual({
      email: null,
      password: null,
      nama: null,
      role: 'Peran wajib dipilih',
    });
  });

  test('accepts internal role', () => {
    expect(validateRegisterForm({ ...valid, role: 'internal' })).toEqual({
      email: null,
      password: null,
      nama: null,
      role: null,
    });
  });
});
