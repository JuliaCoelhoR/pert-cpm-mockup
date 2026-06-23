from backend.cpm import (
    compute,
    validate_activities,
    _assign_levels,
    _assign_event_numbers,
    _forward_pass,
    _backward_pass,
    _schedule_activities,
    _compute_events,
    _find_critical_paths,
)


def act(letter, description, prerequisites, duration, cost_per_day):
    return {
        "letter": letter,
        "description": description,
        "prerequisites": prerequisites,
        "duration": duration,
        "cost_per_day": cost_per_day,
    }


def activity_by_letter(result, letter):
    return next(a for a in result["activities"] if a["letter"] == letter)


def event_by_number(result, number):
    return next(e for e in result["events"] if e["number"] == number)


# ---------------------------------------------------------------------------
# single-activity project
# ---------------------------------------------------------------------------

def test_single_activity_project():
    result = compute([act("A", "Only task", [], 5, 10.0)])

    a = activity_by_letter(result, "A")
    assert a["ES"] == 0
    assert a["EF"] == 5
    assert a["LS"] == 0
    assert a["LF"] == 5
    assert a["total_float"] == 0
    assert a["free_float"] == 0
    assert a["critical"] is True
    assert a["total_cost"] == 50.0

    assert result["project"]["duration"] == 5
    assert result["project"]["total_cost"] == 50.0
    assert len(result["project"]["critical_paths"]) == 1


# ---------------------------------------------------------------------------
# linear chain A → B → C
# ---------------------------------------------------------------------------

def test_linear_chain():
    result = compute([
        act("A", "First",  [],    3, 1.0),
        act("B", "Second", ["A"], 2, 1.0),
        act("C", "Third",  ["B"], 4, 1.0),
    ])

    a = activity_by_letter(result, "A")
    assert a["ES"] == 0 and a["EF"] == 3
    assert a["LS"] == 0 and a["LF"] == 3
    assert a["total_float"] == 0 and a["free_float"] == 0
    assert a["critical"] is True

    b = activity_by_letter(result, "B")
    assert b["ES"] == 3 and b["EF"] == 5
    assert b["LS"] == 3 and b["LF"] == 5
    assert b["total_float"] == 0 and b["free_float"] == 0
    assert b["critical"] is True

    c = activity_by_letter(result, "C")
    assert c["ES"] == 5 and c["EF"] == 9
    assert c["LS"] == 5 and c["LF"] == 9
    assert c["total_float"] == 0 and c["free_float"] == 0
    assert c["critical"] is True

    assert result["project"]["duration"] == 9
    assert len(result["project"]["critical_paths"]) == 1
    # path must include 4 nodes (start + 3 activities)
    assert len(result["project"]["critical_paths"][0]) == 4


# ---------------------------------------------------------------------------
# parallel paths — B (dur 3) is critical, C (dur 1) has float
#   A → B ↘
#           D
#   A → C ↗
# ---------------------------------------------------------------------------

def test_parallel_paths_one_critical():
    result = compute([
        act("A", "Start",  [],       2, 0.0),
        act("B", "Long",   ["A"],    3, 0.0),
        act("C", "Short",  ["A"],    1, 0.0),
        act("D", "Finish", ["B","C"],2, 0.0),
    ])
    # Project duration: A(2)+B(3)+D(2) = 7
    assert result["project"]["duration"] == 7

    b = activity_by_letter(result, "B")
    assert b["critical"] is True
    assert b["total_float"] == 0

    c = activity_by_letter(result, "C")
    assert c["critical"] is False
    assert c["total_float"] > 0

    assert len(result["project"]["critical_paths"]) == 1


# ---------------------------------------------------------------------------
# two tied critical paths
#   A → B ↘
#           D    (A=2, B=3, C=3, D=2 → both paths = 7)
#   A → C ↗
# ---------------------------------------------------------------------------

def test_multiple_tied_critical_paths():
    result = compute([
        act("A", "Start",  [],       2, 0.0),
        act("B", "PathB",  ["A"],    3, 0.0),
        act("C", "PathC",  ["A"],    3, 0.0),
        act("D", "Finish", ["B","C"],2, 0.0),
    ])
    assert result["project"]["duration"] == 7

    b = activity_by_letter(result, "B")
    c_act = activity_by_letter(result, "C")
    assert b["critical"] is True
    assert c_act["critical"] is True

    assert len(result["project"]["critical_paths"]) == 2


# ---------------------------------------------------------------------------
# free float < total float
#
# Three parallel starts, two merge early, one long path bypasses to final merge:
#   A(1) ↘
#   B(3) → D(2) dep[A,B] → E(1) dep[D,C]
#   C(10) ──────────────────────────────↗
#
# Critical path: C(10) + E(1) = 11.
# A: to_node = merge_AB. EET[merge_AB]=3. free_float=3-1=2.
#    LET[merge_AB]=LET[merge_CDE]-dur_D=10-2=8. total_float=8-1=7.
#    → free_float(2) < total_float(7)
# ---------------------------------------------------------------------------

def test_free_float_less_than_total_float():
    result = compute([
        act("A", "A", [],       1, 0.0),
        act("B", "B", [],       3, 0.0),
        act("C", "C", [],      10, 0.0),
        act("D", "D", ["A","B"], 2, 0.0),
        act("E", "E", ["D","C"], 1, 0.0),
    ])
    assert result["project"]["duration"] == 11

    a = activity_by_letter(result, "A")
    assert a["free_float"] == 2
    assert a["total_float"] == 7
    assert a["free_float"] < a["total_float"]

    c = activity_by_letter(result, "C")
    assert c["critical"] is True
    assert c["total_float"] == 0


# ---------------------------------------------------------------------------
# zero cost/day → total_cost == 0, project total_cost correct
# ---------------------------------------------------------------------------

def test_zero_cost_per_day():
    result = compute([
        act("A", "Free task", [], 3, 0.0),
        act("B", "Paid task", ["A"], 2, 5.0),
    ])
    a = activity_by_letter(result, "A")
    assert a["total_cost"] == 0.0

    b = activity_by_letter(result, "B")
    assert b["total_cost"] == 10.0

    assert result["project"]["total_cost"] == 10.0


# ---------------------------------------------------------------------------
# realistic 12-activity network — regression guard
#
# Classic construction project network (durations in days):
#   A(2), B(4), C(3) dep[A], D(5) dep[A], E(6) dep[B],
#   F(4) dep[C,B], G(3) dep[D], H(2) dep[E,F], I(5) dep[G,F],
#   J(3) dep[H], K(4) dep[I], L(2) dep[J,K]
#
# Critical path(s) and duration verified by hand below.
# ---------------------------------------------------------------------------

def test_realistic_12_activity_network():
    result = compute([
        act("A", "A", [],        2, 1.0),
        act("B", "B", [],        4, 1.0),
        act("C", "C", ["A"],     3, 1.0),
        act("D", "D", ["A"],     5, 1.0),
        act("E", "E", ["B"],     6, 1.0),
        act("F", "F", ["C","B"], 4, 1.0),
        act("G", "G", ["D"],     3, 1.0),
        act("H", "H", ["E","F"], 2, 1.0),
        act("I", "I", ["G","F"], 5, 1.0),
        act("J", "J", ["H"],     3, 1.0),
        act("K", "K", ["I"],     4, 1.0),
        act("L", "L", ["J","K"], 2, 1.0),
    ])

    proj = result["project"]
    assert proj["duration"] == 21
    assert proj["total_cost"] == 43.0
    assert len(proj["critical_paths"]) == 2

    real_critical = sorted(
        a["letter"] for a in result["activities"] if a["critical"] and not a.get("dummy")
    )
    assert real_critical == ["A", "B", "D", "E", "G", "I", "K", "L"]

    a_act = activity_by_letter(result, "A")
    assert a_act["ES"] == 0 and a_act["EF"] == 2 and a_act["total_float"] == 0

    i_act = activity_by_letter(result, "I")
    assert i_act["ES"] == 10 and i_act["EF"] == 15 and i_act["total_float"] == 0

    h_act = activity_by_letter(result, "H")
    assert h_act["critical"] is False and h_act["total_float"] == 4


# ---------------------------------------------------------------------------
# Phase-level tests
# ---------------------------------------------------------------------------

def test_assign_levels_respects_dependency_depth():
    acts = [
        act("A", "a", [], 1, 0),
        act("B", "b", ["A"], 1, 0),
        act("C", "c", ["A", "B"], 1, 0),
    ]
    levels = _assign_levels(acts)
    assert levels["A"] == 0
    assert levels["B"] == 1
    assert levels["C"] == 2


def test_assign_event_numbers_linear_chain():
    acts = [act("A", "a", [], 1, 0), act("B", "b", ["A"], 1, 0)]
    levels = {"A": 0, "B": 1}
    from_node, to_node, dummies = _assign_event_numbers(acts, levels)
    assert from_node["A"] == 1
    assert to_node["A"] == from_node["B"]
    assert to_node["B"] > from_node["B"]
    assert dummies == []


def test_assign_event_numbers_merge_creates_shared_to_node():
    # B and C both feed D — their to_nodes must be merged into one node
    acts = [
        act("A", "a", [], 1, 0),
        act("B", "b", ["A"], 1, 0),
        act("C", "c", ["A"], 1, 0),
        act("D", "d", ["B", "C"], 1, 0),
    ]
    levels = {"A": 0, "B": 1, "C": 1, "D": 2}
    from_node, to_node, dummies = _assign_event_numbers(acts, levels)
    assert to_node["B"] == to_node["C"]
    assert from_node["D"] == to_node["B"]
    assert dummies == []


def test_forward_pass_accumulates_earliest_times():
    acts = [act("A", "a", [], 2, 0), act("B", "b", ["A"], 3, 0)]
    levels = {"A": 0, "B": 1}
    from_node = {"A": 1, "B": 2}
    to_node = {"A": 2, "B": 3}
    EET = _forward_pass(acts, from_node, to_node, levels)
    assert EET[1] == 0
    assert EET[2] == 2
    assert EET[3] == 5


def test_backward_pass_propagates_latest_times():
    acts = [act("A", "a", [], 2, 0), act("B", "b", ["A"], 3, 0)]
    levels = {"A": 0, "B": 1}
    from_node = {"A": 1, "B": 2}
    to_node = {"A": 2, "B": 3}
    EET = {1: 0.0, 2: 2.0, 3: 5.0}
    LET = _backward_pass(acts, from_node, to_node, levels, EET)
    assert LET[3] == 5
    assert LET[2] == 2
    assert LET[1] == 0


def test_schedule_activities_computes_floats_and_cost():
    # B (dur 3) is critical, C (dur 1) has total_float 2
    acts = [act("B", "b", ["A"], 3, 10), act("C", "c", ["A"], 1, 5)]
    from_node = {"B": 2, "C": 2}
    to_node = {"B": 3, "C": 3}
    EET = {2: 1.0, 3: 4.0}
    LET = {2: 1.0, 3: 4.0}
    result = _schedule_activities(acts, from_node, to_node, EET, LET)
    b = next(a for a in result if a["letter"] == "B")
    c = next(a for a in result if a["letter"] == "C")
    assert b["total_float"] == 0 and b["critical"] is True and b["total_cost"] == 30
    assert c["total_float"] == 2 and c["critical"] is False and c["total_cost"] == 5


def test_compute_events_reports_slack_and_sorted_order():
    EET = {1: 0.0, 3: 5.0, 2: 3.0}
    LET = {1: 0.0, 3: 5.0, 2: 4.0}
    events = _compute_events(EET, LET, [])
    numbers = [e["number"] for e in events]
    assert numbers == [1, 2, 3]
    event2 = next(e for e in events if e["number"] == 2)
    assert event2["slack"] == 1.0
    assert events[0]["slack"] == 0.0


def test_find_critical_paths_single_path_with_cost():
    # Linear chain A→B; non-critical C on a separate edge is excluded from cost sum
    result_activities = [
        {"from_node": 1, "to_node": 2, "letter": "A", "total_cost": 6.0, "critical": True},
        {"from_node": 2, "to_node": 3, "letter": "B", "total_cost": 9.0, "critical": True},
        {"from_node": 1, "to_node": 3, "letter": "C", "total_cost": 3.0, "critical": False},
    ]
    paths, costs = _find_critical_paths(result_activities, 1, 3)
    assert paths == [[1, 2, 3]]
    assert costs == [15.0]


# ---------------------------------------------------------------------------
# Dummy activity insertion
#
# Classic dummy-requiring network:
#   A (no prereqs, dur=2)
#   B (no prereqs, dur=3)
#   C (no prereqs, dur=4)
#   E dep[B],      dur=2   — depends on B only
#   F dep[B,C],   dur=3   — depends on B AND C
#   G dep[A,E,F], dur=1   — terminal
#
# Without dummies E and F would share B's end-node, incorrectly making E
# depend on C.  A dummy DA1 must be inserted from B's end-node to the B+C
# merge node so that only F (via the dummy) picks up C's dependency.
#
# Manual critical-path analysis:
#   Paths to G's start (= merge of A, E, F):
#     via A:         0+2       = 2
#     via E (B→E):  0+3+2     = 5
#     via F (B+C→F): max(3,4)+3 = 7   ← longest
#   Project duration: 7 + 1 = 8
#
# Critical path: C → F → G (durations 4+3+1=8).
# E is NOT critical (total_float = (7-5) = 2 > 0).
# ---------------------------------------------------------------------------

def test_dummy_insertion_e_dep_b_f_dep_bc():
    result = compute([
        act("A", "A", [],       2, 0.0),
        act("B", "B", [],       3, 0.0),
        act("C", "C", [],       4, 0.0),
        act("E", "E", ["B"],    2, 0.0),
        act("F", "F", ["B","C"],3, 0.0),
        act("G", "G", ["A","E","F"], 1, 0.0),
    ])

    # Project duration must be 8 (C+F+G = 4+3+1).
    assert result["project"]["duration"] == 8

    # At least one dummy activity must appear in the output.
    dummies = [a for a in result["activities"] if a.get("dummy") is True]
    assert len(dummies) >= 1, "Expected at least one dummy activity"

    # All dummy activities must have the declared shape.
    for d in dummies:
        assert d["duration"] == 0
        assert d["cost_per_day"] == 0
        assert d["total_cost"] == 0
        assert d["description"] == "Dummy"
        assert d["letter"].startswith("DA")

    # Real activities must have dummy=False.
    for letter in ["A", "B", "C", "E", "F", "G"]:
        a = activity_by_letter(result, letter)
        assert a["dummy"] is False, f"Activity {letter} should not be marked dummy"

    # E depends only on B — it must NOT be critical and must have float > 0.
    e = activity_by_letter(result, "E")
    assert e["critical"] is False
    assert e["total_float"] > 0

    # C → F → G are on the critical path.
    c = activity_by_letter(result, "C")
    f = activity_by_letter(result, "F")
    g = activity_by_letter(result, "G")
    assert c["critical"] is True
    assert f["critical"] is True
    assert g["critical"] is True

    # Scheduling values for E: ES=3 (after B), EF=5; project is 8, so
    # total_float = LF-dur-ES = (8-1-2) - 3 = ... let's just check EF=5
    assert e["ES"] == 3
    assert e["EF"] == 5

    # F must start no earlier than max(B.EF, C.EF) = max(3,4) = 4.
    assert f["ES"] == 4
    assert f["EF"] == 7


# ---------------------------------------------------------------------------
# validate_activities tests
# ---------------------------------------------------------------------------

def test_validate_activities_valid_returns_empty():
    assert validate_activities([
        act("A", "First", [],    2, 1.0),
        act("B", "Second", ["A"], 3, 0.0),
    ]) == []


def test_validate_activities_missing_required_key():
    bad = {"letter": "A", "description": "x", "prerequisites": [], "duration": 1}
    # cost_per_day missing
    errors = validate_activities([bad])
    assert any("cost_per_day" in e["message"] for e in errors)


def test_validate_activities_duplicate_letter():
    acts = [act("A", "First", [], 1, 0), act("A", "Second", [], 1, 0)]
    errors = validate_activities(acts)
    assert any(e["field"] == "letter" and "duplicate" in e["message"].lower() for e in errors)
    assert any(e["letter"] == "A" for e in errors)


def test_validate_activities_empty_letter():
    errors = validate_activities([act("", "x", [], 1, 0)])
    assert any(e["field"] == "letter" for e in errors)


def test_validate_activities_invalid_letter_type():
    bad = {"letter": 42, "description": "x", "prerequisites": [], "duration": 1, "cost_per_day": 0}
    errors = validate_activities([bad])
    assert any(e["field"] == "letter" for e in errors)


def test_validate_activities_empty_description():
    acts = [act("A", "  ", [], 1, 0)]
    errors = validate_activities(acts)
    assert any(e["field"] == "description" and e["letter"] == "A" for e in errors)


def test_validate_activities_bad_duration():
    bad = {"letter": "A", "description": "x", "prerequisites": [], "duration": 1.5, "cost_per_day": 0}
    for inp in [act("A", "x", [], 0, 0), act("A", "x", [], -1, 0), bad]:
        errs = validate_activities([inp])
        assert any(e["field"] == "duration" for e in errs), f"Expected duration error for input {inp}"


def test_validate_activities_negative_cost():
    errors = validate_activities([act("A", "x", [], 1, -0.5)])
    assert any(e["field"] == "cost_per_day" and e["letter"] == "A" for e in errors)


def test_validate_activities_missing_prerequisite_letter():
    acts = [act("A", "x", ["Z"], 1, 0)]
    errors = validate_activities(acts)
    assert any(e["field"] == "prerequisites" and "'Z'" in e["message"] for e in errors)
    assert any(e["letter"] == "A" for e in errors)


def test_validate_activities_prerequisites_not_list():
    bad = {"letter": "A", "description": "x", "prerequisites": "B", "duration": 1, "cost_per_day": 0}
    errors = validate_activities([bad])
    assert any(e["field"] == "prerequisites" for e in errors)


def test_validate_activities_cycle_detected():
    acts = [
        act("A", "x", ["B"], 1, 0),
        act("B", "x", ["A"], 1, 0),
    ]
    errors = validate_activities(acts)
    assert any("cycle" in e["message"].lower() for e in errors)
    assert any(e["letter"] is None and e["field"] is None for e in errors)
