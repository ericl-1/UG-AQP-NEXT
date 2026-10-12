# Realistic demonstration validation

This check independently recreates the fictional demonstration design in Python and fits the DIF models with statsmodels and SciPy. It does not execute or reuse AQP's JavaScript calculations.

## Result

- Students: 180 (130 English, 50 French)
- Questions: 70
- Independently estimable DIF models: 68
- Deliberately or numerically suppressed models: 2
- Formal DIF results at p < 0.01: 7
- Formal DIF question numbers: 5, 31, 36, 44, 47, 53, 58

## Intended safeguard examples

- Q1: sparse cells; EN correct/incorrect 130/0, FR correct/incorrect 50/0
- Q70: sparse cells; EN correct/incorrect 1/129, FR correct/incorrect 1/49

The realistic demonstration meets its design targets: most questions are estimable, several known DIF patterns are detectable, and a small number of explicit safeguards remain visible.
