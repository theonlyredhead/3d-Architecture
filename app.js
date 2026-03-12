// ══════════════════════════════════════════════════════════
//  COCO Data Platform — 3D Architecture Visualiser
//  app.js — renderer, interaction, and animation
//
//  Depends on: three.js (global THREE), data.js (SOURCES,
//  OUTPUTS, ALL, ALL_UCS, ENT_COL, SYNC_COL, SYNC_LBL,
//  KIND_LABEL, KIND_COL)
// ══════════════════════════════════════════════════════════

// ── Configuration (all magic numbers in one place) ────────
const CONFIG = {
  layout: {
    srcX: -32, outX: 30, coreX: 0,
    srcSpacing: 5.0, outSpacing: 7.2, srcZStagger: 3.5,
  },
  camera: {
    fov: 50, near: 0.1, far: 500,
    defaultRadius: 72, minRadius: 18, maxRadius: 130,
    defaultTheta: Math.PI * 0.06,
    defaultPhi: 1.05, phiMin: 0.15, phiMax: 1.48,
    lerpFactor: 0.055, lookAtLerp: 0.06,
  },
  animation: {
    clockStep: 0.012, orbitSpeed: 0.0007,
    explodeLerp: 0.04, scrollFactor: 0.06,
    dragTheta: 0.006, dragPhi: 0.004,
    idleTimeout: 8000,
  },
  particles: {
    pulseCount: 60, ambientCount: 200,
    pulseMinSpeed: 0.007, pulseSpeedRange: 0.006,
    pulsesPerSource: 2, pulsesPerCore: 3, pulsesPerOutput: 2,
  },
  labels: {
    deconflictRadius: 38,
    yOffset: 0.55,
    fadeDist: [55, 95],
  },
};

// ── Application state (single object, no loose globals) ───
const STATE = {
  selectedId:   null,
  activeFilter: 'all',
  hoveredMesh:  null,
  dragging:     false,
  autoOrbit:    true,
  flyActive:    false,
  exploded:     false,
  explodeT:     0,
  clock:        0,
  idleTimer:    null,
  lx: 0, ly: 0,
  theta:   CONFIG.camera.defaultTheta,
  phi:     CONFIG.camera.defaultPhi,
  radius:  CONFIG.camera.defaultRadius,
  tTheta:  CONFIG.camera.defaultTheta,
  tPhi:    CONFIG.camera.defaultPhi,
  tRadius: CONFIG.camera.defaultRadius,
};

// ── Scene registry ────────────────────────────────────────
const meshById    = {};
const groupById   = {};
const nodeData    = {};
const clickables  = [];
const basePosById = {};
const pipes       = [];
const pipeById    = {};

// Cached entry arrays — populated once after scene build,
// then reused every frame to avoid per-frame Object.entries() calls.
let _groupEntries = null;
let _nodeEntries  = null;

// ── Three.js setup ────────────────────────────────────────
const mount      = document.getElementById('three-mount');
const labelLayer = document.getElementById('label-layer');
const W = () => mount.clientWidth;
const H = () => mount.clientHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(W(), H());
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled   = true;
mount.appendChild(renderer.domElement);

const scene  = new THREE.Scene();
scene.fog    = new THREE.FogExp2(0x060a12, 0.006);

const camera = new THREE.PerspectiveCamera(
  CONFIG.camera.fov, W() / H(), CONFIG.camera.near, CONFIG.camera.far
);

// Lights
scene.add(new THREE.AmbientLight(0x0a1428, 5));
const lA = new THREE.PointLight(0x3B82F6, 22, 110); lA.position.set(-35, 25, 12);  scene.add(lA);
const lB = new THREE.PointLight(0x10B981, 14,  90); lB.position.set(0, 12, 6);     scene.add(lB);
const lC = new THREE.PointLight(0xFB923C, 10,  80); lC.position.set(32, 18, -12);  scene.add(lC);
const lD = new THREE.DirectionalLight(0x1a2840, 2); lD.position.set(0, 40, 20);    scene.add(lD);

// Grid
const grid = new THREE.GridHelper(200, 56, 0x060c16, 0x060a12);
grid.position.y = -14;
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// ── Layout helpers ────────────────────────────────────────
const { srcX, outX, coreX, srcSpacing, outSpacing, srcZStagger } = CONFIG.layout;
const SRC_COUNT = SOURCES.length;
const OUT_COUNT = OUTPUTS.length;

const srcY = i => (SRC_COUNT - 1) * srcSpacing / 2 - i * srcSpacing;
const srcZ = i => Math.sin(i / (SRC_COUNT - 1) * Math.PI) * srcZStagger - srcZStagger * 0.5;
const outY = i => (OUT_COUNT - 1) * outSpacing / 2 - i * outSpacing;

// ── Helpers ───────────────────────────────────────────────
const h3 = hex => parseInt(hex.replace('#', ''), 16);

function makeGlowTex(hexStr, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const col = new THREE.Color(hexStr);
  const r   = size / 2;
  const rgb = `${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)}`;
  const g   = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0,   `rgba(${rgb},1)`);
  g.addColorStop(0.3, `rgba(${rgb},0.6)`);
  g.addColorStop(1,   `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// ── Node creation ─────────────────────────────────────────
function makeFlatRing(grp, col, innerR, outerR, opacity) {
  const geo  = new THREE.RingGeometry(innerR, outerR, 64);
  const mat  = new THREE.MeshBasicMaterial({
    color: col, transparent: true, opacity,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.rotation.x = -Math.PI / 2;
  grp.add(ring);
  return ring;
}

function makeNode(id, x, y, z, radius, hex, data, kind) {
  const col = h3(hex);
  const geo = new THREE.SphereGeometry(radius, 40, 40);
  const mat = new THREE.MeshStandardMaterial({
    color: col, emissive: col, emissiveIntensity: 0.28,
    metalness: 0.3, roughness: 0.55,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;

  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.add(mesh);
  scene.add(grp);

  meshById[id]    = mesh;
  groupById[id]   = grp;
  nodeData[id]    = { data, kind, radius, hex, origEI: 0.28 };
  basePosById[id] = { x, y, z };
  clickables.push(mesh);
  mesh.userData = { id, kind };

  const isCore = kind === 'db' || kind === 'api' || kind === 'ai';
  if (isCore) {
    const ring1 = makeFlatRing(grp, col, radius * 1.4, radius * 1.65, 0.15);
    if (kind === 'db') {
      const ring2 = makeFlatRing(grp, col, radius * 1.9, radius * 2.15, 0.06);
      grp._ring1 = ring1;
      grp._ring2 = ring2;
    }
  }

  if (data.sync === 'realtime') {
    const pr  = new THREE.RingGeometry(radius * 1.2, radius * 1.35, 48);
    const pm  = new THREE.MeshBasicMaterial({
      color: h3('#34D399'), transparent: true, opacity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const pring = new THREE.Mesh(pr, pm);
    pring.rotation.x = -Math.PI / 2;
    grp.add(pring);
    grp._liveRingMat = pm;
  }

  return { mesh, grp };
}

// ── Build scene nodes ─────────────────────────────────────
const maxW = Math.max(...SOURCES.map(s => s.w));

SOURCES.forEach((s, i) => {
  const r = 0.85 + (s.w / 6) * 0.55;
  makeNode(s.id, srcX, srcY(i), srcZ(i), r, s.hex, s, 'source');
});

OUTPUTS.forEach((o, i) => {
  const r = 1.05 + (o.w / 6) * 0.7;
  makeNode(o.id, outX, outY(i), 0, r, o.hex, o, 'output');
});

makeNode('db',  coreX, 0,    0, 3.4, '#10B981', { id: 'db',  name: 'Central DB',  sub: 'Azure SQL + pgvector',  hex: '#10B981', desc: 'DB-first architecture. Single source of truth. Full audit trail, row-level security, 90-day history, and pgvector embeddings for AI search. Every connector writes here, nothing bypasses it.' }, 'db');
makeNode('api', coreX, 5.8,  0, 2.5, '#3B82F6', { id: 'api', name: 'COCO API',    sub: 'REST / GraphQL',        hex: '#3B82F6', desc: 'Single API layer. All connectors authenticate here. Handles transformation, rate limiting, schema validation, versioning, and routing between all source and output connectors.' }, 'api');
makeNode('ai',  coreX, -5.8, 0, 2.1, '#FB923C', { id: 'ai',  name: 'AI Engine',   sub: 'Bedrock + Claude 3.5',  hex: '#FB923C', desc: 'AWS Bedrock running Claude 3.5 Sonnet in ap-southeast-2. Reads from DB via API. Powers natural language generation, RAG retrieval, anomaly detection, and scheduled briefings. All data stays in-region.' }, 'ai');

// Cache entry arrays once — used every animation frame
_groupEntries = Object.entries(groupById);
_nodeEntries  = Object.entries(nodeData);

// ── Pipe (glow beam) creation ─────────────────────────────
function buildCurve(p0, p1, liftY = 1.2) {
  const mid = new THREE.Vector3(
    (p0.x + p1.x) / 2,
    (p0.y + p1.y) / 2 + liftY,
    (p0.z + p1.z) / 2
  );
  return new THREE.QuadraticBezierCurve3(p0, mid, p1);
}

function createPipe({ curve, hex, weight, srcId = null, outId = null, kind }) {
  const SEGS  = 28;
  const tex   = makeGlowTex(hex, 64);
  const group = new THREE.Group();
  const mats  = [];
  const meshes = [];

  for (let i = 0; i <= SEGS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.12,
      depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(weight, weight), mat);
    m.position.copy(curve.getPoint(i / SEGS));
    group.add(m);
    mats.push(mat);
    meshes.push(m);
  }

  // Arrow indicator at 58% along the curve
  const arrowMat = new THREE.MeshBasicMaterial({
    map: makeGlowTex(hex, 32), transparent: true, opacity: 0.18,
    depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const arrowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(weight * 2.2, weight * 2.2),
    arrowMat
  );
  arrowMesh.position.copy(curve.getPoint(0.58));
  group.add(arrowMesh);
  mats.push(arrowMat);

  scene.add(group);

  const pipe = { group, mats, meshes, arrowMesh, curve, hex, srcId, outId, kind, baseOp: 0.12, weight };
  pipes.push(pipe);
  if (srcId) pipeById[srcId] = pipe;
  if (outId) pipeById[outId] = pipe;
  return pipe;
}

// Build all pipes
const apiGrp = groupById['api'];
const dbGrp  = groupById['db'];
const aiGrp  = groupById['ai'];

SOURCES.forEach(s => {
  const w = 0.3 + (s.w / maxW) * 0.55;
  createPipe({
    curve: buildCurve(groupById[s.id].position.clone(), apiGrp.position.clone(), 0.8),
    hex: s.hex, weight: w, srcId: s.id, kind: 's-api',
  });
});

OUTPUTS.forEach(o => {
  const w = 0.35 + (o.w / 6) * 0.45;
  createPipe({
    curve: buildCurve(apiGrp.position.clone(), groupById[o.id].position.clone(), 0.8),
    hex: o.hex, weight: w, outId: o.id, kind: 'api-o',
  });
});

createPipe({ curve: buildCurve(apiGrp.position.clone(), dbGrp.position.clone(), 0.5), hex: '#3B82F6', weight: 1.1, kind: 'core' });
createPipe({ curve: buildCurve(dbGrp.position.clone(),  aiGrp.position.clone(),  0.5), hex: '#10B981', weight: 0.9, kind: 'core' });

function updateBeamBillboards() {
  pipes.forEach(p => {
    p.meshes.forEach(m => m.lookAt(camera.position));
    if (p.arrowMesh) p.arrowMesh.lookAt(camera.position);
  });
}

// ── Pulse particles ───────────────────────────────────────
const { pulseCount, ambientCount, pulseMinSpeed, pulseSpeedRange } = CONFIG.particles;

const pPos = new Float32Array(pulseCount * 3);
const pCol = new Float32Array(pulseCount * 3);
const pulseDefs = [];

const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));

const pMat = new THREE.PointsMaterial({
  size: 0.55, vertexColors: true, transparent: true,
  opacity: 0.95, depthWrite: false, sizeAttenuation: true,
});
scene.add(new THREE.Points(pGeo, pMat));

let pi = 0;
function assignPulse(curve, hex, count = 2) {
  const c = new THREE.Color(hex);
  for (let i = 0; i < count && pi < pulseCount; i++, pi++) {
    pCol[pi * 3]     = c.r;
    pCol[pi * 3 + 1] = c.g;
    pCol[pi * 3 + 2] = c.b;
    pulseDefs.push({
      idx: pi, curve,
      t: (i / count) + Math.random() * 0.1,
      s: pulseMinSpeed + Math.random() * pulseSpeedRange,
    });
  }
}

pipes.filter(p => p.kind === 's-api').forEach(p => assignPulse(p.curve, p.hex, CONFIG.particles.pulsesPerSource));
pipes.filter(p => p.kind === 'core').forEach(p  => assignPulse(p.curve, p.hex, CONFIG.particles.pulsesPerCore));
pipes.filter(p => p.kind === 'api-o').forEach(p => assignPulse(p.curve, p.hex, CONFIG.particles.pulsesPerOutput));

// ── Ambient particles ─────────────────────────────────────
const apGeo = new THREE.BufferGeometry();
const apPos = new Float32Array(ambientCount * 3);
const apCol = new Float32Array(ambientCount * 3);
const PAL   = [[0.23,0.51,0.97],[0.06,0.69,0.51],[0.98,0.57,0.24],[0.53,0.33,0.98]];

for (let i = 0; i < ambientCount; i++) {
  apPos[i*3]   = (Math.random() - 0.5) * 100;
  apPos[i*3+1] = Math.random() * 28 - 8;
  apPos[i*3+2] = (Math.random() - 0.5) * 40;
  const c = PAL[i % 4];
  apCol[i*3] = c[0]; apCol[i*3+1] = c[1]; apCol[i*3+2] = c[2];
}
apGeo.setAttribute('position', new THREE.BufferAttribute(apPos, 3));
apGeo.setAttribute('color',    new THREE.BufferAttribute(apCol, 3));
scene.add(new THREE.Points(apGeo, new THREE.PointsMaterial({
  size: 0.05, vertexColors: true, transparent: true, opacity: 0.35, sizeAttenuation: true,
})));

// ── CSS2D Labels ──────────────────────────────────────────
const labelEls  = {};
const colHeaders = {};

function makeLabel(id, data, kind) {
  const div    = document.createElement('div');
  div.className = 'node-label';
  const isCore = kind === 'db' || kind === 'api' || kind === 'ai';

  const nm = document.createElement('div');
  nm.className   = 'nl-name';
  nm.style.fontSize = (isCore ? 13 : 11) + 'px';
  nm.textContent = data.name;
  div.appendChild(nm);

  const tp = document.createElement('div');
  tp.className   = 'nl-type';
  tp.textContent = data.type || data.sub || '';
  div.appendChild(tp);

  if (data.ent && data.ent !== 'Output') {
    const e = document.createElement('div');
    e.className   = 'nl-ent';
    e.style.color = ENT_COL[data.ent] || '#64748B';
    e.textContent = data.ent;
    div.appendChild(e);
  }

  if (data.sync) {
    const s = document.createElement('span');
    s.className        = 'nl-sync';
    s.style.background = SYNC_COL[data.sync] || '#334155';
    s.title            = SYNC_LBL[data.sync]  || data.sync;
    div.appendChild(s);
  }

  labelLayer.appendChild(div);
  labelEls[id] = div;
}

_nodeEntries.forEach(([id, nd]) => makeLabel(id, nd.data, nd.kind));

function makeColHeader(id, title, sub) {
  const div = document.createElement('div');
  div.className = 'col-header';
  div.innerHTML = `<div class="ch-title">${title}</div><div class="ch-sub">${sub}</div>`;
  labelLayer.appendChild(div);
  colHeaders[id] = div;
}
makeColHeader('src',  '← SOURCE CONNECTORS', `${SOURCES.length} SYSTEMS`);
makeColHeader('out',  'OUTPUT CONNECTORS →',  `${OUTPUTS.length} CHANNELS`);
makeColHeader('core', 'CORE PLATFORM',         'API · DB · AI');

// ── Label projection (runs every frame) ───────────────────
const _v3      = new THREE.Vector3();
const screenPos = {};

function updateLabels() {
  const cw = mount.clientWidth;
  const ch = mount.clientHeight;
  const { deconflictRadius, yOffset, fadeDist } = CONFIG.labels;
  const fadeRange = fadeDist[1] - fadeDist[0];

  // Project all nodes to screen space
  const positions = [];
  _groupEntries.forEach(([id, grp]) => {
    const nd = nodeData[id]; if (!nd) return;
    _v3.copy(grp.position);
    _v3.y += nd.radius + yOffset;
    const ndc = _v3.clone().project(camera);
    if (ndc.z > 1) { screenPos[id] = null; return; }
    const sx     = (ndc.x * 0.5 + 0.5) * cw;
    const sy     = (-ndc.y * 0.5 + 0.5) * ch;
    const dist   = camera.position.distanceTo(grp.position);
    const isCore = nd.kind === 'db' || nd.kind === 'api' || nd.kind === 'ai';
    screenPos[id] = { sx, sy, dist, isCore, id };
    positions.push(screenPos[id]);
  });

  // Deconflict: hide labels crowded behind closer/core labels
  const shown = new Set();
  positions.sort((a, b) => {
    if (a.isCore !== b.isCore) return a.isCore ? -1 : 1;
    return a.dist - b.dist;
  });
  positions.forEach(p => {
    if (!p) return;
    let tooClose = false;
    shown.forEach(sid => {
      const s = screenPos[sid]; if (!s) return;
      const dx = p.sx - s.sx, dy = p.sy - s.sy;
      if (Math.sqrt(dx * dx + dy * dy) < deconflictRadius) tooClose = true;
    });
    if (p.isCore || p.id === STATE.selectedId) tooClose = false;
    if (!tooClose) shown.add(p.id);
  });

  // Apply positions and opacity
  _groupEntries.forEach(([id]) => {
    const el = labelEls[id];   if (!el) return;
    const sp = screenPos[id];
    if (!sp || !shown.has(id)) { el.style.opacity = '0'; return; }
    const nd   = nodeData[id];
    const fade = sp.isCore ? 1 : Math.max(0, Math.min(1, (fadeDist[1] - sp.dist) / fadeRange));
    el.style.left    = sp.sx + 'px';
    el.style.top     = sp.sy + 'px';
    el.style.opacity = String(isDimmed(id) ? fade * 0.08 : fade);
    el.style.display = 'block';
  });

  // Column headers
  const srcAnchor  = new THREE.Vector3(srcX - 2, (SRC_COUNT - 1) * srcSpacing / 2 + 8, 0);
  const outAnchor  = new THREE.Vector3(outX + 2, (OUT_COUNT - 1) * outSpacing / 2 + 8, 0);
  const coreAnchor = new THREE.Vector3(coreX, 14, 0);
  [[srcAnchor, 'src'], [outAnchor, 'out'], [coreAnchor, 'core']].forEach(([anchor, hid]) => {
    const ndc = anchor.clone().project(camera);
    const el  = colHeaders[hid]; if (!el) return;
    if (ndc.z > 1) { el.style.opacity = '0'; return; }
    el.style.left    = ((ndc.x * 0.5 + 0.5) * cw) + 'px';
    el.style.top     = ((-ndc.y * 0.5 + 0.5) * ch) + 'px';
    el.style.opacity = '0.7';
  });
}

// ── Camera ────────────────────────────────────────────────
const lookAt  = new THREE.Vector3(0, 0, 0);
const tLookAt = new THREE.Vector3(0, 0, 0);

function camTick() {
  if (STATE.flyActive) return;
  const { lerpFactor, lookAtLerp } = CONFIG.camera;
  if (!STATE.dragging) {
    STATE.theta  += (STATE.tTheta  - STATE.theta)  * lerpFactor;
    STATE.phi    += (STATE.tPhi    - STATE.phi)    * lerpFactor;
    STATE.radius += (STATE.tRadius - STATE.radius) * lerpFactor;
  }
  lookAt.lerp(tLookAt, lookAtLerp);
  camera.position.set(
    lookAt.x + STATE.radius * Math.sin(STATE.phi) * Math.sin(STATE.theta),
    lookAt.y + STATE.radius * Math.cos(STATE.phi),
    lookAt.z + STATE.radius * Math.sin(STATE.phi) * Math.cos(STATE.theta)
  );
  camera.lookAt(lookAt);
}

function flyTo(pos, look, dur = 750) {
  STATE.flyActive = true;
  const sp = camera.position.clone(), sl = lookAt.clone();
  const st = performance.now();
  (function step(now) {
    const t = Math.min((now - st) / dur, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    camera.position.lerpVectors(sp, pos, e);
    lookAt.lerpVectors(sl, look, e);
    camera.lookAt(lookAt);
    if (t < 1) requestAnimationFrame(step);
    else STATE.flyActive = false;
  })(performance.now());
}

function setView(v) {
  document.querySelectorAll('.vc').forEach(b => b.classList.remove('on'));
  const ids = { orbit: 'vOrbit' };
  if (ids[v]) document.getElementById(ids[v]).classList.add('on');
  STATE.flyActive = false;
  STATE.autoOrbit = false;
  clearIdleTimer();
  if (v === 'orbit') {
    STATE.autoOrbit = true;
    STATE.tTheta  = CONFIG.camera.defaultTheta;
    STATE.tPhi    = CONFIG.camera.defaultPhi;
    STATE.tRadius = CONFIG.camera.defaultRadius;
    tLookAt.set(0, 0, 0);
  }
}

function clearIdleTimer() {
  if (STATE.idleTimer) clearTimeout(STATE.idleTimer);
}
function startIdleTimer() {
  clearIdleTimer();
  STATE.idleTimer = setTimeout(() => { STATE.autoOrbit = true; }, CONFIG.animation.idleTimeout);
}

function resetCamera() {
  STATE.flyActive = false;
  STATE.autoOrbit = false;
  const { defaultRadius: r, defaultPhi: p, defaultTheta: th } = CONFIG.camera;
  flyTo(
    new THREE.Vector3(
      lookAt.x + r * Math.sin(p) * Math.sin(th),
      lookAt.y + r * Math.cos(p),
      lookAt.z + r * Math.sin(p) * Math.cos(th)
    ),
    new THREE.Vector3(0, 0, 0),
    600
  );
  setTimeout(() => {
    STATE.autoOrbit = true;
    STATE.theta  = th; STATE.tTheta  = th;
    STATE.phi    = p;  STATE.tPhi    = p;
    STATE.radius = r;  STATE.tRadius = r;
    tLookAt.set(0, 0, 0);
  }, 620);
}

// ── Pointer / drag / zoom ─────────────────────────────────
const cv = renderer.domElement;
const { dragTheta, dragPhi, scrollFactor } = CONFIG.animation;
const { phiMin, phiMax, minRadius, maxRadius } = CONFIG.camera;

cv.addEventListener('mousedown', e => {
  STATE.dragging = true;
  STATE.lx = e.clientX; STATE.ly = e.clientY;
  STATE.autoOrbit = false;
  clearIdleTimer();
});
document.addEventListener('mousemove', e => {
  if (STATE.dragging && !STATE.flyActive) {
    STATE.tTheta -= (e.clientX - STATE.lx) * dragTheta;
    STATE.tPhi    = Math.max(phiMin, Math.min(phiMax, STATE.tPhi + (e.clientY - STATE.ly) * dragPhi));
    STATE.lx = e.clientX; STATE.ly = e.clientY;
    STATE.theta = STATE.tTheta; STATE.phi = STATE.tPhi;
  }
  doHover(e.clientX, e.clientY);
});
document.addEventListener('mouseup', () => { STATE.dragging = false; startIdleTimer(); });
cv.addEventListener('wheel', e => {
  STATE.tRadius   = Math.max(minRadius, Math.min(maxRadius, STATE.tRadius + e.deltaY * scrollFactor));
  STATE.autoOrbit = false;
  startIdleTimer();
}, { passive: true });
cv.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    STATE.lx = e.touches[0].clientX; STATE.ly = e.touches[0].clientY;
    STATE.autoOrbit = false;
  }
}, { passive: true });
cv.addEventListener('touchmove', e => {
  if (e.touches.length === 1 && !STATE.flyActive) {
    STATE.tTheta -= (e.touches[0].clientX - STATE.lx) * dragTheta;
    STATE.tPhi    = Math.max(phiMin, Math.min(phiMax, STATE.tPhi + (e.touches[0].clientY - STATE.ly) * dragPhi));
    STATE.lx = e.touches[0].clientX; STATE.ly = e.touches[0].clientY;
    STATE.theta = STATE.tTheta; STATE.phi = STATE.tPhi;
  }
}, { passive: true });
cv.addEventListener('touchend', startIdleTimer);

// ── Raycasting / hover / click ────────────────────────────
const ray  = new THREE.Raycaster();
ray.params.Points.threshold = 0.5;
const mpos = new THREE.Vector2();
const tip  = document.getElementById('tip');

function doHover(cx, cy) {
  const rect = mount.getBoundingClientRect();
  mpos.x = ((cx - rect.left) / rect.width)  * 2 - 1;
  mpos.y = -((cy - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(mpos, camera);
  const hits = ray.intersectObjects(clickables);
  if (hits.length) {
    const m = hits[0].object;
    if (m !== STATE.hoveredMesh) {
      if (STATE.hoveredMesh && STATE.hoveredMesh.userData.id !== STATE.selectedId) unhover(STATE.hoveredMesh);
      STATE.hoveredMesh = m;
      if (m.userData.id !== STATE.selectedId) hover(m);
    }
    cv.style.cursor = 'pointer';
    const nd = nodeData[m.userData.id];
    document.getElementById('tn').textContent = nd.data.name;
    document.getElementById('tt').textContent = nd.data.type || nd.data.sub || '';
    tip.style.left    = (cx + 14) + 'px';
    tip.style.top     = (cy - 12) + 'px';
    tip.style.opacity = '1';
  } else {
    if (STATE.hoveredMesh && STATE.hoveredMesh.userData.id !== STATE.selectedId) unhover(STATE.hoveredMesh);
    STATE.hoveredMesh = null;
    cv.style.cursor   = 'default';
    tip.style.opacity = '0';
  }
}

function hover(m)   { m.material.emissiveIntensity = 0.9; m.scale.setScalar(1.08); }
function unhover(m) {
  const nd = nodeData[m.userData.id];
  if (nd) m.material.emissiveIntensity = nd.origEI;
  m.scale.setScalar(1);
}

cv.addEventListener('click', e => {
  const rect = mount.getBoundingClientRect();
  mpos.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mpos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(mpos, camera);
  const hits = ray.intersectObjects(clickables);
  if (hits.length) selectNode(hits[0].object.userData.id);
  else deselect();
});

// ── Keyboard navigation ───────────────────────────────────
const ALL_NODE_IDS = ALL.map(n => n.id);

document.addEventListener('keydown', e => {
  if (document.activeElement.tagName === 'INPUT') return;

  if (e.key === 'Escape') {
    if (document.getElementById('ucd').classList.contains('show')) closeUCD();
    else deselect();
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const idx = STATE.selectedId ? ALL_NODE_IDS.indexOf(STATE.selectedId) : -1;
    selectNode(ALL_NODE_IDS[(idx + 1) % ALL_NODE_IDS.length]);
    return;
  }
  if (e.key === 'Enter' && STATE.hoveredMesh) {
    selectNode(STATE.hoveredMesh.userData.id);
  }
});

// ── Visibility / dim logic ────────────────────────────────
function isDimmed(id) {
  if (STATE.activeFilter === 'all' && !STATE.selectedId) return false;
  const nd = nodeData[id]; if (!nd) return false;
  if (nd.kind === 'api' || nd.kind === 'db' || nd.kind === 'ai') return false;
  if (STATE.selectedId)                  return id !== STATE.selectedId;
  if (STATE.activeFilter === 'outputs')  return nd.kind !== 'output';
  return (nd.data.ent || '') !== STATE.activeFilter;
}

function applyDim() {
  _nodeEntries.forEach(([id, nd]) => {
    const m   = meshById[id]; if (!m) return;
    const dim = isDimmed(id);
    const sel = id === STATE.selectedId;
    if (sel) {
      m.material.emissiveIntensity = 1.0;
      m.material.transparent = false;
      m.material.opacity = 1;
    } else if (dim) {
      m.material.emissiveIntensity = 0.02;
      m.material.transparent = true;
      m.material.opacity = 0.06;
    } else {
      m.material.emissiveIntensity = nd.origEI;
      m.material.transparent = false;
      m.material.opacity = 1;
    }
  });

  pipes.forEach(p => {
    if (p.kind === 'core') { p.mats.forEach(m => m.opacity = p.baseOp); return; }
    const dim = p.srcId ? isDimmed(p.srcId) : p.outId ? isDimmed(p.outId) : false;
    const sel = p.srcId === STATE.selectedId || p.outId === STATE.selectedId;
    const op  = sel ? 0.65 : dim ? 0.003 : p.baseOp;
    p.mats.forEach(m => m.opacity = op);
    if (p.arrowMesh) p.arrowMesh.material.opacity = sel ? 0.7 : dim ? 0.003 : 0.18;
  });
}

function selectNode(id) {
  STATE.selectedId = id;
  applyDim();
  const nd  = nodeData[id];
  const grp = groupById[id];
  const isCore = nd.kind === 'db' || nd.kind === 'api' || nd.kind === 'ai';
  let camTarget, lookTarget;
  if (isCore) {
    camTarget  = new THREE.Vector3(coreX, 8, 32);
    lookTarget = grp.position.clone();
  } else if (nd.kind === 'source') {
    camTarget  = new THREE.Vector3(srcX - 12, grp.position.y + 4, 22);
    lookTarget = new THREE.Vector3(coreX * 0.5, grp.position.y, 0);
  } else {
    camTarget  = new THREE.Vector3(outX + 12, grp.position.y + 4, 22);
    lookTarget = new THREE.Vector3(coreX * 0.5, grp.position.y, 0);
  }
  flyTo(camTarget, lookTarget, 800);
  showPanel(id);
}

function deselect() {
  STATE.selectedId = null;
  applyDim();
  document.getElementById('panel').classList.remove('open');
  resetCamera();
}

// ── Explode mode ──────────────────────────────────────────
function toggleExplode() {
  STATE.exploded = !STATE.exploded;
  document.getElementById('vExp').classList.toggle('on', STATE.exploded);
  applyExplodeDim();
}

function applyExplodeDim() {
  if (STATE.selectedId) return; // don't fight with node selection
  _nodeEntries.forEach(([id, nd]) => {
    const m      = meshById[id]; if (!m) return;
    const isCore = nd.kind === 'api' || nd.kind === 'db' || nd.kind === 'ai';
    if (STATE.exploded) {
      m.material.emissiveIntensity = isCore ? 1.2 : 0.04;
      m.material.transparent = !isCore;
      m.material.opacity     = isCore ? 1 : 0.15;
    } else {
      m.material.emissiveIntensity = nd.origEI;
      m.material.transparent = false;
      m.material.opacity = 1;
    }
  });

  pipes.forEach(p => {
    const op = STATE.exploded ? (p.kind === 'core' ? p.baseOp * 2.5 : 0.01) : p.baseOp;
    p.mats.forEach(m => m.opacity = op);
    if (p.arrowMesh) p.arrowMesh.material.opacity = STATE.exploded ? (p.kind === 'core' ? 0.5 : 0.01) : 0.18;
  });

  ['db', 'api', 'ai'].forEach(cid => {
    const grp = groupById[cid]; if (!grp) return;
    grp.children.forEach(child => {
      if (child.isMesh && child.geometry.type === 'RingGeometry') {
        child.material.opacity = STATE.exploded ? 0.55 : 0.15;
      }
    });
  });
}

function applyExplode(t) {
  SOURCES.forEach(s => {
    const bp  = basePosById[s.id]; if (!bp) return;
    const grp = groupById[s.id];   if (!grp) return;
    grp.position.x = bp.x + (srcX - 18 - bp.x) * t;
    grp.position.z = bp.z * (1 + 0.5 * t);
  });
  OUTPUTS.forEach(o => {
    const bp  = basePosById[o.id]; if (!bp) return;
    const grp = groupById[o.id];   if (!grp) return;
    grp.position.x = bp.x + (outX + 18 - bp.x) * t;
  });
}

// ── Side panel ────────────────────────────────────────────
let _ucCache = []; // holds the current node's use cases for showUCD()

function showPanel(id) {
  const nd = nodeData[id]; if (!nd) return;
  const { data, kind } = nd;
  const lc = KIND_COL[kind] || data.hex;

  document.getElementById('pBar').style.background = `linear-gradient(90deg,${lc},transparent)`;
  const layer = document.getElementById('pLayer');
  layer.style.background = lc + '1a';
  layer.style.color      = lc;
  layer.textContent      = KIND_LABEL[kind] || kind;

  document.getElementById('pName').textContent = data.name;
  document.getElementById('pType').textContent = data.type || data.sub || '';
  document.getElementById('pDesc').textContent = data.desc || '';

  const chips = document.getElementById('pChips');
  chips.innerHTML = '';
  if (data.sync) {
    const c = document.createElement('span');
    c.className        = 'pchip';
    c.style.background = (SYNC_COL[data.sync] || '#334155') + '20';
    c.style.color      = SYNC_COL[data.sync] || '#334155';
    c.textContent      = SYNC_LBL[data.sync] || data.sync.toUpperCase();
    chips.appendChild(c);
  }
  if (data.ent && data.ent !== 'Output') {
    const c = document.createElement('span');
    c.className        = 'pchip';
    c.style.background = lc + '18';
    c.style.color      = lc;
    c.textContent      = data.ent;
    chips.appendChild(c);
  }
  if (data.uc) {
    const c = document.createElement('span');
    c.className        = 'pchip';
    c.style.background = '#0a1422';
    c.style.color      = '#334155';
    c.textContent      = data.uc.length + ' USE CASES';
    chips.appendChild(c);
  }

  const body = document.getElementById('pBody');
  if (data.uc && data.uc.length) {
    _ucCache = data.uc;
    body.innerHTML = `<div class="pn-sec" style="margin-bottom:8px">USE CASES</div>` +
      data.uc.map((u, i) =>
        `<div class="uc-card" style="--a:${lc}" onclick="showUCD(${i},${JSON.stringify(lc)})">
          <div class="uc-title">${u.t}</div>
          <div class="uc-aud">${u.a}</div>
          <div class="uc-imp"><b>→</b> ${u.imp}</div>
        </div>`
      ).join('');
  } else {
    body.innerHTML = `<p style="font-size:11px;color:#334155;line-height:1.6">${data.desc || ''}</p>`;
  }
  document.getElementById('panel').classList.add('open');
}

function showUCD(idx, col) {
  const uc = _ucCache[idx]; if (!uc) return;
  document.getElementById('ucdBox').innerHTML = `
    <button class="ucd-close" onclick="closeUCD()">✕</button>
    <div class="ucd-tag" style="background:${col}1a;color:${col}">USE CASE</div>
    <div class="ucd-title">${uc.t}</div>
    <div class="ucd-aud">${uc.a}</div>
    <div class="ucd-desc">${uc.d}</div>
    <div class="ucd-lbl">AI Layer</div>
    <div class="ucd-ai">${uc.ai}</div>
    <div class="ucd-lbl" style="margin-top:12px">Business Impact</div>
    <div class="ucd-impact">${uc.imp}</div>`;
  document.getElementById('ucd').classList.add('show');
}

function closeUCD() {
  document.getElementById('ucd').classList.remove('show');
}

// ── Search ────────────────────────────────────────────────
const si    = document.getElementById('si');
const sdrop = document.getElementById('sdrop');

si.addEventListener('input', () => {
  const q = si.value.trim().toLowerCase();
  if (q.length < 2) { sdrop.classList.remove('open'); return; }
  const nH = ALL.filter(n => n.name.toLowerCase().includes(q) || (n.type || '').toLowerCase().includes(q));
  const uH = ALL_UCS.filter(u => u.t.toLowerCase().includes(q) || u.imp.toLowerCase().includes(q));
  const res = [
    ...nH.slice(0, 3).map(n => ({ kind: 'node', n, label: n.name, sub: n.type, hex: n.hex })),
    ...uH.slice(0, 4).map(u => ({ kind: 'uc', u, n: u.srcNode, label: u.t, sub: u.srcNode.name, hex: u.srcNode.hex })),
  ].slice(0, 6);
  if (!res.length) { sdrop.classList.remove('open'); return; }
  sdrop.innerHTML = res.map((r, i) =>
    `<div class="sdi" onclick="pickSearch(${i})">
      <div class="sdi-dot" style="background:${r.hex}"></div>
      <div>
        <div class="sdi-name">${r.label}</div>
        <div class="sdi-sub">${r.sub}</div>
      </div>
      <span class="sdi-badge" style="background:${r.hex}18;color:${r.hex}">${r.kind === 'node' ? 'SYSTEM' : 'USE CASE'}</span>
    </div>`
  ).join('');
  sdrop._r = res;
  sdrop.classList.add('open');
});

function pickSearch(i) {
  const r = sdrop._r[i]; if (!r) return;
  selectNode(r.n.id);
  if (r.kind === 'uc') {
    // showPanel (called by selectNode) sets _ucCache; wait for it then find the UC by title
    setTimeout(() => {
      const idx = _ucCache.findIndex(u => u.t === r.u.t);
      showUCD(idx >= 0 ? idx : 0, r.hex);
    }, 400);
  }
  sdrop.classList.remove('open');
  si.value = '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.srch')) sdrop.classList.remove('open');
});
si.addEventListener('keydown', e => {
  if (e.key === 'Escape') { sdrop.classList.remove('open'); deselect(); }
  if (e.key === 'Enter')  { const f = sdrop.querySelector('.sdi'); if (f) f.click(); }
});

// ── Filter ────────────────────────────────────────────────
function setFilter(f, el) {
  STATE.activeFilter = f;
  STATE.selectedId   = null;
  document.querySelectorAll('.fb').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  applyDim();
  document.getElementById('panel').classList.remove('open');
}

// ── Animation loop ────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  STATE.clock += CONFIG.animation.clockStep;
  const t = STATE.clock;

  if (STATE.autoOrbit && !STATE.dragging && !STATE.flyActive) {
    STATE.tTheta += CONFIG.animation.orbitSpeed;
  }
  camTick();

  // Explode animation (lerp toward target)
  const et = STATE.exploded ? 1 : 0;
  STATE.explodeT += (et - STATE.explodeT) * CONFIG.animation.explodeLerp;
  if (Math.abs(STATE.explodeT - et) > 0.002) applyExplode(STATE.explodeT);

  // Pulse particles — travel along connection curves
  pulseDefs.forEach(p => {
    p.t = (p.t + p.s) % 1;
    try {
      const pos = p.curve.getPoint(p.t);
      pPos[p.idx * 3]     = pos.x;
      pPos[p.idx * 3 + 1] = pos.y;
      pPos[p.idx * 3 + 2] = pos.z;
    } catch (_) {}
  });
  pGeo.attributes.position.needsUpdate = true;
  pMat.opacity = 0.9 + Math.sin(t * 2) * 0.08;

  // Ambient particle drift
  for (let i = 0; i < ambientCount; i++) {
    apPos[i * 3 + 1] += 0.005;
    if (apPos[i * 3 + 1] > 20) apPos[i * 3 + 1] = -8;
  }
  apGeo.attributes.position.needsUpdate = true;

  // Live ring pulse + DB halo rotation
  _groupEntries.forEach(([, grp]) => {
    if (grp._liveRingMat) grp._liveRingMat.opacity = 0.3 + Math.sin(t * 3 + grp.position.y) * 0.25;
    if (grp._ring1) grp._ring1.rotation.z =  t * 0.15;
    if (grp._ring2) grp._ring2.rotation.z = -t * 0.08;
  });

  // Core node glow when exploded
  ['db', 'api', 'ai'].forEach(cid => {
    const m = meshById[cid]; if (!m) return;
    if (STATE.explodeT > 0.05 && !STATE.selectedId) {
      m.material.emissiveIntensity = 1.0 + Math.sin(t * 2.5) * 0.3 * STATE.explodeT;
    }
  });

  // Selected node pulse
  if (STATE.selectedId && meshById[STATE.selectedId]) {
    meshById[STATE.selectedId].material.emissiveIntensity = 0.85 + Math.sin(t * 3.5) * 0.18;
  }

  // Light breathing
  lA.intensity = 20 + Math.sin(t * 0.65) * 5;
  lB.intensity = 12 + Math.sin(t * 1.1)  * 3;

  renderer.render(scene, camera);
  updateBeamBillboards();
  updateLabels();
}

// ── Resize ────────────────────────────────────────────────
window.addEventListener('resize', () => {
  renderer.setSize(W(), H());
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
});

// ── Loader ────────────────────────────────────────────────
const LOADER_MSGS = [
  `LOADING ${SOURCES.length} SOURCE CONNECTORS...`,
  'BUILDING GLOW BEAMS...',
  'PLACING FLOW ARROWS...',
  `INDEXING ${ALL_UCS.length} USE CASES...`,
  'READY',
];
let ls = 0;
function loaderTick() {
  if (ls >= LOADER_MSGS.length) return;
  document.getElementById('lm').textContent    = LOADER_MSGS[ls];
  document.getElementById('lf').style.width    = ((ls + 1) / LOADER_MSGS.length * 100) + '%';
  ls++;
  if (ls < LOADER_MSGS.length) {
    setTimeout(loaderTick, ls === LOADER_MSGS.length - 1 ? 80 : 260);
  } else {
    setTimeout(() => {
      const l = document.getElementById('loader');
      l.classList.add('out');
      setTimeout(() => l.style.display = 'none', 700);
    }, 80);
  }
}

setTimeout(loaderTick, 300);
applyDim();
animate();
