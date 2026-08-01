import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking } from 'react-native';

import {
  EvidencePicker,
  type EvidenceAsset,
} from '../evidence-picker';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

const imagePickerMocks = jest.requireMock('expo-image-picker') as {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
  requestCameraPermissionsAsync: jest.Mock;
  launchCameraAsync: jest.Mock;
};

const existingAsset: EvidenceAsset = {
  uri: 'file://existing.jpg',
  mimeType: 'image/jpeg',
};

const galleryAsset = {
  canceled: false,
  assets: [{ uri: 'file://gallery.png', mimeType: 'image/png' }],
};

const cameraAsset = {
  canceled: false,
  assets: [{ uri: 'file://camera.jpg', mimeType: null }],
};

describe('EvidencePicker', () => {
  beforeEach(() => {
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockReset();
    imagePickerMocks.launchImageLibraryAsync.mockReset();
    imagePickerMocks.requestCameraPermissionsAsync.mockReset();
    imagePickerMocks.launchCameraAsync.mockReset();
    jest.restoreAllMocks();
  });

  test('shows a retryable inline denial and clears it after a successful retry', async () => {
    const onChange = jest.fn();
    imagePickerMocks.requestMediaLibraryPermissionsAsync
      .mockResolvedValueOnce({ granted: false, canAskAgain: true })
      .mockResolvedValueOnce({ granted: true, canAskAgain: true });
    imagePickerMocks.launchImageLibraryAsync.mockResolvedValue(galleryAsset);
    render(<EvidencePicker asset={null} onChange={onChange} />);

    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));

    expect(
      await screen.findByText('Izin foto diperlukan untuk memilih bukti.')
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Buka Pengaturan' })).toBeNull();
    expect(imagePickerMocks.launchImageLibraryAsync).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        uri: 'file://gallery.png',
        mimeType: 'image/png',
      });
    });
    expect(
      screen.queryByText('Izin foto diperlukan untuk memilih bukti.')
    ).toBeNull();
  });

  test('shows blocked permission guidance and opens app settings', async () => {
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined);
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    render(<EvidencePicker asset={null} onChange={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));

    expect(
      await screen.findByText(
        'Izin foto diblokir. Aktifkan izin AgroWeather di Pengaturan.'
      )
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Buka Pengaturan' }));
    await waitFor(() => {
      expect(openSettings).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('button', { name: 'Buka Pengaturan' })
      ).not.toBeDisabled();
    });
  });

  test('shows a safe inline message for camera permission denial', async () => {
    imagePickerMocks.requestCameraPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: true,
    });
    render(<EvidencePicker asset={null} onChange={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Ambil Foto' }));

    expect(
      await screen.findByText('Izin foto diperlukan untuk memilih bukti.')
    ).toBeOnTheScreen();
    expect(imagePickerMocks.launchCameraAsync).not.toHaveBeenCalled();
  });

  test('never exposes a raw native picker error', async () => {
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });
    imagePickerMocks.launchImageLibraryAsync.mockRejectedValue(
      new Error('PHPhotoLibrary internal failure')
    );
    render(<EvidencePicker asset={null} onChange={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));

    expect(
      await screen.findByText('Foto belum dapat dibuka. Coba lagi.')
    ).toBeOnTheScreen();
    expect(screen.queryByText('PHPhotoLibrary internal failure')).toBeNull();
  });

  test('shows a safe message when the picker returns no usable asset', async () => {
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });
    imagePickerMocks.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [],
    });
    render(<EvidencePicker asset={null} onChange={jest.fn()} />);

    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));

    expect(
      await screen.findByText(
        'Foto yang dipilih belum dapat digunakan. Coba foto lain.'
      )
    ).toBeOnTheScreen();
  });

  test('serializes gallery and camera actions through picker completion', async () => {
    let resolvePermission!: (value: {
      granted: boolean;
      canAskAgain: boolean;
    }) => void;
    let resolvePicker!: (value: typeof galleryAsset) => void;
    const onChange = jest.fn();
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePermission = resolve;
        })
    );
    imagePickerMocks.launchImageLibraryAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePicker = resolve;
        })
    );
    render(<EvidencePicker asset={null} onChange={onChange} />);
    const galleryButton = screen.getByRole('button', {
      name: 'Pilih Foto Bukti',
    });
    const cameraButton = screen.getByRole('button', { name: 'Ambil Foto' });

    fireEvent.press(galleryButton);
    fireEvent.press(galleryButton);
    fireEvent.press(cameraButton);

    expect(
      imagePickerMocks.requestMediaLibraryPermissionsAsync
    ).toHaveBeenCalledTimes(1);
    expect(imagePickerMocks.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(galleryButton).toBeDisabled();
    expect(cameraButton).toBeDisabled();

    await act(async () => {
      resolvePermission({ granted: true, canAskAgain: true });
    });
    await waitFor(() => {
      expect(imagePickerMocks.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: 'Pilih Foto Bukti' })).toBeDisabled();

    await act(async () => {
      resolvePicker(galleryAsset);
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('button', { name: 'Pilih Foto Bukti' })
      ).not.toBeDisabled();
    });
  });

  test('ignores a permission completion after unmount', async () => {
    let resolvePermission!: (value: {
      granted: boolean;
      canAskAgain: boolean;
    }) => void;
    const onChange = jest.fn();
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePermission = resolve;
        })
    );
    const view = render(<EvidencePicker asset={null} onChange={onChange} />);

    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));
    view.unmount();
    await act(async () => {
      resolvePermission({ granted: true, canAskAgain: true });
    });

    expect(imagePickerMocks.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('picks from gallery, captures a replacement, and deletes the current asset', async () => {
    const onChange = jest.fn();
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });
    imagePickerMocks.launchImageLibraryAsync.mockResolvedValue(galleryAsset);
    imagePickerMocks.requestCameraPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
    });
    imagePickerMocks.launchCameraAsync.mockResolvedValue(cameraAsset);
    const view = render(<EvidencePicker asset={null} onChange={onChange} />);

    expect(screen.getByText('Foto Bukti')).toBeOnTheScreen();
    expect(
      screen.getByText('Ambil foto terbaru atau pilih dari galeri.')
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        uri: 'file://gallery.png',
        mimeType: 'image/png',
      });
    });

    view.rerender(
      <EvidencePicker asset={existingAsset} onChange={onChange} />
    );
    expect(screen.getByLabelText('Pratinjau foto bukti')).toHaveProp('source', {
      uri: existingAsset.uri,
    });
    fireEvent.press(screen.getByRole('button', { name: 'Ambil Foto' }));
    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith({
        uri: 'file://camera.jpg',
        mimeType: 'image/jpeg',
      });
    });

    fireEvent.press(screen.getByRole('button', { name: 'Hapus Foto' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  test('disables gallery, camera, settings, and delete actions', async () => {
    const onChange = jest.fn();
    imagePickerMocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    });
    const view = render(
      <EvidencePicker asset={null} onChange={onChange} />
    );
    fireEvent.press(screen.getByRole('button', { name: 'Pilih Foto Bukti' }));
    await screen.findByRole('button', { name: 'Buka Pengaturan' });

    view.rerender(
      <EvidencePicker asset={existingAsset} onChange={onChange} disabled />
    );
    const galleryButton = screen.getByRole('button', {
      name: 'Ganti Foto Bukti',
    });
    const cameraButton = screen.getByRole('button', { name: 'Ambil Foto' });
    const settingsButton = screen.getByRole('button', {
      name: 'Buka Pengaturan',
    });
    const deleteButton = screen.getByRole('button', { name: 'Hapus Foto' });

    expect(galleryButton).toBeDisabled();
    expect(cameraButton).toBeDisabled();
    expect(settingsButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();

    fireEvent.press(galleryButton);
    fireEvent.press(cameraButton);
    fireEvent.press(settingsButton);
    fireEvent.press(deleteButton);
    expect(
      imagePickerMocks.requestMediaLibraryPermissionsAsync
    ).toHaveBeenCalledTimes(1);
    expect(imagePickerMocks.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
