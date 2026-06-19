# ADR-0001: Extract internal phase functions from `compute()`

**Status:** Accepted  
**Date:** 2026-06-19

## Context

`backend/cpm.py` contains a single public function `compute()` that runs six
algorithmically distinct phases in one function frame with no internal seams:

1. Topological sort (assign dependency levels)
2. Event numbering (AOA node assignment with merge logic)
3. Forward pass (earliest event times)
4. Backward pass (latest event times)
5. Activity scheduling (ES, EF, LS, LF, floats, cost, critical flag)
6. Event summarisation (EET, LET, slack per event)
7. Critical-path discovery (DFS + cost summation)

Without internal seams, a regression in any phase surfaces as a wrong float or
wrong critical-path value, with no way to isolate which phase failed. The
seven end-to-end tests exercise the full pipeline; there is no test surface
for individual phases.

## Decision

Extract seven private functions — one per phase — without changing the external
interface of `compute()`. The public seam remains `compute(activities) → dict`.

### Function signatures

| Function | Signature |
|---|---|
| `_assign_levels` | `(activities) → dict[str, int]` |
| `_assign_event_numbers` | `(activities, levels) → (from_node, to_node, dummy_activities)` |
| `_forward_pass` | `(activities, from_node, to_node, levels) → EET` |
| `_backward_pass` | `(activities, from_node, to_node, levels, EET) → LET` |
| `_schedule_activities` | `(activities, from_node, to_node, EET, LET) → list[dict]` |
| `_compute_events` | `(EET, LET) → list[dict]` |
| `_find_critical_paths` | `(result_activities, start_node, end_node) → (paths, costs)` |

### Key design choices and the reasons behind them

**Scheduling and event summarisation are two separate functions**, not one.
They take different inputs and produce independent outputs. Merging them
would recreate the original problem in miniature.

**Each function sorts/prepares its own input** (e.g. `_assign_event_numbers`
derives `sorted_activities` from `levels` internally) rather than receiving
a pre-sorted list. The sort order is an implementation detail of each phase,
not a fact callers should know.

**`_forward_pass` returns only `EET`** — not `(EET, all_nodes)`. After the
forward pass, `EET.keys()` is the full node set; returning `all_nodes`
separately would be redundant. `_compute_events` derives the node set from
`EET.keys()`. `project_duration` and `end_node` are derived in `compute()`
from `max(EET.values())` — two readable lines that do not need hiding.

**`_find_critical_paths` returns `(critical_paths, cost_per_critical_path)`**
as a tuple. Cost is always computed together with paths and depends directly
on them; separating it would add a round-trip for no gain.

**Phase-level tests live in `tests/test_cpm.py`** alongside the existing
end-to-end tests. Splitting into a second file would add navigation overhead
without organisational benefit at this scale. Private functions are imported
directly (`from backend.cpm import _assign_levels`).

## Consequences

- A regression in any single phase now fails that phase's test specifically,
  not an end-to-end float or critical-path assertion.
- The event-numbering phase (`_assign_event_numbers`) is now independently
  testable, which is the natural precondition for the Union-Find refactor
  described in the architecture review (Candidate 3).
- `compute()` is a thin 15-line sequencer; the algorithmic complexity is
  distributed across seven focused functions.
- The external interface and all seven original end-to-end tests are
  unchanged.
