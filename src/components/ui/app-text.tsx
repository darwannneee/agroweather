import { Text, type TextProps } from 'react-native';

import { Colors, Typography } from '@/constants/theme';

type AppTextVariant = keyof typeof Typography;

export function AppText({
  variant = 'body',
  color = Colors.ink,
  style,
  ...props
}: TextProps & { variant?: AppTextVariant; color?: string }) {
  return <Text style={[Typography[variant], { color }, style]} {...props} />;
}
