require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const { exec } = require('child_process');

if (!process.env.RIOT_KEY) {
  console.error('RIOT_KEY nao definida no .env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const RIOT_KEY = process.env.RIOT_KEY;

const ROUTING_MAP = {
  americas: ['na1','br1','la1','la2','oc1'],
  asia:     ['kr','jp1'],
  europe:   ['euw1','eun1','tr1','ru'],
  sea:      ['sg2','th2','tw2','vn2']
};

function routingFor(platform) {
  for (const [route, plats] of Object.entries(ROUTING_MAP)) {
    if (plats.includes(platform)) return route;
  }
  return 'americas';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

class RateLimiter {
  constructor(perSecond, perTwoMinutes) {
    this.perSecond = perSecond;
    this.perTwoMinutes = perTwoMinutes;
    this.shortWindow = [];
    this.longWindow = [];
    this.queue = [];
    this.processing = false;
  }

  acquire() {
    return new Promise(resolve => {
      this.queue.push(resolve);
      this.process();
    });
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      this.shortWindow = this.shortWindow.filter(t => now - t < 1000);
      this.longWindow = this.longWindow.filter(t => now - t < 120000);

      if (this.shortWindow.length >= this.perSecond) {
        await sleep(1000 - (now - this.shortWindow[0]) + 20);
        continue;
      }
      if (this.longWindow.length >= this.perTwoMinutes) {
        await sleep(120000 - (now - this.longWindow[0]) + 200);
        continue;
      }

      const resolve = this.queue.shift();
      const t = Date.now();
      this.shortWindow.push(t);
      this.longWindow.push(t);
      resolve();
    }
    this.processing = false;
  }
}

const limiter = new RateLimiter(18, 95);

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'aki-proxy', uptime: Math.round(process.uptime()) });
});

app.get('/api/test-key', async (req, res) => {
  try {
    await limiter.acquire();
    const r = await axios.get(
      'https://br1.api.riotgames.com/lol/status/v4/platform-data',
      { headers: { 'X-Riot-Token': RIOT_KEY } }
    );
    res.json({ ok: true, message: 'Chave valida', data: r.data });
  } catch (err) {
    res.status(err.response?.status || 500).json({
      ok: false,
      status: err.response?.status,
      message: err.response?.data?.status?.message || err.message
    });
  }
});

app.get('/api/riot/*', async (req, res) => {
  const platform = (req.query.platform || 'br1').toLowerCase();
  const apiPath = req.params[0];
  const query = { ...req.query };
  delete query.platform;

  let host;
if (apiPath.startsWith('match/v5/') || apiPath.startsWith('riot/account/v1/')) {
    const route = req.query.routing || routingFor(platform);
    delete query.routing;
    host = `https://${route}.api.riotgames.com`;
  } else {
    host = `https://${platform}.api.riotgames.com`;
  }

  const url = `${host}/${apiPath}`;
  let lastErr;

  for (let attempt = 0; attempt <= 4; attempt++) {
    try {
      await limiter.acquire();
      const r = await axios.get(url, {
        params: query,
        headers: { 'X-Riot-Token': RIOT_KEY, Accept: 'application/json' },
        timeout: 15000,
        validateStatus: null
      });

      if (r.status === 429) {
        const wait = parseInt(r.headers['retry-after'] || '2', 10);
        if (attempt < 4) { await sleep(wait * 1000 + 200); continue; }
        return res.status(429).json({ error: 'rate_limit', retryAfter: wait });
      }

      if (r.status >= 500 && attempt < 4) {
        await sleep((attempt + 1) * 1000);
        continue;
      }

      if (r.status >= 400) {
        return res.status(r.status).json({ error: 'riot_error', status: r.status, detail: r.data });
      }

      return res.json(r.data);
    } catch (err) {
      lastErr = err;
      if (attempt < 4) { await sleep(500 * (attempt + 1)); continue; }
      break;
    }
  }

  res.status(502).json({ error: 'proxy_error', message: lastErr?.message || 'Falha ao contatar Riot' });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  AKI COACH`);
  console.log(`  http://localhost:${PORT}\n`);

  if (process.env.NODE_ENV !== 'production') {
    const url = `http://localhost:${PORT}`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"` :
                process.platform === 'darwin' ? `open "${url}"` :
                `xdg-open "${url}"`;
    setTimeout(() => exec(cmd, () => {}), 800);
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Porta ${PORT} ja esta em uso.\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

// Shutdown graceful (Render envia SIGTERM)
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});