# Edge-case statistical validation

**Overall result: PASS**

This independent Python check reads the retained QuestionMark fixtures directly and does not execute AQP's JavaScript calculations. It verifies cohort shape, scored-question selection, missing-response handling, reconstructed scores, classical-test summaries, and conservative DIF prerequisites.

| Scenario | Students | EN | FR | Missing responses | Average | Alpha | DIF safeguard |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Missing responses | 12 | 6 | 6 | 6 | 57.3% | -8.0327 | 8 items have sparse cells |
| Single language | 16 | 16 | 0 | 0 | 60.2% | -13.1868 | Comparison unavailable: no French group |
| Small sample | 6 | 3 | 3 | 0 | 60.4% | -14.1714 | All 8 items have sparse cells |

All three retained edge datasets satisfy their intended design. Their independently reconstructed item scores match the score columns in the fixtures exactly. Browser regression tests separately verify that AQP parses and analyses these same files as intended.

The negative alpha values are expected for these deliberately small, pattern-based stress fixtures and are not presented as plausible operational exam reliability estimates.

This is computational validation, not an external statistician's institutional sign-off.
