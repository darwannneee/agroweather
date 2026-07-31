import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react-native';

import AppLayout from '@/app/(app)/_layout';
import AppIndex from '@/app/(app)/index';
import RootLayout from '@/app/_layout';
import RootIndex from '@/app/index';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  function Stack({ children }: { children: React.ReactNode }) {
    return React.createElement(View, null, children);
  }
  function StackScreen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string };
  }) {
    return React.createElement(
      Text,
      {
        testID: 'stack-screen',
        accessibilityLabel: options?.title ?? '',
      },
      name
    );
  }
  Stack.Screen = StackScreen;

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: 'redirect' }, href),
    Stack,
  };
});

jest.mock('expo-status-bar', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    StatusBar: ({ style }: { style: string }) =>
      React.createElement(Text, { testID: 'status-bar-style' }, style),
  };
});

jest.mock('@/services/auth-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  let state: {
    loading: boolean;
    session: object | null;
    profile: {
      id: string;
      nama: string;
      email: string;
      role: 'farmer' | 'internal';
    } | null;
  } = {
    loading: false,
    session: { user: { id: 'farmer-1' } },
    profile: {
      id: 'farmer-1',
      nama: 'Budi',
      email: 'budi@example.com',
      role: 'farmer',
    },
  };

  return {
    AuthProvider: ({ children }: { children: ReactNode }) =>
      React.createElement(View, null, children),
    useAuth: () => state,
    __setAuthState: (next: typeof state) => {
      state = next;
    },
  };
});

const authMocks = jest.requireMock('@/services/auth-context') as {
  __setAuthState: (state: {
    loading: boolean;
    session: object | null;
    profile: {
      id: string;
      nama: string;
      email: string;
      role: 'farmer' | 'internal';
    } | null;
  }) => void;
};

const validAuth = {
  loading: false,
  session: { user: { id: 'farmer-1' } },
  profile: {
    id: 'farmer-1',
    nama: 'Budi',
    email: 'budi@example.com',
    role: 'farmer' as const,
  },
};

describe('auth routing shell', () => {
  beforeEach(() => {
    authMocks.__setAuthState(validAuth);
  });

  test('requires both session and profile before rendering the app stack', () => {
    authMocks.__setAuthState({ ...validAuth, profile: null });

    render(<AppLayout />);

    expect(screen.getByTestId('redirect')).toHaveTextContent('/login');
    expect(screen.queryByTestId('stack-screen')).toBeNull();
  });

  test.each([
    ['root index', RootIndex],
    ['app index', AppIndex],
  ])('renders Field First loading feedback for %s', (_label, IndexScreen) => {
    authMocks.__setAuthState({ ...validAuth, loading: true });

    render(<IndexScreen />);

    expect(screen.getByText('Memuat aplikasi…')).toBeOnTheScreen();
  });

  test('uses a light-only status bar and exact root Router 6 screen names', () => {
    render(<RootLayout />);

    expect(screen.getByTestId('status-bar-style')).toHaveTextContent('dark');
    expect(
      screen.getAllByTestId('stack-screen').map((node) => node.props.children)
    ).toEqual(['index', 'login', '(app)']);
  });

  test('uses the exact nested Router 6 screen names', () => {
    render(<AppLayout />);

    expect(
      screen.getAllByTestId('stack-screen').map((node) => node.props.children)
    ).toEqual([
      'index',
      'petani',
      'pegawai',
      'penataan-lahan',
      'penataan-lahan/form',
      'task/[id]',
      'daily-operations',
      'ai-tasks/index',
      'ai-tasks/[id]',
      'task-review/[id]',
    ]);
  });

  test('registers Indonesian titles for every operational route', () => {
    render(<AppLayout />);

    const registered = Object.fromEntries(
      screen.getAllByTestId('stack-screen').map((node) => [
        node.props.children,
        node.props.accessibilityLabel,
      ])
    );
    expect(registered).toMatchObject({
      petani: 'Dashboard Petani',
      pegawai: 'Dashboard Pegawai',
      'daily-operations': 'Operasional Harian',
      'ai-tasks/index': 'Draft Task AI',
      'ai-tasks/[id]': 'Review Draft AI',
      'task/[id]': 'Detail Task',
      'task-review/[id]': 'Review Bukti Task',
    });
  });
});
