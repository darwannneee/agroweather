export type MvpAnalysisInput = {
  plotName: string;
  cropType: string;
  phase: string | null;
  taskTitle: string;
  evidenceCount: number;
};

export function buildMvpAnalysisSummary(input: MvpAnalysisInput): string {
  const phase = input.phase?.trim() ? input.phase.trim() : 'belum dicatat';
  const evidence =
    input.evidenceCount > 0
      ? `Ada ${input.evidenceCount} bukti kerja sebelumnya untuk bahan evaluasi besok.`
      : 'Belum ada bukti kerja sebelumnya untuk bahan evaluasi besok.';

  return `Analisis MVP: ${input.plotName} menanam ${input.cropType} dan sedang pada fase ${phase}. Fokus hari ini: ${input.taskTitle}. ${evidence}`;
}
