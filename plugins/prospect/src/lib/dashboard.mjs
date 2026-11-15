// Self-contained HTML dashboard generated from local lead data.
import { loadConfig } from './config.mjs';
import { allLeads, nextStage, STAGE_LABELS, STAGES } from './leads.mjs';
import { prototypeOverview } from './deploy.mjs';
import { now, writeText } from './util.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function dashboardMetrics(w) {
  const leads = allLeads(w).filter((l) => !l.archived);
  const pri = (l) => l.priority_override || l.priority;
  const count = (f) => leads.filter(f).length;
  return {
    total_researched: count((l) => l.stages.research.status === 'COMPLETED'),
    qualified: count((l) => l.approved && ['High', 'Medium', 'Low'].includes(pri(l))),
    high_priority: count((l) => pri(l) === 'High'),
    medium_priority: count((l) => pri(l) === 'Medium'),
    low_priority: count((l) => pri(l) === 'Low'),
    no_website: count((l) => l.website?.status === 'A'),
    poor_website: count((l) => l.website?.status === 'B'),
    prototypes_generated: count((l) => l.prototype?.code),
    prototypes_deployed: count((l) => l.deployment?.active),
    failed_prototypes: count((l) => ['FAILED', 'REQUIRES_MANUAL_REVIEW'].includes(l.stages.qa.status) || ['FAILED'].includes(l.stages.deploy.status)),
    emails_drafted: count((l) => l.draft?.status === 'saved'),
    drafts_awaiting_review: count((l) => l.draft?.status === 'saved' && !l.manual_status),
    contacted: count((l) => ['Contacted', 'Responded', 'Meeting Scheduled', 'Converted'].includes(l.manual_status)),
    converted: count((l) => l.manual_status === 'Converted'),
    failed_jobs: leads.flatMap((l) => STAGES.filter((s) => ['FAILED', 'REQUIRES_MANUAL_REVIEW'].includes(l.stages[s].status)).map((s) => ({ lead: l.id, stage: s, error: l.stages[s].error }))),
  };
}

export function renderDashboard(w) {
  const cfg = loadConfig(w);
  const leads = allLeads(w).filter((l) => !l.archived).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  const m = dashboardMetrics(w);
  const protos = prototypeOverview(w);
  const tile = (label, value, tone = '') => `<div class="tile ${tone}"><div class="v">${value}</div><div class="l">${esc(label)}</div></div>`;
  const stepper = (l) =>
    `<div class="steps">${STAGES.map((s) => {
      const st = l.stages[s].status;
      const cls = st === 'COMPLETED' || st === 'SKIPPED' ? 'done' : st === 'RUNNING' ? 'run' : st === 'FAILED' || st === 'REQUIRES_MANUAL_REVIEW' ? 'fail' : st === 'WAITING_FOR_APPROVAL' || (s === 'approval' && l.stages.research.status === 'COMPLETED' && !l.approved && !l.rejected) ? 'wait' : st === 'CANCELLED' ? 'cancel' : '';
      return `<span class="dot ${cls}" title="${esc(STAGE_LABELS[s])}: ${esc(st)}"></span>`;
    }).join('')}</div>`;
  const pill = (p) => (p ? `<span class="pill p-${esc(p.toLowerCase())}">${esc(p)}</span>` : '<span class="muted">—</span>');
  const rows = leads.map((l) => {
    const ns = nextStage(l);
    return `<tr data-search="${esc(`${l.business_name} ${l.id} ${l.instagram_username} ${l.status} ${l.industry} ${l.location}`.toLowerCase())}" data-priority="${esc(l.priority_override || l.priority || '')}" data-status="${esc(l.status)}">
<td><strong>${esc(l.business_name || '@' + l.instagram_username)}</strong><div class="muted small"><a href="${esc(l.instagram_url)}" target="_blank" rel="noopener">@${esc(l.instagram_username)}</a> · <code>${esc(l.id)}</code></div></td>
<td>${esc(l.status)}${ns && l.stages[ns]?.error ? `<div class="err small">${esc(l.stages[ns].error)}</div>` : ''}</td>
<td>${stepper(l)}</td>
<td>${pill(l.priority_override || l.priority)}${l.opportunity_score != null ? ` <span class="muted">${l.opportunity_score}</span>` : ''}</td>
<td>${esc(l.website?.status_label || '—')}</td>
<td>${l.deployment?.active ? `<a href="${esc(l.deployment.url)}" target="_blank" rel="noopener">${esc(l.deployment.code)}</a>` : l.prototype?.code ? `<span class="muted">${esc(l.prototype.code)}</span>` : '—'}</td>
<td>${l.draft?.status === 'saved' ? (l.draft.link ? `<a href="${esc(l.draft.link)}" target="_blank" rel="noopener">In Drafts</a>` : 'In Drafts') : '—'}</td>
</tr>`;
  }).join('\n');
  const protoRows = protos.map((p) => `<tr><td>${esc(p.business || p.lead_id)}</td><td><code>${esc(p.code)}</code></td><td>${esc(p.status)}${p.expiring_soon ? ' <span class="pill p-medium">expiring soon</span>' : ''}</td><td>${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url)}</a>` : '—'}</td><td>${esc(p.expires || '—')}</td><td>v${esc(p.current_version)} · QA ${esc(p.qa)}</td></tr>`).join('\n');
  const failed = m.failed_jobs.map((f) => `<li><code>${esc(f.lead)}</code> — ${esc(STAGE_LABELS[f.stage])}: ${esc(f.error || 'failed')} <span class="muted">→ /prospect:retry ${esc(f.lead)} ${esc(f.stage)}</span></li>`).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prospect Engine — ${esc(cfg.agency.name || 'Dashboard')}</title>
<style>
:root{--bg:#f7f8fa;--card:#fff;--text:#111827;--muted:#6b7280;--border:#e5e7eb;--brand:#4f46e5;--ok:#16a34a;--run:#2563eb;--fail:#dc2626;--wait:#d97706}
@media (prefers-color-scheme:dark){:root{--bg:#0b0d12;--card:#141821;--text:#e5e7eb;--muted:#9ca3af;--border:#262b36;--brand:#818cf8}}
*{box-sizing:border-box}body{margin:0;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;background:var(--bg);color:var(--text)}
header{padding:24px 28px;border-bottom:1px solid var(--border);background:var(--card);display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{margin:0;font-size:20px}h2{font-size:16px;margin:28px 0 12px}main{padding:8px 28px 48px;max-width:1400px;margin:0 auto}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:20px}.tile{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px}.tile .v{font-size:26px;font-weight:700}.tile .l{color:var(--muted);font-size:12px}.tile.hi .v{color:var(--ok)}.tile.bad .v{color:var(--fail)}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden}th,td{padding:10px 12px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:600;background:var(--bg)}
a{color:var(--brand)}.muted{color:var(--muted)}.small{font-size:12px}.err{color:var(--fail)}code{font-size:12px}
.steps{display:flex;gap:3px}.dot{width:12px;height:12px;border-radius:3px;background:var(--border)}.dot.done{background:var(--ok)}.dot.run{background:var(--run)}.dot.fail{background:var(--fail)}.dot.wait{background:var(--wait)}.dot.cancel{background:#9ca3af}
.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;font-weight:600}.p-high{background:#dcfce7;color:#166534}.p-medium{background:#fef3c7;color:#92400e}.p-low{background:#e0e7ff;color:#3730a3}.p-reject{background:#fee2e2;color:#991b1b}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}input,select{padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--text)}
.legend{display:flex;gap:14px;color:var(--muted);font-size:12px;align-items:center}.legend span{display:inline-flex;gap:5px;align-items:center}
.box{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px 18px}
.cmds code{background:var(--bg);padding:2px 6px;border-radius:6px}
</style></head><body>
<header><div><h1>Prospect Engine</h1><div class="muted">${esc(cfg.agency.name || '')} · generated ${esc(now().slice(0, 16).replace('T', ' '))} — run <code>/prospect:dashboard</code> to refresh</div></div>
<div class="legend"><span><i class="dot done"></i>done</span><span><i class="dot run"></i>running</span><span><i class="dot wait"></i>needs you</span><span><i class="dot fail"></i>failed</span><span><i class="dot"></i>pending</span></div></header>
<main>
<div class="tiles">
${tile('Businesses researched', m.total_researched)}${tile('Qualified', m.qualified)}${tile('High priority', m.high_priority, 'hi')}${tile('Medium priority', m.medium_priority)}${tile('Low priority', m.low_priority)}
${tile('No website', m.no_website)}${tile('Poor website', m.poor_website)}${tile('Prototypes generated', m.prototypes_generated)}${tile('Prototypes live', m.prototypes_deployed)}${tile('Failed prototypes', m.failed_prototypes, m.failed_prototypes ? 'bad' : '')}
${tile('Emails in Drafts', m.emails_drafted)}${tile('Drafts awaiting review', m.drafts_awaiting_review)}${tile('Contacted', m.contacted)}${tile('Converted clients', m.converted, 'hi')}
</div>
${failed ? `<h2>Needs attention</h2><div class="box"><ul>${failed}</ul></div>` : ''}
<h2>Leads (${leads.length})</h2>
<div class="filters"><input id="q" placeholder="Search name, status, location…" size="32"><select id="p"><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option><option>Reject</option></select></div>
<table id="leads"><thead><tr><th>Business</th><th>Status</th><th>Progress (12 stages)</th><th>Priority</th><th>Website</th><th>Prototype</th><th>Email</th></tr></thead><tbody>
${rows || '<tr><td colspan="7" class="muted">No leads yet. In Claude Code run <code>/prospect:new https://instagram.com/somebusiness</code></td></tr>'}
</tbody></table>
<h2>Prototypes (${protos.length})</h2>
<table><thead><tr><th>Business</th><th>Code</th><th>Status</th><th>Link</th><th>Expires</th><th>Version</th></tr></thead><tbody>${protoRows || '<tr><td colspan="6" class="muted">None yet.</td></tr>'}</tbody></table>
<h2>Quick actions (type these in Claude Code)</h2>
<div class="box cmds"><p><code>/prospect:new &lt;instagram-url&gt;</code> add a business · <code>/prospect:list high</code> high-priority leads · <code>/prospect:prototypes</code> manage previews · <code>/prospect:references</code> design library · <code>/prospect:resume &lt;id&gt;</code> continue · <code>/prospect:doctor</code> health check · <code>/prospect:setup</code> settings</p></div>
</main>
<script>
const q=document.getElementById('q'),p=document.getElementById('p');
function f(){const s=q.value.toLowerCase(),pr=p.value;for(const r of document.querySelectorAll('#leads tbody tr[data-search]')){r.style.display=(!s||r.dataset.search.includes(s))&&(!pr||r.dataset.priority===pr)?'':'none'}}
q.oninput=f;p.onchange=f;
</script>
</body></html>
`;
  writeText(w.dashboard, html);
  return { file: w.dashboard, metrics: m };
}
