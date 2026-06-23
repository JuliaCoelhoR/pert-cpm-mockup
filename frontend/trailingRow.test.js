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
    `;
}

async function loadApp() {
    vi.resetModules();
    await import('./app.js');
}

function trailingRows() {
    return document.querySelectorAll('#table-body .row-trailing');
}

// ── B2: new empty trailing row on first keystroke ──────────────────────────────

describe('auto-append trailing row', () => {
    beforeEach(async () => {
        setupDOM();
        await loadApp();
    });

    it('starts with exactly one trailing row', () => {
        expect(trailingRows()).toHaveLength(1);
    });

    it('appends a second empty trailing row when the user starts typing in the first', () => {
        const input = document.getElementById('trail-description');
        input.value = 'D';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(trailingRows()).toHaveLength(2);
    });

    it('the new trailing row is empty', () => {
        const input = document.getElementById('trail-description');
        input.value = 'Design';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const newTrailingInputs = trailingRows()[1].querySelectorAll('input');
        newTrailingInputs.forEach(inp => {
            expect(inp.value).toBe('');
        });
    });

    it('typing in the second trailing row appends a third', () => {
        const first = document.getElementById('trail-description');
        first.value = 'A';
        first.dispatchEvent(new Event('input', { bubbles: true }));

        const secondTrailing = trailingRows()[1];
        const secondInput = secondTrailing.querySelector('input');
        secondInput.value = 'B';
        secondInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(trailingRows()).toHaveLength(3);
    });

    it('does not keep appending rows when the user continues typing in the same trailing row', () => {
        const input = document.getElementById('trail-description');
        input.value = 'D';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.value = 'De';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.value = 'Des';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(trailingRows()).toHaveLength(2);
    });
});
