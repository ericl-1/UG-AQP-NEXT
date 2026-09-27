#!/usr/bin/env python3
"""Compare a real AQP exam snapshot with an independent local calculation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from reference_validation import calculate_reference, load_fixture_data


def check(checks, name, reference, aqp, tolerance=0.0):
    if isinstance(reference, (int, float)) and isinstance(aqp, (int, float)):
        difference = abs(float(reference) - float(aqp))
        passed = difference <= tolerance
    else:
        difference = None
        passed = reference == aqp
    checks.append({"name": name, "reference": reference, "aqp": aqp, "tolerance": tolerance, "difference": difference, "passed": passed})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results", required=True, type=Path)
    parser.add_argument("--key", required=True, type=Path)
    parser.add_argument("--aqp-json", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--json-output", required=True, type=Path)
    args = parser.parse_args()

    aqp = json.loads(args.aqp_json.read_text())
    reference = calculate_reference(load_fixture_data(args.results, args.key))
    checks = []

    check(checks, "Student count", reference["exam"]["students"], aqp["parser"]["students"])
    check(checks, "Scored-question count", reference["exam"]["scored_questions"], aqp["parser"]["scoredQuestions"])
    check(checks, "Disclosure detected", reference["fixture_integrity"]["disclosure_detected"], aqp["parser"]["disclosureDetected"])
    check(checks, "QuestionMark score mismatches", reference["fixture_integrity"]["qm_score_mismatches"], aqp["scoreValidation"]["mismatches"])
    check(checks, "Exam average", reference["exam"]["average_pct"], aqp["exam"]["averagePct"], 1e-7)
    check(checks, "Cronbach alpha", reference["exam"]["cronbach_alpha"], aqp["exam"]["cronbachAlpha"], 1e-9)
    check(checks, "English student count", reference["exam"]["english_students"], aqp["exam"]["englishStudents"])
    check(checks, "French student count", reference["exam"]["french_students"], aqp["exam"]["frenchStudents"])

    for ref, app in zip(reference["items"], aqp["items"]):
        label = app["label"]
        check(checks, f"{label} difficulty", ref["difficulty"], app["difficulty"], 1e-9)
        check(checks, f"{label} discrimination", ref["discrimination"], app["discrimination"], 1e-9)
        check(checks, f"{label} flag", ref["flag"], app["flag"])
        check(checks, f"{label} recommendation", ref["recommendation"], app["recommendation"])

    dif_numeric = 0
    dif_suppressed = 0
    for ref, app in zip(reference["dif"], aqp["dif"]):
        label = app["label"]
        check(checks, f"{label} EN percent", ref["english_pct"], app["englishPct"])
        check(checks, f"{label} FR percent", ref["french_pct"], app["frenchPct"])
        check(checks, f"{label} sparse status", ref["sparse"], app["sparse"])
        reference_failed = not ref["estimable"]
        if not ref["sparse"]:
            check(checks, f"{label} model estimability", reference_failed, app["modelFailed"])
        if ref["estimable"] and not ref["sparse"] and not app["modelFailed"]:
            check(checks, f"{label} Block 1 chi-square", ref["block1_chi_square"], app["block1ChiSquare"], 5e-4)
            check(checks, f"{label} Block 1 Nagelkerke R2", ref["block1_nagelkerke_r2"], app["block1NagelkerkeR2"], 5e-4)
            check(checks, f"{label} Block 3 chi-square", ref["block3_chi_square"], app["block3ChiSquare"], 5e-4)
            check(checks, f"{label} Block 3 Nagelkerke R2", ref["block3_nagelkerke_r2"], app["block3NagelkerkeR2"], 5e-4)
            check(checks, f"{label} chi-square difference", ref["chi_square_difference"], app["chiSquareDifference"], 5e-4)
            check(checks, f"{label} delta R2", ref["delta_r2"], app["deltaR2"], 5e-4)
            check(checks, f"{label} DIF p-value", ref["p_value"], app["pValue"], 5e-5)
            check(checks, f"{label} DIF flag", ref["flagged"], app["flagged"])
            dif_numeric += 1
        else:
            dif_suppressed += 1

    failures = [row for row in checks if not row["passed"]]
    summary = {
        "checks": len(checks),
        "passed": len(checks) - len(failures),
        "failed": len(failures),
        "students": reference["exam"]["students"],
        "scoredQuestions": reference["exam"]["scored_questions"],
        "difModelsNumericallyCompared": dif_numeric,
        "difModelsSuppressedOrSparse": dif_suppressed,
        "privacy": aqp["privacy"],
        "sourceHashes": aqp["sourceHashes"],
    }
    safe_output = {"summary": summary, "failures": failures}
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(safe_output, indent=2) + "\n")

    lines = [
        "# Real exam independent statistical validation",
        "",
        f"**Overall result: {'PASS' if not failures else 'FAIL'}**",
        "",
        "## Privacy",
        "",
        "This report contains aggregate and per-question comparison results only. It contains no student names, institutional identifiers, individual responses, answer key, or feedback text. Source files were processed locally.",
        "",
        "## Summary",
        "",
        f"- Students: {summary['students']}",
        f"- Scored questions: {summary['scoredQuestions']}",
        f"- Independent comparisons: {summary['checks']}",
        f"- Passed: {summary['passed']}",
        f"- Failed: {summary['failed']}",
        f"- DIF models compared numerically: {summary['difModelsNumericallyCompared']}",
        f"- DIF models suppressed or sparse: {summary['difModelsSuppressedOrSparse']}",
        "",
        "## Methods checked",
        "",
        "- QuestionMark parsing, disclosure and unscored-item exclusions",
        "- Reconstructed scoring and score-column reconciliation",
        "- Exam average and Cronbach's alpha",
        "- Every item's difficulty, point-biserial discrimination, flag, and recommendation",
        "- EN/FR contingency percentages and sparse-cell status",
        "- DIF Block 1 and Block 3 likelihood-ratio statistics",
        "- Nagelkerke R², chi-square differences, p-values, estimability, and flags",
        "",
        "## Discrepancies",
        "",
    ]
    if failures:
        lines.extend([f"- {row['name']}: independent={row['reference']}; AQP={row['aqp']}; tolerance={row['tolerance']}" for row in failures])
    else:
        lines.append("No discrepancies were identified within the predefined tolerances.")
    lines.extend([
        "",
        "## Conclusion",
        "",
        "The real exam independently reproduced AQP's statistical results and decisions within tolerance." if not failures else "One or more discrepancies require investigation before relying on the affected results.",
        "",
        "The source-file SHA-256 hashes are retained in the private machine-readable summary so this validation can be tied to the exact local inputs without storing their filenames or contents.",
        "",
    ])
    args.report.write_text("\n".join(lines))
    print(f"{summary['passed']}/{summary['checks']} real-exam checks passed; {summary['failed']} failed.")
    print(f"Private report: {args.report}")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
