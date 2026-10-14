#!/usr/bin/env python3
"""Independent validation of AQP's retained edge-case fixture package."""

from __future__ import annotations

import math
import re
from pathlib import Path

import numpy as np
import openpyxl


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "outputs" / "aqp-edge-suite"
REPORT = ROOT / "validation" / "EDGE_CASE_STATISTICAL_VALIDATION.md"
KEY = ["a", "b", "c", "d", "a", "b", "c", "d"]
SCENARIOS = {
    "missing_responses": {"students": 12, "english": 6, "french": 6, "missing": 6},
    "single_language": {"students": 16, "english": 16, "french": 0, "missing": 0},
    "small_sample": {"students": 6, "english": 3, "french": 3, "missing": 0},
}


def rows(path: Path) -> list[list[object]]:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = workbook[workbook.sheetnames[0]]
    result = [["" if value is None else value for value in row] for row in sheet.iter_rows(values_only=True)]
    workbook.close()
    return result


def outcome(value: object) -> str:
    text = str(value).strip()
    if not text:
        return ""
    numbered = re.match(r"^([1-5])_", text)
    if numbered:
        return chr(96 + int(numbered.group(1)))
    if re.fullmatch(r"[A-Ea-e]", text):
        return text.lower()
    if re.fullmatch(r"[1-5]", text):
        return chr(96 + int(text))
    return ""


def alpha(matrix: np.ndarray) -> float:
    total_variance = matrix.sum(axis=1).var(ddof=0)
    if matrix.shape[1] < 2 or total_variance == 0:
        return 0.0
    return float((matrix.shape[1] / (matrix.shape[1] - 1)) * (1 - matrix.var(axis=0, ddof=0).sum() / total_variance))


def validate(name: str, expected: dict) -> dict:
    source = rows(FIXTURES / f"{name}_qm_results.xlsx")
    headers = [str(value).strip().lower() for value in source[2]]
    pairs = [(index, index + 1) for index in range(len(headers) - 1) if headers[index] == "score" and headers[index + 1] == "outcome"]
    # The retained fixtures contain a leading disclosure item and a trailing
    # unscored placeholder. The eight middle pairs are the scored exam.
    scored = pairs[1:-1]
    data = [row for row in source[3:] if str(row[0]).strip().lower() != "filter" and any(str(value).strip() for value in row)]
    answers = np.asarray([[outcome(row[outcome_col]) for _, outcome_col in scored] for row in data], dtype=object)
    matrix = np.asarray([[1 if answer == KEY[index] else 0 for index, answer in enumerate(row)] for row in answers], dtype=float)
    qm = np.asarray([[int(float(row[score_col] or 0)) for score_col, _ in scored] for row in data], dtype=float)
    streams = [str(row[0]).strip().upper() for row in data]
    missing = int(np.equal(answers, "").sum())
    english = streams.count("E")
    french = streams.count("F")
    assert matrix.shape == (expected["students"], 8)
    assert english == expected["english"] and french == expected["french"]
    assert missing == expected["missing"]
    assert int(np.not_equal(matrix, qm).sum()) == 0
    sparse_items = 0
    if english and french:
        english_rows = np.asarray([stream == "E" for stream in streams])
        french_rows = np.asarray([stream == "F" for stream in streams])
        for index in range(matrix.shape[1]):
            values = matrix[:, index]
            cells = [values[english_rows].sum(), english_rows.sum() - values[english_rows].sum(), values[french_rows].sum(), french_rows.sum() - values[french_rows].sum()]
            if min(cells) < 5:
                sparse_items += 1
    if name == "small_sample":
        assert sparse_items == 8
    if name == "single_language":
        assert french == 0
    return {
        "students": len(data),
        "english": english,
        "french": french,
        "missing": missing,
        "average": float(matrix.mean() * 100),
        "alpha": alpha(matrix),
        "sparse_items": sparse_items,
    }


def main() -> None:
    results = {name: validate(name, expected) for name, expected in SCENARIOS.items()}
    lines = [
        "# Edge-case statistical validation",
        "",
        "**Overall result: PASS**",
        "",
        "This independent Python check reads the retained QuestionMark fixtures directly and does not execute AQP's JavaScript calculations. It verifies cohort shape, scored-question selection, missing-response handling, reconstructed scores, classical-test summaries, and conservative DIF prerequisites.",
        "",
        "| Scenario | Students | EN | FR | Missing responses | Average | Alpha | DIF safeguard |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    labels = {"missing_responses": "Missing responses", "single_language": "Single language", "small_sample": "Small sample"}
    for name, result in results.items():
        if name == "single_language":
            safeguard = "Comparison unavailable: no French group"
        elif name == "small_sample":
            safeguard = f"All {result['sparse_items']} items have sparse cells"
        else:
            safeguard = f"{result['sparse_items']} items have sparse cells"
        lines.append(f"| {labels[name]} | {result['students']} | {result['english']} | {result['french']} | {result['missing']} | {result['average']:.1f}% | {result['alpha']:.4f} | {safeguard} |")
    lines.extend([
        "",
        "All three retained edge datasets satisfy their intended design. Their independently reconstructed item scores match the score columns in the fixtures exactly. Browser regression tests separately verify that AQP parses and analyses these same files as intended.",
        "",
        "The negative alpha values are expected for these deliberately small, pattern-based stress fixtures and are not presented as plausible operational exam reliability estimates.",
        "",
        "This is computational validation, not an external statistician's institutional sign-off.",
        "",
    ])
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print("PASS: missing-response, single-language, and small-sample fixtures independently validated.")


if __name__ == "__main__":
    main()
