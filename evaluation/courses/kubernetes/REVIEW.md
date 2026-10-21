# REVIEW (self-review by the authoring model; not independent evidence that the course teaches well)

Docs basis: kubernetes.io pages read 2026-10-20. The site's version menu lists v1.37 as current; pages mention "Alpha since v1.37". The pages do not print their own version, so "exactly v1.37" is not verified.

## Rubric scores (0-2)
| Lesson | Accuracy | Prereq clarity | Depth | Interaction | Feedback | Accessibility | Transfer | Usability |
|---|---|---|---|---|---|---|---|---|
| 1 desired-state-replicasets | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 2 |
| 2 rolling-update-arithmetic | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 |
| 3 readiness-stalled-rollouts | 1 | 2 | 1 | 2 | 2 | 1 | 1 | 2 |

Reasons for scores below 2:
- Accuracy, lesson 3: the explanation of how readiness gates the rollout is combined from several documented statements. The text labels its own reasoning (course derivation). The simulated outputs are invented. Round-by-round Pod counts are derived from the documented limits, not observed.
- Depth: three 30-minute lessons for a benchmark; no Recreate, rollback, proportional scaling or HPA practice.
- Accessibility: SVGs have text equivalents and meaning uses words and symbols; widgets are the built-in keyboard-operable ones. Only desktop width checked; 375 px not tested.
- Transfer, lesson 3: the transfer scenario has an intentionally ambiguous cause and the model answer says so; a learner may find it vague.

## What was run
- validate and build: 0 errors, 0 warnings.
- Local serve and browser smoke test: the three lessons render, no console errors, widgets mount, the parameter-explorer outputs update correctly (replicas 4, surge 30%, unavailable 20% gives 2 extra, 0 unavailable, max 6, min 4).
- Not tested: mobile width, export/import, keyboard-only use, print view, other activities clicked through (system-flow, code-trace, evidence-case, classify).

## Facts verified (read from the raw page text via curl and also WebFetch summaries)
Rollout only on .spec.template change; scaling does not; maxSurge/maxUnavailable defaults 25%, rounding up/down, not both 0; progressDeadlineSeconds default 600, must exceed minReadySeconds; minReadySeconds default 0; strategy default RollingUpdate; 10 old ReplicaSets kept; ProgressDeadlineExceeded and NewReplicaSetAvailable reasons; readiness probe failure listed as a cause of a stuck rollout; probe defaults 0/10/1/1/3; HTTP success 200 to <400; readiness removes Pod from EndpointSlices; readiness runs for the whole container lifecycle; ReplicaSet ownerReferences and the recommendation of Deployments; the thermostat analogy.

## Not verified or caveats
- The exact docs version of each snapshot.
- Whether the controller picks exactly the intermediate Pod counts shown in the traces (the course says these are illustrative).
- All kubectl-style outputs are invented and labelled as such.
- "Rollback is not automatic" is supported by the docs' statements that the controller keeps retrying and reports a condition, and by the existence of a manual rollback section; I did not find a sentence that says "never rolls back automatically".
