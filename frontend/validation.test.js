import { describe, it, expect } from 'vitest';
import { validateAllRows } from './validation.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeRow(overrides = {}) {
    return {
        letterIndex:   0,
        description:   'Task A',
        prerequisites: '',
        duration:      '3',
        costPerDay:    '100',
        ...overrides,
    };
}

// ── validateAllRows ────────────────────────────────────────────────────────────

describe('validateAllRows', () => {
    it('returns empty array for zero rows', () => {
        expect(validateAllRows([])).toEqual([]);
    });

    it('returns empty array when all rows are valid', () => {
        const rows = [
            makeRow({ letterIndex: 0, description: 'Design',  prerequisites: '',  duration: '3', costPerDay: '100' }),
            makeRow({ letterIndex: 1, description: 'Build',   prerequisites: 'A', duration: '5', costPerDay: '200' }),
        ];
        expect(validateAllRows(rows)).toEqual([]);
    });

    it('returns an error for a row with empty description', () => {
        const rows = [makeRow({ description: '' })];
        const errors = validateAllRows(rows);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ index: 0, field: 'description' });
    });

    it('returns an error for a row with duration zero', () => {
        const rows = [makeRow({ duration: '0' })];
        const errors = validateAllRows(rows);
        expect(errors.some(e => e.field === 'duration')).toBe(true);
    });

    it('returns an error for a row with non-integer duration', () => {
        const rows = [makeRow({ duration: '2.5' })];
        const errors = validateAllRows(rows);
        expect(errors.some(e => e.field === 'duration')).toBe(true);
    });

    it('returns an error for a row with negative cost/day', () => {
        const rows = [makeRow({ costPerDay: '-1' })];
        const errors = validateAllRows(rows);
        expect(errors.some(e => e.field === 'costPerDay')).toBe(true);
    });

    it('accepts cost/day of zero', () => {
        const rows = [makeRow({ costPerDay: '0' })];
        expect(validateAllRows(rows)).toEqual([]);
    });

    it('accepts empty cost/day (optional field)', () => {
        const rows = [makeRow({ costPerDay: '' })];
        expect(validateAllRows(rows)).toEqual([]);
    });

    it('accepts empty prerequisites (optional field)', () => {
        const rows = [makeRow({ prerequisites: '' })];
        expect(validateAllRows(rows)).toEqual([]);
    });

    it('returns an error when a prerequisite letter does not exist in the row list', () => {
        const rows = [makeRow({ prerequisites: 'Z' })];
        const errors = validateAllRows(rows);
        expect(errors.some(e => e.field === 'prerequisites')).toBe(true);
    });

    it('accepts a prerequisite that refers to another row in the list', () => {
        const rows = [
            makeRow({ letterIndex: 0, description: 'Design', prerequisites: '' }),
            makeRow({ letterIndex: 1, description: 'Build',  prerequisites: 'A' }),
        ];
        expect(validateAllRows(rows)).toEqual([]);
    });

    it('collects errors from all invalid rows, not just the first', () => {
        const rows = [
            makeRow({ description: '' }),
            makeRow({ letterIndex: 1, description: '', duration: '0' }),
        ];
        const errors = validateAllRows(rows);
        const row0Errors = errors.filter(e => e.index === 0);
        const row1Errors = errors.filter(e => e.index === 1);
        expect(row0Errors.length).toBeGreaterThan(0);
        expect(row1Errors.length).toBeGreaterThan(0);
    });
});
