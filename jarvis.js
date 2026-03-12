// ══════════════════════════════════════════════════════════
//  JARVIS Enhancement Layer
//  jarvis.js — bloom, audio, HUD canvas, typewriter, voice
//
//  Loaded after app.js.  Reads globals: renderer, scene,
//  camera, mount, W, H, STATE, groupById, nodeData,
//  clickables, ray, renderFn (all from app.js).
// ══════════════════════════════════════════════════════════

// ── 1. Bloom post-processing (UnrealBloomPass) ────────────
//  Scripts loaded in index.html before jarvis.js:
//  CopyShader, LuminosityHighPassShader, ShaderPass,
//  RenderPass, EffectComposer, UnrealBloomPass
(function setupBloom() {
  if (typeof THREE.EffectComposer === 'undefined') {
    console.warn('[JARVIS] EffectComposer not loaded — bloom disabled.');
    return;
  }
  try {
    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));

    const bloom = new THREE.UnrealBloomPass(
      new THREE.Vector2(W(), H()),
      1.6,   // strength
      0.55,  // radius
      0.06   // threshold — low so connections + nodes both bloom
    );
    composer.addPass(bloom);

    // Override the render seam exposed by app.js
    renderFn = () => composer.render();

    window.addEventListener('resize', () => composer.setSize(W(), H()));
    console.info('[JARVIS] Bloom online.');
  } catch (e) {
    console.warn('[JARVIS] Bloom setup failed:', e);
  }
})();

// ── 2. WebAudio synthesizer ───────────────────────────────
const _ac = (() => {
  try { return new (window.AudioContext || window.webkitAudioContext)(); }
  catch (_) { return null; }
})();

// Browsers require a user gesture before audio can play
['click', 'keydown', 'touchstart'].forEach(ev =>
  document.addEventListener(ev, () => _ac && _ac.state === 'suspended' && _ac.resume(), { once: true, passive: true })
);

function _tone(freq, dur, type = 'sine', vol = 0.07, delay = 0) {
  if (!_ac) return;
  const now  = _ac.currentTime;
  const osc  = _ac.createOscillator();
  const gain = _ac.createGain();
  osc.connect(gain); gain.connect(_ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now + delay);
  gain.gain.setValueAtTime(0, now + delay);
  gain.gain.linearRampToValueAtTime(vol, now + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
  osc.start(now + delay);
  osc.stop(now + delay + dur + 0.06);
}

function _sweep(f0, f1, dur, type = 'sine', vol = 0.06, delay = 0) {
  if (!_ac) return;
  const now  = _ac.currentTime;
  const osc  = _ac.createOscillator();
  const gain = _ac.createGain();
  osc.connect(gain); gain.connect(_ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(f0, now + delay);
  osc.frequency.exponentialRampToValueAtTime(f1, now + delay + dur);
  gain.gain.setValueAtTime(0, now + delay);
  gain.gain.linearRampToValueAtTime(vol, now + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
  osc.start(now + delay);
  osc.stop(now + delay + dur + 0.06);
}

// Ambient electronic hum — starts on first interaction
let _humDone = false;
function _startHum() {
  if (_humDone || !_ac) return;
  _humDone = true;
  const g = _ac.createGain();
  g.gain.value = 0;
  g.connect(_ac.destination);
  [55, 82.5, 110].forEach((f, i) => {
    const o = _ac.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    o.connect(g); o.start();
  });
  g.gain.linearRampToValueAtTime(0.016, _ac.currentTime + 5);
}
document.addEventListener('click', _startHum, { once: true });

const SFX = {
  hover()   { _tone(1400, 0.04, 'square', 0.016); },
  select()  {
    _sweep(300, 1800, 0.09, 'square', 0.04);
    _tone(1200, 0.14, 'sine', 0.06, 0.08);
    _tone(1600, 0.20, 'sine', 0.05, 0.18);
    _tone(2100, 0.28, 'sine', 0.04, 0.32);
  },
  deselect() { _sweep(900, 180, 0.18, 'sine', 0.04); },
  filter()   { _tone(500, 0.05, 'square', 0.022); _tone(720, 0.08, 'square', 0.016, 0.05); },
  panel()    { _sweep(160, 1100, 0.2, 'sine', 0.05); },
  ucdOpen()  { _tone(900, 0.06, 'sine', 0.04); _tone(1400, 0.12, 'sine', 0.035, 0.07); },
  startup()  {
    // Snappy JARVIS power-on chime (~1.4 s total)
    [220, 311, 440, 554, 740, 880, 1175, 1760].forEach((f, i) => {
      _tone(f, 0.16, 'sine', 0.065, i * 0.055);
    });
    _sweep(80, 1760, 0.6, 'sine', 0.045, 0.46);
    _tone(3520, 0.3, 'sine', 0.025, 1.1);
  },
};

// ── 3. HUD canvas (2D overlay) ────────────────────────────
const _hud   = document.createElement('canvas');
_hud.id      = 'jarvis-hud';
_hud.style.cssText = [
  'position:fixed', 'top:84px', 'left:0', 'right:0', 'bottom:0',
  'width:100%', 'height:calc(100% - 84px)',
  'pointer-events:none', 'z-index:100',
].join(';');
document.body.appendChild(_hud);
const _hctx = _hud.getContext('2d');

function _resizeHud() {
  _hud.width  = window.innerWidth;
  _hud.height = window.innerHeight - 84;
}
_resizeHud();
window.addEventListener('resize', _resizeHud);

// Scan ring pool — fired on node select
const _rings = [];
function _fireRing(x, y, hex, maxR = 110) {
  _rings.push({ x, y, r: 6, maxR, alpha: 1, hex: hex || '#3B82F6' });
  // Second smaller ring with slight delay
  setTimeout(() => _rings.push({ x, y, r: 6, maxR: maxR * 0.55, alpha: 1, hex }), 80);
}

// Project 3D world pos → HUD pixel coords
const _phv = new THREE.Vector3();
function _toHUD(grp) {
  if (!grp) return null;
  _phv.setFromMatrixPosition(grp.matrixWorld);
  const ndc = _phv.clone().project(camera);
  if (ndc.z > 1) return null;
  return {
    x: (ndc.x * 0.5 + 0.5) * _hud.width,
    y: (-ndc.y * 0.5 + 0.5) * _hud.height,
  };
}

let _lastHoverId = null;

function _drawHUD() {
  const w = _hud.width, h = _hud.height;
  _hctx.clearRect(0, 0, w, h);
  const T = performance.now() / 1000;

  // ── scan rings
  for (let i = _rings.length - 1; i >= 0; i--) {
    const rg = _rings[i];
    rg.r    += (rg.maxR - rg.r) * 0.055 + 1.4;
    rg.alpha = Math.max(0, 1 - rg.r / rg.maxR);
    if (rg.alpha < 0.01) { _rings.splice(i, 1); continue; }
    _hctx.save();
    _hctx.strokeStyle = rg.hex;
    _hctx.globalAlpha = rg.alpha * 0.85;
    _hctx.lineWidth   = 1.5;
    _hctx.beginPath(); _hctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2); _hctx.stroke();
    if (rg.r > 24) {
      _hctx.setLineDash([3, 9]);
      _hctx.globalAlpha = rg.alpha * 0.35;
      _hctx.beginPath(); _hctx.arc(rg.x, rg.y, rg.r * 0.5, 0, Math.PI * 2); _hctx.stroke();
      _hctx.setLineDash([]);
    }
    _hctx.restore();
  }

  // ── targeting reticle around hovered / selected node
  const targetId = STATE.selectedId || (STATE.hoveredMesh && STATE.hoveredMesh.userData.id);
  if (targetId) {
    const grp = groupById[targetId];
    const nd  = nodeData[targetId];
    const pos = grp ? _toHUD(grp) : null;
    if (pos && nd) {
      const hex     = nd.hex;
      const isLocked = !!STATE.selectedId;
      const R        = isLocked ? 32 : 26;
      const BRACKET  = Math.PI * 0.38;
      const spin     = isLocked ? T * 0.5 : T * 1.1;

      _hctx.save();
      _hctx.strokeStyle = hex;
      _hctx.lineWidth   = isLocked ? 1.6 : 1.1;
      _hctx.globalAlpha = isLocked ? 0.92 : 0.5;

      // Four rotating arc brackets
      for (let q = 0; q < 4; q++) {
        const a = q * Math.PI / 2 + spin;
        _hctx.beginPath();
        _hctx.arc(pos.x, pos.y, R, a, a + BRACKET);
        _hctx.stroke();
      }

      // Cardinal tick marks
      _hctx.globalAlpha = isLocked ? 0.45 : 0.2;
      _hctx.lineWidth   = 0.8;
      [-1, 1].forEach(s => {
        _hctx.beginPath(); _hctx.moveTo(pos.x + s * (R + 5), pos.y); _hctx.lineTo(pos.x + s * (R + 16), pos.y); _hctx.stroke();
        _hctx.beginPath(); _hctx.moveTo(pos.x, pos.y + s * (R + 5)); _hctx.lineTo(pos.x, pos.y + s * (R + 16)); _hctx.stroke();
      });

      // Data readout label (only when locked on)
      if (isLocked) {
        _hctx.globalAlpha = 0.75;
        _hctx.font        = '9px "JetBrains Mono", monospace';
        _hctx.fillStyle   = hex;
        _hctx.textAlign   = 'left';
        _hctx.fillText(`[ ${nd.data.name.toUpperCase()} ]`, pos.x + R + 20, pos.y - 9);
        _hctx.globalAlpha = 0.4;
        _hctx.font        = '8px "JetBrains Mono", monospace';
        _hctx.fillStyle   = '#94A3B8';
        const sub = (nd.data.type || nd.data.sub || '').toUpperCase();
        _hctx.fillText(sub, pos.x + R + 20, pos.y + 5);
        if (nd.data.uc) {
          _hctx.globalAlpha = 0.3;
          _hctx.fillText(`${nd.data.uc.length} USE CASES`, pos.x + R + 20, pos.y + 18);
        }
      }
      _hctx.restore();
    }
  }

  // ── corner HUD brackets (always visible)
  const BL = 22, BP = 15;
  const pulse = 0.18 + Math.sin(T * 1.15) * 0.07;
  _hctx.save();
  _hctx.strokeStyle = '#3B82F6';
  _hctx.lineWidth   = 1.1;
  _hctx.globalAlpha = pulse;
  const corners = [
    [[BP, BP + BL], [BP, BP], [BP + BL, BP]],
    [[w - BP - BL, BP], [w - BP, BP], [w - BP, BP + BL]],
    [[BP, h - BP - BL], [BP, h - BP], [BP + BL, h - BP]],
    [[w - BP - BL, h - BP], [w - BP, h - BP], [w - BP, h - BP - BL]],
  ];
  corners.forEach(pts => {
    _hctx.beginPath();
    pts.forEach(([x, y], i) => i === 0 ? _hctx.moveTo(x, y) : _hctx.lineTo(x, y));
    _hctx.stroke();
  });
  _hctx.restore();

  // ── slow horizontal scan beam
  const scanY = (Math.sin(T * 0.22) * 0.5 + 0.5) * h;
  const sg = _hctx.createLinearGradient(0, scanY - 2, 0, scanY + 3);
  sg.addColorStop(0,   'rgba(59,130,246,0)');
  sg.addColorStop(0.5, 'rgba(59,130,246,0.055)');
  sg.addColorStop(1,   'rgba(59,130,246,0)');
  _hctx.fillStyle = sg;
  _hctx.fillRect(0, scanY - 2, w, 5);

  // ── connection data readouts (small moving labels on pipes)
  // One floating "packet" label per active source when filter is set
  if (STATE.activeFilter !== 'all' || STATE.selectedId) {
    _hctx.font        = '7px "JetBrains Mono", monospace';
    _hctx.textAlign   = 'center';
    _hctx.fillStyle   = '#3B82F6';
    _hctx.globalAlpha = 0.35;
    // (visual accent only — no need for precise pipe following here)
  }
}

// Detect hover change → play hover sound
function _checkHover() {
  const id = STATE.hoveredMesh ? STATE.hoveredMesh.userData.id : null;
  if (id !== _lastHoverId) {
    if (id) SFX.hover();
    _lastHoverId = id;
  }
}

// Independent HUD render loop
(function _hudLoop() {
  requestAnimationFrame(_hudLoop);
  _checkHover();
  _drawHUD();
})();

// ── 4. Sound hooks via DOM event listeners ────────────────
// Click on canvas — detect hit and fire select/deselect sound + scan ring
renderer.domElement.addEventListener('click', e => {
  const rect = mount.getBoundingClientRect();
  const mv   = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  ray.setFromCamera(mv, camera);
  const hits = ray.intersectObjects(clickables);
  if (hits.length) {
    const id  = hits[0].object.userData.id;
    const nd  = nodeData[id];
    const grp = groupById[id];
    SFX.select();
    _speakNode(id);
    // Fire scan ring at node screen position after brief delay
    setTimeout(() => {
      const pos = grp ? _toHUD(grp) : null;
      if (pos) _fireRing(pos.x, pos.y, nd ? nd.hex : '#3B82F6');
    }, 60);
  } else {
    SFX.deselect();
  }
});

// Filter buttons
document.querySelectorAll('.fb').forEach(btn =>
  btn.addEventListener('click', SFX.filter)
);

// Panel open/close observer → typewriter + sound
const _panel = document.getElementById('panel');
let _panelOpen = false;
new MutationObserver(() => {
  const open = _panel.classList.contains('open');
  if (open && !_panelOpen) {
    _panelOpen = true;
    SFX.panel();
    setTimeout(_typewritePanel, 90);
  } else if (!open) {
    _panelOpen = false;
  }
}).observe(_panel, { attributes: true });

// UCD modal open observer → sound
const _ucd = document.getElementById('ucd');
let _ucdOpen = false;
new MutationObserver(() => {
  const open = _ucd.classList.contains('show');
  if (open && !_ucdOpen) { _ucdOpen = true; SFX.ucdOpen(); }
  else if (!open) { _ucdOpen = false; }
}).observe(_ucd, { attributes: true });

// ── 5. Typewriter effect ──────────────────────────────────
function _typewrite(el, fullText, msPerChar = 16) {
  if (!el || !fullText) return;
  const orig = el.textContent;
  el.textContent = '';
  let i = 0;
  function tick() {
    if (i < fullText.length) {
      el.textContent += fullText[i++];
      setTimeout(tick, msPerChar);
    }
  }
  tick();
}

function _typewritePanel() {
  const pName = document.getElementById('pName');
  const pDesc = document.getElementById('pDesc');
  const pType = document.getElementById('pType');
  if (pName && pName.textContent) _typewrite(pName, pName.textContent, 20);
  if (pType && pType.textContent) _typewrite(pType, pType.textContent, 12);
  if (pDesc && pDesc.textContent) _typewrite(pDesc, pDesc.textContent, 7);
}

// ── 6. Voice readout ──────────────────────────────────────
//
//  PRIMARY:  ElevenLabs neural TTS  (deep, JARVIS-quality)
//  FALLBACK: Web Speech API         (browser built-in)
//
//  To enable ElevenLabs:
//    1. Get a free API key at https://elevenlabs.io
//    2. Replace the empty string below with your key
//
const ELEVENLABS_API_KEY  = '';          // ← paste your key here
const ELEVENLABS_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam — deep, authoritative
// Other great JARVIS voices:
//   Josh   TxGEqnHWrfWFTfGW9XjX  (crisp, measured)
//   Arnold VR6AewLTigWG4xSOukaG  (strong, commanding)
//   Antoni ErXwobaYiN019PkySvjV  (smooth, professional)

// ElevenLabs model — eleven_multilingual_v2 is best quality,
// eleven_turbo_v2 is faster with near-identical quality at low latency
const ELEVENLABS_MODEL    = 'eleven_turbo_v2';

// ── Web Speech API fallback ───────────────────────────────
const _synth  = window.speechSynthesis || null;
let   _voices = [];
if (_synth) {
  _synth.addEventListener('voiceschanged', () => { _voices = _synth.getVoices(); });
  setTimeout(() => { _voices = _synth.getVoices(); }, 300);
}

// Active ElevenLabs source node (so we can stop mid-sentence)
let _elSrc = null;

// Audio processing chain — makes ElevenLabs audio feel like
// a JARVIS helmet comm: high-shelf presence boost + light room reverb
function _buildVoiceChain(buffer) {
  if (!_ac) return null;

  // Decode returns a buffer; wire: src → highShelf → room → masterGain → out
  const src = _ac.createBufferSource();
  src.buffer = buffer;

  // 4 kHz presence lift (+3 dB) — adds clarity and "suit comm" quality
  const shelf = _ac.createBiquadFilter();
  shelf.type            = 'highShelf';
  shelf.frequency.value = 4000;
  shelf.gain.value      = 3;

  // Very short convolution reverb using a programmatically generated
  // impulse response (no audio files needed)
  const reverbBuf = _buildIR(0.35, 0.4);
  const reverb    = _ac.createConvolver();
  reverb.buffer   = reverbBuf;
  const dryGain   = _ac.createGain();  dryGain.gain.value  = 0.82;
  const wetGain   = _ac.createGain();  wetGain.gain.value  = 0.18;
  const masterGain = _ac.createGain(); masterGain.gain.value = 0.78;

  src.connect(shelf);
  shelf.connect(dryGain);   dryGain.connect(masterGain);
  shelf.connect(reverb);    reverb.connect(wetGain);    wetGain.connect(masterGain);
  masterGain.connect(_ac.destination);

  return src;
}

// Generates a short stereo room IR (exponentially decaying noise)
function _buildIR(duration, decay) {
  if (!_ac) return null;
  const rate    = _ac.sampleRate;
  const len     = Math.floor(rate * duration);
  const ir      = _ac.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay * 8);
    }
  }
  return ir;
}

// ElevenLabs fetch → decode → play
async function _speakElevenLabs(text) {
  if (!text || !ELEVENLABS_API_KEY) return false;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key':    ELEVENLABS_API_KEY,
          'Content-Type':  'application/json',
          'Accept':        'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: ELEVENLABS_MODEL,
          voice_settings: {
            stability:        0.55,  // slight variation = less robotic
            similarity_boost: 0.82,
            style:            0.25,  // subtle expressiveness
            use_speaker_boost: true,
          },
        }),
      }
    );
    if (!res.ok) { console.warn('[JARVIS] ElevenLabs error:', res.status); return false; }

    const arrayBuf = await res.arrayBuffer();
    if (!_ac) return false;

    // Resume AudioContext if suspended (browser policy)
    if (_ac.state === 'suspended') await _ac.resume();

    const decoded = await _ac.decodeAudioData(arrayBuf);

    // Stop any currently playing voice line
    if (_elSrc) { try { _elSrc.stop(); } catch (_) {} }

    _elSrc = _buildVoiceChain(decoded);
    if (_elSrc) _elSrc.start();
    return true;
  } catch (err) {
    console.warn('[JARVIS] ElevenLabs failed, falling back to browser TTS:', err.message);
    return false;
  }
}

// Web Speech API fallback
function _speakBrowser(text) {
  if (!_synth || !text) return;
  _synth.cancel();
  const utt  = new SpeechSynthesisUtterance(text);
  utt.rate   = 1.05;
  utt.pitch  = 0.78;
  utt.volume = 0.65;
  const PREF = ['Google UK English Male', 'Microsoft David', 'Daniel', 'Alex', 'Fred'];
  const pick = _voices.find(v => PREF.some(p => v.name.includes(p)));
  if (pick) utt.voice = pick;
  _synth.speak(utt);
}

// Main speak entry point — tries ElevenLabs first, falls back to browser
async function _speakText(text) {
  if (!text) return;
  if (ELEVENLABS_API_KEY) {
    const ok = await _speakElevenLabs(text);
    if (ok) return;
  }
  _speakBrowser(text);
}

function _speakNode(id) {
  const nd = nodeData[id]; if (!nd) return;
  const d = nd.data;
  const parts = [d.name];
  if (d.type || d.sub) parts.push(d.type || d.sub);
  if (d.uc) parts.push(`${d.uc.length} use cases`);
  _speakText(parts.join('. '));
}

// ── 7. Startup sequence ───────────────────────────────────
let _startupFired = false;
function _tryStartup() {
  if (_startupFired) return;
  if (!_ac || _ac.state === 'suspended') return;
  _startupFired = true;
  SFX.startup();
  setTimeout(() => _speakText('COCO data platform online.'), 700);
}

// Watch for loader fade-out
const _loader = document.getElementById('loader');
if (_loader) {
  new MutationObserver(() => {
    if (_loader.classList.contains('out')) _tryStartup();
  }).observe(_loader, { attributes: true });
}
// Fallback: also try on first click (in case loader already gone)
document.addEventListener('click', () => setTimeout(_tryStartup, 80), { once: true });

// ── 8. Status overlay (top-left system readout) ───────────
(function injectStatusBar() {
  const bar = document.createElement('div');
  bar.id    = 'jarvis-status';
  bar.style.cssText = [
    'position:fixed', 'top:92px', 'left:16px',
    'font-family:"JetBrains Mono",monospace',
    'font-size:7px', 'color:rgba(59,130,246,0.35)',
    'letter-spacing:0.1em', 'pointer-events:none',
    'z-index:199', 'line-height:1.8',
  ].join(';');

  const lines = [
    `SYS · COCO DATA PLATFORM`,
    `CONNECTORS · ${SOURCES.length} SOURCE  ${OUTPUTS.length} OUTPUT`,
    `USE CASES  · ${ALL_UCS.length}`,
    `CORE       · DB · API · AI`,
  ];
  bar.innerHTML = lines.join('<br>');
  document.body.appendChild(bar);

  // Fade it in after loader exits
  bar.style.opacity = '0';
  bar.style.transition = 'opacity 1s';
  const _obs = new MutationObserver(() => {
    if (document.getElementById('loader').classList.contains('out')) {
      setTimeout(() => bar.style.opacity = '1', 1000);
      _obs.disconnect();
    }
  });
  _obs.observe(document.getElementById('loader'), { attributes: true });
})();
