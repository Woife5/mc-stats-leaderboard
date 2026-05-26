// Self-hosted Minecraft stats leaderboard, fully client-side.
// Loads UUID-keyed stats JSON files served by static-web-server and builds
// the UI from them. Player names come from the inline PLAYER_NAMES map below;
// any unmapped UUID is shown verbatim.
//
// To add a new player: append a "<uuid>": "<name>" entry to PLAYER_NAMES,
// rebuild the image, and redeploy.

const PLAYER_NAMES = {
  '44ed0b57-d1eb-437f-8bbd-230ee4be8199': 'PlomeHD',
  '5f290be5-057b-4c91-bae2-125b0622fb68': 'Hetzy',
  '67866cbc-f2ac-42ed-a8ac-95d196542e7f': 'YungM0n',
  'cb731c2a-4e4c-4089-8d16-e63ad9a83f5b': 'Wolfgang_x',
  'ce689bf3-b20c-4c28-9ccf-453a8a12bc4b': 'Sunzi555',
  'cf3e20ab-2505-456e-8c87-51e79586c195': 'manujell',
  'e567583f-871a-41fd-920d-2b0e7a77255b': 'DaDaniel_',
};

const STATS_PATH = '/stats/';

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

const els = {
  featured: document.getElementById('featured'),
  playerCount: document.getElementById('playerCount'),
  categorySelect: document.getElementById('categorySelect'),
  statSelect: document.getElementById('statSelect'),
  leaderboard: document.getElementById('leaderboard'),
  players: document.getElementById('players'),
  detail: document.getElementById('detail'),
  search: document.getElementById('search'),
  loadLeaderboard: document.getElementById('loadLeaderboard'),
};

const fmt = new Intl.NumberFormat('de-AT');

// Mutable app state.
const state = {
  players: [],            // [{uuid, name, stats, topMetrics}]
  categories: [],         // [{id, label}]
  statsByCategory: {},    // {category: Set<stat>}
  featured: [],           // [{title, rows}]
  currentPlayer: null,
};

// ---------- formatting helpers ----------

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function humanize(id) {
  return String(id).split(':').pop().replace(/_/g, ' ');
}

function formatNumber(n) { return fmt.format(n); }

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

function formatHearts(tenths) {
  return `${(tenths / 2).toFixed(tenths % 2 ? 1 : 0)} ❤`;
}

function formatCustomStat(statId, value) {
  if (typeof statId === 'string' && statId.endsWith('_one_cm')) return formatDistanceCm(value);
  if (statId === 'minecraft:play_time' || (typeof statId === 'string' && statId.startsWith('minecraft:time_since_'))) return formatDurationTicks(value);
  if (typeof statId === 'string' && statId.startsWith('minecraft:damage_')) return formatHearts(value);
  return formatNumber(value);
}

// ---------- network helpers ----------

function cacheBust(url) {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

async function getJson(url) {
  const response = await fetch(cacheBust(url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Request failed for ${url}: ${response.status}`);
  return response.json();
}

// ---------- name resolution ----------

function resolveName(uuid) {
  return PLAYER_NAMES[uuid] || PLAYER_NAMES[uuid.toLowerCase()] || uuid;
}

// ---------- data loading ----------

async function listStatsUuids() {
  const listing = await getJson(STATS_PATH);
  if (!Array.isArray(listing)) return [];
  return listing
    .filter(entry => entry?.type === 'file' && entry.name?.endsWith('.json'))
    .map(entry => entry.name.replace(/\.json$/, ''));
}

async function loadStatsFile(uuid) {
  try { return await getJson(`${STATS_PATH}${encodeURIComponent(uuid)}.json`); }
  catch (err) { console.warn(`Failed to load ${uuid}: ${err.message}`); return null; }
}

// ---------- domain transforms ----------

function buildPlayer(uuid, raw) {
  const stats = raw?.stats || {};
  const custom = stats['minecraft:custom'] || {};
  const killed = stats['minecraft:killed'] || {};
  const topMetrics = {
    play_time: custom['minecraft:play_time'] || 0,
    deaths: custom['minecraft:deaths'] || 0,
    mob_kills: Object.values(killed).reduce((a, b) => a + b, 0),
    walk_one_cm: custom['minecraft:walk_one_cm'] || 0,
    sprint_one_cm: custom['minecraft:sprint_one_cm'] || 0,
    aviate_one_cm: custom['minecraft:aviate_one_cm'] || 0,
  };
  return { uuid, name: resolveName(uuid), stats, topMetrics };
}

function buildCategoryIndex(players) {
  const statsByCategory = {};
  for (const player of players) {
    for (const [category, values] of Object.entries(player.stats || {})) {
      if (!statsByCategory[category]) statsByCategory[category] = new Set();
      for (const stat of Object.keys(values || {})) statsByCategory[category].add(stat);
    }
  }
  const categories = Object.keys(statsByCategory).sort().map(id => ({
    id,
    label: CATEGORY_LABELS[id] || humanize(id),
  }));
  return { categories, statsByCategory };
}

function leaderboardRows(players, category, stat) {
  return players
    .map(p => ({ uuid: p.uuid, name: p.name, value: p.stats?.[category]?.[stat] || 0 }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

function withDisplay(row, stat) {
  return { ...row, displayValue: formatCustomStat(stat, row.value) };
}

function topBoard(players, title, category, stat, limit = 10) {
  return {
    title,
    rows: leaderboardRows(players, category, stat).slice(0, limit).map(r => withDisplay(r, stat)),
  };
}

function buildFeatured(players) {
  const mobKillRows = players
    .map(p => ({ uuid: p.uuid, name: p.name, value: Object.values(p.stats?.['minecraft:killed'] || {}).reduce((a, b) => a + b, 0) }))
    .filter(r => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
    .map(r => ({ ...r, displayValue: formatNumber(r.value) }));
  return [
    { title: 'Mob kills', rows: mobKillRows },
    topBoard(players, 'Deaths', 'minecraft:custom', 'minecraft:deaths'),
    topBoard(players, 'Walked', 'minecraft:custom', 'minecraft:walk_one_cm'),
    topBoard(players, 'Sprinted', 'minecraft:custom', 'minecraft:sprint_one_cm'),
    topBoard(players, 'Flown', 'minecraft:custom', 'minecraft:aviate_one_cm'),
    topBoard(players, 'Play time', 'minecraft:custom', 'minecraft:play_time'),
  ];
}

function buildPlayerDetail(player) {
  const categories = Object.entries(player.stats || {}).map(([category, values]) => ({
    category,
    label: CATEGORY_LABELS[category] || humanize(category),
    topEntries: Object.entries(values || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([stat, value]) => ({
        stat,
        label: humanize(stat),
        value,
        displayValue: formatCustomStat(stat, value),
      })),
  }));
  return { uuid: player.uuid, name: player.name, categories };
}

// ---------- rendering ----------

function rowHtml(row) {
  return `<div class="row"><span>${escapeHtml(row.name)}</span><span class="pill">${escapeHtml(row.displayValue ?? formatNumber(row.value || 0))}</span></div>`;
}

function renderFeatured() {
  els.featured.innerHTML = state.featured.map(board => `
    <div class="card">
      <h3>${escapeHtml(board.title)}</h3>
      ${board.rows.length ? board.rows.slice(0, 5).map(rowHtml).join('') : '<div class="empty">No stats available.</div>'}
    </div>
  `).join('');
}

function renderControls() {
  els.categorySelect.innerHTML = state.categories
    .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`)
    .join('');
  if (state.categories.some(c => c.id === 'minecraft:custom')) {
    els.categorySelect.value = 'minecraft:custom';
  }
  updateStatOptions();
  if ([...els.statSelect.options].some(o => o.value === 'minecraft:play_time')) {
    els.statSelect.value = 'minecraft:play_time';
  }
  els.categorySelect.onchange = () => { updateStatOptions(); renderLeaderboard(); };
  els.statSelect.onchange = renderLeaderboard;
  els.loadLeaderboard.onclick = renderLeaderboard;
}

function updateStatOptions() {
  const category = els.categorySelect.value;
  const stats = [...(state.statsByCategory[category] || [])].sort();
  els.statSelect.innerHTML = stats.length
    ? stats.map(stat => `<option value="${escapeHtml(stat)}">${escapeHtml(humanize(stat))}</option>`).join('')
    : '<option value="">No stats</option>';
}

function renderLeaderboard() {
  const category = els.categorySelect.value;
  const stat = els.statSelect.value;
  if (!category || !stat) {
    els.leaderboard.innerHTML = '<div class="empty">Pick a category and stat.</div>';
    return;
  }
  const rows = leaderboardRows(state.players, category, stat).map(r => withDisplay(r, stat));
  els.leaderboard.innerHTML = rows.length
    ? rows.map(rowHtml).join('')
    : '<div class="empty">No results for this stat.</div>';
}

function renderPlayers() {
  const query = els.search.value.trim().toLowerCase();
  const matches = state.players
    .filter(p => !query || p.name.toLowerCase().includes(query) || p.uuid.toLowerCase().includes(query))
    .sort((a, b) => b.topMetrics.play_time - a.topMetrics.play_time);
  els.players.innerHTML = matches.length
    ? matches.map(p => `
      <button class="row player-row" data-uuid="${escapeHtml(p.uuid)}">
        <span>${escapeHtml(p.name)}</span>
        <span class="player-metrics">
          <span class="pill">${escapeHtml(formatCustomStat('minecraft:play_time', p.topMetrics.play_time))}</span>
          <span class="muted">${escapeHtml(formatNumber(p.topMetrics.mob_kills))} kills</span>
        </span>
      </button>
    `).join('')
    : '<div class="empty">No players match your search.</div>';
  els.players.querySelectorAll('.player-row').forEach(btn => {
    btn.addEventListener('click', () => selectPlayer(btn.dataset.uuid));
  });
}

function selectPlayer(uuid) {
  const player = state.players.find(p => p.uuid === uuid);
  if (!player) return;
  state.currentPlayer = buildPlayerDetail(player);
  els.detail.innerHTML = `
    <h2>${escapeHtml(state.currentPlayer.name)}</h2>
    <div class="muted uuid">${escapeHtml(state.currentPlayer.uuid)}</div>
    <div class="tabs">${state.currentPlayer.categories
      .map((c, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-category="${escapeHtml(c.category)}">${escapeHtml(c.label)}</button>`)
      .join('')}</div>
    <div id="catBody"></div>
  `;
  els.detail.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => showCategory(tab.dataset.category));
  });
  showCategory(state.currentPlayer.categories[0]?.category);
}

function showCategory(category) {
  const cat = state.currentPlayer?.categories.find(c => c.category === category);
  els.detail.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === category);
  });
  const body = document.getElementById('catBody');
  if (!body) return;
  body.innerHTML = cat?.topEntries.length
    ? cat.topEntries.map(entry => rowHtml({ name: entry.label, displayValue: entry.displayValue })).join('')
    : '<div class="empty">No stats in this category.</div>';
}

// ---------- bootstrap ----------

function showFatal(message) {
  els.detail.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
}

async function load() {
  const uuids = await listStatsUuids();
  els.playerCount.textContent = uuids.length;

  if (!uuids.length) {
    els.featured.innerHTML = '';
    els.players.innerHTML = '<div class="empty">No player stats found in /stats.</div>';
    els.leaderboard.innerHTML = '<div class="empty">No data.</div>';
    showFatal('Bind-mount the server\'s world stats directory at /public/stats to populate this dashboard.');
    return;
  }

  const rawFiles = await Promise.all(uuids.map(loadStatsFile));

  state.players = uuids
    .map((uuid, i) => rawFiles[i] && buildPlayer(uuid, rawFiles[i]))
    .filter(Boolean);

  const { categories, statsByCategory } = buildCategoryIndex(state.players);
  state.categories = categories;
  state.statsByCategory = statsByCategory;
  state.featured = buildFeatured(state.players);

  renderFeatured();
  renderControls();
  renderPlayers();
  renderLeaderboard();
}

els.search.oninput = renderPlayers;

load().catch(err => {
  console.error(err);
  showFatal(`Failed to load stats: ${err.message}`);
});
