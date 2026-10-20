# Quality review and verification

## Review rubric

Score each criterion 0–2 for every lesson: 0 = absent or wrong, 1 = present but weak, 2 = solid. Use the rubric during your review pass and record the results in the course's `REVIEW.md`.

**This is the authoring model's self-review. It does not prove that the course teaches well.** Say so when you report.

| Criterion | 2 = solid |
|---|---|
| Accuracy | Central claims trace to the cited sources; versions and jurisdiction are stated; simplifications are labelled. |
| Prerequisite clarity | Terms are defined before use; prerequisites are listed and come earlier; outside prerequisites say where to learn them. |
| Depth | Mechanisms, alternatives and limits are covered, at the depth the learner asked for. A worked example shows reasoning, not just steps. |
| Interaction quality | Each activity requires predicting, deciding, producing or interpreting. Every control works. Assumptions are stated. |
| Feedback | Wrong options name misconceptions; explanations give reasons; open tasks have criteria and a model. |
| Accessibility | Text equivalents for visuals; keyboard operable; meaning not carried by color alone; works at 375 px width. |
| Transfer | The transfer task uses a genuinely new context and assesses the stated outcome. |
| Usability | The lesson fits the session length; the next step is clear; nothing is a dead end. |

## Verification checklist (run before reporting completion)

1. `node scripts/lk.mjs validate <course>` reports zero errors. Read the warnings: missing misconception feedback, missing debriefs and missing access dates are quality issues.
2. `node scripts/lk.mjs build <course>` succeeds. Read the generated `COVERAGE.md`: every outcome is taught and assessed.
3. If a browser is available, open `site/index.html` and check:
   - at least one lesson renders with every block type it uses;
   - each activity works (change inputs, reveal evidence, check answers);
   - an MCQ shows misconception feedback;
   - progress export and import work;
   - the glossary popover opens from the keyboard;
   - the layout works at 375 px width;
   - the print view shows solutions.
4. Spot-check facts against sources, prioritizing numbers, dates, quotations and version-specific instructions.
5. Report separately:
   - what you ran and observed;
   - what you reviewed manually;
   - what remains unverified;
   - known limitations.
