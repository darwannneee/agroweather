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
  fetchLatestAiGenerationLog,
  invokeAiGeneration,
  type AiGenerationLog,
  type AiGenerationTargetLog,
  type GenerationInvocationResult,
  type GenerationWarning,
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
const statusLabels = {
  running: 'berjalan',
  succeeded: 'sukses',
  partial: 'sebagian',
  failed: 'gagal',
  skipped: 'dilewati',
} as const;
const warningMessages: Record<GenerationWarning['code'], string> = {
  plot_unassigned: 'Lahan dilewati karena belum memiliki petani.',
  weather_unavailable: 'Cuaca OpenWeather atau cache tidak tersedia.',
  model_error: 'OpenRouter gagal membuat draft.',
  invalid_model_output: 'Output OpenRouter tidak sesuai format.',
  persistence_error: 'Draft gagal disimpan ke database.',
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
  if (result.draftCount === 0) {
    return `Generasi selesai tanpa draft pending: ${result.successCount} lahan diproses, tetapi AI menghasilkan 0 draft.`;
  }
  if (result.status === 'partial') {
    return `Generasi selesai sebagian: ${result.draftCount} draft pending dibuat, ${result.skippedCount} lahan dilewati, ${result.failedCount} lahan gagal.`;
  }
  return `Generasi selesai: ${result.draftCount} draft pending dibuat dari ${result.successCount} lahan.`;
}

function generationLogFromResult(
  result: GenerationInvocationResult,
  scheduledFor: string,
  plotCount: number
): AiGenerationLog {
  return {
    runId: result.runId,
    trigger: 'manual',
    scheduledFor,
    status: result.status,
    model: 'runtime',
    plotCount,
    successCount: result.successCount,
    skippedCount: result.skippedCount,
    failedCount: result.failedCount,
    draftCount: result.draftCount,
    warnings: result.warnings,
    startedAt: '',
    completedAt: null,
    targets: [],
  };
}

function plotNameForWarning(
  warning: GenerationWarning,
  plots: FarmPlot[]
): string {
  return plots.find((plot) => plot.id === warning.plotId)?.namaLahan
    ?? `Lahan ${warning.plotId.slice(0, 8)}`;
}

function targetStatusCopy(target: AiGenerationTargetLog): string {
  const status = statusLabels[target.status];
  const summary = target.summary ? ` Ringkasan: ${target.summary}` : '';
  const error = target.errorCode
    ? ` Error: ${target.errorCode}.`
    : '';
  return `${target.plotName}: ${status}, ${target.draftCount} draft.${error}${summary}`;
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
  const [generationLog, setGenerationLog] =
    useState<AiGenerationLog | null>(null);
  const [generationLogError, setGenerationLogError] =
    useState<string | null>(null);
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

  const loadGenerationLog = useCallback(async (
    options: { preserveExistingOnEmpty?: boolean } = {}
  ): Promise<boolean> => {
    try {
      const nextLog = await fetchLatestAiGenerationLog({ scheduledFor });
      if (nextLog || !options.preserveExistingOnEmpty) {
        setGenerationLog(nextLog);
      }
      setGenerationLogError(null);
      return true;
    } catch {
      setGenerationLogError(
        'Log generasi terakhir belum dapat dimuat.'
      );
      return false;
    }
  }, [scheduledFor]);

  useEffect(() => {
    void loadAll();
    void loadGenerationLog();
    return () => {
      requestVersion.current += 1;
    };
  }, [loadAll, loadGenerationLog]);

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
    setGenerationLogError(null);
    try {
      const plotIds = [...selectedPlotIds];
      const result = await invokeAiGeneration(plotIds);
      setGenerationFeedback(generationCopy(result));
      setGenerationWarningCount(result.warnings.length);
      setGenerationLog(
        generationLogFromResult(result, scheduledFor, plotIds.length)
      );
      await reloadDrafts();
      void loadGenerationLog({ preserveExistingOnEmpty: true });
    } catch {
      setGenerationFeedback(
        'Generasi Task AI belum dapat dijalankan. Silakan coba lagi.'
      );
      setGenerationLogError(
        'Request generate gagal sebelum log run tersimpan.'
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

          {generationLog || generationLogError ? (
            <SurfaceCard>
              <AppText variant="subtitle">Log Generasi Terakhir</AppText>
              {generationLog ? (
                <>
                  <AppText variant="smallStrong">
                    Run ID: {generationLog.runId}
                  </AppText>
                  <AppText variant="small" color={Colors.muted}>
                    Status: {statusLabels[generationLog.status]} · Trigger:{' '}
                    {generationLog.trigger} · Tanggal:{' '}
                    {generationLog.scheduledFor}
                  </AppText>
                  <AppText variant="small" color={Colors.muted}>
                    Draft pending dibuat: {generationLog.draftCount}
                  </AppText>
                  <AppText variant="small" color={Colors.muted}>
                    Lahan: {generationLog.successCount} sukses,{' '}
                    {generationLog.skippedCount} dilewati,{' '}
                    {generationLog.failedCount} gagal.
                  </AppText>
                  {generationLog.targets.length > 0 ? (
                    <View style={styles.logList}>
                      {generationLog.targets.map((target) => (
                        <AppText
                          key={target.id}
                          variant="small"
                          color={
                            target.status === 'failed'
                              ? Colors.dangerText
                              : target.status === 'skipped'
                              ? Colors.warningText
                              : Colors.muted
                          }
                        >
                          {targetStatusCopy(target)}
                        </AppText>
                      ))}
                    </View>
                  ) : null}
                  {generationLog.warnings.length > 0 ? (
                    <View style={styles.logList}>
                      {generationLog.warnings.map((warning, index) => (
                        <AppText
                          key={`${warning.plotId}-${warning.code}-${index}`}
                          variant="small"
                          color={Colors.warningText}
                        >
                          {plotNameForWarning(warning, plots)}:{' '}
                          {warningMessages[warning.code]} Kode:{' '}
                          {warning.code}
                        </AppText>
                      ))}
                    </View>
                  ) : generationLog.draftCount === 0 ? (
                    <AppText variant="small" color={Colors.warningText}>
                      Tidak ada warning teknis. AI bisa saja mengembalikan
                      0 task karena menilai belum ada pekerjaan aman atau
                      urgent untuk hari ini.
                    </AppText>
                  ) : null}
                </>
              ) : null}
              {generationLogError ? (
                <AppText variant="small" color={Colors.dangerText}>
                  {generationLogError}
                </AppText>
              ) : null}
            </SurfaceCard>
          ) : null}

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
                    disabled={draftApprovalBlocked}
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
  logList: {
    gap: Spacing.one,
  },
});
