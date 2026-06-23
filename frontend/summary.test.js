import { describe, it, expect } from 'vitest';
import {
    buildCriticalPathsHtml,
    buildProjectStatsHtml,
    buildActivityTableHtml,
} from './summary.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeActivity(overrides = {}) {
    return {
        letter:      'A',
        description: 'Design phase',
        from_node:   1,
        to_node:     2,
        duration:    5,
        cost_per_day: 200,
        total_cost:  1000,
        ES: 0, EF: 5,
        LS: 0, LF: 5,
        free_float:  0,
        total_float: 0,
        critical:    true,
        dummy:       false,
        ...overrides,
    };
}

function makeProject(overrides = {}) {
    return {
        duration:              10,
        total_cost:            5000,
        critical_paths:        [[1, 3, 5]],
        cost_per_critical_path: [5000],
        ...overrides,
    };
}

function makeData(overrides = {}) {
    return {
        activities: [makeActivity()],
        events:     [{ number: 1, EET: 0, LET: 0, slack: 0 },
                     { number: 2, EET: 5, LET: 5, slack: 0 }],
        project:    makeProject(),
        ...overrides,
    };
}

// ── buildCriticalPathsHtml ────────────────────────────────────────────────────

describe('buildCriticalPathsHtml', () => {
    it('renders a single path as arrow-separated node sequence', () => {
        const html = buildCriticalPathsHtml(makeProject({ critical_paths: [[1, 3, 5]] }));
        expect(html).toContain('1');
        expect(html).toContain('3');
        expect(html).toContain('5');
        expect(html).toContain('→');
    });

    it('renders multiple paths as separate rows', () => {
        const html = buildCriticalPathsHtml(makeProject({
            critical_paths:        [[1, 3, 5], [1, 2, 5]],
            cost_per_critical_path: [5000, 4800],
        }));
        const matches = [...html.matchAll(/1.*?→.*?5/gs)];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });
});

// ── buildProjectStatsHtml ─────────────────────────────────────────────────────

describe('buildProjectStatsHtml', () => {
    it('shows total activities count (non-dummy)', () => {
        const data = makeData({
            activities: [
                makeActivity({ letter: 'A', dummy: false }),
                makeActivity({ letter: 'B', dummy: false }),
                makeActivity({ letter: 'D', dummy: true }),
            ],
        });
        const html = buildProjectStatsHtml(data);
        expect(html).toContain('2');
    });

    it('shows critical activities count (non-dummy, critical)', () => {
        const data = makeData({
            activities: [
                makeActivity({ letter: 'A', dummy: false, critical: true }),
                makeActivity({ letter: 'B', dummy: false, critical: false }),
                makeActivity({ letter: 'D', dummy: true,  critical: true }),
            ],
        });
        const html = buildProjectStatsHtml(data);
        expect(html).toContain('1');
    });

    it('shows total nodes count', () => {
        const data = makeData({
            events: [
                { number: 1, EET: 0, LET: 0, slack: 0 },
                { number: 2, EET: 3, LET: 3, slack: 0 },
                { number: 3, EET: 7, LET: 7, slack: 0 },
            ],
        });
        const html = buildProjectStatsHtml(data);
        expect(html).toContain('3');
    });

    it('shows project duration', () => {
        const data = makeData({ project: makeProject({ duration: 42 }) });
        const html = buildProjectStatsHtml(data);
        expect(html).toContain('42');
    });

    it('shows total cost', () => {
        const data = makeData({ project: makeProject({ total_cost: 9999 }) });
        const html = buildProjectStatsHtml(data);
        expect(html).toContain('9999');
    });

    it('shows one cost-per-path entry for each critical path', () => {
        const data = makeData({
            project: makeProject({
                critical_paths:        [[1, 3, 5], [1, 2, 5]],
                cost_per_critical_path: [5000, 4800],
            }),
        });
        const html = buildProjectStatsHtml(data);
        expect(html).toContain('5000');
        expect(html).toContain('4800');
    });
});

// ── buildActivityTableHtml ────────────────────────────────────────────────────

describe('buildActivityTableHtml', () => {
    const EXPECTED_COLUMNS = [
        'Letter', 'Description', 'From Node', 'To Node',
        'Duration', 'Cost/day', 'Total Cost',
        'ES', 'EF', 'LS', 'LF',
        'Free Float', 'Total Float', 'Critical',
    ];

    it('has all 14 column headers', () => {
        const html = buildActivityTableHtml([makeActivity()]);
        for (const col of EXPECTED_COLUMNS) {
            expect(html).toContain(col);
        }
    });

    it('excludes dummy activities', () => {
        const html = buildActivityTableHtml([
            makeActivity({ letter: 'A', dummy: false }),
            makeActivity({ letter: 'B', dummy: true }),
        ]);
        expect(html).toContain('A');
        expect(html).not.toContain('>B<');
    });

    it('gives critical rows a distinguishing CSS class', () => {
        const html = buildActivityTableHtml([
            makeActivity({ letter: 'A', critical: true }),
        ]);
        expect(html).toMatch(/class="[^"]*row-critical[^"]*"/);
    });

    it('does not give non-critical rows the critical CSS class', () => {
        const html = buildActivityTableHtml([
            makeActivity({ letter: 'A', critical: false }),
        ]);
        expect(html).not.toMatch(/class="[^"]*row-critical[^"]*"/);
    });

    it('shows correct field values for a row', () => {
        const act = makeActivity({
            letter: 'C', description: 'Build phase',
            from_node: 2, to_node: 4,
            duration: 7, cost_per_day: 300, total_cost: 2100,
            ES: 1, EF: 8, LS: 1, LF: 8,
            free_float: 0, total_float: 0, critical: true,
        });
        const html = buildActivityTableHtml([act]);
        expect(html).toContain('C');
        expect(html).toContain('Build phase');
        expect(html).toContain('2');
        expect(html).toContain('4');
        expect(html).toContain('7');
        expect(html).toContain('300');
        expect(html).toContain('2100');
    });
});
