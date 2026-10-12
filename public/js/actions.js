import {
  state, ROLES, STAFF_ROLES, EVENT_TYPES, TIERS, PICK_TYPES, TODAY, uid, esc, saveToFirebase,
  hashPin, generatePin
} from './state.js';
import { toast, toastIcon } from './ui.js';
import {
  getAccountByRiotId, getSummonerByPuuid, getRankedStats,
  getChampionMastery, fetchPlayerStats, setCachedStats, champIconName
} from './riot-api.js';
import { setPlayerIndex, removePlayerIndex, dbUpdate } from './firebase.js';

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
function isStaffMode() {
  return !!window.__akiStaffMode;
}

function canEditCalendar() {
  return !isPlayerMode() || isStaffMode();
}

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
  const isStaff = p?.status === 'staff';
  const hasPin = !!p?.pinHash;

  const roleOptions = (current) =>
    ROLES.map(r => `<option value="${r.id}" ${current===r.id?'selected':''}>${r.name}</option>`).join('');

  const staffRoleOptions = (current) =>
    STAFF_ROLES.map(r => `<option value="${r.id}" ${current===r.id?'selected':''}>${r.name}</option>`).join('');

  const body = `
    <div class="row-2">
      ${field('Nickname', `<input name="nick" required maxlength="20" value="${esc(p?.nick || '')}">`)}
      ${field('Nome real', `<input name="name" maxlength="40" value="${esc(p?.name || '')}">`)}
    </div>

    ${field('Status', `
      <select name="status" id="player-status-select">
        ${['titular','reserva','staff','inativo'].map(s =>
          `<option value="${s}" ${p?.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
        ).join('')}
      </select>
    `)}

    <div id="role-player-section" style="display:${isStaff ? 'none' : 'block'}">
      ${field('Posição', `<select name="role">${roleOptions(isStaff ? 'MID' : (p?.role || 'MID'))}</select>`)}
    </div>

    <div id="role-staff-section" style="display:${isStaff ? 'block' : 'none'}">
      ${field('Função na staff', `<select name="staffRole">${staffRoleOptions(isStaff ? (p?.role || 'HEAD_COACH') : 'HEAD_COACH')}</select>`)}
    </div>

    <div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">
      <div class="field" style="flex:1;min-width:180px">
        <label>PIN de acesso ${hasPin ? '(ativo)' : ''}</label>
        <div style="display:flex;gap:6px">
          <input name="pin" id="pin-input" maxlength="8" inputmode="numeric"
                 placeholder="${hasPin ? 'Deixe vazio para manter' : 'Ex: 123456'}"
                 value="" autocomplete="off" style="flex:1">
          <button type="button" class="btn" id="pin-generate" title="Gerar PIN">
            <i class="fa-solid fa-dice"></i>
          </button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;display:flex;align-items:flex-start;gap:6px;line-height:1.45">
          <i class="fa-solid fa-key" style="color:var(--primary);font-size:10px;margin-top:3px;flex:0 0 auto"></i>
          <span>Login com nick + PIN. Vale para jogadores e staff.</span>
        </div>
      </div>

      <div id="id-staff-section" style="flex:1;min-width:180px;display:${isStaff ? 'block' : 'none'}">
        <div class="field">
          <label>Discord</label>
          <input name="discord" maxlength="60" value="${esc(p?.discord || '')}" placeholder="Ex: akisawa ou akisawa#1234">
          <div style="font-size:11px;color:var(--muted);margin-top:6px;display:flex;align-items:flex-start;gap:6px;line-height:1.45">
            <i class="fa-brands fa-discord" style="color:#7289da;font-size:11px;margin-top:2px;flex:0 0 auto"></i>
            <span>Só para contato. Staff não precisa de conta Riot.</span>
          </div>
        </div>
      </div>
    </div>`;

  openModal({
    title: p ? 'Editar Membro' : 'Adicionar Membro',
    icon: 'fa-user-plus',
    body,
    wide: true,
    onSubmit: async d => {
      if (!d.nick.trim()) return false;
      const newNick = d.nick.trim();
      const oldNick = p?.nick || '';
      const isStaffNow = d.status === 'staff';
      const finalRole = isStaffNow ? (d.staffRole || 'HEAD_COACH') : (d.role || 'MID');

      if (p) {
        Object.assign(p, {
          nick: newNick,
          name: d.name.trim(),
          role: finalRole,
          status: d.status,
          discord: isStaffNow ? (d.discord || '').trim() : (p.discord || ''),
        });
        if (!Array.isArray(p.pool)) p.pool = [];
        if (!p.riot || typeof p.riot !== 'object') {
          p.riot = { gameName:'', tagLine:'', puuid:'', platform:'BR1', rank:'', iconId:'' };
        }
      } else {
        state.players.push({
          id: uid(),
          nick: newNick,
          name: d.name.trim(),
          role: finalRole,
          status: d.status,
          discord: isStaffNow ? (d.discord || '').trim() : '',
          riot: { gameName:'', tagLine:'', puuid:'', platform:'BR1', rank:'', iconId:'' },
          pool: [],
        });
      }
      const target = p || state.players[state.players.length - 1];

      // PIN: sempre opcional, para staff e jogador
      const pinValue = (d.pin || '').trim();
      if (pinValue) {
        if (!/^\d{4,8}$/.test(pinValue)) {
          toastIcon('PIN deve ter de 4 a 8 dígitos', 'fa-triangle-exclamation');
          return false;
        }
        target.pinHash = await hashPin(newNick, pinValue);
      }

      // Se virou staff, limpa pool (staff não tem pool)
      if (isStaffNow) {
        target.pool = [];
      }

      // Sincroniza o player_index
      if (oldNick && oldNick.toLowerCase() !== newNick.toLowerCase()) {
        await removePlayerIndex(oldNick);
      }
      if (target.pinHash) {
        await setPlayerIndex(newNick, {
          teamUid: state.teamUid,
          playerId: target.id,
          nick: newNick,
          pinHash: target.pinHash,
          isStaff: isStaffNow,
          updatedAt: Date.now(),
        });
      } else {
        await removePlayerIndex(newNick);
      }

      save(); render();
      toastIcon(p ? 'Membro atualizado' : 'Membro adicionado');
    },
    onMount: () => {
      const statusSel = document.getElementById('player-status-select');
      const rolePlayer = document.getElementById('role-player-section');
      const roleStaff = document.getElementById('role-staff-section');
      const idStaff = document.getElementById('id-staff-section');

      const updateSections = () => {
        const nowStaff = statusSel.value === 'staff';
        rolePlayer.style.display = nowStaff ? 'none' : 'block';
        roleStaff.style.display  = nowStaff ? 'block' : 'none';
        idStaff.style.display    = nowStaff ? 'block' : 'none';
      };

      statusSel.addEventListener('change', updateSections);

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
    </div>
    ${field('Seu nome (aparece no menu e nas composições)', `
      <input name="coachName" value="${esc(state.coachName || '')}" maxlength="30" placeholder="Ex: Akisawa">
    `)}
    <div style="font-size:11px;color:var(--muted);margin-top:-6px">
      <i class="fa-solid fa-info-circle"></i> Esse nome é usado como autor em novas composições.
    </div>`;

  openModal({
    title: 'Editar Time', icon: 'fa-gear', body,
    onSubmit: async d => {
      const oldName = state.coachName;
      const newName = (d.coachName || '').trim() || 'Coach';

      state.team.name = d.name.trim() || 'Time';
      state.team.tag = (d.tag.trim() || 'TAG').toUpperCase();
      state.coachName = newName;

      // Salva no perfil do Firebase
      if (state.user?.uid) {
        try {
          await dbUpdate(`users/${state.user.uid}/profile`, {
            displayName: newName
          });
        } catch (e) {
          console.warn('Falha ao atualizar perfil:', e);
        }
      }

      // Atualiza o sidebar imediatamente
      const userNameEl = document.getElementById('user-name');
      if (userNameEl) userNameEl.textContent = newName;

      // Renomeia comps antigas do coach
      if (oldName && oldName !== newName && Array.isArray(state.comps)) {
        let changed = 0;
        state.comps.forEach(c => {
          if (c.authorId === '' && c.author === oldName) {
            c.author = newName;
            changed++;
          }
        });
        if (changed > 0) {
          save(); render();
          toastIcon(`Nome atualizado · ${changed} composição(ões) renomeadas`);
          return;
        }
      }

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
  const or = s?.opponentRoster || {};
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

    <div style="display:flex;align-items:center;gap:10px;margin-top:4px;padding-top:12px;border-top:1px solid var(--border-soft)">
      <i class="fa-solid fa-users-viewfinder" style="color:#ff9b9b;font-size:12px"></i>
      <span style="font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ff9b9b">Roster Inimigo</span>
    </div>
    <div class="row-3">
      ${field('Top', `<input name="oTOP" value="${esc(or.TOP||'')}" placeholder="Nick">`)}
      ${field('Jungle', `<input name="oJNG" value="${esc(or.JNG||'')}" placeholder="Nick">`)}
      ${field('Mid', `<input name="oMID" value="${esc(or.MID||'')}" placeholder="Nick">`)}
    </div>
    <div class="row-2">
      ${field('ADC', `<input name="oADC" value="${esc(or.ADC||'')}" placeholder="Nick">`)}
      ${field('Suporte', `<input name="oSUP" value="${esc(or.SUP||'')}" placeholder="Nick">`)}
    </div>

    ${field('Notas', `<textarea name="notes">${esc(s?.notes || '')}</textarea>`)}`;

  openModal({
    title: s ? 'Editar Scrim' : 'Registrar Scrim', icon: 'fa-flag', body, wide: true,
    onSubmit: d => {
      if (!d.opponent.trim()) return false;
      const payload = {
        date: d.date,
        opponent: d.opponent.trim(),
        result: d.result,
        score: d.score.trim(),
        format: d.format,
        notes: d.notes.trim(),
        opponentRoster: {
          TOP: (d.oTOP||'').trim(),
          JNG: (d.oJNG||'').trim(),
          MID: (d.oMID||'').trim(),
          ADC: (d.oADC||'').trim(),
          SUP: (d.oSUP||'').trim(),
        }
      };
      if (s) Object.assign(s, payload);
      else state.scrims.push({ id: uid(), ...payload });
      save(); render(); toastIcon(s ? 'Scrim atualizada' : 'Scrim registrada');
    }
  });
}

export function modalTournament(id) {
  const t = id ? state.tournaments.find(x => x.id === id) : null;
  const or = t?.opponentRoster || {};
  const body = `
    ${field('Nome do campeonato', `<input name="name" required maxlength="60" value="${esc(t?.name || '')}" placeholder="Ex: CBLOL Academy, Liga X">`)}
    <div class="row-3">
      ${field('Data', `<input type="date" name="date" required value="${esc(t?.date || TODAY)}">`)}
      ${field('Adversário', `<input name="opponent" required value="${esc(t?.opponent || '')}">`)}
      ${field('Fase', `<select name="stage">${['Grupos','Quartas','Semifinal','Final','Play-in','Amistoso'].map(f => `<option ${t?.stage===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    </div>
    <div class="row-3">
      ${field('Resultado', `<select name="result">${[['W','Vitória'],['L','Derrota']].map(([v,l]) => `<option value="${v}" ${t?.result===v?'selected':''}>${l}</option>`).join('')}</select>`)}
      ${field('Placar', `<input name="score" value="${esc(t?.score || '')}" placeholder="2-1">`)}
      ${field('Formato', `<select name="format">${['Bo1','Bo2','Bo3','Bo5'].map(f => `<option ${t?.format===f?'selected':''}>${f}</option>`).join('')}</select>`)}
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-top:4px;padding-top:12px;border-top:1px solid var(--border-soft)">
      <i class="fa-solid fa-users-viewfinder" style="color:#ff9b9b;font-size:12px"></i>
      <span style="font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ff9b9b">Roster Inimigo</span>
    </div>
    <div class="row-3">
      ${field('Top', `<input name="oTOP" value="${esc(or.TOP||'')}" placeholder="Nick">`)}
      ${field('Jungle', `<input name="oJNG" value="${esc(or.JNG||'')}" placeholder="Nick">`)}
      ${field('Mid', `<input name="oMID" value="${esc(or.MID||'')}" placeholder="Nick">`)}
    </div>
    <div class="row-2">
      ${field('ADC', `<input name="oADC" value="${esc(or.ADC||'')}" placeholder="Nick">`)}
      ${field('Suporte', `<input name="oSUP" value="${esc(or.SUP||'')}" placeholder="Nick">`)}
    </div>

    ${field('Notas', `<textarea name="notes" placeholder="MVP, jogada chave, o que ajustar...">${esc(t?.notes || '')}</textarea>`)}`;

  openModal({
    title: t ? 'Editar Campeonato' : 'Registrar Campeonato', icon: 'fa-trophy', body, wide: true,
    onSubmit: d => {
      if (!d.name.trim() || !d.opponent.trim()) return false;
      const payload = {
        name: d.name.trim(),
        date: d.date,
        opponent: d.opponent.trim(),
        stage: d.stage,
        result: d.result,
        score: d.score.trim(),
        format: d.format,
        notes: d.notes.trim(),
        opponentRoster: {
          TOP: (d.oTOP||'').trim(),
          JNG: (d.oJNG||'').trim(),
          MID: (d.oMID||'').trim(),
          ADC: (d.oADC||'').trim(),
          SUP: (d.oSUP||'').trim(),
        }
      };
      if (t) Object.assign(t, payload);
      else state.tournaments.push({ id: uid(), ...payload });
      save(); render(); toastIcon(t ? 'Campeonato atualizado' : 'Campeonato registrado');
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
  const r = o?.roster || {};

  const body = `
    <div class="row-2">
      ${field('Nome do time', `<input name="name" required maxlength="40" value="${esc(o?.name || '')}">`)}
      ${field('Tag', `<input name="tag" maxlength="6" value="${esc(o?.tag || '')}">`)}
    </div>
    <div class="row-2">
      ${field('Estilo de jogo', `<input name="playstyle" value="${esc(o?.playstyle || '')}" placeholder="Ex: agressivo early">`)}
      ${field('Ponto fraco', `<input name="weakness" value="${esc(o?.weakness || '')}" placeholder="Ex: mid game fraco">`)}
    </div>
    <div class="row-2">
      ${field('Bans recorrentes', `<input name="bans" value="${esc(o?.bans || '')}" placeholder="Ex: Azir, Vi, Rakan">`)}
      ${field('Picks favoritos', `<input name="picks" value="${esc(o?.picks || '')}" placeholder="Ex: Kai'Sa, Nautilus">`)}
    </div>
    <div class="row-2">
      ${field('Vitórias H2H', `<input type="number" name="wins" min="0" value="${esc(o?.wins ?? 0)}">`)}
      ${field('Derrotas H2H', `<input type="number" name="losses" min="0" value="${esc(o?.losses ?? 0)}">`)}
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-top:4px;padding-top:12px;border-top:1px solid var(--border-soft)">
      <i class="fa-solid fa-users-viewfinder" style="color:#ff9b9b;font-size:12px"></i>
      <span style="font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ff9b9b">Roster Inimigo (Nick#TAG)</span>
    </div>
    <div class="row-3">
      ${field('Top', `<input name="rTOP" value="${esc(r.TOP || '')}" placeholder="Nick#BR1">`)}
      ${field('Jungle', `<input name="rJNG" value="${esc(r.JNG || '')}" placeholder="Nick#BR1">`)}
      ${field('Mid', `<input name="rMID" value="${esc(r.MID || '')}" placeholder="Nick#BR1">`)}
    </div>
    <div class="row-2">
      ${field('ADC', `<input name="rADC" value="${esc(r.ADC || '')}" placeholder="Nick#BR1">`)}
      ${field('Suporte', `<input name="rSUP" value="${esc(r.SUP || '')}" placeholder="Nick#BR1">`)}
    </div>
    <div style="font-size:11px;color:var(--muted);margin-top:-6px">
      <i class="fa-solid fa-circle-info"></i> Use o formato completo (Nick#TAG). O sistema vai gerar um link pro OP.GG de cada jogador.
    </div>

    ${field('Notas de scouting', `<textarea name="notes" placeholder="Padrões, timing de rotações, comportamento...">${esc(o?.notes || '')}</textarea>`)}`;

  openModal({
    title: o ? 'Editar Oponente' : 'Adicionar Oponente',
    icon: 'fa-chess',
    body,
    wide: true,
    onSubmit: d => {
      if (!d.name.trim()) return false;
      const payload = {
        name: d.name.trim(),
        tag: d.tag.trim(),
        playstyle: d.playstyle.trim(),
        weakness: d.weakness.trim(),
        bans: d.bans.trim(),
        picks: d.picks.trim(),
        wins: +d.wins || 0,
        losses: +d.losses || 0,
        notes: d.notes.trim(),
        roster: {
          TOP: (d.rTOP || '').trim(),
          JNG: (d.rJNG || '').trim(),
          MID: (d.rMID || '').trim(),
          ADC: (d.rADC || '').trim(),
          SUP: (d.rSUP || '').trim(),
        },
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
      'new-scrim', 'edit-scrim', 'del-scrim',
      'new-tournament', 'edit-tournament', 'del-tournament',
      'save-draft', 'clear-draft', 'load-draft', 'del-draft',
      'new-note', 'edit-note', 'del-note',
      'new-task', 'edit-task', 'del-task',
      'new-opponent', 'edit-opponent', 'del-opponent',
      'comp-approve', 'comp-reject', 'comp-test',
      'export', 'import', 'logout'
    ];

    const staffAllowed = [
      'new-event', 'edit-event', 'del-event',
      'new-player', 'edit-player', 'del-player', 'edit-team', 'link-riot',
      'new-scrim', 'edit-scrim', 'del-scrim',
      'new-tournament', 'edit-tournament', 'del-tournament'
    ];

    if (isPlayerMode()) {
      const staff = !!window.__akiStaffMode;
      const isAllowedForStaff = staff && staffAllowed.includes(act);

      if (coachOnly.includes(act) && !isAllowedForStaff) {
        toastIcon('Ação restrita ao coach', 'fa-lock');
        return;
      }

      // Jogador comum (não staff) tem restrições de ownership
      if (!staff) {
        if (['new-champ', 'edit-champ', 'del-champ'].includes(act)) {
          const pid = t.dataset.pid;
          if (!pid || pid !== window.__akiCurrentPlayer) {
            toastIcon('Você só pode editar sua própria pool', 'fa-lock');
            return;
          }
        }
        if (['edit-comp', 'del-comp'].includes(act)) {
          const comp = (state.comps || []).find(x => x.id === id);
          if (!comp || comp.authorId !== window.__akiCurrentPlayer) {
            toastIcon('Você só pode editar suas composições', 'fa-lock');
            return;
          }
        }
      }
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
      case 'new-tournament': modalTournament(); break;
      case 'edit-tournament': modalTournament(id); break;
      case 'del-tournament': modalConfirm('Excluir campeonato', 'Remover este registro?', () => {
        state.tournaments = state.tournaments.filter(x => x.id !== id); save(); render(); toastIcon('Campeonato removido');
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
      
      case 'new-comp': modalComp(); break;
      case 'view-comp': modalViewComp(id); break;
      case 'edit-comp': modalComp(id); break;
      case 'del-comp': modalConfirm('Excluir composição', 'Remover esta composição?', () => {
        state.comps = (state.comps || []).filter(x => x.id !== id);
        save(); render(); toastIcon('Composição removida');
      }); break;
      case 'comp-approve': {
        const c = (state.comps || []).find(x => x.id === id);
        if (c) { c.status = 'aprovada'; c.updatedAt = Date.now(); save(); render(); toastIcon('Composição aprovada', 'fa-circle-check'); }
        break;
      }
      case 'comp-reject': {
        const c = (state.comps || []).find(x => x.id === id);
        if (c) { c.status = 'recusada'; c.updatedAt = Date.now(); save(); render(); toastIcon('Composição recusada', 'fa-circle-xmark'); }
        break;
      }
      case 'comp-test': {
        const c = (state.comps || []).find(x => x.id === id);
        if (c) { c.status = 'testar'; c.updatedAt = Date.now(); save(); render(); toastIcon('Marcada para testar', 'fa-flask'); }
        break;
      }

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
      case 'view-opponent': modalViewOpponent(id); break;
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

/* ═══════════════════════════════════════
   MODAL: Composição
   ═══════════════════════════════════════ */
export function modalComp(id) {
  const playerMode = isPlayerMode();
  const c = id ? (state.comps || []).find(x => x.id === id) : null;

  // Autor/permissões
  const authorNick = playerMode
    ? (window.__akiPlayerNick || 'Jogador')
    : (state.coachName || state.user?.displayName || state.user?.email?.split('@')[0] || 'Coach');
  const authorId = playerMode ? (window.__akiCurrentPlayer || '') : '';

  // Modo jogador não pode editar status
  const canEditStatus = !playerMode;

  const statusField = canEditStatus ? `
    ${field('Status', `
      <select name="status">
        <option value="testar"   ${c?.status==='testar'   ?'selected':''}>Testar</option>
        <option value="aprovada" ${c?.status==='aprovada' ?'selected':''}>Aprovada</option>
        <option value="recusada" ${c?.status==='recusada' ?'selected':''}>Recusada</option>
      </select>`)}
  ` : `<input type="hidden" name="status" value="${esc(c?.status || 'testar')}">`;

  const body = `
    ${field('Nome da composição *', `<input name="name" required maxlength="60" value="${esc(c?.name || '')}" placeholder="Ex: Comp poke com Azir">`)}

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${field('Top', `<input list="champ-list" name="TOP" value="${esc(c?.champs?.TOP || '')}" placeholder="Campeão...">`)}
      ${field('Jungle', `<input list="champ-list" name="JNG" value="${esc(c?.champs?.JNG || '')}" placeholder="Campeão...">`)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      ${field('Mid', `<input list="champ-list" name="MID" value="${esc(c?.champs?.MID || '')}" placeholder="Campeão...">`)}
      ${field('ADC', `<input list="champ-list" name="ADC" value="${esc(c?.champs?.ADC || '')}" placeholder="Campeão...">`)}
      ${field('Suporte', `<input list="champ-list" name="SUP" value="${esc(c?.champs?.SUP || '')}" placeholder="Campeão...">`)}
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-top:4px;padding-top:12px;border-top:1px solid var(--border-soft)">
      <i class="fa-solid fa-ban" style="color:#ff9b9b;font-size:12px"></i>
      <span style="font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#ff9b9b">Bans Prioritários</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      ${field('Ban 1', `<input list="champ-list" name="BAN_P1" value="${esc(c?.bans?.priority?.[0] || '')}" placeholder="Campeão...">`)}
      ${field('Ban 2', `<input list="champ-list" name="BAN_P2" value="${esc(c?.bans?.priority?.[1] || '')}" placeholder="Campeão...">`)}
      ${field('Ban 3', `<input list="champ-list" name="BAN_P3" value="${esc(c?.bans?.priority?.[2] || '')}" placeholder="Campeão...">`)}
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-top:4px;padding-top:12px;border-top:1px solid var(--border-soft)">
      <i class="fa-solid fa-ban" style="color:#a8bcd4;font-size:12px"></i>
      <span style="font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a8bcd4">Bans Opcionais</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      ${field('Ban 1', `<input list="champ-list" name="BAN_O1" value="${esc(c?.bans?.optional?.[0] || '')}" placeholder="Campeão...">`)}
      ${field('Ban 2', `<input list="champ-list" name="BAN_O2" value="${esc(c?.bans?.optional?.[1] || '')}" placeholder="Campeão...">`)}
      ${field('Ban 3', `<input list="champ-list" name="BAN_O3" value="${esc(c?.bans?.optional?.[2] || '')}" placeholder="Campeão...">`)}
    </div>

    ${field('Descrição / Estratégia', `<textarea name="description" maxlength="600" placeholder="Como jogar, quando usar, pontos fortes e fracos...">${esc(c?.description || '')}</textarea>`)}

    ${statusField}
  `;

  openModal({
    title: c ? 'Editar Composição' : 'Nova Composição',
    icon: 'fa-layer-group',
    body, wide: true,
    onSubmit: d => {
      if (!d.name.trim()) {
        toastIcon('Dê um nome à composição', 'fa-triangle-exclamation');
        return false;
      }

      const champs = {
        TOP: (d.TOP || '').trim(),
        JNG: (d.JNG || '').trim(),
        MID: (d.MID || '').trim(),
        ADC: (d.ADC || '').trim(),
        SUP: (d.SUP || '').trim(),
      };

            const bans = {
        priority: [
          (d.BAN_P1 || '').trim(),
          (d.BAN_P2 || '').trim(),
          (d.BAN_P3 || '').trim(),
        ],
        optional: [
          (d.BAN_O1 || '').trim(),
          (d.BAN_O2 || '').trim(),
          (d.BAN_O3 || '').trim(),
        ],
      };

      if (c) {
        // Só o dono ou coach pode editar
        if (playerMode && c.authorId !== authorId) {
          toastIcon('Você só pode editar suas composições', 'fa-lock');
          return false;
        }
        Object.assign(c, {
          name: d.name.trim(),
          description: (d.description || '').trim(),
          champs,
          bans,
          updatedAt: Date.now(),
        });
        if (canEditStatus && d.status) c.status = d.status;
      } else {
        if (!Array.isArray(state.comps)) state.comps = [];
        state.comps.push({
          id: uid(),
          name: d.name.trim(),
          description: (d.description || '').trim(),
          champs,
          bans,
          author: authorNick,
          authorId,
          status: canEditStatus && d.status ? d.status : 'testar',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      save(); render();
      toastIcon(c ? 'Composição atualizada' : 'Composição enviada');
    }
  });
}

/* ═══════════════════════════════════════
   MODAL: Ver Composição (leitura)
   ═══════════════════════════════════════ */
export function modalViewComp(id) {
  const c = (state.comps || []).find(x => x.id === id);
  if (!c) return;

  const statusMeta = {
    testar:   { label: 'Testar',   color: '#f7bd4a', icon: 'fa-flask' },
    aprovada: { label: 'Aprovada', color: '#5ee08c', icon: 'fa-circle-check' },
    recusada: { label: 'Recusada', color: '#ff9b9b', icon: 'fa-circle-xmark' },
  };
  const meta = statusMeta[c.status] || statusMeta.testar;
  const champs = c.champs || {};
  const bansPrio = (c.bans?.priority || ['', '', '']);
  const bansOpt = (c.bans?.optional || ['', '', '']);

  const splashUrl = (name) =>
    `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${champIconName(name)}_0.jpg`;

  const roleRow = (label, champ) => {
    const hasChamp = !!champ;
    return `
    <div class="read-role-row ${hasChamp ? '' : 'empty'}">
      ${hasChamp ? `
        <div class="read-role-splash" style="background-image:url('${splashUrl(champ)}')"></div>
        <div class="read-role-overlay"></div>
      ` : ''}
      <div class="read-role-content">
        <span class="read-role-label">${label}</span>
        <span class="read-role-champ ${hasChamp ? '' : 'empty'}">${hasChamp ? esc(champ) : '—'}</span>
      </div>
    </div>`;
  };

    const banRow = (label, champ) => {
    const hasChamp = !!champ;
    return `
    <div class="read-ban-row ${hasChamp ? '' : 'empty'}">
      ${hasChamp ? `
        <div class="read-ban-splash" style="background-image:url('${splashUrl(champ)}')"></div>
        <div class="read-ban-overlay"></div>
      ` : ''}
      <div class="read-ban-content">
        <span class="read-ban-label">${label}</span>
        <span class="read-ban-champ ${hasChamp ? '' : 'empty'}">${hasChamp ? esc(champ) : '—'}</span>
      </div>
    </div>`;
  };

  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal read-modal">
        <div class="modal-head">
          <i class="fa-solid fa-layer-group" style="color:var(--primary)"></i>
          <h3>${esc(c.name || 'Sem nome')}</h3>
          <button class="icon-btn" data-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body read-body">
          <div class="read-meta">
            <span class="comp-status" style="color:${meta.color};border-color:${meta.color}40;background:${meta.color}15">
              <i class="fa-solid ${meta.icon}"></i> ${meta.label}
            </span>
            <span class="read-author">
              <i class="fa-solid fa-user-pen"></i> ${esc(c.author || 'Anônimo')}
            </span>
            ${c.updatedAt ? `
              <span class="read-date">
                <i class="fa-regular fa-clock"></i>
                ${new Date(c.updatedAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
              </span>` : ''}
          </div>

          <div class="read-section">
            <div class="read-section-title">
              <i class="fa-solid fa-users"></i> Composição
            </div>
            <div class="read-roles">
              ${roleRow('TOP', champs.TOP)}
              ${roleRow('JUNGLE', champs.JNG)}
              ${roleRow('MID', champs.MID)}
              ${roleRow('ADC', champs.ADC)}
              ${roleRow('SUPORTE', champs.SUP)}
            </div>
          </div>

                    <div class="read-section">
            <div class="read-section-title" style="color:#ff9b9b">
              <i class="fa-solid fa-ban" style="color:#ff9b9b"></i> Bans Prioritários
            </div>
            <div class="read-bans">
              ${banRow('BAN 1', bansPrio[0])}
              ${banRow('BAN 2', bansPrio[1])}
              ${banRow('BAN 3', bansPrio[2])}
            </div>
          </div>

          <div class="read-section">
            <div class="read-section-title" style="color:#a8bcd4">
              <i class="fa-solid fa-ban" style="color:#a8bcd4"></i> Bans Opcionais
            </div>
            <div class="read-bans">
              ${banRow('BAN 1', bansOpt[0])}
              ${banRow('BAN 2', bansOpt[1])}
              ${banRow('BAN 3', bansOpt[2])}
            </div>
          </div>

          ${c.description ? `
            <div class="read-section">
              <div class="read-section-title">
                <i class="fa-solid fa-scroll"></i> Descrição / Estratégia
              </div>
              <div class="read-description">${esc(c.description)}</div>
            </div>` : `
            <div class="read-section">
              <div class="read-section-title">
                <i class="fa-solid fa-scroll"></i> Descrição
              </div>
              <div class="read-description empty">
                <i class="fa-solid fa-circle-info"></i> Nenhuma descrição fornecida.
              </div>
            </div>`}
        </div>
        <div class="modal-foot">
          <button type="button" class="btn primary" data-close>
            <i class="fa-solid fa-check"></i> Fechar
          </button>
        </div>
      </div>
    </div>`;

  const backdrop = $('.modal-backdrop', root);
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closeModal(); });
  $$('[data-close]', root).forEach(b => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', escHandler);
}

/* ═══════════════════════════════════════
   MODAL: Ver Oponente (leitura)
   ═══════════════════════════════════════ */
export function modalViewOpponent(id) {
  const o = state.opponents.find(x => x.id === id);
  if (!o) return;

  const r = o.roster || {};
  const hasRoster = Object.values(r).some(Boolean);
  const wins = o.wins || 0;
  const losses = o.losses || 0;
  const total = wins + losses;
  const wr = total ? Math.round(wins / total * 100) : 0;

  const roleRow = (label, nick) => {
    if (!nick) {
      return `
      <div class="read-role-row empty">
        <div class="read-role-content">
          <span class="read-role-label">${label}</span>
          <span class="read-role-champ empty">—</span>
        </div>
      </div>`;
    }

    // Tenta gerar link pro OP.GG se tiver #TAG
    const [name, tag] = nick.split('#').map(s => s.trim());
    const url = (name && tag) ? `https://www.op.gg/summoners/br/${encodeURIComponent(name)}-${encodeURIComponent(tag)}` : '';

    const inner = `
      <span class="read-role-label">${label}</span>
      <span class="read-role-champ">${esc(nick)}</span>
      ${url ? `<i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px;color:var(--primary-light);opacity:.7;margin-left:auto"></i>` : ''}
    `;

    return url
      ? `<a class="read-role-row" href="${url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;cursor:pointer" title="Abrir ${esc(nick)} no OP.GG">
          <div class="read-role-content">${inner}</div>
        </a>`
      : `<div class="read-role-row"><div class="read-role-content">${inner}</div></div>`;
  };

  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal read-modal">
        <div class="modal-head">
          <i class="fa-solid fa-chess" style="color:#ff9b9b"></i>
          <h3>${esc(o.name || 'Oponente')}</h3>
          <button class="icon-btn" data-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body read-body">

          <div class="read-meta">
            ${o.tag ? `<span class="read-author"><i class="fa-solid fa-tag"></i> ${esc(o.tag)}</span>` : ''}
            ${total ? `
              <span class="read-author" style="color:${wr>=50?'#5ee08c':'#ff9b9b'}">
                <i class="fa-solid fa-trophy"></i> H2H: ${wins}V — ${losses}D (${wr}%)
              </span>` : `
              <span class="read-author"><i class="fa-solid fa-trophy"></i> Sem confrontos registrados</span>`}
          </div>

          ${(o.playstyle || o.weakness) ? `
          <div class="read-section">
            <div class="read-section-title">
              <i class="fa-solid fa-gamepad"></i> Estilo de Jogo
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${o.playstyle ? `
                <div class="read-info-row">
                  <span class="read-info-label">Estilo</span>
                  <span class="read-info-value">${esc(o.playstyle)}</span>
                </div>` : ''}
              ${o.weakness ? `
                <div class="read-info-row warn">
                  <span class="read-info-label" style="color:#f7bd4a">Ponto Fraco</span>
                  <span class="read-info-value" style="color:#f7bd4a">${esc(o.weakness)}</span>
                </div>` : ''}
            </div>
          </div>` : ''}

          ${hasRoster ? `
          <div class="read-section">
            <div class="read-section-title" style="color:#ff9b9b">
              <i class="fa-solid fa-users-viewfinder" style="color:#ff9b9b"></i> Roster Inimigo
            </div>
            <div class="read-roles">
              ${roleRow('TOP', r.TOP)}
              ${roleRow('JUNGLE', r.JNG)}
              ${roleRow('MID', r.MID)}
              ${roleRow('ADC', r.ADC)}
              ${roleRow('SUPORTE', r.SUP)}
            </div>
          </div>` : ''}

          ${(o.picks || o.bans) ? `
          <div class="read-section">
            <div class="read-section-title">
              <i class="fa-solid fa-star"></i> Picks & Bans
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${o.picks ? `
                <div class="read-info-row">
                  <span class="read-info-label">Picks favoritos</span>
                  <span class="read-info-value">${esc(o.picks)}</span>
                </div>` : ''}
              ${o.bans ? `
                <div class="read-info-row warn">
                  <span class="read-info-label" style="color:#ff9b9b">Bans recorrentes</span>
                  <span class="read-info-value" style="color:#ff9b9b">${esc(o.bans)}</span>
                </div>` : ''}
            </div>
          </div>` : ''}

          ${o.notes ? `
          <div class="read-section">
            <div class="read-section-title">
              <i class="fa-solid fa-scroll"></i> Notas de Scouting
            </div>
            <div class="read-description">${esc(o.notes)}</div>
          </div>` : `
          <div class="read-section">
            <div class="read-section-title">
              <i class="fa-solid fa-scroll"></i> Notas de Scouting
            </div>
            <div class="read-description empty">
              <i class="fa-solid fa-circle-info"></i> Nenhuma nota de scouting registrada.
            </div>
          </div>`}

        </div>
        <div class="modal-foot">
          <button type="button" class="btn primary" data-close>
            <i class="fa-solid fa-check"></i> Fechar
          </button>
        </div>
      </div>
    </div>`;

  const backdrop = $('.modal-backdrop', root);
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) closeModal(); });
  $$('[data-close]', root).forEach(b => b.addEventListener('click', closeModal));
  document.addEventListener('keydown', escHandler);
}