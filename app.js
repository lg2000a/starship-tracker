/* ========================================
   Starship Watch v2.0 — Optimized Edition
   ======================================== */

const LL2 = 'https://ll.thespacedevs.com/2.3.0';
const REFRESH_MS = 300_000; // 5分钟刷新
const CACHE_KEY = 'starship_watch_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

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
let previousCdValues = { d: null, h: null, m: null, s: null };

// =======================================
// Canvas-based Starfield (Performance++)
// =======================================
class StarfieldCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.stars = [];
    this.animationId = null;
    
    this.resize();
    this.init();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.stars = []; // Regenerate stars on resize
    this.init();
  }
  
  init() {
    const starCount = Math.floor((this.canvas.width * this.canvas.height) / 8000);
    
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() < 0.85 ? 1 : Math.random() < 0.7 ? 1.5 : 2,
        opacity: 0.1 + Math.random() * 0.4,
        twinkleSpeed: 0.0005 + Math.random() * 0.002,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }
    
    this.animate();
  }
  
  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.stars.forEach(star => {
      star.twinklePhase += star.twinkleSpeed;
      const currentOpacity = star.opacity + Math.sin(star.twinklePhase) * 0.3;
      
      this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.05, currentOpacity)})`;
      this.ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    
    this.animationId = requestAnimationFrame(() => this.animate());
  }
  
  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// =======================================
// Cache Management
// =======================================
function getCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    if (now - timestamp < CACHE_DURATION) {
      console.log('✅ Using cached data');
      return data;
    }
    
    console.log('⏰ Cache expired');
    return null;
  } catch (err) {
    console.error('Cache read error:', err);
    return null;
  }
}

function setCachedData(data) {
  try {
    const cacheObject = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
    console.log('💾 Data cached successfully');
  } catch (err) {
    console.error('Cache write error:', err);
  }
}

// =======================================
// Helper Functions
// =======================================
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

function pad(n) { 
  return String(Math.floor(n)).padStart(2, '0'); 
}

// =======================================
// Enhanced Countdown with Smooth Updates
// =======================================
function startCountdown(isoTime) {
  if (countdownTimer) clearInterval(countdownTimer);
  nextLaunchTime = new Date(isoTime).getTime();

  // Apply locale labels
  const [lD, lH, lM, lS] = L.timeLabels;
  const labels = document.querySelectorAll('.cd-label');
  if (labels[0]) labels[0].textContent = lD;
  if (labels[1]) labels[1].textContent = lH;
  if (labels[2]) labels[2].textContent = lM;
  if (labels[3]) labels[3].textContent = lS;

  function tick() {
    const diff = nextLaunchTime - Date.now();
    
    if (diff <= 0) {
      ['cd-d','cd-h','cd-m','cd-s'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '00';
      });
      clearInterval(countdownTimer);
      return;
    }
    
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    // Smooth update with animation
    updateCountdownValue('cd-d', d);
    updateCountdownValue('cd-h', h);
    updateCountdownValue('cd-m', m);
    updateCountdownValue('cd-s', s);
    
    // Urgent state when < 1 minute
    const allNums = document.querySelectorAll('.cd-num');
    allNums.forEach(n => {
      if (diff < 60000) {
        n.classList.add('urgent');
      } else {
        n.classList.remove('urgent');
      }
    });
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

function updateCountdownValue(id, newValue) {
  const el = document.getElementById(id);
  if (!el) return;
  
  const currentValue = el.textContent;
  const paddedValue = pad(newValue);
  
  if (currentValue !== paddedValue) {
    el.textContent = paddedValue;
    // Add subtle animation on change
    el.style.transform = 'scale(1.1)';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
    }, 150);
  }
}

// =======================================
// Render Hero Section
// =======================================
function renderHero(launch) {
  const name = launch.name || '—';
  const missionEl = document.getElementById('missionName');
  if (missionEl) missionEl.textContent = name;
  
  const rocketEl = document.getElementById('rocketName');
  if (rocketEl) rocketEl.textContent = launch.rocket?.configuration?.name || '—';
  
  const padEl = document.getElementById('padName');
  if (padEl) padEl.textContent = launch.pad?.name || '—';

  const net = launch.net;
  const localEl = document.getElementById('launchTimeLocal');
  if (localEl) localEl.textContent = formatLocal(net);
  
  const utcEl = document.getElementById('launchTimeUTC');
  if (utcEl) utcEl.textContent = formatUTC(net);
  
  if (net) startCountdown(net);

  const st = STATUS_MAP[launch.status?.id] || { label: launch.status?.abbrev || '—', cls: '' };
  const badge = document.getElementById('statusBadge');
  if (badge) {
    badge.textContent = st.label;
    badge.className = 'status-badge ' + st.cls;
  }

  const prob = launch.probability;
  const probEl = document.getElementById('probBadge');
  if (probEl) {
    probEl.textContent = prob != null
      ? (L.dateLocale === 'zh-CN' ? `发射概率 ${prob}%` : `Probability ${prob}%`)
      : '';
  }

  const descEl = document.getElementById('missionDesc');
  if (descEl) {
    descEl.textContent = launch.mission?.description || launch.name || L.noDesc;
  }

  const padInfoEl = document.getElementById('padInfo');
  if (padInfoEl) {
    padInfoEl.textContent = [launch.pad?.name, launch.pad?.location?.name]
      .filter(Boolean).join(' · ') || '—';
  }

  const rocketInfoEl = document.getElementById('rocketInfo');
  if (rocketInfoEl) {
    rocketInfoEl.textContent = [
      launch.rocket?.configuration?.name, 
      launch.rocket?.configuration?.family
    ].filter(Boolean).join(' · ') || '—';
  }

  const linkNSF = document.getElementById('linkNSF');
  if (linkNSF) {
    linkNSF.href = `https://nextspaceflight.com/launches/details/${launch.id}`;
  }
  
  const sfnQ = encodeURIComponent(name.split('|')[0].trim());
  const linkSFN = document.getElementById('linkSFN');
  if (linkSFN) {
    linkSFN.href = `https://spaceflightnow.com/?s=${sfnQ}`;
  }
}

// =======================================
// Render Upcoming Launches List
// =======================================
function renderUpcoming(launches) {
  const container = document.getElementById('upcomingList');
  if (!container) return;
  
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

// =======================================
// Fetch Launches with Cache
// =======================================
async function fetchLaunches() {
  setStatus(null, L.connecting);
  
  // Try cache first for instant display
  const cachedData = getCachedData();
  if (cachedData) {
    renderHero(cachedData.launches[0]);
    renderUpcoming(cachedData.launches);
    setStatus(true, L.updated + ' (cached)');
    
    const now = new Date().toLocaleTimeString(L.dateLocale, { hour:'2-digit', minute:'2-digit' });
    const lastEl = document.getElementById('lastUpdated');
    if (lastEl) lastEl.textContent = `${L.updated} ${now}`;
  }
  
  // Then fetch fresh data in background
  try {
    const res = await fetch(
      `${LL2}/launches/upcoming/?format=json&limit=10&mode=detailed`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const launches = data.results || [];

    if (!launches.length) { 
      setStatus(false, L.noData); 
      return; 
    }

    // Cache the fresh data
    setCachedData({ launches });

    renderHero(launches[0]);
    renderUpcoming(launches);

    const now = new Date().toLocaleTimeString(L.dateLocale, { hour:'2-digit', minute:'2-digit' });
    const lastEl = document.getElementById('lastUpdated');
    if (lastEl) lastEl.textContent = `${L.updated} ${now}`;
    
    setStatus(true, L.updated + ' ' + now);

  } catch (err) {
    console.error('Fetch error:', err);
    
    // If we have cache, stay with it
    if (cachedData) {
      setStatus(false, L.fallback + ' (cached)');
      return;
    }
    
    // Otherwise try SpaceX API fallback
    setStatus(false, L.fetchFail);
    try {
      const r2 = await fetch('https://api.spacexdata.com/v5/launches/next');
      if (r2.ok) {
        const sx = await r2.json();
        const nameEl = document.getElementById('missionName');
        if (nameEl) nameEl.textContent = sx.name || '—';
        
        if (sx.date_utc) startCountdown(sx.date_utc);
        
        const utcEl = document.getElementById('launchTimeUTC');
        if (utcEl) utcEl.textContent = formatUTC(sx.date_utc);
        
        const localEl = document.getElementById('launchTimeLocal');
        if (localEl) localEl.textContent = formatLocal(sx.date_utc);
        
        const descEl = document.getElementById('missionDesc');
        if (descEl) descEl.textContent = sx.details || L.fallbackDesc;
        
        setStatus(false, L.fallback);
      }
    } catch (fallbackErr) {
      console.error('Fallback also failed:', fallbackErr);
    }
  }
}

// =======================================
// Hide Loading Skeleton
// =======================================
function hideLoadingSkeleton() {
  const skeleton = document.getElementById('loadingSkeleton');
  if (skeleton) {
    skeleton.classList.add('hidden');
    setTimeout(() => {
      skeleton.style.display = 'none';
    }, 400);
  }
}

// =======================================
// Initialization
// =======================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Canvas Starfield
  const starfield = new StarfieldCanvas('starfield-canvas');
  
  // Show canvas after init
  setTimeout(() => {
    const canvas = document.getElementById('starfield-canvas');
    if (canvas) canvas.classList.add('loaded');
  }, 100);
  
  // Fetch launches
  fetchLaunches();
  
  // Hide skeleton after first data load
  setTimeout(hideLoadingSkeleton, 800);
  
  // Auto-refresh every 5 minutes
  setInterval(fetchLaunches, REFRESH_MS);
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (countdownTimer) clearInterval(countdownTimer);
});
