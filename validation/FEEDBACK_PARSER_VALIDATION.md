# Feedback parser validation

## Scope

This document describes AQP's deterministic feedback-attribution and categorisation pipeline as of version 0.8, build `20261007-01`. The parser assists coordinator review; it does not make academic decisions, and every routed comment remains editable.

## Workbook detection

AQP searches the first twelve rows and forty columns of every worksheet for a recognizable feedback header. It prefers explicit labels such as `Comments Ss`, `Comments`, `Student comments`, or `Feedback comments`. The older QuestionMark layout, where `Assessment` appears in column A and comments are in adjacent column B, remains supported. Headerless two-column QuestionMark exports are also accepted when column A contains a strongly repeated assessment identifier and column B contains several substantive responses; parsing begins at the first row so no student response is discarded.

If no recognizable comment column is found, the upload is rejected with a plain-language message instead of silently reading an arbitrary column.

## Attribution decision path

1. Blank and very short rows are ignored.
2. The active maximum question number comes from the loaded MCQ analysis, a coordinator-entered ceiling, or the documented default of 150.
3. Explicit question references are recognized in common forms such as `Q4`, `Question 4`, `6=`, `Question 79;`, `for 59 of 84`, `Questions 4 and 7`, `Q4/Q7`, and `Questions 4 et 7`.
4. Multiple explicit references create an attribution for every valid referenced question.
5. Numbers outside the active question range remain unresolved.
6. Quantity guards prevent percentages, patient ages (including hyphenated ages), measurements, named clinical scores such as CURB-65, student counts, response counts, answer-option counts, question totals, and numeric fractions from being treated as question references.
7. A continuation line following an attributed line stays with that question unless it begins a new recognized reference.
8. Short acknowledgements and non-substantive entries such as “Thank you” are treated as General feedback.
9. Substantive text without a reliable question reference remains Pending for coordinator review.

## Categorisation decision path

Categorisation runs only after attribution and follows this precedence:

1. **Translation** — explicit bilingual-version, translation, or grammar signals. A definition question is not assumed to be a translation issue unless the student identifies a language/version concern.
2. **Other** — narrow technical, logistical, structural, or social signals. These remain Other even if a student supplied a question number.
3. **Content** — explicit content-quality signals.
4. **Content default** — a substantive question-attributed comment that matches neither Translation nor Other.
5. **Uncategorized** — General feedback without a reliable category signal.

Manual coordinator categorisation is never overwritten by the automatic classifier.

## Retained regression coverage

`tests/golden/run-feedback-parser-tests.mjs` verifies:

- Single and multiple explicit question references
- Comma, ampersand, slash, semicolon, English-connector, and French-connector forms
- Multiple embedded `Q#` references in prose
- Out-of-range references
- Student counts, fractions, answer-option counts, percentages, patient ages, and clinical-score numbers
- Equals-sign and semicolon question labels found in operational exports
- Headerless QuestionMark feedback exports
- General-versus-Pending routing
- Content, Translation, Other, and Uncategorized outcomes
- Feedback tables located on a later worksheet and outside column B

The parser suite runs as part of `npm test` with the statistical, exception/report, malformed-upload, audit/recovery, and accessibility suites.

## Deliberate limitations

- AQP does not infer a question from clinical content alone; a reliable numeric reference or coordinator decision is required.
- Substantive general remarks are left Pending because automatically declaring them General could hide a missing question reference.
- Identical comments from different workbook rows are retained because they may represent independent student responses.
- Category rules are intentionally deterministic and conservative. New keywords or patterns require a retained example and expected result.
- AI-assisted attribution or categorisation is outside the approved parser design and remains subject to separate institutional governance.
