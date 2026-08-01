const mockStorage = {
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockStorage,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

describe('Supabase auth storage', () => {
  let resolveAuthStorage: (hasWindow: boolean) => typeof mockStorage | undefined;

  beforeAll(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_KEY = 'test-key';
    jest.isolateModules(() => {
      ({ resolveAuthStorage } = jest.requireActual('../supabase'));
    });
  });

  test('uses no auth storage during server rendering', () => {
    expect(resolveAuthStorage(false)).toBeUndefined();
  });

  test('uses AsyncStorage in client and native runtimes', () => {
    expect(resolveAuthStorage(true)).toBe(mockStorage);
  });
});
