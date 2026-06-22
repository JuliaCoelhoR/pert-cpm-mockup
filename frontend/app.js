// ── State ──────────────────────────────────────────────────────────────────────

/** @type {Array<{letterIndex: number, description: string, prerequisites: string, duration: string, costPerDay: string}>} */
let rows = [];
let nextLetterIndex = 0;
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
        if (min  !== undefined) input.min  = min;
        if (step !== undefined) input.step = step;
        input.addEventListener('input', () => promoteTrailingRow(field));
        td.appendChild(input);
        tr.appendChild(td);
    });

    tr.appendChild(document.createElement('td'));
    return tr;
}

// ── Row actions ────────────────────────────────────────────────────────────────

function promoteTrailingRow(triggerField) {
    const description   = document.getElementById('trail-description')?.value   ?? '';
    const prerequisites = document.getElementById('trail-prerequisites')?.value ?? '';
    const duration      = document.getElementById('trail-duration')?.value      ?? '';
    const costPerDay    = document.getElementById('trail-cost')?.value          ?? '';

    if (!description && !prerequisites && !duration && !costPerDay) return;

    const promotedIndex = rows.length;
    rows.push({ letterIndex: nextLetterIndex++, description, prerequisites, duration, costPerDay });

    renderTable();

    // Re-focus the exact field the user was typing in
    const target = document.querySelector(`[data-field="${triggerField}"][data-index="${promotedIndex}"]`);
    if (target) {
        target.focus();
        if (target.value) target.setSelectionRange(target.value.length, target.value.length);
    }
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
    renderTable();
}

// ── Validation ─────────────────────────────────────────────────────────────────

function validateRows() {
    const errors = [];
    const activeLetters = getActiveLetters();

    rows.forEach((row, index) => {
        const label = getLetter(row.letterIndex);

        if (!row.description.trim()) {
            errors.push({ index, field: 'description', msg: `${label}: description is required` });
        }

        if (row.duration === '' || row.duration === null || row.duration === undefined) {
            errors.push({ index, field: 'duration', msg: `${label}: duration is required` });
        } else {
            const d = Number(row.duration);
            if (!Number.isInteger(d) || d < 1) {
                errors.push({ index, field: 'duration', msg: `${label}: duration must be a positive integer (minimum 1)` });
            }
        }

        if (row.costPerDay !== '' && row.costPerDay !== null && row.costPerDay !== undefined) {
            const c = Number(row.costPerDay);
            if (isNaN(c) || c < 0) {
                errors.push({ index, field: 'costPerDay', msg: `${label}: cost/day must be a non-negative number` });
            }
        }

        row.prerequisites
            .split(',')
            .map(p => p.trim())
            .filter(Boolean)
            .forEach(p => {
                if (!activeLetters.has(p)) {
                    errors.push({ index, field: 'prerequisites', msg: `${label}: prerequisite "${p}" does not exist` });
                }
            });
    });

    return errors;
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
}

// ── Finished ───────────────────────────────────────────────────────────────────

async function handleFinished() {
    applyErrors([]);

    if (rows.length === 0) {
        const banner = document.getElementById('error-banner');
        banner.textContent = 'Add at least one activity before clicking Finished.';
        banner.classList.remove('hidden');
        return;
    }

    const errors = validateRows();
    if (errors.length > 0) {
        applyErrors(errors);
        return;
    }

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
            const banner = document.getElementById('error-banner');
            let msg = `Server error (HTTP ${res.status}) — please try again.`;
            try {
                const err = await res.json();
                msg = (err?.errors ?? [err?.error ?? msg]).join(' · ');
            } catch { /* non-JSON error body — keep generic HTTP message */ }
            banner.textContent = msg;
            banner.classList.remove('hidden');
            return;
        }

        data = await res.json();
    } catch {
        const banner = document.getElementById('error-banner');
        banner.textContent = 'Could not reach the server — please try again.';
        banner.classList.remove('hidden');
        return;
    }

    try {
        renderDiagram(data);
    } catch {
        const banner = document.getElementById('error-banner');
        banner.textContent = 'Failed to render the diagram — please reload the page.';
        banner.classList.remove('hidden');
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
