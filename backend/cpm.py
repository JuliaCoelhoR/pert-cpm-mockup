"""Pure CPM computation module — no HTTP, no Flask, no UI.

Dummy activities are inserted automatically when two activities share some but
not all prerequisites (e.g. E dep[B] and F dep[B,C]).  Each inserted dummy
carries a zero-duration, zero-cost arrow in the AOA graph and is included in
the output with ``"dummy": True`` so the frontend can render it as a dotted
arrow.
"""
from __future__ import annotations

from collections import defaultdict, deque

_START_NODE = 1
_REQUIRED_KEYS = frozenset({"letter", "description", "prerequisites", "duration", "cost_per_day"})


def _assign_levels(activities: list[dict]) -> dict[str, int]:
    letter_to_act = {a["letter"]: a for a in activities}
    in_degree: dict[str, int] = {a["letter"]: 0 for a in activities}
    children: dict[str, list[str]] = defaultdict(list)
    for a in activities:
        for p in a["prerequisites"]:
            in_degree[a["letter"]] += 1
            children[p].append(a["letter"])

    level: dict[str, int] = {}
    queue: deque[str] = deque(
        [a["letter"] for a in activities if in_degree[a["letter"]] == 0]
    )
    remaining = dict(in_degree)
    while queue:
        letter = queue.popleft()
        prereq_levels = [level[p] for p in letter_to_act[letter]["prerequisites"]]
        level[letter] = (max(prereq_levels) + 1) if prereq_levels else 0
        for child in children[letter]:
            remaining[child] -= 1
            if remaining[child] == 0:
                queue.append(child)
    return level


def _assign_event_numbers(
    activities: list[dict], levels: dict[str, int]
) -> tuple[dict[str, int], dict[str, int], list[dict]]:
    """Dummy activities are inserted when two predecessors must not share an end-node."""
    next_node = [_START_NODE + 1]
    dummy_counter = [0]

    def new_node() -> int:
        n = next_node[0]
        next_node[0] += 1
        return n

    def new_dummy_letter() -> str:
        dummy_counter[0] += 1
        return f"DA{dummy_counter[0]}"

    canonical: dict[int, int] = {}

    def find(n: int) -> int:
        while n in canonical:
            n = canonical[n]
        return n

    to_node: dict[str, int] = {}
    from_node: dict[str, int] = {}
    dummy_activities: list[dict] = []

    node_starters: dict[int, set[str]] = defaultdict(set)

    for a in sorted(activities, key=lambda a: (levels[a["letter"]], a["letter"])):
        letter = a["letter"]
        prereqs = a["prerequisites"]
        if not prereqs:
            from_node[letter] = _START_NODE
            node_starters[find(_START_NODE)].add(letter)
        elif len(prereqs) == 1:
            raw = to_node[prereqs[0]]
            from_node[letter] = raw
            node_starters[find(raw)].add(letter)
        else:
            canonical_preds = [find(to_node[p]) for p in prereqs]
            unique = set(canonical_preds)
            if len(unique) == 1:
                from_node[letter] = to_node[prereqs[0]]
                node_starters[unique.pop()].add(letter)
            else:
                merge = new_node()
                prereq_set = set(prereqs)

                for p in prereqs:
                    old_can = find(to_node[p])
                    starters = node_starters.get(old_can, set())
                    conflict = any(
                        set(next(
                            act2["prerequisites"]
                            for act2 in activities
                            if act2["letter"] == lt
                        )) != prereq_set
                        for lt in starters
                    )

                    if conflict:
                        # do NOT union: starters at old_can must not inherit this merge
                        dl = new_dummy_letter()
                        dummy_activities.append({
                            "letter": dl,
                            "description": "Dummy",
                            "prerequisites": [p],
                            "duration": 0,
                            "cost_per_day": 0,
                            "dummy": True,
                        })
                        from_node[dl] = to_node[p]
                        to_node[dl] = merge
                    else:
                        canonical[old_can] = merge
                        node_starters[merge] |= node_starters.pop(old_can, set())

                from_node[letter] = merge
                node_starters[merge].add(letter)

        new_tn = new_node()
        to_node[letter] = new_tn

    for k in from_node:
        from_node[k] = find(from_node[k])
    for k in to_node:
        to_node[k] = find(to_node[k])

    return from_node, to_node, dummy_activities


def _forward_pass(
    activities: list[dict],
    from_node: dict[str, int],
    to_node: dict[str, int],
    levels: dict[str, int],
) -> dict[int, float]:
    all_nodes: set[int] = {_START_NODE}
    for a in activities:
        all_nodes.add(from_node[a["letter"]])
        all_nodes.add(to_node[a["letter"]])

    EET: dict[int, float] = {n: 0.0 for n in all_nodes}
    for a in sorted(activities, key=lambda a: (levels[a["letter"]], a["letter"])):
        letter = a["letter"]
        EET[to_node[letter]] = max(EET[to_node[letter]], EET[from_node[letter]] + a["duration"])
    return EET


def _backward_pass(
    activities: list[dict],
    from_node: dict[str, int],
    to_node: dict[str, int],
    levels: dict[str, int],
    EET: dict[int, float],
) -> dict[int, float]:
    project_duration = max(EET.values())
    LET: dict[int, float] = {n: project_duration for n in EET}
    for a in sorted(
        activities, key=lambda a: (levels[a["letter"]], a["letter"]), reverse=True
    ):
        letter = a["letter"]
        LET[from_node[letter]] = min(LET[from_node[letter]], LET[to_node[letter]] - a["duration"])
    return LET


def _schedule_activities(
    activities: list[dict],
    from_node: dict[str, int],
    to_node: dict[str, int],
    EET: dict[int, float],
    LET: dict[int, float],
) -> list[dict]:
    result = []
    for a in activities:
        letter = a["letter"]
        fn = from_node[letter]
        tn = to_node[letter]
        ES = EET[fn]
        EF = ES + a["duration"]
        LF = LET[tn]
        LS = LF - a["duration"]
        total_float = LS - ES
        free_float = EET[tn] - EF
        total_cost = a["duration"] * a["cost_per_day"]
        result.append(
            {
                "letter": letter,
                "description": a["description"],
                "from_node": fn,
                "to_node": tn,
                "duration": a["duration"],
                "cost_per_day": a["cost_per_day"],
                "total_cost": total_cost,
                "ES": ES,
                "EF": EF,
                "LS": LS,
                "LF": LF,
                "free_float": free_float,
                "total_float": total_float,
                "critical": total_float == 0,
            }
        )
    return result


def _compute_events(
    EET: dict[int, float],
    LET: dict[int, float],
) -> list[dict]:
    return [
        {
            "number": n,
            "EET": EET[n],
            "LET": LET[n],
            "slack": LET[n] - EET[n],
        }
        for n in sorted(EET.keys())
    ]


def _find_critical_paths(
    result_activities: list[dict],
    start_node: int,
    end_node: int,
) -> tuple[list[list[int]], list[float]]:
    crit_adj: dict[int, list[tuple[int, str]]] = defaultdict(list)
    for a in result_activities:
        if a["critical"]:
            crit_adj[a["from_node"]].append((a["to_node"], a["letter"]))

    critical_paths: list[list[int]] = []

    def dfs(node: int, path: list[int]) -> None:
        if node == end_node:
            critical_paths.append(list(path))
            return
        for next_n, _ in crit_adj.get(node, []):
            path.append(next_n)
            dfs(next_n, path)
            path.pop()

    dfs(start_node, [start_node])

    edge_cost: dict[tuple[int, int], float] = {
        (a["from_node"], a["to_node"]): a["total_cost"] for a in result_activities
    }
    cost_per_critical_path = [
        sum(edge_cost.get((path[i], path[i + 1]), 0.0) for i in range(len(path) - 1))
        for path in critical_paths
    ]
    return critical_paths, cost_per_critical_path


def validate_activities(activities: list[dict]) -> list[dict]:
    """Each error: {"letter": str | None, "field": str | None, "message": str}"""
    errors: list[dict] = []
    letters_seen: set[str] = set()

    def err(letter, field, message):
        errors.append({"letter": letter, "field": field, "message": message})

    for i, a in enumerate(activities):
        missing = _REQUIRED_KEYS - a.keys()
        raw_letter = a.get("letter")
        label = f"Activity '{raw_letter if isinstance(raw_letter, str) and raw_letter.strip() else f'#{i + 1}'}'"
        if missing:
            err(raw_letter if isinstance(raw_letter, str) else None, None,
                f"{label}: missing required fields: {', '.join(sorted(missing))}")
            continue

        letter = a["letter"]
        if not isinstance(letter, str) or not letter.strip():
            err(None, "letter", f"{label}: letter must be a non-empty string")
        elif letter in letters_seen:
            err(letter, "letter", f"{label}: duplicate letter")
        else:
            letters_seen.add(letter)

        resolved_letter = letter if isinstance(letter, str) and letter.strip() else None

        if not isinstance(a["description"], str) or not a["description"].strip():
            err(resolved_letter, "description", f"{label}: description is required")

        if not isinstance(a["prerequisites"], list):
            err(resolved_letter, "prerequisites", f"{label}: prerequisites must be a list")

        dur = a["duration"]
        if isinstance(dur, bool) or not isinstance(dur, int) or dur < 1:
            err(resolved_letter, "duration",
                f"{label}: duration must be a positive integer (minimum 1)")

        cpd = a["cost_per_day"]
        if isinstance(cpd, bool) or not isinstance(cpd, (int, float)) or cpd < 0:
            err(resolved_letter, "cost_per_day",
                f"{label}: cost_per_day must be a non-negative number")

    if errors:
        return errors

    letter_set = {a["letter"] for a in activities}
    for a in activities:
        for p in a["prerequisites"]:
            if p not in letter_set:
                err(a["letter"], "prerequisites",
                    f"Activity '{a['letter']}': prerequisite '{p}' does not exist")

    if errors:
        return errors

    in_degree: dict[str, int] = {a["letter"]: 0 for a in activities}
    children: dict[str, list[str]] = defaultdict(list)
    for a in activities:
        for p in a["prerequisites"]:
            in_degree[a["letter"]] += 1
            children[p].append(a["letter"])

    queue: deque[str] = deque(lt for lt, deg in in_degree.items() if deg == 0)
    remaining = dict(in_degree)
    visited: set[str] = set()
    while queue:
        lt = queue.popleft()
        visited.add(lt)
        for child in children[lt]:
            remaining[child] -= 1
            if remaining[child] == 0:
                queue.append(child)

    if len(visited) < len(activities):
        err(None, None,
            "Dependency graph contains a cycle — check prerequisites for circular references")

    return errors


def compute(activities: list[dict]) -> dict:
    if not activities:
        return {
            "activities": [],
            "events": [],
            "project": {
                "duration": 0,
                "total_cost": 0.0,
                "critical_paths": [],
                "cost_per_critical_path": [],
            },
        }

    errors = validate_activities(activities)
    if errors:
        raise ValueError("\n".join(e["message"] for e in errors))

    levels = _assign_levels(activities)
    from_node, to_node, dummy_acts = _assign_event_numbers(activities, levels)

    for d in dummy_acts:
        prereq = d["prerequisites"][0]
        levels[d["letter"]] = levels[prereq] + 1

    all_activities = activities + dummy_acts

    EET = _forward_pass(all_activities, from_node, to_node, levels)
    project_duration = max(EET.values())
    end_node = max(EET, key=lambda n: EET[n])
    LET = _backward_pass(all_activities, from_node, to_node, levels, EET)
    result_activities = _schedule_activities(all_activities, from_node, to_node, EET, LET)

    dummy_letters = {d["letter"] for d in dummy_acts}
    for ra in result_activities:
        ra["dummy"] = ra["letter"] in dummy_letters

    result_events = _compute_events(EET, LET)
    critical_paths, cost_per_critical_path = _find_critical_paths(
        result_activities, _START_NODE, end_node
    )
    total_cost = sum(a["total_cost"] for a in result_activities)

    return {
        "activities": result_activities,
        "events": result_events,
        "project": {
            "duration": project_duration,
            "total_cost": total_cost,
            "critical_paths": critical_paths,
            "cost_per_critical_path": cost_per_critical_path,
        },
    }
