// ══════════════════════════════════════════════════════════
//  Isometric Platform View  —  iso-app.js
//  Hub-and-spoke layout + hover cards.
// ══════════════════════════════════════════════════════════

const ISO = (() => {

  // ── Core node definitions ──────────────────────────────
  const CORE = [
    { id: 'iso-api', hex: '#3B82F6', name: 'COCO API',   sub: 'ASP.NET Core · Azure APIM',
      desc: 'Central API gateway. Every connector flows through here — REST ingestion, GraphQL queries, JWT + HMAC auth, Azure Service Bus for async jobs.',
      count: '7 capabilities', scale: 2.2 },
    { id: 'iso-db',  hex: '#10B981', name: 'Central DB', sub: 'Azure SQL · pgvector · EF Core 8',
      desc: 'Single source of truth for all business data. Row-level security enforced in the database, not app code. pgvector embeddings for AI search.',
      count: '6 capabilities', scale: 2.6 },
    { id: 'iso-ai',  hex: '#FB923C', name: 'AI Engine',  sub: 'Claude 3.5 Sonnet · LangChain',
      desc: 'AWS Bedrock RAG pipeline. Reads from the DB vector store to answer questions, generate briefings, and flag anomalies across all business data.',
      count: '6 capabilities', scale: 1.9 },
  ];

  // ── Hub-and-spoke positions (calculated from radial angles) ──
  // Camera at (140,140,140): screen-right ≈ world (+0.707, 0, -0.707)
  // Screen angle α → world x = 0.707·r·(cosα−sinα),  z = cx − 0.707·r·(cosα+sinα)
  //
  // Sources: 11 nodes spread 100°→260° left-screen arc, radius 36
  const SRC_POS = (function () {
    const r = 36, cx = 0, cz = 2;
    return Array.from({ length: 11 }, (_, i) => {
      const a = (100 + i * 16) * Math.PI / 180;
      return [
        cx + r * 0.707 * (Math.cos(a) - Math.sin(a)),
        cz - r * 0.707 * (Math.cos(a) + Math.sin(a)),
      ];
    });
  })();

  // Outputs: 4 nodes spread −55°→+55° right-screen arc, radius 32
  const OUT_POS = [-55, -18, 18, 55].map(deg => {
    const r = 32, cx = 0, cz = 2, a = deg * Math.PI / 180;
    return [
      cx + r * 0.707 * (Math.cos(a) - Math.sin(a)),
      cz - r * 0.707 * (Math.cos(a) + Math.sin(a)),
    ];
  });

  // Core tight cluster in the centre
  const CORE_POS = { 'iso-api': [-5, -4], 'iso-db': [0, 2], 'iso-ai': [6, -3] };

  // ── Internal state ─────────────────────────────────────
  let renderer, scene, camera, isoComposer, isoRenderFn = null;
  let _active = false, _raf = null, _clock = 0, _lastT = 0;
  const _platforms   = [];
  const _conns       = [];
  const _platMap     = {};
  const _dataMap     = {};  // id → raw data for hover card
  const _hoverMeshes = [];  // top-pad meshes for raycaster
  const _ray         = new THREE.Raycaster();
  const _mouse       = new THREE.Vector2(-9999, -9999);
  let   _hoveredId   = null;

  // ── Lazy init ──────────────────────────────────────────
  function _init() {
    if (renderer) return;
    const mount = document.getElementById('iso-mount');
    const W = () => mount.clientWidth, H = () => mount.clientHeight;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x060a12);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    const sz = 55, asp = W() / H();
    camera = new THREE.OrthographicCamera(-sz * asp, sz * asp, sz, -sz, 0.1, 800);
    camera.position.set(140, 140, 140);
    camera.lookAt(0, 0, 2);

    scene.add(new THREE.AmbientLight(0x8090b0, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(80, 160, 80);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -160;
    key.shadow.camera.right = key.shadow.camera.top   =  160;
    key.shadow.camera.far  = 600;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x3060ff, 0.35);
    fill.position.set(-80, 60, -80);
    scene.add(fill);

    const grid = new THREE.GridHelper(280, 56, 0x0f2030, 0x0a1620);
    grid.position.y = -0.8; scene.add(grid);

    if (typeof THREE.EffectComposer !== 'undefined') {
      try {
        isoComposer = new THREE.EffectComposer(renderer);
        isoComposer.addPass(new THREE.RenderPass(scene, camera));
        isoComposer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(W(), H()), 0.65, 0.4, 0.32));
        isoRenderFn = () => isoComposer.render();
        window.addEventListener('resize', () => isoComposer.setSize(W(), H()));
      } catch (_) {}
    }
    if (!isoRenderFn) isoRenderFn = () => renderer.render(scene, camera);

    // Register data for hover cards
    SOURCES.forEach(s => { _dataMap[s.id] = { ...s, kind: 'SOURCE CONNECTOR' }; });
    OUTPUTS.forEach(o => { _dataMap[o.id] = { ...o, kind: 'OUTPUT CONNECTOR' }; });
    CORE.forEach(c    => { _dataMap[c.id] = { ...c, kind: 'CORE NODE' }; });

    const lc = document.getElementById('iso-labels');

    SOURCES.forEach((s, i) => _addPlatform(s.id, ...SRC_POS[i], s.hex, s.name, s.type || '', 1.0, lc));
    OUTPUTS.forEach((o, i) => _addPlatform(o.id, ...OUT_POS[i], o.hex, o.name, o.type || '', 1.0, lc));
    CORE.forEach(c => _addPlatform(c.id, ...CORE_POS[c.id], c.hex, c.name, c.sub, c.scale, lc));

    const apiP = _platMap['iso-api'], dbP = _platMap['iso-db'], aiP = _platMap['iso-ai'];
    SOURCES.forEach(s => { const sp = _platMap[s.id]; if (sp && apiP) _addConn(sp, apiP, s.hex, 0.04); });
    if (apiP && dbP) _addConn(apiP, dbP, '#4fa6ff', 0.18);
    if (apiP && aiP) _addConn(apiP, aiP, '#ff9f50', 0.15);
    if (dbP  && aiP) _addConn(dbP,  aiP, '#30d499', 0.14);
    const coreOwners = [dbP, apiP, aiP, dbP];
    OUTPUTS.forEach((o, i) => { const op = _platMap[o.id], c = coreOwners[i % 3]; if (op && c) _addConn(c, op, o.hex, 0.08); });

    // Mouse hover
    renderer.domElement.addEventListener('mousemove', e => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.set(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
       -((e.clientY - rect.top)  / rect.height) * 2 + 1
      );
      _checkHover(e.clientX, e.clientY);
    });
    renderer.domElement.addEventListener('mouseleave', () => { _mouse.set(-9999,-9999); _hideCard(); });

    window.addEventListener('resize', () => {
      const W2 = mount.clientWidth, H2 = mount.clientHeight, asp2 = W2 / H2;
      renderer.setSize(W2, H2);
      camera.left = -sz*asp2; camera.right = sz*asp2; camera.top = sz; camera.bottom = -sz;
      camera.updateProjectionMatrix();
    });
  }

  // ── Platform factory ───────────────────────────────────
  function _addPlatform(id, wx, wz, hex, name, sub, scale, lc) {
    const col   = parseInt(hex.replace('#', ''), 16);
    const grp   = new THREE.Group();
    const baseH = scale * 0.9, midH = scale * 0.55, topH = scale * 0.45;
    const baseW = scale * 8,   midW = scale * 6.4,  topW = scale * 5.0;

    const base = new THREE.Mesh(new THREE.BoxGeometry(baseW, baseH, baseW),
      new THREE.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.92, metalness: 0.05 }));
    base.position.y = baseH / 2;
    base.castShadow = base.receiveShadow = true;
    grp.add(base);

    const mid = new THREE.Mesh(new THREE.BoxGeometry(midW, midH, midW),
      new THREE.MeshStandardMaterial({ color: 0x0d1e2e, roughness: 0.85, metalness: 0.1 }));
    mid.position.y = baseH + midH / 2;
    mid.castShadow = mid.receiveShadow = true;
    grp.add(mid);

    const top = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topW),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.28, roughness: 0.25, metalness: 0.6 }));
    top.position.y = baseH + midH + topH / 2;
    top.castShadow = true;
    top.userData.platformId = id;
    grp.add(top);
    _hoverMeshes.push(top);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(topW * 0.88, topW * 0.88),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = baseH + midH + topH + 0.01;
    grp.add(glow);

    const pillarH = scale * 1.0;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
      const pp = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.18, pillarH, scale * 0.18),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
      pp.position.set(sx * topW * 0.42, baseH + midH + topH + pillarH / 2, sz * topW * 0.42);
      grp.add(pp);
    });

    grp.position.set(wx, 0, wz);
    scene.add(grp);

    const el = document.createElement('div');
    el.className = 'iso-label';
    el.innerHTML = `<span class="iso-lname" style="color:${hex}">${name}</span>` +
                   (sub ? `<span class="iso-lsub">${sub}</span>` : '');
    el.style.opacity = '0';
    lc.appendChild(el);

    const topY = baseH + midH + topH;
    _platforms.push({ group: grp, baseY: 0, phase: Math.random() * Math.PI * 2, labelEl: el, id, topY });
    _platMap[id] = _platforms[_platforms.length - 1];
  }

  // ── Connection factory ─────────────────────────────────
  function _addConn(from, to, hex, thick) {
    const col = parseInt(hex.replace('#', ''), 16);
    const fp = from.group.position, tp = to.group.position;
    const dist = fp.distanceTo(tp);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fp.x, from.topY + 0.3, fp.z),
      new THREE.Vector3((fp.x+tp.x)/2, 3.5 + dist*0.10, (fp.z+tp.z)/2),
      new THREE.Vector3(tp.x, to.topY + 0.3, tp.z),
    ]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, thick, 6, false),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
    const N = 6, pArr = new Float32Array(N * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
    const pMesh = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: col, size: 0.45, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    scene.add(pMesh);
    _conns.push({ pMesh, curve, phases: Array.from({length:N},(_,i)=>i/N), speed: 0.0035+Math.random()*0.002, pArr });
  }

  // ── Hover card ─────────────────────────────────────────
  function _checkHover(mx, my) {
    _ray.setFromCamera(_mouse, camera);
    const hits = _ray.intersectObjects(_hoverMeshes);
    if (hits.length) {
      const id = hits[0].object.userData.platformId;
      if (id !== _hoveredId) { _hoveredId = id; _showCard(id); }
      _positionCard(mx, my);
    } else { _hoveredId = null; _hideCard(); }
  }

  function _showCard(id) {
    const card = document.getElementById('iso-card');
    if (!card) return;
    const d = _dataMap[id]; if (!d) return;
    let footer = '';
    if (d.uc)    footer += `${d.uc.length} USE CASES`;
    if (d.count) footer += (footer ? '  ·  ' : '') + d.count.toUpperCase();
    if (d.sync)  footer += (footer ? '  ·  ' : '') + d.sync.toUpperCase();
    card.innerHTML = `
      <div class="ihc-bar" style="background:${d.hex};box-shadow:0 0 12px ${d.hex}50"></div>
      <div class="ihc-body">
        <div class="ihc-kind">${d.kind || ''}</div>
        <div class="ihc-name" style="color:${d.hex}">${d.name}</div>
        ${d.sub||d.type ? `<div class="ihc-sub">${d.sub||d.type}</div>` : ''}
        ${d.desc        ? `<div class="ihc-desc">${d.desc}</div>` : ''}
        ${footer        ? `<div class="ihc-footer">${footer}</div>` : ''}
      </div>`;
    card.style.display = 'block';
  }

  function _positionCard(mx, my) {
    const card = document.getElementById('iso-card');
    if (!card || card.style.display === 'none') return;
    const cw = card.offsetWidth || 270;
    const left = mx + 18 + cw > window.innerWidth ? mx - cw - 14 : mx + 18;
    card.style.left = left + 'px';
    card.style.top  = Math.max(84, my - (card.offsetHeight || 120) / 2) + 'px';
  }

  function _hideCard() {
    const c = document.getElementById('iso-card'); if (c) c.style.display = 'none';
  }

  // ── 3D → screen ────────────────────────────────────────
  const _pv = new THREE.Vector3();
  function _toScreen(wx, wy, wz) {
    const m = document.getElementById('iso-mount');
    _pv.set(wx, wy, wz).project(camera);
    return { x: (_pv.x * 0.5 + 0.5) * m.clientWidth, y: (-_pv.y * 0.5 + 0.5) * m.clientHeight };
  }

  // ── Animate ────────────────────────────────────────────
  function _animate() {
    if (!_active) return;
    _raf = requestAnimationFrame(_animate);
    const now = performance.now(), delta = Math.min((now - _lastT) / 1000, 0.05);
    _lastT = now; _clock += delta;

    _platforms.forEach(p => { p.group.position.y = p.baseY + Math.sin(_clock * 0.65 + p.phase) * 0.35; });

    _conns.forEach(c => {
      for (let i = 0; i < c.phases.length; i++) {
        c.phases[i] = (c.phases[i] + c.speed) % 1;
        const pt = c.curve.getPoint(c.phases[i]);
        c.pArr[i*3] = pt.x; c.pArr[i*3+1] = pt.y; c.pArr[i*3+2] = pt.z;
      }
      c.pMesh.geometry.attributes.position.needsUpdate = true;
    });

    _platforms.forEach(p => {
      const gp = p.group.position, sc = _toScreen(gp.x, gp.y + p.topY + 0.8, gp.z);
      p.labelEl.style.left = sc.x + 'px'; p.labelEl.style.top = sc.y + 'px'; p.labelEl.style.opacity = '1';
    });

    isoRenderFn();
  }

  function show() { _init(); _active = true; _lastT = performance.now(); _animate(); }
  function hide() {
    _active = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
    _platforms.forEach(p => { p.labelEl.style.opacity = '0'; });
    _hideCard();
  }

  return { show, hide };
})();

// ── View toggle ────────────────────────────────────────────
function isoToggle(on) {
  const isoMount   = document.getElementById('iso-mount');
  const threeMount = document.getElementById('three-mount');
  const goIso = on !== undefined ? on : isoMount.style.display === 'none';
  const others = ['three-mount','label-layer','filterbar','key','skey','kbd-hint'].map(id => document.getElementById(id));

  if (goIso) {
    others.forEach(el => { if (el) el.style.display = 'none'; });
    isoMount.style.display = 'block';
    document.getElementById('vIso3d').classList.remove('on');
    document.getElementById('vIsoFlat').classList.add('on');
    ISO.show();
  } else {
    isoMount.style.display = 'none';
    others.forEach(el => { if (el) el.style.display = ''; });
    document.getElementById('vIso3d').classList.add('on');
    document.getElementById('vIsoFlat').classList.remove('on');
    ISO.hide();
  }
}
