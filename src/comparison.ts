import { evaluate } from './metrics.js';
import type { Comparison, Observation } from './types.js';

/** Refuse comparisons whose ground truth, sample identities or segments differ. */
export function compare(baseline: Observation[], candidate: Observation[]): Comparison {
  if (baseline.length !== candidate.length) throw new Error('Comparison requires identical sample sets.');
  const byId = new Map(candidate.map(row => [row.sampleId, row]));
  if (byId.size !== candidate.length || new Set(baseline.map(r => r.sampleId)).size !== baseline.length) {
    throw new Error('Comparison contains duplicate sample IDs.');
  }
  for (const row of baseline) {
    const other = byId.get(row.sampleId);
    if (!other || other.truth !== row.truth || other.segment !== row.segment) {
      throw new Error(`Comparison mismatch for sample ${row.sampleId}: identity, label or segment differs.`);
    }
  }
  const a = evaluate(baseline);
  const b = evaluate(candidate);
  const delta = (old: number | null, next: number | null): number | null =>
    old === null || next === null ? null : next - old;
  return {
    baseline: a, candidate: b,
    delta: {
      f1: delta(a.overall.f1, b.overall.f1),
      fpr: delta(a.overall.fpr, b.overall.fpr),
      accuracy: b.overall.accuracy - a.overall.accuracy,
    },
  };
}
