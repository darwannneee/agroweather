import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { StatusPill } from '@/components/ui/status-pill';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type {
  EvidenceAttempt,
  EvidenceReviewStatus,
} from '@/lib/farm-types';

type EvidenceAttemptCardProps = {
  attempt: EvidenceAttempt;
};

const evidenceTone = {
  pending: { label: 'Menunggu review', tone: 'warning' },
  accepted: { label: 'Diterima', tone: 'success' },
  revision_requested: { label: 'Perlu perbaikan', tone: 'danger' },
} as const satisfies Record<
  EvidenceReviewStatus,
  {
    label: string;
    tone: 'warning' | 'success' | 'danger';
  }
>;

export function EvidenceAttemptCard({
  attempt,
}: EvidenceAttemptCardProps) {
  const review = evidenceTone[attempt.status];
  const photoLabel = `Foto bukti percobaan ${attempt.attemptNumber}`;

  return (
    <SurfaceCard>
      <View style={styles.header}>
        <AppText variant="subtitle" style={styles.title}>
          Percobaan {attempt.attemptNumber}
        </AppText>
        <StatusPill label={review.label} tone={review.tone} />
      </View>

      {attempt.photoUrl ? (
        <Image
          accessibilityLabel={photoLabel}
          source={{ uri: attempt.photoUrl }}
          style={styles.photo}
        />
      ) : (
        <AppText
          accessibilityLabel={`${photoLabel} tidak tersedia`}
          variant="small"
          color={Colors.muted}
        >
          Foto tidak tersedia
        </AppText>
      )}

      <AppText variant="small">
        Catatan petani: {attempt.note ?? 'Tidak ada catatan'}
      </AppText>
      {attempt.reviewNote ? (
        <AppText variant="small" color={Colors.muted}>
          Catatan reviewer: {attempt.reviewNote}
        </AppText>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: Radius.card,
  },
});
