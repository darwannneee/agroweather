import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

export function AppScreen({
  children,
  scroll = true,
  contentContainerStyle,
  ...scrollProps
}: ScrollViewProps & { children: ReactNode; scroll?: boolean }) {
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 390 ? 20 : Spacing.five;
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: horizontalPadding },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.content,
        styles.flex,
        { paddingHorizontal: horizontalPadding },
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  flex: { flex: 1 },
  content: {
    paddingVertical: Spacing.four,
    gap: Spacing.four,
  },
});
