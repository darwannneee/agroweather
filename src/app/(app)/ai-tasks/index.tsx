import { Feather } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AiDraftCard } from '@/components/domain/ai-draft-card';
import { RoleGuard } from '@/components/domain/role-guard';
import { AppScreen } from '@/components/ui/app-screen';
import { AppText } from '@/components/ui/app-text';
import { FeedbackState } from '@/components/ui/feedback-state';
import { SurfaceCard } from '@/components/ui/surface-card';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { jakartaDate } from '@/lib/daily-operations';
import type {
  AiTaskDraft,
  FarmPlot,
  TaskPriority,
} from '@/lib/farm-types';
import {
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
  low: 'Rendah',
  medium: 'Sedang',
  high: 'Tinggi',
};

const statusLabels = {
  running: 'Berjalan',
  succeeded: 'Berhasil',
  partial: 'Sebagian',
  failed: 'Gagal',
  skipped: 'Dilewati',
} as const;

const warningMessages: Record<GenerationWarning['code'], string> = {
  plot_unassigned: 'Lahan dilewati karena belum memiliki petani.',
  weather_unavailable: 'Data cuaca tidak tersedia atau belum terbarui.',
  model_error: 'Sistem AI gagal membuat draft rekomendasi.',
  invalid_model_output: 'Format output dari AI tidak sesuai.',
  persistence_error: 'Draft rekomendasi gagal disimpan ke basis data.',
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
    return 'Generasi gagal: belum ada rekomendasi yang dibuat.';
  }
  if (result.draftCount === 0) {
    return `Selesai: ${result.successCount} lahan diproses, namun AI menghasilkan 0 rekomendasi baru.`;
  }
  if (result.status === 'partial') {
    return `Selesai sebagian: ${result.draftCount} draf dibuat, ${result.skippedCount} dilewati, ${result.failedCount} gagal.`;
  }
  return `Generasi berhasil: ${result.draftCount} rekomendasi tugas dibuat dari ${result.successCount} lahan.`;
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
      {selected ? (
        <Feather
          name="check"
          size={14}
          color={selected ? Colors.surface : Colors.ink}
        />
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

// Tombol Aksi Kustom 
function ActionButton({ label, icon, onPress, disabled, loading }: { label: string, icon: keyof typeof Feather.glyphMap, onPress: () => void, disabled?: boolean, loading?: boolean }) {
  return (
    <Pressable 
      onPress={onPress} 
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.actionButton,
        (pressed || disabled || loading) && styles.actionButtonPressed
      ]}
    >
      <Feather name={icon} size={18} color={Colors.surface} />
      <AppText variant="bodyStrong" color={Colors.surface}>
        {loading ? 'Memproses...' : label}
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
  
  const [plotFilter, setPlotFilter] = useState<FilterValue>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<FilterValue>(null);
  const [priorityFilter, setPriorityFilter] =
    useState<TaskPriority | null>(null);
  const priorityOptions = useMemo(
    () => Object.keys(priorityLabels) as TaskPriority[],
    []
  );
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generationPending, setGenerationPending] = useState(false);
  const [generationFeedback, setGenerationFeedback] = useState<string | null>(null);
  const [generationWarningCount, setGenerationWarningCount] = useState(0);
  const [generationLog, setGenerationLog] = useState<AiGenerationLog | null>(null);
  const [generationLogError, setGenerationLogError] = useState<string | null>(null);
  const [refreshingDrafts, setRefreshingDrafts] = useState(false);

  const requestVersion = useRef(0);
  const generationActive = useRef(false);

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
      setDrafts(nextDrafts);
    } catch {
      if (requestVersion.current === version) {
        setLoadError(
          'Data belum dapat dimuat. Periksa koneksi lalu coba lagi.'
        );
      }
    } finally {
      if (requestVersion.current === version) setLoading(false);
    }
  }, [scheduledFor]);

  const reloadDrafts = useCallback(async (): Promise<boolean> => {
    const version = ++requestVersion.current;
    setRefreshingDrafts(true);
    try {
      const nextDrafts = await fetchAiDrafts({
        scheduledFor,
        status: 'pending',
      });
      if (requestVersion.current !== version) return false;
      setDrafts(nextDrafts);
      setLoadError(null);
      return true;
    } catch {
      if (requestVersion.current === version) {
        setLoadError(
          'Daftar draf terbaru gagal dimuat. Silakan muat ulang halaman.'
        );
      }
      return false;
    } finally {
      if (requestVersion.current === version) setRefreshingDrafts(false);
    }
  }, [scheduledFor]);

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
        'Log generasi terakhir gagal dimuat.'
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
    if (generationActive.current || generationPending || refreshingDrafts) return;
    
    if (selectedPlotIds.size === 0) {
      setGenerationFeedback('Pilih minimal satu lahan aktif yang sudah ditugaskan.');
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
      // FIX: Menghilangkan argumen `(error)` pada catch agar terhindar dari warning ESLint
      setGenerationFeedback('Sistem gagal menjalankan generasi AI. Silakan coba lagi.');
      setGenerationLogError('Permintaan gagal sebelum log tersimpan.');
    } finally {
      generationActive.current = false;
      setGenerationPending(false);
    }
  }

  return (
    <AppScreen scrollEnabled={true}>
      {loading ? (
        <FeedbackState title="Memuat data AI…" loading />
      ) : loadError && drafts.length === 0 ? (
        <FeedbackState
          title="Data Belum Tersedia"
          message={loadError}
          actionLabel="Coba Lagi"
          onAction={() => void loadAll()}
        />
      ) : (
        <View style={styles.container}>
          {/* Sektor 1: Metrik AI */}
          <SurfaceCard>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.sky }]}>
                  <Feather name="cpu" size={20} color={Colors.skyText} />
                </View>
                <AppText variant="display" style={styles.statValue}>
                  {drafts.length}
                </AppText>
                <AppText variant="smallStrong" color={Colors.muted}>
                  Rekomendasi
                </AppText>
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.statItem}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.successBackground }]}>
                  <Feather name="check-square" size={20} color={Colors.forest} />
                </View>
                <AppText variant="display" style={styles.statValue}>
                  {selectedPlotIds.size}
                </AppText>
                <AppText variant="smallStrong" color={Colors.muted}>
                  Lahan Dipilih
                </AppText>
              </View>

              <View style={styles.verticalDivider} />

              <View style={styles.statItem}>
                <View style={[styles.iconCircle, { backgroundColor: Colors.warningBackground }]}>
                  <Feather name="alert-circle" size={20} color={Colors.warningText} />
                </View>
                <AppText variant="display" style={styles.statValue}>
                  {unassignedActivePlots.length}
                </AppText>
                <AppText variant="smallStrong" color={Colors.muted}>
                  Tanpa Petani
                </AppText>
              </View>
            </View>
          </SurfaceCard>

          <View style={styles.divider} />

          {/* Sektor 2: Kontrol Utama (Pilih Lahan & Generate) */}
          <SurfaceCard>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: Colors.successBackground }]}>
                <Feather name="cpu" size={20} color={Colors.forest} />
              </View>
              <View style={styles.cardCopy}>
                <AppText variant="subtitle">Generator Tugas AI</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Pilih lahan untuk dianalisis dan dibuatkan rekomendasi tugas hari ini.
                </AppText>
              </View>
            </View>

            <View style={styles.chipGroup}>
              {selectablePlots.map((plot) => (
                <SelectChip
                  key={plot.id}
                  label={plot.namaLahan}
                  accessibilityLabel={`Pilih lahan ${plot.namaLahan}`}
                  selected={selectedPlotIds.has(plot.id)}
                  disabled={generationPending || refreshingDrafts}
                  onPress={() =>
                    setSelectedPlotIds((current) =>
                      toggleSet(current, plot.id)
                    )
                  }
                />
              ))}
            </View>

            {unassignedActivePlots.length > 0 ? (
              <View style={styles.inlineWarning}>
                <Feather name="alert-triangle" size={14} color={Colors.warningText} />
                <AppText variant="small" color={Colors.warningText}>
                  {unassignedActivePlots.length} lahan aktif tidak bisa dipilih karena belum ditugaskan ke petani.
                </AppText>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <ActionButton
                label="Generate Rekomendasi"
                icon="zap"
                loading={generationPending}
                disabled={refreshingDrafts}
                onPress={() => void handleGenerate()}
              />
            </View>

            {generationFeedback ? (
              <AppText
                variant="smallStrong"
                color={
                  generationFeedback.includes('gagal')
                    ? Colors.dangerText
                    : Colors.successText
                }
                accessibilityLiveRegion="polite"
              >
                {generationFeedback}
                {generationWarningCount > 0
                  ? ` (${generationWarningCount} peringatan)`
                  : ''}
              </AppText>
            ) : null}
          </SurfaceCard>

          {/* Log Aktivitas AI */}
          {(generationLog || generationLogError) ? (
            <SurfaceCard>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: Colors.sky }]}>
                  <Feather name="file-text" size={20} color={Colors.skyText} />
                </View>
                <View style={styles.cardCopy}>
                  <AppText variant="subtitle">Log Aktivitas Terakhir</AppText>
                  <AppText variant="small" color={Colors.muted}>
                    Riwayat analisis AI.
                  </AppText>
                </View>
              </View>

              {generationLog ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginBottom: Spacing.two }}>
                    <Feather name="activity" size={16} color={Colors.forest} />
                    <AppText variant="smallStrong">
                      Status: {statusLabels[generationLog.status]} · Rekomendasi Dibuat: {generationLog.draftCount}
                    </AppText>
                  </View>
                  
                  {generationLog.warnings.length > 0 ? (
                    <View style={styles.logList}>
                      {generationLog.warnings.map((warning, index) => (
                        <AppText
                          key={`${warning.plotId}-${warning.code}-${index}`}
                          variant="small"
                          color={Colors.warningText}
                        >
                          • {plotNameForWarning(warning, plots)}: {warningMessages[warning.code]}
                        </AppText>
                      ))}
                    </View>
                  ) : null}
                  {generationLog.targets.length > 0 ? (
                    <View style={styles.logList}>
                      {generationLog.targets.map((target, index) => (
                        <AppText
                          key={`${target.plotName}-${index}`}
                          variant="small"
                          color={Colors.muted}
                        >
                          • {targetStatusCopy(target)}
                        </AppText>
                      ))}
                    </View>
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

          <View style={styles.divider} />

          {/* Sektor 3: Filter & Daftar Rekomendasi */}
          <SurfaceCard>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBox, { backgroundColor: Colors.warningBackground }]}>
                <Feather name="clipboard" size={20} color={Colors.amberText} />
              </View>
              <View style={styles.sectionTitle}>
                <AppText variant="subtitle">Antrean Rekomendasi AI</AppText>
                <AppText variant="small" color={Colors.muted}>
                  Buka kartu untuk melihat detail instruksi dan menyetujuinya.
                </AppText>
              </View>
              <Pressable 
                onPress={() => void reloadDrafts()} 
                disabled={generationPending || refreshingDrafts} 
                style={({ pressed }) => [{ padding: 6, opacity: pressed ? 0.5 : 1 }]}
              >
                <Feather name="refresh-cw" size={20} color={refreshingDrafts ? Colors.muted : Colors.forest} />
              </Pressable>
            </View>
          </SurfaceCard>

          {drafts.length > 0 && (
            <SurfaceCard>
              <AppText variant="smallStrong">Penyaring Daftar:</AppText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollChipGroup}>
                {selectablePlots.map((plot) => (
                  <SelectChip
                    key={plot.id}
                    label={`Lahan: ${plot.namaLahan}`}
                    accessibilityLabel={`Filter lahan ${plot.namaLahan}`}
                    selected={plotFilter === plot.id}
                    disabled={generationPending || refreshingDrafts}
                    onPress={() =>
                      setPlotFilter((current) =>
                        current === plot.id ? null : plot.id
                      )
                    }
                  />
                ))}
                {farmers.map((farmer) => (
                  <SelectChip
                    key={farmer.id}
                    label={`Petani: ${farmer.nama.split(' ')[0]}`}
                    accessibilityLabel={`Filter petani ${farmer.nama}`}
                    selected={assigneeFilter === farmer.id}
                    disabled={generationPending || refreshingDrafts}
                    onPress={() =>
                      setAssigneeFilter((current) =>
                        current === farmer.id ? null : farmer.id
                      )
                    }
                  />
                ))}
                {priorityOptions.map((priority) => (
                  <SelectChip
                    key={priority}
                    label={`Prioritas: ${priorityLabels[priority]}`}
                    accessibilityLabel={`Filter prioritas ${priorityLabels[priority]}`}
                    selected={priorityFilter === priority}
                    disabled={generationPending || refreshingDrafts}
                    onPress={() =>
                      setPriorityFilter((current) =>
                        current === priority ? null : priority
                      )
                    }
                  />
                ))}
              </ScrollView>
            </SurfaceCard>
          )}

          {/* Daftar Item Draft (Bisa diklik masuk ke halaman detail) */}
          {visibleDrafts.length === 0 ? (
            <FeedbackState
              title={
                drafts.length === 0
                  ? 'Antrean Kosong'
                  : 'Tidak Ada yang Cocok'
              }
              message={
                drafts.length === 0
                  ? 'Gunakan Generator Tugas AI di atas untuk membuat rekomendasi.'
                  : 'Atur ulang atau lepaskan filter penyaring untuk melihat daftar.'
              }
            />
          ) : (
            <View style={{ gap: Spacing.three }}>
              {visibleDrafts.map((draft) => (
                <AiDraftCard
                  key={draft.id}
                  draft={draft}
                  disabled={generationPending || refreshingDrafts}
                  onPress={() =>
                    router.push(`/(app)/ai-tasks/${draft.id}` as Href)
                  }
                />
              ))}
            </View>
          )}
        </View>
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
  container: {
    gap: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  statValue: {
    fontWeight: '800',
    color: Colors.ink,
  },
  verticalDivider: {
    width: 1,
    height: 50,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.two,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.one,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  scrollChipGroup: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingBottom: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 40,
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
  },
  disabled: {
    opacity: 0.55,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.forest,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.button,
    minHeight: 44,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionRow: {
    alignItems: 'flex-start',
    marginTop: Spacing.two,
  },
  inlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    flex: 1,
    gap: 2,
  },
  logList: {
    gap: Spacing.one,
    marginTop: Spacing.two,
    paddingLeft: Spacing.one,
  },
});