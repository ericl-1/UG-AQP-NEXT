# AQP-Next change summary for Claude

## Build identity

- Starting point: AQP 0.8, build `20260923-01` (`Downloads/index.html`)
- Current development build: AQP 0.8, build `20260927-02`
- Working file: `index.html` in the local `AQP (HTML)` project folder
- The Downloads baseline was not modified.
- Build `20260927-01` was merged into GitHub `main` and deployed through GitHub Pages on September 27, 2026. Build `20260927-02` is being developed on an isolated feature branch and is not live until its pull request is approved and merged.

## Build 20260927-02 — analysis reconciliation

The existing upload preview was enhanced into a formal pre-analysis checkpoint rather than adding a separate validation room.

- The coordinator now sees students included, total question columns detected, Disclosure exclusions, Unscored exclusions, scored questions retained, answer-key matching, effective scoring denominator, missing responses, EN/FR matching, and unresolved findings in one summary.
- The response-level score-comparison KPI was removed because a large “0 of N values differ” total was technically accurate but not useful to coordinators. Score reconstruction remains active internally; an amber, actionable warning appears only if a discrepancy is actually found.
- The distinction between uploaded structure and analyzed structure is explicit. The golden dataset demonstrates this as 14 detected questions → 1 Disclosure excluded → 1 Unscored excluded → 12 scored questions.
- The confirmation action is now **Confirm and continue**. It records a timestamped reconciliation snapshot in session state.
- **Return to uploads** reopens the source-file controls without discarding the rest of setup.
- Blocking upload defects still prevent confirmation. Correctable warnings remain visible and require an explicit coordinator decision to continue.
- Automated coverage now freezes the reconciliation values, warning state, confirmation timestamp, and continuation gate.

## Correctness changes

1. **QuestionMark scoring is reconstructed from the answer key.**
   - Item scores are now derived from each student's recorded response and the uploaded answer key.
   - QuestionMark's binary score columns are used only for cross-validation.
   - If any response-level differences are found, AQP displays a warning stating that the uploaded answer key controls the analysis.
   - The same reconstruction rule is used for the pre-exception baseline.

2. **Configurable item-analysis thresholds now affect flagging.**
   - The discrimination cutoff now uses the configured `disc` value rather than a hard-coded `0.10`.
   - Default discrimination threshold is explicitly `0.10` and the Settings label now describes it as the Low Discrimination threshold.
   - Negative discrimination remains Poor Discrimination.
   - The established `p < 0.80` eligibility condition for Poor/Low Discrimination was retained, preserving the validated institutional result for the supplied exam.
   - Easy and difficult cutoffs continue to use their configured values.

3. **Configured DIF significance is honored.**
   - DIF importance uses the configured `dif` p-value instead of a hard-coded `0.01`.
   - Suggestive-DIF detection starts at the configured formal threshold and extends to `< 0.10`.
   - HTML and Word DIF report language displays the active configured threshold.

4. **DIF convergence failures are no longer silently treated as valid estimates.**
   - Logistic regression returns an explicit convergence state.
   - DIF flagging is suppressed if either model fails to converge.
   - The DIF table shows `Not estimated` with an explanatory tooltip for such items.

5. **Unscored-item detection checks the complete dataset.**
   - Detection previously inspected only the first five student rows.
   - It now evaluates all nonblank outcomes for each candidate question.

## Combined feedback workflow

1. **The MCQ question count is available before analysis.**
   - A parsed MCQ upload with `G.nQ` now controls the feedback ceiling immediately.
   - The supplied 83-question exam displays `Q1–Q83 ceiling` during feedback upload instead of the incorrect Q1–Q150 default.
   - The preflight panel now reports `MCQ cross-reference on` before the combined analysis runs.

2. **The feedback question-count field locks correctly in combined mode.**
   - It displays `Using question count from MCQ analysis — 83 questions` for the supplied data.
   - This prevents numeric references above the real exam range from being auto-attributed as questions.

## Session persistence and privacy

1. **Near Threshold inclusions persist.**
   - `_ntIncluded` is included in the draft payload and restored on resume.
   - Toggling an inclusion triggers an immediate save.

2. **Review Queue decisions persist.**
   - `_reviewState` is saved and restored after the analysis rerun.

3. **Feedback-only sessions can be saved and resumed.**
   - Saving is no longer blocked by the absence of `G._lastN` when finalized feedback exists.
   - Draft detection, history display, and resume accept a feedback-only session.

4. **Feedback edits auto-save.**
   - Mapping, general/discard actions, recovery from discarded status, bookmarking, and manual classification now save the session.

5. **Elentra IDs survive restore.**
   - `G.elentraIds` is explicitly restored before rerunning the analysis.

6. **Coordinator identity survives restore.**
   - Draft save/restore now targets the actual `coordinator-name` field instead of a nonexistent element ID.

7. **Draft recovery is safer.**
   - Resume no longer deletes the stored draft before rerendering.
   - The successful rerun replaces the draft; a failed rerun leaves the prior recovery copy available.

8. **Stored personal information is reduced.**
   - Student first names, last names, and institutional IDs are removed from the localStorage draft copy.
   - The in-memory working data is unchanged during the active session.
   - Drafts automatically expire and are removed after 30 days.

## Near Threshold integration

1. Included questions now update:
   - Overview and Item Analysis presentation
   - MCQ report
   - Standalone DIF report
   - Combined MCQ+DIF report
   - Review Queue contents
   - Review Queue tab label and sidebar badge
   - Saved session state

2. Included questions now appear in the relevant Item Analysis filters:
   - Needs Review
   - Very Easy
   - Low/Poor Discrimination
   - DIF

3. Legacy report helper text no longer exposes the phrase `Near threshold` to report readers. Included items use their report-facing category and recommendation.

## Report and export fixes

1. **Exam average precision is consistent.**
   - The precise computed average is retained instead of rounding it to an integer before report rendering.
   - For the supplied exam, both dashboard and MCQ report display `78.4%`.

2. **Report summaries include coordinator-selected Near Threshold items.**
   - Question Health totals now agree with Table 1/Table 2 contents.

3. **Too Easy descriptions use the active threshold.**
   - HTML and Word tables no longer hard-code `96%` when a custom easy threshold is active.

4. **Effective Questions in the Session Record is corrected.**
   - It subtracts both deleted and credited questions, matching AQP's denominator rule.

5. **CSV formula injection is mitigated.**
   - User-controlled values beginning with spreadsheet formula prefixes are neutralized.
   - Legitimate negative numeric statistics remain numeric.

## Accessibility fixes

1. Analysis-type cards now expose button roles, accessible names, keyboard focus, and Enter/Space activation.
2. Completed wizard steps become keyboard-operable buttons; active/future steps remain noninteractive.
3. The combined feedback upload zone now exposes button semantics and Enter/Space activation.
4. Bookmark stars now have meaningful `aria-label` text.
5. The analysis completion announcement now reports the actual Too Easy item count and uses correct singular/plural grammar.

## Validation performed

- All five embedded JavaScript blocks pass `node --check`.
- Full browser workflow repeated against the supplied files:
  - 191 students
  - 83 scored questions
  - EN 133 / FR 58
  - Exam average 78.4%
  - Cronbach's alpha 0.76
  - 3 concern flags: Q36, Q46, Q78
  - 9 Too Easy items: Q5, Q11, Q16, Q61, Q63, Q67, Q71, Q77, Q82
  - 2 formal DIF flags: Q6, Q48
  - 103 feedback respondents; 15 comments pending review
- Combined preflight verified at Q1–Q83 with MCQ cross-reference active.
- Session close/reload/resume verified with results and feedback restored.
- Near Threshold inclusion verified across the Review Queue badge, reload, and resume; the test inclusion was removed afterward.
- MCQ report preview verified at 78.4%, 9 easy items, and the expected Too Easy table contents.
- Browser console checked after the full run: no warnings or errors.

## Follow-up completed September 24, 2026 — synthetic golden regression suite

- Added a deterministic, entirely fictional QuestionMark results workbook, matching answer-key workbook, and feedback workbook.
- Added an end-to-end Chrome runner that opens the production `index.html`, uploads all three workbooks, runs combined MCQ/DIF/feedback analysis, and compares the application state with a frozen expected-results file.
- The first golden case covers 40 students, balanced EN/FR streams, 12 scored items, an opening disclosure item, a trailing unscored placeholder, healthy and deliberately problematic item statistics, a formal DIF signal, sparse-cell DIF suppression, feedback mapping edge cases, and score-column reconciliation.
- The final suite run passed with no alerts and no reconstructed-score mismatches across 480 response cells.
- Test documentation and an npm test command were added under `tests/golden/` and `package.json`.
- This is the first implementation phase of the broader regression recommendation. Exceptions, Near Threshold persistence, session resume, and exported-document assertions remain candidates for later golden cases.
- Synthetic scored items now use the production-style `Question ID: ######/#` convention with positive single- and multi-digit version numbers. The results and answer-key fixtures contain identical item IDs and question wording, and the automated suite explicitly verifies that agreement.

## Follow-up completed September 25, 2026 — independent statistical validation

- Added a separate Python reference implementation that does not execute or reuse AQP's JavaScript statistical functions.
- Recalculated scoring, item difficulty, point-biserial discrimination, Cronbach's alpha, flagging, DIF likelihood comparisons, Nagelkerke ΔR², chi-square p-values, sparse-cell status, and EN/FR contingency percentages.
- Used NumPy direct formulas, statsmodels binomial generalized linear models, and SciPy chi-square probabilities.
- All 112 reliable numerical, categorical, and suppression comparisons passed within predefined tolerances; no reconstructed-score mismatches or formal DIF discrepancies were found.
- A follow-up trace investigated three models initially reported as convergence differences. Their coefficients diverged and information matrices were nearly singular despite statsmodels reporting solver completion. The independent validator was corrected to test parameter identifiability; its final classification now agrees with AQP's conservative suppression.
- Added a reproducible script, pinned library requirements, machine-readable results, and a human-readable validation report under `validation/`.
- No production-code change was required. A future UI improvement could explain whether DIF was suppressed for sparse cells, singularity/non-identifiability, separation, or maximum iterations.

## Follow-up completed September 25, 2026 — supplied-exam independent validation

- Ran the supplied operational results and answer-key workbooks through the production AQP interface and a separate Python reference implementation.
- Confirmed 191 included students and 83 scored questions, demonstrating that the opening disclosure item and trailing unscored item were excluded as intended.
- Compared exam-level results and all per-question difficulty, point-biserial discrimination, flags, recommendations, language-group contingency percentages, sparse-cell decisions, and estimable DIF model outputs.
- All 1,138 comparisons passed within the predefined tolerances. This included 61 DIF models compared numerically and 22 models appropriately suppressed because of sparse data or non-estimability.
- The synthetic browser regression suite and its 112-check independent reference validation were rerun afterward and both remained fully passing.
- Stored only a privacy-safe report and compact summary under the Git-ignored `validation/private/` folder. These outputs contain no student names, institutional identifiers, individual responses, answer key, or feedback text.
- No production-code change was required.

## Follow-up completed September 25, 2026 — exceptions and report regression coverage

- Added a second end-to-end browser regression case covering Credit, Delete, and Alternate Key exceptions; independent recalculation of post-exception scores, denominator, average, Cronbach's alpha, difficulty, and discrimination; DIF exclusion rules; Near Threshold inclusion; local save/reload/resume; HTML previews; CSV and JSON exports; and all four Word report types.
- Word packages are inspected directly for required OOXML parts, styles, table grids, and expected exception/Near Threshold content. The generated Word reports were also rendered to images and every final page was visually inspected for clipping, overlap, broken tables, and pagination defects.
- Corrected the structured session JSON `effectiveQuestions` value so it subtracts credited questions as well as deleted questions, matching the scoring denominator and Session CSV.
- Corrected the standalone DIF Word report so coordinator-included suggestive-DIF questions appear there just as they do in the HTML preview and combined report.
- Tightened the Word report attribution block and kept its lines together, eliminating near-empty pages containing only the analysis profile or date.
- The final rendered set contains eight clean pages: three MCQ, one DIF, three combined, and one feedback page.
- `npm test` now runs both the original frozen golden analysis and the expanded exception/report case. Both pass without browser errors or alerts.

## Follow-up completed September 25, 2026 — malformed-upload validation

- Added fourteen entirely synthetic malformed or borderline workbooks and a fifteen-scenario browser regression suite.
- AQP now blocks confirmation and analysis for duplicate or blank student IDs, duplicate question numbers, mixed scored/Unscored outcomes, unrecognised nonblank responses, unexpected item-score values, invalid Question ID versions, missing or unsupported answer-key values, key/results question-count or order mismatches, and differences in Question ID/version or wording between the results and answer key.
- Unknown or blank language-stream codes remain correctable warnings. They do not prevent confirmation because the existing stream-assignment workflow can resolve them before DIF analysis.
- Uploading a new results or key file immediately clears the prior confirmation and the replaced in-memory data. A failed re-upload can no longer leave previously valid data available to run accidentally.
- Results student presence is now part of run readiness; a file containing headers but no students cannot become analysis-ready.
- The analysis engine now independently refuses to run when upload blockers or a results/key count mismatch remain, even if invoked outside the normal disabled-button workflow.
- Corrected a question-count authority defect discovered by the suite: extra answer-key questions could previously overwrite the results-derived count and hide the mismatch. Results now remain authoritative, while key-marked Unscored positions may only remove positions that actually exist in the results.
- The full `npm test` command now runs three browser suites. All pass: the frozen analysis case, the exception/report case, and all fifteen malformed-upload scenarios.
- Rechecked the stricter rules against the supplied operational results and answer key: 191 students and 83 scored questions were accepted, and the independent comparison still passed all 1,138 checks.

## Build close completed September 27, 2026

- Closed the verified work as AQP 0.8, build `20260927-01`.
- Added the build to the in-app Release Notes with the completed statistical validation, exception/report regression coverage, malformed-upload safeguards, state-safety changes, question-count authority correction, and report fixes.
- Updated the in-app FAQ to distinguish blocking upload errors from correctable warnings and to document results/key matching, replacement-upload behaviour, supported formats, language-stream handling, draft privacy/expiry, exception persistence, and Review Queue persistence.
- Kept the FAQ version aligned with application version 0.8 and set both FAQ and Release Notes dates to September 27, 2026; the date records the FAQ revision without implying a new application version.

## Remaining architectural limitations

- The application still loads XLSX, JSZip, FileSaver, and icon assets from public CDNs. It therefore is not fully offline/self-contained despite being a single HTML artifact. Bundling these libraries would substantially increase the file and should be handled as a deliberate deployment decision.
- Browser localStorage remains browser/profile-specific and is not suitable for coordinator-to-coordinator handoff or longitudinal institutional storage.
- Multi-user workflow, shared history, permissions, retention policy, and centralized audit records still require the planned SharePoint/SPFx or other managed persistence layer.
- The local project folder is not currently a Git checkout. The revised file is ready to be copied into or committed from the actual GitHub repository once that repository is connected.
