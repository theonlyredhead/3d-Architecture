// ══════════════════════════════════════════════════════════
//  Isometric Platform View  —  iso-app.js
//  Lazy-initialised on first show().
// ══════════════════════════════════════════════════════════

const ISO = (() => {

  // ── Core node definitions ──────────────────────────────
  const CORE = [
    { id: 'iso-api', hex: '#3B82F6', name: 'COCO API',   sub: 'ASP.NET Core · Azure APIM', scale: 2.2 },
    { id: 'iso-db',  hex: '#10B981', name: 'Central DB', sub: 'Azure SQL · pgvector',       scale: 2.6 },
    { id: 'iso-ai',  hex: '#FB923C', name: 'AI Engine',  sub: 'Claude 3.5 · LangChain',     scale: 1.9 },
  ];

  // ── Layout: [x, z]  (screen-right = +x −z; screen-left = −x +z) ──
  // Sources: upper-left quadrant in world, appears left on screen
  const SRC_POS = [
    [-38, 44], [-20, 48], [ -2, 50], [ 16, 48],   // row 0 — 4 nodes
    [-32, 30], [-14, 32], [  4, 32],               // row 1 — 3 nodes
    [-26, 16], [ -8, 18], [ 10, 16],               // row 2 — 3 nodes
    [-18,  4],                                     // row 3 — 1 node
  ];

  // Core: centre
  const CORE_POS = {
    'iso-api': [ -6,  -4 ],
    'iso-db':  [  6,   4 ],
    'iso-ai':  [ -2, -16 ],
  };

  // Outputs: lower-right quadrant, appears right on screen
  const OUT_POS = [
    [ 28,  -4 ],
    [ 40,   4 ],
    [ 28, -18 ],
    [ 40, -12 ],
  ];

  // ── State ──────────────────────────────────────────────
  let renderer, scene, camera, isoComposer;
  let isoRenderFn = null;
  let _active = false, _raf = null, _clock = 0, _lastT = 0;
  const _platforms = [];
  const _conns     = [];
  const _platMap   = {};

  // ── Lazy init ──────────────────────────────────────────
  function _init() {
    if (renderer) return;

    const mount = document.getElementById('iso-mount');
    const W = () => mount.clientWidth;
    const H = () => mount.clientHeight;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x060a12);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();

    // Isometric orthographic camera
    // sz controls zoom — smaller = bigger platforms on screen
    const sz = 55;
    const asp = W() / H();
    camera = new THREE.OrthographicCamera(
      -sz * asp, sz * asp, sz, -sz, 0.1, 800
    );
    // Classic isometric: equal distance on all 3 axes
    camera.position.set(140, 140, 140);
    // Look at the centroid of the scene (sources are back-left, outputs front-right)
    camera.lookAt(4, 0, 16);

    // Lighting
    const ambient = new THREE.AmbientLight(0x8090b0, 0.55);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(80, 160, 80);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far  = 600;
    key.shadow.camera.left = key.shadow.camera.bottom = -120;
    key.shadow.camera.right = key.shadow.camera.top   =  120;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x3060ff, 0.35);
    fill.position.set(-80, 60, -80);
    scene.add(fill);

    const back = new THREE.DirectionalLight(0xff8030, 0.15);
    back.position.set(0, 40, -120);
    scene.add(back);

    // Grid floor (subtle)
    const grid = new THREE.GridHelper(240, 40, 0x0f2030, 0x0a1620);
    grid.position.y = -0.8;
    grid.receiveShadow = true;
    scene.add(grid);

    // Bloom
    if (typeof THREE.EffectComposer !== 'undefined') {
      try {
        isoComposer = new THREE.EffectComposer(renderer);
        isoComposer.addPass(new THREE.RenderPass(scene, camera));
        const bloom = new THREE.UnrealBloomPass(
          new THREE.Vector2(W(), H()), 1.1, 0.45, 0.12
        );
        isoComposer.addPass(bloom);
        isoRenderFn = () => isoComposer.render();
        window.addEventListener('resize', () => isoComposer.setSize(W(), H()));
      } catch (_) {}
    }
    if (!isoRenderFn) isoRenderFn = () => renderer.render(scene, camera);

    // Label container
    const lc = document.getElementById('iso-labels');

    // ── Build platforms ──────────────────────────────────
    SOURCES.forEach((s, i) => {
      const [x, z] = SRC_POS[i] || [-20 + i * 4, 40];
      _addPlatform(s.id, x, z, s.hex, s.name, s.type || '', 1.0, lc);
    });
    OUTPUTS.forEach((o, i) => {
      const [x, z] = OUT_POS[i] || [30 + i * 6, 0];
      _addPlatform(o.id, x, z, o.hex, o.name, o.type || '', 1.0, lc);
    });
    CORE.forEach(c => {
      const [x, z] = CORE_POS[c.id];
      _addPlatform(c.id, x, z, c.hex, c.name, c.sub, c.scale, lc);
    });

    // ── Build connections ────────────────────────────────
    const apiP = _platMap['iso-api'];
    const dbP  = _platMap['iso-db'];
    const aiP  = _platMap['iso-ai'];

    SOURCES.forEach(s => {
      const sp = _platMap[s.id];
      if (sp && apiP) _addConn(sp, apiP, s.hex, 0.05);
    });

    if (apiP && dbP) _addConn(apiP, dbP, '#4fa6ff', 0.18);
    if (apiP && aiP) _addConn(apiP, aiP, '#ff9f50', 0.15);
    if (dbP  && aiP) _addConn(dbP,  aiP, '#30d499', 0.14);

    const coreOwners = [dbP, apiP, aiP, dbP];
    OUTPUTS.forEach((o, i) => {
      const op   = _platMap[o.id];
      const core = coreOwners[i % 3];
      if (op && core) _addConn(core, op, o.hex, 0.09);
    });

    window.addEventListener('resize', () => _onResize(mount));
  }

  // ── Platform factory ───────────────────────────────────
  function _addPlatform(id, wx, wz, hex, name, sub, scale, labelContainer) {
    const col = parseInt(hex.replace('#', ''), 16);
    const grp = new THREE.Group();

    // ── Slab stack ──────────────────────────────────────
    // Base: wide, very dark, subtle edge highlight
    const baseW = scale * 8, baseH = scale * 0.9;
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0a1520, roughness: 0.92, metalness: 0.05,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, baseW), baseMat);
    base.position.y = baseH / 2;
    base.castShadow = base.receiveShadow = true;
    grp.add(base);

    // Mid slab: slightly smaller, darker edge, coloured tint
    const midW = scale * 6.4, midH = scale * 0.55;
    const midMat = new THREE.MeshStandardMaterial({
      color: 0x0d1e2e, roughness: 0.85, metalness: 0.10,
    });
    const mid = new THREE.Mesh(new THREE.BoxGeometry(midW, midH, midW), midMat);
    mid.position.y = baseH + midH / 2;
    mid.castShadow = mid.receiveShadow = true;
    grp.add(mid);

    // Top pad: coloured, emissive glow
    const topW = scale * 5.0, topH = scale * 0.45;
    const topMat = new THREE.MeshStandardMaterial({
      color: col, emissive: col, emissiveIntensity: 0.55,
      roughness: 0.25, metalness: 0.60,
    });
    const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topW), topMat);
    top.position.y = baseH + midH + topH / 2;
    top.castShadow = true;
    grp.add(top);

    // Top surface glow plane (additive, very thin)
    const glowMat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(topW * 0.88, topW * 0.88), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = baseH + midH + topH + 0.01;
    grp.add(glow);

    // Corner accent pillars (tiny, bright)
    const pillarH = scale * 1.0;
    const offsets = [[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sz]) => [sx * topW * 0.42, sz * topW * 0.42]);
    offsets.forEach(([ox, oz]) => {
      const pm = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 });
      const pp = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.18, pillarH, scale * 0.18), pm);
      pp.position.set(ox, baseH + midH + topH + pillarH / 2, oz);
      grp.add(pp);
    });

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

    const topY = baseH + midH + topH;
    const entry = {
      group: grp, baseY: 0, phase: Math.random() * Math.PI * 2,
      labelEl: el, id, topY,
    };
    _platforms.push(entry);
    _platMap[id] = entry;
  }

  // ── Connection factory ─────────────────────────────────
  function _addConn(from, to, hex, thick) {
    const col = parseInt(hex.replace('#', ''), 16);
    const fp  = from.group.position;
    const tp  = to.group.position;
    const dist = fp.distanceTo(tp);
    const arcH  = 3.5 + dist * 0.10;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fp.x, from.topY + 0.3, fp.z),
      new THREE.Vector3((fp.x + tp.x) / 2, arcH, (fp.z + tp.z) / 2),
      new THREE.Vector3(tp.x, to.topY + 0.3, tp.z),
    ]);

    // Tube mesh
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, thick, 6, false),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    scene.add(tube);

    // Flowing particles
    const N    = 6;
    const pArr = new Float32Array(N * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
    const pMesh = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: col, size: 0.45, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    scene.add(pMesh);

    _conns.push({
      pMesh, curve,
      phases: Array.from({ length: N }, (_, i) => i / N),
      speed:  0.0035 + Math.random() * 0.002,
      pArr,
    });
  }

  // ── 3D → screen ────────────────────────────────────────
  const _pv = new THREE.Vector3();
  function _toScreen(wx, wy, wz) {
    const mount = document.getElementById('iso-mount');
    const W = mount.clientWidth, H = mount.clientHeight;
    _pv.set(wx, wy, wz).project(camera);
    return { x: (_pv.x * 0.5 + 0.5) * W, y: (-_pv.y * 0.5 + 0.5) * H };
  }

  // ── Resize ─────────────────────────────────────────────
  function _onResize(mount) {
    const W = mount.clientWidth, H = mount.clientHeight;
    renderer.setSize(W, H);
    const sz = 55, asp = W / H;
    camera.left = -sz * asp; camera.right = sz * asp;
    camera.top  =  sz;       camera.bottom = -sz;
    camera.updateProjectionMatrix();
  }

  // ── Animation loop ─────────────────────────────────────
  function _animate() {
    if (!_active) return;
    _raf = requestAnimationFrame(_animate);

    const now   = performance.now();
    const delta = Math.min((now - _lastT) / 1000, 0.05);
    _lastT  = now;
    _clock += delta;

    // Bob
    _platforms.forEach(p => {
      p.group.position.y = p.baseY + Math.sin(_clock * 0.65 + p.phase) * 0.35;
    });

    // Flow particles
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

    // Labels
    _platforms.forEach(p => {
      const gp = p.group.position;
      const sc = _toScreen(gp.x, gp.y + p.topY + 0.8, gp.z);
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
  const isoMount   = document.getElementById('iso-mount');
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
    if (keyEl)  keyEl.style.display  = '';
    if (skeyEl) skeyEl.style.display = '';
    if (kbdEl)  kbdEl.style.display  = '';
    document.getElementById('vIso3d').classList.add('on');
    document.getElementById('vIsoFlat').classList.remove('on');
    ISO.hide();
  }
}
