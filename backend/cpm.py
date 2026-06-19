"""Pure CPM computation module — no HTTP, no Flask, no UI.

Limitation: this module does not insert dummy activities. AOA networks where
two activities share a predecessor but NOT all predecessors (e.g. E dep[B] and
F dep[B,C]) cannot be represented correctly without dummies. Such networks will
produce incorrect scheduling values. This is a known out-of-scope item per the
project PRD.
"""
from __future__ import annotations

from collections import defaultdict, deque


def compute(activities: list[dict]) -> dict:
    """
    Compute full CPM scheduling for an AOA network.

    activities: list of dicts with keys:
        letter, description, prerequisites, duration, cost_per_day
    """
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

    # --- topological sort to assign levels ---
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

    # --- assign event numbers ---
    # Start event = 1
    START_NODE = 1
    next_node = [2]

    def new_node() -> int:
        n = next_node[0]
        next_node[0] += 1
        return n

    # from_node: activities with no prerequisites share the start node.
    # activities with prerequisites: if single predecessor, from_node = predecessor's to_node;
    # if multiple predecessors, create a merge node (max to_node of preds, or new node).
    to_node: dict[str, int] = {}
    from_node: dict[str, int] = {}

    sorted_letters = sorted(activities, key=lambda a: (level[a["letter"]], a["letter"]))

    for a in sorted_letters:
        letter = a["letter"]
        prereqs = a["prerequisites"]
        if not prereqs:
            from_node[letter] = START_NODE
        elif len(prereqs) == 1:
            from_node[letter] = to_node[prereqs[0]]
        else:
            pred_to_nodes = [to_node[p] for p in prereqs]
            unique = set(pred_to_nodes)
            if len(unique) == 1:
                from_node[letter] = unique.pop()
            else:
                # create a merge node; all pred to_nodes become this merge node
                merge = new_node()
                # re-map predecessor to_nodes to merge
                for p in prereqs:
                    old = to_node[p]
                    # update all activities whose to_node == old to use merge instead
                    for letter2, tn in to_node.items():
                        if tn == old:
                            to_node[letter2] = merge
                    # also update from_nodes already assigned
                    for letter2, fn in from_node.items():
                        if fn == old:
                            from_node[letter2] = merge
                    to_node[p] = merge
                from_node[letter] = merge
        to_node[letter] = new_node()

    # --- collect all events ---
    all_nodes = {START_NODE}
    for letter in [a["letter"] for a in activities]:
        all_nodes.add(from_node[letter])
        all_nodes.add(to_node[letter])

    # --- forward pass: EET ---
    EET: dict[int, float] = {n: 0.0 for n in all_nodes}
    for a in sorted_letters:
        letter = a["letter"]
        fn = from_node[letter]
        tn = to_node[letter]
        EET[tn] = max(EET[tn], EET[fn] + a["duration"])

    project_duration = max(EET.values())
    end_node = max(EET, key=lambda n: EET[n])

    # --- backward pass: LET ---
    LET: dict[int, float] = {n: project_duration for n in all_nodes}
    # reverse topological order
    for a in reversed(sorted_letters):
        letter = a["letter"]
        fn = from_node[letter]
        tn = to_node[letter]
        LET[fn] = min(LET[fn], LET[tn] - a["duration"])

    # --- per-activity scheduling values ---
    result_activities = []
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
        result_activities.append(
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

    # --- per-event values ---
    result_events = []
    for n in sorted(all_nodes):
        result_events.append(
            {
                "number": n,
                "EET": EET[n],
                "LET": LET[n],
                "slack": LET[n] - EET[n],
            }
        )

    # --- critical paths (node sequences from start to end) ---
    # build adjacency: node -> list of (to_node, letter) for critical activities
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

    dfs(START_NODE, [START_NODE])

    # --- cost per critical path ---
    # map (from_node, to_node) -> total_cost for quick lookup
    edge_cost: dict[tuple[int, int], float] = {}
    for a in result_activities:
        edge_cost[(a["from_node"], a["to_node"])] = a["total_cost"]

    cost_per_critical_path: list[float] = []
    for path in critical_paths:
        c = sum(edge_cost.get((path[i], path[i + 1]), 0.0) for i in range(len(path) - 1))
        cost_per_critical_path.append(c)

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
