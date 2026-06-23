import { getLetter } from './validation.js';

const fieldMap = {
    description:   'description',
    duration:      'duration',
    cost_per_day:  'costPerDay',
    prerequisites: 'prerequisites',
    letter:        null,
};

export function mapValidationErrors(backendErrors, rows) {
    const fieldErrors = [];
    const bannerMsgs  = [];

    backendErrors.forEach(e => {
        if (!e.letter || !e.field) {
            bannerMsgs.push(e.message);
            return;
        }
        const frontendField = fieldMap[e.field];
        if (frontendField === undefined) {
            console.warn(`mapValidationErrors: unrecognised backend field "${e.field}", falling back to banner`);
            bannerMsgs.push(e.message);
            return;
        }
        if (frontendField === null) {
            // Intentional: no editable cell for this field (e.g. "letter")
            bannerMsgs.push(e.message);
            return;
        }
        const index = rows.findIndex(r => getLetter(r.letterIndex) === e.letter);
        if (index === -1) {
            bannerMsgs.push(e.message);
            return;
        }
        fieldErrors.push({ index, field: frontendField, msg: e.message });
    });

    return { fieldErrors, bannerMsgs };
}
