import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AiTaskDraft, TaskPriority } from '@/lib/farm-types';

type AiDraftCardProps = {
  draft: AiTaskDraft;
  onPress: () => void;
  disabled?: boolean;
};

const priority = {
  low: { label: 'Rendah', tone: 'neutral' },
  medium: { label: 'Sedang', tone: 'warning' },
  high: { label: 'Tinggi', tone: 'danger' },
} as const satisfies Record<
  TaskPriority,
  {
    label: string;
    tone: 'neutral' | 'warning' | 'danger';
  }
>;

export function AiDraftCard({ draft, onPress, disabled = false }: AiDraftCardProps) {
  const priorityStatus = priority[draft.priority];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buka draft AI ${draft.title}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressTarget,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <SurfaceCard style={styles.cardContainer}>
        <View style={styles.cardContent}>
          {/* Header: Judul Tugas & Status Prioritas */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <AppText variant="bodyStrong" style={styles.titleText}>
                {draft.title}
              </AppText>
              <AppText variant="small" color={Colors.muted}>
                Rekomendasi Operasional AI
              </AppText>
            </View>
            <StatusPill
              label={priorityStatus.label}
              tone={priorityStatus.tone}
            />
          </View>

          {/* Baris Informasi Detail (Lahan, Petani, Tanggal) */}
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <AppText variant="small" color={Colors.muted}>
                Lahan
              </AppText>
              <AppText variant="smallStrong" color={Colors.ink} numberOfLines={1}>
                {draft.plotName}
              </AppText>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.metaItem}>
              <AppText variant="small" color={Colors.muted}>
                Petani
              </AppText>
              <AppText variant="smallStrong" color={Colors.ink} numberOfLines={1}>
                {draft.proposedAssigneeName}
              </AppText>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.metaItem}>
              <AppText variant="small" color={Colors.muted}>
                Tanggal
              </AppText>
              <AppText variant="smallStrong" color={Colors.ink} numberOfLines={1}>
                {draft.scheduledFor}
              </AppText>
            </View>
          </View>

          {/* Box Alasan AI */}
          <View style={styles.reasonBox}>
            <AppText variant="smallStrong" color={Colors.ink} style={styles.reasonTitle}>
              Alasan AI
            </AppText>
            <AppText variant="small" color={Colors.muted} style={styles.reasonText}>
              {draft.aiReason}
            </AppText>
          </View>
        </View>
      </SurfaceCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressTarget: {
    minHeight: 44,
    borderRadius: Radius.card,
  },
  pressed: {
    opacity: 0.75, // Efek sedikit pudar saat kartu diklik
  },
  disabled: {
    opacity: 0.55,
  },
  cardContainer: {
    padding: Spacing.three,
  },
  cardContent: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  titleContainer: {
    flex: 1,
    gap: 2,
  },
  titleText: {
    lineHeight: 22,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.canvas,
    borderRadius: Radius.card,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.border,
  },
  reasonBox: {
    backgroundColor: Colors.canvas,
    padding: Spacing.three,
    borderRadius: Radius.card,
    borderLeftWidth: 3,
    borderLeftColor: Colors.forest,
  },
  reasonTitle: {
    marginBottom: 4,
  },
  reasonText: {
    lineHeight: 18,
  },
});