# AQP DIF convergence diagnosis

## Outcome

The three investigated non-sparse models are not AQP defects. AQP's Newton-Raphson fit reaches a near-stationary likelihood but stops when its Hessian pivot falls below `1e-12`. The associated coefficients continue to diverge and the information matrix is nearly singular, indicating separation or non-identifiability.

statsmodels reports that its numerical solver stopped, but that status alone is too permissive: the affected Block 3 models have extreme coefficients and information-matrix condition numbers around 10^15. Centering the score predictor does not resolve the singularity. AQP's decision to suppress these models is therefore statistically prudent.

## Evidence

| Item | Raw AQP-style block | Exit | Iterations | Final step | Last Δ log-likelihood | Hessian condition | Centered result | statsmodels result |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Question 3 | Block 1 | step tolerance reached | 8 | 1.85686e-10 | 7.10543e-15 | 16524.4 | Converged | Identified |
| Question 3 | Block 3 | Hessian treated as singular by AQP pivot cutoff | 29 | 8 | 1.30207e-11 | 1.96755e+15 | Hessian treated as singular by AQP pivot cutoff | Solver stopped; model non-identified |
| Question 6 | Block 1 | step tolerance reached | 7 | 1.1602e-09 | 1.77636e-15 | 3319.43 | Converged | Identified |
| Question 6 | Block 3 | Hessian treated as singular by AQP pivot cutoff | 29 | 7.0353 | 1.09033e-11 | 4.00434e+15 | Hessian treated as singular by AQP pivot cutoff | Solver stopped; model non-identified |
| Question 9 | Block 1 | step tolerance reached | 8 | 4.078e-10 | 1.77636e-15 | 16589.3 | Converged | Identified |
| Question 9 | Block 3 | Hessian treated as singular by AQP pivot cutoff | 29 | 7.97057 | 1.93925e-11 | 5.56427e+15 | Hessian treated as singular by AQP pivot cutoff | Solver stopped; model non-identified |

## Interpretation

- AQP currently requires both Block 1 and Block 3 to satisfy a coefficient-step tolerance of `1e-7`.
- For the investigated items, the likelihood had effectively stabilized, but the coefficients continued to diverge and the Hessian became severely ill-conditioned.
- The custom linear solver then treated the Hessian as singular because a pivot fell below `1e-12`.
- AQP still calculated provisional p-values and ΔR² values, but correctly suppressed flagging because the model parameters were not reliably identified.
- All three provisional p-values exceed 0.01, and the models are correctly classified as non-estimable.

## Recommendation

Do not loosen AQP's convergence requirement and do not accept a library's solver-completion flag by itself. Retain the existing sparse-cell and convergence suppression. Improve the diagnostic language so reports distinguish sparse data, singular/non-identified models, separation, and maximum-iteration failure.

The independent validator has been corrected to require an identified information matrix, not merely `statsmodels.converged`. With that correction, the three classifications agree with AQP and are no longer validation advisories.

## Change status

No production application code was changed during this diagnosis.
