import { describe, expect, it } from 'vitest';
import { parseObservations } from '../src/validation.js';

const header='sample_id,segment,y_true,y_pred,model_version';
const valid=header+'\n001,pump,1,0,v1\n';

describe('CSV input validation', () => {
  it('parses valid binary observations and preserves string sample IDs', () => {
    expect(parseObservations(valid)).toEqual([{sampleId:'001',segment:'pump',truth:1,prediction:0,modelVersion:'v1',latencyMs:null}]);
  });
  it('handles BOM, CRLF, whitespace, reordered columns and quoted delimiters', () => {
    const csv='\uFEFFy_pred,model_version,y_true,segment,sample_id\r\n 0 , v1 , 1 ,"pump,west",001\r\n';
    expect(parseObservations(csv)[0]?.segment).toBe('pump,west');
  });
  it('rejects no observations', () => expect(() => parseObservations(header)).toThrow('no observations'));
  it('rejects a completely empty file', () => expect(() => parseObservations('')).toThrow('empty'));
  it('rejects a missing required column', () => expect(() => parseObservations(valid.replace('y_true','truth'))).toThrow('Missing column'));
  it('rejects duplicated column names', () => expect(() => parseObservations(header+',segment\n001,pump,1,0,v1,pump')).toThrow('Duplicate CSV'));
  it('rejects unexpected columns rather than hiding spelling mistakes', () => expect(() => parseObservations(header+',extra\n001,pump,1,0,v1,x')).toThrow('Unknown column'));
  it.each(['2','-1','true','0.0'])('rejects a nonbinary label %s', value => {
    expect(() => parseObservations(header+`\n001,pump,${value},0,v1`)).toThrow('must be 0 or 1');
  });
  it('rejects a missing segment', () => expect(() => parseObservations(header+'\n001,,1,0,v1')).toThrow('segment cannot be empty'));
  it('rejects duplicate observations', () => expect(() => parseObservations(valid+'001,lighting,1,1,v1\n')).toThrow('duplicate sample_id'));
  it('rejects mixing model outputs in one file', () => expect(() => parseObservations(valid+'002,pump,0,0,v2')).toThrow('exactly one'));
  it('rejects malformed row lengths', () => expect(() => parseObservations(valid+'002,pump,0,0')).toThrow());
  it('reads supplied latency and supports zero', () => {
    expect(parseObservations(header+',latency_ms\n001,pump,1,1,v1,0')[0]?.latencyMs).toBe(0);
  });
  it.each(['-1','Infinity','','NaN','0x10'])('rejects invalid latency %s', value => {
    expect(() => parseObservations(header+`,latency_ms\n001,pump,1,1,v1,${value}`)).toThrow();
  });
});
