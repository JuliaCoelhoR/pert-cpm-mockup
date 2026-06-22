// ── State ──────────────────────────────────────────────────────────────────────

/** @type {Array<{letterIndex: number, description: string, prerequisites: string, duration: string, costPerDay: string}>} */
let rows = [];
let nextLetterIndex = 0;
let draftRow = { description: '', prerequisites: '', duration: '', costPerDay: '' };
/** @type {import('vis-network').Network | null} */
let network = null;

// ── Utilities ──────────────────────────────────────────────────────────────────

function getLetter(index) {
    if (index < 26) return String.fromCharCode(65 + index);
    return (
        String.fromCharCode(65 + Math.floor(index / 26) - 1) +
        String.fromCharCode(65 + (index % 26))
    );
}

function getActiveLetters() {
    return new Set(rows.map(r => getLetter(r.letterIndex)));
}

// ── Table rendering ────────────────────────────────────────────────────────────

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    if (rows.length === 0) {
        const tr = document.createElement('tr');
        tr.className = 'row-empty-state';
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'cell-empty-state';
        td.textContent = 'No activities yet — start typing to add one';
        tr.appendChild(td);
        tbody.appendChild(tr);
    } else {
        rows.forEach((row, index) => tbody.appendChild(buildRealRow(row, index)));
    }

    tbody.appendChild(buildTrailingRow());
}

function buildRealRow(row, index) {
    const letter = getLetter(row.letterIndex);
    const tr = document.createElement('tr');
    tr.className = 'row-real';

    const tdLetter = document.createElement('td');
    tdLetter.className = 'cell-letter';
    tdLetter.textContent = letter;
    tr.appendChild(tdLetter);

    const fieldDefs = [
        { field: 'description',  type: 'text',   placeholder: 'Description' },
        { field: 'prerequisites', type: 'text',  placeholder: 'e.g. A, C'  },
        { field: 'duration',     type: 'number', placeholder: '1',   min: '1',  step: '1'    },
        { field: 'costPerDay',   type: 'number', placeholder: '0.00', min: '0', step: '0.01' },
    ];

    fieldDefs.forEach(({ field, type, placeholder, min, step }) => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = type;
        input.className = 'cell-input';
        input.dataset.field = field;
        input.dataset.index = String(index);
        input.placeholder = placeholder;
        input.value = row[field];
        if (min  !== undefined) input.min  = min;
        if (step !== undefined) input.step = step;
        input.addEventListener('input', () => {
            rows[index][field] = input.value;
            clearError(input);
        });
        input.addEventListener('blur', () => {
            const error = validateField(field, input.value, row);
            if (error) {
                input.classList.add('cell-error');
                input.title = error;
            } else {
                input.classList.remove('cell-error');
                input.title = '';
            }
        });
        td.appendChild(input);
        tr.appendChild(td);
    });

    const tdDel = document.createElement('td');
    const btn = document.createElement('button');
    btn.className = 'btn-delete';
    btn.title = `Delete activity ${letter}`;
    btn.innerHTML = '&#x1F5D1;&#xFE0E;';
    btn.addEventListener('click', () => deleteRow(index));
    tdDel.appendChild(btn);
    tr.appendChild(tdDel);

    return tr;
}

function buildTrailingRow() {
    const tr = document.createElement('tr');
    tr.className = 'row-trailing';

    const tdLetter = document.createElement('td');
    tdLetter.className = 'cell-letter cell-letter-dim';
    tdLetter.textContent = getLetter(nextLetterIndex);
    tr.appendChild(tdLetter);

    const trailDefs = [
        { id: 'trail-description',   field: 'description',   type: 'text',   placeholder: 'New activity…' },
        { id: 'trail-prerequisites', field: 'prerequisites',  type: 'text',   placeholder: 'e.g. A, C'    },
        { id: 'trail-duration',      field: 'duration',       type: 'number', placeholder: '1',    min: '1',  step: '1'    },
        { id: 'trail-cost',          field: 'costPerDay',     type: 'number', placeholder: '0.00', min: '0',  step: '0.01' },
    ];

    trailDefs.forEach(({ id, field, type, placeholder, min, step }) => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.className = 'cell-input cell-input-trail';
        input.placeholder = placeholder;
        input.value = draftRow[field];
        if (min  !== undefined) input.min  = min;
        if (step !== undefined) input.step = step;
        input.addEventListener('input', () => { draftRow[field] = input.value; });
        td.appendChild(input);
        tr.appendChild(td);
    });

    tr.appendChild(document.createElement('td'));
    return tr;
}

// ── Row actions ────────────────────────────────────────────────────────────────

function flushDraft() {
    const { description, prerequisites, duration, costPerDay } = draftRow;
    if (!description && !prerequisites && !duration && !costPerDay) return;
    rows.push({ letterIndex: nextLetterIndex++, description, prerequisites, duration, costPerDay });
    draftRow = { description: '', prerequisites: '', duration: '', costPerDay: '' };
}

function deleteRow(index) {
    const letter = getLetter(rows[index].letterIndex);

    const danglingLetters = rows
        .filter((_, i) => i !== index)
        .filter(r =>
            r.prerequisites
                .split(',')
                .map(p => p.trim())
                .filter(Boolean)
                .includes(letter)
        )
        .map(r => getLetter(r.letterIndex));

    if (danglingLetters.length > 0) {
        const affected = danglingLetters.join(', ');
        const ok = window.confirm(
            `Deleting activity "${letter}" will leave dangling prerequisite references in: ${affected}.\n\n` +
            `Are you sure you want to continue?`
        );
        if (!ok) return;
    }

    rows.splice(index, 1);
    if (rows.length === 0) {
        draftRow = { description: '', prerequisites: '', duration: '', costPerDay: '' };
    }
    renderTable();
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateField(field, value, _row) {
    switch (field) {
        case 'description': {
            if (!value.trim()) return 'Description is required.';
            return null;
        }
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
            const active = getActiveLetters();
            const unknown = tokens.filter(t => !active.has(t.toUpperCase()));
            if (unknown.length > 0) {
                return `Unknown prerequisite letter${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}.`;
            }
            return null;
        }
        default:
            return null;
    }
}

function mapValidationErrors(backendErrors) {
    const fieldErrors = [];
    const bannerMsgs  = [];

    const fieldMap = {
        description:   'description',
        duration:      'duration',
        cost_per_day:  'costPerDay',
        prerequisites: 'prerequisites',
        letter:        null,
    };

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

function applyErrors(errors) {
    document.querySelectorAll('.cell-input.cell-error').forEach(el => el.classList.remove('cell-error'));

    errors.forEach(({ index, field }) => {
        const input = document.querySelector(`[data-field="${field}"][data-index="${index}"]`);
        if (input) input.classList.add('cell-error');
    });

    const banner = document.getElementById('error-banner');
    if (errors.length > 0) {
        banner.textContent =
            `${errors.length} validation error${errors.length !== 1 ? 's' : ''} — ` +
            `fix the highlighted cells and click Finished again.`;
        banner.classList.remove('hidden');
        document.querySelector('.cell-input.cell-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        banner.classList.add('hidden');
    }
}

function clearError(input) {
    input.classList.remove('cell-error');
    input.title = '';
}

// ── Finished ───────────────────────────────────────────────────────────────────

function showBanner(msg) {
    const banner = document.getElementById('error-banner');
    banner.textContent = msg;
    banner.classList.remove('hidden');
}

async function handleFinished() {
    flushDraft();

    if (rows.length === 0) {
        showBanner('Add at least one activity before clicking Finished.');
        return;
    }

    renderTable();
    applyErrors([]);

    const payload = rows.map(row => ({
        letter:        getLetter(row.letterIndex),
        description:   row.description.trim(),
        prerequisites: row.prerequisites.split(',').map(p => p.trim()).filter(Boolean),
        duration:      Number(row.duration),
        cost_per_day:  row.costPerDay === '' ? 0 : parseFloat(row.costPerDay),
    }));

    let data;
    try {
        const res = await fetch('/api/compute', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });

        if (!res.ok) {
            let body = null;
            try { body = await res.json(); } catch { /* non-JSON body */ }

            if (res.status === 422 && body !== null) {
                const { fieldErrors, bannerMsgs } = mapValidationErrors(body.errors ?? []);
                if (fieldErrors.length > 0) {
                    applyErrors(fieldErrors);
                    if (bannerMsgs.length > 0) {
                        const banner = document.getElementById('error-banner');
                        banner.textContent += ' ' + bannerMsgs.join(' · ');
                    }
                    return;
                }
                if (bannerMsgs.length > 0) {
                    showBanner(bannerMsgs.join(' · '));
                    return;
                }
            }

            const msg = body?.errors?.map?.(e => e.message ?? e).join(' · ')
                ?? body?.error
                ?? `Server error (HTTP ${res.status}) — please try again.`;
            showBanner(msg);
            return;
        }

        data = await res.json();
    } catch {
        showBanner('Could not reach the server — please try again.');
        return;
    }

    try {
        renderDiagram(data);
    } catch {
        showBanner('Failed to render the diagram — please reload the page.');
    }
}

// ── Diagram ────────────────────────────────────────────────────────────────────

function renderDiagram(data) {
    const section = document.getElementById('diagram-section');
    const wasHidden = section.classList.contains('hidden');
    section.classList.remove('hidden');

    const visNodes = new vis.DataSet(
        data.events.map(ev => ({
            id:    ev.number,
            label: String(ev.number),
            shape: 'circle',
            size:  22,
            color: {
                background: '#ffffff',
                border:     '#3a5a8c',
                highlight:  { background: '#ffffff', border: '#3a5a8c' },
                hover:      { background: '#f0f4fa', border: '#3a5a8c' },
            },
            font:        { color: '#2c2c2c', size: 14, face: 'system-ui, sans-serif' },
            borderWidth: 2,
        }))
    );

    const visEdges = new vis.DataSet(
        data.activities.map((act, i) => ({
            id:     i,
            from:   act.from_node,
            to:     act.to_node,
            label:  act.dummy ? '' : `${act.letter}\n${act.duration}d`,
            dashes: act.dummy,
            color:  { color: '#7f8c8d', highlight: '#7f8c8d', hover: '#7f8c8d' },
            font: {
                color:       '#2c2c2c',
                size:        12,
                align:       'horizontal',
                strokeWidth: 3,
                strokeColor: '#ffffff',
                face:        'system-ui, sans-serif',
            },
            arrows: { to: { enabled: true, scaleFactor: 0.8 } },
            width:  2,
            smooth: false,
        }))
    );

    const options = {
        layout: {
            hierarchical: {
                enabled:        true,
                direction:      'LR',
                sortMethod:     'directed',
                levelSeparation: 160,
                nodeSpacing:    100,
                treeSpacing:    180,
            },
        },
        interaction: {
            dragNodes: false,
            dragView:  true,
            zoomView:  true,
            hover:     false,
        },
        physics: { enabled: false },
    };

    if (network) network.destroy();
    network = new vis.Network(
        document.getElementById('diagram-container'),
        { nodes: visNodes, edges: visEdges },
        options
    );

    if (wasHidden) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

document.getElementById('btn-finished').addEventListener('click', handleFinished);
renderTable();
