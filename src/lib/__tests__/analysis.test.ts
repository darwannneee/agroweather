import { buildMvpAnalysisSummary } from '../analysis';

describe('buildMvpAnalysisSummary', () => {
  test('returns deterministic Indonesian recommendation text', () => {
    expect(
      buildMvpAnalysisSummary({
        plotName: 'Sawah Utara',
        cropType: 'Padi',
        phase: 'Penyiraman',
        taskTitle: 'Cek saluran air',
        evidenceCount: 2,
      })
    ).toBe(
      'Analisis MVP: Sawah Utara menanam Padi dan sedang pada fase Penyiraman. Fokus hari ini: Cek saluran air. Ada 2 bukti kerja sebelumnya untuk bahan evaluasi besok.'
    );
  });

  test('handles zero previous evidence', () => {
    expect(
      buildMvpAnalysisSummary({
        plotName: 'Kebun Cabai',
        cropType: 'Cabai',
        phase: null,
        taskTitle: 'Foto kondisi tanaman',
        evidenceCount: 0,
      })
    ).toContain('Belum ada bukti kerja sebelumnya');
  });
});
