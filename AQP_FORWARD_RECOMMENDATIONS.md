# AQP-Next forward recommendations

## Purpose

This document records recommended future work for the Assessment Quality Platform after the QA and remediation completed for version 0.8, build `20260927-02`.

These are forward-looking improvements rather than defects remaining from the two QA passes. Completed corrections are documented separately in `AQP_CHANGE_SUMMARY_2026-09-23.md`.

## Recommended order of work

### Priority 1 — Protect statistical correctness

#### 1. Expand the automated regression test suite (three browser suites completed September 25, 2026)

A synthetic end-to-end golden case now exists under `tests/golden/`. It exercises the production HTML in Chrome and freezes expected MCQ, DIF, and feedback results. Run it before every release with `npm test`.

The first case verifies student/question counts, disclosure and trailing-unscored exclusions, answer-key reconstruction, score reconciliation, difficulty, discrimination, Cronbach's alpha, DIF flagging, sparse-cell suppression, feedback attribution, and feedback categories.

The second case now verifies:

- Post-exception scoring, denominator, Cronbach's alpha, average, difficulty, and discrimination recalculation
- Delete, Credit, and Alternate Key behavior
- Near Threshold inclusion and persistence through save, reload, and resume
- HTML preview, Word, CSV, and JSON report content
- OOXML package structure and rendered Word pagination

The third suite uses fourteen synthetic workbooks and fifteen scenarios to verify malformed-file rejection, duplicate and missing identifiers, question-number duplication, mixed scored/Unscored outcomes, invalid responses and keys, results/key count and content mismatches, correctable stream warnings, and stale-data clearing after a failed re-upload.

The next additions should concentrate on missing-response and single-language cases, session recovery failures, older session-schema compatibility, and exact report approval/audit metadata. These remain strong protection against statistical or reporting regressions as the application evolves.

#### 2. Expand independent statistical validation (synthetic and first operational validation completed September 25, 2026)

A separate Python reference implementation now validates the first synthetic golden exam using NumPy, statsmodels, and SciPy. All 112 reliable comparisons passed within tolerance. The retained package is under `validation/`.

A follow-up numerical trace confirmed that three apparently different convergence classifications were separated/non-identified models with nearly singular information matrices. AQP's suppression was appropriate; the reference validator was strengthened so solver completion alone is not treated as proof of an estimable model.

The supplied operational exam was then processed locally through both AQP and the independent implementation. All 1,138 aggregate and per-question comparisons passed within tolerance: 191 students, 83 scored questions, 61 numerically estimable DIF models, and 22 sparse or non-estimable models. The privacy-safe report is retained under the Git-ignored `validation/private/` folder; no student names, identifiers, responses, answer key, or feedback text are stored in it.

Continue the independent validation across additional datasets. Validate at minimum:

- Effects of Delete, Credit, and Alternate Key decisions
- Complete separation, singularity, and non-convergence behavior
- Single-language, small-sample, and missing-response exams
- Additional formal and suggestive DIF patterns

Retain the comparison scripts, expected outputs, tolerances, and sign-off as a formal validation package.

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

#### 4. Add a complete analysis audit trail

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

#### 5. Add JSON session import

AQP already exports structured session JSON. Add a strictly validated import workflow so an archived session can be reopened or transferred to another coordinator before a shared backend exists.

The importer should:

- Require a recognized schema version
- Validate every required field and data type
- Reject malformed, truncated, or incompatible files
- Display a preview before replacing the current session
- Warn when the source build differs from the current build
- Migrate older supported schema versions explicitly
- Never evaluate imported strings as code or markup

#### 6. Strengthen upload validation

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

The coordinator can return to the upload controls or explicitly confirm the reconciled structure. The implementation enhances the existing upload preview rather than creating a duplicate room: it displays the detected and retained question counts, Disclosure/Unscored exclusions, key match, effective denominator, missing responses, score-column comparison, stream matching, blockers, and warnings. Confirmation records a timestamped snapshot in session state.

#### 8. Explain DIF suppression precisely

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

#### 12. Version the session-data schema

Add a dedicated field such as `schemaVersion: 1`, separate from the application version and build.

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

#### 14. Add a visible Clear Local Data control

Provide a dedicated control that explains exactly what will be removed:

- Saved draft session
- Review decisions
- Feedback edits
- Theme or non-sensitive preferences, if selected

The action should require confirmation and should not imply that downloaded reports or source files will be deleted.

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

#### 17. Add a built-in demonstration mode

Provide a synthetic bilingual exam and feedback dataset that can be loaded without accessing real student information.

Uses include:

- Coordinator training
- Demonstrations
- User acceptance testing
- Accessibility testing
- Release smoke tests
- Troubleshooting browser compatibility

The interface should clearly label demonstration results so they cannot be mistaken for a real exam.

#### 18. Continue formal accessibility testing

Test each release with:

- Keyboard-only navigation
- VoiceOver on macOS
- NVDA on Windows
- Browser zoom at 200% and 400%
- High-contrast or forced-colour mode
- Reduced-motion preferences
- Narrow mobile-sized viewports
- Long translated labels and content

Add automated accessibility checks where practical, but retain manual screen-reader testing for the complete upload-to-report workflow.

## Suggested delivery sequence

### Near term

1. Automated regression suite
2. Independent statistical validation
3. Versioned synthetic test-data package
4. Stronger upload validation
5. Analysis reconciliation screen

### Medium term

1. Session schema and JSON import
2. Expanded audit trail
3. Detailed DIF suppression reporting
4. Modular development source and build process
5. Dependency/offline deployment decision

### Longer term

1. SharePoint/SPFx persistence
2. Multi-user roles and permissions
3. Approval workflow
4. Longitudinal exam and item history
5. Institutional retention and centralized audit logging

## Recommended immediate next task

Implement the automated golden-dataset regression suite first. The current application has been validated against the supplied exam, but a repeatable automated comparison is what will preserve that correctness through future development.
