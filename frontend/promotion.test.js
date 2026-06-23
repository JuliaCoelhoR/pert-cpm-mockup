// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest';

// ── Helpers ────────────────────────────────────────────────────────────────────

function setupDOM() {
    document.body.innerHTML = `
        <div id="activities-empty" class="hidden">No activities yet — start typing to add one</div>
        <table id="activity-table">
            <thead><tr>
                <th>Letter</th><th>Description</th><th>Prerequisites</th>
                <th>Duration (days)</th><th>Cost/day (R$)</th><th></th>
            </tr></thead>
            <tbody id="table-body"></tbody>
        </table>
        <button id="btn-finished">Finished</button>
        <div id="error-banner" class="hidden"></div>
        <div id="diagram-section" class="hidden"></div>
        <div id="diagram-container"></div>
        <div id="summary-section" class="hidden"></div>
    `;
}

async function loadApp() {
    vi.resetModules();
    await import('./app.js');
}

function realRows() {
    return document.querySelectorAll('#table-body .row-real');
}

function trailingRows() {
    return document.querySelectorAll('#table-body .row-trailing');
}

async function clickFinished() {
    document.getElementById('btn-finished').click();
    await new Promise(r => setTimeout(r, 0));
}

// ── US-8: all-or-nothing promotion ─────────────────────────────────────────────

describe('Finished — all-or-nothing draft promotion (US-8)', () => {
    beforeEach(async () => {
        setupDOM();
        await loadApp();
    });

    it('does not promote a draft row that has invalid fields (empty description)', async () => {
        // Fill duration only — description is required, so this is invalid
        const durInput = document.getElementById('trail-duration');
        durInput.value = '5';
        durInput.dispatchEvent(new Event('input', { bubbles: true }));

        await clickFinished();

        // Draft must stay as a trailing row, never become a real row
        expect(realRows()).toHaveLength(0);
    });

    it('shows an error banner when Finished is clicked with an invalid draft', async () => {
        const durInput = document.getElementById('trail-duration');
        durInput.value = '5';
        durInput.dispatchEvent(new Event('input', { bubbles: true }));

        await clickFinished();

        const banner = document.getElementById('error-banner');
        expect(banner.classList.contains('hidden')).toBe(false);
    });

    it('promotes a valid draft to a real row on Finished', async () => {
        // Stub vis and fetch so the happy path completes
        global.vis = {
            DataSet: class { constructor() {} },
            Network: class { constructor() {} destroy() {} },
        };
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                activities: [],
                events: [],
                project: {
                    critical_paths: [],
                    total_activities: 0,
                    critical_activities: 0,
                    total_nodes: 0,
                    minimal_duration: 0,
                    total_cost: 0,
                    cost_per_critical_path: [],
                },
            }),
        });

        const descInput = document.getElementById('trail-description');
        descInput.value = 'Design';
        descInput.dispatchEvent(new Event('input', { bubbles: true }));

        const durInput = document.getElementById('trail-duration');
        durInput.value = '3';
        durInput.dispatchEvent(new Event('input', { bubbles: true }));

        await clickFinished();

        expect(realRows()).toHaveLength(1);
        // Trailing area resets to a single empty cursor row
        expect(trailingRows()).toHaveLength(1);

        delete global.vis;
        delete global.fetch;
    });
});
