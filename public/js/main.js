import {
  state, seedData, loadFromFirebase, saveToFirebase, listenTeam,
  TODAY, WEEK, CHAMPS, esc,
  getPlayerSession, setPlayerSession, clearPlayerSession, hashPin
} from './state.js';
import {
  viewDash, viewAgenda, viewRoster, viewPools, viewMatrix,
  viewScrims, viewDraft, viewTasks, viewOpponents, viewNotes,
  viewPlayerDetail, viewComps, bindDraft, toastIcon,
  shiftCal, resetCal
} from './ui.js';
import {
  setRender, setGo, setCalHandlers, bindActions,
  setLogoutHandler, setPlayerLogoutHandler,
  modalConfirm, closeModal
} from './actions.js';
import {
  auth, signIn, logOut, onAuth, dbGet, dbSet,
  getPlayerIndex
} from './firebase.js';

const $ = (s, r = document) => r.querySelector(s);

const VIEWS = [
  { id:'dash', icon:'fa-gauge-high', label:'Dashboard' },
  { id:'agenda', icon:'fa-calendar-days', label:'Agenda' },
  { id:'roster', icon:'fa-users', label:'Roster' },
  { id:'pools', icon:'fa-dragon', label:'Champion Pools' },
  { id:'matrix', icon:'fa-table', label:'Matriz do Time' },
  { id:'scrims', icon:'fa-flag', label:'Scrims' },
  { id:'draft', icon:'fa-chess', label:'Draft Board' },
  { id:'comps', icon:'fa-layer-group', label:'Composições' },
  { id:'tasks', icon:'fa-list-check', label:'Tarefas' },
  { id:'opponents', icon:'fa-binoculars', label:'Scouting' },
  { id:'notes', icon:'fa-pen', label:'Anotações' }
];

const PLAYER_VIEWS = [
  { id:'player', icon:'fa-chart-line', label:'Meu Painel' },
  { id:'agenda', icon:'fa-calendar-days', label:'Agenda' },
  { id:'pools', icon:'fa-dragon', label:'Pools do Time' },
  { id:'matrix', icon:'fa-table', label:'Matriz do Time' },
  { id:'scrims', icon:'fa-flag', label:'Scrims' },
  { id:'tasks', icon:'fa-list-check', label:'Minhas Tarefas' },
  { id:'draft', icon:'fa-chess', label:'Draft Board' },
  { id:'comps', icon:'fa-layer-group', label:'Composições' },
  { id:'opponents', icon:'fa-binoculars', label:'Scouting' },
  { id:'notes', icon:'fa-pen', label:'Anotações' }
];

const TITLES = {
  dash: ['Dashboard', 'Visão geral do time'],
  agenda: ['Agenda', 'Scrims, partidas, revisões e treinos'],
  roster: ['Roster', 'Jogadores e comissão técnica'],
  pools: ['Champion Pools', 'Campeões por jogador, tier e tipo de pick'],
  matrix: ['Matriz do Time', 'Cobertura de campeões do roster'],
  scrims: ['Scrims', 'Histórico e resultados de treinos'],
  draft: ['Draft Board', 'Simulador de picks e bans'],
  comps: ['Composições', 'Comps do time para testar e aprovar'],
  tasks: ['Tarefas', 'Homework e metas individuais'],
  opponents: ['Scouting', 'Análise de oponentes'],
  notes: ['Anotações', 'Notas do coach e feedbacks'],
  player: ['Meu Painel', 'Seu desempenho individual']
};

let currentView = 'dash';
let isSignUp = false;
let playerModeActive = false;

function renderNav() {
  const views = playerModeActive ? PLAYER_VIEWS : VIEWS;
  const counts = playerModeActive ? {} : {
    roster: state.players.length,
    scrims: state.scrims.length,
    notes: state.notes.length,
    agenda: state.events.filter(e => e.date >= TODAY).length,
    opponents: state.opponents.length
  };
  $('#nav').innerHTML = views.map(v => `
    <button data-act="nav" data-view="${v.id}" class="${currentView===v.id?'active':''}">
      <i class="fa-solid ${v.icon}"></i>
      <span>${v.label}</span>
      ${counts[v.id] ? `<span class="badge">${counts[v.id]}</span>` : ''}
    </button>`).join('');
}

function go(view) {
  if (playerModeActive) {
    const allowed = PLAYER_VIEWS.find(v => v.id === view);
    if (!allowed) view = 'player';
  }
  currentView = view;
  renderNav();
  const [t, s] = TITLES[view] || ['Aki Coach', ''];
  const allViews = playerModeActive ? PLAYER_VIEWS : VIEWS;
  const icon = allViews.find(v => v.id === view)?.icon || 'fa-gauge-high';
  $('#page-title').innerHTML = `<i class="fa-solid ${icon}"></i> ${t}`;
  $('#page-sub').textContent = s;
  renderView();
  $('.main').scrollTop = 0;
}

function renderView() {
  const v = $('#view');
  switch (currentView) {
    case 'dash': v.innerHTML = viewDash(); break;
    case 'agenda': v.innerHTML = viewAgenda(); break;
    case 'roster': v.innerHTML = viewRoster(); break;
    case 'pools': v.innerHTML = viewPools(); break;
    case 'matrix': v.innerHTML = viewMatrix(); break;
    case 'scrims': v.innerHTML = viewScrims(); break;
    case 'draft': v.innerHTML = viewDraft(); bindDraft(); break;
    case 'comps': v.innerHTML = viewComps(); break;
    case 'tasks': v.innerHTML = viewTasks(); break;
    case 'opponents': v.innerHTML = viewOpponents(); break;
    case 'notes': v.innerHTML = viewNotes(); break;
    case 'player': v.innerHTML = viewPlayerDetail(); break;
  }
}

function tickClock() {
  const d = new Date();
  $('#clock').innerHTML = `<i class="fa-regular fa-clock"></i> ${WEEK[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} · ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
setInterval(tickClock, 15000);

function hidePreloader() {
  const pl = $('#preloader');
  if (!pl) return;
  pl.classList.add('hidden');
  setTimeout(() => { pl.style.display = 'none'; }, 500);
}

function showAuth() {
  document.body.classList.remove('player-mode');
  playerModeActive = false;
  $('#player-screen').style.display = 'none';
  $('#auth-screen').style.display = 'grid';
  $('#app').style.display = 'none';
  $('#preloader').style.display = 'none';
  $('#auth-error').textContent = '';
  setTimeout(() => $('#auth-email').focus(), 100);
}

function showPlayerLogin() {
  document.body.classList.remove('player-mode');
  playerModeActive = false;
  $('#auth-screen').style.display = 'none';
  $('#player-screen').style.display = 'grid';
  $('#app').style.display = 'none';
  $('#preloader').style.display = 'none';
  $('#player-error').textContent = '';
  $('#player-form').reset();
  setTimeout(() => $('#player-nick').focus(), 100);
}

function showApp() {
  $('#auth-screen').style.display = 'none';
  $('#player-screen').style.display = 'none';
  $('#app').style.display = 'grid';
  $('#preloader').style.display = 'grid';
  requestAnimationFrame(() => setTimeout(hidePreloader, 300));
}

function showPlayerApp(session) {
  playerModeActive = true;
  document.body.classList.add('player-mode');
  $('#auth-screen').style.display = 'none';
  $('#player-screen').style.display = 'none';
  $('#app').style.display = 'grid';
  $('#preloader').style.display = 'grid';

  const topActions = $('#player-topbar-actions');
  topActions.style.display = 'flex';
  topActions.innerHTML = `
    <div class="player-topbar">
      <i class="fa-solid fa-user"></i>
      <span>${esc(session.nick)}</span>
      <button class="btn" data-act="player-logout"><i class="fa-solid fa-right-from-bracket"></i> Sair</button>
    </div>`;

  requestAnimationFrame(() => setTimeout(hidePreloader, 300));
}

function bindAuthForm() {
  const form = $('#auth-form');
  const submit = $('#auth-submit');
  const errEl = $('#auth-error');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.textContent = '';
    const email = $('#auth-email').value.trim();
    const pass = $('#auth-password').value;
    submit.disabled = true;
    submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
    try {
      await signIn(email, pass);
    } catch (err) {
      const map = {
        'auth/invalid-email': 'Email inválido.',
        'auth/user-not-found': 'Usuário não encontrado.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-credential': 'Email ou senha inválidos.',
        'auth/too-many-requests': 'Muitas tentativas. Tente novamente em alguns minutos.'
      };
      errEl.textContent = map[err.code] || err.message;
    } finally {
      submit.disabled = false;
      submit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
    }
  });
}

function bindPlayerForm() {
  const form = $('#player-form');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const nick = $('#player-nick').value.trim();
    const pin = $('#player-pin').value.trim();
    const errEl = $('#player-error');
    const btn = $('#player-submit');
    errEl.textContent = '';

    if (!nick || !pin) {
      errEl.textContent = 'Preencha nick e PIN.';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verificando...';

    try {
      const entry = await getPlayerIndex(nick);
      if (!entry) {
        errEl.textContent = 'Nick não encontrado.';
        return;
      }

      const expected = await hashPin(nick, pin);
      if (expected !== entry.pinHash) {
        errEl.textContent = 'PIN incorreto.';
        return;
      }

      const session = {
        teamUid: entry.teamUid,
        playerId: entry.playerId,
        nick: entry.nick,
        loginAt: Date.now()
      };
      setPlayerSession(session);

      const ok = await initPlayerApp(session);
      if (!ok) {
        errEl.textContent = 'Erro ao carregar dados do time.';
        clearPlayerSession();
      }
    } catch (err) {
      console.error(err);
      errEl.textContent = 'Erro ao conectar. Tente novamente.';
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
    }
  });

  $('#back-to-player').addEventListener('click', showPlayerLogin);
}

async function initApp(user) {
  clearPlayerSession();
  document.body.classList.remove('player-mode');
  $('#player-topbar-actions').style.display = 'none';
  playerModeActive = false;

  state.user = user;
  state.teamUid = user.uid;

  const profile = await dbGet(`users/${user.uid}/profile`);
  if (!profile) {
    const defaultName = user.displayName || user.email.split('@')[0];
    await dbSet(`users/${user.uid}/profile`, {
      email: user.email,
      displayName: defaultName,
      role: 'head_coach',
      createdAt: Date.now()
    });
    await dbSet(`users/${user.uid}/teams`, { [user.uid]: true });
    state.coachName = defaultName;
  } else {
    state.coachName = profile.displayName || user.email.split('@')[0];
  }

  const hasData = await loadFromFirebase(user.uid);
  if (!hasData) {
    const seed = seedData();
    Object.assign(state, seed);
    await saveToFirebase();
  }

  listenTeam(user.uid, () => { renderNav(); renderView(); });
  $('#user-name').textContent = user.displayName || user.email.split('@')[0];

  const savedTheme = localStorage.getItem('aki_theme') || 'dark';
  state.theme = savedTheme;
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeIcon = document.querySelector('[data-act="toggle-theme"] i');
  if (themeIcon) themeIcon.className = savedTheme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';

  renderNav();
  go('dash');
  tickClock();
  showApp();
}

async function initPlayerApp(session) {
  try {
    state.teamUid = session.teamUid;
    const ok = await loadFromFirebase(session.teamUid);
    if (!ok) return false;

    const p = state.players.find(x => x.id === session.playerId);
    if (!p) return false;

    window.__akiCurrentPlayer = session.playerId;
    window.__akiPlayerNick = session.nick;

    playerModeActive = true;
    showPlayerApp(session);
    go('player');
    tickClock();

    listenTeam(session.teamUid, () => { renderView(); });
    return true;
  } catch (e) {
    console.error('Player init falhou:', e);
    return false;
  }
}

onAuth(async user => {
  if (user) {
    try { await initApp(user); }
    catch (e) {
      console.error(e);
      toastIcon('Erro ao carregar dados', 'fa-circle-xmark');
      showApp();
    }
    return;
  }

  const session = getPlayerSession();
  if (session) {
    const ok = await initPlayerApp(session);
    if (ok) return;
    clearPlayerSession();
  }

  showPlayerLogin();
});

setRender(() => { renderNav(); renderView(); });
setGo(go);
setCalHandlers(shiftCal, resetCal);
bindActions();

setLogoutHandler(async () => {
  modalConfirm('Sair', 'Deseja encerrar a sessão?', async () => {
    await logOut();
    closeModal();
  });
});

setPlayerLogoutHandler(() => {
  modalConfirm('Sair', 'Deseja sair da sua conta?', () => {
    clearPlayerSession();
    window.__akiCurrentPlayer = null;
    window.__akiPlayerNick = null;
    document.body.classList.remove('player-mode');
    playerModeActive = false;
    $('#player-topbar-actions').style.display = 'none';
    closeModal();
    showPlayerLogin();
  });
});

bindAuthForm();
bindPlayerForm();

$('#champ-list').innerHTML = CHAMPS.map(c => `<option value="${esc(c)}">`).join('');

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    showAuth();
    return;
  }
  if (playerModeActive) return;
  if (e.target.matches('input, textarea, select')) return;
  if (e.ctrlKey || e.metaKey) return;
  const map = { g:'agenda', d:'draft', r:'roster', p:'pools', t:'tasks', s:'scrims', n:'notes', o:'opponents', m:'matrix' };
  const key = e.key.toLowerCase();
  if (map[key]) { go(map[key]); e.preventDefault(); }
});