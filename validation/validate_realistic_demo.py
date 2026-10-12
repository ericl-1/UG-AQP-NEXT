#!/usr/bin/env python3
"""Independent design validation for AQP's realistic built-in demonstration.

This script recreates the deterministic fictional response design without
executing AQP's JavaScript. NumPy, statsmodels, and SciPy independently verify
the cohort shape, DIF cell coverage, and intended formal DIF examples.
"""

from __future__ import annotations

import math
from pathlib import Path
import warnings

import numpy as np
import statsmodels.api as sm
from scipy.stats import chi2
from statsmodels.tools.sm_exceptions import PerfectSeparationWarning


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "validation" / "REALISTIC_DEMO_VALIDATION.md"


class JsLcg:
    def __init__(self, seed: int) -> None:
        self.seed = seed

    def random(self) -> float:
        self.seed = (self.seed * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.seed / 4294967296


def logistic(value: float) -> float:
    return 1 / (1 + math.exp(-value))


def build_matrix() -> tuple[np.ndarray, np.ndarray]:
    rng = JsLcg(20261011)
    matrix: list[list[int]] = []
    streams: list[int] = []
    for student in range(180):
        french = student >= 130
        group_index = student - 130 if french else student
        group_size = 50 if french else 130
        ability = -2.15 + 4.3 * ((group_index + 0.5) / group_size) + (rng.random() - 0.5) * 0.35
        row: list[int] = []
        for item in range(70):
            question = item + 1
            if question == 1:
                correct = True
            elif question == 70:
                correct = rng.random() < 0.015
            else:
                difficulty = -1.25 + (item % 10) * 0.25
                discrimination = 0.9 + (item % 5) * 0.13
                language_effect = 0.0
                if question in {12, 36, 58} and french:
                    language_effect = -1.25
                if question in {24, 47} and french:
                    language_effect = 1.1
                if question == 31 and french:
                    language_effect = -0.25 - 1.05 * ability
                if question == 63 and french:
                    language_effect = 0.2 + 0.95 * ability
                correct = rng.random() < logistic(discrimination * ability - difficulty + language_effect)
            row.append(int(correct))
        matrix.append(row)
        streams.append(int(french))
    return np.asarray(matrix, dtype=float), np.asarray(streams, dtype=float)


def fit_log_likelihood(y: np.ndarray, predictors: np.ndarray) -> tuple[float, float] | None:
    design = sm.add_constant(predictors, has_constant="add")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", PerfectSeparationWarning)
        try:
            result = sm.GLM(y, design, family=sm.families.Binomial()).fit(maxiter=200, tol=1e-10)
        except Exception:
            return None
    if not result.converged or not np.isfinite(result.llf):
        return None
    fitted = np.asarray(result.fittedvalues, dtype=float)
    fisher = (design.T * (fitted * (1 - fitted))) @ design
    condition = float(np.linalg.cond(fisher))
    if not np.isfinite(condition) or condition >= 1e12:
        return None
    return float(result.llf), condition


def main() -> None:
    matrix, language = build_matrix()
    totals = matrix.sum(axis=1)
    english = language == 0
    french = language == 1
    estimated: list[dict] = []
    suppressed: list[dict] = []
    for index in range(matrix.shape[1]):
        y = matrix[:, index]
        cells = [int(y[english].sum()), int(english.sum() - y[english].sum()), int(y[french].sum()), int(french.sum() - y[french].sum())]
        if min(cells) < 5:
            suppressed.append({"question": index + 1, "reason": "sparse cells", "cells": cells})
            continue
        reduced = fit_log_likelihood(y, totals[:, None])
        full = fit_log_likelihood(y, np.column_stack([totals, language, totals * language]))
        if reduced is None or full is None:
            suppressed.append({"question": index + 1, "reason": "non-identifiable model", "cells": cells})
            continue
        statistic = max(0.0, 2 * (full[0] - reduced[0]))
        estimated.append({
            "question": index + 1,
            "p_value": float(chi2.sf(statistic, 2)),
            "english_percent": round(float(y[english].mean() * 100)),
            "french_percent": round(float(y[french].mean() * 100)),
        })

    flagged = [item for item in estimated if item["p_value"] < 0.01]
    flagged_numbers = {item["question"] for item in flagged}
    designed = {12, 24, 31, 36, 47, 58, 63}

    assert matrix.shape == (180, 70)
    assert int(english.sum()) == 130 and int(french.sum()) == 50
    assert len(estimated) >= 65
    assert len(flagged) >= 3
    assert len(flagged_numbers & designed) >= 3
    assert {item["question"] for item in suppressed}.issuperset({1, 70})

    lines = [
        "# Realistic demonstration validation",
        "",
        "This check independently recreates the fictional demonstration design in Python and fits the DIF models with statsmodels and SciPy. It does not execute or reuse AQP's JavaScript calculations.",
        "",
        "## Result",
        "",
        "- Students: 180 (130 English, 50 French)",
        "- Questions: 70",
        f"- Independently estimable DIF models: {len(estimated)}",
        f"- Deliberately or numerically suppressed models: {len(suppressed)}",
        f"- Formal DIF results at p < 0.01: {len(flagged)}",
        f"- Formal DIF question numbers: {', '.join(str(item['question']) for item in flagged)}",
        "",
        "## Intended safeguard examples",
        "",
    ]
    lines.extend(f"- Q{item['question']}: {item['reason']}; EN correct/incorrect {item['cells'][0]}/{item['cells'][1]}, FR correct/incorrect {item['cells'][2]}/{item['cells'][3]}" for item in suppressed)
    lines.extend(["", "The realistic demonstration meets its design targets: most questions are estimable, several known DIF patterns are detectable, and a small number of explicit safeguards remain visible.", ""])
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"PASS: realistic demonstration independently validated ({len(estimated)} estimable, {len(flagged)} formal DIF, {len(suppressed)} safeguarded).")


if __name__ == "__main__":
    main()
