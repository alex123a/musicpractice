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

  // ── Bagpipe mode: bold with prominent fifth and reedy texture ─────────────
  function buildBagpipeDrone(freq) {
    masterGain = audioCtx.createGain();

    // Brighter low-pass for reedy character — not as warm as organ
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 3500;  // Brighter than organ's 2200 Hz
    lpf.Q.value = 0.6;

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
    tremoloDepth.gain.value = 0.06;     // ±6% amplitude swell (deeper breath)
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

    // Root note — foundation (adjusted for prominent fifth)
    addPipe(freq * 0.5, 0.15);  // Sub-octave — the "deep" quality
    addPipe(freq * 1.0, 0.42);  // Fundamental (reduced to let fifth stand out)
    addPipe(freq * 2.0, 0.12);  // Octave

    // Perfect fifth (e.g. G above C) — PROMINENT, the defining feature of bagpipe
    const fifth = freq * FIFTH_RATIO;
    addPipe(fifth * 0.5, 0.14); // fifth in sub octave for depth
    addPipe(fifth * 1.0, 0.48); // fifth at unison — CLEARLY HEARD (was 0.38 in organ)
    addPipe(fifth * 2.0, 0.16); // fifth octave above — BOLDER (was 0.10 in organ)

    // Upper harmonics for reedy/buzzy character
    addPipe(freq * 3.0, 0.08); // Third harmonic (adds body)
    addPipe(freq * 5.0, 0.06); // Fifth harmonic partial (brightness)

    // Bagpipe speaks immediately with presence
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.45, audioCtx.currentTime + 0.06);  // Bolder amplitude
  }

  // ── Core controls ─────────────────────────────────────────────────────────
  function buildDrone(freq) {
    if (droneMode === 'orchestra') buildOrchestralDrone(freq);
    else if (droneMode === 'bagpipe') buildBagpipeDrone(freq);
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
    // Refresh pills on Screen 4 if visible
    const s4Pills = document.getElementById('drone-mode-pills');
    if (s4Pills) s4Pills.innerHTML = buildDroneModeHTML();
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
    // Keep any rendered mini displays in sync
    const freq = getFrequency(currentNote, currentAStandard).toFixed(1);
    document.querySelectorAll('.mini-note-display').forEach(el => el.textContent = currentNote);
    document.querySelectorAll('.mini-info').forEach(el => {
      el.textContent = `${freq} Hz · A=${currentAStandard} · ${{ pure: 'Pure', orchestra: 'Orchestra', organ: 'Organ' }[droneMode]}`;
    });
  }

  function renderNotePicker(container) {
    if (!container) return;
    const pills = NOTES.map(n =>
      `<button class="note-pill${n === currentNote ? ' active' : ''}" data-note="${n}"
               onclick="DroneModule.setNote('${n}')">${n}</button>`
    ).join('');
    container.innerHTML = `<div class="note-pills">${pills}</div>`;
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
            <button class="pill drone-mode-pill${droneMode === 'bagpipe' ? ' active' : ''}"
                    data-mode="bagpipe" onclick="DroneModule.setMode('bagpipe')">Bagpipe ♜</button>
          </div>
        </div>
        <button class="drone-play-btn${isPlaying ? ' playing' : ''}" onclick="DroneModule.toggle()">
          ${isPlaying ? '■ Stop drone' : '▶ Play drone'}
        </button>
      </div>`;
  }

  function buildMiniHTML() {
    const freq = getFrequency(currentNote, currentAStandard).toFixed(1);
    return `
      <div class="mini-drone-row">
        <div class="mini-note-display">${currentNote}</div>
        <div class="mini-info">${freq} Hz · A=${currentAStandard} · ${{ pure: 'Pure', orchestra: 'Orchestra', bagpipe: 'Bagpipe' }[droneMode]}</div>
        <button class="btn-secondary btn-sm mini-play-btn drone-play-btn${isPlaying ? ' playing' : ''}"
                onclick="DroneModule.toggle()">
          ${isPlaying ? '■ Stop' : '▶ Play'}
        </button>
      </div>`;
  }

  function buildDroneModeHTML() {
    const modes = [
      { id: 'pure', label: 'Pure sine' },
      { id: 'orchestra', label: 'Orchestra ✦' },
      { id: 'bagpipe', label: 'Bagpipe ♜' }
    ];
    return modes.map(m =>
      `<button class="pill${m.id === droneMode ? ' active' : ''}"
               data-mode="${m.id}"
               onclick="DroneModule.setMode('${m.id}')">${m.label}</button>`
    ).join('');
  }

  function render(container)     { container.innerHTML = buildFullHTML(); }
  function renderMini(container) { container.innerHTML = buildMiniHTML(); }

  return { render, renderMini, renderNotePicker, buildDroneModeHTML, toggle, start, stop, setNote, setAStandard, setMode, isPlaying: () => isPlaying };
})();
