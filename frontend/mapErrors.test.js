import { describe, it, expect } from 'vitest';
import { mapValidationErrors } from './mapErrors.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeRow(letterIndex, overrides = {}) {
    return { letterIndex, description: 'Task', prerequisites: '', duration: '3', costPerDay: '100', ...overrides };
}

// ── mapValidationErrors ────────────────────────────────────────────────────────

describe('mapValidationErrors', () => {
    it('returns empty arrays for an empty error list', () => {
        expect(mapValidationErrors([], [])).toEqual({ fieldErrors: [], bannerMsgs: [] });
    });

    it('puts a global error (no letter or field) into bannerMsgs', () => {
        const errors = [{ message: 'Graph has a cycle.' }];
        const { fieldErrors, bannerMsgs } = mapValidationErrors(errors, []);
        expect(fieldErrors).toEqual([]);
        expect(bannerMsgs).toEqual(['Graph has a cycle.']);
    });

    it('maps a known field error to fieldErrors with the correct row index and frontend field name', () => {
        const rows = [makeRow(0), makeRow(1)];
        const errors = [{ letter: 'B', field: 'duration', message: 'Duration must be a positive integer.' }];
        const { fieldErrors, bannerMsgs } = mapValidationErrors(errors, rows);
        expect(bannerMsgs).toEqual([]);
        expect(fieldErrors).toEqual([{ index: 1, field: 'duration', msg: 'Duration must be a positive integer.' }]);
    });

    it('puts a "letter" field error into bannerMsgs (no editable cell for letter)', () => {
        const rows = [makeRow(0)];
        const errors = [{ letter: 'A', field: 'letter', message: 'Letter must be unique.' }];
        const { fieldErrors, bannerMsgs } = mapValidationErrors(errors, rows);
        expect(fieldErrors).toEqual([]);
        expect(bannerMsgs).toEqual(['Letter must be unique.']);
    });

    it('puts an unrecognised backend field into bannerMsgs', () => {
        const rows = [makeRow(0)];
        const errors = [{ letter: 'A', field: 'unknown_field', message: 'Something went wrong.' }];
        const { fieldErrors, bannerMsgs } = mapValidationErrors(errors, rows);
        expect(fieldErrors).toEqual([]);
        expect(bannerMsgs).toEqual(['Something went wrong.']);
    });

    it('puts an error whose activity letter is absent from rows into bannerMsgs', () => {
        const rows = [makeRow(0)]; // only row A
        const errors = [{ letter: 'Z', field: 'description', message: 'Description is required.' }];
        const { fieldErrors, bannerMsgs } = mapValidationErrors(errors, rows);
        expect(fieldErrors).toEqual([]);
        expect(bannerMsgs).toEqual(['Description is required.']);
    });

    it('correctly partitions a mix of field errors and banner messages', () => {
        const rows = [makeRow(0), makeRow(1)];
        const errors = [
            { letter: 'A', field: 'description', message: 'Description is required.' },
            { message: 'Graph has a cycle.' },
            { letter: 'B', field: 'cost_per_day', message: 'Cost/day must be non-negative.' },
            { letter: 'A', field: 'letter', message: 'Letter must be unique.' },
        ];
        const { fieldErrors, bannerMsgs } = mapValidationErrors(errors, rows);
        expect(fieldErrors).toEqual([
            { index: 0, field: 'description', msg: 'Description is required.' },
            { index: 1, field: 'costPerDay',  msg: 'Cost/day must be non-negative.' },
        ]);
        expect(bannerMsgs).toEqual(['Graph has a cycle.', 'Letter must be unique.']);
    });
});
