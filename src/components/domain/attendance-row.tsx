import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AttendanceRecord } from '@/lib/farm-types';

type AttendanceRowProps = {
  farmerName: string;
  status: 'present' | 'absent';
  record: AttendanceRecord | null;
  onPress?: () => void;
};

function jakartaTime(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue])
  );
  return `${values.hour}.${values.minute} WIB`;
}

function AttendanceContent({
  farmerName,
  status,
  record,
}: Omit<AttendanceRowProps, 'onPress'>) {
  const present = status === 'present' && record !== null;

  return (
    <SurfaceCard>
      <View style={styles.header}>
        <AppText variant="subtitle" style={styles.name}>
          {farmerName}
        </AppText>
        <StatusPill
          label={present ? 'Sudah absen' : 'Belum absen'}
          tone={present ? 'success' : 'neutral'}
        />
      </View>
      {present ? (
        <AppText variant="small" color={Colors.muted}>
          {jakartaTime(record.checkedInAt)} · {record.plotName}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

export function AttendanceRow({
  farmerName,
  status,
  record,
  onPress,
}: AttendanceRowProps) {
  if (status === 'present' && record && onPress) {
    const time = jakartaTime(record.checkedInAt);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Buka detail kehadiran ${farmerName}, sudah absen pukul ${time} di ${record.plotName}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.pressTarget,
          pressed && styles.pressed,
        ]}
      >
        <AttendanceContent
          farmerName={farmerName}
          status={status}
          record={record}
        />
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={`Kehadiran ${farmerName}, ${
        status === 'present' ? 'sudah absen' : 'belum absen'
      }`}
    >
      <AttendanceContent
        farmerName={farmerName}
        status={status}
        record={record}
      />
    </View>
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
  name: {
    flex: 1,
  },
});
