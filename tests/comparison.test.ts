import { describe, expect, it } from 'vitest';
import { parseObservations } from '../src/validation.js';
import { compare } from '../src/comparison.js';
const header='sample_id,segment,y_true,y_pred,model_version\n';
const a=parseObservations(header+'1,pump,1,0,v1\n2,pump,0,1,v1');
const b=parseObservations(header+'2,pump,0,0,v2\n1,pump,1,1,v2');

describe('fair comparison', () => {
  it('matches by identity rather than row order and calculates deltas', () => {
    const c=compare(a,b);
    expect(c.delta).toEqual({f1:1,fpr:-1,accuracy:1});
  });
  it('rejects unequal sample counts', () => expect(() => compare(a,b.slice(1))).toThrow('identical sample sets'));
  it('rejects an unrecognized sample ID', () => expect(() => compare(a,b.map(r=>({...r,sampleId:r.sampleId+'x'})))).toThrow('mismatch'));
  it('rejects changed ground truth', () => expect(() => compare(a,b.map(r=>({...r,truth:r.truth===1?0:1})))).toThrow('mismatch'));
  it('rejects a changed segment', () => expect(() => compare(a,b.map(r=>({...r,segment:'lighting'})))).toThrow('mismatch'));
  it('rejects duplicate identities even for programmatic callers', () => expect(() => compare(a,[b[0]!,b[0]!])).toThrow('duplicate'));
  it('propagates undefined metric deltas as null', () => {
    const onlyNormal=parseObservations(header+'1,pump,0,0,v1');
    expect(compare(onlyNormal,onlyNormal).delta.f1).toBeNull();
  });
});
