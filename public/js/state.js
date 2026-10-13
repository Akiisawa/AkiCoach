import { dbSet, dbGet, dbListen, dbUpdate } from './firebase.js';

export const ROLES = [
  { id:'TOP', name:'Topo', icon:'fa-shield-halved' },
  { id:'JNG', name:'Caçador', icon:'fa-tree' },
  { id:'MID', name:'Meio', icon:'fa-wand-sparkles' },
  { id:'ADC', name:'Atirador', icon:'fa-crosshairs' },
  { id:'SUP', name:'Suporte', icon:'fa-hand-holding-heart' }
];

export const ROLE_ORDER = { TOP:0, JNG:1, MID:2, ADC:3, SUP:4 };

export const STAFF_ROLES = [
  { id:'HEAD_COACH', name:'Head Coach', icon:'fa-user-tie' },
  { id:'ANALYST',    name:'Analista',   icon:'fa-chart-line' },
  { id:'MANAGER',    name:'Manager',    icon:'fa-briefcase' }
];
export const STAFF_ORDER = { HEAD_COACH:0, ANALYST:1, MANAGER:2 };

export const roleName = r => {
  const staff = STAFF_ROLES.find(x => x.id === r);
  if (staff) return staff.name;
  return (ROLES.find(x => x.id === r) || {}).name || r;
};

export const roleIcon = r => {
  const staff = STAFF_ROLES.find(x => x.id === r);
  if (staff) return staff.icon;
  return (ROLES.find(x => x.id === r) || {}).icon || 'fa-circle';
};

export const isStaffRole = r => STAFF_ROLES.some(x => x.id === r);

export const EVENT_TYPES = {
  scrim:   { label:'Scrim', color:'#3b82f6' },
  oficial: { label:'Partida Oficial', color:'#c8aa6e' },
  vod:     { label:'Revisão de VOD', color:'#a855f7' },
  treino:  { label:'Treino Individual', color:'#0ac8b9' },
  reuniao: { label:'Reunião', color:'#64748b' },
  folga:   { label:'Folga', color:'#22c55e' }
};

export const TIERS = ['S','A','B','C'];
export const PICK_TYPES = {
  blind:{ label:'Blindável', cls:'blind' },
  counter:{ label:'Counter', cls:'counter' },
  pocket:{ label:'Pocket', cls:'pocket' },
  treino:{ label:'Em treino', cls:'treino' },
  ban:{ label:'Evitar', cls:'ban' }
};

export const MOODS = ['😫','😕','😐','🙂','🤩'];

export const CHAMPS = [
  "Aatrox","Ahri","Akali","Akshan","Alistar","Ambessa","Amumu","Anivia","Annie","Aphelios",
  "Ashe","Aurelion Sol","Aurora","Azir","Bard","Bel'Veth","Blitzcrank","Brand","Braum","Briar",
  "Caitlyn","Camille","Cassiopeia","Cho'Gath","Corki","Darius","Diana","Dr. Mundo","Draven",
  "Ekko","Elise","Evelynn","Ezreal","Fiddlesticks","Fiora","Fizz","Galio","Gangplank","Garen","Gnar","Gragas",
  "Graves","Gwen","Hecarim","Heimerdinger","Hwei","Illaoi","Irelia","Ivern","Janna","Jarvan IV",
  "Jax","Jayce","Jhin","Jinx","K'Sante","Kai'Sa","Kalista","Karma","Karthus","Kassadin",
  "Katarina","Kayle","Kayn","Kennen","Kha'Zix","Kindred","Kled","Kog'Maw","LeBlanc","Lee Sin",
  "Leona","Lillia","Lissandra","Locke","Lucian","Lulu","Lux","Malphite","Malzahar","Maokai",
  "Master Yi","Mel","Milio","Miss Fortune","Mordekaiser","Morgana","Naafiri","Nami","Nasus",
  "Nautilus","Neeko","Nidalee","Nilah","Nocturne","Nunu","Olaf","Orianna","Ornn","Pantheon",
  "Poppy","Pyke","Qiyana","Quinn","Rakan","Rammus","Rek'Sai","Rell","Renata Glasc","Renekton",
  "Rengar","Riven","Rumble","Ryze","Samira","Sejuani","Senna","Seraphine","Sett","Shaco","Shen",
  "Shyvana","Singed","Sion","Sivir","Skarner","Smolder","Sona","Soraka","Swain","Sylas","Syndra",
  "Tahm Kench","Taliyah","Talon","Taric","Teemo","Thresh","Tristana","Trundle","Tryndamere",
  "Twisted Fate","Twitch","Udyr","Urgot","Varus","Vayne","Veigar","Vel'Koz","Vex","Vi","Viego",
  "Viktor","Vladimir","Volibear","Warwick","Wukong","Xayah","Xerath","Xin Zhao","Yasuo","Yone",
  "Yorick","Yunara","Zaahen","Yuumi","Zac","Zed","Zeri","Ziggs","Zilean","Zoe","Zyra"
];

export const state = {
  user: null,
  teamUid: null,
  coachName: '',
  team: { name:'Meu Time', tag:'TAG' },
  players: [],
  events: [],
  scrims: [],
  tournaments: [],
  drafts: [],
  draft: {
    blue: { bans:['','','','',''], picks:['','','','',''] },
    red: { bans:['','','','',''], picks:['','','','',''] }
  },
  fearless: {
    enabled: false,
    totalGames: 3,
    currentGame: 1,
    lockedChamps: [],
    history: []
  },
  counters: {},
  countersSeeded: false,
  comps: [],
  notes: [],
  tasks: [],
  opponents: [],
  moods: {}
};

export const uid = () => Math.random().toString(36).slice(2, 10);
export const pad = n => String(n).padStart(2, '0');
export const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export const parseKey = k => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
export const fmtShort = k => { const d = parseKey(k); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}`; };
export const WEEK = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const TODAY = dateKey(new Date());
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* Firebase RTDB não aceita ".", "#", "$", "/", "[", "]" em chaves.
   Sanitizamos counters na borda (ex: "Dr. Mundo" -> "Dr·Mundo"). */
const KEY_DOT = '\u2024';
export const counterKey   = name => String(name || '').replace(/\./g, KEY_DOT);
export const counterName  = key  => String(key  || '').replace(new RegExp(KEY_DOT, 'g'), '.');

function countersFromDb(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    out[counterName(k)] = v;
  }
  return out;
}

function countersToDb(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    out[counterKey(k)] = v;
  }
  return out;
}

export function seedData() {
  const off = n => { const d = new Date(); d.setDate(d.getDate() + n); return dateKey(d); };
  const mk = (nick, role, status, pool) => ({
    id: uid(), nick, name:'', role, status,
    riot: { gameName:'', tagLine:'', puuid:'', platform:'BR1', rank:'', iconId:'' },
    pool: pool.map(([champ, tier, type, notes]) => ({ id: uid(), champ, tier, type, notes: notes||'' }))
  });
  return {
    team: { name:'Aki Esports', tag:'AKI' },
    players: [
      mk('Akisawa','MID','titular',[['Azir','S','blind',''],['Orianna','S','blind',''],['Ahri','A','pocket',''],['Sylas','B','counter','']]),
      mk('Atlas','TOP','titular',[['Aatrox','S','blind',''],['Renekton','A','counter',''],['Gnar','A','blind','']]),
      mk('Vortex','JNG','titular',[['Vi','S','blind',''],['Sejuani','S','blind',''],['Lee Sin','A','counter','']]),
      mk('Kite','ADC','titular',[['Kai\'Sa','S','blind',''],['Jinx','A','blind',''],['Varus','A','counter','']]),
      mk('Ward','SUP','titular',[['Rakan','S','blind',''],['Nautilus','S','blind',''],['Lulu','A','blind','']])
    ],
    events: [],
    scrims: [
      { id:uid(), date:off(-2), opponent:'Time A', result:'W', score:'3-1', format:'Bo5',
        opponentRoster: { TOP:'Kaio', JNG:'Moon', MID:'Fade', ADC:'Kri', SUP:'Zeta' },
        notes:'Bom controle de drakes.' },
      { id:uid(), date:off(-4), opponent:'Time B', result:'L', score:'1-3', format:'Bo5',
        opponentRoster: { TOP:'Ryu', JNG:'Cloud', MID:'Vex', ADC:'Nova', SUP:'Pix' },
        notes:'Perdemos early nas 3 derrotas.' }
    ],
    tournaments: [],
    drafts: [],
    fearless: {
      enabled: false,
      totalGames: 3,
      currentGame: 1,
      lockedChamps: [],
      history: []
    },
    comps: [],
    notes: [],
    tasks: [],
    opponents: [],
    moods: {}
  };
}

export function normalizePlayer(p) {
  if (!p || typeof p !== 'object') return null;
  return {
    id: p.id || uid(),
    nick: String(p.nick || 'Sem nome').trim(),
    name: String(p.name || '').trim(),
    role: p.role || 'MID',
    status: p.status || 'titular',
    pinHash: p.pinHash || null,
    discord: String(p.discord || '').trim(),
    pool: Array.isArray(p.pool) ? p.pool.filter(Boolean) : [],
    riot: (p.riot && typeof p.riot === 'object') ? p.riot : {
      gameName: '', tagLine: '', puuid: '', platform: 'BR1', rank: '', iconId: ''
    },
  };
}

export function normalizePlayers(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizePlayer).filter(Boolean);
}

export async function loadFromFirebase(uid) {
  const data = await dbGet(`teams/${uid}`);
  if (!data) return false;
  state.team = data.team || state.team;
  state.players = data.players ? normalizePlayers(Object.values(data.players)) : [];
  state.events = data.events ? Object.values(data.events) : [];
  state.scrims = data.scrims ? Object.values(data.scrims) : [];
  state.tournaments = data.tournaments ? Object.values(data.tournaments) : [];
  state.drafts = data.drafts ? Object.values(data.drafts) : [];
  state.fearless = data.fearless || { enabled: false, totalGames: 3, currentGame: 1, lockedChamps: [], history: [] };
  state.counters = countersFromDb(data.counters);
  state.draft = data.draft || state.draft;
  state.draftTimer = data.draftTimer || { running: false, value: 30, duration: 30, startedAt: 0 };
  state.countersSeeded = data.countersSeeded || false;
  state.comps = data.comps ? Object.values(data.comps) : [];
  state.notes = data.notes ? Object.values(data.notes) : [];
  state.tasks = data.tasks ? Object.values(data.tasks) : [];
  state.opponents = data.opponents ? Object.values(data.opponents) : [];
  state.moods = data.moods || {};
  return true;
}

export async function saveToFirebase() {
  if (!state.teamUid) return;
  await dbSet(`teams/${state.teamUid}`, {
    team: state.team,
    players: state.players,
    events: state.events,
    scrims: state.scrims,
    tournaments: state.tournaments,
    drafts: state.drafts,
    draft: state.draft,
    fearless: state.fearless,
    draftTimer: state.draftTimer,
    counters: countersToDb(state.counters),
    countersSeeded: state.countersSeeded,
    comps: state.comps,
    notes: state.notes,
    tasks: state.tasks,
    opponents: state.opponents,
    moods: state.moods,
    _updatedAt: Date.now()
  });
}

export function listenTeam(uid, cb) {
  return dbListen(`teams/${uid}`, data => {
    if (!data) return;
    if (data.team) state.team = data.team;
    if (data.players) state.players = normalizePlayers(Object.values(data.players));
    if (data.events) state.events = Object.values(data.events);
    if (data.scrims) state.scrims = Object.values(data.scrims);
    if (data.tournaments) state.tournaments = Object.values(data.tournaments);
    if (data.drafts) state.drafts = Object.values(data.drafts);
    if (data.draft) state.draft = data.draft;
    if (data.draftTimer) state.draftTimer = data.draftTimer;
    if (data.fearless) state.fearless = data.fearless;
    if (data.counters !== undefined) state.counters = countersFromDb(data.counters);
    if (data.countersSeeded !== undefined) state.countersSeeded = data.countersSeeded;
    if (data.comps) state.comps = Object.values(data.comps);
    if (data.notes) state.notes = Object.values(data.notes);
    if (data.tasks) state.tasks = Object.values(data.tasks);
    if (data.opponents) state.opponents = Object.values(data.opponents);
    if (data.moods) state.moods = data.moods;
    if (cb) cb();
  });
}

const PLAYER_SESSION_KEY = 'aki_player_session';

export function getPlayerSession() {
  try {
    const raw = localStorage.getItem(PLAYER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setPlayerSession(session) {
  localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
}

export function clearPlayerSession() {
  localStorage.removeItem(PLAYER_SESSION_KEY);
}

export async function hashPin(nick, pin) {
  const data = new TextEncoder().encode(`${String(nick).toLowerCase()}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

let _saveTimer = null;
function saveAndRender() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    if (state.teamUid) {
      dbUpdate(`teams/${state.teamUid}`, {
        draft: state.draft,
        fearless: state.fearless,
        draftTimer: state.draftTimer,
      }).catch(e => console.warn('Save falhou:', e));
    }
  }, 150);
  document.dispatchEvent(new CustomEvent('aki:rerender'));
}

state.draftTimer = {
  running: false,
  value: 30,
  startedAt: 0,
  duration: 30,
};