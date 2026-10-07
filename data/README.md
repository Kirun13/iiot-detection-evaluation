# Synthetic evaluation fixtures

Both CSV files contain the same twelve invented sample IDs and labels: six attacks and six normal observations, with four samples per segment. Predictions and latency_ms are manually assigned fixtures, not measured model outputs.

Baseline (`example.csv`): TP=4, FP=2, TN=4, FN=2; precision=recall=F1=2/3, FPR=1/3, accuracy=2/3. Nearest-rank p95 latency=75 ms.

Candidate (`candidate.csv`): TP=5, FP=1, TN=5, FN=1; precision=recall=F1=5/6, FPR=1/6, accuracy=5/6. Nearest-rank p95 latency=77 ms.

Deltas (candidate minus baseline): F1=1/6, FPR=-1/6, accuracy=1/6. These expected values verify the evaluation code and do not support a claim that hybrid learning or federated learning improves a real detector.

The author-created fixtures are distributed under this repository's MIT license. No TON_IoT records, personal information or real infrastructure traffic are included. Any future external dataset needs its own provenance and license documentation.
