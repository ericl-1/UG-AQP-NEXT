# Independent statistical validation

This package recalculates the synthetic golden exam without executing or reusing AQP's JavaScript statistics. It uses direct NumPy formulas for scoring, difficulty, point-biserial discrimination, and Cronbach's alpha. It uses statsmodels for logistic-regression DIF models and SciPy for chi-square probabilities.

Run from the project folder:

```bash
sh validation/run_validation.sh
```

The first run creates an isolated `.validation-venv` and installs the exact library versions in `requirements.txt`. Later runs reuse that environment. The command writes:

- `validation/reference_results.json`: machine-readable calculations and every comparison.
- `validation/INDEPENDENT_STATISTICAL_VALIDATION.md`: human-readable validation report.

The script exits with a non-zero status if any checked result differs beyond its stated tolerance. The `.validation-venv` folder is machine-specific and should not be committed to GitHub.

## Validating an operational exam locally

`capture_aqp_exam.mjs` can run a results workbook and matching answer-key workbook through the production AQP interface and save a privacy-safe statistical snapshot. `validate_exam.py` independently recalculates the same exam and compares the two result sets.

Operational validation outputs belong in `validation/private/`, which is excluded from Git. The retained report and summary contain aggregate and per-question comparison results only; they do not retain student names, institutional identifiers, individual responses, answer keys, or feedback text. Source-file hashes are retained so a result can be tied to the exact local inputs.

Example:

```bash
node validation/capture_aqp_exam.mjs \
  --results "/path/to/results.xlsx" \
  --key "/path/to/answer-key.xlsx" \
  --output "/tmp/aqp-exam-snapshot.json"

python validation/validate_exam.py \
  --results "/path/to/results.xlsx" \
  --key "/path/to/answer-key.xlsx" \
  --aqp-json "/tmp/aqp-exam-snapshot.json" \
  --report "validation/private/REAL_EXAM_STATISTICAL_VALIDATION.md" \
  --json-output "validation/private/real_exam_validation_summary.json"
```
