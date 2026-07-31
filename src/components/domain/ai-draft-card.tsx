import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AiTaskDraft, TaskPriority } from '@/lib/farm-types';

type AiDraftCardProps = {
  draft: AiTaskDraft;
  onPress: () => void;
};

const priority = {
  low: { label: 'Prioritas rendah', tone: 'neutral' },
  medium: { label: 'Prioritas sedang', tone: 'warning' },
  high: { label: 'Prioritas tinggi', tone: 'danger' },
} as const satisfies Record<
  TaskPriority,
  {
    label: string;
    tone: 'neutral' | 'warning' | 'danger';
  }
>;

export function AiDraftCard({ draft, onPress }: AiDraftCardProps) {
  const priorityStatus = priority[draft.priority];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buka draft AI ${draft.title}, lahan ${draft.plotName}, petani ${draft.proposedAssigneeName}, ${priorityStatus.label.toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressTarget,
        pressed && styles.pressed,
      ]}
    >
      <SurfaceCard>
        <View style={styles.header}>
          <AppText variant="subtitle" style={styles.title}>
            {draft.title}
          </AppText>
          <StatusPill
            label={priorityStatus.label}
            tone={priorityStatus.tone}
          />
        </View>
        <AppText variant="small">Lahan: {draft.plotName}</AppText>
        <AppText variant="small">
          Petani: {draft.proposedAssigneeName}
        </AppText>
        <AppText variant="small">
          Tanggal tugas: {draft.scheduledFor}
        </AppText>
        <AppText variant="small" color={Colors.muted}>
          Alasan AI: {draft.aiReason}
        </AppText>
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
    opacity: 0.82,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
});
