// Live tournament log (no AI): every run takes a snapshot of the public results (names and scores only, the same data
// as the public results page) and posts a short summary plus the raw snapshot to one GitHub issue. After the event,
// Claude reads the issue once and writes the analysis. Stops logging by itself once the tournament is finished.
import { writeFileSync } from 'node:fs';
const { SB_URL, SB_KEY, SLUG } = process.env;
const r = await fetch(`${SB_URL}/rest/v1/rpc/public_tournament`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ slug: SLUG }) });
if (!r.ok) { writeFileSync('summary.md', `### Snapshot failed\nHTTP ${r.status}: ${(await r.text()).slice(0, 300)}\n`); process.exit(0); }
const t = await r.json();
const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
const names = new Map((t.entries ?? []).map((e) => [e.id, (e.names ?? []).join(' / ')]));
const divs = new Map((t.divisions ?? []).map((d) => [d.id, d]));
const ms = (t.matches ?? []).filter((m) => m.status !== 'void');
const label = (m) => `${divs.get(m.division_id ?? m.divisionId)?.kind === 'doubles' ? 'D' : 'S'}${m.stage === 'pool' ? String.fromCharCode(64 + (m.pool ?? 1)) : ' ' + m.stage.toUpperCase()}`;
const side = (id) => names.get(id) ?? 'TBD';
const score = (m) => (m.games ?? []).map((g) => `${g.a}–${g.b}`).join(', ');
const lines = [`### ${now} IST · ${t.status}`];
for (const d of t.divisions ?? []) {
  const dm = ms.filter((m) => (m.division_id ?? m.divisionId) === d.id);
  const c = (s) => dm.filter((m) => m.status === s).length;
  const ko = dm.filter((m) => m.stage !== 'pool').length;
  lines.push(`- **${d.name}**: ${c('done')} done · ${c('live')} live · ${c('scheduled')} to play · knockout matches made: ${ko}`);
}
const live = ms.filter((m) => m.status === 'live');
if (live.length) lines.push('', '**On court**', ...live.map((m) => `- Court ${m.court ?? '?'} · ${label(m)} · ${side(m.entry_a ?? m.entryA)} v ${side(m.entry_b ?? m.entryB)} · ${score(m)}`));
// Things worth a look: odd scores (a finished game under 11, or a 11–0 / 15–0), and pools where every match is done but no knockouts exist yet.
const odd = ms.filter((m) => m.status === 'done' && (m.games ?? []).some((g) => Math.max(g.a, g.b) < 11 || Math.min(g.a, g.b) === 0));
if (odd.length) lines.push('', '**Check these scores**', ...odd.map((m) => `- ${label(m)} · ${side(m.entry_a ?? m.entryA)} v ${side(m.entry_b ?? m.entryB)} · ${score(m) || 'walkover'}`));
for (const d of t.divisions ?? []) {
  const dm = ms.filter((m) => (m.division_id ?? m.divisionId) === d.id);
  const pools = dm.filter((m) => m.stage === 'pool');
  if (pools.length && pools.every((m) => m.status === 'done') && !dm.some((m) => m.stage !== 'pool')) lines.push('', `**⚠️ ${d.name}: every group match is done but no knockouts yet. An organiser should open Desk view.**`);
}
lines.push('', '<details><summary>Snapshot (names and scores only)</summary>', '', '```json', JSON.stringify({ status: t.status, matches: ms.map((m) => ({ id: m.id, d: label(m), court: m.court, slot: m.slot, status: m.status, a: side(m.entry_a ?? m.entryA), b: side(m.entry_b ?? m.entryB), games: m.games, winner: m.winner })) }), '```', '</details>');
writeFileSync('summary.md', lines.join('\n'));
writeFileSync('status.txt', String(t.status));
