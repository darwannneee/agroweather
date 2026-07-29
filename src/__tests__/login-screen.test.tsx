import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import LoginScreen from '@/app/login';

jest.mock('expo-router', () => {
  const replace = jest.fn();
  return {
    useRouter: () => ({ replace }),
    __replace: replace,
  };
});

jest.mock('@/services/auth-context', () => {
  const signIn = jest.fn();
  return {
    useAuth: () => ({ signIn }),
    __signIn: signIn,
  };
});

const routerMocks = jest.requireMock('expo-router') as {
  __replace: jest.Mock;
};
const authMocks = jest.requireMock('@/services/auth-context') as {
  __signIn: jest.Mock;
};

const SAFE_AUTH_ERROR =
  'Tidak dapat masuk. Periksa email, password, dan koneksi lalu coba lagi.';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function fillCredentials(password = 'password123') {
  fireEvent.changeText(screen.getByLabelText('Email'), '  budi@example.com  ');
  fireEvent.changeText(screen.getByLabelText('Password'), password);
}

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMocks.__signIn.mockResolvedValue(undefined);
  });

  test('renders Field First login without a public registration path', () => {
    render(<LoginScreen />);

    expect(screen.getByText('FIELD FIRST')).toBeOnTheScreen();
    expect(screen.getByText('Masuk ke AgroWeather')).toBeOnTheScreen();
    expect(screen.queryByText(/Daftar/i)).toBeNull();
  });

  test('shows validation errors inline without calling auth', () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));

    expect(screen.getByText('Email wajib diisi')).toHaveProp(
      'accessibilityLiveRegion',
      'polite'
    );
    expect(screen.getByText('Password wajib diisi')).toHaveProp(
      'accessibilityLiveRegion',
      'polite'
    );
    expect(screen.getByLabelText('Email')).toHaveProp(
      'accessibilityHint',
      'Email wajib diisi'
    );
    expect(screen.getByLabelText('Password')).toHaveProp(
      'accessibilityHint',
      'Password wajib diisi'
    );
    expect(authMocks.__signIn).not.toHaveBeenCalled();
  });

  test('shows a controlled inline auth error and never exposes the raw error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    authMocks.__signIn.mockRejectedValue(
      new Error('Supabase host secret: invalid_grant')
    );
    render(<LoginScreen />);

    try {
      fillCredentials();
      fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));

      expect(await screen.findByText(SAFE_AUTH_ERROR)).toBeOnTheScreen();
      expect(screen.queryByText(/Supabase host secret/i)).toBeNull();
      expect(alertSpy).not.toHaveBeenCalled();
    } finally {
      alertSpy.mockRestore();
    }
  });

  test('clears a stale submit error when the user edits a field', async () => {
    authMocks.__signIn.mockRejectedValueOnce(new Error('raw provider error'));
    render(<LoginScreen />);

    fillCredentials();
    fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText(SAFE_AUTH_ERROR)).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Email'), 'sari@example.com');

    expect(screen.queryByText(SAFE_AUTH_ERROR)).toBeNull();
  });

  test('provides an accessible password visibility control', () => {
    render(<LoginScreen />);

    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
    expect(
      screen.getByRole('togglebutton', { name: 'Tampilkan password' })
    ).toHaveProp('accessibilityState', {
      checked: false,
      disabled: false,
    });
    fireEvent.press(
      screen.getByRole('togglebutton', { name: 'Tampilkan password' })
    );

    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false);
    expect(
      screen.getByRole('togglebutton', { name: 'Tampilkan password' })
    ).toHaveProp('accessibilityState', {
      checked: true,
      disabled: false,
    });
    expect(screen.getByText('Sembunyikan')).toBeOnTheScreen();
  });

  test('accepts a short non-empty legacy password and disables submit while loading', async () => {
    const submission = deferred<void>();
    authMocks.__signIn.mockReturnValue(submission.promise);
    render(<LoginScreen />);

    fillCredentials('x');
    fireEvent.press(screen.getByRole('button', { name: 'Masuk' }));

    await waitFor(() => {
      expect(authMocks.__signIn).toHaveBeenCalledWith(
        'budi@example.com',
        'x'
      );
    });
    expect(screen.getByRole('button', { name: 'Masuk' })).toHaveProp(
      'accessibilityState',
      { busy: true, disabled: true }
    );
    expect(
      screen.getByRole('togglebutton', { name: 'Tampilkan password' })
    ).toHaveProp('accessibilityState', {
      checked: false,
      disabled: true,
    });

    await act(async () => {
      submission.resolve();
      await submission.promise;
    });

    expect(routerMocks.__replace).toHaveBeenCalledWith('/');
  });
});
