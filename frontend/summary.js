// Pure summary panel content generators — no DOM dependencies.
// Each function returns an HTML string.

export function buildCriticalPathsHtml(project) {
    const rows = project.critical_paths
        .map(path => `<li class="critical-path-row">${path.join(' → ')}</li>`)
        .join('\n');

    return `<div class="summary-critical-paths">
  <h3 class="summary-subtitle">Critical Path(s)</h3>
  <ul class="critical-path-list">
${rows}
  </ul>
</div>`;
}

export function buildProjectStatsHtml(data) {
    const real = data.activities.filter(a => !a.dummy);
    const totalActivities  = real.length;
    const criticalActivities = real.filter(a => a.critical).length;
    const totalNodes       = data.events.length;
    const { duration, total_cost, critical_paths, cost_per_critical_path } = data.project;

    const pathCostRows = critical_paths
        .map((_, i) => {
            const label = critical_paths.length === 1
                ? 'Total Cost per Critical Path'
                : `Total Cost — Path ${i + 1}`;
            return `<dt>${label}</dt><dd>R$ ${cost_per_critical_path[i]}</dd>`;
        })
        .join('\n    ');

    return `<div class="summary-stats">
  <h3 class="summary-subtitle">Project Stats</h3>
  <dl class="summary-stats-list">
    <dt>Total Activities</dt>          <dd>${totalActivities}</dd>
    <dt>Critical Activities</dt>       <dd>${criticalActivities}</dd>
    <dt>Total Nodes</dt>               <dd>${totalNodes}</dd>
    <dt>Minimal Project Duration</dt>  <dd>${duration} days</dd>
    <dt>Total Cost</dt>                <dd>R$ ${total_cost}</dd>
    ${pathCostRows}
  </dl>
</div>`;
}

export function buildActivityTableHtml(activities) {
    const real = activities.filter(a => !a.dummy);

    const rows = real.map(a => {
        const cls = a.critical ? ' class="row-critical"' : '';
        const criticalLabel = a.critical ? 'Yes' : 'No';
        return `<tr${cls}>
      <td>${a.letter}</td>
      <td>${a.description}</td>
      <td>${a.from_node}</td>
      <td>${a.to_node}</td>
      <td>${a.duration}</td>
      <td>${a.cost_per_day}</td>
      <td>${a.total_cost}</td>
      <td>${a.ES}</td>
      <td>${a.EF}</td>
      <td>${a.LS}</td>
      <td>${a.LF}</td>
      <td>${a.free_float}</td>
      <td>${a.total_float}</td>
      <td>${criticalLabel}</td>
    </tr>`;
    }).join('\n');

    return `<div class="summary-activity-table">
  <h3 class="summary-subtitle">Activity Table</h3>
  <div class="activity-table-scroll">
    <table class="summary-table">
      <thead>
        <tr>
          <th>Letter</th>
          <th>Description</th>
          <th>From Node</th>
          <th>To Node</th>
          <th>Duration</th>
          <th>Cost/day (R$)</th>
          <th>Total Cost (R$)</th>
          <th>ES</th>
          <th>EF</th>
          <th>LS</th>
          <th>LF</th>
          <th>Free Float</th>
          <th>Total Float</th>
          <th>Critical</th>
        </tr>
      </thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </div>
</div>`;
}
