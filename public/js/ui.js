import {
  state, ROLES, ROLE_ORDER, roleName, roleIcon, EVENT_TYPES, TIERS, PICK_TYPES, MOODS,
  pad, fmtShort, WEEK, MONTHS, TODAY, dateKey, parseKey, esc
} from './state.js';
import { champIconName } from './riot-api.js';


const $ = (s, r = document) => r.querySelector(s);

const CDRAGON = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1';
const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn/14.1.1';

function profileIconUrl(id) {
  return `${CDRAGON}/profile-icons/${id}.jpg`;
}
function championSplashUrl(name) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champIconName(name)}_0.jpg`;
}
function championIconUrl(name) {
  return `${DDRAGON}/img/champion/${champIconName(name)}.png`;
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

export function toastIcon(msg, icon = 'fa-circle-check') {
  const t = $('#toast');
  t.innerHTML = `<i class="fa-solid ${icon}"></i> ${esc(msg)}`;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2400);
}

export const upcoming = (n = 5) => state.events
  .filter(e => e.date >= TODAY)
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  .slice(0, n);

export const eventsOn = k => state.events.filter(e => e.date === k);
export const poolCount = (p, tiers = TIERS) =>
  (Array.isArray(p?.pool) ? p.pool : []).filter(c => tiers.includes(c.tier)).length;
export const scrimRecord = () => {
  const w = state.scrims.filter(s => s.result === 'W').length;
  const l = state.scrims.filter(s => s.result === 'L').length;
  return { w, l, total: state.scrims.length };
};

function isPlayerMode() {
  return document.body.classList.contains('player-mode');
}

function safePool(p) {
  return Array.isArray(p?.pool) ? p.pool : [];
}

function canEditPool(pid) {
  if (!isPlayerMode()) return true;
  return pid === window.__akiCurrentPlayer;
}

export function viewDash() {
  const rec = scrimRecord();
  const titulares = state.players.filter(p => p.status === 'titular');
  const totalChamps = new Set(state.players.flatMap(p => safePool(p).map(c => c.champ))).size;
  const alertas = titulares.filter(p => poolCount(p, ['S','A']) < 3);
  const ups = upcoming(6);
  const pendingTasks = state.tasks.filter(t => !t.done);

  // Combinado: scrims + campeonatos
  const allGames = [
    ...state.scrims.map(s => ({ ...s, kind: 'scrim' })),
    ...state.tournaments.map(t => ({ ...t, kind: 'torneio' }))
  ];
  const wins = allGames.filter(g => g.result === 'W').length;
  const losses = allGames.filter(g => g.result === 'L').length;
  const draws = allGames.filter(g => g.result === 'D').length;
  const total = allGames.length;
  const wr = total ? Math.round(wins / total * 100) : 0;

  const tournW = state.tournaments.filter(t => t.result === 'W').length;
  const tournL = state.tournaments.filter(t => t.result === 'L').length;
  const tournWR = (tournW + tournL) ? Math.round(tournW / (tournW + tournL) * 100) : 0;

  return `
  <div class="grid g-4" style="margin-bottom:18px">
    <div class="stat"><div class="lbl">Roster Ativo</div><div class="val">${titulares.length}</div><div class="note">${state.players.length} no total</div></div>
    <div class="stat blue"><div class="lbl">Campeões Mapeados</div><div class="val">${totalChamps}</div><div class="note">em ${state.players.length} pools</div></div>
    <div class="stat orange"><div class="lbl">Campeonatos</div><div class="val">${state.tournaments.length}</div><div class="note">${tournW}V — ${tournL}D (${tournWR}%)</div></div>
    <div class="stat ${wr >= 50 ? 'green' : 'red'}"><div class="lbl">Winrate Geral</div><div class="val">${total ? wr + '%' : '—'}</div><div class="note">${total ? `${wins}V — ${losses}D${draws ? ` — ${draws}E` : ''}` : 'sem dados'}</div></div>
  </div>

  <div class="grid g-2" style="margin-bottom:18px">
    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-chart-line"></i> Evolução (últimos 10 jogos)</h3></div>
      <div class="chart-wrap"><canvas id="chart-winrate"></canvas></div>
    </div>
    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-chart-pie"></i> Resultados Gerais</h3></div>
      <div class="chart-wrap"><canvas id="chart-results"></canvas></div>
    </div>
  </div>

  <div class="grid g-2" style="margin-bottom:18px">
    <div class="card">
      <div class="card-head">
        <h3><i class="fa-solid fa-calendar-days"></i> Próximos Compromissos</h3>
        <div class="spacer"></div>
        <button class="btn sm" data-act="nav" data-view="agenda">Ver agenda</button>
      </div>
      ${ups.length ? `<div style="display:flex;flex-direction:column;gap:8px">${ups.map(evRowHTML).join('')}</div>`
        : `<div class="empty"><i class="fa-solid fa-calendar-xmark" style="font-size:26px;opacity:.4"></i><br>Nenhum evento agendado.</div>`}
    </div>

    <div class="card">
      <div class="card-head">
        <h3><i class="fa-solid fa-heart-pulse"></i> Saúde das Pools</h3>
        <div class="spacer"></div>
        <button class="btn sm" data-act="nav" data-view="pools">Gerenciar</button>
      </div>
      ${titulares.length ? `<div style="display:flex;flex-direction:column;gap:9px">
        ${titulares.sort((a,b)=>ROLE_ORDER[a.role]-ROLE_ORDER[b.role]).map(p => {
          const s = poolCount(p, ['S']), a = poolCount(p, ['A']);
          const ok = s + a >= 3;
          return `<div style="display:flex;align-items:center;gap:10px">
            <div class="avatar" style="width:30px;height:30px;flex:0 0 30px;font-size:12px;border-radius:7px">${esc(p.nick.slice(0,2).toUpperCase())}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600">${esc(p.nick)} <span style="color:var(--muted);font-weight:400;font-size:11px">· ${roleName(p.role)}</span></div>
              <div style="height:4px;background:#18222f;border-radius:3px;margin-top:5px;overflow:hidden;display:flex">
                <div style="width:${Math.min(s/6*100,100)}%;background:var(--gold)"></div>
                <div style="width:${Math.min(a/6*100,100)}%;background:var(--teal)"></div>
              </div>
            </div>
            <div style="font-size:11px;color:${ok?'var(--muted)':'#ff9b9b'};font-weight:700;white-space:nowrap">
              ${s}S · ${a}A${ok?'':' <i class="fa-solid fa-triangle-exclamation"></i>'}
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div class="empty">Sem titulares cadastrados.</div>`}
    </div>
  </div>

  <div class="grid g-2" style="margin-bottom:18px">
    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-list-check"></i> Tarefas Pendentes</h3><div class="spacer"></div>
        <button class="btn sm" data-act="nav" data-view="tasks">Ver todas</button></div>
      ${pendingTasks.length ? `<div style="display:flex;flex-direction:column;gap:7px">
        ${pendingTasks.slice(0,5).map(t => `
          <div class="task-row">
            <button class="task-check" data-act="toggle-task" data-id="${t.id}"><i class="fa-solid fa-check"></i></button>
            <div class="task-title">${esc(t.title)}</div>
            <div class="task-due">${t.assignee ? esc(t.assignee) + ' · ' : ''}${t.due ? fmtShort(t.due) : ''}</div>
          </div>`).join('')}
      </div>` : `<div class="empty"><i class="fa-solid fa-circle-check" style="font-size:26px;opacity:.4"></i><br>Nenhuma tarefa pendente.</div>`}
    </div>

    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-flag"></i> Últimos Resultados</h3><div class="spacer"></div>
        <button class="btn sm" data-act="nav" data-view="scrims">Ver todos</button></div>
      ${allGames.length ? `<div style="display:flex;flex-direction:column;gap:8px">
        ${allGames.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(g => `
          <div class="scrim-row" style="grid-template-columns:46px 1fr 60px auto">
            <div class="res-badge res-${g.result}">${g.result}</div>
            <div>
              <div style="font-weight:600;font-size:13px">${g.kind === 'torneio' ? `<i class="fa-solid fa-trophy" style="color:#f7bd4a;font-size:11px"></i> ` : ''}vs ${esc(g.opponent)}</div>
              <div style="font-size:11px;color:var(--muted)">${fmtShort(g.date)} · ${esc(g.format)}${g.kind === 'torneio' && g.stage ? ' · ' + esc(g.stage) : ''}</div>
            </div>
            <div style="font-weight:800;color:var(--gold2);text-align:right">${esc(g.score||'—')}</div>
          </div>`).join('')}
      </div>` : `<div class="empty"><i class="fa-solid fa-flag" style="font-size:26px;opacity:.4"></i><br>Nenhuma partida registrada.</div>`}
    </div>
  </div>

  <div class="grid g-2">
    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-triangle-exclamation"></i> Alertas do Coach</h3></div>
      <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
        ${alertas.length ? alertas.map(p => `
          <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.25);border-radius:8px">
            <i class="fa-solid fa-triangle-exclamation" style="color:#f7bd4a;font-size:15px;margin-top:2px"></i>
            <div><strong style="color:#f7bd4a">${esc(p.nick)}</strong> tem apenas <strong>${poolCount(p,['S','A'])}</strong> campeão(ões) em tier S/A.</div>
          </div>`).join('') : `
          <div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.25);border-radius:8px">
            <i class="fa-solid fa-circle-check" style="color:#5ee08c;font-size:15px"></i>
            <div>Todas as pools estão saudáveis.</div>
          </div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-face-smile"></i> Check-in de Humor</h3></div>
      <div style="font-size:12.5px;color:var(--muted);margin-bottom:12px">Como está o time hoje?</div>
      <div class="mood-row" data-player="team">
        ${MOODS.map((m, i) => `<button class="mood-btn ${state.moods[TODAY]?.['team'] === i+1 ? 'selected' : ''}" data-act="set-mood" data-player="team" data-mood="${i+1}">${m}</button>`).join('')}
      </div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════
   CHARTS (Chart.js)
   ═══════════════════════════════════════ */
let _charts = {};

export function bindDashboardCharts() {
  if (typeof window.Chart === 'undefined') return;

  // Limpa charts antigos
  Object.values(_charts).forEach(c => { try { c.destroy(); } catch {} });
  _charts = {};

  const allGames = [
    ...state.scrims.map(s => ({ ...s, kind: 'scrim' })),
    ...state.tournaments.map(t => ({ ...t, kind: 'torneio' }))
  ].sort((a, b) => (a.date + (a.time||'')).localeCompare(b.date + (b.time||'')));

  /* Chart 1: Evolução (últimos 10 jogos) */
  const trendCanvas = document.getElementById('chart-winrate');
  if (trendCanvas) {
    const last = allGames.slice(-10);
    const labels = last.map((g, i) => `J${i+1}`);
    let w = 0, l = 0;
    const winRateData = last.map(g => {
      if (g.result === 'W') w++;
      else if (g.result === 'L') l++;
      return (w + l) ? Math.round(w / (w + l) * 100) : 0;
    });

    _charts.winrate = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Winrate acumulado (%)',
          data: winRateData,
          borderColor: '#4a9eff',
          backgroundColor: 'rgba(74,158,255,.15)',
          borderWidth: 2,
          fill: true,
          tension: .35,
          pointBackgroundColor: '#4a9eff',
          pointBorderColor: '#04070c',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0a1420',
            borderColor: 'rgba(74,158,255,.4)',
            borderWidth: 1,
            titleColor: '#d8e3f0',
            bodyColor: '#a8bcd4',
            padding: 10,
            callbacks: {
              title: (items) => {
                const i = items[0].dataIndex;
                const g = last[i];
                return `${g.kind === 'torneio' ? '🏆' : '🎯'} vs ${g.opponent} (${g.result})`;
              },
              label: (item) => `Winrate: ${item.parsed.y}%`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: '#5e7288', font: { size: 11 }, callback: v => v + '%' },
            grid: { color: 'rgba(74,158,255,.08)' }
          },
          x: {
            ticks: { color: '#5e7288', font: { size: 11 } },
            grid: { display: false }
          }
        }
      }
    });
  }

  /* Chart 2: Resultados gerais */
  const resultsCanvas = document.getElementById('chart-results');
  if (resultsCanvas) {
    const scrimsW = state.scrims.filter(s => s.result === 'W').length;
    const scrimsL = state.scrims.filter(s => s.result === 'L').length;
    const scrimsD = state.scrims.filter(s => s.result === 'D').length;
    const tournW = state.tournaments.filter(t => t.result === 'W').length;
    const tournL = state.tournaments.filter(t => t.result === 'L').length;

    _charts.results = new Chart(resultsCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Scrim Vitórias', 'Scrim Derrotas', 'Scrim Empates', 'Torneio Vitórias', 'Torneio Derrotas'],
        datasets: [{
          data: [scrimsW, scrimsL, scrimsD, tournW, tournL],
          backgroundColor: [
            'rgba(34,197,94,.85)',
            'rgba(224,82,82,.85)',
            'rgba(120,140,163,.6)',
            'rgba(245,158,11,.85)',
            'rgba(168,85,247,.85)'
          ],
          borderColor: '#04070c',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#a8bcd4',
              font: { size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: '#0a1420',
            borderColor: 'rgba(74,158,255,.4)',
            borderWidth: 1,
            titleColor: '#d8e3f0',
            bodyColor: '#a8bcd4',
            padding: 10
          }
        }
      }
    });
  }
}

/* ═══════════════════════════════════════
   VIEW: CAMPEONATOS
   ═══════════════════════════════════════ */
export function viewTournaments() {
  const list = [...(state.tournaments || [])].sort((a, b) => b.date.localeCompare(a.date));
  const playerMode = isPlayerMode();

  const w = list.filter(t => t.result === 'W').length;
  const l = list.filter(t => t.result === 'L').length;
  const wr = (w + l) ? Math.round(w / (w + l) * 100) : 0;

  const roleRoster = (label, nick) => nick
    ? `<span class="opp-player" title="${label}: ${esc(nick)}">${esc(nick)}</span>`
    : '';

  return `
  <div class="grid g-3" style="margin-bottom:18px">
    <div class="stat orange"><div class="lbl">Total de Partidas</div><div class="val">${list.length}</div></div>
    <div class="stat green"><div class="lbl">Vitórias</div><div class="val">${w}</div></div>
    <div class="stat ${wr >= 50 ? 'green' : 'red'}"><div class="lbl">Winrate</div><div class="val">${(w+l) ? wr + '%' : '—'}</div><div class="note">${w}V — ${l}D</div></div>
  </div>

  ${!playerMode ? `<div style="display:flex;gap:10px;margin-bottom:16px">
    <button class="btn primary" data-act="new-tournament"><i class="fa-solid fa-plus"></i> Registrar Campeonato</button>
  </div>` : ''}

  ${list.length ? `<div style="display:flex;flex-direction:column;gap:12px">
    ${list.map(t => `
      <div class="tournament-card ${t.result === 'W' ? 'win' : t.result === 'L' ? 'loss' : ''}">
        <div class="tourn-head">
          <div class="res-badge res-${t.result}">${t.result}</div>
          <div style="flex:1;min-width:0">
            <div class="tourn-name"><i class="fa-solid fa-trophy"></i> ${esc(t.name)}</div>
            <div class="tourn-meta">
              <span><i class="fa-regular fa-calendar"></i> ${fmtShort(t.date)}</span>
              <span>·</span>
              <span><i class="fa-solid fa-swords"></i> vs ${esc(t.opponent)}</span>
              ${t.stage ? `<span>·</span><span><i class="fa-solid fa-flag-checkered"></i> ${esc(t.stage)}</span>` : ''}
              ${t.format ? `<span>·</span><span>${esc(t.format)}</span>` : ''}
            </div>
          </div>
          <div class="tourn-score">${esc(t.score || '—')}</div>
          ${!playerMode ? `
            <div style="display:flex;gap:4px">
              <button class="icon-btn" data-act="edit-tournament" data-id="${t.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="icon-btn" data-act="del-tournament" data-id="${t.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>` : ''}
        </div>
        ${t.opponentRoster && Object.values(t.opponentRoster).some(Boolean) ? `
          <div class="tourn-roster">
            <span class="tourn-roster-label"><i class="fa-solid fa-users-viewfinder"></i> Roster inimigo:</span>
            ${roleRoster('TOP', t.opponentRoster.TOP)}
            ${roleRoster('JNG', t.opponentRoster.JNG)}
            ${roleRoster('MID', t.opponentRoster.MID)}
            ${roleRoster('ADC', t.opponentRoster.ADC)}
            ${roleRoster('SUP', t.opponentRoster.SUP)}
          </div>` : ''}
        ${t.notes ? `<div class="tourn-notes">${esc(t.notes)}</div>` : ''}
      </div>
    `).join('')}
  </div>` : `<div class="empty"><i class="fa-solid fa-trophy" style="font-size:26px;opacity:.4"></i><br>Nenhum campeonato registrado ainda.</div>`}`;
}

export function evRowHTML(e) {
  const t = EVENT_TYPES[e.type] || EVENT_TYPES.reuniao;
  return `<div class="ev-row" style="border-left-color:${t.color}">
    <div class="date" style="color:${t.color}">${fmtShort(e.date)}</div>
    <div class="body">
      <div class="title">${esc(e.title)}</div>
      <div class="meta">${t.label}${e.time&&e.time!=='00:00'?' · '+e.time:''}${e.duration?' · '+e.duration+'min':''}${e.opponent?' · vs '+esc(e.opponent):''}</div>
    </div>
    ${!isPlayerMode() ? `
      <button class="icon-btn" data-act="edit-event" data-id="${e.id}"><i class="fa-solid fa-pen"></i></button>
      <button class="icon-btn" data-act="del-event" data-id="${e.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
  </div>`;
}

let calCursor = new Date();

export function shiftCal(n) {
  calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + n, 1);
}

export function resetCal() { calCursor = new Date(); }

/* ═══════════════════════════════════════
   VIEW: AGENDA
   ═══════════════════════════════════════ */
export function viewAgenda() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(y, m-1, prevDays - i);
    cells.push({ key: dateKey(d), day: d.getDate(), out: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: dateKey(new Date(y, m, d)), day: d, out: false });
  }
  while (cells.length % 7 !== 0) {
    const last = parseKey(cells[cells.length-1].key);
    last.setDate(last.getDate() + 1);
    cells.push({ key: dateKey(last), day: last.getDate(), out: true });
  }
  const monthEvents = state.events
    .filter(e => { const d = parseKey(e.date); return d.getFullYear()===y && d.getMonth()===m; })
    .sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));

  const playerMode = isPlayerMode();

  return `
  <div class="cal-bar">
    <button class="btn sm" data-act="cal-prev"><i class="fa-solid fa-chevron-left"></i></button>
    <div class="cal-month">${MONTHS[m]} ${y}</div>
    <button class="btn sm" data-act="cal-next"><i class="fa-solid fa-chevron-right"></i></button>
    <button class="btn sm ghost" data-act="cal-today">Hoje</button>
    <div style="flex:1"></div>
    ${!playerMode ? `<button class="btn primary" data-act="new-event" data-date="${TODAY}"><i class="fa-solid fa-plus"></i> Novo Evento</button>` : ''}
  </div>
  <div class="cal-grid" style="margin-bottom:8px">${WEEK.map(w => `<div class="cal-dow">${w}</div>`).join('')}</div>
  <div class="cal-grid">
    ${cells.map(c => {
      const evs = eventsOn(c.key);
      const isToday = c.key === TODAY;
      return `<div class="cal-day ${c.out?'out':''} ${isToday?'today':''}" ${!playerMode ? `data-act="new-event" data-date="${c.key}"` : ''}>
        <div class="cal-daynum"><span>${c.day}</span>${evs.length?`<span style="color:var(--gold)">${evs.length}</span>`:''}</div>
        ${evs.slice(0,3).map(e => {
          const t = EVENT_TYPES[e.type] || EVENT_TYPES.reuniao;
          return `<div class="cal-ev" style="border-left-color:${t.color}" ${!playerMode ? `data-act="edit-event" data-id="${e.id}"` : ''} title="${esc(e.title)} — ${e.time}">
            ${e.time !== '00:00' ? e.time + ' ' : ''}${esc(e.title)}</div>`;
        }).join('')}
        ${evs.length>3?`<div class="cal-more">+${evs.length-3} mais</div>`:''}
      </div>`;
    }).join('')}
  </div>
  <div class="legend">${Object.entries(EVENT_TYPES).map(([k,v]) => `<span><i style="background:${v.color}"></i>${v.label}</span>`).join('')}</div>

  <div class="card" style="margin-top:22px">
    <div class="card-head">
      <h3><i class="fa-solid fa-list"></i> Eventos de ${MONTHS[m]}</h3>
      <div class="spacer"></div>
      <span style="font-size:11.5px;color:var(--muted)">${monthEvents.length} evento(s)</span>
    </div>
    ${monthEvents.length ? `<div style="display:flex;flex-direction:column;gap:8px">${monthEvents.map(evRowHTML).join('')}</div>`
      : `<div class="empty"><i class="fa-solid fa-calendar-xmark" style="font-size:26px;opacity:.4"></i><br>Nenhum evento neste mês.</div>`}
  </div>`;
}

/* ═══════════════════════════════════════
   VIEW: ROSTER
   ═══════════════════════════════════════ */
export function viewRoster() {
  const order = { titular:0, reserva:1, staff:2, inativo:3 };
  const ps = [...state.players].sort((a,b) =>
    (order[a.status]-order[b.status]) || (ROLE_ORDER[a.role]-ROLE_ORDER[b.role]) || a.nick.localeCompare(b.nick));

  return `
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap">
    <button class="btn primary" data-act="new-player"><i class="fa-solid fa-user-plus"></i> Adicionar Jogador</button>
    <button class="btn" data-act="edit-team"><i class="fa-solid fa-gear"></i> Editar Time</button>
    <div style="flex:1"></div>
    <div style="font-size:12px;color:var(--muted)">
      ${state.players.filter(p=>p.status==='titular').length} titulares ·
      ${state.players.filter(p=>p.status==='reserva').length} reservas
    </div>
  </div>
  ${ps.length ? `<div class="grid g-auto">${ps.map(playerCardHTML).join('')}</div>`
    : `<div class="empty"><i class="fa-solid fa-users" style="font-size:26px;opacity:.4"></i><br>Nenhum jogador cadastrado.</div>`}`;
}

export function playerCardHTML(p) {
  if (!p || typeof p !== 'object') return '';

  const safe = {
    id: p.id || '',
    nick: String(p.nick || 'SEM NOME').trim(),
    name: String(p.name || '').trim(),
    role: p.role || 'MID',
    status: p.status || 'titular',
    pool: Array.isArray(p.pool) ? p.pool.filter(Boolean) : [],
    riot: (p.riot && typeof p.riot === 'object') ? p.riot : {},
  };

  const initials = (safe.nick.slice(0, 2).toUpperCase().replace(/[^\w]/g, '')) || 'XX';
  const sorted = [...safe.pool].sort((a, b) => TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier));
  const hasRiot = safe.riot.gameName && safe.riot.puuid;
  const riotPartial = safe.riot.gameName && !safe.riot.puuid;
  const hasIcon = hasRiot && safe.riot.iconId;

  /* ── Pool: mostra só 3 + "+N" ── */
  const MAX_CHAMPS = 3;
  const visibleChamps = sorted.slice(0, MAX_CHAMPS);
  const extra = sorted.length - MAX_CHAMPS;

  const champsHTML = sorted.length
    ? visibleChamps.map(c =>
        `<span class="champ-mini ${esc((c.tier || 'c').toLowerCase())}" title="${esc(c.champ)} · Tier ${esc(c.tier)}">
          ${esc(c.champ)} <b style="opacity:.65">${esc(c.tier)}</b>
        </span>`
      ).join('') +
      (extra > 0
        ? `<span class="champ-mini more" title="${sorted.slice(MAX_CHAMPS).map(c => `${c.champ} (${c.tier})`).join(', ')}">+${extra}</span>`
        : '')
    : `<span class="champ-mini empty">Sem campeões</span>`;

  /* ── Riot info em 2 rows ── */
  const riotInfoHTML = (hasRiot || riotPartial) ? `
    <div class="riot-info">
      <div class="riot-line-1" title="${esc(safe.riot.gameName)}#${esc(safe.riot.tagLine)}">
        <i class="fa-solid fa-gamepad"></i>
        <span class="riot-name">${esc(safe.riot.gameName)}#${esc(safe.riot.tagLine)}</span>
        ${hasRiot
          ? `<span class="badge-riot ok" title="Conta vinculada"><i class="fa-solid fa-circle-check"></i></span>`
          : `<span class="badge-riot warn" title="Conta sem dados"><i class="fa-solid fa-triangle-exclamation"></i></span>`}
      </div>
      ${hasRiot && safe.riot.rank ? `
        <div class="riot-line-2" title="${esc(safe.riot.rank)}">
          <i class="fa-solid fa-ranking-star"></i>
          <span class="riot-rank">${esc(safe.riot.rank)}</span>
        </div>` : ''}
    </div>` : `<div class="riot-info empty"></div>`;

  return `<div class="player-card">
    <div class="role-tag"><i class="fa-solid ${roleIcon(safe.role)}"></i> ${esc(safe.role)}</div>
    <div class="top">
      <div class="avatar">
        <span class="avatar-initials">${esc(initials)}</span>
        ${hasIcon ? `<img src="${profileIconUrl(safe.riot.iconId)}" alt="" onerror="this.remove()">` : ''}
      </div>
      <div style="flex:1;min-width:0">
        <div class="nick">${esc(safe.nick)}</div>
        <div class="sub">${esc(safe.name || roleName(safe.role))}</div>
        <div style="margin-top:6px"><span class="pill ${esc(safe.status)}">${esc(safe.status)}</span></div>
      </div>
    </div>
    ${riotInfoHTML}
    <div class="pool-header">
      <span>Pool</span>
      <span class="count">${safe.pool.length}</span>
    </div>
    <div class="champ-mini-list">${champsHTML}</div>
    <div class="card-actions">
      <button class="btn sm primary" data-act="open-player-detail" data-id="${esc(safe.id)}" style="flex:1;justify-content:center">
        <i class="fa-solid fa-chart-line"></i> Dashboard
      </button>
      <button class="btn sm" data-act="open-pool" data-id="${esc(safe.id)}" title="Pool"><i class="fa-solid fa-dragon"></i></button>
      <button class="btn sm" data-act="edit-player" data-id="${esc(safe.id)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
      <button class="btn sm danger" data-act="del-player" data-id="${esc(safe.id)}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

let activePlayerId = null;
export const getActivePlayerId = () => activePlayerId;
export const setActivePlayerId = id => { activePlayerId = id; };

/* ═══════════════════════════════════════
   VIEW: POOLS
   ═══════════════════════════════════════ */
export function viewPools() {
  if (!state.players.length) return `<div class="empty"><i class="fa-solid fa-users" style="font-size:26px;opacity:.4"></i><br>Cadastre jogadores primeiro.</div>`;
  if (!activePlayerId || !state.players.find(p => p.id === activePlayerId))
    activePlayerId = state.players[0].id;
  const p = state.players.find(x => x.id === activePlayerId);
  if (!p) return `<div class="empty">Jogador não encontrado.</div>`;
  if (!Array.isArray(p.pool)) p.pool = [];

  const byTier = t => p.pool.filter(c => c.tier === t);
  const playerMode = isPlayerMode();

  return `
  <div class="tabs">
    ${state.players.map(x => `
      <button class="tab ${x.id===activePlayerId?'active':''}" data-act="select-player" data-id="${x.id}">
        <span class="dot" style="color:${x.status==='titular'?'#5ee08c':x.status==='reserva'?'#f7bd4a':'#7fb2ff'}"></span>
        ${esc(x.nick)} <span style="opacity:.6;font-size:11px">${x.role}</span>
        <span style="opacity:.5;font-size:11px">(${Array.isArray(x.pool) ? x.pool.length : 0})</span>
      </button>`).join('')}
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">
    <div class="avatar" style="width:46px;height:46px;flex:0 0 46px;font-size:17px">${esc(p.nick.slice(0,2).toUpperCase())}</div>
    <div>
      <div style="font-size:17px;font-weight:700;color:var(--gold2)">${esc(p.nick)}</div>
      <div style="font-size:12px;color:var(--muted)">${roleName(p.role)} · ${p.status}${p.name?' · '+esc(p.name):''}</div>
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;gap:8px;font-size:12px;color:var(--muted);margin-right:8px">
      ${TIERS.map(t => `<span style="padding:4px 10px;border-radius:6px;background:#101823;border:1px solid var(--border)">
        <b class="tier ${t}" style="display:inline-grid;width:18px;height:18px;font-size:10px;vertical-align:middle;margin-right:5px">${t}</b>${byTier(t).length}</span>`).join('')}
    </div>
    ${canEditPool(p.id) ? `<button class="btn primary" data-act="new-champ" data-pid="${p.id}"><i class="fa-solid fa-plus"></i> Campeão</button>` : ''}
  </div>
  ${p.pool.length ? TIERS.filter(t => byTier(t).length).map(t => `
    <div style="margin-bottom:22px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:11px">
        <span class="tier ${t}" style="width:24px;height:24px;font-size:13px">${t}</span>
        <span style="font-size:11.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--gold);font-weight:700">
          ${t==='S'?'Prioridade Máxima':t==='A'?'Sólido':t==='B'?'Situacional':'Em desenvolvimento'}
        </span>
        <div style="flex:1;height:1px;background:var(--border-soft)"></div>
        <span style="font-size:11px;color:var(--muted)">${byTier(t).length}</span>
      </div>
      <div class="grid g-auto">${byTier(t).map(c => champCardHTML(c, p.id)).join('')}</div>
    </div>`).join('')
  : `<div class="empty"><i class="fa-solid fa-dragon" style="font-size:26px;opacity:.4"></i><br>Nenhum campeão na pool de ${esc(p.nick)}.</div>`}`;
}

export function champCardHTML(c, pid) {
  const pt = PICK_TYPES[c.type] || PICK_TYPES.blind;
  const splash = championSplashUrl(c.champ);

  return `<div class="champ-card" data-tier="${esc(c.tier)}">
    <div class="champ-bg">
      <img src="${splash}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
    </div>
    <div class="champ-overlay"></div>
    <div class="champ-content">
      <div class="champ-head">
        <div class="champ-name">${esc(c.champ)}</div>
        <div class="tier ${esc(c.tier)}">${esc(c.tier)}</div>
      </div>
      <div class="champ-body">
        <span class="tag ${pt.cls}">${pt.label}</span>
        ${c.notes ? `<div class="champ-notes">${esc(c.notes)}</div>` : ''}
      </div>
      <div class="champ-actions">
        ${canEditPool(pid) ? `
          <button class="icon-btn" data-act="edit-champ" data-pid="${pid}" data-id="${c.id}" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="icon-btn" data-act="del-champ" data-pid="${pid}" data-id="${c.id}" title="Remover">
            <i class="fa-solid fa-trash"></i>
          </button>` : ''}
      </div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════
   VIEW: MATRIX
   ═══════════════════════════════════════ */
export function viewMatrix() {
  const players = [...state.players]
    .filter(p => p.status !== 'staff')
    .sort((a,b) => ROLE_ORDER[a.role]-ROLE_ORDER[b.role]);
  if (!players.length) return `<div class="empty"><i class="fa-solid fa-table" style="font-size:26px;opacity:.4"></i><br>Sem jogadores.</div>`;

  const map = new Map();
  players.forEach(p => {
    const pool = Array.isArray(p.pool) ? p.pool : [];
    pool.forEach(c => {
      if (!map.has(c.champ)) map.set(c.champ, {});
      map.get(c.champ)[p.id] = c.tier;
    });
  });
  const rows = [...map.entries()].map(([champ, tiers]) => {
    const owners = Object.values(tiers);
    const best = TIERS.find(t => owners.includes(t)) || 'C';
    return { champ, tiers, best, count: owners.length };
  }).sort((a,b) => (TIERS.indexOf(a.best)-TIERS.indexOf(b.best)) || (b.count-a.count) || a.champ.localeCompare(b.champ));

  return `
  <div class="card" style="margin-bottom:16px">
    <div class="card-head"><h3><i class="fa-solid fa-table"></i> Cobertura — ${rows.length} campeões</h3></div>
    <div style="font-size:12.5px;color:var(--muted)">Campeões com apenas 1 dono são pontos de fragilidade em draft.</div>
  </div>
  <div class="matrix-wrap">
    <table class="matrix">
      <thead><tr><th>Campeão</th>
        ${players.map(p => `<th>${esc(p.nick)}<br><span style="color:var(--muted);font-weight:500;font-size:9.5px">${p.role}</span></th>`).join('')}
        <th>Cobertura</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td>${esc(r.champ)}</td>
          ${players.map(p => {
            const t = r.tiers[p.id];
            return t ? `<td class="cell-${t}">${t}</td>` : `<td class="cell-empty">—</td>`;
          }).join('')}
          <td style="color:${r.count===1?'#ff9b9b':r.count>=3?'#5ee08c':'var(--muted)'};font-weight:700">${r.count}${r.count===1?' <i class="fa-solid fa-triangle-exclamation"></i>':''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}


export function viewScrims() {
  const rec = scrimRecord();
  const sorted = [...state.scrims].sort((a,b) => b.date.localeCompare(a.date));
  const playerMode = isPlayerMode();

  const roleRoster = (label, nick) => nick
    ? `<span class="opp-player" title="${label}: ${esc(nick)}">${esc(nick)}</span>`
    : '';

  return `
  <div class="grid g-3" style="margin-bottom:18px">
    <div class="stat"><div class="lbl">Total de Scrims</div><div class="val">${rec.total}</div></div>
    <div class="stat green"><div class="lbl">Vitórias</div><div class="val">${rec.w}</div></div>
    <div class="stat red"><div class="lbl">Derrotas</div><div class="val">${rec.l}</div></div>
  </div>
  ${!playerMode ? `<div style="display:flex;gap:10px;margin-bottom:16px">
    <button class="btn primary" data-act="new-scrim"><i class="fa-solid fa-plus"></i> Registrar Scrim</button>
  </div>` : ''}
  ${sorted.length ? `<div style="display:flex;flex-direction:column;gap:12px">
    ${sorted.map(s => `
      <div class="scrim-card">
        <div class="scrim-head">
          <div class="res-badge res-${s.result}">${s.result}</div>
          <div style="flex:1;min-width:0">
            <div class="scrim-vs">vs ${esc(s.opponent)}</div>
            <div class="scrim-meta">
              <span><i class="fa-regular fa-calendar"></i> ${fmtShort(s.date)}</span>
              ${s.format ? `<span>·</span><span>${esc(s.format)}</span>` : ''}
            </div>
          </div>
          <div class="scrim-score">${esc(s.score || '—')}</div>
          ${!playerMode ? `
            <div style="display:flex;gap:4px">
              <button class="icon-btn" data-act="edit-scrim" data-id="${s.id}"><i class="fa-solid fa-pen"></i></button>
              <button class="icon-btn" data-act="del-scrim" data-id="${s.id}"><i class="fa-solid fa-trash"></i></button>
            </div>` : ''}
        </div>
        ${s.opponentRoster && Object.values(s.opponentRoster).some(Boolean) ? `
          <div class="tourn-roster">
            <span class="tourn-roster-label"><i class="fa-solid fa-users-viewfinder"></i> Roster inimigo:</span>
            ${roleRoster('TOP', s.opponentRoster.TOP)}
            ${roleRoster('JNG', s.opponentRoster.JNG)}
            ${roleRoster('MID', s.opponentRoster.MID)}
            ${roleRoster('ADC', s.opponentRoster.ADC)}
            ${roleRoster('SUP', s.opponentRoster.SUP)}
          </div>` : ''}
        ${s.notes ? `<div class="tourn-notes">${esc(s.notes)}</div>` : ''}
      </div>
    `).join('')}
  </div>` : `<div class="empty"><i class="fa-solid fa-flag" style="font-size:26px;opacity:.4"></i><br>Nenhuma scrim registrada.</div>`}`;
}

export function viewDraft() {
  const d = state.draft;
  const playerMode = isPlayerMode();
  const slot = (side, kind, i) => `
    <div class="slot-row ${kind==='ban'?'ban':''}">
      <span class="idx">${kind==='ban'?'B':'P'}${i+1}</span>
      <input list="champ-list" data-draft="${side}.${kind}.${i}"
             value="${esc(d[side][kind][i]||'')}" placeholder="${kind==='ban'?'Ban…':'Pick…'}" autocomplete="off"
             ${playerMode ? 'readonly' : ''}>
    </div>`;
  return `
  ${!playerMode ? `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
    <button class="btn primary" data-act="save-draft"><i class="fa-solid fa-floppy-disk"></i> Salvar Draft</button>
    <button class="btn" data-act="clear-draft"><i class="fa-solid fa-eraser"></i> Limpar</button>
    <div style="flex:1"></div>
    <span style="font-size:12px;color:var(--muted)">${state.drafts.length} draft(s) salvo(s)</span>
  </div>` : `
  <div style="font-size:12.5px;color:var(--muted);margin-bottom:16px">
    <i class="fa-solid fa-eye"></i> Modo visualização
  </div>`}
  <div class="draft-board">
    <div class="side blue">
      <h4><i class="fa-solid fa-cube"></i> Lado Azul</h4>
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:700;margin-bottom:8px">Bans</div>
      ${[0,1,2,3,4].map(i => slot('blue','bans',i)).join('')}
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:700;margin:14px 0 8px">Picks</div>
      ${[0,1,2,3,4].map(i => slot('blue','picks',i)).join('')}
    </div>
    <div class="draft-mid"><div class="vs">VS</div></div>
    <div class="side red">
      <h4><i class="fa-solid fa-fire"></i> Lado Vermelho</h4>
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:700;margin-bottom:8px">Bans</div>
      ${[0,1,2,3,4].map(i => slot('red','bans',i)).join('')}
      <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:700;margin:14px 0 8px">Picks</div>
      ${[0,1,2,3,4].map(i => slot('red','picks',i)).join('')}
    </div>
  </div>
  ${!playerMode && state.drafts.length ? `
  <div class="card" style="margin-top:22px">
    <div class="card-head"><h3><i class="fa-solid fa-floppy-disk"></i> Drafts Salvos</h3></div>
    <div class="grid g-auto">
      ${state.drafts.map(dr => `
        <div class="note-card">
          <div class="nhead">
            <div class="ntitle">${esc(dr.name)}</div>
            <button class="icon-btn" data-act="del-draft" data-id="${dr.id}"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div style="font-size:11.5px;color:var(--muted)">${fmtShort(dr.date)}</div>
          <div style="font-size:11.5px;line-height:1.6">
            <div><b style="color:#7fb2ff">Azul:</b> ${dr.blue.picks.filter(Boolean).map(esc).join(', ')||'—'}</div>
            <div><b style="color:#ff9b9b">Vermelho:</b> ${dr.red.picks.filter(Boolean).map(esc).join(', ')||'—'}</div>
          </div>
          <button class="btn sm" data-act="load-draft" data-id="${dr.id}"><i class="fa-solid fa-upload"></i> Carregar</button>
        </div>`).join('')}
    </div>
  </div>` : ''}`;
}

export function bindDraft() {
  if (isPlayerMode()) return;
  document.querySelectorAll('[data-draft]').forEach(inp => {
    inp.addEventListener('input', () => {
      const [side, kind, i] = inp.dataset.draft.split('.');
      state.draft[side][kind][+i] = inp.value;
    });
  });
}

export function viewTasks() {
  const playerMode = isPlayerMode();
  const myNick = window.__akiPlayerNick || '';

  let tasks = [...state.tasks];

  if (playerMode && myNick) {
    tasks = tasks.filter(t => t.assignee === myNick);
  }

  tasks.sort((a, b) => (a.done === b.done)
    ? (a.due || '').localeCompare(b.due || '')
    : (a.done ? 1 : -1));

  return `
  ${!playerMode ? `
  <div style="display:flex;gap:10px;margin-bottom:16px">
    <button class="btn primary" data-act="new-task"><i class="fa-solid fa-plus"></i> Nova Tarefa</button>
  </div>` : ''}
  ${tasks.length ? `<div style="display:flex;flex-direction:column;gap:8px">
    ${tasks.map(t => `
      <div class="task-row ${t.done?'done':''}">
        <button class="task-check ${t.done?'checked':''}" data-act="toggle-task" data-id="${t.id}">
          <i class="fa-solid fa-check"></i>
        </button>
        <div style="flex:1;min-width:0">
          <div class="task-title">${esc(t.title)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">
            ${t.assignee ? `<i class="fa-solid fa-user"></i> ${esc(t.assignee)}` : ''}
            ${t.due ? ` · <i class="fa-regular fa-calendar"></i> ${fmtShort(t.due)}` : ''}
            ${t.priority ? ` · <span style="color:${t.priority==='alta'?'#ff9b9b':t.priority==='média'?'#f7bd4a':'var(--muted)'}">${t.priority}</span>` : ''}
          </div>
        </div>
        ${!playerMode ? `
          <button class="icon-btn" data-act="edit-task" data-id="${t.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn" data-act="del-task" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>`).join('')}
  </div>` : `<div class="empty"><i class="fa-solid fa-list-check" style="font-size:26px;opacity:.4"></i><br>${playerMode ? 'Você não tem tarefas atribuídas.' : 'Nenhuma tarefa.'}</div>`}`;
}


export function viewOpponents() {
  const playerMode = isPlayerMode();
  return `
  ${!playerMode ? `<div style="display:flex;gap:10px;margin-bottom:16px">
    <button class="btn primary" data-act="new-opponent"><i class="fa-solid fa-plus"></i> Adicionar Oponente</button>
  </div>` : ''}
  ${state.opponents.length ? `<div class="grid g-auto">
    ${state.opponents.map(o => `
      <div class="opp-card">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="flex:1">
            <div class="opp-name">${esc(o.name)}</div>
            <div class="opp-tag">${esc(o.tag||'')}</div>
          </div>
          ${!playerMode ? `
            <button class="icon-btn" data-act="edit-opponent" data-id="${o.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn" data-act="del-opponent" data-id="${o.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
        ${o.playstyle?`<div class="opp-stat"><i class="fa-solid fa-gamepad"></i> ${esc(o.playstyle)}</div>`:''}
        ${o.weakness?`<div class="opp-stat" style="color:#f7bd4a"><i class="fa-solid fa-triangle-exclamation"></i> ${esc(o.weakness)}</div>`:''}
        ${o.bans?`<div class="opp-stat"><i class="fa-solid fa-ban"></i> Bans: ${esc(o.bans)}</div>`:''}
        ${o.picks?`<div class="opp-stat"><i class="fa-solid fa-star"></i> Picks: ${esc(o.picks)}</div>`:''}
        ${o.notes?`<div style="font-size:11.5px;color:var(--muted);margin-top:8px;font-style:italic">${esc(o.notes)}</div>`:''}
        <div style="margin-top:10px;font-size:11px;color:var(--muted)">
          H2H: <b style="color:${o.wins>o.losses?'#5ee08c':o.wins<o.losses?'#ff9b9b':'var(--muted)'}">${o.wins||0}V — ${o.losses||0}D</b>
        </div>
      </div>`).join('')}
  </div>` : `<div class="empty"><i class="fa-solid fa-chess" style="font-size:26px;opacity:.4"></i><br>Nenhum oponente mapeado.</div>`}`;
}


export function viewNotes() {
  const playerMode = isPlayerMode();
  const sorted = [...state.notes].sort((a,b) => (b.date||'').localeCompare(a.date||''));
  return `
  ${!playerMode ? `<div style="display:flex;gap:10px;margin-bottom:16px">
    <button class="btn primary" data-act="new-note"><i class="fa-solid fa-plus"></i> Nova Anotação</button>
  </div>` : ''}
  ${sorted.length ? `<div class="grid g-auto">
    ${sorted.map(n => `
      <div class="note-card">
        <div class="nhead">
          <div class="ntitle">${esc(n.title)}</div>
          ${!playerMode ? `
            <button class="icon-btn" data-act="edit-note" data-id="${n.id}"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn" data-act="del-note" data-id="${n.id}"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
        ${n.body?`<div class="nbody">${esc(n.body)}</div>`:''}
        <div class="nfoot">
          ${n.tag?`<span class="tag">${esc(n.tag)}</span>`:''}
          <span>${n.date?fmtShort(n.date):''}</span>
        </div>
      </div>`).join('')}
  </div>` : `<div class="empty"><i class="fa-solid fa-pen" style="font-size:26px;opacity:.4"></i><br>Nenhuma anotação.</div>`}`;
}

export function viewPlayerDetail() {
  const pid = window.__akiCurrentPlayer || null;
  const p = state.players.find(x => x.id === pid);
  if (!p) return `<div class="empty"><i class="fa-solid fa-user-slash" style="font-size:26px;opacity:.4"></i><br>Jogador não encontrado.</div>`;

  const riot = (p.riot && typeof p.riot === 'object') ? p.riot : {};
  const hasRiot = riot.gameName && riot.puuid;
  const partial = riot.gameName && !riot.puuid;
  const stats = riot.stats;
  const playerMode = isPlayerMode();

  return `
  ${!playerMode ? `
    <div style="margin-bottom:16px">
      <button class="btn ghost" data-act="nav" data-view="roster"><i class="fa-solid fa-arrow-left"></i> Voltar ao Roster</button>
    </div>` : ''}
  <div class="pd-hero">
    <div class="pd-avatar">
      <span class="avatar-initials">${esc(p.nick.slice(0,2).toUpperCase())}</span>
      ${riot.iconId ? `<img src="${profileIconUrl(riot.iconId)}" alt="" onerror="this.remove()">` : ''}
      ${riot.level ? `<div class="pd-level">${riot.level}</div>` : ''}
    </div>
    <div class="pd-info">
      <div class="pd-name">${esc(p.nick)}<span class="pill ${p.status}" style="margin-left:8px">${p.status}</span></div>
      <div class="pd-sub">
        <i class="fa-solid ${roleIcon(p.role)}"></i> ${roleName(p.role)}
        ${riot.gameName ? ` · <i class="fa-solid fa-gamepad"></i> ${esc(riot.gameName)}#${esc(riot.tagLine)}` : ''}
      </div>
      ${riot.rank ? `<div class="pd-rank"><i class="fa-solid fa-ranking-star"></i> ${esc(riot.rank)}</div>` : ''}
    </div>
    <div class="pd-actions">
      ${hasRiot ? `
        <button class="btn primary" data-act="load-stats" data-id="${p.id}">
          <i class="fa-solid ${stats ? 'fa-rotate' : 'fa-cloud-arrow-down'}"></i>
          ${stats ? 'Atualizar' : 'Carregar Stats'}
        </button>
        ${!playerMode ? `<button class="btn" data-act="link-riot" data-id="${p.id}"><i class="fa-solid fa-link"></i> Riot</button>` : ''}
      ` : (!playerMode ? `<button class="btn primary" data-act="link-riot" data-id="${p.id}"><i class="fa-solid fa-link"></i> Vincular Riot</button>` : '')}
    </div>
  </div>

  ${!hasRiot ? `
    <div class="empty" style="padding:60px 20px">
      <i class="fa-solid ${partial ? 'fa-triangle-exclamation' : 'fa-link-slash'}" style="font-size:34px;opacity:.35;color:${partial ? '#ff9b9b' : 'inherit'}"></i>
      <div style="margin-top:12px;font-size:14px;color:var(--text)">
        ${partial
          ? `Conta <b>${esc(riot.gameName)}#${esc(riot.tagLine)}</b> salva mas sem dados da Riot`
          : (playerMode ? 'Peça ao coach para vincular sua conta Riot' : 'Vincule a conta Riot para ver o dashboard')}
      </div>
      ${partial && riot.lastError ? `
        <div style="margin-top:10px;font-size:12px;color:#ff9b9b;max-width:520px;margin-left:auto;margin-right:auto;padding:8px 12px;background:rgba(224,82,82,.08);border:1px solid rgba(224,82,82,.25);border-radius:6px">
          <i class="fa-solid fa-circle-exclamation"></i> ${esc(riot.lastError)}
        </div>` : ''}
      ${partial && !playerMode ? `
        <div style="margin-top:16px">
          <button class="btn primary" data-act="link-riot" data-id="${p.id}">
            <i class="fa-solid fa-rotate"></i> Tentar novamente
          </button>
        </div>` : ''}
    </div>
  ` : !stats ? `
    <div class="empty" style="padding:60px 20px">
      <i class="fa-solid fa-cloud-arrow-down" style="font-size:34px;opacity:.35"></i>
      <div style="margin-top:12px;font-size:14px;color:var(--text)">Estatísticas não carregadas</div>
      <div style="margin-top:6px;font-size:12px">Clique em "Carregar Stats" para buscar as últimas partidas</div>
    </div>
  ` : renderStats(stats)}`;
}

function renderStats(s) {
  const streakClass = s.streak.type === 'W' ? 'green' : s.streak.type === 'L' ? 'red' : '';
  return `
  <div class="grid g-4" style="margin-bottom:18px">
    <div class="stat ${s.winrate >= 50 ? 'green' : 'red'}">
      <div class="lbl">Winrate (últimas ${s.total})</div>
      <div class="val">${s.winrate}%</div>
      <div class="note">${s.wins}V — ${s.losses}D</div>
    </div>
    <div class="stat blue">
      <div class="lbl">KDA Médio</div>
      <div class="val">${s.kda}</div>
      <div class="note">${s.avgKills} / ${s.avgDeaths} / ${s.avgAssists}</div>
    </div>
    <div class="stat teal">
      <div class="lbl">CS / min</div>
      <div class="val">${s.avgCsPerMin}</div>
      <div class="note">média por partida</div>
    </div>
    <div class="stat ${streakClass}">
      <div class="lbl">Streak Atual</div>
      <div class="val">${s.streak.count}${s.streak.type || ''}</div>
      <div class="note">${s.streak.type === 'W' ? 'vitórias seguidas' : s.streak.type === 'L' ? 'derrotas seguidas' : 'sem dados'}</div>
    </div>
  </div>
  <div class="grid g-2" style="margin-bottom:18px">
    <div class="card">
      <div class="card-head">
        <h3><i class="fa-solid fa-dragon"></i> Campeões Mais Jogados</h3>
        <div class="spacer"></div>
        <span style="font-size:11px;color:var(--muted)">${s.champions.length} campeões</span>
      </div>
      ${s.champions.length ? `<div style="display:flex;flex-direction:column;gap:9px">
        ${s.champions.slice(0, 8).map(c => `
          <div class="champ-bar">
            <img class="champ-icon" src="${championIconUrl(c.champion)}"
                 onerror="this.style.visibility='hidden'" alt="">
            <div style="flex:1;min-width:0">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
                <span style="font-weight:600;font-size:13px">${esc(c.champion)}</span>
                <span style="font-size:11px;color:${c.winrate >= 50 ? '#5ee08c' : '#ff9b9b'};font-weight:700">
                  ${c.winrate}% <span style="color:var(--muted);font-weight:400">(${c.wins}V-${c.losses}D)</span>
                </span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" style="width:${c.winrate}%;background:${c.winrate >= 50 ? 'linear-gradient(90deg,#22c55e,#5ee08c)' : 'linear-gradient(90deg,#e05252,#ff9b9b)'}"></div>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted);margin-top:3px">
                <span>${c.games} jogo(s) · KDA ${c.kda}</span>
                <span>${c.csPerMin} CS/min</span>
              </div>
            </div>
          </div>`).join('')}
      </div>` : `<div class="empty">Sem partidas</div>`}
    </div>
    <div class="card">
      <div class="card-head"><h3><i class="fa-solid fa-chart-pie"></i> Distribuição por Posição</h3></div>
      ${s.roles.length ? `<div style="display:flex;flex-direction:column;gap:10px">
        ${s.roles.map(r => {
          const pct = Math.round(r.games / s.total * 100);
          return `<div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
              <span><b style="color:var(--gold2)">${r.role}</b> · ${r.games} jogo(s)</span>
              <span style="color:${r.winrate >= 50 ? '#5ee08c' : '#ff9b9b'};font-weight:700">${r.winrate}% WR</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--blue),var(--teal))"></div>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div class="empty">—</div>`}
      <div style="margin-top:20px;padding-top:14px;border-top:1px solid var(--border-soft)">
        <div class="card-head" style="margin-bottom:10px"><h3><i class="fa-solid fa-gauge"></i> Médias por Partida</h3></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12.5px">
          <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Dano médio</span><b>${(s.avgDamage/1000).toFixed(1)}k</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Visão média</span><b>${s.avgVision}</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Kills</span><b>${s.avgKills}</b></div>
          <div style="display:flex;justify-content:space-between"><span style="color:var(--muted)">Mortes</span><b>${s.avgDeaths}</b></div>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-head">
      <h3><i class="fa-solid fa-clock-rotate-left"></i> Últimas Partidas</h3>
      <div class="spacer"></div>
      <span style="font-size:11px;color:var(--muted)">atualizado ${new Date(s.updatedAt).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${s.matches.map(m => `
        <div class="match-row ${m.win ? 'win' : 'loss'}">
          <div class="match-result">${m.win ? 'W' : 'L'}</div>
          <img class="champ-icon-sm" src="${championIconUrl(m.champion)}"
               onerror="this.style.visibility='hidden'" alt="">
          <div class="match-champ">${esc(m.champion)}</div>
          <div class="match-kda"><b>${m.kills}</b> / <span style="color:#ff9b9b">${m.deaths}</span> / <b>${m.assists}</b></div>
          <div class="match-cs">${m.cs} CS <span style="color:var(--muted)">(${m.csPerMin.toFixed(1)}/m)</span></div>
          <div class="match-role">${m.role}</div>
          <div class="match-time">${Math.floor(m.durationMin)}min</div>
          <div class="match-date">${fmtShort(m.dateStr)}</div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

export function viewComps() {
  const playerMode = isPlayerMode();
  const myId = window.__akiCurrentPlayer || null;

  const list = [...(state.comps || [])].sort((a, b) => {
    // Ordem: testar primeiro, depois aprovada, recusada por último
    const order = { testar: 0, aprovada: 1, recusada: 2 };
    const d = (order[a.status] ?? 3) - (order[b.status] ?? 3);
    if (d !== 0) return d;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const statusMeta = {
    testar:   { label: 'Testar',   color: '#f7bd4a', icon: 'fa-flask' },
    aprovada: { label: 'Aprovada', color: '#5ee08c', icon: 'fa-circle-check' },
    recusada: { label: 'Recusada', color: '#ff9b9b', icon: 'fa-circle-xmark' },
  };

  const roleLine = (label, role, champ) => `
    <div class="comp-role">
      <span class="comp-role-label">${label}</span>
      <span class="comp-role-champ">${champ ? esc(champ) : '—'}</span>
    </div>`;

  const cardHTML = (c) => {
    const meta = statusMeta[c.status] || statusMeta.testar;
    const isOwner = !playerMode || c.authorId === myId;
    const isCoach = !playerMode;
    const champs = c.champs || {};

    return `<div class="comp-card" data-act="view-comp" data-id="${c.id}" title="Clique para ler">
      <div class="comp-card-head">
        <div style="flex:1;min-width:0">
          <div class="comp-title">${esc(c.name || 'Sem nome')}</div>
          <div class="comp-author">
            <i class="fa-solid fa-user-pen"></i>
            ${esc(c.author || 'Anônimo')}
          </div>
        </div>
        <span class="comp-status" style="color:${meta.color};border-color:${meta.color}40;background:${meta.color}15">
          <i class="fa-solid ${meta.icon}"></i> ${meta.label}
        </span>
      </div>

      <div class="comp-roles">
        ${roleLine('TOP', 'TOP', champs.TOP)}
        ${roleLine('JNG', 'JNG', champs.JNG)}
        ${roleLine('MID', 'MID', champs.MID)}
        ${roleLine('ADC', 'ADC', champs.ADC)}
        ${roleLine('SUP', 'SUP', champs.SUP)}
      </div>

      ${(c.bans?.priority?.filter(Boolean).length || c.bans?.optional?.filter(Boolean).length) ? `
      <div class="comp-bans">
        ${c.bans.priority?.filter(Boolean).length ? `
          <div class="comp-ban-line">
            <span class="comp-ban-label" style="color:#ff9b9b">
              <i class="fa-solid fa-ban"></i> Prioridade
            </span>
            <span class="comp-ban-champs">${c.bans.priority.filter(Boolean).map(esc).join(', ')}</span>
          </div>` : ''}
        ${c.bans.optional?.filter(Boolean).length ? `
          <div class="comp-ban-line">
            <span class="comp-ban-label" style="color:#a8bcd4">
              <i class="fa-solid fa-ban"></i> Opcional
            </span>
            <span class="comp-ban-champs">${c.bans.optional.filter(Boolean).map(esc).join(', ')}</span>
          </div>` : ''}
      </div>` : ''}

      ${c.description ? `<div class="comp-desc">${esc(c.description)}</div>` : ''}

      <div class="comp-read-hint">
        <i class="fa-solid fa-expand"></i> Clique para ler a composição completa
      </div>

      <div class="comp-actions">
        ${isCoach && c.status !== 'aprovada' ? `
          <button class="btn sm" data-act="comp-approve" data-id="${c.id}" title="Aprovar">
            <i class="fa-solid fa-circle-check"></i> Aprovar
          </button>` : ''}
        ${isCoach && c.status !== 'recusada' ? `
          <button class="btn sm" data-act="comp-reject" data-id="${c.id}" title="Recusar">
            <i class="fa-solid fa-circle-xmark"></i> Recusar
          </button>` : ''}
        ${isCoach && c.status !== 'testar' ? `
          <button class="btn sm" data-act="comp-test" data-id="${c.id}" title="Voltar a testar">
            <i class="fa-solid fa-flask"></i> Testar
          </button>` : ''}
        <div style="flex:1"></div>
        ${isOwner ? `
          <button class="icon-btn" data-act="edit-comp" data-id="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn" data-act="del-comp" data-id="${c.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        ` : ''}
      </div>
    </div>`;
  };

  return `
  <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
    <button class="btn primary" data-act="new-comp"><i class="fa-solid fa-plus"></i> Nova Composição</button>
    <div style="flex:1"></div>
    <div style="display:flex;gap:10px;font-size:11.5px;color:var(--muted)">
      <span><i class="fa-solid fa-flask" style="color:#f7bd4a"></i> Testar</span>
      <span><i class="fa-solid fa-circle-check" style="color:#5ee08c"></i> Aprovada</span>
      <span><i class="fa-solid fa-circle-xmark" style="color:#ff9b9b"></i> Recusada</span>
    </div>
  </div>
  ${list.length ? `<div class="grid g-auto">${list.map(cardHTML).join('')}</div>`
    : `<div class="empty"><i class="fa-solid fa-layer-group" style="font-size:26px;opacity:.4"></i><br>Nenhuma composição ainda. ${playerMode ? 'Envie a sua!' : 'Crie a primeira.'}</div>`}`;
}