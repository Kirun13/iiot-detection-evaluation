# Local Docker and Jenkins workflow

This extends the existing evaluation CLI; it does not implement IDS training or a web service. Use Node.js from `.nvmrc`, npm, Git, Docker Desktop with a Linux engine, and Java compatible with your Jenkins LTS release. Keep `package-lock.json` under version control and install with `npm ci`. After changing dependencies, use `npm install`; never edit the lockfile manually.

## Container execution on Windows PowerShell

```powershell
npm ci
npm run verify
docker build -t iiot-detection-evaluation:local .
$inputPath = (Resolve-Path data).Path
New-Item -ItemType Directory -Force results/container | Out-Null
$outputPath = (Resolve-Path results/container).Path
docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges --mount "type=bind,source=$inputPath,target=/input,readonly" --mount "type=bind,source=$outputPath,target=/output" iiot-detection-evaluation:local --input /input/example.csv --compare /input/candidate.csv --output /output
```

The base image is pinned by digest. The final image contains compiled JavaScript and production dependencies, runs as `node`, and defaults to `--help`. CSV files are read-only inputs; reports are written to the separate output mount. On Linux, grant UID 1000 write access to the output directory before running the container. No port needs to be published.

## Jenkins controller and Windows agent

Use the scripts in `scripts/jenkins/` to install and start a local Jenkins LTS controller and a separate Windows agent. The default runtime directory is `%LOCALAPPDATA%/AppliedSoft/Jenkins`, outside this repository. The controller listens on `127.0.0.1:8080`; executors on the controller are disabled. The agent uses label `windows-docker` and runs under the current Windows account, so this arrangement does not provide operating-system account isolation.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/jenkins/install.ps1
powershell -ExecutionPolicy Bypass -File scripts/jenkins/start.ps1
```

Initial installation creates an `admin` account and writes a randomly generated password to `secrets/admin-password.txt` in the runtime directory. Read this file locally to sign in. The password and agent secret are never committed. The start script launches controller and agent with hidden windows and writes their logs into the runtime directory. Processes are not automatically started after a Windows restart; rerun the start script.

The setup creates `iiot-assignment-5`, using `Jenkinsfile` from `feature/assignment-5-ci` in the public GitHub repository. SCM polling runs every minute after the first build loads the Jenkinsfile. GitHub credentials are not needed to read the public repository. Before running another repository, change the repository and branch configuration in the setup script. The GitHub Actions workflow continues to run separately.

## Pipeline and evidence

`Jenkinsfile` performs a clean checkout, validates the agent environment, installs locked dependencies, checks types, executes all tests with JUnit output, evaluates the CSVs natively, builds a Docker image, evaluates it three times, rejects an invalid CSV, and compares all six output hashes. Packaging occurs only after these checks pass. Jenkins always archives available diagnostics and JUnit output, including on failed builds.

The same infrastructure checks can be run outside Jenkins after `npm ci` and `npm test`:

```powershell
node scripts/ci.mjs environment
node scripts/ci.mjs native
node scripts/ci.mjs build-image
node scripts/ci.mjs containers
node scripts/ci.mjs compare
```

Each command exits nonzero on failure. Outputs are saved in ignored `ci-results/`. Every result records a source revision and/or input hashes; environment metadata uses actual execution timestamps. Container runtime measurements include Docker startup and mounted-file overhead, not IDS inference latency. Equal output hashes establish equivalence for the supplied synthetic inputs; they do not establish accuracy on real IIoT traffic or bit-identical Docker builds.

To stop the local Jenkins processes, use `scripts/jenkins/stop.ps1`. This leaves configuration, build history and credentials in the runtime directory for the next start.
