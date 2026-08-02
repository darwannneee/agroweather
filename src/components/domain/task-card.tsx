import { Feather } from '@expo/vector-icons';
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
  ready: { label: 'Siap dikerjakan', tone: 'success' },
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

function TaskDetailItem({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: keyof typeof Feather.glyphMap, 
  label: string, 
  value: string, 
  color: string 
}) {
  return (
    <View style={styles.detailItem}>
      <Feather name={icon} size={14} color={color} />
      <AppText variant="small" color={Colors.muted} style={styles.detailLabel}>
        {label}
      </AppText>
      <AppText variant="smallStrong" color={Colors.ink}>{value}</AppText>
    </View>
  );
}

export function TaskCard({ task, plotName, state, radiusM, onPress }: TaskCardProps) {
  const status = taskState[state];
  const showRadius = (state === 'outside' || state === 'check-location') && radiusM !== undefined;
  const accessibilityLabel = [
    `Buka tugas ${task.judul}`,
    `lahan ${plotName}`,
    `status ${status.label}`,
    `prioritas ${priorityLabel[task.priority]}`,
    `tanggal ${task.scheduledFor}`,
  ].join(', ');

  const priorityColor = 
    task.priority === 'high' ? Colors.dangerText : 
    task.priority === 'medium' ? Colors.amberText : 
    Colors.forest;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.pressTarget, pressed && styles.pressed]}
    >
      <SurfaceCard style={styles.cardLayout}>
        <View style={styles.header}>
          <View style={styles.iconBox}>
            <Feather name="clipboard" size={20} color={Colors.skyText} />
          </View>
          <View style={styles.copy}>
            <AppText variant="bodyStrong">{task.judul}</AppText>
            <View style={styles.plotRow}>
              <Feather name="map" size={12} color={Colors.muted} />
              <AppText variant="small" color={Colors.muted}>
                {plotName}
              </AppText>
            </View>
          </View>
          <StatusPill label={status.label} tone={status.tone} />
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <TaskDetailItem 
            icon="flag" 
            label="Prioritas" 
            value={priorityLabel[task.priority]} 
            color={priorityColor} 
          />
          <TaskDetailItem 
            icon="calendar" 
            label="Tanggal" 
            value={task.scheduledFor} 
            color={Colors.muted} 
          />
          
          {task.deadline && (
            <TaskDetailItem 
              icon="clock" 
              label="Deadline" 
              value={task.deadline} 
              color={Colors.amberText} 
            />
          )}
          
          {showRadius && (
            <TaskDetailItem 
              icon="crosshair" 
              label="Radius" 
              value={`${radiusM}m`} 
              color={Colors.forest} 
            />
          )}
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
    opacity: 0.85,
  },
  cardLayout: {
    gap: 0,
    padding: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.three,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  plotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.three,
  },
  infoGrid: {
    gap: Spacing.two,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  detailLabel: {
    width: 70, 
  }
});