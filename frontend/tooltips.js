// Pure tooltip content generators — no DOM dependencies.
// Returns an HTML string, or null for dummy activities.

export function buildActivityTooltipHtml(activity) {
    if (activity.dummy) return null;

    const criticalLabel = activity.critical ? 'Yes' : 'No';
    const criticalClass = activity.critical ? ' tooltip-critical' : '';

    return `<div class="tooltip-activity${criticalClass}">
  <div class="tooltip-header">${activity.letter} — ${activity.description}</div>
  <dl class="tooltip-fields">
    <dt>Duration</dt>        <dd>${activity.duration} d</dd>
    <dt>Cost/day</dt>        <dd>R$ ${activity.cost_per_day}</dd>
    <dt>Total cost</dt>      <dd>R$ ${activity.total_cost}</dd>
    <dt>ES / EF</dt>         <dd>${activity.ES} / ${activity.EF}</dd>
    <dt>LS / LF</dt>         <dd>${activity.LS} / ${activity.LF}</dd>
    <dt>Free float</dt>      <dd>${activity.free_float}</dd>
    <dt>Total float</dt>     <dd>${activity.total_float}</dd>
    <dt>Critical</dt>        <dd>${criticalLabel}</dd>
  </dl>
</div>`;
}

export function buildEventTooltipHtml(event) {
    const incoming = (event.incoming && event.incoming.length)
        ? event.incoming.join(', ') : '—';
    const outgoing = (event.outgoing && event.outgoing.length)
        ? event.outgoing.join(', ') : '—';

    const slackClass = event.slack === 0 ? ' tooltip-slack-critical' : '';

    return `<div class="tooltip-event">
  <div class="tooltip-header">Event ${event.number}</div>
  <dl class="tooltip-fields">
    <dt>EET</dt>             <dd>${event.EET}</dd>
    <dt>LET</dt>             <dd>${event.LET}</dd>
    <dt>Slack</dt>           <dd class="tooltip-slack${slackClass}">${event.slack}</dd>
    <dt>Incoming</dt>        <dd>${incoming}</dd>
    <dt>Outgoing</dt>        <dd>${outgoing}</dd>
  </dl>
</div>`;
}
