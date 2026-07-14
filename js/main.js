/* Кипр → Москва: глобус, парабола, пульсы, обратный отсчёт */

/* Отладочные параметры URL: ?target=<ISO> (предпросмотр финала), ?lat&lng&alt (камера), ?arc (высота дуги) */
const QP = new URLSearchParams(location.search);
const qnum = (k, def) => { const v = parseFloat(QP.get(k)); return Number.isFinite(v) ? v : def; };
const TARGET_TS = new Date(QP.get('target') || '2026-07-31T19:10:00+03:00').getTime();

const CYPRUS = { lat: 34.685, lng: 33.033 }; // Лимасол
const MOSCOW = { lat: 55.756, lng: 37.617 };

const ARC_ALT = qnum('arc', 0.38); // высота вершины параболы, в радиусах глобуса
const PULSE_PERIOD = 1000;  // цикл пульса = один секундный тик

const COLORS = {
  track: 'rgba(255,255,255,0.65)',
};

/* пульсы-сердечки: розовое летит из Лимасола, голубое — из Москвы */
const HEART_CY = { emoji: '💗', glow: '#ff6bd6' };
const HEART_MSK = { emoji: '💙', glow: '#4da3ff' };

const TILES = {
  eox: (x, y, l) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${l}/${y}/${x}.jpg`,
  esri: (x, y, l) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${l}/${y}/${x}`,
};

/* ---------- глобус ---------- */

const globeEl = document.getElementById('globe');
const globe = Globe()(globeEl)
  .width(innerWidth)
  .height(innerHeight)
  .backgroundImageUrl('https://cdn.jsdelivr.net/npm/three-globe/example/img/night-sky.png')
  .globeTileEngineUrl(TILES.eox)
  .showAtmosphere(true)
  .atmosphereColor('#5ab1ff')
  .atmosphereAltitude(0.16);

globe.renderer().setPixelRatio(Math.min(2, devicePixelRatio || 1));

globe.htmlElementsData([
  { ...CYPRUS, img: 'assets/avatar-limassol.jpg', ph: 'assets/placeholder-cy.svg', label: '🇨🇾 Лимасол', cls: 'pin--cy' },
  { ...MOSCOW, img: 'assets/avatar-moscow.jpg', ph: 'assets/placeholder-msk.svg', label: 'Москва', cls: 'pin--msk' },
])
  .htmlAltitude(0.012)
  .htmlElement(d => {
    const el = document.createElement('div');
    el.className = `pin ${d.cls}`;
    el.innerHTML = `
      <div class="pin__halo"></div>
      <div class="pin__photo"><img src="${d.img}" alt="" onerror="this.onerror=null;this.src='${d.ph}'"></div>
      <div class="pin__label">${d.label}</div>`;
    // фазу CSS-пульсации кольца привязываем к границе секунды
    el.querySelector('.pin__halo').style.animationDelay = `${-(Date.now() % 1000)}ms`;
    return el;
  });

try {
  globe.htmlElementVisibilityModifier((el, isVisible) => { el.style.opacity = isVisible ? 1 : 0; });
} catch (e) { /* старые версии globe.gl — пины просто останутся видимыми */ }

/* камера: смотрим на середину маршрута, высоту подбираем под пропорции экрана */

/* камера смещена к юго-востоку от маршрута, чтобы парабола выгибалась на экране, а не «в экран»;
   ракурс зависит от пропорций экрана: на портрете маршрут ниже и ближе, на ландшафте — по центру */
function fitView() {
  const a = innerWidth / innerHeight;
  let v;
  if (a < 0.7) v = { lat: 34.5, lng: 45, altitude: 1.62 };
  else if (a < 1.0) v = { lat: 35, lng: 45, altitude: 1.4 };
  else if (a < 1.5) v = { lat: 39, lng: 45, altitude: 1.36 };
  else v = { lat: 40.5, lng: 45, altitude: 1.35 };
  return { lat: qnum('lat', v.lat), lng: qnum('lng', v.lng), altitude: qnum('alt', v.altitude) };
}

globe.pointOfView(fitView(), 0);

const controls = globe.controls();
controls.enablePan = false;
controls.enableZoom = false;
controls.autoRotate = false;

addEventListener('resize', () => {
  globe.width(innerWidth).height(innerHeight);
  globe.pointOfView(fitView(), 300);
  resizeFx();
});

/* ---------- математика дуги ---------- */

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;

function latLngToVec(lat, lng) {
  const f = toRad(lat), l = toRad(lng);
  return [Math.cos(f) * Math.cos(l), Math.cos(f) * Math.sin(l), Math.sin(f)];
}

function vecToLatLng(v) {
  const r = Math.hypot(v[0], v[1], v[2]);
  return { lat: toDeg(Math.asin(v[2] / r)), lng: toDeg(Math.atan2(v[1], v[0])) };
}

function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  d = Math.min(1, Math.max(-1, d));
  const w = Math.acos(d), s = Math.sin(w);
  if (s < 1e-9) return a.slice();
  const k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s;
  return [k1 * a[0] + k2 * b[0], k1 * a[1] + k2 * b[1], k1 * a[2] + k2 * b[2]];
}

const A = latLngToVec(CYPRUS.lat, CYPRUS.lng);
const B = latLngToVec(MOSCOW.lat, MOSCOW.lng);

function curvePoint(t) {
  const p = vecToLatLng(slerp(A, B, t));
  return { ...p, alt: ARC_ALT * Math.sin(Math.PI * t) };
}

const TRACK_N = 72;
const trackPts = Array.from({ length: TRACK_N + 1 }, (_, i) => curvePoint(i / TRACK_N));
const APEX = curvePoint(0.5);

/* точка видна, если отрезок камера→точка не протыкает шар */
function isVisible(p, cam) {
  const R = globe.getGlobeRadius() * 0.999;
  const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
  const L = Math.hypot(dx, dy, dz);
  const nx = dx / L, ny = dy / L, nz = dz / L;
  const tca = -(cam.x * nx + cam.y * ny + cam.z * nz);
  if (tca < 0) return true;
  const d2 = (cam.x ** 2 + cam.y ** 2 + cam.z ** 2) - tca * tca;
  if (d2 >= R * R) return true;
  const thc = Math.sqrt(R * R - d2);
  const t0 = tca - thc;
  return !(t0 > 0 && t0 < L - 0.5);
}

/* ---------- overlay-канвас: трек + пульсы ---------- */

const fx = document.getElementById('fx');
const ctx = fx.getContext('2d');
let fxDpr = 1;

function resizeFx() {
  fxDpr = Math.min(2, devicePixelRatio || 1);
  fx.width = innerWidth * fxDpr;
  fx.height = innerHeight * fxDpr;
  fx.style.width = innerWidth + 'px';
  fx.style.height = innerHeight + 'px';
}
resizeFx();

function project(pt, cam) {
  const w = globe.getCoords(pt.lat, pt.lng, pt.alt);
  if (!isVisible(w, cam)) return null;
  return globe.getScreenCoords(pt.lat, pt.lng, pt.alt);
}

function glowDot(x, y, r, hex, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hex);
  g.addColorStop(0.45, hex);
  g.addColorStop(1, hex + '00');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
}

const PIN_CLEAR_R = 48; // px: не рисуем пунктир поверх аватарок

function drawTrack(cam, pinA, pinB) {
  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COLORS.track;
  ctx.shadowColor = 'rgba(160,200,255,.8)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  let started = false;
  for (const pt of trackPts) {
    const s = project(pt, cam);
    const nearPin = s && [pinA, pinB].some(p => p && Math.hypot(s.x - p.x, s.y - p.y) < PIN_CLEAR_R);
    if (!s || nearPin) { started = false; continue; }
    if (!started) { ctx.moveTo(s.x, s.y); started = true; }
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
  ctx.restore();
}

/* пульс-сердечко: голова-эмодзи с «сердцебиением» + хвост из тающих точек */
function drawPulse(tHead, dirSign, heart, cam, ph) {
  for (let k = 4; k >= 1; k--) {
    const t = tHead - dirSign * k * 0.03;
    if (t < 0 || t > 1) continue;
    const s = project(curvePoint(t), cam);
    if (!s) continue;
    const fade = 1 - k / 5.5;
    glowDot(s.x, s.y, 7 * fade, heart.glow, 0.35 * fade);
  }
  const s = project(curvePoint(tHead), cam);
  if (!s) return;
  glowDot(s.x, s.y, 16, heart.glow, 0.55);
  const beat = 1 + 0.12 * Math.sin(ph * Math.PI * 4); // два удара за перелёт
  ctx.font = `${Math.round(22 * beat)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(heart.emoji, s.x, s.y);
}

function drawFrame(now) {
  ctx.setTransform(fxDpr, 0, 0, fxDpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const cam = globe.camera().position;

  const pinA = project({ ...CYPRUS, alt: 0.012 }, cam);
  const pinB = project({ ...MOSCOW, alt: 0.012 }, cam);
  drawTrack(cam, pinA, pinB);

  const ph = (now % PULSE_PERIOD) / PULSE_PERIOD;

  // два сердечка навстречу: старт на границе секунды, столкновение в вершине ровно на следующем тике
  drawPulse(0.5 * ph, +1, HEART_CY, cam, ph);
  drawPulse(1 - 0.5 * ph, -1, HEART_MSK, cam, ph);

  // вспышка столкновения в вершине — первые 240 мс каждой секунды
  const msIn = now % 1000;
  if (msIn < 260) {
    const k = msIn / 260;
    const s = project(APEX, cam);
    if (s) {
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 4 - k * 2;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8 + k * 34, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
      glowDot(s.x, s.y, 30 * (1 - k) + 8, '#ffffff', 1 - k);
      // на месте столкновения на миг вспыхивают «кружащиеся сердца»
      ctx.globalAlpha = 1 - k;
      ctx.font = `${Math.round(26 + k * 18)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💞', s.x, s.y);
      ctx.globalAlpha = 1;
    }
  }

  // лёгкая рябь на пинах в момент старта пульсов
  if (msIn < 180) {
    const k = msIn / 180;
    for (const [pt, hex] of [[CYPRUS, HEART_CY.glow], [MOSCOW, HEART_MSK.glow]]) {
      const s = project({ ...pt, alt: 0.012 }, cam);
      if (!s) continue;
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.lineWidth = 2;
      ctx.strokeStyle = hex;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 38 + k * 26, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

/* ---------- таймер ---------- */

const cells = {
  d: document.getElementById('td'),
  h: document.getElementById('th'),
  m: document.getElementById('tm'),
  s: document.getElementById('ts'),
};
let lastSec = -1;
let arrived = false;

function updateTimer(nowTs) {
  const diff = Math.max(0, TARGET_TS - nowTs);
  if (diff === 0 && !arrived) arrive(); // до раннего выхода: переход через ноль случается между тиками
  const total = Math.floor(diff / 1000);
  if (total === lastSec) return;
  lastSec = total;

  cells.d.textContent = String(Math.floor(total / 86400)).padStart(2, '0');
  cells.h.textContent = String(Math.floor(total % 86400 / 3600)).padStart(2, '0');
  cells.m.textContent = String(Math.floor(total % 3600 / 60)).padStart(2, '0');
  cells.s.textContent = String(total % 60).padStart(2, '0');

  const sc = cells.s.parentElement;
  sc.classList.remove('pop');
  void sc.offsetWidth;
  sc.classList.add('pop');
}

function arrive() {
  arrived = true;
  document.body.classList.add('arrived');
  const burst = () => window.confetti && confetti({
    particleCount: 120,
    spread: 75,
    origin: { y: 0.35 },
    startVelocity: 45,
  });
  burst();
  const iv = setInterval(burst, 1400);
  setTimeout(() => clearInterval(iv), 8500);
}

/* ---------- главный цикл ---------- */

(function loop() {
  const now = Date.now();
  // глобус может быть не готов первые кадры — пропускаем кадр, но цикл не роняем
  try { drawFrame(now); } catch (e) { /* noop */ }
  try { updateTimer(now); } catch (e) { /* noop */ }
  requestAnimationFrame(loop);
})();
