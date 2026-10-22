import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const output = resolve('ci-results');
mkdirSync(output, { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const image = `iiot-detection-evaluation:${revision.slice(0, 12)}-${process.env.BUILD_NUMBER ?? 'local'}`;
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const json = (name, data) => writeFileSync(resolve(output, name), JSON.stringify(data, null, 2) + '\n');
const capture = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
function run(command, args) {
  const start = performance.now();
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed with status ${result.status}`);
  return (performance.now() - start) / 1000;
}
const cli = ['--input', 'data/example.csv', '--compare', 'data/candidate.csv'];
const files = ['report.json', 'report.md'];
function mounts(input, destination) {
  return ['--mount', `type=bind,source=${input},target=/input,readonly`,
    '--mount', `type=bind,source=${destination},target=/output`];
}
const hardened = ['--rm', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--network=none'];

switch (process.argv[2]) {
  case 'environment': {
    const expected = readFileSync('.nvmrc', 'utf8').trim();
    assert.equal(process.versions.node, expected, 'Agent Node.js must match .nvmrc');
    json('environment.json', {
      revision, recordedAt: new Date().toISOString(), platform: process.platform,
      architecture: process.arch, node: process.versions.node,
      npm: capture(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/c', 'npm.cmd --version'] : ['--version']),
      git: capture('git', ['--version']), docker: JSON.parse(capture('docker', ['version', '--format', '{{json .}}'])),
      inputs: Object.fromEntries(['data/example.csv', 'data/candidate.csv'].map(file => [file, hash(file)])),
      lockfileSha256: hash('package-lock.json'), buildNumber: process.env.BUILD_NUMBER ?? null,
    });
    console.log(`Environment validated: ${revision}, Node.js ${expected}`);
    break;
  }
  case 'native': {
    const destination = resolve(output, 'native');
    const seconds = run(process.execPath, ['dist/cli.js', ...cli, '--output', destination]);
    json('native-timing.json', { seconds });
    break;
  }
  case 'build-image': {
    const seconds = run('docker', ['build', '--label', `org.opencontainers.image.revision=${revision}`, '-t', image, '.']);
    const info = JSON.parse(capture('docker', ['image', 'inspect', image]))[0];
    assert.equal(info.Config.User, 'node', 'Runtime must use the unprivileged node user');
    json('image.json', { tag: image, id: info.Id, bytes: info.Size, user: info.Config.User,
      node: capture('docker', ['run', '--rm', '--entrypoint', 'node', image, '--version']),
      baseImage: readFileSync('Dockerfile', 'utf8').match(/^ARG NODE_IMAGE=(.+)$/m)[1],
      buildSeconds: seconds });
    break;
  }
  case 'containers': {
    run('docker', ['run', ...hardened, image, '--help']);
    const timings = [];
    for (let repeat = 1; repeat <= 3; repeat++) {
      const destination = resolve(output, `container-${repeat}`);
      mkdirSync(destination, { recursive: true });
      const seconds = run('docker', ['run', ...hardened, ...mounts(resolve('data'), destination), image,
        '--input', '/input/example.csv', '--compare', '/input/candidate.csv', '--output', '/output']);
      timings.push({ repeat, seconds });
    }
    const invalid = resolve(output, 'invalid-input');
    const negative = resolve(output, 'negative');
    mkdirSync(invalid, { recursive: true });
    mkdirSync(negative, { recursive: true });
    writeFileSync(resolve(invalid, 'bad.csv'), 'invalid\nrow\n');
    const result = spawnSync('docker', ['run', ...hardened, ...mounts(invalid, negative), image,
      '--input', '/input/bad.csv', '--output', '/output'], { encoding: 'utf8' });
    if (result.error) throw result.error;
    json('negative.json', { exitCode: result.status, stderr: result.stderr, stdout: result.stdout,
      reportsCreated: files.some(file => existsSync(resolve(negative, file))) });
    assert.equal(result.status, 1, 'Malformed input must exit with code 1');
    assert(files.every(file => !existsSync(resolve(negative, file))), 'Malformed input published reports');
    json('container-timings.json', timings);
    console.log('Three container evaluations passed; malformed input rejected with exit code 1.');
    break;
  }
  case 'compare': {
    const comparisons = [];
    for (const file of files) {
      const expected = hash(resolve(output, 'native', file));
      for (let repeat = 1; repeat <= 3; repeat++) {
        const actual = hash(resolve(output, `container-${repeat}`, file));
        comparisons.push({ file, repeat, nativeSha256: expected, containerSha256: actual, equal: actual === expected });
      }
    }
    json('reproducibility.json', { revision, comparisons });
    assert(comparisons.every(item => item.equal), 'Native/container results differ');
    console.log('All six SHA-256 comparisons passed.');
    break;
  }
  default: throw new Error('Expected environment, native, build-image, containers or compare');
}
