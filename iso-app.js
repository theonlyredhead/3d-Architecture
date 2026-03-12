// ══════════════════════════════════════════════════════════
//  Isometric Platform View  —  iso-app.js
//  Lazy-initialised on first show().
//  Reads globals from data.js: SOURCES, OUTPUTS
//  Core node colours/names are inline below.
// ══════════════════════════════════════════════════════════

const ISO = (() => {
  // ── Core node definitions ──────────────────────────────
  const CORE = [
    { id: 'iso-api', hex: '#3B82F6', name: 'COCO API',   sub: 'ASP.NET Core · Azure APIM', scale: 1.4 },
    { id: 'iso-db',  hex: '#10B981', name: 'Central DB', sub: 'Azure SQL · pgvector',       scale: 1.6 },
    { id: 'iso-ai',  hex: '#FB923C', name: 'AI Engine',  sub: 'Claude 3.5 · LangChain',     scale: 1.2 },
  ];

  // ── Layout: [x, z]  (screen-right = +x −z; screen-left = −x +z) ──
  // Sources fan out to the screen-left (back-left in world space)
  const SRC_POS = [
    [-22, 28], [-12, 32], [ -2, 32], [  8, 30],   // row 0
    [-20, 18], [-10, 22], [  0, 22],               // row 1
    [-18,  9], [ -8, 13], [  2, 13],               // row 2
    [-14,  3],                                     // row 3
  ];

  // Core platform positions (centred)
  const CORE_POS = {
    'iso-api': [ -2, -4 ],
    'iso-db':  [  5,  2 ],
    'iso-ai':  [ -2, -12],
  };

  // Outputs fan to the screen-right (front-right in world space)
  const OUT_POS = [
    [ 20, -10],
    [ 28,  -4],
    [ 20,  -18],
    [ 28,  -16],
  ];

  // ── State ──────────────────────────────────────────────
  let renderer, scene, camera, isoComposer;
  let isoRenderFn = null;
  let _active = false, _raf = null, _clock = 0, _lastT = 0;
  const _platforms = [];  // { group, baseY, phase, labelEl, id }
  const _conns     = [];  // { pMesh, curve, phases, speed, pArr }
  const _platMap   = {};  // id → platform entry

  // ── Lazy init ──────────────────────────────────────────
  function _init() {
    if (renderer) return;   // already initialised

    const mount = document.getElementById('iso-mount');

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x060a12);
    mount.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060a12, 0.006);

    // Orthographic isometric camera
    _resizeCam(mount);

    // Lighting
    scene.add(new THREE.AmbientLight(0x7090b8, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(60, 120, 60);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x3B82F6, 0.4);
    rim.position.set(-60, 40, -60);
    scene.add(rim);

    // Grid floor
    const grid = new THREE.GridHelper(160, 32, 0x0d1f35, 0x09141f);
    grid.position.y = -0.6;
    scene.add(grid);

    // Bloom post-processing
    if (typeof THREE.EffectComposer !== 'undefined') {
      try {
        isoComposer = new THREE.EffectComposer(renderer);
        isoComposer.addPass(new THREE.RenderPass(scene, camera));
        const bloom = new THREE.UnrealBloomPass(
          new THREE.Vector2(mount.clientWidth, mount.clientHeight),
          1.4, 0.5, 0.08
        );
        isoComposer.addPass(bloom);
        isoRenderFn = () => isoComposer.render();
      } catch (_) {}
    }
    if (!isoRenderFn) isoRenderFn = () => renderer.render(scene, camera);

    // Label container (HTML overlay)
    const lc = document.getElementById('iso-labels');

    // Build all platforms
    SOURCES.forEach((s, i) => {
      const [x, z] = SRC_POS[i] || [-20 + i * 3, 30];
      _addPlatform(s.id, x, z, s.hex, s.name, s.type || '', 0.72, lc);
    });

    OUTPUTS.forEach((o, i) => {
      const [x, z] = OUT_POS[i] || [22 + i * 4, -10];
      _addPlatform(o.id, x, z, o.hex, o.name, o.type || '', 0.72, lc);
    });

    CORE.forEach(c => {
      const [x, z] = CORE_POS[c.id];
      _addPlatform(c.id, x, z, c.hex, c.name, c.sub, c.scale, lc);
    });

    // Build connections
    const apiP = _platMap['iso-api'];
    const dbP  = _platMap['iso-db'];
    const aiP  = _platMap['iso-ai'];

    // Every source → API
    SOURCES.forEach(s => {
      const sp = _platMap[s.id];
      if (sp && apiP) _addConn(sp, apiP, s.hex, 0.045);
    });

    // Core interconnects (thicker)
    if (apiP && dbP) _addConn(apiP, dbP, '#3B82F6', 0.13);
    if (apiP && aiP) _addConn(apiP, aiP, '#FB923C', 0.11);
    if (dbP  && aiP) _addConn(dbP,  aiP, '#10B981', 0.10);

    // Core → outputs (each output from its most relevant core)
    const coreOwners = [dbP, apiP, aiP, dbP];
    OUTPUTS.forEach((o, i) => {
      const op   = _platMap[o.id];
      const core = coreOwners[i % 3];
      if (op && core) _addConn(core, op, o.hex, 0.07);
    });

    window.addEventListener('resize', () => _onResize(mount));
  }

  // ── Platform factory ───────────────────────────────────
  function _addPlatform(id, wx, wz, hex, name, sub, scale, labelContainer) {
    const col  = parseInt(hex.replace('#', ''), 16);
    const grp  = new THREE.Group();

    // Three stacked slabs: base → mid → top
    [
      [scale * 5.8, 0.50, 0x080f1c, 0.85],
      [scale * 4.6, 0.38, 0x0c1829, 0.75],
      [scale * 3.4, 0.32, col,      0.40],  // coloured top
    ].forEach(([size, h, color, ei], i) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: i === 2 ? ei : 0.0,
        roughness: i === 2 ? 0.35 : 0.85,
        metalness: i === 2 ? 0.55 : 0.15,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, h, size), m);
      mesh.position.y = [0, 0.44, 0.82][i];
      grp.add(mesh);
    });

    // Thin diamond glow ring lying flat on top
    const ringMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(scale * 1.3, scale * 1.75, 4), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 1.15;
    grp.add(ring);

    // Vertical glow pillar (thin box, additive)
    const pillarMat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.5, 3.5, scale * 0.5), pillarMat);
    pillar.position.y = 2.5;
    grp.add(pillar);

    grp.position.set(wx, 0, wz);
    scene.add(grp);

    // HTML label
    const el = document.createElement('div');
    el.className = 'iso-label';
    el.innerHTML =
      `<span class="iso-lname" style="color:${hex}">${name}</span>` +
      (sub ? `<span class="iso-lsub">${sub}</span>` : '');
    el.style.opacity = '0';
    labelContainer.appendChild(el);

    const phase = Math.random() * Math.PI * 2;
    const entry = { group: grp, baseY: 0, phase, labelEl: el, id };
    _platforms.push(entry);
    _platMap[id] = entry;
  }

  // ── Connection factory ─────────────────────────────────
  function _addConn(from, to, hex, thick) {
    const col = parseInt(hex.replace('#', ''), 16);
    const fp  = from.group.position;
    const tp  = to.group.position;

    const dist = fp.distanceTo(tp);
    const arcH = 2.2 + dist * 0.07;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fp.x, 1.1, fp.z),
      new THREE.Vector3((fp.x + tp.x) / 2, arcH, (fp.z + tp.z) / 2),
      new THREE.Vector3(tp.x, 1.1, tp.z),
    ]);

    // Static tube
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 28, thick, 5, false),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    scene.add(tube);

    // Flowing particle dots
    const N    = 5;
    const pArr = new Float32Array(N * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
    const pMesh = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: col, size: 0.28, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    scene.add(pMesh);

    _conns.push({
      pMesh, curve,
      phases: Array.from({ length: N }, (_, i) => i / N),
      speed:  0.004 + Math.random() * 0.003,
      pArr,
    });
  }

  // ── 3-D → screen projection ────────────────────────────
  const _pv = new THREE.Vector3();
  function _toScreen(wx, wy, wz) {
    const mount = document.getElementById('iso-mount');
    const W = mount.clientWidth, H = mount.clientHeight;
    _pv.set(wx, wy, wz).project(camera);
    return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H };
  }

  // ── Camera resize ──────────────────────────────────────
  function _resizeCam(mount) {
    const W = mount.clientWidth, H = mount.clientHeight;
    const asp = W / H, sz = 60;
    if (!camera) {
      camera = new THREE.OrthographicCamera(
        -sz * asp, sz * asp, sz, -sz, 0.1, 600
      );
      camera.position.set(100, 100, 100);
      camera.lookAt(0, 0, 0);
    } else {
      camera.left = -sz * asp; camera.right = sz * asp;
      camera.top  =  sz;       camera.bottom = -sz;
      camera.updateProjectionMatrix();
    }
  }

  function _onResize(mount) {
    const W = mount.clientWidth, H = mount.clientHeight;
    renderer.setSize(W, H);
    if (isoComposer) isoComposer.setSize(W, H);
    _resizeCam(mount);
  }

  // ── Animation loop ─────────────────────────────────────
  function _animate() {
    if (!_active) return;
    _raf = requestAnimationFrame(_animate);

    const now   = performance.now();
    const delta = Math.min((now - _lastT) / 1000, 0.05);
    _lastT  = now;
    _clock += delta;

    // Bob platforms
    _platforms.forEach(p => {
      p.group.position.y = p.baseY + Math.sin(_clock * 0.65 + p.phase) * 0.3;
    });

    // Advance particles along curves
    _conns.forEach(c => {
      for (let i = 0; i < c.phases.length; i++) {
        c.phases[i] = (c.phases[i] + c.speed) % 1;
        const pt = c.curve.getPoint(c.phases[i]);
        c.pArr[i * 3]     = pt.x;
        c.pArr[i * 3 + 1] = pt.y;
        c.pArr[i * 3 + 2] = pt.z;
      }
      c.pMesh.geometry.attributes.position.needsUpdate = true;
    });

    // Update HTML labels
    _platforms.forEach(p => {
      const gp = p.group.position;
      const sc = _toScreen(gp.x, gp.y + 2.4, gp.z);
      p.labelEl.style.left    = sc.x + 'px';
      p.labelEl.style.top     = sc.y + 'px';
      p.labelEl.style.opacity = '1';
    });

    isoRenderFn();
  }

  // ── Public API ─────────────────────────────────────────
  function show() {
    _init();
    _active = true;
    _lastT  = performance.now();
    _animate();
  }

  function hide() {
    _active = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    _platforms.forEach(p => { p.labelEl.style.opacity = '0'; });
  }

  return { show, hide };
})();

// ── View toggle ────────────────────────────────────────────
function isoToggle(on) {
  const isoMount  = document.getElementById('iso-mount');
  const threeMount = document.getElementById('three-mount');
  const labelLayer = document.getElementById('label-layer');
  const filterbar  = document.getElementById('filterbar');
  const vctrlsEl   = document.getElementById('vctrls');
  const keyEl      = document.getElementById('key');
  const skeyEl     = document.getElementById('skey');
  const kbdEl      = document.getElementById('kbd-hint');

  const goIso = on !== undefined ? on : isoMount.style.display === 'none';

  if (goIso) {
    threeMount.style.display  = 'none';
    labelLayer.style.display  = 'none';
    filterbar.style.display   = 'none';
    vctrlsEl.style.display    = 'none';
    if (keyEl)  keyEl.style.display  = 'none';
    if (skeyEl) skeyEl.style.display = 'none';
    if (kbdEl)  kbdEl.style.display  = 'none';
    isoMount.style.display    = 'block';
    document.getElementById('vIso3d').classList.remove('on');
    document.getElementById('vIsoFlat').classList.add('on');
    ISO.show();
  } else {
    isoMount.style.display    = 'none';
    threeMount.style.display  = '';
    labelLayer.style.display  = '';
    filterbar.style.display   = '';
    vctrlsEl.style.display    = '';
    if (keyEl)  keyEl.style.display  = '';
    if (skeyEl) skeyEl.style.display = '';
    if (kbdEl)  kbdEl.style.display  = '';
    document.getElementById('vIso3d').classList.add('on');
    document.getElementById('vIsoFlat').classList.remove('on');
    ISO.hide();
  }
}
