import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert } from 'react-native';

import AiTaskReviewRoute, {
  AiTaskReviewScreen,
} from '@/app/(app)/ai-tasks/[id]';
import type { AiTaskDraft } from '@/lib/farm-types';
import type { AppUser } from '@/services/supabase';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const replace = jest.fn();
  let params: { id?: string | string[] } = { id: 'draft-1' };

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: 'redirect' }, href),
    useLocalSearchParams: () => params,
    useRouter: () => ({ replace }),
    __replace: replace,
    __setParams: (next: typeof params) => {
      params = next;
    },
  };
});

jest.mock('@/services/auth-context', () => {
  let state = {
    loading: false,
    session: { user: { id: 'internal-1' } },
    profile: {
      id: 'internal-1',
      nama: 'Staf Internal',
      email: 'internal@example.com',
      role: 'internal' as 'internal' | 'farmer',
    },
  };

  return {
    useAuth: () => state,
    __setRole: (role: 'internal' | 'farmer') => {
      state = {
        ...state,
        profile: {
          ...state.profile,
          id: role === 'internal' ? 'internal-1' : 'farmer-1',
          role,
        },
      };
    },
  };
});

jest.mock('@/services/ai-drafts', () => ({
  approveAiDraft: jest.fn(),
  fetchAiDraftById: jest.fn(),
  rejectAiDraft: jest.fn(),
}));

jest.mock('@/services/auth', () => ({
  fetchFarmers: jest.fn(),
}));

const routerMocks = jest.requireMock('expo-router') as {
  __replace: jest.Mock;
  __setParams: (params: { id?: string | string[] }) => void;
};
const authContextMocks = jest.requireMock('@/services/auth-context') as {
  __setRole: (role: 'internal' | 'farmer') => void;
};
const draftMocks = jest.requireMock('@/services/ai-drafts') as {
  approveAiDraft: jest.Mock;
  fetchAiDraftById: jest.Mock;
  rejectAiDraft: jest.Mock;
};
const authMocks = jest.requireMock('@/services/auth') as {
  fetchFarmers: jest.Mock;
};
const alertSpy = jest.spyOn(Alert, 'alert');

const farmers: AppUser[] = [
  {
    id: 'farmer-1',
    nama: 'Petani Satu',
    email: 'satu@example.com',
    role: 'farmer',
  },
  {
    id: 'farmer-2',
    nama: 'Petani Dua',
    email: 'dua@example.com',
    role: 'farmer',
  },
];

const draft: AiTaskDraft = {
  id: 'draft-1',
  plotId: 'plot-1',
  plotName: 'Sawah Utara',
  proposedAssigneeId: 'farmer-1',
  proposedAssigneeName: 'Petani Satu',
  scheduledFor: '2026-07-30',
  title: 'Periksa irigasi',
  description: 'Pastikan saluran tidak tersumbat sebelum hujan.',
  priority: 'high',
  requiresLocation: true,
  aiReason: 'Hujan diperkirakan turun siang ini.',
  status: 'pending',
  model: 'openrouter/provider-private',
  weather: {
    observedAt: '2026-07-29T21:00:00.000Z',
    description: 'hujan ringan',
    temperatureC: 28,
    humidityPercent: 80,
    windSpeedMps: 2,
    rainMm: 0.4,
    forecastMinTemperatureC: 25,
    forecastMaxTemperatureC: 31,
    forecastMaxRainProbability: 0.8,
  },
  createdAt: '2026-07-29T22:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function renderLoaded() {
  render(<AiTaskReviewScreen />);
  await screen.findByDisplayValue('Periksa irigasi');
}

describe('AiTaskReviewScreen', () => {
  beforeEach(() => {
    routerMocks.__replace.mockReset();
    routerMocks.__setParams({ id: 'draft-1' });
    authContextMocks.__setRole('internal');
    alertSpy.mockClear();
    draftMocks.approveAiDraft.mockReset();
    draftMocks.approveAiDraft.mockResolvedValue('task-1');
    draftMocks.fetchAiDraftById.mockReset();
    draftMocks.fetchAiDraftById.mockResolvedValue(draft);
    draftMocks.rejectAiDraft.mockReset();
    draftMocks.rejectAiDraft.mockResolvedValue(undefined);
    authMocks.fetchFarmers.mockReset();
    authMocks.fetchFarmers.mockResolvedValue(farmers);
  });

  test('edits every approval field and approves with normalized values', async () => {
    await renderLoaded();

    fireEvent.changeText(screen.getByLabelText('Judul task'), 'Cek pompa air');
    fireEvent.changeText(
      screen.getByLabelText('Deskripsi task'),
      'Periksa pompa dan saluran air sebelum hujan turun.'
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Pilih prioritas rendah' })
    );
    fireEvent.press(
      screen.getByRole('switch', { name: 'Task memerlukan lokasi' })
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Pilih petani Petani Dua' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Setujui Draft' }));

    await waitFor(() => {
      expect(draftMocks.approveAiDraft).toHaveBeenCalledWith({
        draftId: 'draft-1',
        assigneeId: 'farmer-2',
        title: 'Cek pompa air',
        description: 'Periksa pompa dan saluran air sebelum hujan turun.',
        priority: 'low',
        requiresLocation: false,
      });
    });
  });

  test('renders only normalized weather guidance and the AI reason', async () => {
    await renderLoaded();

    expect(
      screen.getByText('Waktu observasi: 30/07/2026 04.00 WIB')
    ).toBeOnTheScreen();
    expect(screen.getByText('Kondisi: hujan ringan')).toBeOnTheScreen();
    expect(screen.getByText('Suhu: 28°C')).toBeOnTheScreen();
    expect(screen.getByText('Kelembapan: 80%')).toBeOnTheScreen();
    expect(screen.getByText('Angin: 2 m/s')).toBeOnTheScreen();
    expect(screen.getByText('Hujan: 0.4 mm')).toBeOnTheScreen();
    expect(
      screen.getByText('Suhu hari ini: 25–31°C')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Peluang hujan maksimum: 80%')
    ).toBeOnTheScreen();
    expect(screen.getByText(draft.aiReason)).toBeOnTheScreen();
    expect(screen.queryByText(draft.model)).toBeNull();
    expect(screen.queryByText(/current_data|forecast_data|provider-private/)).toBeNull();
  });

  test('approves only once, disables rejection while pending, and returns to the list', async () => {
    const pending = deferred<string>();
    draftMocks.approveAiDraft.mockReturnValue(pending.promise);
    await renderLoaded();
    const approve = screen.getByRole('button', { name: 'Setujui Draft' });
    const reject = screen.getByRole('button', { name: 'Tolak Draft' });

    fireEvent.press(approve);
    fireEvent.press(approve);

    expect(draftMocks.approveAiDraft).toHaveBeenCalledTimes(1);
    expect(approve).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true, busy: true })
    );
    expect(reject).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true })
    );

    await act(async () => {
      pending.resolve('task-1');
      await pending.promise;
    });

    expect(routerMocks.__replace).toHaveBeenCalledWith('/(app)/ai-tasks');
  });

  test.each([
    ['ab', 'Alasan penolakan minimal 3 karakter.'],
    ['   ', 'Alasan penolakan minimal 3 karakter.'],
  ])('requires a useful rejection reason: %s', async (reason, message) => {
    await renderLoaded();
    fireEvent.changeText(screen.getByLabelText('Alasan penolakan'), reason);

    fireEvent.press(screen.getByRole('button', { name: 'Tolak Draft' }));

    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(alertSpy).not.toHaveBeenCalledWith(
      'Tolak draft?',
      expect.any(String),
      expect.any(Array)
    );
    expect(draftMocks.rejectAiDraft).not.toHaveBeenCalled();
  });

  test('confirms rejection, serializes it, and returns to the list', async () => {
    const pending = deferred<void>();
    draftMocks.rejectAiDraft.mockReturnValue(pending.promise);
    await renderLoaded();
    fireEvent.changeText(
      screen.getByLabelText('Alasan penolakan'),
      'Tidak sesuai kondisi lapangan.'
    );
    fireEvent.press(screen.getByRole('button', { name: 'Tolak Draft' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Tolak draft?',
      'Draft akan ditandai ditolak dan tidak dibuat menjadi task.',
      expect.any(Array)
    );

    const confirm = alertSpy.mock.calls
      .at(-1)?.[2]
      ?.find((action) => action.text === 'Tolak');
    act(() => {
      confirm?.onPress?.();
      confirm?.onPress?.();
    });

    expect(draftMocks.rejectAiDraft).toHaveBeenCalledTimes(1);
    expect(draftMocks.rejectAiDraft).toHaveBeenCalledWith(
      'draft-1',
      'Tidak sesuai kondisi lapangan.'
    );
    expect(
      screen.getByRole('button', { name: 'Setujui Draft' })
    ).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true })
    );

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    expect(routerMocks.__replace).toHaveBeenCalledWith('/(app)/ai-tasks');
  });

  test('validates title, description, and an available assignee before approval', async () => {
    authMocks.fetchFarmers.mockResolvedValue([]);
    await renderLoaded();
    fireEvent.changeText(screen.getByLabelText('Judul task'), 'x');
    fireEvent.changeText(screen.getByLabelText('Deskripsi task'), 'pendek');

    fireEvent.press(screen.getByRole('button', { name: 'Setujui Draft' }));

    expect(
      screen.getByText('Judul harus terdiri dari 3–120 karakter.')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Deskripsi harus terdiri dari 10–1500 karakter.')
    ).toBeOnTheScreen();
    expect(
      screen.getByText('Pilih petani penanggung jawab.')
    ).toBeOnTheScreen();
    expect(draftMocks.approveAiDraft).not.toHaveBeenCalled();
  });

  test('does not mount protected review content for the wrong role', () => {
    authContextMocks.__setRole('farmer');

    render(<AiTaskReviewRoute />);

    expect(screen.getByTestId('redirect')).toHaveTextContent('/(app)/petani');
    expect(draftMocks.fetchAiDraftById).not.toHaveBeenCalled();
    expect(authMocks.fetchFarmers).not.toHaveBeenCalled();
  });

  test('never exposes a raw loading backend error', async () => {
    const rawLoadError = 'select ai_task_drafts leaked schema';
    draftMocks.fetchAiDraftById.mockRejectedValue(new Error(rawLoadError));
    render(<AiTaskReviewScreen />);

    expect(
      await screen.findByText(
        'Draft AI belum dapat dimuat. Silakan coba lagi.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByText(rawLoadError)).toBeNull();
  });

  test('never exposes a raw approval backend error', async () => {
    const rawMutationError = 'postgres function stack and row id';
    draftMocks.approveAiDraft.mockRejectedValue(new Error(rawMutationError));
    await renderLoaded();
    fireEvent.press(screen.getByRole('button', { name: 'Setujui Draft' }));

    expect(
      await screen.findByText(
        'Draft belum dapat disetujui. Muat ulang lalu coba lagi.'
      )
    ).toBeOnTheScreen();
    expect(screen.queryByText(rawMutationError)).toBeNull();
    expect(JSON.stringify(alertSpy.mock.calls)).not.toContain(rawMutationError);
  });
});
