import { describe, it, expect } from 'vitest';
import { parseTabPaste } from './paste.js';

// Column order per spec: Description, Prerequisites, Duration, Cost/day

describe('parseTabPaste', () => {
    it('returns empty array for empty string', () => {
        expect(parseTabPaste('')).toEqual([]);
    });

    it('parses a single 4-column row', () => {
        const result = parseTabPaste('Design\t\t3\t100');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            description:   'Design',
            prerequisites: '',
            duration:      '3',
            costPerDay:    '100',
        });
    });

    it('parses multiple rows separated by newline', () => {
        const result = parseTabPaste('Design\t\t3\t100\nBuild\tA\t5\t200');
        expect(result).toHaveLength(2);
        expect(result[0].description).toBe('Design');
        expect(result[1].description).toBe('Build');
        expect(result[1].prerequisites).toBe('A');
    });

    it('ignores extra columns beyond the fourth', () => {
        const result = parseTabPaste('Design\t\t3\t100\textra\tcol');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            description:   'Design',
            prerequisites: '',
            duration:      '3',
            costPerDay:    '100',
        });
    });

    it('fills missing trailing columns with empty string', () => {
        const result = parseTabPaste('Design\tA');
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            description:   'Design',
            prerequisites: 'A',
            duration:      '',
            costPerDay:    '',
        });
    });

    it('handles Windows-style CRLF line endings', () => {
        const result = parseTabPaste('Design\t\t3\t100\r\nBuild\tA\t5\t200');
        expect(result).toHaveLength(2);
    });

    it('skips rows that are entirely empty', () => {
        const result = parseTabPaste('Design\t\t3\t100\n\nBuild\tA\t5\t200');
        expect(result).toHaveLength(2);
    });
});
