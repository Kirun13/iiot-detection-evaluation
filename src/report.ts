import type { Evaluation, ResearchReport } from './types.js';

const number = (value: number | null): string => value === null ? 'N/A' : value.toFixed(4);
const escape = (value: string): string => value.replace(/([\\|`*_<>])/g, '\\$1').replace(/[\r\n]+/g, ' ');

function evaluationTable(evaluation: Evaluation): string {
  const header = [
    '| Group | n | TP | FP | TN | FN | Precision | Recall | F1 | FPR | Accuracy | p95 ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  const groups = [['Overall', evaluation.overall] as const, ...Object.entries(evaluation.segments)];
  return [...header, ...groups.map(([name, m]) =>
    `| ${escape(name)} | ${m.samples} | ${m.tp} | ${m.fp} | ${m.tn} | ${m.fn} | ${number(m.precision)} | ${number(m.recall)} | ${number(m.f1)} | ${number(m.fpr)} | ${number(m.accuracy)} | ${number(m.latencyP95Ms)} |`,
  )].join('\n');
}

export function renderMarkdown(report: ResearchReport): string {
  const parts = [
    '# IIoT detection evaluation',
    `Tool version: ${escape(report.toolVersion)}. Task: ${report.task}.`,
    `Input: ${escape(report.input.file)}. SHA-256: \`${report.input.sha256}\`.`,
    `## Baseline ${escape(report.evaluation.modelVersion)}`,
    evaluationTable(report.evaluation),
  ];
  if (report.comparison) {
    const c = report.comparison;
    parts.push(
      `## Candidate ${escape(c.candidate.modelVersion)}`,
      `Input: ${escape(c.input.file)}. SHA-256: \`${c.input.sha256}\`.`,
      evaluationTable(c.candidate),
      `Deltas (candidate minus baseline): F1 ${number(c.delta.f1)}, FPR ${number(c.delta.fpr)}, accuracy ${number(c.delta.accuracy)}.`,
    );
  }
  parts.push(
    '## Interpretation',
    'Positive class is attack (1). F1 is binary attack-class F1, not macro-F1 across attack types.',
    'N/A (JSON null) means a metric is undefined or latency measurements are absent. Zero-denominator ratios are never presented as a successful score.',
    'p95 uses the nearest-rank method over supplied latency_ms values; these are not timings measured by this tool.',
    'A comparison describes only the supplied observations. Synthetic demo scores do not establish the accuracy or latency of a deployed IDS, or statistical significance.',
  );
  return parts.join('\n\n') + '\n';
}
