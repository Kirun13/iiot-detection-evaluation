# Assignment 5 experimental record

Source revision for the principal measurements: `eec77f4963be768cdf461619e53fd88dae73a7f2`. Source and pipeline files are unchanged from the preceding passing revision `92dc1ea8372f5464cb98488204da934eba07f154`; the difference is README documentation.

| Scenario | Observation | Evidence |
|---|---|---|
| Baseline and packaging | Main build 4: SUCCESS; 49 tests, zero failures | JUnit XML and console |
| Native/container equivalence | Both report files matched in all three repeats | Six SHA-256 comparisons |
| Malformed input | Exit code 1; no reports created | negative.json |
| Controlled F1 regression | Experiment build 2: four failed tests; downstream stages skipped | JUnit XML and console |
| Recovery | Experiment build 3: SUCCESS after reverting the defect | Build metadata and artifacts |
| Automatic triggering | Main build 4 and experiment build 3: Started by an SCM change | Build cause metadata |

The controlled defect is commit `35c4934` on `experiment/assignment-5-regression`; commit `95b1e63` reverts it. The branch ends with the correct F1 implementation. Both jobs use the same Jenkinsfile.

The principal main build lasted 36.690 seconds. Docker reports a final image size of 79,290,903 bytes. Three container executions took 0.846, 0.816 and 0.835 seconds, including container startup and mounted-file access. These are observations from one host, not an inference latency benchmark or a statistically supported speed comparison.

[GitHub Actions run 39962431682](https://github.com/Kirun13/iiot-detection-evaluation/actions/runs/39962431682) passed independently on Windows and Linux for the same source revision.

The [assignment report](Assignment_5_Report.md) contains the theoretical section, practical steps, results, difficulties and Jenkins screenshots. [Execution evidence](Assignment_5_Evidence.zip) contains full hashes, input and environment metadata, reports, JUnit XML, logs and the pinned Jenkins plugin list. It also retains setup failures separately from the controlled regression. No local Jenkins passwords or agent secrets are included.
