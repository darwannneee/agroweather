import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { FarmTask } from '@/lib/farm-types';

export type TaskCardState =
  | 'not-started'
  | 'ready'
  | 'check-location'
  | 'outside'
  | 'pending-review'
  | 'revision-needed'
  | 'completed';

type TaskCardProps = {
  task: FarmTask;
  plotName: string;
  state: TaskCardState;
  radiusM?: number;
  onPress: () => void;
};

const taskState = {
  'not-started': { label: 'Belum dimulai', tone: 'neutral' },
  ready: { label: 'Siap', tone: 'success' },
  'check-location': { label: 'Perlu cek lokasi', tone: 'warning' },
  outside: { label: 'Di luar radius', tone: 'danger' },
  'pending-review': { label: 'Menunggu review', tone: 'warning' },
  'revision-needed': { label: 'Perlu perbaikan', tone: 'danger' },
  completed: { label: 'Selesai', tone: 'neutral' },
} as const;

const priorityLabel = {
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
} as const;

export function TaskCard({ task, plotName, state, radiusM, onPress }: TaskCardProps) {
  const status = taskState[state];
  const showRadius = (state === 'outside' || state === 'check-location') && radiusM !== undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Buka tugas ${task.judul}`}
      onPress={onPress}
      style={({ pressed }) => [styles.pressTarget, pressed && styles.pressed]}
    >
      <SurfaceCard>
        <View style={styles.header}>
          <View style={styles.copy}>
            <AppText variant="subtitle">{task.judul}</AppText>
            <AppText variant="small" color={Colors.muted}>
              Lahan: {plotName}
            </AppText>
          </View>
          <StatusPill label={status.label} tone={status.tone} />
        </View>

        <AppText variant="small">
          Prioritas: {priorityLabel[task.priority]}
        </AppText>
        <AppText variant="small">
          Tanggal tugas: {task.scheduledFor}
        </AppText>
        {task.deadline ? (
          <AppText variant="small">Deadline: {task.deadline}</AppText>
        ) : null}
        {showRadius ? (
          <AppText variant="small">Radius lahan: {radiusM} meter</AppText>
        ) : null}
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
  copy: {
    flex: 1,
  },
});
