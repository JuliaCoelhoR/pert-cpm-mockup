// ── Letter helpers ─────────────────────────────────────────────────────────────

export function getLetter(index) {
    if (index < 26) return String.fromCharCode(65 + index);
    return (
        String.fromCharCode(65 + Math.floor(index / 26) - 1) +
        String.fromCharCode(65 + (index % 26))
    );
}

// ── Field-level validation ─────────────────────────────────────────────────────

export function validateField(field, value, activeLetters) {
    switch (field) {
        case 'description':
            if (!value.trim()) return 'Description is required.';
            return null;

        case 'duration': {
            if (value.trim() === '') return 'Duration is required.';
            const n = Number(value);
            if (!Number.isInteger(n) || n < 1) return 'Duration must be a positive integer (≥ 1).';
            return null;
        }

        case 'costPerDay': {
            if (value.trim() === '') return null;
            const n = parseFloat(value);
            if (isNaN(n) || n < 0) return 'Cost/day must be a non-negative number.';
            return null;
        }

        case 'prerequisites': {
            const tokens = value.split(/[\s,]+/).filter(Boolean);
            if (tokens.length === 0) return null;
            const unknown = tokens.filter(t => !activeLetters.has(t.toUpperCase()));
            if (unknown.length > 0)
                return `Unknown prerequisite letter${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`;
            return null;
        }

        default:
            return null;
    }
}

// ── Row-level validation ───────────────────────────────────────────────────────

const VALIDATED_FIELDS = ['description', 'prerequisites', 'duration', 'costPerDay'];

export function validateAllRows(rows) {
    const activeLetters = new Set(rows.map(r => getLetter(r.letterIndex)));
    const errors = [];

    rows.forEach((row, index) => {
        for (const field of VALIDATED_FIELDS) {
            const msg = validateField(field, row[field], activeLetters);
            if (msg) errors.push({ index, field, msg });
        }
    });

    return errors;
}
