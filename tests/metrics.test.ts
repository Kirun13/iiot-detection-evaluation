import { describe, expect, it } from 'vitest';
import { calculateMetrics, evaluate, percentile95 } from '../src/metrics.js';
import type { BinaryLabel, Observation } from '../src/types.js';

function row(truth: BinaryLabel, prediction: BinaryLabel, id = '1', segment = 'pump'): Observation {
  return { sampleId: id, segment, truth, prediction, modelVersion: 'v1', latencyMs: null };
}

describe('scientific metrics', () => {
  it('matches independently calculated counts and ratios', () => {
    const rows = [row(1,1),row(1,1),row(1,0),row(0,1),row(0,0),row(0,0)];
    const m = calculateMetrics(rows);
    expect([m.tp,m.fp,m.tn,m.fn]).toEqual([2,1,2,1]);
    expect(m.precision).toBeCloseTo(2/3);
    expect(m.recall).toBeCloseTo(2/3);
    expect(m.f1).toBeCloseTo(2/3);
    expect(m.fpr).toBeCloseTo(1/3);
    expect(m.accuracy).toBeCloseTo(2/3);
  });
  it('returns perfect scores for a perfect mixed-class prediction', () => {
    expect(calculateMetrics([row(0,0),row(1,1)])).toMatchObject({precision:1,recall:1,f1:1,fpr:0,accuracy:1});
  });
  it('does not report undefined precision as a successful score', () => {
    expect(calculateMetrics([row(0,0),row(1,0)])).toMatchObject({precision:null,recall:0,f1:0});
  });
  it('returns undefined recall and F1 when both classes contain no attacks or predictions', () => {
    expect(calculateMetrics([row(0,0)])).toMatchObject({precision:null,recall:null,f1:null,fpr:0,accuracy:1});
  });
  it('returns undefined FPR when there are no normal observations', () => {
    expect(calculateMetrics([row(1,1)])).toMatchObject({fpr:null});
  });
  it('rejects an empty set', () => expect(() => calculateMetrics([])).toThrow('empty'));
  it('groups by segment without mixing the denominators', () => {
    const m=evaluate([row(1,1,'1','lighting'),row(0,1,'2','pump')]);
    expect(Object.keys(m.segments)).toEqual(['lighting','pump']);
    expect(m.segments['lighting']?.recall).toBe(1);
    expect(m.segments['lighting']?.fpr).toBeNull();
    expect(m.segments['pump']?.fpr).toBe(1);
  });
  it('keeps arbitrary segment names including object property names', () => {
    const result=evaluate([row(1,1,'1','__proto__')]);
    expect(Object.hasOwn(result.segments,'__proto__')).toBe(true);
    expect(result.segments['__proto__']?.samples).toBe(1);
  });
  it('rejects mixed model versions', () => {
    expect(() => evaluate([row(1,1),{...row(0,0),modelVersion:'v2'}])).toThrow('Mixed');
  });
  it('uses nearest rank, does not mutate input, and handles single values', () => {
    const values=Array.from({length:20},(_,i)=>20-i);
    expect(percentile95(values)).toBe(19);
    expect(values[0]).toBe(20);
    expect(percentile95([2.5])).toBe(2.5);
  });
  it('handles absent latency and rejects invalid measurements', () => {
    expect(percentile95([])).toBeNull();
    expect(() => percentile95([NaN])).toThrow('finite');
    expect(() => percentile95([-1])).toThrow('nonnegative');
  });
  it('does not report p95 from a partially measured dataset', () => {
    expect(calculateMetrics([{...row(1,1),latencyMs:12},row(0,0)]).latencyP95Ms).toBeNull();
  });
});
