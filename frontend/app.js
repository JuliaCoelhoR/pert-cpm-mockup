import { buildActivityTooltipHtml, buildEventTooltipHtml } from './tooltips.js';
import { activityColor, getCriticalNodeIds, eventColor } from './diagram.js';
import { getLetter, validateAllRows } from './validation.js';
import { parseTabPaste } from './paste.js';
import { buildCriticalPathsHtml, buildProjectStatsHtml, buildActivityTableHtml } from './summary.js';
import { mapValidationErrors } from './mapErrors.js';

// ── State ──────────────────────────────────────────────────────────────────────

/** @type {Array<{letterIndex: number, description: string, prerequisites: string, duration: string, costPerDay: string}>} */
let rows = [];
let nextLetterIndex = 0;
let draftRows = [emptyDraft()];
/** @type {import('vis-network').Network | null} */
let network = null;

function emptyDraft() {
    return { description: '', prerequisites: '', duration: '', costPerDay: '' };
}

function isDraftEmpty(draft) {
    return !draft.description && !draft.prerequisites && !draft.duration && !draft.costPerDay;
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function getActiveLetters() {
    return new Set(rows.map(r => getLetter(r.letterIndex)));
}

// ── Table rendering ────────────────────────────────────────────────────────────

function updateEmptyState() {
    const el = document.getElementById('activities-empty');
    if (!el) return;
    const anyDraftHasContent = draftRows.some(d => !isDraftEmpty(d));
    el.classList.toggle('hidden', rows.length > 0 || anyDraftHasContent);
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    rows.forEach((row, index) => tbody.appendChild(buildRealRow(row, index)));
    draftRows.forEach((_, draftIndex) => tbody.appendChild(buildTrailingRow(draftIndex)));

    updateEmptyState();
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
            const error = validateField(field, input.value, getActiveLetters());
            if (error) {
                input.classList.add('cell-error');
                input.title = error;
            } else {
                input.classList.remove('cell-error');
                input.title = '';
            }
        });
        input.addEventListener('paste', handlePaste);
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

function buildTrailingRow(draftIndex) {
    const draft = draftRows[draftIndex];
    const tr = document.createElement('tr');
    tr.className = 'row-trailing';

    const tdLetter = document.createElement('td');
    tdLetter.className = 'cell-letter cell-letter-dim';
    tdLetter.textContent = getLetter(nextLetterIndex + draftIndex);
    tr.appendChild(tdLetter);

    const trailDefs = [
        { id: draftIndex === 0 ? 'trail-description'   : null, field: 'description',  type: 'text',   placeholder: 'New activity…' },
        { id: draftIndex === 0 ? 'trail-prerequisites' : null, field: 'prerequisites', type: 'text',   placeholder: 'e.g. A, C'    },
        { id: draftIndex === 0 ? 'trail-duration'      : null, field: 'duration',      type: 'number', placeholder: '1',    min: '1',  step: '1'    },
        { id: draftIndex === 0 ? 'trail-cost'          : null, field: 'costPerDay',    type: 'number', placeholder: '0.00', min: '0',  step: '0.01' },
    ];

    trailDefs.forEach(({ id, field, type, placeholder, min, step }) => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = type;
        if (id) input.id = id;
        input.className = 'cell-input cell-input-trail';
        input.placeholder = placeholder;
        input.value = draft[field];
        if (min  !== undefined) input.min  = min;
        if (step !== undefined) input.step = step;
        input.dataset.field      = field;
        input.dataset.draftIndex = String(draftIndex);
        input.addEventListener('input', () => {
            const wasEmpty = isDraftEmpty(draftRows[draftIndex]);
            draftRows[draftIndex][field] = input.value;
            clearError(input);
            updateEmptyState();
            if (wasEmpty && input.value && draftIndex === draftRows.length - 1) {
                draftRows.push(emptyDraft());
                document.getElementById('table-body').appendChild(buildTrailingRow(draftRows.length - 1));
            }
        });
        input.addEventListener('blur', () => {
            if (draftIndex < draftRows.length - 1 && isDraftEmpty(draftRows[draftIndex])) {
                draftRows.splice(draftIndex, 1);
                tr.remove();
                updateEmptyState();
            }
        });
        input.addEventListener('paste', handlePaste);
        if (id === 'trail-cost') {
            input.addEventListener('keydown', e => {
                if (e.key === 'Tab' && !e.shiftKey) e.preventDefault();
            });
        }
        td.appendChild(input);
        tr.appendChild(td);
    });

    tr.appendChild(document.createElement('td'));
    return tr;
}

// ── Row actions ────────────────────────────────────────────────────────────────

function flushAllDrafts() {
    draftRows.forEach(draft => {
        if (isDraftEmpty(draft)) return;
        const { description, prerequisites, duration, costPerDay } = draft;
        rows.push({ letterIndex: nextLetterIndex++, description, prerequisites, duration, costPerDay });
    });
    draftRows = [emptyDraft()];
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
        draftRows = [emptyDraft()];
    }
    renderTable();
}

// ── Paste ──────────────────────────────────────────────────────────────────────

function handlePaste(e) {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!text.includes('\t') && !text.includes('\n')) return;

    e.preventDefault();
    flushAllDrafts();

    parseTabPaste(text).forEach(({ description, prerequisites, duration, costPerDay }) => {
        rows.push({ letterIndex: nextLetterIndex++, description, prerequisites, duration, costPerDay });
    });

    renderTable();
}

// ── Validation ─────────────────────────────────────────────────────────────────

function applyErrors(errors, draftOffset = Infinity) {
    document.querySelectorAll('.cell-input.cell-error').forEach(el => el.classList.remove('cell-error'));

    errors.forEach(({ index, field }) => {
        const input = index < draftOffset
            ? document.querySelector(`[data-field="${field}"][data-index="${index}"]`)
            : document.querySelector(`[data-field="${field}"][data-draft-index="${index - draftOffset}"]`);
        if (input) input.classList.add('cell-error');
    });

    const banner = document.getElementById('error-banner');
    if (errors.length > 0) {
        banner.textContent = errors.length === 1
            ? `1 cell has an error — fix it before continuing.`
            : `${errors.length} cells have errors — fix them before continuing.`;
        banner.classList.remove('hidden');
        document.querySelector('.cell-input.cell-error')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        document.querySelector('.cell-input.cell-error')?.focus();
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
    const nonEmptyDrafts = draftRows.filter(d => !isDraftEmpty(d));
    const previewRows = [
        ...rows,
        ...nonEmptyDrafts.map((d, i) => ({
            letterIndex:   nextLetterIndex + i,
            description:   d.description,
            prerequisites: d.prerequisites,
            duration:      d.duration,
            costPerDay:    d.costPerDay,
        })),
    ];

    if (previewRows.length === 0) {
        showBanner('Add at least one activity before clicking Finished.');
        return;
    }

    const frontendErrors = validateAllRows(previewRows);
    if (frontendErrors.length > 0) {
        applyErrors(frontendErrors, rows.length);
        return;
    }

    flushAllDrafts();
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
                const { fieldErrors, bannerMsgs } = mapValidationErrors(body.errors ?? [], rows);
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
        renderSummary(data);
    } catch {
        showBanner('Failed to render the diagram — please reload the page.');
    }
}

// ── Diagram ────────────────────────────────────────────────────────────────────

function makeTooltipElement(html) {
    if (!html) return undefined;
    const div = document.createElement('div');
    div.className = 'vis-tooltip-content';
    div.innerHTML = html;
    return div;
}

function renderDiagram(data) {
    const section = document.getElementById('diagram-section');
    const wasHidden = section.classList.contains('hidden');
    section.classList.remove('hidden');

    const criticalNodeIds = getCriticalNodeIds(data.project.critical_paths);

    const visNodes = new vis.DataSet(
        data.events.map(ev => ({
            id:    ev.number,
            label: String(ev.number),
            shape: 'circle',
            size:  22,
            color: eventColor(ev.number, criticalNodeIds),
            font:        { color: '#2c2c2c', size: 14, face: 'system-ui, sans-serif' },
            borderWidth: 2,
            title:       makeTooltipElement(buildEventTooltipHtml(ev)),
        }))
    );

    const visEdges = new vis.DataSet(
        data.activities.map((act, i) => ({
            id:     i,
            from:   act.from_node,
            to:     act.to_node,
            label:  act.dummy ? '' : `${act.letter}\n${act.duration}d`,
            dashes: act.dummy,
            color:  activityColor(act),
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
            title:  makeTooltipElement(buildActivityTooltipHtml(act)),
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
            hover:     true,
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

// ── Summary ────────────────────────────────────────────────────────────────────

function renderSummary(data) {
    const section = document.getElementById('summary-section');
    section.innerHTML =
        buildCriticalPathsHtml(data.project) +
        buildProjectStatsHtml(data) +
        buildActivityTableHtml(data.activities);
    section.classList.remove('hidden');
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

document.getElementById('btn-finished').addEventListener('click', handleFinished);
renderTable();
