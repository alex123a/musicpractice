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

  // ── String mode: ensemble detuning + vibrato + subtle fifth (old Orchestra) ──
  function buildStringDrone(freq) {
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

  // ── Symphonic mode: rich orchestral with deep cello + horn resonance ────────
  function buildSymphonicDrone(freq) {
    masterGain = audioCtx.createGain();

    // Deep warm base with enhanced bass resonance
    const lpf = audioCtx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 4500; // Slightly brighter for clarity
    lpf.Q.value = 0.6;

    const shelf = audioCtx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 2000;
    shelf.gain.value = -5; // Enhanced bass warmth

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

    // Rich harmonic series with ENHANCED BASS: more sub-octaves + lower fundamentals
    const harmonics = [
      [0.25, 0.10, 3 ],  // deep cello resonance (2 octaves below)
      [0.5,  0.16, 4 ],  // cello/horn sub-octave — strong body
      [1,    0.42, 8 ],  // fundamental with wide ensemble spread
      [2,    0.22, 7 ],  // octave (slightly louder)
      [3,    0.14, 9 ],  // fifth above octave (bright)
      [4,    0.09, 6 ],  // two octaves (slightly louder)
      [5,    0.06, 7 ],  // major third (brighter)
      [6,    0.04, 5 ],  // 6th harmonic
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
    masterGain.gain.linearRampToValueAtTime(0.40, audioCtx.currentTime + 0.35);
  }

  // ── Meditative mode: ethereal ambient synth with evolving modulation ────────
  function buildMeditativeDrone(freq) {
    masterGain = audioCtx.createGain();

    // === EVOLVING MODULATION ===
    // Very slow LFO for filter sweep (creates evolving character)
    const filterLFO = audioCtx.createOscillator();
    const filterLFOGain = audioCtx.createGain();
    filterLFO.type = 'sine';
    filterLFO.frequency.value = 0.25; // Ultra slow: 4-second cycle
    filterLFOGain.gain.value = 900;   // Modulate filter ±900 Hz for subtle movement
    filterLFO.connect(filterLFOGain);
    filterLFO.start();
    droneNodes.push(filterLFO, filterLFOGain);

    // Very slow amplitude breathing (separate from filter sweep)
    const ampLFO = audioCtx.createOscillator();
    const ampLFOGain = audioCtx.createGain();
    ampLFO.type = 'sine';
    ampLFO.frequency.value = 0.35; // Slightly faster breathing: ~3 seconds
    ampLFOGain.gain.value = 0.12;   // Gentle volume swell (±12%)
    ampLFO.connect(ampLFOGain);
    ampLFO.start();
    droneNodes.push(ampLFO, ampLFOGain);

    // === THREE HARMONIC "CLOUDS" WITH INDEPENDENT FILTERS ===
    // Cloud 1: Warm fundamental layer
    const filter1 = audioCtx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.value = 2500;
    filter1.Q.value = 0.7;
    filterLFOGain.connect(filter1.frequency);

    // Cloud 2: Bright middle layer
    const filter2 = audioCtx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.value = 3800;
    filter2.Q.value = 0.6;
    filterLFOGain.connect(filter2.frequency);

    // Cloud 3: Ethereal upper layer
    const filter3 = audioCtx.createBiquadFilter();
    filter3.type = 'lowpass';
    filter3.frequency.value = 5000;
    filter3.Q.value = 0.5;
    filterLFOGain.connect(filter3.frequency);

    // === SPACIOUS REVERB ===
    const reverbDelay = audioCtx.createDelay(2.0);
    const reverbGain = audioCtx.createGain();
    reverbDelay.delayTime.value = 0.35; // Long, spacious reverb tail
    reverbGain.gain.value = 0.45;       // Wet reverb level

    // === MAIN MIXER ===
    const wetMix = audioCtx.createGain();
    wetMix.gain.value = 0.5; // 50% wet reverb

    const dryMix = audioCtx.createGain();
    dryMix.gain.value = 0.5; // 50% dry direct

    // Route filters to reverb and dry mix
    filter1.connect(reverbDelay);
    filter2.connect(reverbDelay);
    filter3.connect(reverbDelay);

    reverbDelay.connect(reverbGain);
    reverbGain.connect(audioCtx.destination);

    filter1.connect(audioCtx.destination);
    filter2.connect(audioCtx.destination);
    filter3.connect(audioCtx.destination);

    // Main gain with amplitude LFO applied
    ampLFOGain.connect(masterGain.gain);

    // Route everything through master
    masterGain.connect(filter1);
    masterGain.connect(filter2);
    masterGain.connect(filter3);

    // === CREATE DETUNED CLOUDS FOR SHIMMERING EFFECT ===
    function addCloud(baseFreq, numOscs = 3, spreadCents = 25) {
      for (let i = 0; i < numOscs; i++) {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        // Spread oscillators around the base frequency for chorus/shimmer
        const detune = (i - (numOscs - 1) / 2) * (spreadCents / numOscs);
        osc.detune.value = detune;
        osc.frequency.value = baseFreq;
        g.gain.value = 0.6 / numOscs; // Balance total level
        osc.connect(g);
        g.connect(masterGain);
        osc.start();
        droneNodes.push(osc, g);
      }
    }

    // Cloud 1: Deep fundamental (warm, grounded)
    addCloud(freq * 0.5, 3, 20);   // Sub-octave cloud
    addCloud(freq * 1.0, 4, 25);   // Fundamental cloud (widest spread for shimmer)

    // Cloud 2: Octave (bright, clear)
    addCloud(freq * 2.0, 3, 22);

    // Cloud 3: Upper partial (ethereal, floating) — slightly detuned for shimmer
    addCloud(freq * 3.0, 3, 20);

    // === VERY SLOW ATTACK FOR FLOATING ENTRY ===
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 1.2); // 1.2 second fade-in

    droneNodes.push(filter1, filter2, filter3, reverbDelay, reverbGain);
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
