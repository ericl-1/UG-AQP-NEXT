# AQP-Next change summary for Claude

## Build identity

- Starting point: AQP `1.0.0-beta.1`, build `20260923-01` (`Downloads/index.html`; originally labelled 0.8)
- Current development build: AQP `1.0.0-beta.1`, build `20261010-01`
- Working branch: `feature/synthetic-edge-fixtures`
- Working file: `index.html` in the isolated development worktree
- The Downloads baseline was not modified.
- Builds through `20261007-01` have been retained in GitHub. Build `20261010-01` is being developed in the isolated worktree and is not live until its pull request is approved and merged.

## Build 20261010-01 — Synthetic edge fixtures and sign-in preview

- Added paired results and answer-key fixtures for missing responses, single-language cohorts, and small samples, with deterministic expected-outcome regression coverage.
- Added a preview-only institutional sign-in stage after the existing Assessment Pulse sequence; no credentials are currently required or stored.
- Preserved the original ECG introduction and grid, then moves the completed identity left before raising the sign-in card into the right-side region.
- Kept the ECG behind the fully opaque identity and responsive to the split layout so it remains visible without extending behind the sign-in card.
- Documented first-use uOttawa/System appearance defaults and browser-local preference persistence in the FAQ and release notes.
- Analysis calculations, report output, and the existing home workflow are unchanged.
- Normalized the retained pre-launch release history into a continuous `0.1.0` through `0.9.0` development sequence followed by `1.0.0-beta.1`. Original build numbers and dates remain unchanged, and no new build was created for this catch-up action.

## Build 20261007-01 — Feedback parser strengthening

- Expanded deterministic attribution for explicitly labelled multi-question comments using commas, ampersands, slashes, semicolons, and English or French connectors.
- Added quantity safeguards for student counts, response and answer-option counts, exam-question totals, numeric fractions, percentages, and patient ages.
- Added support for recognized feedback-comment columns located outside column B or on a later worksheet, while retaining the older QuestionMark layout.
- Validated the parser against four operational feedback workbooks and added support for the headerless two-column export used by Unit I Part A, including parsing from its first response row.
- Added `6=` and `Question 79;` reference formats and safeguards for CURB-65, hyphenated ages, and answer-option numbers inside an explicitly labelled question comment.
- Tightened categorisation so definition/terminology questions default to Content unless an explicit bilingual issue is stated, while narrow technical/logistical comments remain Other even when attributed to a question.
- Added a dedicated browser regression suite and parser decision-map documentation under `validation/FEEDBACK_PARSER_VALIDATION.md`.
- Updated the Student Feedback FAQ and release notes. MCQ scoring, DIF, reports, and coordinator-editable feedback decisions are unchanged.

## Build 20261004-02 — Setup wizard Dark Mode completion

- Converted the saved-draft recovery banner, wizard action bars, upload fields, inline file-status messages, validation previews, reconciliation summaries, and feedback confirmation states from hard-coded light fills to theme-aware surfaces.
- Covered QuestionMark, Scantron, standalone feedback, and combined-analysis upload paths, including empty, loaded, ready, warning, blocking, and confirmed states.
- Applied the same semantic success, warning, error, information, border, text, and hover treatments under dark uOttawa and dark Elentra branding.
- Upload parsing, validation rules, analysis calculations, navigation, and report output were not changed.

## Build 20261004-01 — Distractor Analysis live-review enhancement

- Preserved the existing question-list and detail-panel workflow rather than replacing the room or adding a new report.
- Added a compact **What happened** summary that presents the strongest observed response evidence before interpretation.
- Separated observed evidence from automated interpretation and added a clear reminder that pattern signals require expert judgment.
- Improved chart communication: keyed and alternate options are labelled directly, overall bars state their response denominator, and quartile columns show group sizes and within-group context.
- Added related evidence for linked student feedback, DIF status, and applied exceptions without importing Review Queue state or duplicating decision controls.
- Added an accessible on-demand Methodology panel explaining Q1–Q4 ordering, signal limitations, and alternate-key handling.
- Deferred a standalone Distractor Analysis report until operational use identifies a clear audience and decision/retention need.
- Removed technical DIF model-estimation notes from director-facing DIF-only and combined previews and Word exports. The DIF room, CSV/JSON Analysis records, and audit trail continue to retain complete non-estimation statuses and reasons.
- Simplified the default DIF workspace for non-statistical audiences. The primary table now presents **Review for DIF**, **No DIF detected**, or **Unable to assess** alongside EN/FR performance and the gap; the seven model statistics remain available through an accessible **Show statistical details** control.
- Made **Unable to assess** interactive: selecting it first explains the limitation in plain language, followed by a clearly labelled technical reason for program-evaluation review. This replaces the ambiguous **Not estimated** wording without changing suppression rules or calculations.
- Updated the in-app FAQ, release notes, roadmap, and browser regression coverage.
- Scoring, quartile assignment, pattern thresholds, item analysis, DIF, feedback, exceptions, and report calculations were not changed.

## Build 20261002-02 — Feedback Overview workflow

- Added a readiness banner that distinguishes fully routed feedback from sessions with unresolved comments and explains the next action in plain language.
- Added direct actions to open detailed Feedback Review or resolve Unmapped Comments without searching through the sidebar.
- Added a compact routing summary for responses received, question-attributed responses, General feedback, unresolved comments, and discarded-response context.
- Made every Top Commented Questions entry actionable: selecting one opens that question in Feedback Review, scrolls it into view, and places keyboard focus on its section.
- Preserved the existing participation, MCQ-overlap, category, question-coverage, and concentration metrics without duplicating detailed comment controls.
- Added responsive stacking and theme-aware surfaces for Light, Dark, uOttawa, and Elentra combinations.
- Updated the in-app FAQ, release notes, forward roadmap, and retained browser regression coverage.
- Feedback parsing, categorisation, question attribution, MCQ calculations, DIF, persistence, and report generation were not changed.

## Build 20261002-01 — Dark Mode and Assessment Pulse splash

- Separated institutional **Brand** (uOttawa or Elentra) from interface **Mode** (Light, Dark, or System) in Settings; either brand can now be used with either appearance.
- Added a professional charcoal Dark Mode across setup, analysis rooms, navigation, dialogs, tables, statuses, and controls while retaining category-specific semantic colours.
- Added System mode, which follows the operating-system appearance preference and responds when that preference changes.
- Kept report previews, print output, and exported reports intentionally light and paper-white so their established distribution format does not change.
- Completed the Exceptions dark-mode treatment: definition panels, question rows, fields, expanded Alternate Key workspaces, and Credit/Delete decision highlights now use dark-mode surface and semantic tokens rather than hard-coded light fills.
- Isolated flagged, easy, and DIF table-row highlights inside report previews so they retain their intended light paper colours even when the working interface is dark.
- Reworked the standalone DIF report's dense suppression block into a structured estimation-coverage note with question numbers, short status labels, and the full methodological reason for each non-estimated item.
- Replaced the former progress splash with the approved **Assessment Pulse** concept: an ECG-style grid, analytical pulse centred through the application mark, larger logo/title, and the slogan **“From responses to confident review.”**
- Made the splash inherit the selected brand and appearance and respect reduced-motion preferences.
- Saved brand and appearance locally as separate preferences and updated Privacy & Local Data so both can be reset together.
- Updated the in-app FAQ, release notes, retained documentation, and automated regression coverage.
- Scoring, item analysis, DIF, feedback, exception handling, and report calculations were not changed.

## Build 20261001-02 — Student Feedback navigation structure

- Restructured the Student Feedback sidebar into three equal destinations: **Overview**, **Feedback Review**, and **Unmapped Comments**.
- Moved the existing feedback KPI summary and Top Commented Questions chart into the dedicated Overview room without changing their calculations or content.
- Promoted Unmapped Comments from an indented sub-room to a full navigation room while retaining its unresolved-comment badge.
- Kept Feedback Review focused on comment review and categorisation by hiding the overview panel in that room.
- Positioned Feedback Overview metrics directly below the room title and description so the page hierarchy reads correctly.
- Made the analytical-Q marks in the interface inherit the active uOttawa or Elentra accent colour rather than remaining garnet in both themes.
- Added a proper all-mapped empty state to Unmapped Comments, preventing the former `NaN%` progress display when no comments require attribution.
- Updated the in-app FAQ, release notes, and retained browser coverage for the new navigation structure.
- This is intentionally a structural first pass. A richer Feedback Overview and a purpose-built Distractor Analysis report remain documented backlog items.
- Feedback parsing, category assignment, mapping decisions, MCQ calculations, DIF, persistence, and report generation were not changed.

## Build 20261001-01 — analytical-Q identity and Fluent icons

- Replaced the legacy magnifying-glass/AQP/checkmark identity with the approved analytical-Q mark: a garnet rounded tile containing a white Q and three analytical bars.
- Applied the identity consistently to the splash screen, application top bar, home and setup headers, results navigation, footer, About panel, browser favicon, report-preview byline, and Word-report byline.
- Replaced the principal navigation and workflow icons with locally embedded Microsoft Fluent System Icons Regular 24 px and removed the external Tabler icon-webfont dependency.
- Retained production SVG source artwork and brand-use guidance under `assets/brand/`, plus a `THIRD_PARTY_NOTICES.md` file containing the Fluent icon attribution and MIT licence.
- Kept charts, statistical graphics, status indicators, and data visualizations purpose-built rather than forcing them into the interface-icon family.
- Confirmed that Fluent icons inherit theme colours through `currentColor`; active navigation icons now have regression coverage proving that they follow the uOttawa and Elentra accent tokens.
- Improved Overview readability with softly separated result groups and category-matched accents: amber for flagged questions, blue for too-easy questions, and indigo for DIF.
- Moved the compact DIF KPI set into the export toolbar and joined the methodology panel visually to its results table.
- Corrected Distractor Analysis key-competition detection so empty options cannot be flagged through a `0 ≥ 0` comparison. A competitor must attract at least 10% of Quartile 3 or Quartile 4 and meet or exceed the keyed option. Explanations now spell out every matching quartile, name the key and both within-quartile percentages, and distinguish them from the overall answer distribution.
- Corrected the Answer Distribution bars to use the displayed global percentage as their width. Previously, bars were scaled relative to the most-selected option, so a 60% answer could incorrectly appear as a full-width 100% bar.
- Verified the synthetic Question 3 baseline: 40 students; C=16 (40%), D=24 (60%); quartile counts for C=`10,6,0,0` and D=`0,4,10,10`, ordered from Quartile 1 (lowest) through Quartile 4 (highest). The existing ascending-score assignment is correct and was retained.
- Added prominent **Beta** badges beside the Distractor Analysis and Near Threshold room titles.
- Invalidated cached performance-quartile data whenever analysis reruns. Credits and alternate keys can change student totals, so reopening Distractor Analysis now rebuilds quartile membership from the updated scores; accepted alternate answers remain excluded from distractor warnings.
- Refined the Exceptions room with aligned columns, stronger editable-field borders, and a persistent **Save & Update Analysis** bar. Saving now immediately recalculates and returns to Item Analysis, so Credit and Alternate Key changes are visible without a separate setup rerun.
- Kept Near Threshold candidate rows muted while restoring full emphasis to their actionable inclusion buttons.
- Core scoring, difficulty, discrimination, reliability, DIF regression, upload validation, persistence, and report-content methods were not changed.

## Build 20260929-01 — analysis-record consolidation

- Consolidated the former **Session record (CSV)** and **Session data export (JSON)** into one **Analysis record** card with CSV and JSON download choices.
- Added one canonical privacy-minimized record builder. CSV and JSON are now serializers of the same summary, per-question statistics, DIF detail, feedback counts, thresholds, session metadata, and audit history, reducing the risk of the two formats drifting apart.
- Added `recordType: "aqp-analysis-record"` and `schemaVersion: "1.0"` to JSON Analysis records and aligned both filenames to `_analysis-record`.
- Renamed **Portable session backup** to **Reopenable AQP backup** throughout the current interface and FAQ. It remains structurally separate because it contains de-identified response-level data and any feedback comment text and is the only JSON format that AQP can import.
- Updated the in-app FAQ, Release Notes, validation guidance, retained project documentation, and automated browser coverage for the consolidated workflow.
- Narrative Overview remains deferred. The Fluent interface-icon direction and revised analytical-Q app mark were completed in build `20261001-01`.

## Build 20260928-03 — accessibility pass

- Converted FAQ questions into keyboard-operable accordions with button semantics, unique question/answer relationships, expanded-state announcements, and labelled answer regions. Search results are now native buttons and the search field has an accessible name.
- Repaired the shared focus-trap marker used by all dialogs. Escape now reliably closes the active dialog instead of allowing the global fallback to remove its handler first.
- Added Escape-to-close and focus restoration to report previews and the More Options menu. The menu now announces expanded/collapsed state and exposes menu/menu-item semantics.
- Added checked-state announcements to the data-source and DIF switches, keyboard activation for Unmapped Comments, current-page state to the sidebar, stable naming for statistical explanation panels, and a name for the Exceptions close control.
- Increased compact statistical information/expand controls to the WCAG 2.2 minimum 24-by-24-pixel target size.
- Corrected top-bar overflow at a 320-pixel viewport by hiding duplicated session/navigation metadata only at very narrow widths; core Help and More Options controls remain available.
- Added a retained browser accessibility suite covering unique IDs, dialog and visible-control naming, keyboard accordion operation, Escape/focus restoration, switch state, text contrast, target size, reduced motion, and 320-pixel reflow.
- This is an automated and code-level accessibility pass, not a claim of full WCAG conformance. Human VoiceOver testing on macOS and NVDA testing on Windows remain required.

## Build 20260928-02 — design-system consolidation

- Established a centralized **Calm clinical intelligence** design system covering colour, typography, spacing, radii, shadows, surfaces, controls, tables, statuses, focus treatment, and motion. The main application canvas and navigation remain white; neutral grey is limited to subtle grouping and interaction states.
- Reserved institutional garnet for identity, active navigation, focus, and principal actions instead of using it as a generic warning colour. Semantic status colours remain stable across themes.
- Strengthened the interface hierarchy with larger page and section headings, fewer competing bold labels, and clearer supporting-text treatment.
- Reduced the boxes-inside-boxes effect by using spacing, neutral surfaces, and dividers for internal organization while retaining bordered cards for genuine conceptual units.
- Standardized primary, secondary, quiet, compact, icon, segmented, and context-specific controls without changing their existing actions.
- Refined statistical tables with tabular numerals, calmer row tints, slimmer status rails, clearer hover states, softer separators, and sticky question columns for the primary MCQ and DIF tables.
- Standardized category badges, status chips, and explanatory alerts as distinct visual roles.
- Adopted an 8-pixel-based spacing rhythm and consistent transition timing, including reduced-motion support.
- Kept uOttawa and Elentra layouts/components identical; only brand tokens change, while semantic colours retain the same meaning.
- Deliberately deferred narrative analysis summaries and icon-family replacement to the documented interface-design backlog.
- No statistical calculation, upload validation, persistence, or report-content logic was changed.

## Build 20260927-04 — coordinator workflow UI

- Rebuilt the home screen around three real entry paths: start a new analysis, resume the single browser draft, or import a portable backup. Replaced the misleading Session History placeholder with Current browser draft.
- Added a persistent, clickable Upload → Validate → Analyse → Review → Export workflow indicator driven by actual session state.
- Reorganized Reports into Director reports, Analysis records, and Session recovery. The recovery group has separate privacy treatment because its backup contains response-level data and feedback text.
- Added a pre-import preview showing exam identity, contents, counts, exceptions, Near Threshold and Review Queue decisions, source build, schema, privacy details, and replacement/build warnings before anything is overwritten.
- Converted reconciliation guidance into three action-oriented states: Must fix before analysis, Review recommended, and Ready to confirm, each with the relevant next action.
- Added a Privacy & local data panel showing the stored draft, save/expiry dates, contents, and approximate size. Coordinators can clear the draft or all AQP local data and optionally reset theme preferences; downloaded files are explicitly unaffected.
- Added browser coverage for the new import preview, workflow state, report grouping, draft home action, privacy details, and validation guidance.

## Build 20260927-03 — portable session recovery

- Added a separate **Portable session backup** in Reports. It preserves the response-level state needed to reopen an analysis: de-identified responses, answer key, configuration, exceptions and reasons, Near Threshold inclusions, Review Queue decisions, feedback work, and session metadata.
- Added **Import saved session** to the home screen. Import validates the file type and schema, rejects report-only JSON, malformed/truncated content, files over 25 MB, and unsupported newer schemas, then recalculates the analysis from the saved responses.
- Kept the existing **Session data export** unchanged as a privacy-minimized, report-only integration record. It deliberately remains non-importable and contains no student outcomes.
- Introduced portable-session schema version `1`, independent of application version/build, with explicit privacy metadata.
- Portable backups and browser drafts omit student names and institutional identifiers. The persistence sanitizer now uses a strict whitelist, also closing a gap where Scantron `name` could previously have entered browser storage.
- Restored session dates are converted back to real Date objects, preventing failures in later structured exports.
- Expanded the browser regression suite with export/import round-trip coverage and invalid-file checks. It verifies restored calculations, exceptions, Near Threshold choices, Review Queue state, feedback, metadata, report availability, and identifier omission.
- Updated the in-app FAQ and Release Notes to explain the distinction between report-only Session data JSON and importable portable backups, including the need to handle de-identified responses and feedback text securely.

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

- Closed the verified work as AQP `1.0.0-beta.1`, build `20260927-01` (originally labelled 0.8).
- Added the build to the in-app Release Notes with the completed statistical validation, exception/report regression coverage, malformed-upload safeguards, state-safety changes, question-count authority correction, and report fixes.
- Updated the in-app FAQ to distinguish blocking upload errors from correctable warnings and to document results/key matching, replacement-upload behaviour, supported formats, language-stream handling, draft privacy/expiry, exception persistence, and Review Queue persistence.
- Kept the FAQ version aligned with the application version and set both FAQ and Release Notes dates to September 27, 2026; the date records the FAQ revision without implying a new build.

## Remaining architectural limitations

- The application still loads XLSX, JSZip, FileSaver, and icon assets from public CDNs. It therefore is not fully offline/self-contained despite being a single HTML artifact. Bundling these libraries would substantially increase the file and should be handled as a deliberate deployment decision.
- Browser localStorage remains browser/profile-specific. Portable backups now support manual coordinator/device handoff, but are not a substitute for managed institutional storage, permissions, retention, or shared history.
- Multi-user workflow, shared history, permissions, retention policy, and centralized audit records still require the planned SharePoint/SPFx or other managed persistence layer.
- GitHub remains the release source of truth. Development changes are prepared on isolated branches and become live only after their pull requests are merged into `main` and GitHub Pages deploys them.

## Enhancement build completed September 28, 2026

- Prepared AQP `1.0.0-beta.1` build `20260928-01` with four coordinator-facing enhancements (originally labelled 0.8).
- Added precise DIF non-estimation classifications for sparse cells, singular model matrices, complete and quasi-complete separation, maximum-iteration non-convergence, and invalid statistics. “Not estimated” remains distinct from “No DIF detected” in the interface and is carried into CSV, JSON, HTML, and Word outputs.
- Added a reproducibility record to structured exports: application and schema versions, source filenames and SHA-256 fingerprints, analysis/reconciliation timestamps, thresholds, stream settings, validation and score-comparison results, exceptions, Near Threshold inclusions, Review Queue sign-offs, DIF suppressions, and an event history.
- Added a clearly labelled, deterministic demonstration session containing only synthetic bilingual MCQ, DIF, and feedback data. It is available from the home screen and remains visibly marked throughout the session.
- Added an advisory report-readiness panel covering stale or unreconciled analysis, unfinished Review Queue items, unresolved feedback mapping, score discrepancies, and documented DIF suppressions. It informs but never disables exports.
- Updated the in-app FAQ and Release Notes and the forward-recommendations document. AI-assisted features were recorded for future governance review only; no AI processing was added.
