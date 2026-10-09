import type { Evaluation, Metrics, Observation } from './types.js';

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

/** Nearest-rank p95 over supplied measurements; not a benchmark of this CLI. */
export function percentile95(values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.some(value => !Number.isFinite(value) || value < 0)) {
    throw new Error('Latency values must be finite and nonnegative.');
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? null;
}

export function calculateMetrics(rows: Observation[]): Metrics {
  if (rows.length === 0) throw new Error('Cannot evaluate an empty observation set.');
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const row of rows) {
    if (row.truth === 1 && row.prediction === 1) tp++;
    else if (row.truth === 0 && row.prediction === 1) fp++;
    else if (row.truth === 0 && row.prediction === 0) tn++;
    else fn++;
  }
  const latencies = rows.map(row => row.latencyMs);
  return {
    samples: rows.length, tp, fp, tn, fn,
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
    f1: ratio(2 * tp, 2 * tp + fp + fn),
    fpr: ratio(fp, fp + tn),
    accuracy: (tp + tn) / rows.length,
    latencyP95Ms: latencies.every((x): x is number => x !== null)
      ? percentile95(latencies) : null,
  };
}

export function evaluate(rows: Observation[]): Evaluation {
  const first = rows[0];
  if (!first) throw new Error('Cannot evaluate an empty observation set.');
  const groups = new Map<string, Observation[]>();
  for (const row of rows) {
    if (row.modelVersion !== first.modelVersion) throw new Error('Mixed model versions.');
    const group = groups.get(row.segment) ?? [];
    group.push(row);
    groups.set(row.segment, group);
  }
  const segments = Object.fromEntries(
    [...groups.keys()].sort().map(key => [key, calculateMetrics(groups.get(key)!)]),
  );
  return { modelVersion: first.modelVersion, overall: calculateMetrics(rows), segments };
}
