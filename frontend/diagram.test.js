import { describe, it, expect } from 'vitest';
import { activityColor, getCriticalNodeIds, eventColor } from './diagram.js';

const RED   = '#c0392b';
const GREY  = '#7f8c8d';
const BLUE  = '#3a5a8c';

// ── activityColor ──────────────────────────────────────────────────────────────

describe('activityColor', () => {
    it('returns red for a critical activity', () => {
        const c = activityColor({ critical: true, dummy: false });
        expect(c.color).toBe(RED);
    });

    it('returns grey for a non-critical activity', () => {
        const c = activityColor({ critical: false, dummy: false });
        expect(c.color).toBe(GREY);
    });

    it('returns red for a critical dummy activity', () => {
        const c = activityColor({ critical: true, dummy: true });
        expect(c.color).toBe(RED);
    });

    it('returns grey for a non-critical dummy activity', () => {
        const c = activityColor({ critical: false, dummy: true });
        expect(c.color).toBe(GREY);
    });
});

// ── getCriticalNodeIds ─────────────────────────────────────────────────────────

describe('getCriticalNodeIds', () => {
    it('returns all node numbers from a single critical path', () => {
        const ids = getCriticalNodeIds([[1, 2, 3]]);
        expect(ids.has(1)).toBe(true);
        expect(ids.has(2)).toBe(true);
        expect(ids.has(3)).toBe(true);
    });

    it('returns the union of all node numbers across multiple tied paths', () => {
        const ids = getCriticalNodeIds([[1, 2, 4], [1, 3, 4]]);
        expect(ids.has(1)).toBe(true);
        expect(ids.has(2)).toBe(true);
        expect(ids.has(3)).toBe(true);
        expect(ids.has(4)).toBe(true);
    });
});

// ── eventColor ─────────────────────────────────────────────────────────────────

describe('eventColor', () => {
    it('returns a red border for a node on the critical path', () => {
        const c = eventColor(2, new Set([1, 2, 3]));
        expect(c.border).toBe(RED);
    });

    it('returns the default blue border for a non-critical node', () => {
        const c = eventColor(5, new Set([1, 2, 3]));
        expect(c.border).toBe(BLUE);
    });
});
