import { useEffect } from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RoleGuard } from '../role-guard';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: 'redirect' }, href),
  };
});

jest.mock('@/services/auth-context', () => {
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
    session: { user: { id: 'user-1' } },
    profile: {
      id: 'user-1',
      nama: 'Budi',
      email: 'budi@example.com',
      role: 'farmer',
    },
  };

  return {
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

const farmerProfile = {
  id: 'farmer-1',
  nama: 'Budi',
  email: 'budi@example.com',
  role: 'farmer' as const,
};

function setAuthState(
  overrides: Partial<{
    loading: boolean;
    session: object | null;
    profile: typeof farmerProfile | {
      id: string;
      nama: string;
      email: string;
      role: 'internal';
    } | null;
  }> = {}
) {
  authMocks.__setAuthState({
    loading: false,
    session: { user: { id: 'farmer-1' } },
    profile: farmerProfile,
    ...overrides,
  });
}

describe('RoleGuard', () => {
  beforeEach(() => {
    setAuthState();
  });

  test('shows a loading state before resolving access', () => {
    const childRender = jest.fn();
    setAuthState({ loading: true });

    function ProtectedChild() {
      childRender();
      return <Text>Konten terlindungi</Text>;
    }

    render(
      <RoleGuard requiredRole="farmer">
        <ProtectedChild />
      </RoleGuard>
    );

    expect(screen.getByText('Memeriksa akses…')).toBeOnTheScreen();
    expect(childRender).not.toHaveBeenCalled();
  });

  test.each([
    ['session', { session: null }],
    ['profile', { profile: null }],
  ] as const)('redirects a missing %s to login', (_label, overrides) => {
    setAuthState(overrides);

    render(
      <RoleGuard requiredRole="farmer">
        <Text>Konten terlindungi</Text>
      </RoleGuard>
    );

    expect(screen.getByTestId('redirect')).toHaveTextContent('/login');
    expect(screen.queryByText('Konten terlindungi')).toBeNull();
  });

  test('redirects the wrong role to its own dashboard without mounting children', () => {
    const childRender = jest.fn();
    const childEffect = jest.fn();
    setAuthState({
      profile: {
        id: 'internal-1',
        nama: 'Sari',
        email: 'sari@example.com',
        role: 'internal',
      },
    });

    function ProtectedChild() {
      childRender();
      useEffect(childEffect, []);
      return <Text>Konten terlindungi</Text>;
    }

    render(
      <RoleGuard requiredRole="farmer">
        <ProtectedChild />
      </RoleGuard>
    );

    expect(screen.getByTestId('redirect')).toHaveTextContent('/(app)/pegawai');
    expect(childRender).not.toHaveBeenCalled();
    expect(childEffect).not.toHaveBeenCalled();
  });

  test('renders children for the required role', () => {
    render(
      <RoleGuard requiredRole="farmer">
        <Text>Konten terlindungi</Text>
      </RoleGuard>
    );

    expect(screen.getByText('Konten terlindungi')).toBeOnTheScreen();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
