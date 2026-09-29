# AQP synthetic golden-dataset regression suite

This suite protects the highest-risk AQP calculations and parsers with fictional data. It opens the real `index.html` in Chrome, uploads the same `.xlsx` files a coordinator would use, runs combined MCQ, DIF, and feedback analysis, then compares the result with `expected.json`.

## Coverage

- QuestionMark results and answer-key parsing
- Versioned QuestionMark item identifiers (`Question ID: ######/#`) and exact results/key wording agreement
- Automatic removal of the opening disclosure item
- Automatic removal of the trailing unscored placeholder
- Student and EN/FR stream counts
- AQP-rebuilt scoring and QuestionMark score cross-validation
- Exam average and Cronbach's alpha
- Per-item difficulty, point-biserial discrimination, flag cascade, and recommendations
- DIF logistic-regression outputs, a true DIF flag, convergence state, and sparse-cell suppression
- Feedback question ceiling inherited from MCQ analysis
- Single-question, multi-question, general, unmapped, out-of-range, and bare-reference comments
- Feedback auto-categorization
- Delete, Credit, and Alternate Key exception behaviour
- Independent post-exception score, denominator, average, reliability, difficulty, and discrimination recalculation
- Exclusion of credited and deleted questions from DIF analysis
- Near Threshold inclusion, report-facing classification, local save, reload, and resume
- HTML report previews after exceptions and Near Threshold changes
- MCQ, DIF, and complete-session CSV exports
- Structured session JSON content and effective-question count
- MCQ, DIF, combined, and feedback Word reports, including required OOXML parts and table grids
- Malformed, incomplete, duplicated, inconsistent, and cross-file-mismatched uploads
- Blocking versus correctable-warning behaviour and stale-data clearing after a failed re-upload
- Built-in demonstration mode, persistent synthetic-data banner, and privacy-safe fixture identity
- Advisory report-readiness transitions before and after Review Queue completion
- Reproducibility/audit metadata in CSV, JSON, and portable-session recovery
- Design-system invariants: base typography, white application and navigation surfaces, minimum primary-action sizing, tabular table numerals, shared component geometry, and stable semantic colours across uOttawa and Elentra themes
- Precise DIF non-estimation reasons in the interface, structured exports, and Word reports

The synthetic exam intentionally contains healthy items and known edge cases. Its reliability coefficient is therefore not intended to resemble a well-constructed operational exam; the exact value is useful as a regression target.

## Run

One-time setup on a new computer requires Node.js and Google Chrome:

```bash
npm install
```

Then, from the project folder:

```bash
npm test
```

A successful run prints four `PASS` lines and exits with status 0. They cover the frozen baseline analysis; exceptions, Near Threshold persistence, previews, and exports; malformed-upload validation; and the demonstration, audit, readiness, and DIF-suppression workflows. Any changed result produces a structured assertion diff and exits non-zero.

The four cases can also be run separately:

```bash
npm run test:golden
npm run test:exceptions-reports
npm run test:malformed-uploads
npm run test:audit-demo-readiness
```

The runner uses the installed Google Chrome application, starts a temporary localhost server, and closes both when finished. It does not upload fixture data. `xlsx.full.min.js` is a local copy of SheetJS 0.18.5, matching the version loaded by AQP, so file parsing does not depend on internet access after setup.

## Files

- `outputs/aqp-golden-suite/golden_qm_results.xlsx`: 40 fictional students, 20 EN and 20 FR
- `outputs/aqp-golden-suite/golden_answer_key.xlsx`: matching perfect-score key export
- `outputs/aqp-golden-suite/golden_feedback.xlsx`: fictional feedback edge cases
- `outputs/aqp-malformed-suite/*.xlsx`: fourteen privacy-safe invalid or borderline upload fixtures
- `expected.json`: frozen application outputs
- `run-golden-tests.mjs`: end-to-end runner
- `run-exceptions-report-tests.mjs`: exception, persistence, preview, and export runner
- `run-malformed-upload-tests.mjs`: fifteen upload-validation and stale-state scenarios
- `run-audit-demo-readiness-tests.mjs`: demonstration, audit, readiness, DIF suppression, export, and recovery scenarios
- `build-fixtures.mjs`: deterministic workbook generator
- `build-malformed-fixtures.mjs`: deterministic malformed-workbook generator
- `jszip.min.js`: local JSZip copy used to inspect generated Word packages without a network dependency

## Updating the golden result

Do not update `expected.json` merely because the test fails. First determine whether the difference is an intended product change or a regression. For an intended change, inspect the printed actual result with:

```bash
node tests/golden/run-golden-tests.mjs --print-actual
```

Review every changed field, update `expected.json` deliberately, and rerun the normal command. Keep the fixture generator deterministic and never replace these files with real student data.
