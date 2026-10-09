export type BinaryLabel = 0 | 1;

export interface Observation {
  sampleId: string;
  segment: string;
  truth: BinaryLabel;
  prediction: BinaryLabel;
  modelVersion: string;
  latencyMs: number | null;
}

export interface Metrics {
  samples: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  fpr: number | null;
  accuracy: number;
  latencyP95Ms: number | null;
}

export interface Evaluation {
  modelVersion: string;
  overall: Metrics;
  segments: Record<string, Metrics>;
}

export interface Comparison {
  baseline: Evaluation;
  candidate: Evaluation;
  delta: {
    f1: number | null;
    fpr: number | null;
    accuracy: number;
  };
}

export interface InputMetadata {
  file: string;
  sha256: string;
}

export interface ResearchReport {
  schemaVersion: 1;
  toolVersion: string;
  task: 'binary attack versus normal';
  input: InputMetadata;
  evaluation: Evaluation;
  comparison: (Comparison & { input: InputMetadata }) | null;
}
