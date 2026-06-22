## Problem Statement

Project managers and students working with PERT/CPM scheduling techniques currently have to compute critical path values (ES, EF, LS, LF, float) by hand or rely on heavyweight tools. There is no lightweight, focused desktop tool that lets a user define a set of activities, visualise the Activity-on-Arrow network, and immediately read off critical path analysis without leaving a single window.

## Solution

A local desktop application (native window via pywebview) that lets the user:

1. Enter a project name and a list of activities in a spreadsheet-like table.
2. Click **Finished** to validate the table and generate an Activity-on-Arrow (AOA) PERT diagram.
3. Inspect the diagram — hover over arrows (activities) or nodes (events) to see computed scheduling values.
4. Read a summary panel below the diagram showing critical path(s), project stats, and a full activity table with all CPM values.

## User Stories

1. As a user, I want to open the application in a native desktop window so that it feels like a proper app rather than a browser tab.
2. As a user, I want to enter a project name so that the session is clearly labelled.
3. As a user, I want an editable table of activities so that I can enter all project data in one place before generating the diagram.
4. As a user, I want each activity to be automatically assigned a letter (A, B, C...) so that I can reference activities unambiguously in the prerequisites column.
5. As a user, I want the activity letter to be read-only and stable so that prerequisites I have already typed are not silently broken by a rename.
6. As a user, I want a trailing empty row to appear automatically at the bottom of the table so that I can add a new activity by simply typing without clicking an Add button.
7. As a user, I want the trailing empty row to look visually distinct (greyed out, placeholder text) so that I know it is not yet a real activity.
8. As a user, I want all rows to be promoted to real activities only when I click Finished so that I can freely edit draft data without side effects.
9. As a user, I want Finished to always be clickable so that I can request validation feedback at any time.
10. As a user, I want validation errors to be shown all at once when I click Finished so that I am not interrupted while filling in a row.
11. As a user, I want invalid cells to be highlighted red and the table to auto-scroll to the first error so that I can find and fix problems quickly.
12. As a user, I want an error banner showing the count of invalid cells so that I know how much work is left before I can proceed.
13. As a user, I want validation errors to appear only when I click Finished so that I am not shown an error while mid-keystroke.
14. As a user, I want red cell highlights to clear immediately as I start typing so that the UI does not feel punishing while I am actively fixing an error.
15. As a user, I want to enter prerequisites as a comma-separated list of activity letters (e.g. A, C) so that the input matches standard PERT textbook notation.
16. As a user, I want invalid prerequisite references to be caught on Finished so that the diagram is never generated from a broken dependency graph.
17. As a user, I want to delete a row by clicking a trash icon so that I can remove activities I no longer need.
18. As a user, I want a confirmation pop-up when deleting a row that would leave dangling prerequisite references so that I am not surprised by validation errors caused by the deletion.
19. As a user, I want deleted activity letters to leave a gap in the sequence (e.g. deleting B gives A, C, D) so that existing prerequisite references in other rows are not silently remapped.
20. As a user, I want to paste multiple rows from a spreadsheet into the table so that I can import activity data I have already prepared elsewhere.
21. As a user, I want the Duration field to accept only positive integers (minimum 1) so that impossible durations are caught immediately.
22. As a user, I want the Cost/day field to accept positive decimals (minimum 0) so that zero-cost activities are valid and cent-level precision is supported.
23. As a user, I want to see a placeholder message when the table is empty so that I know how to start adding activities.
24. As a user, I want pressing Tab in the last cell of the table to keep focus there so that navigation stays predictable.
25. As a user, I want the diagram to be laid out automatically based on dependency depth so that I never have to place nodes by hand.
26. As a user, I want the diagram to use Activity-on-Arrow (AOA) notation so that arrows represent activities and numbered circles represent project states (events).
27. As a user, I want each arrow to show the activity letter on one side and the duration in days on the other side so that I can read the network at a glance.
28. As a user, I want the critical path arrows and nodes to be highlighted in red so that the critical path is immediately obvious.
29. As a user, I want non-critical arrows to appear in grey so that they are clearly distinguished from critical ones.
30. As a user, I want all paths that tie for the maximum project duration to be highlighted as critical so that I am not misled when there are multiple critical paths.
31. As a user, I want to hover over an activity arrow and see a tooltip with: Activity Letter + Description, Duration, Cost/day, Total activity cost, ES, EF, LS, LF, Free Float, Total Float, and a Critical path indicator so that I can read all scheduling values without leaving the diagram.
32. As a user, I want to hover over a node (event) and see a tooltip with: Event number, EET, LET, Slack (highlighted if zero), and the list of activities entering and leaving that event so that I can understand the state of the project at any event.
33. As a user, I want the summary panel to show each critical path as a node sequence (e.g. 1 -> 3 -> 5 -> 7) so that I can communicate the critical path clearly.
34. As a user, I want the summary panel to show project-level stats (Total Activities, Critical Activities, Total Nodes, Minimal Project Duration, Total Cost, Total Cost per Critical Path) so that I have a quick overview without reading the full activity table. Total Activities and Critical Activities exclude automatically-inserted dummy activities.
35. As a user, I want the summary panel to include a scrollable activity table with columns Letter, Description, From Node, To Node, Duration, Cost/day, Total Cost, ES, EF, LS, LF, Free Float, Total Float, and Critical flag so that I can compare activities side by side. Dummy activities are excluded from this table.
36. As a user, I want the application to use a light colour scheme (light background, charcoal text) so that the diagram is easy to read under normal lighting.

## Implementation Decisions

### Architecture

- **Desktop shell:** pywebview wraps a locally running Flask server in a native OS window. The user sees a native window; there is no browser chrome.
- **Backend:** Python + Flask. Serves the frontend assets and exposes an HTTP API for CPM computation.
- **Frontend:** Plain HTML / CSS / JS — no build pipeline, no framework. Loaded directly from Flask static assets via pywebview.
- **Graph rendering:** vis-network library for the AOA diagram. Loaded via CDN or bundled locally.
- **Data model:** In-memory only. No database, no file save/load. All state lives for the duration of the session.
- **Projects:** One project at a time. No project list, no switching, no unsaved-changes flow.

### CPM Computation Module

The core of the backend is a pure Python CPM computation module — no HTTP, no Flask, no UI. It accepts a list of activities (letter, description, prerequisites, duration, cost_per_day) and returns:

- Forward pass values: ES, EF per activity
- Backward pass values: LS, LF per activity
- Free Float and Total Float per activity
- Critical path flag per activity
- All critical paths (as sequences of event numbers) — multiple paths if tied
- Event-level values: EET, LET, Slack per event
- Project-level aggregates: minimal project duration, total cost, total cost per critical path

This module is the primary test seam (see Testing Decisions).

### Flask API

A single POST endpoint (e.g. /api/compute) accepts the activity list as JSON and returns the full computed result. The frontend sends the table data here on Finished and receives everything needed to render the diagram and summary panel.

### Activity Table — Key Behaviours

- Letter assignment: sequential, auto-assigned, read-only, gaps preserved on deletion.
- Row promotion: all-or-nothing on Finished click.
- Validation: full sweep on Finished click via the backend; red highlights clear immediately as the user types.
- Paste: tab/newline-delimited multi-row clipboard paste, positional column mapping.
- Deletion: immediate with confirmation pop-up when dangling prerequisite references exist.

### AOA Diagram

- vis-network renders nodes (numbered events) and edges (labelled activities).
- Automatic hierarchical layout (left-to-right, dependency-depth based). No drag support.
- Arrow labels: activity letter on one side, duration on the other.
- Critical path: red edges + red node borders. Non-critical: grey edges.
- Multiple critical paths all highlighted.
- Dummy activities render as dotted arrows (grey when non-critical, dotted red when critical). No letter/duration label on dummy arrows.

### Tooltips

- Arrow hover: Letter + Description, Duration, Cost/day, Total activity cost, ES, EF, LS, LF, Free Float, Total Float, Critical flag.
- Node hover: Event number, EET, LET, Slack (highlighted if zero), In/Out activity list.

## Testing Decisions

### What makes a good test

Tests should verify the external behaviour of the CPM computation module — given this list of activities, produce these computed values. Tests must not assert on internal implementation details (e.g. intermediate data structures, traversal order).

### What to test

Primary seam: CPM computation module.

Test cases should cover:

- A simple linear chain (A -> B -> C) — verify ES/EF/LS/LF, zero float on all, single critical path.
- A network with parallel paths — verify the longer path is critical and the shorter path has positive float.
- A network with multiple tied critical paths — verify all paths are returned.
- Correct Free Float vs Total Float distinction.
- Activities with zero cost/day — verify total cost calculations.
- A single-activity project.
- Large realistic networks (10-15 activities) — regression guard.

Not in scope for automated tests:

- Flask HTTP layer (thin wrapper; tested manually)
- Frontend rendering (browser-dependent; tested manually)
- vis-network diagram correctness (visual; tested manually)

## Out of Scope

- Data persistence (save/load, database)
- Multiple simultaneous projects
- Three-point PERT duration estimation (optimistic / most likely / pessimistic)
- Drag-and-drop node positioning
- User-defined activity letters
- Row reordering
- Export (PDF, image, CSV)
- Undo/redo
- Authentication or multi-user support

## Further Notes

- **Dummy activities:** AOA networks sometimes require dummy activities (zero-duration, zero-cost arrows) to correctly represent certain dependency structures (e.g. activity E depends only on B, while activity F depends on both B and C). The backend inserts dummy activities automatically — the user never enters them. Dummies appear in the diagram as dotted arrows and are excluded from the summary panel's activity counts and activity table.
- **Currency:** Cost/day is denominated in R$ (Brazilian Real). The UI should label it accordingly throughout.
- **Multiple critical paths:** The current design highlights all tied-maximum-duration paths. The summary panel lists each as a separate row with its own total cost.
