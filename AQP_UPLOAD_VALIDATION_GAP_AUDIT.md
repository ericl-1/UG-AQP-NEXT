# AQP upload-validation gap audit

## Scope

This audit reviewed the supported QuestionMark, Scantron, answer-key, feedback, and portable-session paths against the validation conditions listed in the forward recommendations. It distinguishes blocking structural errors from conditions that a coordinator may review and confirm.

## Result

The existing validation was already broad. Duplicate and blank student identifiers, duplicate question numbers and item identifiers, invalid keys and responses, mixed scored/Unscored outcomes, question/key count and identity mismatches, unknown streams, malformed workbooks, stale-state replacement, feedback layout ambiguity, file-size/row limits, and malformed CSV quoting were already covered by retained browser tests.

Three gaps were confirmed and closed:

1. Numbered QuestionMark outcomes outside the supported 1–5 range could be converted to letters beyond E before validation. Numbered outcomes are now restricted to 1–5 and unsupported values block analysis.
2. An isolated `Score` or `Outcome` header could cause a question to disappear from parsing. Results and answer-key uploads now block when a question lacks its matching header.
3. A file containing more than one strongly labelled disclosure or consent item did not call attention to the ambiguity. AQP now warns the coordinator and continues to exclude only a confirmed Question 1 automatically.

## Severity decisions

- Invalid response ranges and incomplete Score/Outcome pairs are blockers because the response matrix would otherwise be incomplete or misinterpreted.
- Multiple possible disclosure items produce a warning because AQP does not silently exclude the additional item. The coordinator can inspect the file and decide whether the non-Q1 item belongs in the scored exam.
- Missing or unknown stream codes remain reviewable warnings because overall item analysis can still run; reliable DIF requires corrected language assignments.
- Reconstructed score differences remain review warnings. AQP uses the uploaded key and reports the discrepancy rather than trusting the source score column silently.

## Retained evidence

The malformed-upload suite now includes 18 generated workbooks plus Scantron, feedback-layout, workbook-bound, CSV, cross-file replacement, and stale-state cases. The complete test command remains `npm test`.

## Remaining operational work

No additional code gap was confirmed from the currently retained formats. Continue adding anonymized fixtures whenever an operational export differs from the known layouts. A new warning or heuristic should not be added without a retained example and expected outcome.
