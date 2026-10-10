import {
  state, ROLES, EVENT_TYPES, TIERS, PICK_TYPES, TODAY, uid, esc, saveToFirebase,
  hashPin, generatePin
} from './state.js';
import { toast, toastIcon } from './ui.js';
import {
  getAccountByRiotId, getSummonerByPuuid, getRankedStats,
  getChampionMastery, fetchPlayerStats, setCachedStats
} from './riot-api.js';
import { setPlayerIndex, removePlayerIndex } from './firebase.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let renderFn = null;
let goFn = null;
let calShiftFn = null;
let calResetFn = null;

export function setRender(fn) { renderFn = fn; }
export function setGo(fn) { goFn = fn; }
export function setCalHandlers(shift, reset) { calShiftFn = shift; calResetFn = reset; }

function render() { if (renderFn) renderFn(); }
function save() { saveToFirebase().catch(e => console.warn('Save falhou:', e)); }
function isPlayerMode() { return document.body.classList.contains('player-mode'); }

export function openModal({ title, body, submitLabel = 'Salvar', onSubmit, wide = false, danger = false, icon = 'fa-pen-to-square', onMount }) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal ${wide?'wide':''}">
        <div class="modal-head">
          <i class="fa-solid ${icon}" style="color:var(--gold)"></i>
          <h3>${esc(title)}</h3>
          <button class="icon-btn" data-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="modal-form" autocomplete="off">
          <div class="modal-body">${body}</div>
          <div class="modal-foot">
            <button type="button" class="btn ghost" data-close>Cancelar</button>
            <button type="submit" class="btn ${danger?'danger':'primary'}">${esc(submitLabel)}</button>
          </div>
        </form>
      </div>
    </div>`;
  const backdrop = $('.modal-backdrop', root);
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closeModal(); });
  $$('[data-close]', root).forEach(b => b.addEventListener('click', closeModal));
  $('#modal-form', root).addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    if (onSubmit(data) !== false) closeModal();
  });
  document.addEventListener('keydown', escHandler);
  setTimeout(() => {
    const f = $('#modal-form input, #modal-form select, #modal-form textarea', root);
    if (f) f.focus();
    if (onMount) onMount();
  }, 40);
}

function escHandler(e) { if (e.key === 'Escape') closeModal(); }

export function closeModal() {
  $('#modal-root').innerHTML = '';
  document.removeEventListener('keydown', escHandler);
}

const field = (label, inner) => `<div class="field"><label>${label}</label>${inner}</div>`;

export function modalEvent(id, presetDate) {
  const e = id ? state.events.find(x => x.id === id) : null;
  const body = `
    <div class="row-2">
      ${field('Data', `<input type="date" name="date" required value="${esc(e?.date || presetDate || TODAY)}">`)}
      ${field('Hora', `<input type="time" name="time" value="${esc(e?.time || '14:00')}">`)}
    </div>
    ${field('Tipo', `<select name="type">${Object.entries(EVENT_TYPES).map(([k,v]) => `<option value="${k}" ${e?.type===k?'selected':''}>${v.label}</option>`).join('')}</select>`)}
    ${field('Título', `<input name="title" required maxlength="80" value="${esc(e?.title || '')}">`)}
    <div class="row-2">
      ${field('Oponente', `<input name="opponent" value="${esc(e?.opponent || '')}">`)}
      ${field('Duração (min)', `<input type="number" name="duration" min="0" step="15" value="${esc(e?.duration ?? 120)}">`)}
    </div>
    ${field('Notas', `<textarea name="notes">${esc(e?.notes || '')}</textarea>`)}`;
  openModal({
    title: e ? 'Editar Evento' : 'Novo Evento', icon: 'fa-calendar-plus', body,
    onSubmit: d => {
      if (!d.title.trim()) return false;
      const payload = {
        date: d.date, time: d.time||'00:00', type: d.type,
        title: d.title.trim(), opponent: d.opponent.trim(),
        duration: +d.duration||0, notes: d.notes.trim()
      };
      if (e) Object.assign(e, payload);
      else state.events.push({ id: uid(), ...payload });
      save(); render(); toastIcon(e ? 'Evento atualizado' : 'Evento criado');
    }
  });
}

export function modalPlayer(id) {
  const p = id ? state.players.find(x => x.id === id) : null;
  const hasPin = !!p?.pinHash;
  const pinField = `
    <div class="field">
      <label>PIN do jogador ${hasPin ? '(ativo)' : ''}</label>
      <div style="display:flex;gap:6px">
        <input name="pin" id="pin-input" maxlength="8" inputmode="numeric"
               placeholder="${hasPin ? 'Deixe vazio para manter' : 'Ex: 123456'}"
               value="" autocomplete="off" style="flex:1">
        <button type="button" class="btn" id="pin-generate" title="Gerar PIN">
          <i class="fa-solid fa-dice"></i>
        </button>
      </div>
      ${hasPin ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">
        <i class="fa-solid fa-info-circle"></i> Jogador já tem PIN. Deixe vazio para manter, ou digite um novo.
      </div>` : `<div style="font-size:11px;color:var(--muted);margin-top:4px">
        <i class="fa-solid fa-info-circle"></i> O jogador fará login com <b>nick + PIN</b>.
      </div>`}
    </div>`;
  const body = `
    <div class="row-2">
      ${field('Nickname', `<input name="nick" required maxlength="20" value="${esc(p?.nick || '')}">`)}
      ${field('Nome real', `<input name="name" maxlength="40" value="${esc(p?.name || '')}">`)}
    </div>
    <div class="row-2">
      ${field('Posição', `<select name="role">${ROLES.map(r => `<option value="${r.id}" ${p?.role===r.id?'selected':''}>${r.name}</option>`).join('')}</select>`)}
      ${field('Status', `<select name="status">${['titular','reserva','staff','inativo'].map(s => `<option value="${s}" ${p?.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}</select>`)}
    </div>
    ${pinField}`;

  openModal({
    title: p ? 'Editar Jogador' : 'Adicionar Jogador',
    icon: 'fa-user-plus',
    body,
    onSubmit: async d => {
      if (!d.nick.trim()) return false;
      const newNick = d.nick.trim();
      const oldNick = p?.nick || '';

      if (p) {
        Object.assign(p, {
          nick: newNick,
          name: d.name.trim(),
          role: d.role,
          status: d.status
        });
      } else {
        state.players.push({
          id: uid(), nick: newNick, name: d.name.trim(), role: d.role, status: d.status,
          riot: { gameName:'', tagLine:'', puuid:'', platform:'BR1', rank:'', iconId:'' },
          pool: []
        });
      }
      const target = p || state.players[state.players.length - 1];

      const pinValue = (d.pin || '').trim();
      if (pinValue) {
        if (!/^\d{4,8}$/.test(pinValue)) {
          toastIcon('PIN deve ter de 4 a 8 dígitos', 'fa-triangle-exclamation');
          return false;
        }
        target.pinHash = await hashPin(newNick, pinValue);
      }

      if (oldNick && oldNick.toLowerCase() !== newNick.toLowerCase()) {
        await removePlayerIndex(oldNick);
      }
      if (target.pinHash) {
        await setPlayerIndex(newNick, {
          teamUid: state.teamUid,
          playerId: target.id,
          nick: newNick,
          pinHash: target.pinHash,
          updatedAt: Date.now()
        });
      } else {
        await removePlayerIndex(newNick);
      }

      save(); render();
      toastIcon(p ? 'Jogador atualizado' : 'Jogador adicionado');
    },
    onMount: () => {
      const gen = document.getElementById('pin-generate');
      const inp = document.getElementById('pin-input');
      if (gen && inp) {
        gen.addEventListener('click', () => {
          inp.value = generatePin();
          inp.type = 'text';
          inp.focus();
        });
      }
    }
  });
}

export function modalLinkRiot(pid) {
  const p = state.players.find(x => x.id === pid);
  if (!p) return;
  const r = p.riot || {};
  const body = `
    <div style="font-size:12.5px;color:var(--muted)">Conecte a conta Riot para puxar rank, maestria e partidas.</div>
    <div class="row-2">
      ${field('Game Name', `<input name="gameName" value="${esc(r.gameName||'')}" placeholder="Akisawa">`)}
      ${field('Tag Line', `<input name="tagLine" value="${esc(r.tagLine||'')}" placeholder="BR1">`)}
    </div>
    ${field('Plataforma', `<select name="platform">${['BR1','NA1','EUW1','EUN1','KR','JP1','LA1','LA2','OC1','TR1','RU'].map(pl => `<option ${r.platform===pl?'selected':''}>${pl}</option>`).join('')}</select>`)}`;

  openModal({
    title: `Vincular Riot — ${p.nick}`, icon: 'fa-link', body, submitLabel: 'Vincular & Buscar',
    onSubmit: async d => {
      if (!d.gameName || !d.tagLine) {
        toastIcon('Preencha Game Name e Tag Line', 'fa-triangle-exclamation');
        return false;
      }

      const gameName = d.gameName.trim();
      const tagLine = d.tagLine.trim();
      const platform = d.platform;

      const first = state.players.find(x => x.id === pid);
      if (!first) return false;
      first.riot = { ...(first.riot || {}), gameName, tagLine, platform };
      delete first.riot.lastError;
      save();

      try {
        toastIcon('Buscando dados da Riot...', 'fa-spinner');

        const account = await getAccountByRiotId(platform, gameName, tagLine);
        const summoner = await getSummonerByPuuid(platform, account.puuid);

        let rank = '—';
        try {
          const ranks = await getRankedStats(platform, account.puuid);
          const solo = ranks.find(x => x.queueType === 'RANKED_SOLO_5x5');
          rank = solo ? `${solo.tier} ${solo.rank} (${solo.leaguePoints} LP)` : 'Unranked';
        } catch (e) {
          console.warn('Rank falhou:', e.message);
        }

        let mastery = [];
        try {
          mastery = await getChampionMastery(platform, account.puuid);
        } catch (e) {
          console.warn('Maestria falhou:', e.message);
        }

        const fresh = state.players.find(x => x.id === pid);
        if (!fresh) {
          toastIcon('Jogador não encontrado', 'fa-triangle-exclamation');
          return true;
        }

        fresh.riot = {
          gameName: account.gameName || gameName,
          tagLine: account.tagLine || tagLine,
          platform,
          puuid: account.puuid,
          iconId: summoner.profileIconId,
          level: summoner.summonerLevel,
          rank,
          mastery: mastery.slice(0, 5),
        };

        save(); render();
        toastIcon(`Riot vinculado: ${rank}`, 'fa-circle-check');

      } catch (err) {
        console.error('Erro Riot:', err);
        const fresh = state.players.find(x => x.id === pid);
        if (fresh) {
          fresh.riot = { ...(fresh.riot || {}), gameName, tagLine, platform, lastError: err.message || 'Erro desconhecido' };
          save(); render();
        }
        toastIcon('Erro: ' + (err.message || 'Falha ao contatar Riot'), 'fa-circle-xmark');
      }
      return true;
    }
  });
}

export function modalTeam() {
  const body = `
    <div class="row-2">
      ${field('Nome do time', `<input name="name" value="${esc(state.team.name)}" maxlength="40">`)}
      ${field('Tag', `<input name="tag" value="${esc(state.team.tag)}" maxlength="6">`)}
    </div>`;
  openModal({
    title: 'Editar Time', icon: 'fa-gear', body,
    onSubmit: d => {
      state.team.name = d.name.trim() || 'Time';
      state.team.tag = (d.tag.trim() || 'TAG').toUpperCase();
      save(); render(); toastIcon('Time atualizado');
    }
  });
}

export function modalChamp(pid, id) {
  const p = state.players.find(x => x.id === pid);
  const c = id ? p.pool.find(x => x.id === id) : null;
  const body = `
    ${field('Campeão', `<input name="champ" list="champ-list" required value="${esc(c?.champ || '')}">`)}
    <div class="row-2">
      ${field('Tier', `<select name="tier">${TIERS.map(t => `<option value="${t}" ${c?.tier===t?'selected':''}>${t}</option>`).join('')}</select>`)}
      ${field('Tipo de pick', `<select name="type">${Object.entries(PICK_TYPES).map(([k,v]) => `<option value="${k}" ${c?.type===k?'selected':''}>${v.label}</option>`).join('')}</select>`)}
    </div>
    ${field('Observações', `<textarea name="notes">${esc(c?.notes || '')}</textarea>`)}`;
  openModal({
    title: c ? 'Editar Campeão' : `Adicionar à pool de ${p.nick}`, icon: 'fa-dragon', body,
    onSubmit: d => {
      if (!d.champ.trim()) return false;
      const payload = { champ: d.champ.trim(), tier: d.tier, type: d.type, notes: d.notes.trim() };
      if (c) Object.assign(c, payload);
      else p.pool.push({ id: uid(), ...payload });
      save(); render(); toastIcon(c ? 'Campeão atualizado' : 'Campeão adicionado');
    }
  });
}

export function modalScrim(id) {
  const s = id ? state.scrims.find(x => x.id === id) : null;
  const body = `
    <div class="row-2">
      ${field('Data', `<input type="date" name="date" required value="${esc(s?.date || TODAY)}">`)}
      ${field('Oponente', `<input name="opponent" required value="${esc(s?.opponent || '')}">`)}
    </div>
    <div class="row-3">
      ${field('Resultado', `<select name="result">${[['W','Vitória'],['L','Derrota'],['D','Empate']].map(([v,l]) => `<option value="${v}" ${s?.result===v?'selected':''}>${l}</option>`).join('')}</select>`)}
      ${field('Placar', `<input name="score" value="${esc(s?.score || '')}" placeholder="3-1">`)}
      ${field('Formato', `<select name="format">${['Bo1','Bo2','Bo3','Bo5','Bloco 3h'].map(f => `<option ${s?.format===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    </div>
    ${field('Notas', `<textarea name="notes">${esc(s?.notes || '')}</textarea>`)}`;
  openModal({
    title: s ? 'Editar Scrim' : 'Registrar Scrim', icon: 'fa-flag', body,
    onSubmit: d => {
      if (!d.opponent.trim()) return false;
      const payload = { date: d.date, opponent: d.opponent.trim(), result: d.result, score: d.score.trim(), format: d.format, notes: d.notes.trim() };
      if (s) Object.assign(s, payload);
      else state.scrims.push({ id: uid(), ...payload });
      save(); render(); toastIcon(s ? 'Scrim atualizada' : 'Scrim registrada');
    }
  });
}

export function modalNote(id) {
  const n = id ? state.notes.find(x => x.id === id) : null;
  const tags = ['Time','Draft','Macro','Micro','Mental','Individual','Meta','Scouting'];
  const body = `
    ${field('Título', `<input name="title" required maxlength="70" value="${esc(n?.title || '')}">`)}
    <div class="row-2">
      ${field('Categoria', `<select name="tag"><option value="">—</option>${tags.map(t => `<option ${n?.tag===t?'selected':''}>${t}</option>`).join('')}</select>`)}
      ${field('Data', `<input type="date" name="date" value="${esc(n?.date || TODAY)}">`)}
    </div>
    ${field('Conteúdo', `<textarea name="body" style="min-height:150px">${esc(n?.body || '')}</textarea>`)}`;
  openModal({
    title: n ? 'Editar Anotação' : 'Nova Anotação', icon: 'fa-pen', body, wide: true,
    onSubmit: d => {
      if (!d.title.trim()) return false;
      const payload = { title: d.title.trim(), body: d.body.trim(), tag: d.tag, date: d.date };
      if (n) Object.assign(n, payload);
      else state.notes.push({ id: uid(), ...payload });
      save(); render(); toastIcon(n ? 'Anotação atualizada' : 'Anotação criada');
    }
  });
}

export function modalTask(id) {
  const t = id ? state.tasks.find(x => x.id === id) : null;
  const players = [...state.players].sort((a,b) => a.nick.localeCompare(b.nick));
  const body = `
    ${field('Título', `<input name="title" required maxlength="80" value="${esc(t?.title || '')}">`)}
    <div class="row-3">
      ${field('Responsável', `<select name="assignee"><option value="">—</option>${players.map(p => `<option ${t?.assignee===p.nick?'selected':''}>${esc(p.nick)}</option>`).join('')}</select>`)}
      ${field('Prazo', `<input type="date" name="due" value="${esc(t?.due || '')}">`)}
      ${field('Prioridade', `<select name="priority">${['baixa','média','alta'].map(pr => `<option ${t?.priority===pr?'selected':''}>${pr}</option>`).join('')}</select>`)}
    </div>
    ${field('Descrição', `<textarea name="notes">${esc(t?.notes || '')}</textarea>`)}`;
  openModal({
    title: t ? 'Editar Tarefa' : 'Nova Tarefa', icon: 'fa-list-check', body,
    onSubmit: d => {
      if (!d.title.trim()) return false;
      const payload = { title: d.title.trim(), assignee: d.assignee, due: d.due, priority: d.priority, notes: d.notes.trim(), done: t?.done || false };
      if (t) Object.assign(t, payload);
      else state.tasks.push({ id: uid(), ...payload });
      save(); render(); toastIcon(t ? 'Tarefa atualizada' : 'Tarefa criada');
    }
  });
}

export function modalOpponent(id) {
  const o = id ? state.opponents.find(x => x.id === id) : null;
  const body = `
    <div class="row-2">
      ${field('Nome do time', `<input name="name" required maxlength="40" value="${esc(o?.name || '')}">`)}
      ${field('Tag', `<input name="tag" maxlength="6" value="${esc(o?.tag || '')}">`)}
    </div>
    <div class="row-2">
      ${field('Estilo de jogo', `<input name="playstyle" value="${esc(o?.playstyle || '')}">`)}
      ${field('Ponto fraco', `<input name="weakness" value="${esc(o?.weakness || '')}">`)}
    </div>
    <div class="row-2">
      ${field('Bans recorrentes', `<input name="bans" value="${esc(o?.bans || '')}">`)}
      ${field('Picks favoritos', `<input name="picks" value="${esc(o?.picks || '')}">`)}
    </div>
    <div class="row-2">
      ${field('Vitórias H2H', `<input type="number" name="wins" min="0" value="${esc(o?.wins ?? 0)}">`)}
      ${field('Derrotas H2H', `<input type="number" name="losses" min="0" value="${esc(o?.losses ?? 0)}">`)}
    </div>
    ${field('Notas de scouting', `<textarea name="notes">${esc(o?.notes || '')}</textarea>`)}`;
  openModal({
    title: o ? 'Editar Oponente' : 'Adicionar Oponente', icon: 'fa-chess', body, wide: true,
    onSubmit: d => {
      if (!d.name.trim()) return false;
      const payload = {
        name: d.name.trim(), tag: d.tag.trim(), playstyle: d.playstyle.trim(),
        weakness: d.weakness.trim(), bans: d.bans.trim(), picks: d.picks.trim(),
        wins: +d.wins || 0, losses: +d.losses || 0, notes: d.notes.trim()
      };
      if (o) Object.assign(o, payload);
      else state.opponents.push({ id: uid(), ...payload });
      save(); render(); toastIcon(o ? 'Oponente atualizado' : 'Oponente adicionado');
    }
  });
}

export function modalConfirm(title, msg, onConfirm) {
  openModal({
    title,
    icon: 'fa-triangle-exclamation',
    body: `<div style="font-size:13.5px;color:#b0c0d2">${esc(msg)}</div>`,
    submitLabel: 'Confirmar',
    danger: true,
    onSubmit: () => {
      try {
        onConfirm();
      } catch (e) {
        console.error('Erro na confirmação:', e);
      }
      closeModal();
      return false;
    }
  });
}

export function modalSaveDraft() {
  const d = state.draft;
  const empty = ![...d.blue.picks, ...d.red.picks, ...d.blue.bans, ...d.red.bans].some(Boolean);
  if (empty) { toastIcon('Preencha o draft antes de salvar', 'fa-triangle-exclamation'); return; }
  openModal({
    title: 'Salvar Draft', icon: 'fa-floppy-disk',
    body: field('Nome do draft', `<input name="name" required maxlength="50">`),
    onSubmit: data => {
      state.drafts.push({
        id: uid(), name: data.name.trim(), date: TODAY,
        blue: { bans: [...d.blue.bans], picks: [...d.blue.picks] },
        red: { bans: [...d.red.bans], picks: [...d.red.picks] }
      });
      save(); render(); toastIcon('Draft salvo');
    }
  });
}

export async function loadStatsForPlayer(playerId) {
  const p = state.players.find(x => x.id === playerId);
  if (!p || !p.riot?.puuid) {
    toastIcon('Vincule a conta Riot primeiro', 'fa-triangle-exclamation');
    return;
  }
  const isRefresh = !!p.riot.stats;

  try {
    const btn = document.querySelector(`[data-act="load-stats"][data-id="${playerId}"]`);
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Buscando...`;
    }

    toastIcon('Buscando histórico na Riot...', 'fa-cloud-arrow-down');

    const stats = await fetchPlayerStats(p.riot.platform || 'BR1', p.riot.puuid, {
      count: isRefresh ? 15 : 20,
      queue: 420
    });

    setCachedStats(playerId, stats);
    p.riot.stats = stats;
    save();

    render();
    toastIcon(`Carregado: ${stats.total} partidas, ${stats.winrate}% WR`, 'fa-circle-check');
  } catch (err) {
    console.error(err);
    const msg = err.message || '';
    if (msg.toLowerCase().includes('forbidden') || msg.includes('403')) {
      toastIcon('Match history indisponível: sua chave Riot não tem acesso a match-v5.', 'fa-triangle-exclamation');
    } else {
      toastIcon(err.message || 'Falha ao buscar', 'fa-circle-xmark');
    }
    const btn = document.querySelector(`[data-act="load-stats"][data-id="${playerId}"]`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Tentar novamente`;
    }
  }
}

export function bindActions() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const id = t.dataset.id;

    const coachOnly = [
      'new-event', 'edit-event', 'del-event',
      'new-player', 'edit-player', 'del-player', 'edit-team', 'link-riot',
      'new-champ', 'edit-champ', 'del-champ',
      'new-scrim', 'edit-scrim', 'del-scrim',
      'save-draft', 'clear-draft', 'load-draft', 'del-draft',
      'new-note', 'edit-note', 'del-note',
      'new-task', 'edit-task', 'del-task',
      'new-opponent', 'edit-opponent', 'del-opponent',
      'export', 'import', 'logout'
    ];
    if (isPlayerMode() && coachOnly.includes(act)) {
      toastIcon('Ação restrita ao coach', 'fa-lock');
      return;
    }

    switch (act) {
      case 'nav': if (goFn) goFn(t.dataset.view); break;
      case 'cal-prev': if (calShiftFn) { calShiftFn(-1); render(); } break;
      case 'cal-next': if (calShiftFn) { calShiftFn(1); render(); } break;
      case 'cal-today': if (calResetFn) { calResetFn(); render(); } break;
      case 'new-event': modalEvent(null, t.dataset.date); break;
      case 'edit-event': modalEvent(id); break;
      case 'del-event': modalConfirm('Excluir evento', 'Deseja excluir este evento?', () => {
        state.events = state.events.filter(x => x.id !== id); save(); render(); toastIcon('Evento excluído');
      }); break;

      case 'new-player': modalPlayer(); break;
      case 'edit-player': modalPlayer(id); break;
      case 'edit-team': modalTeam(); break;
      case 'link-riot': modalLinkRiot(id); break;
      case 'del-player': modalConfirm('Excluir jogador', 'Remove o jogador, sua pool e o acesso dele.', async () => {
        const p = state.players.find(x => x.id === id);
        if (p?.pinHash) await removePlayerIndex(p.nick);
        state.players = state.players.filter(x => x.id !== id);
        save(); render(); toastIcon('Jogador removido');
      }); break;
      case 'open-pool': {
        import('./ui.js').then(m => { m.setActivePlayerId(id); if (goFn) goFn('pools'); });
        break;
      }
      case 'open-player-detail': {
        window.__akiCurrentPlayer = id;
        if (goFn) goFn('player');
        break;
      }
      case 'load-stats': loadStatsForPlayer(id); break;

      case 'select-player': import('./ui.js').then(m => { m.setActivePlayerId(id); render(); }); break;
      case 'new-champ': modalChamp(t.dataset.pid); break;
      case 'edit-champ': modalChamp(t.dataset.pid, id); break;
      case 'del-champ': {
        const p = state.players.find(x => x.id === t.dataset.pid);
        if (p) { p.pool = p.pool.filter(c => c.id !== id); save(); render(); toastIcon('Campeão removido'); }
        break;
      }

      case 'new-scrim': modalScrim(); break;
      case 'edit-scrim': modalScrim(id); break;
      case 'del-scrim': modalConfirm('Excluir scrim', 'Remover este registro?', () => {
        state.scrims = state.scrims.filter(x => x.id !== id); save(); render(); toastIcon('Scrim removida');
      }); break;

      case 'save-draft': modalSaveDraft(); break;
      case 'clear-draft': modalConfirm('Limpar draft', 'Apagar todos os picks e bans?', () => {
        state.draft = { blue:{ bans:['','','','',''], picks:['','','','',''] }, red:{ bans:['','','','',''], picks:['','','','',''] } };
        save(); render(); toastIcon('Board limpo');
      }); break;
      case 'load-draft': {
        const dr = state.drafts.find(x => x.id === id);
        if (dr) { state.draft = { blue: JSON.parse(JSON.stringify(dr.blue)), red: JSON.parse(JSON.stringify(dr.red)) }; save(); render(); toastIcon('Draft carregado'); }
        break;
      }
      case 'del-draft': state.drafts = state.drafts.filter(x => x.id !== id); save(); render(); toastIcon('Draft removido'); break;

      case 'new-note': modalNote(); break;
      case 'edit-note': modalNote(id); break;
      case 'del-note': modalConfirm('Excluir anotação', 'Remover esta anotação?', () => {
        state.notes = state.notes.filter(x => x.id !== id); save(); render(); toastIcon('Anotação removida');
      }); break;

      case 'new-task': modalTask(); break;
      case 'edit-task': modalTask(id); break;
      case 'del-task': state.tasks = state.tasks.filter(x => x.id !== id); save(); render(); toastIcon('Tarefa removida'); break;
      case 'toggle-task': {
        const task = state.tasks.find(x => x.id === id);
        if (task) { task.done = !task.done; save(); render(); }
        break;
      }

      case 'new-opponent': modalOpponent(); break;
      case 'edit-opponent': modalOpponent(id); break;
      case 'del-opponent': state.opponents = state.opponents.filter(x => x.id !== id); save(); render(); toastIcon('Oponente removido'); break;

      case 'set-mood': {
        const playerId = t.dataset.player;
        const mood = +t.dataset.mood;
        if (!state.moods[TODAY]) state.moods[TODAY] = {};
        state.moods[TODAY][playerId] = mood;
        save(); render(); toastIcon('Humor registrado!', 'fa-face-smile');
        break;
      }

      case 'toggle-theme': {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', state.theme);
        localStorage.setItem('aki_theme', state.theme);
        const icon = t.querySelector('i');
        if (icon) icon.className = state.theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        break;
      }

      case 'export': exportData(); break;
      case 'import': importData(); break;
      case 'logout': handleLogout(); break;
      case 'player-logout': handlePlayerLogout(); break;
    }
  });
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aki-coach-${TODAY}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toastIcon('Backup exportado', 'fa-download');
}

function importData() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.players || !data.events) throw new Error('formato inválido');
        Object.assign(state, data);
        save(); render(); toastIcon('Dados importados', 'fa-circle-check');
      } catch { toastIcon('Arquivo inválido', 'fa-circle-xmark'); }
    };
    r.readAsText(f);
  };
  inp.click();
}

let logoutHandler = null;
let playerLogoutHandler = null;

export function setLogoutHandler(fn) { logoutHandler = fn; }
export function setPlayerLogoutHandler(fn) { playerLogoutHandler = fn; }

function handleLogout() { if (logoutHandler) logoutHandler(); }
function handlePlayerLogout() { if (playerLogoutHandler) playerLogoutHandler(); }