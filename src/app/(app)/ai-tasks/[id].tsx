import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { FormField } from '@/components/ui/form-field';
import { IconBadge } from '@/components/ui/icon-badge';
import { InfoRow } from '@/components/ui/info-row';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type {
  AiTaskDraft,
  TaskPriority,
} from '@/lib/farm-types';
import {
  approveAiDraft,
  fetchAiDraftById,
  rejectAiDraft,
} from '@/services/ai-drafts';
import { fetchFarmers } from '@/services/auth';
import type { AppUser } from '@/services/supabase';

type FormErrors = {
  title: string | null;
  description: string | null;
  assigneeId: string | null;
  priority: string | null;
  rejectionReason: string | null;
};

const emptyErrors: FormErrors = {
  title: null,
  description: null,
  assigneeId: null,
  priority: null,
  rejectionReason: null,
};

const priorityLabels: Record<TaskPriority, string> = {
  low: 'rendah',
  medium: 'sedang',
  high: 'tinggi',
};

function formatWib(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Tidak tersedia';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  return `${values.day}/${values.month}/${values.year} ${values.hour}.${values.minute} WIB`;
}

function ChoiceChip({
  label,
  accessibilityLabel,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.disabled,
      ]}
    >
      {selected ? (
        <AppText variant="smallStrong" color={Colors.surface}>
          ✓
        </AppText>
      ) : null}
      <AppText
        variant="smallStrong"
        color={selected ? Colors.surface : Colors.ink}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function AiTaskReviewScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const draftId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [draft, setDraft] = useState<AiTaskDraft | null>(null);
  const [farmers, setFarmers] = useState<AppUser[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [requiresLocation, setRequiresLocation] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errors, setErrors] = useState<FormErrors>(emptyErrors);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<
    'approve' | 'reject' | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const actionActive = useRef(false);

  const loadDraft = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);
    setDraft(null);

    if (!draftId) {
      setLoadError('Draft AI belum dapat dimuat. Silakan coba lagi.');
      setLoading(false);
      return;
    }

    try {
      const [nextDraft, nextFarmers] = await Promise.all([
        fetchAiDraftById(draftId),
        fetchFarmers(),
      ]);
      if (requestVersion.current !== version) return;
      setDraft(nextDraft);
      setFarmers(nextFarmers);
      setTitle(nextDraft.title);
      setDescription(nextDraft.description);
      setAssigneeId(
        nextFarmers.some(({ id }) => id === nextDraft.proposedAssigneeId)
          ? nextDraft.proposedAssigneeId
          : ''
      );
      setPriority(nextDraft.priority);
      setRequiresLocation(nextDraft.requiresLocation);
      setRejectionReason('');
      setErrors(emptyErrors);
    } catch {
      if (requestVersion.current === version) {
        setLoadError('Draft AI belum dapat dimuat. Silakan coba lagi.');
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, [draftId]);

  useEffect(() => {
    setActionError(null);
    void loadDraft();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadDraft]);

  function validateApproval(): boolean {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const nextErrors: FormErrors = {
      ...emptyErrors,
      title:
        normalizedTitle.length < 3 || normalizedTitle.length > 120
          ? 'Judul harus terdiri dari 3–120 karakter.'
          : null,
      description:
        normalizedDescription.length < 10 ||
        normalizedDescription.length > 1_500
          ? 'Deskripsi harus terdiri dari 10–1500 karakter.'
          : null,
      assigneeId: assigneeId
        ? null
        : 'Pilih petani penanggung jawab.',
      priority: Object.hasOwn(priorityLabels, priority)
        ? null
        : 'Pilih prioritas task.',
    };
    setErrors(nextErrors);
    return !Object.values(nextErrors).some(Boolean);
  }

  async function handleApprove() {
    if (!draft || !draftId || actionActive.current) return;
    if (!validateApproval()) return;

    actionActive.current = true;
    setActionPending('approve');
    setActionError(null);
    try {
      await approveAiDraft({
        draftId,
        assigneeId,
        title,
        description,
        priority,
        requiresLocation,
      });
      router.replace('/(app)/ai-tasks' as Href);
    } catch {
      setActionError(
        'Draft belum dapat disetujui. Muat ulang lalu coba lagi.'
      );
    } finally {
      actionActive.current = false;
      setActionPending(null);
    }
  }

  async function performReject() {
    if (!draftId || actionActive.current) return;

    actionActive.current = true;
    setActionPending('reject');
    setActionError(null);
    try {
      await rejectAiDraft(draftId, rejectionReason.trim());
      router.replace('/(app)/ai-tasks' as Href);
    } catch {
      setActionError(
        'Draft belum dapat ditolak. Muat ulang lalu coba lagi.'
      );
    } finally {
      actionActive.current = false;
      setActionPending(null);
    }
  }

  function confirmReject() {
    if (actionActive.current) return;
    if (rejectionReason.trim().length < 3) {
      setErrors((current) => ({
        ...current,
        rejectionReason: 'Alasan penolakan minimal 3 karakter.',
      }));
      return;
    }
    setErrors((current) => ({ ...current, rejectionReason: null }));
    Alert.alert(
      'Tolak draft?',
      'Draft akan ditandai ditolak dan tidak dibuat menjadi task.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Tolak',
          style: 'destructive',
          onPress: () => {
            void performReject();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <AppScreen>
        <FeedbackState title="Memuat detail draft…" loading />
      </AppScreen>
    );
  }

  if (loadError || !draft) {
    return (
      <AppScreen>
        <FeedbackState
          title="Review draft belum tersedia"
          message={
            loadError ?? 'Draft AI belum dapat dimuat. Silakan coba lagi.'
          }
          actionLabel="Coba Lagi"
          onAction={() => void loadDraft()}
        />
      </AppScreen>
    );
  }

  const weather = draft.weather;
  const temperatureRange =
    weather.forecastMinTemperatureC === null ||
    weather.forecastMaxTemperatureC === null
      ? 'Tidak tersedia'
      : `${weather.forecastMinTemperatureC}–${weather.forecastMaxTemperatureC}°C`;
  const rainProbability =
    weather.forecastMaxRainProbability === null
      ? 'Tidak tersedia'
      : `${Math.round(weather.forecastMaxRainProbability * 100)}%`;
  const actionsBlocked = actionPending !== null;

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Review Task AI"
        title={draft.plotName}
        description={`Draft untuk ${draft.scheduledFor}. Periksa semua detail sebelum menyetujui.`}
      />

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <IconBadge icon="🌤️" label="Ringkasan Cuaca" tone="sky" />
          <View style={styles.cardCopy}>
            <AppText variant="subtitle">Ringkasan Cuaca</AppText>
            <AppText variant="small" color={Colors.muted}>
              Kondisi saat draft dibuat dan proyeksi hari ini.
            </AppText>
          </View>
        </View>
        <InfoRow
          icon="🕒"
          label="Waktu observasi"
          value={`Waktu observasi: ${formatWib(weather.observedAt)}`}
          tone="sky"
        />
        <InfoRow
          icon="☁️"
          label="Kondisi"
          value={`Kondisi: ${weather.description}`}
        />
        <InfoRow
          icon="🌡️"
          label="Suhu"
          value={`Suhu: ${weather.temperatureC}°C`}
          tone="amber"
        />
        <InfoRow
          icon="💧"
          label="Kelembapan"
          value={`Kelembapan: ${weather.humidityPercent}%`}
          tone="sky"
        />
        <InfoRow
          icon="🌬️"
          label="Angin"
          value={`Angin: ${weather.windSpeedMps} m/s`}
        />
        <InfoRow
          icon="☔"
          label="Hujan"
          value={`Hujan: ${weather.rainMm} mm`}
          tone="sky"
        />
        <InfoRow
          icon="📈"
          label="Suhu hari ini"
          value={`Suhu hari ini: ${temperatureRange}`}
          tone="amber"
        />
        <InfoRow
          icon="🌧️"
          label="Peluang hujan"
          value={`Peluang hujan maksimum: ${rainProbability}`}
          tone="sky"
        />
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <IconBadge icon="🤖" label="Alasan Rekomendasi AI" />
          <View style={styles.cardCopy}>
            <AppText variant="subtitle">Alasan Rekomendasi AI</AppText>
            <AppText variant="small" color={Colors.muted}>
              Justifikasi yang dipakai sebelum draft disetujui.
            </AppText>
          </View>
        </View>
        <AppText>{draft.aiReason}</AppText>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <IconBadge icon="📝" label="Detail Task" tone="amber" />
          <View style={styles.cardCopy}>
            <AppText variant="subtitle">Detail Task</AppText>
            <AppText variant="small" color={Colors.muted}>
              Edit instruksi final sebelum dibuat menjadi task aktif.
            </AppText>
          </View>
        </View>
        <FormField
          label="Judul task"
          error={errors.title}
          inputProps={{
            accessibilityLabel: 'Judul task',
            value: title,
            editable: !actionsBlocked,
            maxLength: 120,
            onChangeText: setTitle,
          }}
        />
        <FormField
          label="Deskripsi task"
          error={errors.description}
          inputProps={{
            accessibilityLabel: 'Deskripsi task',
            value: description,
            editable: !actionsBlocked,
            maxLength: 1_500,
            multiline: true,
            onChangeText: setDescription,
          }}
        />

        <AppText variant="smallStrong">Prioritas</AppText>
        <View style={styles.chipGroup}>
          {(
            Object.entries(priorityLabels) as [
              TaskPriority,
              string,
            ][]
          ).map(([value, label]) => (
            <ChoiceChip
              key={value}
              label={label}
              accessibilityLabel={`Pilih prioritas ${label}`}
              selected={priority === value}
              disabled={actionsBlocked}
              onPress={() => setPriority(value)}
            />
          ))}
        </View>

        <AppText variant="smallStrong">Petani Penanggung Jawab</AppText>
        <View style={styles.chipGroup}>
          {farmers.map((farmer) => (
            <ChoiceChip
              key={farmer.id}
              label={farmer.nama}
              accessibilityLabel={`Pilih petani ${farmer.nama}`}
              selected={assigneeId === farmer.id}
              disabled={actionsBlocked}
              onPress={() => setAssigneeId(farmer.id)}
            />
          ))}
        </View>
        {farmers.length === 0 ? (
          <AppText variant="small" color={Colors.muted}>
            Belum ada petani yang dapat dipilih.
          </AppText>
        ) : null}
        {errors.assigneeId ? (
          <AppText variant="small" color={Colors.dangerText}>
            {errors.assigneeId}
          </AppText>
        ) : null}

        <Pressable
          accessibilityLabel="Task memerlukan lokasi"
          accessibilityRole="switch"
          accessibilityState={{
            checked: requiresLocation,
            disabled: actionsBlocked,
          }}
          disabled={actionsBlocked}
          onPress={() => setRequiresLocation((current) => !current)}
          style={[
            styles.locationSwitch,
            requiresLocation && styles.locationSwitchSelected,
            actionsBlocked && styles.disabled,
          ]}
        >
          <View style={styles.switchContent}>
            <IconBadge
              icon={requiresLocation ? '📍' : '📎'}
              label="Kebutuhan lokasi"
              tone={requiresLocation ? 'forest' : 'neutral'}
              size="sm"
            />
            <AppText
              variant="bodyStrong"
              color={requiresLocation ? Colors.surface : Colors.ink}
            >
              {requiresLocation
                ? 'Bukti wajib menyertakan lokasi'
                : 'Lokasi tidak diwajibkan'}
            </AppText>
          </View>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.cardHeader}>
          <IconBadge icon="⚖️" label="Keputusan Review" tone="sky" />
          <View style={styles.cardCopy}>
            <AppText variant="subtitle">Keputusan Review</AppText>
            <AppText variant="small" color={Colors.muted}>
              Setujui draft atau tolak dengan alasan yang jelas.
            </AppText>
          </View>
        </View>
        <FormField
          label="Alasan penolakan"
          error={errors.rejectionReason}
          help="Wajib diisi minimal 3 karakter jika draft ditolak."
          inputProps={{
            accessibilityLabel: 'Alasan penolakan',
            value: rejectionReason,
            editable: !actionsBlocked,
            maxLength: 1_000,
            multiline: true,
            onChangeText: setRejectionReason,
          }}
        />
        {actionError ? (
          <AppText
            variant="smallStrong"
            color={Colors.dangerText}
            accessibilityLiveRegion="polite"
          >
            {actionError}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <View style={styles.action}>
            <AppButton
              label="Tolak Draft"
              variant="danger"
              icon="×"
              loading={actionPending === 'reject'}
              disabled={actionsBlocked}
              onPress={confirmReject}
            />
          </View>
          <View style={styles.action}>
            <AppButton
              label="Setujui Draft"
              variant="forest"
              icon="✓"
              loading={actionPending === 'approve'}
              disabled={actionsBlocked}
              onPress={() => void handleApprove()}
            />
          </View>
        </View>
      </SurfaceCard>
    </AppScreen>
  );
}

export default function AiTaskReviewRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <AiTaskReviewScreen />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  cardCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.canvas,
  },
  chipSelected: {
    backgroundColor: Colors.forest,
    borderColor: Colors.forest,
    shadowColor: Colors.forest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  disabled: {
    opacity: 0.55,
  },
  locationSwitch: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: Radius.button,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.canvas,
  },
  locationSwitchSelected: {
    backgroundColor: Colors.forest,
    borderColor: Colors.forest,
  },
  switchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  action: {
    flex: 1,
  },
});
