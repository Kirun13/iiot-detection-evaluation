import { parse } from 'csv-parse/sync';
import type { BinaryLabel, Observation } from './types.js';

const REQUIRED = ['sample_id', 'segment', 'y_true', 'y_pred', 'model_version'];
const ALLOWED = new Set([...REQUIRED, 'latency_ms']);

/** Validate external data before computing any scientific metrics. */
export function parseObservations(csv: string): Observation[] {
  const rows = parse(csv, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: false,
  }) as string[][];
  const header = rows.shift();
  if (!header) throw new Error('CSV is empty; a header and observations are required.');
  if (new Set(header).size !== header.length) throw new Error('Duplicate CSV columns.');
  for (const column of REQUIRED) {
    if (!header.includes(column)) throw new Error(`Missing column: ${column}`);
  }
  for (const column of header) {
    if (!ALLOWED.has(column)) throw new Error(`Unknown column: ${column}`);
  }
  if (rows.length === 0) throw new Error('CSV contains no observations.');

  const seen = new Set<string>();
  const observations = rows.map((row, index): Observation => {
    const line = index + 2;
    const value = (name: string): string => {
      const cell = row[header.indexOf(name)];
      if (cell === undefined || cell.trim() === '') {
        throw new Error(`Row ${line}: ${name} cannot be empty.`);
      }
      return cell.trim();
    };
    const label = (name: string): BinaryLabel => {
      const cell = value(name);
      if (cell !== '0' && cell !== '1') throw new Error(`Row ${line}: ${name} must be 0 or 1.`);
      return cell === '1' ? 1 : 0;
    };
    const sampleId = value('sample_id');
    if (seen.has(sampleId)) throw new Error(`Row ${line}: duplicate sample_id ${sampleId}.`);
    seen.add(sampleId);
    let latencyMs: number | null = null;
    if (header.includes('latency_ms')) {
      const cell = value('latency_ms');
      if (!/^(?:\d+\.?\d*|\.\d+)$/.test(cell)) {
        throw new Error(`Row ${line}: latency_ms must be a finite nonnegative decimal.`);
      }
      latencyMs = Number(cell);
      if (!Number.isFinite(latencyMs)) throw new Error(`Row ${line}: latency_ms is not finite.`);
    }
    return {
      sampleId,
      segment: value('segment'),
      truth: label('y_true'),
      prediction: label('y_pred'),
      modelVersion: value('model_version'),
      latencyMs,
    };
  });
  if (new Set(observations.map(row => row.modelVersion)).size !== 1) {
    throw new Error('A CSV must contain exactly one model_version.');
  }
  return observations;
}
