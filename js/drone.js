const DroneModule = (() => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // Semitone offsets from A4 (octave 4)
  const NOTE_OFFSETS = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };

  let audioCtx = null;
  let oscillator = null;
  let gainNode = null;
  let isPlaying = false;
  let currentNote = 'A';
  let currentAStandard = CONFIG.defaultAStandard;

  function getFrequency(note, aStandard) {
    return aStandard * Math.pow(2, NOTE_OFFSETS[note] / 12);
  }

  function start() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (oscillator) { oscillator.stop(); oscillator = null; }

    oscillator = audioCtx.createOscillator();
    gainNode   = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = getFrequency(currentNote, currentAStandard);
    gainNode.gain.value = 0.45;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    isPlaying = true;
    refreshPlayButtons();
  }

  function stop() {
    if (oscillator) {
      try { oscillator.stop(); } catch (e) {}
      oscillator = null;
    }
    isPlaying = false;
    refreshPlayButtons();
  }

  function setNote(note) {
    currentNote = note;
    if (oscillator) oscillator.frequency.value = getFrequency(note, currentAStandard);
    refreshNoteSelectors();
    refreshYouTubeEmbed();
  }

  function setAStandard(hz) {
    currentAStandard = hz;
    if (oscillator) oscillator.frequency.value = getFrequency(currentNote, currentAStandard);
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
