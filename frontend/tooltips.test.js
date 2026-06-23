import { describe, it, expect } from 'vitest';
import { buildActivityTooltipHtml, buildEventTooltipHtml } from './tooltips.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeActivity(overrides = {}) {
    return {
        letter:       'A',
        description:  'Design phase',
        duration:     5,
        cost_per_day: 200,
        total_cost:   1000,
        ES: 0, EF: 5,
        LS: 0, LF: 5,
        free_float:   0,
        total_float:  0,
        critical:     true,
        dummy:        false,
        from_node:    1,
        to_node:      2,
        ...overrides,
    };
}

function makeEvent(overrides = {}) {
    return { number: 2, EET: 5, LET: 5, slack: 0, incoming: [], outgoing: [], ...overrides };
}

// ── buildActivityTooltipHtml ───────────────────────────────────────────────────

describe('buildActivityTooltipHtml', () => {
    it('contains the activity letter and description', () => {
        const html = buildActivityTooltipHtml(makeActivity());
        expect(html).toContain('A');
        expect(html).toContain('Design phase');
    });

    it('contains the duration', () => {
        const html = buildActivityTooltipHtml(makeActivity({ duration: 7 }));
        expect(html).toContain('7');
    });

    it('contains the cost per day', () => {
        const html = buildActivityTooltipHtml(makeActivity({ cost_per_day: 200 }));
        expect(html).toContain('200');
    });

    it('contains the total cost', () => {
        const html = buildActivityTooltipHtml(makeActivity({ total_cost: 1000 }));
        expect(html).toContain('1000');
    });

    it('contains ES and EF', () => {
        const html = buildActivityTooltipHtml(makeActivity({ ES: 3, EF: 8 }));
        expect(html).toContain('3');
        expect(html).toContain('8');
    });

    it('contains LS and LF', () => {
        const html = buildActivityTooltipHtml(makeActivity({ LS: 4, LF: 9 }));
        expect(html).toContain('4');
        expect(html).toContain('9');
    });

    it('contains free float', () => {
        const html = buildActivityTooltipHtml(makeActivity({ free_float: 2 }));
        expect(html).toContain('2');
    });

    it('contains total float', () => {
        const html = buildActivityTooltipHtml(makeActivity({ total_float: 3 }));
        expect(html).toContain('3');
    });

    it('shows critical flag as Yes for critical activity', () => {
        const html = buildActivityTooltipHtml(makeActivity({ critical: true }));
        expect(html).toMatch(/yes/i);
    });

    it('shows critical flag as No for non-critical activity', () => {
        const html = buildActivityTooltipHtml(makeActivity({ critical: false }));
        expect(html).toMatch(/no/i);
    });

    it('returns null for dummy activities', () => {
        const result = buildActivityTooltipHtml(makeActivity({ dummy: true }));
        expect(result).toBeNull();
    });
});

// ── buildEventTooltipHtml ──────────────────────────────────────────────────────

describe('buildEventTooltipHtml', () => {
    it('contains the event number', () => {
        const html = buildEventTooltipHtml(makeEvent({ number: 2 }));
        expect(html).toContain('2');
    });

    it('contains EET', () => {
        const html = buildEventTooltipHtml(makeEvent({ EET: 5 }));
        expect(html).toContain('5');
    });

    it('contains LET', () => {
        const html = buildEventTooltipHtml(makeEvent({ LET: 7 }));
        expect(html).toContain('7');
    });

    it('contains the slack value', () => {
        const html = buildEventTooltipHtml(makeEvent({ slack: 3 }));
        expect(html).toContain('3');
    });

    it('marks slack = 0 with a highlight class', () => {
        const html = buildEventTooltipHtml(makeEvent({ slack: 0 }));
        expect(html).toContain('critical');
    });

    it('does not mark slack > 0 with a highlight class', () => {
        const html = buildEventTooltipHtml(makeEvent({ slack: 2 }));
        expect(html).not.toMatch(/slack.*critical|critical.*slack/i);
    });

    it('lists incoming activities', () => {
        const html = buildEventTooltipHtml(makeEvent({ number: 2, incoming: ['A'] }));
        expect(html).toContain('A');
    });

    it('lists outgoing activities', () => {
        const html = buildEventTooltipHtml(makeEvent({ number: 2, outgoing: ['B'] }));
        expect(html).toContain('B');
    });
});
