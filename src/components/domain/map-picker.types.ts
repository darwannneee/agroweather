import type { Coordinates } from '@/lib/geofence';

export type MapPickerProps = {
  value: Coordinates | null;
  radiusM: number;
  onConfirm: (coords: Coordinates) => void;
  requestedLocation?: Coordinates | null;
  locating?: boolean;
  locationError?: string | null;
  onRequestLocation?: () => void;
};
