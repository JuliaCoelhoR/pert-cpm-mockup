# ADR-0003: Replace scan-all patterns in `_assign_event_numbers()` with canonical dict + `node_starters` index

**Status:** Accepted  
**Date:** 2026-06-19

## Context

`_assign_event_numbers()` (extracted in ADR-0001) contained two O(n) scan-all
patterns per merge operation:

1. **Conflict detection** — `[lt for lt, fn in from_node.items() if fn == old]`
   scanned the entire `from_node` dict to find activities starting from a given
   node.
2. **Safe-merge re-mapping** — two nested loops over `to_node.items()` and
   `from_node.items()` updated every pointer that referenced the old node ID.

Both patterns were introduced during the dummy-activity feature (between ADR-0001
and ADR-0002). They are correct but do not scale: each merge triggers two full
scans of all already-processed activities. For large networks (e.g. 100+
activities with many forks) this is O(n²) in the number of merge operations.

Beyond performance, the re-mapping loops were the hardest-to-read code in the
module: they mutated dicts mid-iteration via `list(...)` copies and updated
pointer targets across all previously-assigned activities — a pattern that was
easy to break silently.

## Decision

Replace the two scan-all patterns with:

### 1. Canonical dict + `find()` (Union-Find variant)

```python
canonical: dict[int, int] = {}

def find(n: int) -> int:
    while n in canonical:
        n = canonical[n]
    return n
```

`canonical[n] = m` means node `n` has been absorbed into `m`. `find(n)` resolves
to the current canonical ID by following the chain. When a safe merge is
performed, `canonical[old_can] = merge` records the absorption in O(1). No
re-mapping of existing pointers is needed at merge time.

A **final projection pass** at the end of the function applies `find()` to all
values in `from_node` and `to_node` before returning. This resolves every raw
node ID to its canonical representative in a single linear pass. The external
signature and return types are unchanged.

### 2. `node_starters` reverse index

```python
node_starters: dict[int, set[str]] = defaultdict(set)
```

Maps each canonical node to the set of real activity letters whose `from_node`
resolves to it. Maintained incrementally:
- **No-prereq and single-prereq cases**: add the letter to
  `node_starters[find(raw)]` when assigning `from_node`.
- **Safe merge**: `node_starters[merge] |= node_starters.pop(old_can, set())`
  transfers starters from the absorbed node to the merge node in O(k) where k
  is the number of starters.
- **Conflict case (dummy insertion)**: the dummy letter is NOT added to
  `node_starters` — dummies are placed correctly by construction and are never a
  source of conflict.

Conflict detection then becomes O(k) in the number of starters (not O(n) in all
activities): `node_starters.get(old_can, set())` returns the relevant starters
directly.

### Dead code removal

`node_activities` (a dict mapping nodes to sets of activity letters ending there)
was written to in six places inside `_assign_event_numbers()` but never read
anywhere in the codebase. It was introduced during the dummy-activity feature and
was superseded before it was ever wired up. It is deleted in this change.

## Key design choices

**Simple canonical dict, not full Union-Find with path compression.**
The function processes activities in topological order, so merge chains are short.
A simple iterative `find()` is sufficient, and path compression would add
complexity for no measurable benefit at realistic network sizes.

**Final projection pass, not eager re-mapping.**
Resolving raw IDs at return time (one linear pass) is simpler than keeping every
pointer canonical at all times. The external signature is unchanged — callers
receive plain `dict[str, int]` values with no canonical dict leaking out.

**Dummies excluded from `node_starters`.**
Dummy activities are placed with explicit `from_node`/`to_node` assignments and
are never the cause of a future conflict. Including them in `node_starters` would
require special-casing the conflict-detection loop (dummy letters are not in the
original `activities` list, so looking up their prerequisites would raise
`StopIteration`). Excluding them is both correct and simpler.

## Consequences

- **Conflict detection** drops from O(n) per merge to O(k) where k is the number
  of activities starting from the node being checked — typically 0 or 1.
- **Safe merge** drops from O(n) (two full dict scans + mutation) to O(k + 1):
  one `canonical` dict write and one set union.
- `node_activities` dead code is removed; the implementation is shorter and all
  remaining dict mutations are local.
- The external interface of `_assign_event_numbers()` is unchanged:
  `(from_node, to_node, dummy_activities)` — all existing tests pass without
  modification.
- Future maintainers working on node merging have a single place to understand:
  the `canonical` dict and its `find()` resolver, not scattered pointer-update
  loops.
