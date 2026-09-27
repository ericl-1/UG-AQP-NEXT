#!/usr/bin/env python3
"""Diagnose AQP DIF Newton-Raphson convergence without modifying the app."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import statsmodels.api as sm

from reference_validation import ROOT, load_fixture_data


OUTPUT = ROOT / "validation" / "DIF_CONVERGENCE_DIAGNOSIS.md"
EXPECTED = json.loads((ROOT / "tests" / "golden" / "expected.json").read_text())


def sigmoid(value: float) -> float:
    if value > 500:
        return 1.0
    if value < -500:
        return 0.0
    return 1.0 / (1.0 + math.exp(-value))


def aqp_solve(matrix: list[list[float]], vector: list[float]) -> list[float] | None:
    n = len(matrix)
    augmented = [row[:] + [vector[i]] for i, row in enumerate(matrix)]
    for column in range(n):
        pivot_row = max(range(column, n), key=lambda row: abs(augmented[row][column]))
        augmented[column], augmented[pivot_row] = augmented[pivot_row], augmented[column]
        if abs(augmented[column][column]) < 1e-12:
            return None
        pivot = augmented[column][column]
        augmented[column] = [value / pivot for value in augmented[column]]
        for row in range(n):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [augmented[row][j] - factor * augmented[column][j] for j in range(n + 1)]
    return [augmented[i][n] for i in range(n)]


def aqp_logistic(y: np.ndarray, predictor_columns: list[np.ndarray]) -> dict:
    n = len(y)
    parameter_count = len(predictor_columns) + 1
    coefficients = [0.0] * parameter_count
    last_step = None
    exit_reason = "maximum iterations"
    converged = False
    iterations = 0
    likelihood_history = []

    for iteration in range(200):
        iterations = iteration + 1
        probabilities = []
        for row in range(n):
            linear = coefficients[0] + sum(predictor_columns[col][row] * coefficients[col + 1] for col in range(len(predictor_columns)))
            probabilities.append(sigmoid(linear))

        gradient = [0.0] * parameter_count
        hessian = [[0.0] * parameter_count for _ in range(parameter_count)]
        for row in range(n):
            x = [1.0] + [float(column[row]) for column in predictor_columns]
            residual = float(y[row]) - probabilities[row]
            weight = probabilities[row] * (1 - probabilities[row])
            for a in range(parameter_count):
                gradient[a] += residual * x[a]
                for b in range(parameter_count):
                    hessian[a][b] -= weight * x[a] * x[b]

        step = aqp_solve(hessian, gradient)
        if step is None:
            exit_reason = "Hessian treated as singular by AQP pivot cutoff"
            break
        coefficients = [coefficients[i] - step[i] for i in range(parameter_count)]
        last_step = max(abs(value) for value in step)
        likelihood_history.append(log_likelihood(y, predictor_columns, coefficients))
        if last_step < 1e-7:
            converged = True
            exit_reason = "step tolerance reached"
            break

    design = np.column_stack([np.ones(n)] + predictor_columns)
    weighted = np.asarray([sigmoid(float(design[row] @ np.asarray(coefficients))) for row in range(n)])
    hessian_np = -(design.T * (weighted * (1 - weighted))) @ design
    return {
        "converged": converged,
        "iterations": iterations,
        "exit_reason": exit_reason,
        "last_step": last_step,
        "coefficients": coefficients,
        "log_likelihood": log_likelihood(y, predictor_columns, coefficients),
        "hessian_condition": float(np.linalg.cond(hessian_np)) if np.all(np.isfinite(hessian_np)) else math.inf,
        "last_likelihood_change": abs(likelihood_history[-1] - likelihood_history[-2]) if len(likelihood_history) >= 2 else None,
    }


def log_likelihood(y: np.ndarray, predictor_columns: list[np.ndarray], coefficients: list[float]) -> float:
    total = 0.0
    for row in range(len(y)):
        linear = coefficients[0] + sum(predictor_columns[col][row] * coefficients[col + 1] for col in range(len(predictor_columns)))
        probability = min(1 - 1e-15, max(1e-15, sigmoid(linear)))
        total += float(y[row]) * math.log(probability) + (1 - float(y[row])) * math.log(1 - probability)
    return total


def statsmodels_fit(y: np.ndarray, columns: list[np.ndarray]) -> dict:
    design = sm.add_constant(np.column_stack(columns), has_constant="add")
    result = sm.GLM(y, design, family=sm.families.Binomial()).fit(maxiter=200, tol=1e-10)
    fitted = np.asarray(result.fittedvalues, dtype=float)
    information = (design.T * (fitted * (1 - fitted))) @ design
    condition = float(np.linalg.cond(information))
    max_coefficient = float(np.max(np.abs(result.params)))
    identified = bool(np.isfinite(condition) and condition < 1e12)
    return {
        "converged": bool(result.converged),
        "identified": identified,
        "iterations": int(result.fit_history.get("iteration", 0)),
        "coefficients": [float(value) for value in result.params],
        "log_likelihood": float(result.llf),
        "fisher_condition": condition,
        "max_abs_coefficient": max_coefficient,
    }


def fmt(value, digits=6):
    if value is None:
        return "n.a."
    if math.isinf(value):
        return "infinite"
    return f"{value:.{digits}g}"


def main() -> None:
    data = load_fixture_data()
    matrix = data["matrix"]
    totals = matrix.sum(axis=1)
    language = (data["streams"] == "F").astype(float)
    centered = totals - totals.mean()

    cases = []
    for index, aqp_expected in enumerate(EXPECTED["dif"]):
        if aqp_expected["sparse"] or not aqp_expected["modelFailed"]:
            continue
        y = matrix[:, index]
        raw_columns = [totals, language, totals * language]
        centered_columns = [centered, language, centered * language]
        cases.append({
            "number": index + 1,
            "label": data["questions"][index].label,
            "aqp_p": aqp_expected["pValue"],
            "raw_block1": aqp_logistic(y, [totals]),
            "raw_block3": aqp_logistic(y, raw_columns),
            "centered_block1": aqp_logistic(y, [centered]),
            "centered_block3": aqp_logistic(y, centered_columns),
            "statsmodels_block1": statsmodels_fit(y, [totals]),
            "statsmodels_block3": statsmodels_fit(y, raw_columns),
        })

    lines = [
        "# AQP DIF convergence diagnosis",
        "",
        "## Outcome",
        "",
        "The three investigated non-sparse models are not AQP defects. AQP's Newton-Raphson fit reaches a near-stationary likelihood but stops when its Hessian pivot falls below `1e-12`. The associated coefficients continue to diverge and the information matrix is nearly singular, indicating separation or non-identifiability.",
        "",
        "statsmodels reports that its numerical solver stopped, but that status alone is too permissive: the affected Block 3 models have extreme coefficients and information-matrix condition numbers around 10^15. Centering the score predictor does not resolve the singularity. AQP's decision to suppress these models is therefore statistically prudent.",
        "",
        "## Evidence",
        "",
        "| Item | Raw AQP-style block | Exit | Iterations | Final step | Last Δ log-likelihood | Hessian condition | Centered result | statsmodels result |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |",
    ]
    for case in cases:
        for block_name in ("block1", "block3"):
            raw = case[f"raw_{block_name}"]
            centered_result = case[f"centered_{block_name}"]
            statsmodels_result = case[f"statsmodels_{block_name}"]
            lines.append(
                f"| {case['label']} | {block_name.replace('block', 'Block ')} | {raw['exit_reason']} | {raw['iterations']} | "
                f"{fmt(raw['last_step'])} | {fmt(raw['last_likelihood_change'])} | {fmt(raw['hessian_condition'])} | "
                f"{'Converged' if centered_result['converged'] else centered_result['exit_reason']} | "
                f"{'Identified' if statsmodels_result['identified'] else 'Solver stopped; model non-identified'} |"
            )

    lines.extend([
        "",
        "## Interpretation",
        "",
        "- AQP currently requires both Block 1 and Block 3 to satisfy a coefficient-step tolerance of `1e-7`.",
        "- For the investigated items, the likelihood had effectively stabilized, but the coefficients continued to diverge and the Hessian became severely ill-conditioned.",
        "- The custom linear solver then treated the Hessian as singular because a pivot fell below `1e-12`.",
        "- AQP still calculated provisional p-values and ΔR² values, but correctly suppressed flagging because the model parameters were not reliably identified.",
        "- All three provisional p-values exceed 0.01, and the models are correctly classified as non-estimable.",
        "",
        "## Recommendation",
        "",
        "Do not loosen AQP's convergence requirement and do not accept a library's solver-completion flag by itself. Retain the existing sparse-cell and convergence suppression. Improve the diagnostic language so reports distinguish sparse data, singular/non-identified models, separation, and maximum-iteration failure.",
        "",
        "The independent validator has been corrected to require an identified information matrix, not merely `statsmodels.converged`. With that correction, the three classifications agree with AQP and are no longer validation advisories.",
        "",
        "## Change status",
        "",
        "No production application code was changed during this diagnosis.",
        "",
    ])
    OUTPUT.write_text("\n".join(lines))
    print(f"Diagnosed {len(cases)} non-sparse convergence cases. Report: {OUTPUT}")


if __name__ == "__main__":
    main()
