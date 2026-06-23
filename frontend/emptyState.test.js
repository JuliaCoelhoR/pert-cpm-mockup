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

// ── B1: empty-state element lives above the table ──────────────────────────────

describe('empty-state message', () => {
    beforeEach(async () => {
        setupDOM();
        await loadApp();
    });

    it('is visible on initial load when there are no rows', () => {
        const el = document.getElementById('activities-empty');
        expect(el.classList.contains('hidden')).toBe(false);
    });

    it('is not rendered as a row inside <tbody>', () => {
        const tbody = document.getElementById('table-body');
        const emptyRow = tbody.querySelector('.row-empty-state');
        expect(emptyRow).toBeNull();
    });

    it('hides when the user types in the trailing row', () => {
        const input = document.getElementById('trail-description');
        input.value = 'D';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const el = document.getElementById('activities-empty');
        expect(el.classList.contains('hidden')).toBe(true);
    });

    it('reappears after the user clears the only draft row content', () => {
        const input = document.getElementById('trail-description');
        input.value = 'D';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        const el = document.getElementById('activities-empty');
        expect(el.classList.contains('hidden')).toBe(false);
    });
});
