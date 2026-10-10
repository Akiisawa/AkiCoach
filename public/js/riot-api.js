const RIOT_PROXY = '/api/riot';

const REGIONS = {
  BR1:'br1', NA1:'na1', EUW1:'euw1', EUN1:'eun1',
  KR:'kr', JP1:'jp1', LA1:'la1', LA2:'la2', OC1:'oc1', TR1:'tr1', RU:'ru'
};

const ROUTING = {
  americas: ['na1','br1','la1','la2','oc1'],
  asia:     ['kr','jp1'],
  europe:   ['euw1','eun1','tr1','ru']
};

function routingFor(platform) {
  for (const [route, plats] of Object.entries(ROUTING)) {
    if (plats.includes(platform)) return route;
  }
  return 'americas';
}

async function riotFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.status?.message || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export function getAccountByRiotId(platform, gameName, tagLine) {
  const route = routingFor(REGIONS[platform] || 'br1');
  return riotFetch(`${RIOT_PROXY}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?routing=${route}`);
}

export function getSummonerByPuuid(platform, puuid) {
  const p = REGIONS[platform] || 'br1';
  return riotFetch(`${RIOT_PROXY}/lol/summoner/v4/summoners/by-puuid/${puuid}?platform=${p}`);
}

export function getRankedStats(platform, puuid) {
  const p = REGIONS[platform] || 'br1';
  return riotFetch(`${RIOT_PROXY}/lol/league/v4/entries/by-puuid/${puuid}?platform=${p}`);
}

export function getMatchIds(platform, puuid, { count = 10, queue = 420 } = {}) {
  const route = routingFor(REGIONS[platform] || 'br1');
  return riotFetch(`${RIOT_PROXY}/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}&queue=${queue}&routing=${route}`);
}

export function getMatchDetails(platform, matchId) {
  const route = routingFor(REGIONS[platform] || 'br1');
  return riotFetch(`${RIOT_PROXY}/lol/match/v5/matches/${matchId}?routing=${route}`);
}

export function getChampionMastery(platform, puuid) {
  const p = REGIONS[platform] || 'br1';
  return riotFetch(`${RIOT_PROXY}/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=10&platform=${p}`);
}

let ddragonVersion = null;
export async function getDdragonVersion() {
  if (ddragonVersion) return ddragonVersion;
  try {
    const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const v = await res.json();
    ddragonVersion = v[0];
    return ddragonVersion;
  } catch { return '14.1.1'; }
}

function queueName(q) {
  const map = { 420:'Solo/Duo', 440:'Flex', 400:'Normal', 430:'Normal Blind',
                450:'ARAM', 700:'Clash', 900:'URF', 1700:'Arena' };
  return map[q] || 'Outro';
}

function aggregate(matches) {
  if (!matches.length) {
    return { matches:[], total:0, wins:0, losses:0, winrate:0, avgKills:0, avgDeaths:0,
             avgAssists:0, kda:0, avgCsPerMin:0, avgDamage:0, avgVision:0,
             champions:[], roles:[], streak:{ type:null, count:0 } };
  }

  const total = matches.length;
  const wins = matches.filter(m => m.win).length;
  const avg = (arr, key) => arr.reduce((s, m) => s + (m[key] || 0), 0) / arr.length;
  const avgKills = avg(matches, 'kills');
  const avgDeaths = avg(matches, 'deaths');
  const avgAssists = avg(matches, 'assists');
  const kda = avgDeaths === 0 ? (avgKills + avgAssists) : (avgKills + avgAssists) / avgDeaths;

  const champMap = new Map();
  matches.forEach(m => {
    if (!champMap.has(m.champion)) {
      champMap.set(m.champion, { champion:m.champion, games:0, wins:0, kills:0, deaths:0, assists:0, cs:0, duration:0 });
    }
    const c = champMap.get(m.champion);
    c.games++;
    if (m.win) c.wins++;
    c.kills += m.kills;
    c.deaths += m.deaths;
    c.assists += m.assists;
    c.cs += m.cs;
    c.duration += m.durationMin;
  });
  const champions = [...champMap.values()].map(c => ({
    ...c,
    losses: c.games - c.wins,
    winrate: Math.round(c.wins / c.games * 100),
    kda: c.deaths === 0 ? (c.kills + c.assists) : +((c.kills + c.assists) / c.deaths).toFixed(2),
    csPerMin: +(c.cs / Math.max(c.duration, 1)).toFixed(1)
  })).sort((a, b) => b.games - a.games);

  const roleMap = new Map();
  matches.forEach(m => {
    const r = m.role || 'N/A';
    if (!roleMap.has(r)) roleMap.set(r, { role:r, games:0, wins:0 });
    const rr = roleMap.get(r);
    rr.games++;
    if (m.win) rr.wins++;
  });
  const roles = [...roleMap.values()].map(r => ({
    ...r, losses: r.games - r.wins, winrate: Math.round(r.wins / r.games * 100)
  })).sort((a, b) => b.games - a.games);

  const sorted = [...matches].sort((a, b) => b.date - a.date);
  let streakType = null, streakCount = 0;
  for (const m of sorted) {
    const t = m.win ? 'W' : 'L';
    if (streakType === null) { streakType = t; streakCount = 1; }
    else if (streakType === t) streakCount++;
    else break;
  }

  return {
    matches: sorted, total, wins, losses,
    winrate: Math.round(wins / total * 100),
    avgKills: +avgKills.toFixed(1),
    avgDeaths: +avgDeaths.toFixed(1),
    avgAssists: +avgAssists.toFixed(1),
    kda: +kda.toFixed(2),
    avgCsPerMin: +avg(matches, 'csPerMin').toFixed(1),
    avgDamage: Math.round(avg(matches, 'damage')),
    avgVision: +avg(matches, 'vision').toFixed(1),
    champions, roles,
    streak: { type: streakType, count: streakCount },
    updatedAt: Date.now()
  };
}

export async function fetchPlayerStats(platform, puuid, { count = 15, queue = 420 } = {}) {
  const matchIds = await getMatchIds(platform, puuid, { count, queue });
  const matches = [];

  for (const matchId of matchIds) {
    try {
      const m = await getMatchDetails(platform, matchId);
      const me = m.info.participants.find(p => p.puuid === puuid);
      if (!me) continue;

      const durationMin = m.info.gameDuration / 60;
      matches.push({
        matchId,
        champion: me.championName,
        win: me.win,
        kills: me.kills,
        deaths: me.deaths,
        assists: me.assists,
        cs: me.totalMinionsKilled + me.neutralMinionsKilled,
        csPerMin: +((me.totalMinionsKilled + me.neutralMinionsKilled) / durationMin).toFixed(1),
        duration: m.info.gameDuration,
        durationMin: +durationMin.toFixed(1),
        date: m.info.gameCreation,
        dateStr: new Date(m.info.gameCreation).toISOString().slice(0, 10),
        role: me.teamPosition || me.individualPosition || 'N/A',
        queue: m.info.queueId,
        queueName: queueName(m.info.queueId),
        damage: me.totalDamageDealtToChampions,
        vision: me.visionScore,
        gold: me.goldEarned
      });
    } catch (e) { console.warn('Match falhou:', matchId); }
    await new Promise(r => setTimeout(r, 60));
  }

  return aggregate(matches);
}

const STATS_TTL = 30 * 60 * 1000;

export function getCachedStats(playerId) {
  try {
    const raw = localStorage.getItem(`aki_stats_${playerId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.updatedAt > STATS_TTL) return null;
    return data;
  } catch { return null; }
}

export function setCachedStats(playerId, stats) {
  try { localStorage.setItem(`aki_stats_${playerId}`, JSON.stringify(stats)); } catch {}
}

const CHAMP_ICON_MAP = {
  "Kai'Sa":"Kaisa","Kha'Zix":"Khazix","Cho'Gath":"Chogath","Kog'Maw":"KogMaw",
  "Rek'Sai":"RekSai","Vel'Koz":"Velkoz","Bel'Veth":"Belveth","Aurelion Sol":"AurelionSol",
  "Dr. Mundo":"DrMundo","Jarvan IV":"JarvanIV","Lee Sin":"LeeSin","Master Yi":"MasterYi",
  "Miss Fortune":"MissFortune","Nunu":"Nunu","Renata Glasc":"Renata",
  "Tahm Kench":"TahmKench","Twisted Fate":"TwistedFate","Xin Zhao":"XinZhao","Wukong":"MonkeyKing"
};

export function champIconName(name) {
  return CHAMP_ICON_MAP[name] || name.replace(/[^a-zA-Z]/g, '');
}