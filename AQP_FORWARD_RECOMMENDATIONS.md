# AQP-Next forward recommendations

## Purpose

This document records recommended future work for the Assessment Quality Platform after the QA, remediation, design-system consolidation, automated accessibility pass, analysis-record consolidation, identity/icon refresh, Student Feedback navigation restructure, Dark Mode/Assessment Pulse refresh, Feedback Overview workflow, Distractor Analysis live-review enhancement, setup-wizard Dark Mode completion, feedback-parser strengthening, synthetic edge-fixture coverage, institutional sign-in preview, and realistic bilingual demonstration delivered through version `1.0.0-beta.1`, build `20261011-01`.

These are forward-looking improvements rather than defects remaining from the two QA passes. Completed corrections are documented separately in `AQP_CHANGE_SUMMARY_2026-09-23.md`.

## Recommended order of work

### Priority 1 — Protect statistical correctness

#### 1. Expand the automated regression test suite (three browser suites completed September 25, 2026)

A synthetic end-to-end golden case now exists under `tests/golden/`. It exercises the production HTML in Chrome and freezes expected MCQ, DIF, and feedback results. Run it before every release with `npm test`.

The first case verifies student/question counts, disclosure and trailing-unscored exclusions, answer-key reconstruction, score reconciliation, difficulty, discrimination, Cronbach's alpha, DIF flagging, sparse-cell suppression, feedback attribution, and feedback categories.

The built-in demonstration now provides a second realistic presentation-scale scenario: 180 fictional students (130 English and 50 French), 70 fictional questions, broadly estimable DIF results, several known DIF patterns, two intentional safeguard examples, and 24 comments spanning all feedback-routing states. Its end-to-end checks prevent the demonstration from drifting back to a small or mostly non-estimable sample.

The second case now verifies:

- Post-exception scoring, denominator, Cronbach's alpha, average, difficulty, and discrimination recalculation
- Delete, Credit, and Alternate Key behavior
- Near Threshold inclusion and persistence through save, reload, and resume
- HTML preview, Word, CSV, and JSON report content
- OOXML package structure and rendered Word pagination

The third suite uses fourteen synthetic workbooks and fifteen scenarios to verify malformed-file rejection, duplicate and missing identifiers, question-number duplication, mixed scored/Unscored outcomes, invalid responses and keys, results/key count and content mismatches, correctable stream warnings, and stale-data clearing after a failed re-upload.

The second suite now also performs a portable-session export/import round trip, verifies restored statistics and coordinator state, checks privacy fields, and rejects report-only, malformed, and future-schema files. The next additions should concentrate on missing-response and single-language cases, older supported session-schema migration, and exact report approval/audit metadata.

#### 2. Expand independent statistical validation (additional edge-case validation completed October 14, 2026)

A separate Python reference implementation now validates the first synthetic golden exam using NumPy, statsmodels, and SciPy. All 112 reliable comparisons passed within tolerance. The retained package is under `validation/`.

A follow-up numerical trace confirmed that three apparently different convergence classifications were separated/non-identified models with nearly singular information matrices. AQP's suppression was appropriate; the reference validator was strengthened so solver completion alone is not treated as proof of an estimable model.

The supplied operational exam was then processed locally through both AQP and the independent implementation. All 1,138 aggregate and per-question comparisons passed within tolerance: 191 students, 83 scored questions, 61 numerically estimable DIF models, and 22 sparse or non-estimable models. The privacy-safe report is retained under the Git-ignored `validation/private/` folder; no student names, identifiers, responses, answer key, or feedback text are stored in it.

Continue the independent validation across additional datasets. Validate at minimum:

- Effects of Delete, Credit, and Alternate Key decisions
- Complete separation, singularity, and non-convergence behavior
- Single-language, small-sample, and missing-response exams
- Additional formal and suggestive DIF patterns

Retain the comparison scripts, expected outputs, tolerances, and sign-off as a formal validation package.

The October 14 follow-up added an independent Python pass over the retained missing-response, single-language, and small-sample workbooks. It verifies cohort composition, scored-question selection, missing-response counts, reconstructed scores, classical-test summaries, and conservative DIF prerequisites without executing AQP's JavaScript. All three edge datasets passed. Additional operational datasets and formal external sign-off remain future work.

#### 3. Maintain a versioned test-data package

Include synthetic or thoroughly anonymized examples for:

- A normal bilingual exam
- A single-language exam
- A small exam
- Missing and blank responses
- Disclosure items
- Unscored items at the beginning, middle, and end
- Mixed scored/unscored outcomes that should trigger review
- Key/results length mismatches
- Delete, Credit, and Alternate Key decisions
- Sparse DIF cells
- Non-convergent and separated DIF models
- Malformed or unexpected uploads
- Ambiguous feedback references
- Feedback numbers outside the actual exam range

Each dataset should have a machine-readable expected-results file.

#### 4. Add a complete analysis audit trail (completed in build `20260928-01`)

Every session export should record enough information to reproduce and defend the analysis:

- Application version and build
- Session-data schema version
- Source filenames
- Source-file hashes
- Analysis timestamps
- Active thresholds and stream codes
- Detected and excluded Disclosure/unscored items
- Score-validation comparisons
- Student stream corrections
- Exceptions and written justifications
- Near Threshold inclusion decisions
- Review Queue sign-offs
- DIF suppression and convergence reasons
- Final report generation timestamps

### Priority 2 — Improve validation and handoff

#### 5. Add JSON session import (core workflow completed in build `20260927-03`; export terminology consolidated in build `20260929-01`)

AQP now has a separate, versioned **Reopenable AQP backup** and a strictly validated home-screen import workflow. The privacy-minimized **Analysis record** is offered in CSV and JSON from one canonical model and is deliberately not importable.

The importer should:

- Completed: recognized schema version, required structural/type checks, malformed/truncated/incompatible/newer-file rejection, 25 MB size limit, confirmation before replacing a current browser draft, and recalculation from saved responses.
- Completed: strict student-field whitelist; names and institutional IDs are omitted from browser drafts and portable backups.
- Completed in build `20260927-04`: pre-import preview and source-build compatibility warning before replacing a draft.
- Still recommended: explicit migrations when a future schema version makes migration necessary.
- Continue to ensure imported text is rendered as text and never evaluated as code or markup.

#### 6. Complete the remaining upload-validation edge cases (gap audit completed October 14, 2026)

The principal validation framework is now in place: malformed uploads, duplicate and missing identifiers, duplicate question numbers, invalid responses and keys, results/key mismatches, mixed scored/Unscored outcomes, stream warnings, and stale-data clearing are covered by the validation interface and retained browser tests.

Review the remaining edge cases below against representative operational exports. Implement only gaps that are not already detected and explained clearly:

Before analysis, detect and explain:

- Duplicate student IDs
- Duplicate question numbers
- Empty or invalid answer keys
- Unsupported answer letters
- Key/results length mismatches
- Missing or unknown stream codes
- Unexpected score values
- Multiple possible Disclosure items
- Mixed scored/unscored status within one question
- Missing outcome columns
- Substantial disagreement between reconstructed and QuestionMark scores

Errors should distinguish between conditions that block analysis and warnings that require coordinator review.

The October 14 audit confirmed that most listed conditions were already implemented and protected by retained browser tests. It closed three remaining gaps: numbered QuestionMark responses outside 1–5 now block; unmatched Score/Outcome headers now block; and multiple strongly labelled disclosure or consent items now produce a review warning while only a confirmed Question 1 is excluded automatically. Continue adding anonymized operational fixtures when a new export variation is encountered.

#### 7. Add an analysis validation screen (completed in build `20260927-02`)

Before presenting final results, show a concise reconciliation summary containing:

- Students included
- Questions detected
- Disclosure items excluded
- Unscored or placeholder items excluded
- Answer-key entries matched
- Effective scoring denominator
- Missing responses
- Score-column discrepancies
- Stream corrections
- Warnings and unresolved conditions

The coordinator can return to the upload controls or explicitly confirm the reconciled structure. The implementation enhances the existing upload preview rather than creating a duplicate room: it displays the detected and retained question counts, Disclosure/Unscored exclusions, key match, effective denominator, missing responses, stream matching, blockers, and warnings. Score-column comparison runs silently unless it finds a discrepancy, in which case an actionable warning appears. Confirmation records a timestamped snapshot in session state.

#### 8. Explain DIF suppression precisely (completed in build `20260928-01`)

Distinguish among:

- Insufficient language-by-outcome cell counts
- Singular model matrix
- Failure to converge
- Complete separation
- Quasi-complete separation
- Invalid or non-finite model statistics

“Not estimated” must remain visually and semantically distinct from “No DIF detected.” Suppression reasons should also appear in structured exports.

#### 9. Add report approval metadata

Consider capturing:

- Coordinator who prepared the analysis
- Reviewer name
- Review date
- Final disposition for each flagged item
- Director or committee decision
- Optional decision notes
- Approval status

This information can later map into a SharePoint approval workflow.

### Priority 3 — Improve maintainability and deployment

#### 10. Separate development source from the deployment artifact

Keep the convenient single-file deployment, but maintain the source as separate modules during development:

- Data ingestion and file-format detection
- MCQ scoring and statistics
- DIF modeling
- Feedback parsing and classification
- Session persistence
- UI state and rendering
- Word report construction
- CSV and JSON exports
- Accessibility and modal utilities

A build process can combine the tested modules into one release HTML file. This will make code review, unit testing, and regression diagnosis substantially safer.

#### 11. Remove or formally manage CDN dependencies

The current file loads third-party libraries and icon assets from public CDNs. This means the application is not fully offline even though processing is client-side.

Evaluate one of these deployment models:

1. Bundle the dependencies into the generated HTML.
2. Host version-pinned copies on an approved institutional origin.
3. Store local files beside the HTML artifact.
4. At minimum, add Subresource Integrity hashes, version pinning, and an appropriate Content Security Policy.

The choice should be made with institutional IT because fully embedding the libraries will substantially increase the HTML file size.

#### 12. Version the structured export schemas (completed for backups in build `20260927-03` and Analysis records in build `20260929-01`)

Portable backups now use `fileType: "aqp-portable-session"` and `schemaVersion: 1`, separate from the application version and build. Unsupported newer versions are rejected clearly and the golden suite freezes the version and round-trip behaviour.

Privacy-minimized JSON Analysis records use `recordType: "aqp-analysis-record"` and `schemaVersion: "1.0"`. CSV and JSON are generated from the same canonical record so their shared fields remain aligned.

For every future schema change:

- Document the changed fields
- Provide an explicit migration where feasible
- Reject unsupported versions clearly
- Retain fixtures representing older versions
- Test round-trip export and import

### Priority 4 — Privacy and governance

#### 13. Complete an institutional privacy review

Confirm formal requirements for:

- Handling student identifiers in memory
- Browser-storage retention
- Shared workstations
- Local downloads
- Report storage and transmission
- Authorized roles
- Breach and incident response
- Records retention and destruction

Build `20260927-01` no longer places student names or institutional IDs in the saved browser draft, but identifiable source data is still processed in memory during an active session.

#### 14. Add a visible Clear Local Data control (completed in build `20260927-04`)

The Privacy & local data panel now explains and controls:

- Saved draft session
- Review decisions
- Feedback edits
- Theme or non-sensitive preferences, if selected

The actions require confirmation, distinguish draft data from optional theme preferences, state that downloaded reports/source files/backups cannot be removed by AQP, and suppress re-autosave for a currently open session whose local copy was deliberately cleared.

#### 15. Move to managed institutional storage when collaboration begins

The SharePoint/SPFx direction remains appropriate when AQP requires:

- Coordinator-to-coordinator handoff
- Multiple users
- Historical exam comparison
- Permissions and role-based access
- Approval workflow
- Institutional retention
- Centralized audit logs
- Shared report storage

The current single-browser architecture remains suitable for one analyst working on one active session at a time.

### Priority 5 — Operational and usability improvements

#### 16. Add an anonymized diagnostics export

Allow coordinators to create a support package containing:

- Application version and build
- Browser and platform information
- Detected column structure
- Parser decisions
- Counts and validation results
- Thresholds
- Suppression/error codes
- Sanitized diagnostic messages

Exclude student names, IDs, raw comments, free-text justifications, and individual responses by default.

#### 17. Add a built-in demonstration mode (completed in build `20260928-01`)

Provide a synthetic bilingual exam and feedback dataset that can be loaded without accessing real student information.

Uses include:

- Coordinator training
- Demonstrations
- User acceptance testing
- Accessibility testing
- Release smoke tests
- Troubleshooting browser compatibility

The interface should clearly label demonstration results so they cannot be mistaken for a real exam.

#### 18. Add an advisory report-readiness check (completed in build `20260928-01`)

The Reports tab now checks whether the current analysis is reconciled and current, Review Queue work is complete, feedback mapping is resolved, score discrepancies have been considered, and DIF suppression reasons are documented. The result is advisory and never prevents an authorized coordinator from exporting.

#### 20. Revisit AI-assisted features later — governance review only

No AI-assisted analysis, classification, recommendation, or report-writing feature is included in the current application. Reconsider this only after the deterministic platform is accepted by institutional IT and the intended use has been approved through privacy, security, academic-governance, and records-management review.

Before any implementation, define:

- Which specific task would benefit and why deterministic rules are insufficient
- Whether any student data, responses, comments, item content, or coordinator notes may leave the approved environment
- The approved provider, model, hosting region, retention policy, and contractual safeguards
- Required human review and a prohibition on autonomous scoring or final academic decisions
- Clear disclosure when generated text or categorisation is AI-assisted
- Reproducible prompts, model/version records, confidence limits, and auditability
- A non-AI fallback and a way to disable the feature institution-wide

Until those conditions are met, keep AQP's calculations, categorisation, and reports deterministic and locally processed.

#### 19. Complete human assistive-technology validation

Build `20260928-03` added retained automated checks for keyboard operation, focus restoration, dialog/control naming, switch state, contrast-sensitive design tokens, target size, reduced motion, unique IDs, and 320-pixel reflow. It also fixed the concrete issues found by those checks.

Complete the remaining human validation with:

- Keyboard-only navigation
- VoiceOver on macOS
- NVDA on Windows
- Long translated labels and content

Retain the automated suite for each release, but use human screen-reader testing for the complete upload-to-report workflow and record the browser, operating system, assistive-technology version, findings, and remediation evidence.

### Deferred interface-design backlog

#### 21. Add narrative analysis summaries

Revisit a concise, deterministic overview statement that answers **what happened**, **what needs action**, and **where supporting evidence is located** before presenting detailed metrics. This was deliberately excluded from the `20260928-02` visual-system build so that wording, statistical interpretation, and institutional approval can be designed and validated separately.

Any future implementation should:

- Derive every statement from already validated AQP results
- Avoid implying that a statistical signal is an academic decision
- Remain useful for MCQ-only, DIF, feedback-only, and combined sessions
- Handle all-clear, partial-analysis, sparse-data, and unresolved-review states
- Receive content review from assessment-methodology stakeholders

#### 22. Consolidate the icon language (completed in build `20261001-01`)

The principal navigation and workflow controls now use the user-approved **Fluent System Icons** direction, with selected paths embedded locally in the single HTML file. The external Tabler webfont dependency was removed. Purpose-built statistical graphics and status/data visualizations remain separate by design.

Visible text remains on important actions, the icon size scale is centralized, and icon-only controls retain accessible names. Future feature work should extend this same pattern rather than introduce another icon family.

The revised analytical-Q application mark is also complete and appears across the splash screen, top bar, primary headers, footer, About panel, favicon, report previews, and Word-report byline. Production SVG sources and usage guidance are retained under `assets/brand/`.

#### 23. Expand the Student Feedback Overview (completed in build `20261002-02`)

Build `20261001-02` established the room structure. Build `20261002-02` completed the richer coordinator overview with readiness state, routing totals, participation, question coverage, category distribution, MCQ/feedback overlap, comment concentration, and direct paths into detailed review and unresolved mapping.

The completed implementation:

- Shows a concise feedback-analysis status and any unresolved mapping work
- Summarizes participation, question coverage, category distribution, and concentration of comments
- Links directly to the most-commented questions and to Unmapped Comments
- Avoids duplicating detailed categorisation and reassignment controls from Feedback Review
- Supports feedback-only, combined-analysis, all-clear, unresolved, and empty states

Content and terminology should still receive assessment-stakeholder review before any interpretive narrative is added.

#### 24. Validate the need for a Distractor Analysis report (deferred by design)

The immediate use case is live coordinator or committee review, not distribution of a new report. Build `20261004-01` therefore strengthens the existing room with an evidence-first summary, clearer chart denominators and option roles, linked feedback/DIF/exception context, separated interpretation, and on-demand methodology. Review Queue status remains outside this room, and no export was added.

Revisit a report only after operational use identifies a durable audience, decision purpose, and retention requirement. If that need emerges, determine whether the smallest useful output is:

- A selected-item evidence appendix attached to the MCQ report
- A meeting snapshot for explicitly chosen questions
- A full standalone report with exam-level summary and methodology

Any future output must distinguish observed response data from automated signals, document original and accepted alternate keys, retain the Beta/methodology limitations, and receive methodology and report-audience review before implementation.

#### 25. Review and strengthen the feedback parser (first strengthening pass completed in build `20261007-01`)

Conduct a focused assessment of the current deterministic feedback parser before adding new categories or automation. The goal is to improve attribution accuracy, resilience to QuestionMark format variations, and the clarity of cases requiring coordinator review without changing the underlying privacy model.

The review should cover:

- How question references are recognized in English and French comments
- Ambiguous, multiple, malformed, and out-of-range question references
- General comments versus question-specific comments
- Duplicate comments, blank rows, unexpected columns, and workbook layout variations
- Category assignment rules, precedence, and false-positive/false-negative examples
- Confidence or reason codes that can be explained to coordinators
- Safe fallback to Unmapped Comments whenever attribution is uncertain
- A synthetic parser corpus with expected mappings and categories
- Regression tests for every accepted improvement

Keep final categorisation and routing editable by the coordinator. Any future AI-assisted parsing remains governed by item 20 and is not part of this deterministic parser review.

Build `20261007-01` added bilingual multi-question formats, embedded-reference handling, additional quantity safeguards, flexible worksheet/comment-column detection, a documented decision map, and a dedicated browser regression suite. Continue expanding the synthetic corpus whenever a new operational format or misclassification is observed; do not broaden heuristic attribution without a retained example and expected outcome.

#### 26. Revisit the combined MCQ+DIF report design only if a business need is confirmed

Three simulated redesigns were produced for comparison, including two 80-question versions. The decision is to retain the current production report for now. The prototypes are preserved under `Report Prototypes-drafts/` for possible future consolidation; none is an approved template or application requirement.

If this work resumes:

- Begin with the existing report's trusted content and committee workflow
- Keep the complete MCQ analysis table
- Remove repetitive summary tables and unnecessary narrative
- Optimize for readers with limited review time
- Avoid form fields or spaces intended for data entry
- Validate the final length using a representative 80-question exam
- Treat the prototypes as design references, not specifications to merge wholesale

### Newly observed interface follow-ups — October 11, 2026

#### 27. Improve Flagged Questions table readability and consistency (implemented October 13, 2026; pending release)

On the Item Analysis Overview, the Flagged Questions table applied an amber highlight across all columns. This reduced text readability, particularly in dark mode, and was visually inconsistent with the Easy Questions and DIF tables on the same screen.

The implementation:

- Removed the full-row amber fill and retained a restrained amber status rail
- Preserved the flagged distinction without reducing contrast across the remaining columns
- Matched the report sequence: Flagged Questions, Too Easy Questions, then DIF-Flagged Questions
- Added clearer separation, boundaries, and consistently stronger headings across all three overview result cards
- Verified the result in dark mode and through the automated interface suite

#### 28. Return completed comment mapping to Feedback Review (implemented October 13, 2026; pending release)

After comments were resolved in Unmapped Comments, the completion action returned the coordinator to the Item Analysis Overview. The expected destination is Feedback Review, where the newly mapped comments can be reviewed in context.

The implementation:

- Changed the successful post-analysis destination from Item Analysis Overview to Feedback Review
- Renamed the action to **Apply mappings & review**
- Preserved the initial combined-analysis setup path, which must still return to setup before the analysis has run
- Updated the related FAQ wording and retained focus/navigation regression coverage

#### 29. Refine the collapsed left navigation (implemented October 13, 2026; pending release)

The left-navigation collapse control continued to show a left-pointing arrow after the panel collapsed. It now switches to a right-pointing arrow so that the control indicates the action that will reopen the navigation.

The count badges for Unmapped Comments and Review Queue also sat over the centre of their buttons in the icon-only layout. The implementation:

- Switched the collapse-control arrow according to the current navigation state: left when expanded and right when collapsed
- Positioned count badges at the top-right of their icon buttons without obscuring the icons
- Increased the collapsed-navigation width and button spacing so that two-digit badges fit cleanly
- Updated the control's accessible name and expanded state along with its visual direction
- Verified the collapsed layout in the browser and through the automated accessibility suite

#### 30. Complete and loop the responsive header-summary scroll (implemented October 13, 2026; pending release)

The exam summary in the top bar scrolled when the available width was too narrow, but the movement ended before the full text passed through the visible area.

The implementation:

- Added a complete continuous pass using a duplicated, accessibility-hidden summary and a readable gap between loops
- Kept the summary stationary whenever it fits within the available width
- Retained a non-animated presentation when reduced motion is requested
- Kept the adjacent Edit action fixed and available while the summary moves
- Verified narrow-header animation and accessibility behaviour through the automated suite

## Suggested delivery sequence

### Near term

1. Review any remaining upload-validation edge cases against operational exports
2. Extend the versioned test-data package with missing-response, single-language, and small-sample cases
3. Continue the feedback-parser corpus as new operational examples are encountered
4. Human assistive-technology validation on supported university devices
5. Institutional privacy review

### Medium term

1. Report approval metadata, if the committee workflow requires it
2. Anonymized diagnostics export
3. Additional independent statistical validation datasets
4. Modular development source and build process
5. Dependency/offline deployment decision with institutional IT

### Longer term

1. SharePoint/SPFx persistence
2. Multi-user roles and permissions
3. Approval workflow
4. Longitudinal exam and item history
5. Institutional retention and centralized audit logging

### Deferred pending demonstrated need

1. Distractor Analysis report or export
2. Combined MCQ+DIF report redesign
3. Narrative analysis summaries
4. AI-assisted features

## Recommended immediate next task

Begin the protected modular-source work described in `AQP_MODULARIZATION_ROLLBACK_PLAN.md`, or complete the remaining institutional/manual validation activities. The upload-validation gap audit and retained edge-case statistical validation are complete; future additions should be driven by new anonymized operational formats or datasets.
