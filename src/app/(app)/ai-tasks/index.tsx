import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';

import { AiDraftCard } from '@/components/domain/ai-draft-card';
import { RoleGuard } from '@/components/domain/role-guard';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { jakartaDate } from '@/lib/daily-operations';
import type {
  AiTaskDraft,
  FarmPlot,
  TaskPriority,
} from '@/lib/farm-types';
import {
  approveAiDrafts,
  fetchAiDrafts,
  invokeAiGeneration,
  type GenerationInvocationResult,
} from '@/services/ai-drafts';
import { fetchFarmers } from '@/services/auth';
import { fetchPlots } from '@/services/plots';
import type { AppUser } from '@/services/supabase';

type FilterValue = string | null;

const priorityLabels: Record<TaskPriority, string> = {
  low: 'rendah',
  medium: 'sedang',
  high: 'tinggi',
};

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function generationCopy(result: GenerationInvocationResult): string {
  if (result.status === 'failed') {
    return 'Generasi gagal: belum ada draft yang dibuat.';
  }
  if (result.status === 'partial') {
    return `Generasi selesai sebagian: ${result.successCount} berhasil, ${result.skippedCount} dilewati, ${result.failedCount} gagal.`;
  }
  return `Generasi selesai: ${result.successCount} draft berhasil dibuat.`;
}

function SelectChip({
  label,
  accessibilityLabel,
  selected,
  disabled = false,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  disabled?: boolean;
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
      <AppText
        variant="smallStrong"
        color={selected ? Colors.surface : Colors.ink}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function AiTasksScreen() {
  const router = useRouter();
  const scheduledFor = jakartaDate();
  const [plots, setPlots] = useState<FarmPlot[]>([]);
  const [farmers, setFarmers] = useState<AppUser[]>([]);
  const [drafts, setDrafts] = useState<AiTaskDraft[]>([]);
  const [selectedPlotIds, setSelectedPlotIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    new Set()
  );
  const [plotFilter, setPlotFilter] = useState<FilterValue>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<FilterValue>(null);
  const [priorityFilter, setPriorityFilter] =
    useState<TaskPriority | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generationPending, setGenerationPending] = useState(false);
  const [generationFeedback, setGenerationFeedback] = useState<string | null>(
    null
  );
  const [generationWarningCount, setGenerationWarningCount] = useState(0);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(
    null
  );
  const [approvalRefreshRequired, setApprovalRefreshRequired] =
    useState(false);
  const requestVersion = useRef(0);
  const generationActive = useRef(false);
  const approvalActive = useRef(false);

  const selectablePlots = useMemo(
    () =>
      plots.filter(
        (plot) => plot.status === 'aktif' && plot.farmerId !== null
      ),
    [plots]
  );
  const unassignedActivePlots = useMemo(
    () =>
      plots.filter(
        (plot) => plot.status === 'aktif' && plot.farmerId === null
      ),
    [plots]
  );
  const visibleDrafts = useMemo(
    () =>
      drafts.filter(
        (draft) =>
          (!plotFilter || draft.plotId === plotFilter) &&
          (!assigneeFilter ||
            draft.proposedAssigneeId === assigneeFilter) &&
          (!priorityFilter || draft.priority === priorityFilter)
      ),
    [assigneeFilter, drafts, plotFilter, priorityFilter]
  );

  const applyDrafts = useCallback((nextDrafts: AiTaskDraft[]) => {
    setDrafts(nextDrafts);
    const availableIds = new Set(nextDrafts.map(({ id }) => id));
    setSelectedDraftIds((current) => {
      const next = new Set(
        [...current].filter((id) => availableIds.has(id))
      );
      return next.size === current.size ? current : next;
    });
  }, []);

  const loadAll = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(null);

    try {
      const [nextPlots, nextFarmers, nextDrafts] = await Promise.all([
        fetchPlots(),
        fetchFarmers(),
        fetchAiDrafts({ scheduledFor, status: 'pending' }),
      ]);
      if (requestVersion.current !== version) return;
      setPlots(nextPlots);
      setFarmers(nextFarmers);
      applyDrafts(nextDrafts);
    } catch {
      if (requestVersion.current === version) {
        setLoadError(
          'Draft AI belum dapat dimuat. Periksa koneksi lalu coba lagi.'
        );
      }
    } finally {
      if (requestVersion.current === version) {
        setLoading(false);
      }
    }
  }, [applyDrafts, scheduledFor]);

  const reloadDrafts = useCallback(async (): Promise<boolean> => {
    const version = ++requestVersion.current;
    try {
      const nextDrafts = await fetchAiDrafts({
        scheduledFor,
        status: 'pending',
      });
      if (requestVersion.current !== version) return false;
      applyDrafts(nextDrafts);
      setLoadError(null);
      return true;
    } catch {
      if (requestVersion.current === version) {
        setLoadError(
          'Daftar draft terbaru belum dapat dimuat. Silakan coba lagi.'
        );
      }
      return false;
    }
  }, [applyDrafts, scheduledFor]);

  useEffect(() => {
    void loadAll();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadAll]);

  async function handleGenerate() {
    if (
      generationActive.current ||
      approvalActive.current ||
      generationPending
    ) {
      return;
    }
    if (selectedPlotIds.size === 0) {
      setGenerationFeedback(
        'Pilih minimal satu lahan aktif yang sudah memiliki petani.'
      );
      setGenerationWarningCount(0);
      return;
    }

    generationActive.current = true;
    setGenerationPending(true);
    setGenerationFeedback(null);
    setGenerationWarningCount(0);
    try {
      const result = await invokeAiGeneration([...selectedPlotIds]);
      setGenerationFeedback(generationCopy(result));
      setGenerationWarningCount(result.warnings.length);
      await reloadDrafts();
    } catch {
      setGenerationFeedback(
        'Generasi Task AI belum dapat dijalankan. Silakan coba lagi.'
      );
    } finally {
      generationActive.current = false;
      setGenerationPending(false);
    }
  }

  async function performBulkApproval(ids: string[]) {
    if (
      ids.length === 0 ||
      approvalActive.current ||
      generationActive.current ||
      approvalRefreshRequired
    ) {
      return;
    }

    approvalActive.current = true;
    setApprovalPending(true);
    setApprovalFeedback(null);
    try {
      await approveAiDrafts(ids);
      setSelectedDraftIds(new Set());
      const refreshed = await reloadDrafts();
      if (refreshed) {
        setApprovalRefreshRequired(false);
        setApprovalFeedback(
          `${ids.length} draft berhasil disetujui menjadi task.`
        );
      } else {
        setApprovalRefreshRequired(true);
        setApprovalFeedback(
          `${ids.length} draft berhasil disetujui, tetapi daftar terbaru belum dapat dimuat. Muat ulang sebelum melanjutkan.`
        );
      }
    } catch {
      setSelectedDraftIds(new Set());
      setApprovalRefreshRequired(true);
      const refreshed = await reloadDrafts();
      if (refreshed) {
        setApprovalRefreshRequired(false);
        setApprovalFeedback(
          'Draft berubah atau belum dapat disetujui. Daftar terbaru sudah dimuat.'
        );
      } else {
        setApprovalFeedback(
          'Draft berubah atau belum dapat disetujui. Daftar terbaru belum dapat dimuat. Muat ulang sebelum mencoba lagi.'
        );
      }
    } finally {
      approvalActive.current = false;
      setApprovalPending(false);
    }
  }

  function confirmBulkApproval() {
    if (
      selectedDraftIds.size === 0 ||
      approvalActive.current ||
      generationActive.current ||
      approvalRefreshRequired
    ) {
      return;
    }
    const ids = [...selectedDraftIds];
    Alert.alert(
      `Setujui ${ids.length} draft?`,
      'Semua draft terpilih akan dibuat menjadi task dalam satu transaksi.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Setujui',
          onPress: () => {
            void performBulkApproval(ids);
          },
        },
      ]
    );
  }

  async function handleDraftRefresh() {
    if (approvalActive.current || generationActive.current) return;

    approvalActive.current = true;
    setApprovalPending(true);
    const refreshed = await reloadDrafts();
    if (refreshed) {
      setApprovalRefreshRequired(false);
      setApprovalFeedback('Daftar draft terbaru berhasil dimuat.');
    }
    approvalActive.current = false;
    setApprovalPending(false);
  }

  const allActionsBlocked = generationPending || approvalPending;
  const draftApprovalBlocked =
    allActionsBlocked || approvalRefreshRequired;

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Operasional Internal"
        title="Task AI Hari Ini"
        description={`Buat dan review draft untuk ${scheduledFor}. Tidak ada task yang aktif sebelum disetujui.`}
      />

      {loading ? (
        <FeedbackState title="Memuat draft AI…" loading />
      ) : loadError && drafts.length === 0 ? (
        <FeedbackState
          title="Draft AI belum tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => void loadAll()}
        />
      ) : (
        <>
          <SurfaceCard>
            <AppText variant="subtitle">Pilih Lahan untuk Generasi</AppText>
            <AppText variant="small" color={Colors.muted}>
              Task hanya dibuat untuk lahan yang dipilih setelah tombol
              generasi ditekan.
            </AppText>
            <View style={styles.chipGroup}>
              {selectablePlots.map((plot) => (
                <SelectChip
                  key={plot.id}
                  label={plot.namaLahan}
                  accessibilityLabel={`Pilih lahan ${plot.namaLahan}`}
                  selected={selectedPlotIds.has(plot.id)}
                  disabled={allActionsBlocked}
                  onPress={() =>
                    setSelectedPlotIds((current) =>
                      toggleSet(current, plot.id)
                    )
                  }
                />
              ))}
            </View>
            {selectablePlots.length === 0 ? (
              <AppText variant="small" color={Colors.muted}>
                Belum ada lahan aktif yang sudah memiliki petani.
              </AppText>
            ) : null}
            {unassignedActivePlots.length > 0 ? (
              <AppText variant="small" color={Colors.warningText}>
                {unassignedActivePlots.length} lahan aktif belum memiliki
                petani dan tidak dapat dipilih.
              </AppText>
            ) : null}
            <AppButton
              label="Generate Task AI"
              loading={generationPending}
              disabled={approvalPending}
              onPress={() => void handleGenerate()}
            />
            {generationFeedback ? (
              <AppText
                variant="smallStrong"
                color={
                  generationFeedback.startsWith('Generasi gagal') ||
                  generationFeedback.startsWith('Generasi Task')
                    ? Colors.dangerText
                    : Colors.successText
                }
                accessibilityLiveRegion="polite"
              >
                {generationFeedback}
              </AppText>
            ) : null}
            {generationWarningCount > 0 ? (
              <AppText variant="small" color={Colors.warningText}>
                {generationWarningCount} lahan menghasilkan peringatan dan
                perlu diperiksa.
              </AppText>
            ) : null}
          </SurfaceCard>

          <SurfaceCard>
            <AppText variant="subtitle">Filter Draft</AppText>
            <AppText variant="smallStrong">Lahan</AppText>
            <View style={styles.chipGroup}>
              {selectablePlots.map((plot) => (
                <SelectChip
                  key={plot.id}
                  label={plot.namaLahan}
                  accessibilityLabel={`Filter lahan ${plot.namaLahan}`}
                  selected={plotFilter === plot.id}
                  disabled={approvalPending}
                  onPress={() =>
                    setPlotFilter((current) =>
                      current === plot.id ? null : plot.id
                    )
                  }
                />
              ))}
            </View>
            <AppText variant="smallStrong">Petani</AppText>
            <View style={styles.chipGroup}>
              {farmers.map((farmer) => (
                <SelectChip
                  key={farmer.id}
                  label={farmer.nama}
                  accessibilityLabel={`Filter petani ${farmer.nama}`}
                  selected={assigneeFilter === farmer.id}
                  disabled={approvalPending}
                  onPress={() =>
                    setAssigneeFilter((current) =>
                      current === farmer.id ? null : farmer.id
                    )
                  }
                />
              ))}
            </View>
            <AppText variant="smallStrong">Prioritas</AppText>
            <View style={styles.chipGroup}>
              {(
                Object.entries(priorityLabels) as [
                  TaskPriority,
                  string,
                ][]
              ).map(([priority, label]) => (
                <SelectChip
                  key={priority}
                  label={label}
                  accessibilityLabel={`Filter prioritas ${label}`}
                  selected={priorityFilter === priority}
                  disabled={approvalPending}
                  onPress={() =>
                    setPriorityFilter((current) =>
                      current === priority ? null : priority
                    )
                  }
                />
              ))}
            </View>
            <AppButton
              label="Reset semua filter"
              variant="secondary"
              disabled={
                approvalPending ||
                (!plotFilter && !assigneeFilter && !priorityFilter)
              }
              onPress={() => {
                setPlotFilter(null);
                setAssigneeFilter(null);
                setPriorityFilter(null);
              }}
            />
          </SurfaceCard>

          {loadError ? (
            <AppText variant="small" color={Colors.dangerText}>
              {loadError}
            </AppText>
          ) : null}

          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}>
              <AppText variant="subtitle">Draft Menunggu Review</AppText>
              <AppText variant="small" color={Colors.muted}>
                {visibleDrafts.length} dari {drafts.length} draft ditampilkan
              </AppText>
            </View>
            <AppButton
              label="Setujui Terpilih"
              variant="forest"
              loading={approvalPending}
              disabled={
                selectedDraftIds.size === 0 ||
                generationPending ||
                approvalRefreshRequired
              }
              onPress={confirmBulkApproval}
            />
          </View>

          {approvalFeedback ? (
            <AppText
              variant="smallStrong"
              color={
                approvalFeedback.startsWith('Draft berubah')
                  ? Colors.dangerText
                  : Colors.successText
              }
              accessibilityLiveRegion="polite"
            >
              {approvalFeedback}
            </AppText>
          ) : null}

          {approvalRefreshRequired ? (
            <SurfaceCard>
              <AppText variant="small" color={Colors.dangerText}>
                Draft yang tampil mungkin sudah berubah. Muat ulang daftar
                sebelum memilih atau menyetujui draft.
              </AppText>
              <AppButton
                label="Muat Ulang Draft"
                variant="secondary"
                loading={approvalPending}
                disabled={generationPending}
                onPress={() => void handleDraftRefresh()}
              />
            </SurfaceCard>
          ) : null}

          {visibleDrafts.length === 0 ? (
            <FeedbackState
              title={
                drafts.length === 0
                  ? 'Belum ada draft pending'
                  : 'Tidak ada draft yang cocok'
              }
              message={
                drafts.length === 0
                  ? 'Pilih lahan lalu jalankan generasi Task AI.'
                  : 'Ubah atau reset filter untuk melihat draft lain.'
              }
            />
          ) : (
            visibleDrafts.map((draft) => {
              const selected = selectedDraftIds.has(draft.id);
              return (
                <View key={draft.id} style={styles.draftRow}>
                  <SelectChip
                    label={selected ? 'Dipilih' : 'Pilih draft'}
                    accessibilityLabel={`Pilih draft ${draft.title}`}
                    selected={selected}
                    disabled={draftApprovalBlocked}
                    onPress={() =>
                      setSelectedDraftIds((current) =>
                        toggleSet(current, draft.id)
                      )
                    }
                  />
                  <AiDraftCard
                    draft={draft}
                    onPress={() =>
                      router.push(
                        `/(app)/ai-tasks/${draft.id}` as Href
                      )
                    }
                  />
                </View>
              );
            })
          )}
        </>
      )}
    </AppScreen>
  );
}

export default function AiTasksRoute() {
  return (
    <RoleGuard requiredRole="internal">
      <AiTasksScreen />
    </RoleGuard>
  );
}

const styles = StyleSheet.create({
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: Radius.pill,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
    backgroundColor: Colors.canvas,
  },
  chipSelected: {
    backgroundColor: Colors.forest,
    borderColor: Colors.forest,
  },
  disabled: {
    opacity: 0.55,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  sectionTitle: {
    flex: 1,
    gap: Spacing.one,
  },
  draftRow: {
    gap: Spacing.two,
  },
});
