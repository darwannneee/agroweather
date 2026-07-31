import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

export function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.glowOne} />
      <View style={styles.glowTwo} />
      <View style={styles.row}>
        <View style={styles.copy}>
          {eyebrow ? (
            <View style={styles.eyebrowPill}>
              <AppText variant="label" color={Colors.forest}>
                {eyebrow.toUpperCase()}
              </AppText>
            </View>
          ) : null}
          <AppText variant="title" color={Colors.surface}>
            {title}
          </AppText>
          {description ? (
            <AppText variant="small" color={Colors.mint}>
              {description}
            </AppText>
          ) : null}
        </View>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.forest,
    borderRadius: Radius.hero,
    padding: Spacing.five,
    borderWidth: 1,
    borderColor: Colors.forestPressed,
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  copy: { flex: 1, gap: Spacing.two },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    backgroundColor: Colors.harvest,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  glowOne: {
    position: 'absolute',
    width: 130,
    height: 130,
    right: -36,
    top: -44,
    borderRadius: 999,
    backgroundColor: 'rgba(243, 191, 79, 0.28)',
  },
  glowTwo: {
    position: 'absolute',
    width: 110,
    height: 110,
    left: -42,
    bottom: -54,
    borderRadius: 999,
    backgroundColor: 'rgba(236, 247, 231, 0.16)',
  },
});
