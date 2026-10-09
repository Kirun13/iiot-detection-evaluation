import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseObservations } from './validation.js';
import { evaluate } from './metrics.js';
import { compare } from './comparison.js';
import { renderMarkdown } from './report.js';
import type { ResearchReport } from './types.js';

const HELP = 'Usage: npm run evaluate -- --input predictions.csv [--compare candidate.csv] [--output results]';

function argumentsToOptions(args: string[]): Map<string, string> {
  const options = new Map<string, string>();
  const allowed = new Set(['--input', '--compare', '--output']);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]!;
    if (!allowed.has(key)) throw new Error(`Unknown argument: ${key}. ${HELP}`);
    if (options.has(key)) throw new Error(`Repeated argument: ${key}.`);
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}.`);
    options.set(key, value);
  }
  if (!options.has('--input')) throw new Error(`--input is required. ${HELP}`);
  return options;
}

async function load(path: string) {
  const bytes = await readFile(path);
  return {
    rows: parseObservations(bytes.toString('utf8')),
    metadata: { file: basename(path), sha256: createHash('sha256').update(bytes).digest('hex') },
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(HELP); return;
  }
  const options = argumentsToOptions(args);
  const input = await load(options.get('--input')!);
  const candidatePath = options.get('--compare');
  const candidate = candidatePath ? await load(candidatePath) : null;
  const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), '../package.json');
  const packageInfo = JSON.parse(await readFile(packagePath, 'utf8')) as { version: string };
  const report: ResearchReport = {
    schemaVersion: 1,
    toolVersion: packageInfo.version,
    task: 'binary attack versus normal',
    input: input.metadata,
    evaluation: evaluate(input.rows),
    comparison: candidate ? { ...compare(input.rows, candidate.rows), input: candidate.metadata } : null,
  };
  const output = resolve(options.get('--output') ?? 'results');
  // Refuse to overwrite an input, even when a user calls it report.json/report.md.
  const files = [resolve(output, 'report.json'), resolve(output, 'report.md')];
  const inputs = [resolve(options.get('--input')!), ...(candidatePath ? [resolve(candidatePath)] : [])];
  if (inputs.some(inputPath => files.includes(inputPath))) throw new Error('Output would overwrite an input file.');
  await mkdir(output, { recursive: true });
  await writeFile(files[0]!, JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(files[1]!, renderMarkdown(report), 'utf8');
  console.log(`Evaluated ${input.rows.length} observations. Reports: ${output}`);
}

main().catch((error: unknown) => {
  console.error(`Evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
