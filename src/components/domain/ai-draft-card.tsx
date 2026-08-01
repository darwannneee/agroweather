import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { IconBadge } from '@/components/ui/icon-badge';
import { InfoRow } from '@/components/ui/info-row';
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

export function AiDraftCard({
  draft,
  onPress,
  disabled = false,
}: AiDraftCardProps) {
  const priorityStatus = priority[draft.priority];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buka draft AI ${draft.title}, lahan ${draft.plotName}, petani ${draft.proposedAssigneeName}, ${priorityStatus.label.toLowerCase()}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressTarget,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <SurfaceCard>
        <View style={styles.header}>
          <IconBadge icon="🤖" label={`Draft AI ${draft.title}`} tone="amber" />
          <View style={styles.title}>
            <AppText variant="subtitle">
              {draft.title}
            </AppText>
            <AppText variant="small" color={Colors.muted}>
              Rekomendasi operasional dari AI
            </AppText>
          </View>
          <StatusPill
            label={priorityStatus.label}
            tone={priorityStatus.tone}
          />
        </View>
        <InfoRow
          icon="🌾"
          label="Lahan"
          value={`Lahan: ${draft.plotName}`}
          tone="forest"
        />
        <InfoRow
          icon="👨‍🌾"
          label="Petani"
          value={`Petani: ${draft.proposedAssigneeName}`}
          tone="sky"
        />
        <InfoRow
          icon="📅"
          label="Tanggal"
          value={`Tanggal tugas: ${draft.scheduledFor}`}
          tone="neutral"
        />
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
  disabled: {
    opacity: 0.55,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  title: {
    flex: 1,
    gap: Spacing.one,
  },
});
