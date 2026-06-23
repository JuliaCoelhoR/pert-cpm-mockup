const RED  = '#c0392b';
const GREY = '#7f8c8d';
const BLUE = '#3a5a8c';

export function activityColor(activity) {
    const c = activity.critical ? RED : GREY;
    return { color: c, highlight: c, hover: c };
}

export function getCriticalNodeIds(criticalPaths) {
    const ids = new Set();
    for (const path of criticalPaths) {
        for (const id of path) ids.add(id);
    }
    return ids;
}

export function eventColor(eventNumber, criticalNodeIds) {
    const border = criticalNodeIds.has(eventNumber) ? RED : BLUE;
    return {
        background: '#ffffff',
        border,
        highlight: { background: '#ffffff', border },
        hover:     { background: '#f0f4fa', border },
    };
}
