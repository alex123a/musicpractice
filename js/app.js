// ── State ──────────────────────────────────────────────────────────────────
const state = {
  pieceName       : '',
  mode            : '',          // 'playthrough' | 'excerpt'
  selectedFocus   : '',          // 'pitch' | 'rhythm'
  recordingTime   : 0,
  recordedAudioURL: null,
  audioBlob       : null,        // raw Blob for tagger / IndexedDB
  isRecording     : false,
  mediaRecorder   : null,
  audioChunks     : [],
  timerInterval   : null,
  playbackAudio   : null,
  playbackRAF     : null,
  // Tagging (playthrough mode)
  tags            : [],
  savedSessionId  : null,
  // Excerpt mode — selected tag to work on
  selectedTag     : null,
};

// ── Navigation ─────────────────────────────────────────────────────────────
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  onScreenEnter(screenId);
}

function onScreenEnter(screenId) {
  const name = state.pieceName || 'Your piece';

  if (screenId === 'screen1') {
    setText('s1-piece', name);
  }

  if (screenId === 'screen2') {
    const modeLabel = state.mode === 'excerpt' ? 'Working on excerpt' : 'Playing through entire piece';
    setText('s2-mode-text', modeLabel);
    setText('s2-piece', name);
  }

  if (screenId === 'screen3') {
    setText('s3-piece', name);

    const droneWrap = document.getElementById('drone-tool-container');
    const metroWrap = document.getElementById('metronome-tool-container');

    if (state.selectedFocus === 'pitch') {
      droneWrap.style.display = 'block';
      metroWrap.style.display = 'none';
      DroneModule.render(droneWrap);
    } else {
      droneWrap.style.display = 'none';
      metroWrap.style.display = 'block';
      MetronomeModule.render(metroWrap);
    }

    YouTubeModule.render(
      document.getElementById('yt-search-container'),
      state.pieceName
    );
  }

  if (screenId === 'screen4') {
    const focusLabel = state.selectedFocus === 'pitch' ? 'Focus: Pitch / Intonation' : 'Focus: Pulse / Rhythm';
    setText('s4-focus-label', focusLabel);
    setText('s4-piece', name);
    // Show selected tag context if in excerpt mode
    const tagCtx = document.getElementById('s4-tag-context');
    if (tagCtx) {
      if (state.mode === 'excerpt' && state.selectedTag) {
        tagCtx.style.display = 'block';
        tagCtx.textContent   = `Working on: ${state.selectedTag.label} (${_fmtTime(state.selectedTag.timestamp)})`;
      } else {
        tagCtx.style.display = 'none';
      }
    }
    renderMiniPanel();
  }

  if (screenId === 'screen5') {
    DroneModule.stop();
    MetronomeModule.stop();

    state.tags           = [];
    state.savedSessionId = null;

    const s5body = document.getElementById('s5-body');
    if (!s5body) return;

    if (state.mode === 'playthrough' && state.audioBlob) {
      // Tagger mode
      TaggerModule.init(state);
      TaggerModule.render(s5body, state.audioBlob);
      document.getElementById('s5-eval-section').style.display = 'none';
    } else {
      // Evaluation mode (excerpt / no audio blob)
      TaggerModule.stop();
      s5body.innerHTML = buildS5PlayerHTML();
      attachS5PlayerEvents();
      document.getElementById('s5-eval-section').style.display = 'block';
      // Populate duration label
      const mins = Math.floor(state.recordingTime / 60).toString().padStart(2, '0');
      const secs = (state.recordingTime % 60).toString().padStart(2, '0');
      setText('s5-recording-duration', `Your recording · ${mins}:${secs}`);
      const fill = document.getElementById('s5-progress-fill');
      if (fill) fill.style.width = '0%';
      setText('s5-playback-time', '0:00');
    }
  } else {
    TaggerModule.stop();
    stopS5Playback();
  }

  if (screenId === 'screen-tags') {
    renderTagsScreen();
  }

  if (screenId === 'screen7') {
    // Mark selected tag as practiced if coming from excerpt mode
    if (state.mode === 'excerpt' && state.selectedTag && state.savedSessionId) {
      DB.markTagPracticed(state.savedSessionId, state.selectedTag.id)
        .then(() => renderTagsScreen())  // refresh if visible
        .catch(console.error);
    }
    refreshExcerptBadge();
  }
}

function buildS5PlayerHTML() {
  return `
    <div class="s5-player">
      <div class="s5-player-info">
        <span id="s5-recording-duration">Your recording</span>
        <span id="s5-playback-time" class="s5-playback-time">0:00</span>
      </div>
      <div class="s5-player-controls">
        <button class="s5-play-btn" id="s5-play-btn" onclick="toggleS5Playback()">▶</button>
        <div class="s5-progress-wrap" onclick="seekS5(event)">
          <div class="s5-progress-bar">
            <div class="s5-progress-fill" id="s5-progress-fill"></div>
          </div>
        </div>
        <button class="s5-download-btn" onclick="downloadRecording()" title="Download recording">⬇</button>
      </div>
    </div>`;
}

function attachS5PlayerEvents() { /* click handlers are inline */ }

function renderMiniPanel() {
  const bodyEl = document.getElementById('mini-ref-body');
  if (!bodyEl) return;
  if (state.selectedFocus === 'pitch') {
    DroneModule.renderMini(bodyEl);
  } else {
    MetronomeModule.renderMini(bodyEl);
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _fmtTime(s) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ── Landing page ───────────────────────────────────────────────────────────
function startSession() {
  const input = document.getElementById('piece-name-input');
  const name  = input ? input.value.trim() : '';
  state.pieceName = name || 'Your piece';
  goTo('screen1');
}

function handleLandingKey(e) {
  if (e.key === 'Enter') startSession();
}

// ── Mode & focus ───────────────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  if (mode === 'excerpt') {
    // Check if there are saved tags for this piece
    const normalized = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    DB.getSessionsForPiece(normalized).then(sessions => {
      const allTags = sessions.flatMap(s => s.tags.map(t => ({ ...t, sessionId: s.id, sessionDate: s.date })));
      if (allTags.length > 0) {
        goTo('screen-tags');
      } else {
        goTo('screen2');
      }
    }).catch(() => goTo('screen2'));
  } else {
    goTo('screen2');
  }
}

function selectFocus(focus, el) {
  state.selectedFocus = focus;
  document.querySelectorAll('.focus-item').forEach(f => f.classList.remove('selected'));
  if (el) el.classList.add('selected');
}

function goToReference() {
  if (!state.selectedFocus) {
    alert('Please select a focus area first.');
    return;
  }
  goTo('screen3');
}

// ── Tags screen (excerpt mode) ─────────────────────────────────────────────
async function renderTagsScreen() {
  const container = document.getElementById('tags-screen-body');
  if (!container) return;

  const normalized = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  let sessions;
  try {
    sessions = await DB.getSessionsForPiece(normalized);
  } catch(e) {
    container.innerHTML = '<p>Could not load saved sessions.</p>';
    return;
  }

  const allTags = sessions.flatMap(s =>
    s.tags.map(t => ({ ...t, sessionId: s.id, sessionDate: s.date }))
  ).sort((a, b) => a.timestamp - b.timestamp);

  if (allTags.length === 0) {
    container.innerHTML = '<p style="color:var(--color-text-secondary)">No saved problem sections yet.</p>';
    return;
  }

  const rows = allTags.map(t => `
    <div class="tag-row${t.practiced ? ' practiced' : ''}" data-session="${t.sessionId}" data-tag="${t.id}">
      <div class="tag-row-info">
        <span class="tag-row-time">${_fmtTime(t.timestamp)}</span>
        <span class="tag-row-label">${_esc(t.label)}</span>
        ${t.practiced ? '<span class="tag-practiced-badge">✓ Practiced</span>' : ''}
      </div>
      <div class="tag-row-date">${new Date(t.sessionDate).toLocaleDateString()}</div>
      <button class="btn-secondary btn-sm tag-work-btn"
              onclick="selectTagAndContinue(${t.sessionId}, ${t.id})">
        Work on this →
      </button>
    </div>`).join('');

  container.innerHTML = rows;
}

function selectTagAndContinue(sessionId, tagId) {
  DB.getSessionsForPiece((state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_'))
    .then(sessions => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;
      const tag = session.tags.find(t => t.id === tagId);
      if (!tag) return;
      state.selectedTag     = { ...tag, sessionId };
      state.savedSessionId  = sessionId;
      goTo('screen2');
    }).catch(console.error);
}

function skipTagsScreen() {
  state.selectedTag    = null;
  state.savedSessionId = null;
  goTo('screen2');
}

function _esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Excerpt badge ──────────────────────────────────────────────────────────
function refreshExcerptBadge() {
  const normalized = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (!normalized) return;
  DB.getSessionsForPiece(normalized).then(sessions => {
    const unpracticed = sessions.flatMap(s => s.tags).filter(t => !t.practiced).length;
    const btn = document.getElementById('excerpt-btn');
    if (!btn) return;
    if (unpracticed > 0) {
      btn.innerHTML = `Work on short excerpt <span class="excerpt-badge">${unpracticed}</span>`;
    } else {
      btn.textContent = 'Work on short excerpt';
    }
  }).catch(() => {});
}

// ── Recording ──────────────────────────────────────────────────────────────
function toggleRecording() {
  if (!state.isRecording) startRecording(); else stopRecording();
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
      }
    });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : '';
    const options = { audioBitsPerSecond: 128000, ...(mimeType && { mimeType }) };
    state.mediaRecorder = new MediaRecorder(stream, options);
    state.audioChunks   = [];
    state.recordingTime = 0;

    state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.audioChunks, { type: mimeType || 'audio/webm' });
      state.audioBlob       = blob;
      state.recordedAudioURL = URL.createObjectURL(blob);
      stream.getTracks().forEach(t => t.stop());
    };

    state.mediaRecorder.start();
    state.isRecording = true;

    document.getElementById('recIcon').classList.add('recording');
    document.getElementById('recStatus').textContent = 'Recording…';
    document.getElementById('waveform').style.display = 'flex';

    state.timerInterval = setInterval(() => {
      state.recordingTime++;
      const m = Math.floor(state.recordingTime / 60).toString().padStart(2, '0');
      const s = (state.recordingTime % 60).toString().padStart(2, '0');
      document.getElementById('timer').textContent = `${m}:${s}`;
      animateWaveform();
    }, 1000);
  } catch (err) {
    alert('Microphone access denied. Please allow microphone access to record.');
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  state.isRecording = false;
  clearInterval(state.timerInterval);

  document.getElementById('recIcon').classList.remove('recording');
  document.getElementById('recStatus').textContent = 'Recording complete';
  document.getElementById('playbackControls').style.display = 'flex';
  document.getElementById('analyzeBtn').style.display = 'block';
}

function playRecording() {
  if (state.recordedAudioURL) {
    new Audio(state.recordedAudioURL).play();
  }
}

function toggleS5Playback() {
  if (!state.recordedAudioURL) return;

  if (!state.playbackAudio) {
    state.playbackAudio = new Audio(state.recordedAudioURL);
    state.playbackAudio.onended = () => {
      updatePlayBtn(false);
      cancelAnimationFrame(state.playbackRAF);
      setText('s5-playback-time', '0:00');
      const fill = document.getElementById('s5-progress-fill');
      if (fill) fill.style.width = '0%';
      state.playbackAudio = null;
    };
  }

  if (state.playbackAudio.paused) {
    state.playbackAudio.play();
    updatePlayBtn(true);
    tickPlayback();
  } else {
    state.playbackAudio.pause();
    updatePlayBtn(false);
    cancelAnimationFrame(state.playbackRAF);
  }
}

function tickPlayback() {
  const audio = state.playbackAudio;
  if (!audio || audio.paused) return;

  const elapsed  = audio.currentTime;
  const duration = audio.duration || 1;
  const pct      = Math.min((elapsed / duration) * 100, 100);

  const fill = document.getElementById('s5-progress-fill');
  if (fill) fill.style.width = pct + '%';

  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
  setText('s5-playback-time', `${m}:${s}`);

  state.playbackRAF = requestAnimationFrame(tickPlayback);
}

function seekS5(e) {
  const audio = state.playbackAudio;
  if (!audio || !audio.duration) return;
  const bar  = e.currentTarget.querySelector('.s5-progress-bar');
  const rect = bar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = pct * audio.duration;
}

function updatePlayBtn(playing) {
  const btn = document.getElementById('s5-play-btn');
  if (btn) btn.textContent = playing ? '⏸' : '▶';
}

function stopS5Playback() {
  if (state.playbackAudio) {
    state.playbackAudio.pause();
    state.playbackAudio = null;
  }
  cancelAnimationFrame(state.playbackRAF);
  updatePlayBtn(false);
}

function downloadRecording() {
  if (!state.recordedAudioURL) return;
  const a = document.createElement('a');
  a.href = state.recordedAudioURL;
  const name = (state.pieceName || 'recording').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `${name}_practice.webm`;
  a.click();
}

function resetRecording() {
  state.isRecording     = false;
  state.recordingTime   = 0;
  state.recordedAudioURL = null;
  state.audioBlob       = null;
  state.audioChunks     = [];
  clearInterval(state.timerInterval);

  const timer = document.getElementById('timer');
  if (timer) timer.textContent = '00:00';

  const icon = document.getElementById('recIcon');
  if (icon) icon.classList.remove('recording');

  const status = document.getElementById('recStatus');
  if (status) status.textContent = 'Tap to start recording';

  const waveform = document.getElementById('waveform');
  if (waveform) waveform.style.display = 'none';

  const controls = document.getElementById('playbackControls');
  if (controls) controls.style.display = 'none';

  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) analyzeBtn.style.display = 'none';
}

function animateWaveform() {
  document.querySelectorAll('.waveform-bar').forEach(bar => {
    bar.style.height = (Math.random() * 38 + 12) + 'px';
  });
}

// ── Strategy expand ────────────────────────────────────────────────────────
function toggleStrategy(el) {
  el.classList.toggle('expanded');
}

// ── Session end ────────────────────────────────────────────────────────────
function endSession() {
  resetRecording();
  state.pieceName      = '';
  state.mode           = '';
  state.selectedFocus  = '';
  state.tags           = [];
  state.selectedTag    = null;
  state.savedSessionId = null;
  DroneModule.stop();
  MetronomeModule.stop();
  document.querySelectorAll('.focus-item').forEach(f => f.classList.remove('selected'));
  document.getElementById('piece-name-input').value = '';
  goTo('screen0');
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const waveform = document.getElementById('waveform');
  if (waveform) {
    waveform.innerHTML = Array.from({ length: 12 }, () => '<div class="waveform-bar" style="height:20px"></div>').join('');
  }
  DB.open().catch(console.error);
});
