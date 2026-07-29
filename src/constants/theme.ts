import { Platform } from 'react-native';

export const Colors = {
  forest: '#1F542E',
  forestPressed: '#173F23',
  forestMuted: '#314A38',
  harvest: '#F3BF4F',
  harvestPressed: '#DDA936',
  canvas: '#F6F8F3',
  surface: '#FFFFFF',
  ink: '#203026',
  muted: '#657165',
  border: '#DFE7DC',
  successBackground: '#DCEBD8',
  successBorder: '#BDD4B8',
  successText: '#21492A',
  warningBackground: '#FFF3D8',
  warningBorder: '#EBD298',
  warningText: '#71541D',
  dangerBackground: '#FDE7E1',
  dangerBorder: '#EBC1B6',
  dangerText: '#633027',
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  input: 12,
  button: 14,
  card: 18,
  hero: 20,
  pill: 999,
} as const;

export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800' as const },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  smallStrong: { fontSize: 14, lineHeight: 20, fontWeight: '700' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '800' as const },
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: 'system-ui, sans-serif', mono: 'ui-monospace, monospace' },
});
