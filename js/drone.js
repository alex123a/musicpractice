const DroneModule = (() => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_OFFSETS = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
  const FIFTH_RATIO = Math.pow(2, 7 / 12); // perfect fifth above

  let audioCtx    = null;
  let droneNodes  = [];
  let masterGain  = null;
  let isPlaying   = false;
  let droneMode   = 'symphonic'; // 'string' | 'symphonic' | 'meditative'
  let currentNote = 'A';
  let currentAStandard = CONFIG.defaultAStandard;

  function getFrequency(note, aStandard) {
    return aStandard * Math.pow(2, NOTE_OFFSETS[note] / 12);
  }

  // ── String mode: solo string instrument with natural vibrato ───────────────
  function buildStringDrone(freq) {
    masterGain = audioCtx.createGain();

    // Warm, woody low-pass filter
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.Q.value = 0.8;
    masterGain.connect(filter);
    filter.connect(audioCtx.destination);
    droneNodes.push(filter);

    // Natural vibrato (like a violinist's bow vibrato at 5.5 Hz)
    const vibrato = audioCtx.createOscillator();
    const vibratoGain = audioCtx.createGain();
    vibrato.type = 'sine';
    vibrato.frequency.value = 5.5;
    vibratoGain.gain.value = 8; // ±8 cents
    vibrato.connect(vibratoGain);
    vibrato.start();
    droneNodes.push(vibrato, vibratoGain);

    // Build harmonics with vibrato
    [
      [1, 0.55, 0],      // fundamental - strong
      [2, 0.20, 0.5],    // octave - slightly detuned for richness
      [3, 0.12, -0.5],   // fifth - opposite detune
    ].forEach(([mult, gain, detune]) => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      osc.detune.value = detune;
      g.gain.value = gain;
      vibratoGain.connect(osc.detune);
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
      droneNodes.push(osc, g);
    });

    // Slow attack (150ms) like bowing
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.15);
  }

  // ── Symphonic mode: full ensemble with warm base + bright harmonics ────────
  function buildSymphonicDrone(freq) {
    masterGain = audioCtx.createGain();

    // Warm base with subtle high-end cut
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 4200; // Brighter than string but still warm
    lpf.Q.value = 0.5;

    const shelf = audioCtx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 2000;
    shelf.gain.value = -4; // Warm bass emphasis

    masterGain.connect(lpf);
    lpf.connect(shelf);
    shelf.connect(audioCtx.destination);
    droneNodes.push(lpf, shelf);

    // Subtle vibrato (5.5 Hz, ±6 cents)
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 5.5;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain);
    lfo.start();
    droneNodes.push(lfo, lfoGain);

    // Rich harmonic series with ensemble spread
    const harmonics = [
      [1,    0.40, 8 ],  // fundamental with wide spread
      [2,    0.20, 7 ],  // octave
      [3,    0.13, 9 ],  // fifth above octave (bright)
      [4,    0.08, 6 ],  // two octaves
      [5,    0.05, 7 ],  // major third (bright)
      [6,    0.03, 5 ],  // 6th harmonic
      [0.5,  0.08, 4 ],  // sub-octave for body
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

    // Slow bow-like attack (350ms) for symphonic ensemble feel
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.38, audioCtx.currentTime + 0.35);
  }

  // ── Meditative mode: enhanced bagpipe with deeper resonance + clearer fifth ──
  function buildMeditativeDrone(freq) {
    masterGain = audioCtx.createGain();

    // Bright low-pass for clarity
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 3500;
    lpf.Q.value = 0.6;

    masterGain.connect(lpf);
    lpf.connect(audioCtx.destination);
    droneNodes.push(lpf);

    // Slow meditative tremolo (1.5 Hz) with subtle depth for deep breathing
    const tremolo = audioCtx.createOscillator();
    const tremoloGain = audioCtx.createGain();
    const tremoloDepth = audioCtx.createGain();
    tremolo.type = 'sine';
    tremolo.frequency.value = 1.5; // Much slower for meditative feel
    tremoloGain.gain.value = 1;
    tremoloDepth.gain.value = 0.04; // Subtle amplitude variation
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

    // Deep sub-octave resonance for meditative grounding
    addPipe(freq * 0.25, 0.08); // Two octaves below for resonance

    // Root note foundation
    addPipe(freq * 0.5, 0.18);  // Sub-octave (deeper)
    addPipe(freq * 1.0, 0.42);  // Fundamental
    addPipe(freq * 2.0, 0.13);  // Octave

    // PROMINENT FIFTH — much clearer and louder
    const fifth = freq * FIFTH_RATIO;
    addPipe(fifth * 0.5, 0.16);  // Fifth sub-octave
    addPipe(fifth * 1.0, 0.60);  // Fifth unison — VERY LOUD (was 0.48)
    addPipe(fifth * 2.0, 0.18);  // Fifth octave — BOLDER

    // Upper harmonics for reedy character
    addPipe(freq * 3.0, 0.09);   // Third harmonic
    addPipe(freq * 5.0, 0.06);   // Fifth harmonic

    // Strong but grounded presence
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.45, audioCtx.currentTime + 0.06);
  }

  // ── Core controls ─────────────────────────────────────────────────────────
  function buildDrone(freq) {
    if (droneMode === 'symphonic') buildSymphonicDrone(freq);
    else if (droneMode === 'meditative') buildMeditativeDrone(freq);
    else buildStringDrone(freq);
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
      el.textContent = `${freq} Hz · A=${currentAStandard} · ${{ string: 'String', symphonic: 'Symphonic', meditative: 'Meditative' }[droneMode]}`;
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
            <button class="pill drone-mode-pill${droneMode === 'string' ? ' active' : ''}"
                    data-mode="string" onclick="DroneModule.setMode('string')">String</button>
            <button class="pill drone-mode-pill${droneMode === 'symphonic' ? ' active' : ''}"
                    data-mode="symphonic" onclick="DroneModule.setMode('symphonic')">Symphonic ✦</button>
            <button class="pill drone-mode-pill${droneMode === 'meditative' ? ' active' : ''}"
                    data-mode="meditative" onclick="DroneModule.setMode('meditative')">Meditative ♜</button>
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
        <div class="mini-info">${freq} Hz · A=${currentAStandard} · ${{ string: 'String', symphonic: 'Symphonic', meditative: 'Meditative' }[droneMode]}</div>
        <button class="btn-secondary btn-sm mini-play-btn drone-play-btn${isPlaying ? ' playing' : ''}"
                onclick="DroneModule.toggle()">
          ${isPlaying ? '■ Stop' : '▶ Play'}
        </button>
      </div>`;
  }

  function buildDroneModeHTML() {
    const modes = [
      { id: 'string', label: 'String' },
      { id: 'symphonic', label: 'Symphonic ✦' },
      { id: 'meditative', label: 'Meditative ♜' }
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
