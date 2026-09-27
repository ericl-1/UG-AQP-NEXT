# AQP independent statistical validation

**Overall result: PASS**

## Scope and independence

This validation independently reads the synthetic QuestionMark workbooks and recalculates the results without executing or reusing AQP's JavaScript statistical functions. Classical-test statistics use direct NumPy formulas. DIF models use statsmodels binomial generalized linear models, and SciPy calculates chi-square probabilities.

This is computationally independent validation, not an external statistician's institutional sign-off.

## Software

- python: 3.12.14
- numpy: 2.5.3
- scipy: 1.16.2
- statsmodels: 0.14.5
- openpyxl: 3.1.5

## Validation summary

- Checks performed: 112
- Passed: 112
- Failed: 0
- Advisories: 0
- DIF models compared numerically: 6
- Reconstructed QuestionMark score mismatches: 0

## Exam-level comparison

| Measure | Independent result | AQP result | Outcome |
| --- | ---: | ---: | --- |
| Student count | 40 | 40 | Match |
| Scored-question count | 12 | 12 | Match |
| Exam average (%) | 61.25 | 61.25 | Match |
| Cronbach alpha | -0.510638298 | -0.510638298 | Match |
| English student count | 20 | 20 | Match |
| French student count | 20 | 20 | Match |

## Item-statistic comparison

| Item | Difficulty | AQP | Discrimination | AQP | Flag match |
| --- | ---: | ---: | ---: | ---: | --- |
| Question 2 | 1.000000 | 1.000000 | 0.000000000 | 0.000000000 | Yes |
| Question 3 | 0.300000 | 0.300000 | 0.653283166 | 0.653283166 | Yes |
| Question 4 | 0.500000 | 0.500000 | -0.647290715 | -0.647290715 | Yes |
| Question 5 | 0.500000 | 0.500000 | 0.323645358 | 0.323645358 | Yes |
| Question 6 | 0.750000 | 0.750000 | 0.630641478 | 0.630641478 | Yes |
| Question 7 | 0.650000 | 0.650000 | 0.631895070 | 0.631895070 | Yes |
| Question 8 | 0.500000 | 0.500000 | 0.647290715 | 0.647290715 | Yes |
| Question 9 | 0.400000 | 0.400000 | 0.718444173 | 0.718444173 | Yes |
| Question 10 | 0.900000 | 0.900000 | 0.633805492 | 0.633805492 | Yes |
| Question 11 | 0.400000 | 0.400000 | -0.602832467 | -0.602832467 | Yes |
| Question 12 | 0.500000 | 0.500000 | -0.283189688 | -0.283189688 | Yes |
| Question 13 | 0.950000 | 0.950000 | 0.436214856 | 0.436214856 | Yes |

## DIF comparison

| Item | EN correct | FR correct | Sparse | Independent p | AQP p | Independent ΔR² | AQP ΔR² | AQP model status | Flag |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
| Question 4 | 50% | 50% | No | 0.354950 | 0.3549 | 0.039281 | 0.039 | Converged | Not flagged |
| Question 5 | 50% | 50% | No | 0.895880 | 0.8959 | 0.006550 | 0.007 | Converged | Not flagged |
| Question 7 | 65% | 65% | No | 0.348929 | 0.3489 | 0.043445 | 0.043 | Converged | Not flagged |
| Question 8 | 50% | 50% | No | 0.354950 | 0.3549 | 0.039281 | 0.039 | Converged | Not flagged |
| Question 11 | 40% | 40% | No | 0.467200 | 0.4672 | 0.032678 | 0.033 | Converged | Not flagged |
| Question 12 | 75% | 25% | No | 0.000176 | 0.0002 | 0.430548 | 0.431 | Converged | Flagged |

Items with sparse cells or non-estimable reference models were checked for cell counts and suppression status but were not treated as reliable numerical DIF comparisons:

- Question 2: sparse cells
- Question 3: model not estimable
- Question 6: model not estimable
- Question 9: model not estimable
- Question 10: sparse cells
- Question 13: sparse cells

## Convergence advisories

No convergence-classification differences were identified.

## Direct spot checks

- Question 3 difficulty: 12 correct ÷ 40 students = 0.300.
- Question 12 DIF contingency: EN 15 correct/5 incorrect; FR 5 correct/15 incorrect. The independently fitted model gives p=0.000176, confirming the formal DIF flag.
- Cronbach's alpha was calculated as k/(k−1) × (1−Σ item variances/total-score variance), using population variances to match the documented AQP method: -0.510638298.

## Conclusion

All numerical parser, scoring, classical-test, flagging, suppression, and independently estimable DIF results matched AQP within the predefined tolerances. No statistical discrepancy or convergence-classification difference was identified in the synthetic golden exam.

## Reproduction

Run `validation/run_validation.sh` from the project folder. The command recreates this report and `reference_results.json`; it exits non-zero if any comparison fails.
