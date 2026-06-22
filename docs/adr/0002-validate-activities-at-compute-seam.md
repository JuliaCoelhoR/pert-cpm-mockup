# ADR-0002: Add `validate_activities()` to enforce the `compute()` interface contract

**Status:** Accepted  
**Date:** 2026-06-19

## Context

`compute(activities: list[dict])` had a large hidden interface contract — required
keys, non-empty values, type constraints, valid prerequisite references, and
acyclicity — that was not enforced at the seam. Invalid input produced cryptic
`KeyError` or `StopIteration` deep inside the algorithm, or in the case of a
cycle, an infinite loop that required killing the process. The interface was
shallower than it appeared: callers bore a large knowledge burden that was
invisible from the signature.

The dummy-activity limitation (two activities sharing some but not all
prerequisites) is **not** a validation concern: the backend now inserts dummy
activities automatically (see ADR-0001 context). Validation only enforces the
contract for user-supplied data.

## Decision

Add a public `validate_activities(activities: list[dict]) -> list[dict]` function
in `backend/cpm.py`. It returns a list of error dicts
(`{"letter": str | None, "field": str | None, "message": str}`); an empty list
means valid. It enforces:

1. **Required keys** — each activity dict must have: `letter`, `description`,
   `prerequisites`, `duration`, `cost_per_day`.
2. **Non-empty letter** — must be a non-empty string.
3. **No duplicate letters** — each letter must be unique across the list.
4. **Non-empty description** — must be a non-empty string.
5. **Prerequisites is a list** — not a string or other type.
6. **Duration** — must be a positive integer (≥ 1); floats and booleans are
   rejected.
7. **Cost per day** — must be a non-negative number (≥ 0); booleans are
   rejected.
8. **Prerequisite references exist** — every letter named in a prerequisites
   list must be the letter of another activity in the list.
9. **No cycles** — detected via Kahn's BFS; if any activities remain unvisited
   after the traversal, a cycle is present.

Checks 1–7 run first (structural). Checks 8–9 run only if structural checks
pass, since they require all keys and letters to be valid.

### Key design choices and the reasons behind them

**Returns `list[dict]`, not plain strings.** Each error dict has the shape
`{"letter": str | None, "field": str | None, "message": str}`. The frontend maps
`letter` + `field` to per-cell highlights; errors without a letter or field
(e.g. cycle detection) surface as banner messages. This eliminates the duplicate
validation logic that previously lived in the frontend's `validateRows()` and
also gives the frontend coverage for backend-only checks (duplicate letters,
circular dependencies) that were previously unhighlighted 422 responses.

**Public, not private.** The function enforces the public interface of
`compute()` — it is part of the public contract, not an implementation detail.
Making it public lets `server.py` call it independently (see below) and allows
any future caller of `compute()` to pre-validate without catching exceptions.

**`compute()` calls it internally and raises `ValueError`** if any errors are
returned. This is defence in depth: if `compute()` is called directly (e.g.
in tests or future callers), invalid input is still caught at the seam rather
than producing cryptic errors inside the algorithm.

**`server.py` calls it explicitly** before calling `compute()` and returns
`{"errors": [...]}` with HTTP 422 when invalid. This gives the frontend
specific, readable error messages rather than the generic `"Computation failed
— check activity data"` that the blanket exception handler produces. The blanket
handler remains for unexpected runtime errors.

**Tests live in `tests/test_cpm.py`** alongside the compute tests. One test
per check category; assertions check `e["field"]` and `e["message"]` rather than
asserting exact message wording, so messages can be improved without touching
tests.

## Consequences

- Invalid input now fails at the seam with a readable message rather than
  crashing inside the algorithm or hanging indefinitely (cycle case).
- The `compute()` interface is now honest: every constraint a caller must
  satisfy is documented and enforced in one place.
- `server.py` returns `{"errors": [...]}` (an array of dicts) for validation
  failures and `{"error": "..."}` (a string) for unexpected runtime errors.
  On a 422 response the frontend's `mapValidationErrors()` maps each dict to a
  per-cell highlight using `letter` + `field`; errors without those keys become
  banner messages. The frontend `validateRows()` function has been deleted —
  validation is now authoritative in `validate_activities()` only. Three
  independent error categories remain: (1) network / fetch failures, (2) non-ok
  HTTP responses (mapped to cell highlights or banner via the above), and (3)
  diagram-render failures — each handled by a separate code path in
  `handleFinished()`.
- Adding a new constraint (e.g. maximum activity count) has one place:
  `validate_activities()`. Its tests are independent of the scheduling tests.
