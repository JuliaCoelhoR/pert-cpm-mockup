from backend.cpm import compute


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
# Cycle 1: single-activity project
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
# Cycle 2: linear chain A → B → C
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
# Cycle 3: parallel paths — B (dur 3) is critical, C (dur 1) has float
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
# Cycle 4: two tied critical paths
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
# Cycle 5: free float < total float
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
# Cycle 6: zero cost/day → total_cost == 0, project total_cost correct
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
# Cycle 7: realistic 12-activity network — regression guard
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
    assert proj["duration"] == 22
    assert proj["total_cost"] == 43.0
    assert len(proj["critical_paths"]) == 1

    critical = sorted(a["letter"] for a in result["activities"] if a["critical"])
    assert critical == ["A", "C", "E", "I", "K", "L"]

    # spot-check a few activity values
    a_act = activity_by_letter(result, "A")
    assert a_act["ES"] == 0 and a_act["EF"] == 2 and a_act["total_float"] == 0

    i_act = activity_by_letter(result, "I")
    assert i_act["ES"] == 11 and i_act["EF"] == 16 and i_act["total_float"] == 0

    h_act = activity_by_letter(result, "H")
    assert h_act["critical"] is False and h_act["total_float"] == 4
