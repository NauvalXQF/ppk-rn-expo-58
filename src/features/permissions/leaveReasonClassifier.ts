export type LeaveReasonCategory = 'sick' | 'family' | 'academic' | 'personal' | 'other';

const reasonPatterns = [
  ['sick', /(?:^| )(?:sakit|demam|flu|migrain|diare|muntah|tidak enak badan|kurang sehat|rawat inap|berobat|kontrol dokter)(?= |$)/g],
  ['family', /(?:^| )(?:acara keluarga|kegiatan keluarga|(?:keperluan|urusan) keluarga|keluarga (?:sedang )?berduka|menjenguk keluarga|menemani (?:orang tua|ibu|ayah|keluarga))(?= |$)/g],
  ['academic', /(?:^| )(?:kegiatan akademik|keperluan akademik|agenda akademik|ujian|uts|uas|seminar|sidang skripsi|bimbingan skripsi|kuliah pengganti)(?= |$)/g],
  ['personal', /(?:^| )(?:keperluan|urusan|kepentingan|agenda) pribadi(?= |$)/g],
] as const;

const negatedPrefix = /(?:^| )(?:tidak|bukan|belum|tak|nggak|enggak|gak)(?: (?:sedang|lagi|ada|karena|merasa|mengalami|punya|bisa|dapat|akan|mengikuti|menghadiri|dalam kondisi)){0,3}$/;
const negatedAlternative = /^(?:atau|maupun)$/;

export function classifyLeaveReasonCategory(reason: string): LeaveReasonCategory {
  try {
    const clauses = reason
      .normalize('NFKC')
      .toLowerCase()
      .split(/[.!?;,\n\r]+|\b(?:tetapi|tapi|namun|melainkan)\b/u);
    let category: LeaveReasonCategory = 'other';

    for (const clause of clauses) {
      const words = (clause.match(/[\p{L}\p{M}\p{N}]+/gu) ?? []).join(' ');
      const matches = reasonPatterns.flatMap(([candidate, pattern]) =>
        Array.from(words.matchAll(pattern), (match) => ({
          candidate,
          start: match.index,
          end: match.index + match[0].length,
        })),
      ).sort((a, b) => a.start - b.start);
      let negatedEnd: number | undefined;

      for (const { candidate, start, end } of matches) {
        const followsNegatedAlternative = negatedEnd !== undefined &&
          negatedAlternative.test(words.slice(negatedEnd, start).trim());
        if (followsNegatedAlternative || negatedPrefix.test(words.slice(0, start))) {
          negatedEnd = end;
          continue;
        }
        negatedEnd = undefined;
        if (category !== 'other' && category !== candidate) return 'other';
        category = candidate;
      }
    }

    return category;
  } catch {
    return 'other';
  }
}
