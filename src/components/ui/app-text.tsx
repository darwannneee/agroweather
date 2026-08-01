import { Text, type TextProps } from 'react-native';

import { Colors, Fonts, Typography } from '@/constants/theme';

type AppTextVariant = keyof typeof Typography;

export function AppText({
  variant = 'body',
  color = Colors.ink,
  style,
  ...props
}: TextProps & { variant?: AppTextVariant; color?: string }) {
  return (
    <Text
      style={[
        Typography[variant],
        {
          color,
          fontFamily: Fonts.sans,
          letterSpacing: variant === 'label' ? 0.7 : -0.1,
        },
        style,
      ]}
      {...props}
    />
  );
}
