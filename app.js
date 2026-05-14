/* Starship Watch — app.js */

const LL2 = 'https://ll.thespacedevs.com/2.3.0';
const REFRESH_MS = 360_000;

const L = window.LOCALE || {
  connecting: 'Connecting...', updated: 'Updated', noData: 'No data',
  loading: 'Loading...', fallback: 'Using fallback source', fetchFail: 'Fetch failed, retrying soon',
  noDesc: 'No mission description available.', fallbackDesc: 'No description (SpaceX Data API)',
  dateLocale: 'en-US', timeLabels: ['days','hrs','min','sec'],
};

const STATUS_MAP = {
  1:  { label: 'GO',           cls: 'go' },
  2:  { label: 'TBD',          cls: 'tbd' },
  3:  { label: 'SUCCESS',      cls: 'success' },
  4:  { label: 'FAILURE',      cls: 'failure' },
  5:  { label: 'HOLD',         cls: 'tbd' },
  6:  { label: 'IN FLIGHT',    cls: 'go' },
  7:  { label: 'PARTIAL FAIL', cls: 'failure' },
};

let countdownTimer = null;
let nextLaunchTime = null;

// ── Starfield ──────────────────────────────────────────────
function buildStarfield() {
  const el = document.getElementById('starfield');
  const count = Math.floor((window.innerWidth * window.innerHeight) / 5000);
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() < 0.85 ? 1 : Math.random() < 0.7 ? 1.5 : 2;
    s.style.cssText = [
      `left:${Math.random()*100}%`,
      `top:${Math.random()*100}%`,
      `width:${size}px`,
      `height:${size}px`,
      `--d:${(2+Math.random()*4).toFixed(1)}s`,
      `--delay:${(Math.random()*4).toFixed(1)}s`,
      `--min:${(0.05+Math.random()*0.2).toFixed(2)}`,
      `--max:${(0.5+Math.random()*0.5).toFixed(2)}`,
    ].join(';');
    el.appendChild(s);
  }
}

// ── Helpers ────────────────────────────────────────────────
function setStatus(live, text) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot.className = 'pulse-dot' + (live === true ? ' live' : live === false ? ' error' : '');
  txt.textContent = text;
}

function formatLocal(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(L.dateLocale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });
}

function formatUTC(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().slice(0,16).replace('T',' ') + ' UTC';
}

function formatDateShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(L.dateLocale, { month: 'short', day: 'numeric' });
}

function pad(n) { return String(Math.floor(n)).padStart(2, '0'); }

// ── Countdown ──────────────────────────────────────────────
function startCountdown(isoTime) {
  if (countdownTimer) clearInterval(countdownTimer);
  nextLaunchTime = new Date(isoTime).getTime();

  // Apply locale labels to countdown
  const [lD, lH, lM, lS] = L.timeLabels;
  document.querySelectorAll('.cd-label')[0].textContent = lD;
  document.querySelectorAll('.cd-label')[1].textContent = lH;
  document.querySelectorAll('.cd-label')[2].textContent = lM;
  document.querySelectorAll('.cd-label')[3].textContent = lS;

  function tick() {
    const diff = nextLaunchTime - Date.now();
    if (diff <= 0) {
      ['cd-d','cd-h','cd-m','cd-s'].forEach(id => document.getElementById(id).textContent = '00');
      clearInterval(countdownTimer);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    document.getElementById('cd-d').textContent = pad(d);
    document.getElementById('cd-h').textContent = pad(h);
    document.getElementById('cd-m').textContent = pad(m);
    document.getElementById('cd-s').textContent = pad(s);
    document.querySelectorAll('.cd-num').forEach(n => n.style.color = diff < 60000 ? 'var(--accent)' : '');
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

// ── Render hero ────────────────────────────────────────────
function renderHero(launch) {
  const name = launch.name || '—';
  document.getElementById('missionName').textContent = name;
  document.getElementById('rocketName').textContent = launch.rocket?.configuration?.name || '—';
  document.getElementById('padName').textContent = launch.pad?.name || '—';

  const net = launch.net;
  document.getElementById('launchTimeLocal').textContent = formatLocal(net);
  document.getElementById('launchTimeUTC').textContent = formatUTC(net);
  if (net) startCountdown(net);

  const st = STATUS_MAP[launch.status?.id] || { label: launch.status?.abbrev || '—', cls: '' };
  const badge = document.getElementById('statusBadge');
  badge.textContent = st.label;
  badge.className = 'status-badge ' + st.cls;

  const prob = launch.probability;
  document.getElementById('probBadge').textContent = prob != null
    ? (L.dateLocale === 'zh-CN' ? `发射概率 ${prob}%` : `Probability ${prob}%`)
    : '';

  document.getElementById('missionDesc').textContent =
    launch.mission?.description || launch.name || L.noDesc;

  document.getElementById('padInfo').textContent =
    [launch.pad?.name, launch.pad?.location?.name].filter(Boolean).join(' · ') || '—';

  document.getElementById('rocketInfo').textContent =
    [launch.rocket?.configuration?.name, launch.rocket?.configuration?.family].filter(Boolean).join(' · ') || '—';

  document.getElementById('linkNSF').href = `https://nextspaceflight.com/launches/details/${launch.id}`;
  const sfnQ = encodeURIComponent(name.split('|')[0].trim());
  document.getElementById('linkSFN').href = `https://spaceflightnow.com/?s=${sfnQ}`;
}

// ── Render upcoming list ───────────────────────────────────
function renderUpcoming(launches) {
  const container = document.getElementById('upcomingList');
  if (!launches.length) {
    container.innerHTML = `<div class="loading-row">${L.noData}</div>`;
    return;
  }
  container.innerHTML = launches.map((l, i) => {
    const st = STATUS_MAP[l.status?.id] || { label: l.status?.abbrev || '—', cls: '' };
    return `<div class="launch-row${i === 0 ? ' is-next' : ''}">
      <div class="launch-row-date">
        ${formatDateShort(l.net)}<br>
        ${l.net ? new Date(l.net).toLocaleTimeString(L.dateLocale,{hour:'2-digit',minute:'2-digit'}) : '—'}
      </div>
      <div>
        <div class="launch-row-name">${l.name || '—'}</div>
        <div class="launch-row-rocket">${l.rocket?.configuration?.name || ''}</div>
      </div>
      <div class="launch-row-badge ${st.cls}">${st.label}</div>
    </div>`;
  }).join('');
}

// ── Fetch ──────────────────────────────────────────────────
async function fetchLaunches() {
  setStatus(null, L.connecting);
  try {
    const res = await fetch(
      `${LL2}/launches/upcoming/?format=json&limit=10&mode=detailed`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const launches = data.results || [];

    if (!launches.length) { setStatus(false, L.noData); return; }

    renderHero(launches[0]);
    renderUpcoming(launches);

    const now = new Date().toLocaleTimeString(L.dateLocale, { hour:'2-digit', minute:'2-digit' });
    document.getElementById('lastUpdated').textContent = `${L.updated} ${now}`;
    setStatus(true, L.updated + ' ' + now);

  } catch (err) {
    console.error('fetch error:', err);
    setStatus(false, L.fetchFail);
    try {
      const r2 = await fetch('https://api.spacexdata.com/v5/launches/next');
      if (r2.ok) {
        const sx = await r2.json();
        document.getElementById('missionName').textContent = sx.name || '—';
        if (sx.date_utc) startCountdown(sx.date_utc);
        document.getElementById('launchTimeUTC').textContent = formatUTC(sx.date_utc);
        document.getElementById('launchTimeLocal').textContent = formatLocal(sx.date_utc);
        document.getElementById('missionDesc').textContent = sx.details || L.fallbackDesc;
        setStatus(false, L.fallback);
      }
    } catch {}
  }
}

// ── Init ───────────────────────────────────────────────────
buildStarfield();
fetchLaunches();
setInterval(fetchLaunches, REFRESH_MS);
