import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { IconBadge } from '@/components/ui/icon-badge';
import { InfoRow } from '@/components/ui/info-row';
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
        <IconBadge icon="📸" label={photoLabel} tone="sky" />
        <View style={styles.title}>
          <AppText variant="subtitle">
            Percobaan {attempt.attemptNumber}
          </AppText>
          <AppText variant="small" color={Colors.muted}>
            Bukti pekerjaan lapangan
          </AppText>
        </View>
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

      <InfoRow
        icon="🧑‍🌾"
        label="Petani"
        value={`Catatan petani: ${attempt.note ?? 'Tidak ada catatan'}`}
        tone="forest"
      />
      {attempt.reviewNote ? (
        <InfoRow
          icon="📝"
          label="Reviewer"
          value={`Catatan reviewer: ${attempt.reviewNote}`}
          tone="amber"
        />
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  title: {
    flex: 1,
    gap: Spacing.one,
  },
  photo: {
    width: '100%',
    height: 180,
    borderRadius: Radius.card,
  },
});
