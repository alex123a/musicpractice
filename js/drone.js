const DroneModule = (() => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // Semitone offsets from A4 (octave 4)
  const NOTE_OFFSETS = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };

  let audioCtx = null;
  let droneNodes = [];  // all active oscillators/nodes for cleanup
  let masterGain = null;
  let isPlaying = false;
  let currentNote = 'A';
  let currentAStandard = CONFIG.defaultAStandard;

  function getFrequency(note, aStandard) {
    return aStandard * Math.pow(2, NOTE_OFFSETS[note] / 12);
  }

  // Build a rich drone: fundamental + 4 harmonics + slight stereo detune
  function buildDrone(freq) {
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(audioCtx.destination);

    // Each harmonic: [multiplier, relative gain, detune cents]
    const harmonics = [
      [1,    0.50,  0],     // fundamental
      [2,    0.20,  1.5],   // octave
      [3,    0.12,  0],     // fifth above octave
      [4,    0.08, -1.5],   // two octaves
      [5,    0.05,  0],     // major third above that
      [0.5,  0.06,  0],     // sub-octave for warmth
    ];

    harmonics.forEach(([mult, gain, detuneCents]) => {
      const osc = audioCtx.createOscillator();
      const g   = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      osc.detune.value = detuneCents;
      g.gain.value = gain;
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
      droneNodes.push(osc, g);
    });

    // Gentle low-pass filter to remove harshness
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq * 6;
    filter.Q.value = 0.7;
    masterGain.disconnect();
    masterGain.connect(filter);
    filter.connect(audioCtx.destination);
    droneNodes.push(filter);

    // Fade in over 80ms to avoid click
    masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.08);
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
    if (masterGain) {
      // Fade out over 80ms to avoid click
      masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.08);
    }
    setTimeout(() => {
      droneNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch(e){} });
      droneNodes = [];
      masterGain = null;
    }, 100);
  }

  function stop() {
    stopNodes();
    isPlaying = false;
    refreshPlayButtons();
  }

  function setNote(note) {
    currentNote = note;
    if (isPlaying) { stop(); setTimeout(start, 120); }  // restart with new freq
    refreshNoteSelectors();
    refreshYouTubeEmbed();
  }

  function setAStandard(hz) {
    currentAStandard = hz;
    if (isPlaying) { stop(); setTimeout(start, 120); }  // restart with new tuning
    refreshAStandardLabels();
  }

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
    document.querySelectorAll('.a-standard-val').forEach(el => {
      el.textContent = currentAStandard;
    });
    document.querySelectorAll('.a-standard-slider').forEach(el => {
      el.value = currentAStandard;
    });
  }

  function refreshYouTubeEmbed() {
    document.querySelectorAll('.drone-yt-embed').forEach(wrap => {
      const videoId = getDroneVideoId(currentNote);
      if (wrap.closest('details').open) {
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

  function buildFullHTML() {
    const notePills = NOTES.map(n =>
      `<button class="note-pill${n === currentNote ? ' active' : ''}" data-note="${n}" onclick="DroneModule.setNote('${n}')">${n}</button>`
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
        <div class="mini-info">${freq} Hz · A=${currentAStandard}</div>
        <button class="btn-secondary btn-sm mini-play-btn drone-play-btn${isPlaying ? ' playing' : ''}"
                onclick="DroneModule.toggle()">
          ${isPlaying ? '■ Stop' : '▶ Play'}
        </button>
      </div>`;
  }

  function render(container) {
    container.innerHTML = buildFullHTML();
  }

  function renderMini(container) {
    container.innerHTML = buildMiniHTML();
  }

  function toggle() {
    if (isPlaying) stop(); else start();
  }

  function onYtToggle(details) {
    const embed = details.querySelector('.drone-yt-embed');
    if (details.open) {
      const videoId = getDroneVideoId(currentNote);
      embed.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?rel=0" allowfullscreen></iframe>`;
    } else {
      embed.innerHTML = '';
    }
  }

  return { render, renderMini, toggle, start, stop, setNote, setAStandard, onYtToggle, isPlaying: () => isPlaying };
})();
