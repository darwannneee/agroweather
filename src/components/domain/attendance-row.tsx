import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AttendanceRecord } from '@/lib/farm-types';

type AttendanceRowProps =
  | {
      farmerName: string;
      status: 'present';
      record: AttendanceRecord;
      onPress: () => void;
    }
  | {
      farmerName: string;
      status: 'absent';
      record: null;
      onPress?: never;
    };

type AttendanceContentProps = {
  farmerName: string;
} & (
  | { status: 'present'; record: AttendanceRecord }
  | { status: 'absent'; record: null }
);

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
}: AttendanceContentProps) {
  const present = status === 'present';
  const iconColor = present ? Colors.forest : Colors.amberText;
  const iconBg = present ? Colors.successBackground : Colors.warningBackground;

  return (
    <SurfaceCard style={styles.cardContainer}>
      <View style={styles.header}>
        {/* Mengganti IconBadge Emoji dengan Icon Modern */}
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Feather 
            name={present ? "check-circle" : "clock"} 
            size={20} 
            color={iconColor} 
          />
        </View>

        <View style={styles.name}>
          <AppText variant="subtitle">
            {farmerName}
          </AppText>
          {present ? (
            <View style={styles.metaRow}>
              <Feather name="map-pin" size={12} color={Colors.muted} />
              <AppText variant="small" color={Colors.muted}>
                {jakartaTime(record.checkedInAt)} · {record.plotName}
              </AppText>
            </View>
          ) : (
            <View style={styles.metaRow}>
              <Feather name="info" size={12} color={Colors.muted} />
              <AppText variant="small" color={Colors.muted}>
                Menunggu check-in GPS hari ini
              </AppText>
            </View>
          )}
        </View>
        <StatusPill
          label={present ? 'Sudah absen' : 'Belum absen'}
          tone={present ? 'success' : 'neutral'}
        />
      </View>
    </SurfaceCard>
  );
}

export function AttendanceRow({
  farmerName,
  status,
  record,
  onPress,
}: AttendanceRowProps) {
  if (status === 'present') {
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
      accessibilityLabel={`Kehadiran ${farmerName}, belum absen`}
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
  cardContainer: {
    paddingVertical: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  }
});