const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const STATS_DIR = process.env.STATS_DIR || '/Users/simonkrenn/Downloads/stats';
const APP_DIR = __dirname;
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const NAMES_FILE = path.join(APP_DIR, 'player-names.json');
const MOJANG_CACHE_FILE = path.join(APP_DIR, 'player-names-cache.json');
const MOJANG_CACHE_TTL_MS = Number(process.env.MOJANG_CACHE_TTL_HOURS || 24) * 60 * 60 * 1000;

const CATEGORY_LABELS = {
  'minecraft:custom': 'Custom',
  'minecraft:mined': 'Mined',
  'minecraft:crafted': 'Crafted',
  'minecraft:used': 'Used',
  'minecraft:broken': 'Broken',
  'minecraft:picked_up': 'Picked up',
  'minecraft:dropped': 'Dropped',
  'minecraft:killed': 'Killed',
  'minecraft:killed_by': 'Killed by',
};

function safeReadJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function safeWriteJson(file, data) {
  try { fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`); } catch (err) { console.warn(`Could not write ${file}: ${err.message}`); }
}

function normalizeUuid(uuid) {
  return uuid.replace(/-/g, '').toLowerCase();
}

async function fetchMojangName(uuid) {
  const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${normalizeUuid(uuid)}`);
  if (response.status === 204 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Mojang API returned ${response.status}`);
  const profile = await response.json();
  return profile?.name || null;
}

async function resolveDisplayNames(uuids) {
  const overrides = safeReadJson(NAMES_FILE) || {};
  const cache = safeReadJson(MOJANG_CACHE_FILE) || {};
  const now = Date.now();
  let changed = false;

  for (const uuid of uuids) {
    if (overrides[uuid]) continue;
    const cached = cache[uuid];
    if (cached?.name && now - (cached.fetchedAt || 0) < MOJANG_CACHE_TTL_MS) continue;

    try {
      const name = await fetchMojangName(uuid);
      cache[uuid] = { name: name || uuid, fetchedAt: now };
      changed = true;
    } catch (err) {
      console.warn(`Could not resolve Mojang username for ${uuid}: ${err.message}`);
      cache[uuid] = { name: cached?.name || uuid, fetchedAt: cached?.fetchedAt || 0, error: err.message };
    }
  }

  if (changed) safeWriteJson(MOJANG_CACHE_FILE, cache);
  return Object.fromEntries(uuids.map(uuid => [uuid, overrides[uuid] || cache[uuid]?.name || uuid]));
}

function humanizeId(id) {
  return id.split(':').pop().replace(/_/g, ' ');
}

function formatNumber(n) { return Intl.NumberFormat('en-US').format(n); }

function formatDurationTicks(ticks) {
  const seconds = Math.floor(ticks / 20);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDistanceCm(cm) {
  const m = cm / 100;
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
  return `${m.toFixed(m >= 100 ? 0 : 1)} m`;
}

function formatHearts(tenths) { return `${(tenths / 2).toFixed(tenths % 2 ? 1 : 0)} ❤`; }

function formatCustomStat(statId, value) {
  if (statId.endsWith('_one_cm')) return formatDistanceCm(value);
  if (statId === 'minecraft:play_time' || statId.startsWith('minecraft:time_since_')) return formatDurationTicks(value);
  if (statId.startsWith('minecraft:damage_')) return formatHearts(value);
  return formatNumber(value);
}

function withDisplayValue(row, stat) {
  return { ...row, displayValue: formatCustomStat(stat, row.value) };
}

async function loadData() {
  const files = fs.existsSync(STATS_DIR) ? fs.readdirSync(STATS_DIR).filter(f => f.endsWith('.json')) : [];
  const displayNames = await resolveDisplayNames(files.map(file => path.basename(file, '.json')));
  const players = files.map(file => {
    const uuid = path.basename(file, '.json');
    const raw = safeReadJson(path.join(STATS_DIR, file));
    const stats = raw?.stats || {};
    const categories = Object.entries(stats).map(([category, values]) => ({ category, values: values || {} }));
    const custom = stats['minecraft:custom'] || {};
    const totals = Object.values(stats).reduce((acc, category) => {
      for (const [stat, value] of Object.entries(category || {})) acc[stat] = (acc[stat] || 0) + value;
      return acc;
    }, {});
    const topMetrics = {
      play_time: custom['minecraft:play_time'] || 0,
      deaths: custom['minecraft:deaths'] || 0,
      mob_kills: Object.values(stats['minecraft:killed'] || {}).reduce((a, b) => a + b, 0),
      walk_one_cm: custom['minecraft:walk_one_cm'] || 0,
      sprint_one_cm: custom['minecraft:sprint_one_cm'] || 0,
      aviate_one_cm: custom['minecraft:aviate_one_cm'] || 0,
    };
    return { uuid, name: displayNames[uuid] || uuid, stats, categories, totals, topMetrics };
  });
  return { players, displayNames };
}

function buildLeaderboards(players, category, stat) {
  return players
    .map(p => ({ uuid: p.uuid, name: p.name, value: p.stats?.[category]?.[stat] || 0 }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

function leaderboard(players, title, category, stat) {
  return {
    title,
    category,
    stat,
    rows: buildLeaderboards(players, category, stat).slice(0, 10).map(r => withDisplayValue(r, stat)),
  };
}

function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const file = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.normalize(path.join(PUBLIC_DIR, file));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath);
  const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type });
  res.end(fs.readFileSync(filePath));
  return true;
}

async function handleApi(_, res, url) {
  const { players } = await loadData();
  if (url.pathname === '/api/players') return json(res, 200, {
    players: players.map(p => ({
      uuid: p.uuid,
      name: p.name,
      ...p.topMetrics,
      display: {
        play_time: formatCustomStat('minecraft:play_time', p.topMetrics.play_time),
        deaths: formatNumber(p.topMetrics.deaths),
        mob_kills: formatNumber(p.topMetrics.mob_kills),
        walk_one_cm: formatCustomStat('minecraft:walk_one_cm', p.topMetrics.walk_one_cm),
        sprint_one_cm: formatCustomStat('minecraft:sprint_one_cm', p.topMetrics.sprint_one_cm),
        aviate_one_cm: formatCustomStat('minecraft:aviate_one_cm', p.topMetrics.aviate_one_cm),
      },
    })),
  });
  if (url.pathname === '/api/summary') {
    const categories = [...new Set(players.flatMap(p => Object.keys(p.stats || {})))].sort();
    const totalTopLevel = players.reduce((acc, p) => {
      for (const [cat, values] of Object.entries(p.stats || {})) for (const [stat, val] of Object.entries(values || {})) acc[`${cat}.${stat}`] = (acc[`${cat}.${stat}`] || 0) + val;
      return acc;
    }, {});
    return json(res, 200, {
      players: players.length,
      categories: categories.map(id => ({ id, label: CATEGORY_LABELS[id] || humanizeId(id) })),
      totalTopLevel,
      featuredLeaderboards: [
        { title: 'Mob kills', category: 'minecraft:killed', stat: null, rows: players.map(p => ({ uuid: p.uuid, name: p.name, value: Object.values(p.stats['minecraft:killed'] || {}).reduce((a, b) => a + b, 0) })).filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 10).map(r => ({ ...r, displayValue: formatNumber(r.value) })) },
        leaderboard(players, 'Deaths', 'minecraft:custom', 'minecraft:deaths'),
        leaderboard(players, 'Walked', 'minecraft:custom', 'minecraft:walk_one_cm'),
        leaderboard(players, 'Sprinted', 'minecraft:custom', 'minecraft:sprint_one_cm'),
        leaderboard(players, 'Flown', 'minecraft:custom', 'minecraft:aviate_one_cm'),
      ],
    });
  }
  if (url.pathname.startsWith('/api/player/')) {
    const uuid = decodeURIComponent(url.pathname.split('/').pop());
    const player = players.find(p => p.uuid === uuid);
    if (!player) return json(res, 404, { error: 'Player not found' });
    const categoryEntries = Object.entries(player.stats || {}).map(([category, values]) => ({
      category,
      label: CATEGORY_LABELS[category] || humanizeId(category),
      topEntries: Object.entries(values || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([stat, value]) => ({ stat, label: humanizeId(stat), value, displayValue: formatCustomStat(stat, value) })),
    }));
    return json(res, 200, { uuid: player.uuid, name: player.name, stats: player.stats, categories: categoryEntries });
  }
  if (url.pathname === '/api/leaderboard') {
    const category = url.searchParams.get('category');
    const stat = url.searchParams.get('stat');
    if (!category || !stat) return json(res, 400, { error: 'category and stat are required' });
    const rows = buildLeaderboards(players, category, stat).map(r => withDisplayValue(r, stat));
    return json(res, 200, { category, stat, rows });
  }
  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      if (await handleApi(req, res, url) !== false) return;
    } else if (serveStatic({ url: url.pathname }, res)) return;
    if (url.pathname === '/') return serveStatic({ url: '/' }, res);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Internal server error', detail: err.message }));
  }
});

server.listen(PORT, () => console.log(`mc-stats-leaderboard listening on ${PORT}`));
