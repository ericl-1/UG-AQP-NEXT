# AQP modularization and rollback plan

## Purpose

Separate the editable development source into understandable modules while continuing to produce one deployable `index.html`. This is a structural change only: the interface, calculations, uploads, reports, saved-session behaviour, and user workflow must remain functionally equivalent.

## Safety gate before modularization

Modularization must not begin until all of the following are true:

1. The October 13 interface follow-ups are committed and the complete automated suite passes.
2. That commit is merged into the repository's main branch.
3. A named remote backup branch and annotated tag point to the verified pre-modularization commit:
   - Branch: `backup/pre-modularization-20261013`
   - Tag: `pre-modularization-20261013`
4. The verified single-file `index.html` is retained at that point in Git history.
5. Modularization begins on a new branch named `refactor/modular-source`, created from the tagged commit.

The backup branch and tag are not to be moved or deleted during the modularization work.

## Baseline evidence to retain

Before extracting any source:

- Record the exact baseline commit identifier.
- Run and retain the result of the complete automated suite.
- Verify the 180-student, 70-question demonstration in light and dark modes.
- Verify QuestionMark, Scantron, feedback-only, and combined upload paths.
- Verify the MCQ, DIF, combined, and feedback report previews and exports.
- Verify session save, reopenable backup export/import, and browser-draft recovery.
- Capture representative screenshots of the splash/login, setup, overview, item analysis, DIF, Feedback Review, Unmapped Comments, and reports.

## Migration approach

Use small, independently reversible commits. Do not combine extraction with redesign, new features, statistical changes, wording changes, or build/version changes.

Recommended extraction order:

1. Build scaffolding that can reproduce the existing single-file application.
2. Design tokens and styles.
3. Static application shell and reusable interface helpers.
4. Application state, persistence, and navigation.
5. Upload parsing and validation.
6. MCQ calculations and DIF calculations.
7. Feedback parsing, mapping, and review.
8. Reports and exports.
9. Demonstration data and fixtures.

After every extraction commit:

- Generate the deployable `index.html`.
- Run the complete automated suite.
- Compare the generated application with the baseline behaviour.
- Stop and repair or revert the individual commit if a regression appears.

## Rollback options

### A single extraction causes a problem

Revert only that extraction commit. Earlier verified extraction commits remain intact.

### The modular branch becomes unstable

Abandon `refactor/modular-source` and create a new branch from `pre-modularization-20261013`. The working pre-modularization application remains untouched.

### An urgent production or demonstration fix is needed

Create the fix from the tagged pre-modularization state or the backup branch, then decide separately whether to carry it into the modular branch.

### The modularization is rejected

Keep the existing main branch and deployable single-file application. No rollback reconstruction is required because the structural work remains isolated until approved and merged.

## Stop conditions

Pause the modularization immediately if any of the following occurs:

- A statistical result changes without an explicitly approved statistical change.
- An accepted operational upload stops parsing or validating as before.
- A report loses information or changes values.
- A saved session or reopenable backup can no longer be restored.
- The generated application requires a server for ordinary use when the baseline did not.
- The complete test suite cannot pass after an extraction step.
- A visual or accessibility regression cannot be explained and corrected within the current extraction step.

## Completion criteria

The modularization is complete only when:

- Editable source is organized into documented modules.
- One command produces the deployable single-file `index.html`.
- The generated application can still be opened and hosted as a static application.
- All baseline tests and workflow checks pass.
- A plain-language architecture map and Claude handover guide are available.
- The final structural pull request contains no unrelated feature or design work.

## Approval checkpoint

The next action after this plan is approved is to commit and merge the current interface follow-ups, create the protected backup branch and tag, and capture the baseline evidence. Source extraction begins only after those safeguards are verified.
