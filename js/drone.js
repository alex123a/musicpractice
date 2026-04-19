const DroneModule = (() => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_OFFSETS = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  const FIFTH_RATIO = Math.pow(2, 7 / 12); // perfect fifth above

  let audioCtx    = null;
  let droneNodes  = [];
  let masterGain  = null;
  let isPlaying   = false;
  let droneMode   = 'orchestra'; // 'pure' | 'orchestra'
  let currentNote = 'A';
  let currentAStandard = CONFIG.defaultAStandard;

  function getFrequency(note, aStandard) {
    return aStandard * Math.pow(2, NOTE_OFFSETS[note] / 12);
  }

  // ── Pure mode: single-layer harmonic sine stack ───────────────────────────
  function buildPureDrone(freq) {
    masterGain = audioCtx.createGain();

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq * 6;
    filter.Q.value = 0.7;
    masterGain.connect(filter);
    filter.connect(audioCtx.destination);
    droneNodes.push(filter);

    [
      [1,   0.50,  0   ],
      [2,   0.20,  1.5 ],
      [3,   0.12,  0   ],
      [4,   0.08, -1.5 ],
      [5,   0.05,  0   ],
      [0.5, 0.06,  0   ],
    ].forEach(([mult, gain, detune]) => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      osc.detune.value = detune;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
      droneNodes.push(osc, g);
    });

    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.08);
  }

  // ── Orchestra mode: ensemble detuning + vibrato + fifth ──────────────────
  function buildOrchestralDrone(freq) {
    masterGain = audioCtx.createGain();

    // Warm low-pass + subtle high shelf cut
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 3800;
    lpf.Q.value = 0.5;

    const shelf = audioCtx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 2000;
    shelf.gain.value = -6; // roll off high end for warmth

    masterGain.connect(lpf);
    lpf.connect(shelf);
    shelf.connect(audioCtx.destination);
    droneNodes.push(lpf, shelf);

    // Vibrato LFO — 5.5 Hz, ±6 cents, simulates natural bow variation
    const lfo     = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfo.start();
    droneNodes.push(lfo, lfoGain);

    // Each entry: [freq multiplier, total gain, ensemble spread cents]
    // 3 oscillators per harmonic, spread across ±spread cents
    const harmonics = [
      [1,    0.38, 8 ],  // fundamental — wide ensemble spread
      [2,    0.18, 7 ],  // octave
      [3,    0.11, 9 ],  // fifth above octave
      [4,    0.07, 6 ],  // two octaves
      [5,    0.04, 7 ],  // major third above that
      [6,    0.025,5 ],  // natural 6th harmonic
      [7,    0.015,5 ],  // natural 7th (slightly flat — just tuning flavour)
      [0.5,  0.06, 4 ],  // sub-octave for body
    ];

    harmonics.forEach(([mult, totalGain, spread]) => {
      [-spread, 0, spread].forEach(detune => {
        const osc = audioCtx.createOscillator();
        const g   = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        osc.detune.value = detune;
        g.gain.value = totalGain / 3;
        lfoGain.connect(osc.detune); // vibrato on each oscillator
        osc.connect(g);
        g.connect(masterGain);
        osc.start();
        droneNodes.push(osc, g);
      });
    });

    // Fifth — very subtle, 2 detuned oscillators to keep it soft
    const fifthFreq = freq * FIFTH_RATIO;
    [-5, 5].forEach(detune => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = fifthFreq;
      osc.detune.value = detune;
      g.gain.value = 0.055; // barely audible — felt more than heard
      lfoGain.connect(osc.detune);
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
      droneNodes.push(osc, g);
    });

    // Slow bow-like attack (400ms) for the orchestral feel
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.32, audioCtx.currentTime + 0.4);
  }

  // ── Organ mode: deep meditative, clearly audible fifth ───────────────────
  function buildOrganDrone(freq) {
    masterGain = audioCtx.createGain();

    // Mellow low-pass — organs are warm, not bright
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 2200;
    lpf.Q.value = 0.4;

    masterGain.connect(lpf);
    lpf.connect(audioCtx.destination);
    droneNodes.push(lpf);

    // Very slow tremolo (amplitude modulation at 3 Hz) — meditative breath feel
    const tremolo     = audioCtx.createOscillator();
    const tremoloGain = audioCtx.createGain();
    const tremoloDepth = audioCtx.createGain();
    tremolo.type = 'sine';
    tremolo.frequency.value = 3;
    tremoloGain.gain.value = 1;         // carrier
    tremoloDepth.gain.value = 0.04;     // ±4% amplitude swell
    tremolo.connect(tremoloDepth);
    tremoloDepth.connect(tremoloGain.gain);
    tremolo.start();
    droneNodes.push(tremolo, tremoloGain, tremoloDepth);

    function addPipe(frequency, gain) {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(tremoloGain); // through tremolo
      tremoloGain.connect(masterGain);
      osc.start();
      droneNodes.push(osc, g);
    }

    // Root note — drawbar-style layers (sub, fundamental, octave, 2nd octave)
    addPipe(freq * 0.5, 0.22);  // 16' sub-octave — the "deep" quality
    addPipe(freq * 1.0, 0.48);  // 8'  fundamental
    addPipe(freq * 2.0, 0.16);  // 4'  octave
    addPipe(freq * 4.0, 0.05);  // 2'  two octaves — slight air

    // Perfect fifth (e.g. G above C) — clearly audible, like a 5⅓' organ stop
    const fifth = freq * FIFTH_RATIO;
    addPipe(fifth * 0.5, 0.10); // fifth in sub octave for depth
    addPipe(fifth * 1.0, 0.38); // fifth at unison — clearly heard
    addPipe(fifth * 2.0, 0.10); // fifth octave above

    // Organ speaks immediately, very short 60ms attack
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.38, audioCtx.currentTime + 0.06);
  }

  // ── Core controls ─────────────────────────────────────────────────────────
  function buildDrone(freq) {
    if (droneMode === 'orchestra') buildOrchestralDrone(freq);
    else if (droneMode === 'organ') buildOrganDrone(freq);
    else buildPureDrone(freq);
  }

  function start() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    stopNodes();
    buildDrone(getFrequency(currentNote, currentAStandard));
    isPlaying = true;
    refreshPlayButtons();
  }

  function stopNodes() {
    const oldNodes = droneNodes;
    const oldGain  = masterGain;
    droneNodes = [];
    masterGain = null;

    if (oldGain) {
      oldGain.gain.setValueAtTime(oldGain.gain.value, audioCtx.currentTime);
      oldGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.08);
    }
    setTimeout(() => {
      oldNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch(e){} });
      try { oldGain && oldGain.disconnect(); } catch(e){}
    }, 120);
  }

  function stop() {
    stopNodes();
    isPlaying = false;
    refreshPlayButtons();
  }

  function toggle() { if (isPlaying) stop(); else start(); }

  function setNote(note) {
    currentNote = note;
    refreshNoteSelectors();
    refreshYouTubeEmbed();
    if (isPlaying) { stop(); start(); }
  }

  function setAStandard(hz) {
    currentAStandard = hz;
    if (isPlaying) { stop(); start(); }
    refreshAStandardLabels();
  }

  function setMode(mode) {
    droneMode = mode;
    refreshModeButtons();
    if (isPlaying) { stop(); start(); }
  }

  // ── DOM refresh helpers ───────────────────────────────────────────────────
  function refreshPlayButtons() {
    document.querySelectorAll('.drone-play-btn').forEach(btn => {
      btn.textContent = isPlaying ? '■ Stop drone' : '▶ Play drone';
      btn.classList.toggle('playing', isPlaying);
    });
  }

  function refreshNoteSelectors() {
    document.querySelectorAll('.note-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.note === currentNote);
    });
  }

  function refreshAStandardLabels() {
    document.querySelectorAll('.a-standard-val').forEach(el => el.textContent = currentAStandard);
    document.querySelectorAll('.a-standard-slider').forEach(el => el.value = currentAStandard);
  }

  function refreshModeButtons() {
    document.querySelectorAll('.drone-mode-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.mode === droneMode);
    });
  }

  function refreshYouTubeEmbed() {
    document.querySelectorAll('.drone-yt-embed').forEach(wrap => {
      if (wrap.closest('details').open) {
        const videoId = getDroneVideoId(currentNote);
        wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?rel=0" allowfullscreen></iframe>`;
      } else {
        wrap.innerHTML = '';
      }
    });
  }

  function getDroneVideoId(note) {
    const saved = (() => { try { return JSON.parse(localStorage.getItem('drone_urls') || '{}'); } catch(e) { return {}; } })();
    return saved[note] || CONFIG.droneVideoIds[note] || '';
  }

  // ── HTML builders ─────────────────────────────────────────────────────────
  function buildFullHTML() {
    const notePills = NOTES.map(n =>
      `<button class="note-pill${n === currentNote ? ' active' : ''}" data-note="${n}"
               onclick="DroneModule.setNote('${n}')">${n}</button>`
    ).join('');

    return `
      <div class="drone-tool">
        <div>
          <div class="metro-row-label">Select drone note</div>
          <div class="note-pills">${notePills}</div>
        </div>
        <div class="a-standard-row">
          <label>A = <span class="a-standard-val">${currentAStandard}</span> Hz</label>
          <input type="range" class="a-standard-slider" min="415" max="445" step="1" value="${currentAStandard}"
                 oninput="DroneModule.setAStandard(parseInt(this.value))">
        </div>
        <div>
          <div class="metro-row-label">Tone</div>
          <div class="pill-row">
            <button class="pill drone-mode-pill${droneMode === 'pure' ? ' active' : ''}"
                    data-mode="pure" onclick="DroneModule.setMode('pure')">Pure sine</button>
            <button class="pill drone-mode-pill${droneMode === 'orchestra' ? ' active' : ''}"
                    data-mode="orchestra" onclick="DroneModule.setMode('orchestra')">Orchestra ✦</button>
            <button class="pill drone-mode-pill${droneMode === 'organ' ? ' active' : ''}"
                    data-mode="organ" onclick="DroneModule.setMode('organ')">Organ ♜</button>
          </div>
        </div>
        <button class="drone-play-btn${isPlaying ? ' playing' : ''}" onclick="DroneModule.toggle()">
          ${isPlaying ? '■ Stop drone' : '▶ Play drone'}
        </button>
        <details class="drone-yt-section" ontoggle="DroneModule.onYtToggle(this)">
          <summary>Reference drone video (YouTube)</summary>
          <div class="drone-yt-embed"></div>
        </details>
      </div>`;
  }

  function buildMiniHTML() {
    const freq = getFrequency(currentNote, currentAStandard).toFixed(1);
    return `
      <div class="mini-drone-row">
        <div class="mini-note-display">${currentNote}</div>
        <div class="mini-info">${freq} Hz · A=${currentAStandard} · ${{ pure: 'Pure', orchestra: 'Orchestra', organ: 'Organ' }[droneMode]}</div>
        <button class="btn-secondary btn-sm mini-play-btn drone-play-btn${isPlaying ? ' playing' : ''}"
                onclick="DroneModule.toggle()">
          ${isPlaying ? '■ Stop' : '▶ Play'}
        </button>
      </div>`;
  }

  function render(container)     { container.innerHTML = buildFullHTML(); }
  function renderMini(container) { container.innerHTML = buildMiniHTML(); }

  function onYtToggle(details) {
    const embed = details.querySelector('.drone-yt-embed');
    if (details.open) {
      const videoId = getDroneVideoId(currentNote);
      embed.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?rel=0" allowfullscreen></iframe>`;
    } else {
      embed.innerHTML = '';
    }
  }

  return { render, renderMini, toggle, start, stop, setNote, setAStandard, setMode, onYtToggle, isPlaying: () => isPlaying };
})();
