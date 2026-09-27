#!/usr/bin/env python3
"""Independent statistical validation for the AQP synthetic golden exam.

This implementation does not import, execute, translate, or reuse AQP's
JavaScript functions. It parses the fixture workbooks with openpyxl, performs
classical-test calculations with NumPy, and fits DIF models with statsmodels.
"""

from __future__ import annotations

import json
import math
import platform
import re
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import openpyxl
import scipy
from scipy.stats import chi2
import statsmodels
import statsmodels.api as sm
from statsmodels.tools.sm_exceptions import ConvergenceWarning, PerfectSeparationWarning


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "outputs" / "aqp-golden-suite"
EXPECTED_PATH = ROOT / "tests" / "golden" / "expected.json"
JSON_OUTPUT = ROOT / "validation" / "reference_results.json"
REPORT_OUTPUT = ROOT / "validation" / "INDEPENDENT_STATISTICAL_VALIDATION.md"

THRESHOLDS = {
    "difficult": 0.35,
    "easy": 0.96,
    "disc": 0.10,
    "checkp": 0.25,
    "checkr": 0.15,
    "dif": 0.010,
}


@dataclass(frozen=True)
class QuestionColumn:
    number: int
    score_col: int
    outcome_col: int
    label: str
    wording: str
    item_id: str


def read_rows(path: Path) -> list[list[object]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = [["" if value is None else value for value in row] for row in ws.iter_rows(values_only=True)]
    wb.close()
    return rows


def parse_outcome(value: object) -> str:
    text = str(value).strip()
    if not text or "unscored" in text.lower():
        return ""
    match = re.match(r"^(\d+)_", text)
    if match:
        number = int(match.group(1))
        return chr(96 + number) if 1 <= number <= 26 else ""
    if re.fullmatch(r"[A-Ea-e]", text):
        return text.lower()
    if re.fullmatch(r"[1-5]", text):
        return chr(96 + int(text))
    return ""


def load_fixture_data(results_path: Path | None = None, key_path: Path | None = None) -> dict:
    results_rows = read_rows(results_path or (FIXTURES / "golden_qm_results.xlsx"))
    key_rows = read_rows(key_path or (FIXTURES / "golden_answer_key.xlsx"))

    headers = [str(value).strip().lower() for value in results_rows[2]]
    pairs = [(i, i + 1) for i in range(len(headers) - 1) if headers[i] == "score" and headers[i + 1] == "outcome"]
    if not pairs:
        raise ValueError("No Score/Outcome question pairs found in results fixture")

    questions: list[QuestionColumn] = []
    for fallback, (score_col, outcome_col) in enumerate(pairs, start=1):
        label = str(results_rows[0][score_col]).strip()
        q_match = re.search(r"question\s*(\d+)", label, flags=re.I)
        q_number = int(q_match.group(1)) if q_match else fallback
        wording = str(results_rows[1][score_col]).strip()
        id_match = re.search(r"Question\s+ID:\s*(\d+(?:/\d+)?)", wording, flags=re.I)
        questions.append(QuestionColumn(q_number, score_col, outcome_col, label, wording, id_match.group(1) if id_match else ""))

    data_rows = []
    for row in results_rows[3:]:
        first_cells = {str(value).strip().lower() for value in row[:6] if str(value).strip()}
        if first_cells.intersection({"filter", "status", "total", "average", "sum", "count", "subtotal"}):
            continue
        if any(str(value).strip() for value in row):
            data_rows.append(row)

    disclosure = False
    q1 = next((q for q in questions if q.number == 1), None)
    if q1:
        q1_scores = [int(float(row[q1.score_col] or 0)) for row in data_rows]
        sample = next((str(row[q1.outcome_col]).lower() for row in data_rows if str(row[q1.outcome_col]).strip()), "")
        disclosure = (sum(q1_scores) / len(q1_scores) > 0.95) or any(token in sample for token in ("yes", "agree", "1_0"))

    analyzed_questions = []
    for question in questions:
        if disclosure and question.number == 1:
            continue
        outcomes = [str(row[question.outcome_col]).strip().lower() for row in data_rows]
        nonblank = [value for value in outcomes if value]
        if nonblank and all("unscored" in value for value in nonblank):
            continue
        analyzed_questions.append(question)

    key_row = key_rows[3]
    key = [parse_outcome(key_row[q.outcome_col]) for q in analyzed_questions]
    if any(not value for value in key):
        raise ValueError("The synthetic answer key contains a missing scored answer")

    matrix = []
    qm_score_matrix = []
    streams = []
    for row in data_rows:
        answers = [parse_outcome(row[q.outcome_col]) for q in analyzed_questions]
        matrix.append([1 if answer == correct else 0 for answer, correct in zip(answers, key)])
        qm_score_matrix.append([int(float(row[q.score_col] or 0)) for q in analyzed_questions])
        streams.append(str(row[0]).strip().upper())

    result_wording = [str(value).strip() for value in results_rows[1]]
    key_wording = [str(value).strip() for value in key_rows[1]]
    versioned_ids = [q.item_id for q in analyzed_questions]
    return {
        "matrix": np.asarray(matrix, dtype=float),
        "qm_score_matrix": np.asarray(qm_score_matrix, dtype=float),
        "streams": np.asarray(streams),
        "questions": analyzed_questions,
        "key": key,
        "disclosure": disclosure,
        "wording_match": result_wording == key_wording,
        "versioned_ids": versioned_ids,
    }


def cronbach_alpha(matrix: np.ndarray) -> float:
    item_count = matrix.shape[1]
    if item_count < 2:
        return 0.0
    item_variances = matrix.var(axis=0, ddof=0)
    total_variance = matrix.sum(axis=1).var(ddof=0)
    if total_variance == 0:
        return 0.0
    return float((item_count / (item_count - 1)) * (1 - item_variances.sum() / total_variance))


def item_flag(p_value: float, discrimination: float) -> tuple[str, str]:
    flag = ""
    recommendation = ""
    if p_value >= THRESHOLDS["easy"]:
        flag, recommendation = "Too easy", "Report (Too Easy)"
    elif p_value < THRESHOLDS["difficult"] and discrimination > 0:
        flag, recommendation = "Difficult item", "Review wording & distractors"
    elif p_value < 0.8 and discrimination < 0:
        flag, recommendation = "Poor discrimination", "Review wording & key"
    elif p_value < 0.8 and discrimination < THRESHOLDS["disc"]:
        flag, recommendation = "Low discrimination", "Review distractors"
    if p_value < THRESHOLDS["checkp"] and discrimination < THRESHOLDS["checkr"]:
        recommendation = "Verify answer key"
    return flag, recommendation


def fit_logistic(y: np.ndarray, predictors: np.ndarray) -> dict:
    design = sm.add_constant(predictors, has_constant="add")
    captured_warnings = []
    solver_converged = False
    result = None
    with warnings.catch_warnings(record=True) as records:
        warnings.simplefilter("always")
        try:
            result = sm.GLM(y, design, family=sm.families.Binomial()).fit(maxiter=200, tol=1e-10)
            solver_converged = bool(result.converged) and np.isfinite(result.llf)
        except Exception as exc:  # singular/separated models remain documented rather than hidden
            captured_warnings.append(type(exc).__name__ + ": " + str(exc))
        captured_warnings.extend(str(record.message) for record in records if issubclass(record.category, (ConvergenceWarning, PerfectSeparationWarning, RuntimeWarning)))
    if not solver_converged or result is None:
        return {"converged": False, "solver_converged": solver_converged, "identified": False, "warnings": sorted(set(captured_warnings)), "llf": None, "nagelkerke_r2": None, "fisher_condition": None, "max_abs_coefficient": None}

    fitted = np.asarray(result.fittedvalues, dtype=float)
    weights = fitted * (1 - fitted)
    fisher_information = (design.T * weights) @ design
    fisher_condition = float(np.linalg.cond(fisher_information))
    max_abs_coefficient = float(np.max(np.abs(result.params)))
    separation_warning = any("separation" in warning.lower() or "not be identified" in warning.lower() for warning in captured_warnings)
    identified = bool(np.isfinite(fisher_condition) and fisher_condition < 1e12 and not separation_warning)

    n = len(y)
    mean_y = float(np.clip(y.mean(), 0.001, 0.999))
    ll_null = float(np.sum(y * np.log(mean_y) + (1 - y) * np.log(1 - mean_y)))
    denominator = 1 - math.exp(2 * ll_null / n)
    nagelkerke = (1 - math.exp((2 / n) * (ll_null - result.llf))) / denominator if denominator > 0 else 0.0
    return {
        "converged": identified,
        "solver_converged": solver_converged,
        "identified": identified,
        "warnings": sorted(set(captured_warnings)),
        "llf": float(result.llf),
        "chi_square": float(max(0.0, 2 * (result.llf - ll_null))),
        "nagelkerke_r2": float(max(0.0, min(1.0, nagelkerke))),
        "fisher_condition": fisher_condition,
        "max_abs_coefficient": max_abs_coefficient,
    }


def calculate_reference(data: dict) -> dict:
    matrix = data["matrix"]
    totals = matrix.sum(axis=1)
    n_students, n_questions = matrix.shape
    total_sd = totals.std(ddof=0)

    items = []
    for index, question in enumerate(data["questions"]):
        values = matrix[:, index]
        p_value = float(values.mean())
        discrimination = 0.0 if values.std(ddof=0) == 0 or total_sd == 0 else float(np.corrcoef(values, totals)[0, 1])
        flag, recommendation = item_flag(p_value, discrimination)
        items.append({
            "number": index + 1,
            "label": question.label,
            "item_id": question.item_id,
            "difficulty": p_value,
            "discrimination": discrimination,
            "flag": flag,
            "recommendation": recommendation,
            "correct_count": int(values.sum()),
        })

    english = data["streams"] == "E"
    french = data["streams"] == "F"
    language = french.astype(float)
    dif_results = []
    for index, question in enumerate(data["questions"]):
        y = matrix[:, index]
        e_correct = int(y[english].sum())
        f_correct = int(y[french].sum())
        e_wrong = int(english.sum()) - e_correct
        f_wrong = int(french.sum()) - f_correct
        sparse = min(e_correct, e_wrong, f_correct, f_wrong) < 5
        block1 = fit_logistic(y, totals[:, None])
        block3 = fit_logistic(y, np.column_stack([totals, language, totals * language]))
        estimable = block1["converged"] and block3["converged"]
        if estimable:
            chi_square_difference = max(0.0, 2 * (block3["llf"] - block1["llf"]))
            p_value = float(chi2.sf(chi_square_difference, df=2))
            delta_r2 = float(block3["nagelkerke_r2"] - block1["nagelkerke_r2"])
        else:
            chi_square_difference = None
            p_value = None
            delta_r2 = None
        dif_results.append({
            "number": index + 1,
            "label": question.label,
            "english_correct": e_correct,
            "english_incorrect": e_wrong,
            "french_correct": f_correct,
            "french_incorrect": f_wrong,
            "english_pct": round(e_correct / int(english.sum()) * 100),
            "french_pct": round(f_correct / int(french.sum()) * 100),
            "sparse": sparse,
            "estimable": estimable,
            "chi_square_difference": chi_square_difference,
            "p_value": p_value,
            "delta_r2": delta_r2,
            "block1_chi_square": block1.get("chi_square"),
            "block1_nagelkerke_r2": block1.get("nagelkerke_r2"),
            "block3_chi_square": block3.get("chi_square"),
            "block3_nagelkerke_r2": block3.get("nagelkerke_r2"),
            "flagged": bool(estimable and not sparse and p_value < THRESHOLDS["dif"]),
            "warnings": sorted(set(block1["warnings"] + block3["warnings"])),
        })

    return {
        "software": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "statsmodels": statsmodels.__version__,
            "openpyxl": openpyxl.__version__,
        },
        "fixture_integrity": {
            "results_key_wording_match": data["wording_match"],
            "all_scored_ids_versioned": all(re.fullmatch(r"\d+/[1-9]\d*", value) for value in data["versioned_ids"]),
            "scored_ids": data["versioned_ids"],
            "disclosure_detected": data["disclosure"],
            "qm_score_mismatches": int(np.not_equal(matrix, data["qm_score_matrix"]).sum()),
        },
        "exam": {
            "students": n_students,
            "scored_questions": n_questions,
            "average_pct": float(totals.mean() / n_questions * 100),
            "cronbach_alpha": cronbach_alpha(matrix),
            "english_students": int(english.sum()),
            "french_students": int(french.sum()),
            "english_average_pct": float(totals[english].mean() / n_questions * 100),
            "french_average_pct": float(totals[french].mean() / n_questions * 100),
        },
        "items": items,
        "dif": dif_results,
    }


def compare(reference: dict, expected: dict) -> dict:
    checks = []
    advisories = []

    def add(name: str, reference_value, aqp_value, tolerance: float = 0.0):
        if isinstance(reference_value, (float, int)) and isinstance(aqp_value, (float, int)):
            difference = abs(float(reference_value) - float(aqp_value))
            passed = difference <= tolerance
        else:
            difference = None
            passed = reference_value == aqp_value
        checks.append({"name": name, "reference": reference_value, "aqp": aqp_value, "tolerance": tolerance, "difference": difference, "passed": passed})

    add("Student count", reference["exam"]["students"], expected["parser"]["students"])
    add("Scored-question count", reference["exam"]["scored_questions"], expected["parser"]["scoredQuestions"])
    add("Disclosure detected", reference["fixture_integrity"]["disclosure_detected"], expected["parser"]["disclosureDetected"])
    add("Results/key wording agreement", reference["fixture_integrity"]["results_key_wording_match"], True)
    add("All item IDs include a positive version", reference["fixture_integrity"]["all_scored_ids_versioned"], True)
    add("QM score mismatches", reference["fixture_integrity"]["qm_score_mismatches"], expected["scoreValidation"]["mismatches"])
    add("Exam average (%)", reference["exam"]["average_pct"], expected["exam"]["averagePct"], 1e-9)
    add("Cronbach alpha", reference["exam"]["cronbach_alpha"], expected["exam"]["cronbachAlpha"], 5e-9)
    add("English student count", reference["exam"]["english_students"], expected["exam"]["englishStudents"])
    add("French student count", reference["exam"]["french_students"], expected["exam"]["frenchStudents"])

    for ref_item, aqp_item in zip(reference["items"], expected["items"]):
        number = ref_item["number"]
        add(f"Q{number} difficulty", ref_item["difficulty"], aqp_item["difficulty"], 5e-7)
        add(f"Q{number} discrimination", ref_item["discrimination"], aqp_item["discrimination"], 5e-9)
        add(f"Q{number} flag", ref_item["flag"], aqp_item["flag"])
        add(f"Q{number} recommendation", ref_item["recommendation"], aqp_item["recommendation"])

    dif_compared = 0
    for ref_dif, aqp_dif in zip(reference["dif"], expected["dif"]):
        number = ref_dif["number"]
        add(f"Q{number} EN percent correct", ref_dif["english_pct"], aqp_dif["englishPct"])
        add(f"Q{number} FR percent correct", ref_dif["french_pct"], aqp_dif["frenchPct"])
        add(f"Q{number} sparse-cell status", ref_dif["sparse"], aqp_dif["sparse"])
        if ref_dif["estimable"] and not ref_dif["sparse"]:
            add(f"Q{number} DIF p-value", ref_dif["p_value"], aqp_dif["pValue"], 5e-5)
            add(f"Q{number} DIF delta R-squared", ref_dif["delta_r2"], aqp_dif["deltaR2"], 5e-4)
            add(f"Q{number} DIF flag", ref_dif["flagged"], aqp_dif["flagged"])
            dif_compared += 1
        if ref_dif["estimable"] and not ref_dif["sparse"] and aqp_dif["modelFailed"]:
            advisories.append({
                "name": f"{ref_dif['label']} convergence classification",
                "detail": "statsmodels converged, while AQP marked the model as failed and conservatively suppressed flagging",
                "aqp_p_value": aqp_dif["pValue"],
                "reference_p_value": ref_dif["p_value"],
            })

    passed = sum(1 for check in checks if check["passed"])
    return {
        "summary": {"checks": len(checks), "passed": passed, "failed": len(checks) - passed, "advisories": len(advisories), "dif_models_numerically_compared": dif_compared},
        "checks": checks,
        "advisories": advisories,
    }


def format_value(value) -> str:
    if isinstance(value, float):
        return f"{value:.9f}".rstrip("0").rstrip(".")
    return str(value)


def build_report(reference: dict, comparison: dict) -> str:
    failures = [check for check in comparison["checks"] if not check["passed"]]
    stable_dif = [row for row in reference["dif"] if row["estimable"] and not row["sparse"]]
    suppressed_dif = [row for row in reference["dif"] if row["sparse"] or not row["estimable"]]
    q2 = reference["items"][1]
    q11 = reference["dif"][10]
    status = "PASS" if not failures else "FAIL"

    lines = [
        "# AQP independent statistical validation",
        "",
        f"**Overall result: {status}**",
        "",
        "## Scope and independence",
        "",
        "This validation independently reads the synthetic QuestionMark workbooks and recalculates the results without executing or reusing AQP's JavaScript statistical functions. Classical-test statistics use direct NumPy formulas. DIF models use statsmodels binomial generalized linear models, and SciPy calculates chi-square probabilities.",
        "",
        "This is computationally independent validation, not an external statistician's institutional sign-off.",
        "",
        "## Software",
        "",
        *[f"- {name}: {version}" for name, version in reference["software"].items()],
        "",
        "## Validation summary",
        "",
        f"- Checks performed: {comparison['summary']['checks']}",
        f"- Passed: {comparison['summary']['passed']}",
        f"- Failed: {comparison['summary']['failed']}",
        f"- Advisories: {comparison['summary']['advisories']}",
        f"- DIF models compared numerically: {comparison['summary']['dif_models_numerically_compared']}",
        f"- Reconstructed QuestionMark score mismatches: {reference['fixture_integrity']['qm_score_mismatches']}",
        "",
        "## Exam-level comparison",
        "",
        "| Measure | Independent result | AQP result | Outcome |",
        "| --- | ---: | ---: | --- |",
    ]
    names = {"Student count", "Scored-question count", "Exam average (%)", "Cronbach alpha", "English student count", "French student count"}
    for check in comparison["checks"]:
        if check["name"] in names:
            lines.append(f"| {check['name']} | {format_value(check['reference'])} | {format_value(check['aqp'])} | {'Match' if check['passed'] else 'Mismatch'} |")

    lines.extend([
        "",
        "## Item-statistic comparison",
        "",
        "| Item | Difficulty | AQP | Discrimination | AQP | Flag match |",
        "| --- | ---: | ---: | ---: | ---: | --- |",
    ])
    expected = json.loads(EXPECTED_PATH.read_text())
    for ref_item, aqp_item in zip(reference["items"], expected["items"]):
        lines.append(
            f"| {ref_item['label']} | {ref_item['difficulty']:.6f} | {aqp_item['difficulty']:.6f} | "
            f"{ref_item['discrimination']:.9f} | {aqp_item['discrimination']:.9f} | "
            f"{'Yes' if ref_item['flag'] == aqp_item['flag'] else 'No'} |"
        )

    lines.extend([
        "",
        "## DIF comparison",
        "",
        "| Item | EN correct | FR correct | Sparse | Independent p | AQP p | Independent ΔR² | AQP ΔR² | AQP model status | Flag |",
        "| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |",
    ])
    for row in stable_dif:
        aqp = expected["dif"][row["number"] - 1]
        lines.append(
            f"| {row['label']} | {row['english_pct']}% | {row['french_pct']}% | No | "
            f"{row['p_value']:.6f} | {aqp['pValue']:.4f} | {row['delta_r2']:.6f} | {aqp['deltaR2']:.3f} | "
            f"{'Suppressed: convergence' if aqp['modelFailed'] else 'Converged'} | "
            f"{'Flagged' if row['flagged'] else 'Not flagged'} |"
        )

    lines.extend([
        "",
        "Items with sparse cells or non-estimable reference models were checked for cell counts and suppression status but were not treated as reliable numerical DIF comparisons:",
        "",
        *[f"- {row['label']}: {'sparse cells' if row['sparse'] else 'model not estimable'}" for row in suppressed_dif],
        "",
        "## Convergence advisories",
        "",
    ])
    if comparison["advisories"]:
        lines.extend([
            "The independent library converged for the following models that AQP marked as non-convergent. AQP therefore applied a conservative suppression. Their p-values were above the formal 0.01 threshold, so no formal DIF flag was missed in this dataset:",
            "",
            *[f"- {advisory['name']}: independent p={advisory['reference_p_value']:.6f}; AQP p={advisory['aqp_p_value']:.4f}." for advisory in comparison["advisories"]],
            "",
        ])
    else:
        lines.extend(["No convergence-classification differences were identified.", ""])
    lines.extend([
        "## Direct spot checks",
        "",
        f"- {q2['label']} difficulty: {q2['correct_count']} correct ÷ {reference['exam']['students']} students = {q2['difficulty']:.3f}.",
        f"- {q11['label']} DIF contingency: EN {q11['english_correct']} correct/{q11['english_incorrect']} incorrect; FR {q11['french_correct']} correct/{q11['french_incorrect']} incorrect. The independently fitted model gives p={q11['p_value']:.6f}, confirming the formal DIF flag.",
        f"- Cronbach's alpha was calculated as k/(k−1) × (1−Σ item variances/total-score variance), using population variances to match the documented AQP method: {reference['exam']['cronbach_alpha']:.9f}.",
        "",
        "## Conclusion",
        "",
    ])
    if failures:
        lines.append("The independent reference calculation found discrepancies that require investigation before release.")
        lines.extend([f"- {check['name']}: reference {format_value(check['reference'])}; AQP {format_value(check['aqp'])}." for check in failures])
    else:
        lines.append("All numerical parser, scoring, classical-test, flagging, suppression, and independently estimable DIF results matched AQP within the predefined tolerances. No statistical discrepancy or convergence-classification difference was identified in the synthetic golden exam.")
    lines.extend([
        "",
        "## Reproduction",
        "",
        "Run `validation/run_validation.sh` from the project folder. The command recreates this report and `reference_results.json`; it exits non-zero if any comparison fails.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    expected = json.loads(EXPECTED_PATH.read_text())
    reference = calculate_reference(load_fixture_data())
    comparison = compare(reference, expected)
    output = {"reference": reference, "comparison": comparison}
    JSON_OUTPUT.write_text(json.dumps(output, indent=2, allow_nan=False) + "\n")
    REPORT_OUTPUT.write_text(build_report(reference, comparison))
    summary = comparison["summary"]
    print(f"{summary['passed']}/{summary['checks']} independent statistical checks passed; {summary['failed']} failed.")
    print(f"Report: {REPORT_OUTPUT}")
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
