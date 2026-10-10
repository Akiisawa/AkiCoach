import { dbGet, dbSet, dbListen } from './firebase.js';

export const ROLES = [
  { id:'TOP', name:'Topo', icon:'fa-shield-halved' },
  { id:'JNG', name:'Caçador', icon:'fa-tree' },
  { id:'MID', name:'Meio', icon:'fa-wand-sparkles' },
  { id:'ADC', name:'Atirador', icon:'fa-crosshairs' },
  { id:'SUP', name:'Suporte', icon:'fa-hand-holding-heart' }
];

export const ROLE_ORDER = { TOP:0, JNG:1, MID:2, ADC:3, SUP:4 };
export const roleName = r => (ROLES.find(x => x.id === r) || {}).name || r;
export const roleIcon = r => (ROLES.find(x => x.id === r) || {}).icon || 'fa-circle';

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
  "Ekko","Elise","Evelynn","Ezreal","Fiora","Fizz","Galio","Gangplank","Garen","Gnar","Gragas",
  "Graves","Gwen","Hecarim","Heimerdinger","Hwei","Illaoi","Irelia","Ivern","Janna","Jarvan IV",
  "Jax","Jayce","Jhin","Jinx","K'Sante","Kai'Sa","Kalista","Karma","Karthus","Kassadin",
  "Katarina","Kayle","Kayn","Kennen","Kha'Zix","Kindred","Kled","Kog'Maw","LeBlanc","Lee Sin",
  "Leona","Lillia","Lissandra","Lucian","Lulu","Lux","Malphite","Malzahar","Maokai","Master Yi",
  "Mel","Milio","Miss Fortune","Mordekaiser","Morgana","Naafiri","Nami","Nasus","Nautilus",
  "Neeko","Nidalee","Nilah","Nocturne","Nunu","Olaf","Orianna","Ornn","Pantheon","Poppy","Pyke",
  "Qiyana","Quinn","Rakan","Rammus","Rek'Sai","Rell","Renata Glasc","Renekton","Rengar","Riven",
  "Rumble","Ryze","Samira","Sejuani","Senna","Seraphine","Sett","Shaco","Shen","Shyvana","Singed",
  "Sion","Sivir","Skarner","Smolder","Sona","Soraka","Swain","Sylas","Syndra","Tahm Kench",
  "Taliyah","Talon","Taric","Teemo","Thresh","Tristana","Trundle","Tryndamere","Twisted Fate",
  "Twitch","Udyr","Urgot","Varus","Vayne","Veigar","Vel'Koz","Vex","Vi","Viego","Viktor",
  "Vladimir","Volibear","Warwick","Wukong","Xayah","Xerath","Xin Zhao","Yasuo","Yone","Yorick",
  "Yuumi","Zac","Zed","Zeri","Ziggs","Zilean","Zoe","Zyra"
];

export const state = {
  user: null,
  teamUid: null,
  team: { name:'Meu Time', tag:'TAG' },
  players: [],
  events: [],
  scrims: [],
  drafts: [],
  draft: {
    blue: { bans:['','','','',''], picks:['','','','',''] },
    red: { bans:['','','','',''], picks:['','','','',''] }
  },
  notes: [],
  tasks: [],
  opponents: [],
  moods: {},
  theme: 'dark'
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
    events: [
      { id:uid(), date:off(0), time:'14:00', type:'scrim', title:'Scrim vs Time X', duration:180, opponent:'Time X', notes:'Foco early game' },
      { id:uid(), date:off(1), time:'19:00', type:'vod', title:'Revisão de VOD', duration:90, opponent:'', notes:'' },
      { id:uid(), date:off(2), time:'13:00', type:'treino', title:'Solo Q — 5 jogos', duration:120, opponent:'', notes:'' },
      { id:uid(), date:off(4), time:'11:00', type:'oficial', title:'Partida — Liga', duration:240, opponent:'Time Z', notes:'Bo3' }
    ],
    scrims: [
      { id:uid(), date:off(-2), opponent:'Time A', result:'W', score:'3-1', format:'Bo5', notes:'Bom controle de drakes.' },
      { id:uid(), date:off(-4), opponent:'Time B', result:'L', score:'1-3', format:'Bo5', notes:'Perdemos early nas 3 derrotas.' }
    ],
    drafts: [],
    notes: [
      { id:uid(), title:'Prioridades da semana', body:'Melhorar drake control\nFixar pool de SUP em 3 campeões\nRevisar teamfights', tag:'Time', date:off(0) }
    ],
    tasks: [
      { id:uid(), title:'Assistir 3 VODs do adversário', assignee:'Akisawa', due:off(3), done:false, priority:'alta' }
    ],
    opponents: [],
    moods: {}
  };
}

export async function loadFromFirebase(uid) {
  const data = await dbGet(`teams/${uid}`);
  if (!data) return false;
  state.team = data.team || state.team;
  state.players = data.players ? Object.values(data.players) : [];
  state.events = data.events ? Object.values(data.events) : [];
  state.scrims = data.scrims ? Object.values(data.scrims) : [];
  state.drafts = data.drafts ? Object.values(data.drafts) : [];
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
    drafts: state.drafts,
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
    if (data.players) state.players = Object.values(data.players);
    if (data.events) state.events = Object.values(data.events);
    if (data.scrims) state.scrims = Object.values(data.scrims);
    if (data.drafts) state.drafts = Object.values(data.drafts);
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