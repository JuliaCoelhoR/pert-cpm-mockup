# PERT/CPM Mockup — Design Decisions

This document captures all design decisions reached during the initial grilling session. It is the authoritative record of what we are building and why.

---

## Technology Stack

| Concern | Decision | Rationale |
|---|---|---|
| Backend | Python + Flask | Simple, minimal, no async overhead needed for a local mockup |
| Frontend | Plain HTML / CSS / JS | No build pipeline, wires directly to pywebview + Flask |
| Desktop window | pywebview | Wraps the local Flask server in a native OS window |
| Graph rendering | vis-network | Purpose-built for interactive node/edge networks; hover events, styling, and layout are trivial |
| Data persistence | In-memory only | No DB, no file save/load — data lives for the session |
| Projects | One project at a time | Keeps the UI focused; no navigation, project list, or unsaved-changes flow needed |

---

## Diagram Model

**Activity-on-Arrow (AOA)**, not Activity-on-Node (AON).

- **Arrows** represent activities, labelled with the activity letter on one side and duration (days) on the other.
- **Nodes (circles)** represent numbered events — the states the project is in between activities.

### Layout

Fully automatic. The engine places nodes based on dependency depth; the user cannot drag nodes. Positions are not stored.

### Critical Path Highlight

- Critical path edges: solid red arrows
- Critical path nodes: red border (not fill, to keep labels readable)
- Non-critical edges: grey
- Multiple critical paths are supported — if two or more paths tie for the maximum duration, all are highlighted.

### Dummy Activities

AOA networks require dummy activities (zero-duration, zero-cost arrows) when two activities share some but not all prerequisites. The backend inserts them automatically; the user never enters them. In the diagram:

- Dummy arrows render as **dotted lines** to distinguish them from real activities.
- A dummy arrow on the critical path is **dotted red**; off the critical path it is **dotted grey**.
- Dummy arrows carry **no letter or duration label**.
- Dummy arrows participate in the automatic hierarchical layout like any other edge.
- Hovering over a dummy arrow shows a minimal tooltip: "Dummy activity (structural dependency, zero duration)."
- Dummy activities are **excluded** from the summary panel's Total Activities count, Critical Activities count, and activity table.

---

## Activity Input Table

Activities are entered in an editable, spreadsheet-like table before the diagram is generated.

### Columns (left to right)

| Column | Type | Notes |
|---|---|---|
| Letter | Auto-assigned, read-only | Sequential (A, B, C…); gaps preserved on deletion |
| Description | Free text | Required |
| Prerequisites | Free text | Comma-separated letters, e.g. `A, C` |
| Duration | Positive integer, min 1 | Days; single fixed estimate (no three-point PERT) |
| Cost/day | Positive decimal, min 0 | In R$ |

### Row Lifecycle

- **Adding rows:** Auto-append. A trailing empty row is always visible at the bottom. It is greyed out with placeholder text (e.g. "New activity…") to signal affordance.
- **Draft persistence:** trailing row values typed before a delete are preserved in `draftRow` and restored after `renderTable()`. This avoids surprising loss of in-progress input.
- **Promoting rows:** No row is a real activity until the user clicks **Finished**. Promotion is all-or-nothing — if any row fails validation, nothing is promoted.
- **Deleting rows:** Immediate on clicking the row's trash icon. If the deletion would leave dangling prerequisite references in other rows, a confirmation pop-up explains the situation and asks "are you sure?" before proceeding.
- **Reordering:** Not supported. Rows stay in insertion order.

### Letter Assignment

- Letters are auto-assigned sequentially in insertion order and are locked — the user cannot override them.
- On deletion, gaps are preserved (delete B from A, B, C, D → A, C, D). Existing prerequisite references survive.

### Validation

- **Timing:** Cell validation fires on blur (when the user leaves a cell). Errors are not shown mid-keystroke. Authoritative validation runs server-side on "Finished" click; the blur feedback is a lightweight UX layer only.
- **On "Finished" click:**
  - "Finished" is always clickable (never disabled).
  - If errors exist: an error banner shows the count, invalid cells are highlighted red, and the table auto-scrolls and focuses the first invalid cell.
  - Fixing an error: the red highlight on a cell clears immediately as the user types into it. The banner persists until the next "Finished" click.
- **No per-row save.** Edits commit on blur; the only save action is the table-level "Finished" button.

### Empty State

When the table has zero rows (fresh load, or all rows deleted), a non-deletable placeholder message row is shown (e.g. "No activities yet — start typing to add one").

### Keyboard Navigation

Pressing Tab out of the last cell of the trailing placeholder row traps focus at the end — it does not wrap to the first row.

### Paste

Multi-row paste is supported. Accepts tab/newline-delimited clipboard text (e.g. copied from a spreadsheet), maps columns positionally, and appends rows above the trailing placeholder. Malformed or extra columns are silently ignored.

---

## Hover Tooltips

### Activity Arrow Tooltip

| Field | Source |
|---|---|
| Letter + Description | Input |
| Duration | Input |
| Cost/day (R$) | Input |
| Total activity cost (R$) | Computed: Duration × Cost/day |
| Early Start (ES) | Computed |
| Early Finish (EF) | Computed |
| Late Start (LS) | Computed |
| Late Finish (LF) | Computed |
| Free Float | Computed: slack before this activity delays following activities |
| Total Float | Computed: slack before this activity delays the project |
| Critical path indicator | Computed: yes / no |

### Node (Event) Tooltip

| Field | Source |
|---|---|
| Event number | Auto-assigned |
| Earliest Event Time (EET) | Computed |
| Latest Event Time (LET) | Computed |
| Slack (LET − EET) | Computed; highlighted if zero (critical event) |
| Activities entering this event | Computed |
| Activities leaving this event | Computed |

---

## Summary Panel

Displayed below the diagram. Three sections:

### 1. Critical Path(s)

Each critical path shown as a node sequence (e.g. `1 → 3 → 5 → 7`). If multiple paths tie for the maximum duration, all are listed.

### 2. Project Stats

| Stat | |
|---|---|
| Total Activities | Excludes dummy activities |
| Critical Activities | Excludes dummy activities |
| Total Nodes | |
| Minimal Project Duration | |
| Total Cost | Sum of all activity costs (dummies contribute 0) |
| Total Cost per Critical Path | One entry per critical path |

### 3. Activity Table

Scrollable table with columns: Letter, Description, From Node, To Node, Duration, Cost/day, Total Cost, ES, EF, LS, LF, Free Float, Total Float, Critical flag.

---

## Visual Design

- **Background:** Light (white / light grey)
- **Text:** Charcoal
- **Critical path:** Red (edges and node borders)
- **Non-critical elements:** Neutral blue / slate
- **CSS framework:** Plain CSS or a CDN-linked library (e.g. Bootstrap) — no build step
