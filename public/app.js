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

let summary;
let players = [];
let currentPlayer;
const fmt = new Intl.NumberFormat('en-US');

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function humanize(id) {
  return String(id).split(':').pop().replace(/_/g, ' ');
}

function rowHtml(row) {
  return `<div class="row"><span>${escapeHtml(row.name)}</span><span class="pill">${escapeHtml(row.displayValue || fmt.format(row.value || 0))}</span></div>`;
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function load() {
  [summary, { players }] = await Promise.all([getJson('/api/summary'), getJson('/api/players')]);
  els.playerCount.textContent = summary.players;
  renderFeatured();
  renderControls();
  renderPlayers();
  await loadLeaderboard();
}

function renderFeatured() {
  els.featured.innerHTML = summary.featuredLeaderboards.map(board => `
    <div class="card">
      <h3>${escapeHtml(board.title)}</h3>
      ${board.rows.length ? board.rows.slice(0, 5).map(rowHtml).join('') : '<div class="empty">No stats available.</div>'}
    </div>
  `).join('');
}

function renderControls() {
  els.categorySelect.innerHTML = summary.categories.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');
  const preferred = [...els.categorySelect.options].find(o => o.value === 'minecraft:custom');
  if (preferred) els.categorySelect.value = preferred.value;
  updateStats();
  const playTime = [...els.statSelect.options].find(o => o.value === 'minecraft:play_time');
  if (playTime) els.statSelect.value = playTime.value;
  els.categorySelect.onchange = updateStats;
  els.loadLeaderboard.onclick = loadLeaderboard;
}

function updateStats() {
  const category = els.categorySelect.value;
  const stats = Object.keys(summary.totalTopLevel || {})
    .filter(key => key.startsWith(`${category}.`))
    .map(key => key.slice(category.length + 1))
    .sort();
  els.statSelect.innerHTML = stats.length
    ? stats.map(stat => `<option value="${escapeHtml(stat)}">${escapeHtml(humanize(stat))}</option>`).join('')
    : '<option value="">No stats</option>';
}

async function loadLeaderboard() {
  const category = els.categorySelect.value;
  const stat = els.statSelect.value;
  if (!category || !stat) return;
  const data = await getJson(`/api/leaderboard?category=${encodeURIComponent(category)}&stat=${encodeURIComponent(stat)}`);
  els.leaderboard.innerHTML = data.rows.length ? data.rows.map(rowHtml).join('') : '<div class="empty">No results for this stat.</div>';
}

function renderPlayers() {
  const query = els.search.value.toLowerCase();
  els.players.innerHTML = players
    .filter(p => !query || p.name.toLowerCase().includes(query) || p.uuid.includes(query))
    .map(p => `
      <button class="row player-row" onclick="selectPlayer('${escapeHtml(p.uuid)}')">
        <span>${escapeHtml(p.name)}</span>
        <span class="player-metrics">
          <span class="pill">${escapeHtml(p.display?.play_time || fmt.format(p.play_time || 0))}</span>
          <span class="muted">${escapeHtml(p.display?.mob_kills || fmt.format(p.mob_kills || 0))} kills</span>
        </span>
      </button>
    `).join('') || '<div class="empty">No players match your search.</div>';
}

async function selectPlayer(uuid) {
  currentPlayer = await getJson(`/api/player/${encodeURIComponent(uuid)}`);
  els.detail.innerHTML = `
    <h2>${escapeHtml(currentPlayer.name)}</h2>
    <div class="muted uuid">${escapeHtml(currentPlayer.uuid)}</div>
    <div class="tabs">${currentPlayer.categories.map((c, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-category="${escapeHtml(c.category)}">${escapeHtml(c.label)}</button>`).join('')}</div>
    <div id="catBody"></div>
  `;
  els.detail.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showCat(tab.dataset.category)));
  showCat(currentPlayer.categories[0]?.category);
}

function showCat(category) {
  const cat = currentPlayer?.categories.find(c => c.category === category);
  els.detail.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.category === category));
  document.getElementById('catBody').innerHTML = cat?.topEntries.length
    ? cat.topEntries.map(entry => rowHtml({ name: entry.label, displayValue: entry.displayValue })).join('')
    : '<div class="empty">No stats in this category.</div>';
}

window.selectPlayer = selectPlayer;
els.search.oninput = renderPlayers;
load().catch(error => {
  els.detail.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
