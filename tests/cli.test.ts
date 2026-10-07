import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { ResearchReport } from '../src/types.js';

const temporary: string[]=[];
function output(): string {
  const path=mkdtempSync(join(tmpdir(),'iiot-eval-test-'));
  temporary.push(path); return path;
}
function cli(args: string[]) {
  return spawnSync(process.execPath,[resolve('dist/cli.js'),...args],{encoding:'utf8'});
}
afterEach(()=>{for(const p of temporary.splice(0))rmSync(p,{recursive:true,force:true});});

describe('end to end CLI', () => {
  it('creates the independently specified demo scores and comparison', () => {
    const out=output();
    const result=cli(['--input','data/example.csv','--compare','data/candidate.csv','--output',out]);
    expect(result.status).toBe(0);
    const report=JSON.parse(readFileSync(join(out,'report.json'),'utf8')) as ResearchReport;
    expect(report.input.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.evaluation.overall).toMatchObject({samples:12,tp:4,fp:2,tn:4,fn:2,latencyP95Ms:75});
    expect(report.evaluation.overall.f1).toBeCloseTo(2/3);
    expect(report.comparison?.candidate.overall).toMatchObject({tp:5,fp:1,tn:5,fn:1,latencyP95Ms:77});
    expect(report.comparison?.delta.f1).toBeCloseTo(1/6);
    const markdown=readFileSync(join(out,'report.md'),'utf8');
    expect(markdown).toContain('Synthetic demo scores do not establish');
    expect(markdown).toContain('local-demo-v1');
  });
  it('is byte reproducible for identical inputs', () => {
    const a=output(),b=output();
    for(const out of [a,b])expect(cli(['--input','data/example.csv','--output',out]).status).toBe(0);
    expect(readFileSync(join(a,'report.json'),'utf8')).toBe(readFileSync(join(b,'report.json'),'utf8'));
    expect(readFileSync(join(a,'report.md'),'utf8')).toBe(readFileSync(join(b,'report.md'),'utf8'));
  });
  it('prints help without needing an input file', () => expect(cli(['--help']).status).toBe(0));
  it('rejects missing required input', () => expect(cli([]).status).toBe(1));
  it('rejects unknown or duplicate arguments', () => {
    expect(cli(['--inpt','data/example.csv']).status).toBe(1);
    expect(cli(['--input','data/example.csv','--input','data/example.csv']).status).toBe(1);
  });
  it('rejects a missing argument value', () => expect(cli(['--input']).status).toBe(1));
  it('does not publish reports when validation fails', () => {
    const out=output(); const bad=join(out,'bad.csv'); writeFileSync(bad,'bad\nrow');
    expect(cli(['--input',bad,'--output',out]).status).toBe(1);
    expect(existsSync(join(out,'report.json'))).toBe(false);
  });
  it('does not publish reports for unfair comparisons', () => {
    const out=output(); const bad=join(out,'bad.csv');
    writeFileSync(bad,readFileSync('data/candidate.csv','utf8').replace('001,lighting,1','001,lighting,0'));
    expect(cli(['--input','data/example.csv','--compare',bad,'--output',out]).status).toBe(1);
    expect(existsSync(join(out,'report.md'))).toBe(false);
  });
  it('refuses to overwrite the input', () => {
    const out=output(); const input=join(out,'report.json'); const original=readFileSync('data/example.csv','utf8');
    writeFileSync(input,original);
    expect(cli(['--input',input,'--output',out]).status).toBe(1);
    expect(readFileSync(input,'utf8')).toBe(original);
  });
});
