// ── State ──────────────────────────────────────────────────────────────────
const state = {
  pieceName       : '',
  mode            : '',
  selectedFocus   : '',
  recordingTime   : 0,
  recordedAudioURL: null,
  audioBlob       : null,
  isRecording     : false,
  mediaRecorder   : null,
  audioChunks     : [],
  timerInterval   : null,
  playbackAudio   : null,
  playbackRAF     : null,
  tags            : [],
  savedSessionId  : null,
  selectedTag     : null,
  isIsolatedPassage: false,
};

// ── Session audio players (tags screen) ────────────────────────────────────
const _sessionPlayers = {};
let _sessionPlayerRAF  = null;

function stopAllSessionPlayers() {
  Object.values(_sessionPlayers).forEach(audio => { try { audio.pause(); } catch(e){} });
  cancelAnimationFrame(_sessionPlayerRAF);
  document.querySelectorAll('.session-play-btn').forEach(btn => btn.textContent = '▶');
}

async function toggleSessionPlayer(sessionId) {
  if (!_sessionPlayers[sessionId]) {
    const blob = await DB.getAudio(sessionId);
    if (!blob) return;
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onended = () => {
      cancelAnimationFrame(_sessionPlayerRAF);
      const btn = document.getElementById(`sp-btn-${sessionId}`);
      if (btn) btn.textContent = '▶';
    };
    _sessionPlayers[sessionId] = audio;
  }
  const audio = _sessionPlayers[sessionId];
  if (audio.paused) {
    stopAllSessionPlayers();
    audio.play();
    const btn = document.getElementById(`sp-btn-${sessionId}`);
    if (btn) btn.textContent = '⏸';
    _tickSessionPlayer(sessionId);
  } else {
    audio.pause();
    const btn = document.getElementById(`sp-btn-${sessionId}`);
    if (btn) btn.textContent = '▶';
    cancelAnimationFrame(_sessionPlayerRAF);
  }
}

function _tickSessionPlayer(sessionId) {
  const audio = _sessionPlayers[sessionId];
  if (!audio || audio.paused) return;
  const elapsed  = audio.currentTime;
  const duration = audio.duration || 1;
  const fill = document.getElementById(`sp-fill-${sessionId}`);
  if (fill) fill.style.width = Math.min((elapsed / duration) * 100, 100) + '%';
  const timeEl = document.getElementById(`sp-time-${sessionId}`);
  if (timeEl) {
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
    timeEl.textContent = `${m}:${s}`;
  }
  _sessionPlayerRAF = requestAnimationFrame(() => _tickSessionPlayer(sessionId));
}

function seekSessionPlayer(sessionId, e) {
  const bar = document.getElementById(`sp-bar-${sessionId}`);
  if (!bar) return;
  const rect = bar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const doSeek = audio => {
    audio.currentTime = pct * audio.duration;
    const fill = document.getElementById(`sp-fill-${sessionId}`);
    if (fill) fill.style.width = pct * 100 + '%';
  };
  if (_sessionPlayers[sessionId]) {
    const audio = _sessionPlayers[sessionId];
    if (audio.readyState >= 1) doSeek(audio);
    else audio.addEventListener('loadedmetadata', () => doSeek(audio), { once: true });
  } else {
    toggleSessionPlayer(sessionId).then(() => {
      const audio = _sessionPlayers[sessionId];
      if (!audio) return;
      audio.pause();
      const btn = document.getElementById(`sp-btn-${sessionId}`);
      if (btn) btn.textContent = '▶';
      if (audio.readyState >= 1) doSeek(audio);
      else audio.addEventListener('loadedmetadata', () => doSeek(audio), { once: true });
    });
  }
}

async function sessionTagSeek(sessionId, timestamp) {
  if (!_sessionPlayers[sessionId]) {
    const blob = await DB.getAudio(sessionId);
    if (!blob) return;
    const audio = new Audio(URL.createObjectURL(blob));
    audio.onended = () => {
      cancelAnimationFrame(_sessionPlayerRAF);
      const btn = document.getElementById(`sp-btn-${sessionId}`);
      if (btn) btn.textContent = '▶';
    };
    _sessionPlayers[sessionId] = audio;
  }
  stopAllSessionPlayers();
  const audio = _sessionPlayers[sessionId];
  const doPlay = () => {
    audio.currentTime = timestamp;
    audio.play();
    const btn = document.getElementById(`sp-btn-${sessionId}`);
    if (btn) btn.textContent = '⏸';
    _tickSessionPlayer(sessionId);
  };
  if (audio.readyState >= 1) doPlay();
  else audio.addEventListener('loadedmetadata', doPlay, { once: true });
}

// ── Navigation ─────────────────────────────────────────────────────────────
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  onScreenEnter(screenId);
}

function onScreenEnter(screenId) {
  const name = state.pieceName || 'Your piece';

  if (screenId !== 'screen-tags') stopAllSessionPlayers();

  if (screenId === 'screen1') {
    setText('s1-piece', name);
    refreshExcerptBadge();
  }

  if (screenId === 'screen2') {
    const modeLabel = state.mode === 'excerpt'
      ? 'Working on excerpt'
      : 'Playing through entire piece or section';
    setText('s2-mode-text', modeLabel);
    renderScreen2();
  }

  if (screenId === 'screen3') {
    setText('s3-piece', name);
    renderScreen3();
  }

  if (screenId === 'screen4') {
    const labels = { pitch: 'Focus: Pitch / Intonation', rhythm: 'Focus: Pulse / Rhythm', none: 'Free play' };
    setText('s4-focus-label', labels[state.selectedFocus] || 'Reference');
    setText('s4-piece', name);

    const tagCtx = document.getElementById('s4-tag-context');
    if (tagCtx) {
      if (state.mode === 'excerpt' && state.selectedTag) {
        tagCtx.style.display = 'block';
        tagCtx.textContent   = `Working on: "${state.selectedTag.label}" (${_fmtTime(state.selectedTag.timestamp)})`;
      } else {
        tagCtx.style.display = 'none';
      }
    }

    // Hide mini-ref panel for free-play mode (no focus selected)
    const miniRefPanel = document.querySelector('.mini-ref-panel');
    if (miniRefPanel) {
      miniRefPanel.style.display = state.selectedFocus === 'none' ? 'none' : '';
      // Rhythm: start collapsed (full controls rendered, user opens when needed)
      // Pitch: start open (compact mini drone)
      if (state.selectedFocus !== 'none') miniRefPanel.open = state.selectedFocus !== 'rhythm';
    }

    // Note picker: only for pitch focus
    const notePickerPanel = document.getElementById('note-picker-panel');
    if (notePickerPanel) {
      notePickerPanel.style.display = state.selectedFocus === 'pitch' ? '' : 'none';
      if (state.selectedFocus === 'pitch') notePickerPanel.open = false;
    }

    // Skip-to-eval button: only in isolated-passage sub-loop
    const skipBtn = document.getElementById('skip-to-eval-btn');
    if (skipBtn) skipBtn.style.display = (state.mode === 'excerpt' && state.isIsolatedPassage) ? 'block' : 'none';

    if (state.selectedFocus !== 'none') renderMiniPanel();
  }

  if (screenId === 'screen5') {
    DroneModule.stop();
    MetronomeModule.stop();

    const s5body = document.getElementById('s5-body');
    if (!s5body) return;

    if (state.mode === 'playthrough' && state.audioBlob) {
      TaggerModule.init(state);
      TaggerModule.render(s5body, state.audioBlob);
      document.getElementById('s5-eval-section').style.display = 'none';
      setText('s5-title', 'Tag problem sections');
    } else {
      TaggerModule.stop();
      s5body.innerHTML = buildS5PlayerHTML();
      document.getElementById('s5-eval-section').style.display = 'block';
      setText('s5-title', 'Evaluation');
      const mins = Math.floor(state.recordingTime / 60).toString().padStart(2, '0');
      const secs = (state.recordingTime % 60).toString().padStart(2, '0');
      setText('s5-recording-duration',
        state.recordedAudioURL ? `Your recording · ${mins}:${secs}` : 'No recording');
      const fill = document.getElementById('s5-progress-fill');
      if (fill) fill.style.width = '0%';
      setText('s5-playback-time', '0:00');
    }
  } else {
    TaggerModule.stop();
    stopS5Playback();
  }

  if (screenId === 'screen-tags') renderTagsScreen();

  if (screenId === 'screen7') {
    if (state.mode === 'excerpt' && state.selectedTag && state.savedSessionId) {
      DB.markTagPracticed(state.savedSessionId, state.selectedTag.id).catch(console.error);
    }
    refreshExcerptBadge();
  }
}

// ── Screen 2: dynamic focus options ────────────────────────────────────────
function renderScreen2() {
  const isPlaythrough = state.mode === 'playthrough';

  // Tag context banner (excerpt mode + selected tag)
  const tagCtx = document.getElementById('s2-tag-context');
  if (tagCtx) {
    if (state.selectedTag && state.mode === 'excerpt') {
      tagCtx.style.display = 'block';
      tagCtx.textContent   = `Working on: "${state.selectedTag.label}" · ${_fmtTime(state.selectedTag.timestamp)}`;
    } else {
      tagCtx.style.display = 'none';
    }
  }

  setText('s2-question', isPlaythrough
    ? 'Do you want to focus on anything specific?'
    : 'What exactly do you want to focus on?');

  const list = document.getElementById('s2-focus-list');
  if (list) {
    list.innerHTML = (isPlaythrough ? `
      <div class="focus-item" onclick="selectFocus('none', this)">
        <strong>No, just play and analyse later</strong>
        <span>Record your performance and review it afterwards</span>
      </div>` : '') + `
      <div class="focus-item" onclick="selectFocus('pitch', this)">
        <strong>Pitch / Intonation</strong>
        <span>Use a drone tone to tune your notes accurately</span>
      </div>
      <div class="focus-item" onclick="selectFocus('rhythm', this)">
        <strong>Pulse / Rhythm</strong>
        <span>Work with a metronome to build steady pulse</span>
      </div>`;
  }

  // Reset selection state on each entry
  state.selectedFocus = '';
  const btn = document.getElementById('s2-continue-btn');
  if (btn) btn.textContent = 'Continue →';
}

// ── Screen 3: dynamic reference layout ─────────────────────────────────────
function renderScreen3() {
  const container = document.getElementById('screen3-body');
  if (!container) return;

  const isPitch   = state.selectedFocus === 'pitch';
  const toolTitle = isPitch ? 'Drone note' : 'Metronome';
  const toolStep  = isPitch ? 'Use a drone note while playing' : 'Use a metronome while playing';
  const toolId    = isPitch ? 'drone-tool-container' : 'metronome-tool-container';
  const tipHtml   = isPitch ? `
    <div class="drone-tip">
      Choose the tonic of your piece as the drone note. If your piece is in G major, choose G.
      You can change the drone note while playing if the key changes.
    </div>` : '';

  container.innerHTML = `
    <div class="question">Do you have a clear idea of what it should sound like?</div>
    <div class="clarify-main-btns">
      <button class="btn-primary" style="width:100%;" onclick="goTo('screen4')">
        Yes, continue to recording →
      </button>
      <button class="btn-secondary clarify-toggle-btn" id="clarify-toggle-btn"
              style="width:100%;" onclick="showClarifySection()">
        No, help me clarify my inner representation
      </button>
    </div>
    <div class="clarify-tools" id="clarify-tools">
      <div class="clarify-step">
        <div class="clarify-step-label">1. Listen to audio before playing:</div>
        <details class="tool-details" id="yt-details">
          <summary>Audio reference</summary>
          <div id="yt-search-container"></div>
        </details>
      </div>
      <div class="clarify-step">
        <div class="clarify-step-label">2. ${toolStep}:</div>
        <details class="tool-details" id="tech-tool-details">
          <summary>${toolTitle}</summary>
          ${tipHtml}
          <div id="${toolId}"></div>
        </details>
      </div>
      <div class="clarify-continue">
        <button class="btn-primary" style="width:100%;" onclick="goTo('screen4')">
          Continue to recording →
        </button>
      </div>
    </div>`;

  document.getElementById('yt-details').addEventListener('toggle', function() {
    if (this.open) YouTubeModule.render(document.getElementById('yt-search-container'), state.pieceName);
  });

  document.getElementById('tech-tool-details').addEventListener('toggle', function() {
    if (!this.open) return;
    const el = document.getElementById(toolId);
    if (isPitch) DroneModule.render(el);
    else MetronomeModule.render(el);
  });
}

function showClarifySection() {
  const tools = document.getElementById('clarify-tools');
  if (tools) tools.style.display = 'block';
  const btn = document.getElementById('clarify-toggle-btn');
  if (btn) btn.style.display = 'none';
}

// ── Screen 4 helpers ────────────────────────────────────────────────────────
function onNotePickerToggle(details) {
  if (details.open) DroneModule.renderNotePicker(document.getElementById('note-picker-container'));
}

function recordIsolatedPassage() {
  resetRecording();
  state.isIsolatedPassage = true;
  goTo('screen4');
}

function skipToEvaluation() {
  goTo('screen5');
}

// ── Shared helpers ──────────────────────────────────────────────────────────
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

function renderMiniPanel() {
  const bodyEl = document.getElementById('mini-ref-body');
  if (!bodyEl) return;
  if (state.selectedFocus === 'pitch') DroneModule.renderMini(bodyEl);
  else MetronomeModule.render(bodyEl); // full controls on screen 4 for rhythm
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

function _esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
    const normalized = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
    DB.getSessionsForPiece(normalized).then(sessions => {
      const hasTags = sessions.some(s => s.tags && s.tags.length > 0);
      goTo(hasTags ? 'screen-tags' : 'screen2');
    }).catch(() => goTo('screen2'));
  } else {
    goTo('screen2');
  }
}

function practiceTaggedExcerpts() {
  state.mode        = 'excerpt';
  state.selectedTag = null;
  const normalized  = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  DB.getSessionsForPiece(normalized).then(sessions => {
    const hasTags = sessions.some(s => s.tags && s.tags.length > 0);
    goTo(hasTags ? 'screen-tags' : 'screen2');
  }).catch(() => goTo('screen2'));
}

function playThroughDifferentFocus() {
  state.mode          = 'playthrough';
  state.selectedFocus = '';
  state.selectedTag   = null;
  resetRecording();
  document.querySelectorAll('.focus-item').forEach(f => f.classList.remove('selected'));
  goTo('screen2');
}

function selectFocus(focus, el) {
  state.selectedFocus = focus;
  document.querySelectorAll('.focus-item').forEach(f => f.classList.remove('selected'));
  if (el) el.classList.add('selected');
  const btn = document.getElementById('s2-continue-btn');
  if (btn) btn.textContent = focus === 'none' ? 'Continue to recording →' : 'Continue to reference →';
}

function goToReference() {
  if (!state.selectedFocus) {
    alert('Please select a focus area first.');
    return;
  }
  goTo(state.selectedFocus === 'none' ? 'screen4' : 'screen3');
}

// ── Tags screen ────────────────────────────────────────────────────────────
async function renderTagsScreen() {
  const container = document.getElementById('tags-screen-body');
  if (!container) return;

  container.innerHTML = '<p style="color:var(--color-text-secondary);padding:1rem 0;">Loading…</p>';

  const normalized = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  let sessions;
  try {
    sessions = await DB.getSessionsForPiece(normalized);
  } catch(e) {
    container.innerHTML = '<p>Could not load saved sessions.</p>';
    return;
  }

  sessions = sessions
    .filter(s => s.tags && s.tags.length > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sessions.length === 0) {
    container.innerHTML = '<p style="color:var(--color-text-secondary)">No saved problem sections yet.</p>';
    return;
  }

  const html = sessions.map(session => {
    const dateStr = new Date(session.date).toLocaleDateString(undefined,
      { month: 'short', day: 'numeric', year: 'numeric' });
    const dur = _fmtTime(session.duration || 0);

    const tagRows = session.tags
      .slice().sort((a, b) => a.timestamp - b.timestamp)
      .map(tag => `
        <div class="tag-row${tag.practiced ? ' practiced' : ''}">
          <div class="tag-row-info">
            <button class="tg-tag-seek" onclick="sessionTagSeek(${session.id}, ${tag.timestamp})">
              ${_fmtTime(tag.timestamp)}
            </button>
            <span class="tag-row-label">${_esc(tag.label)}</span>
            ${tag.practiced ? '<span class="tag-practiced-badge">✓ Practiced</span>' : ''}
          </div>
          <button class="btn-secondary btn-sm tag-work-btn"
                  onclick="selectTagAndContinue(${session.id}, ${tag.id})">
            Work on this →
          </button>
        </div>`).join('');

    return `
      <div class="session-group">
        <div class="session-group-header">
          <span>${dateStr}</span>
          <span class="session-group-dur">${dur}</span>
          <button class="session-delete-btn" onclick="deleteSessionAndRefresh(${session.id})"
                  title="Delete session">✕</button>
        </div>
        <div class="session-mini-player">
          <button class="s5-play-btn session-play-btn" id="sp-btn-${session.id}"
                  onclick="toggleSessionPlayer(${session.id})">▶</button>
          <div class="s5-progress-wrap session-progress-wrap"
               onclick="seekSessionPlayer(${session.id}, event)">
            <div class="s5-progress-bar" id="sp-bar-${session.id}">
              <div class="s5-progress-fill" id="sp-fill-${session.id}"></div>
            </div>
          </div>
          <span class="session-time" id="sp-time-${session.id}">0:00</span>
        </div>
        <div class="session-tags">${tagRows}</div>
      </div>`;
  }).join('');

  container.innerHTML = html;
}

function selectTagAndContinue(sessionId, tagId) {
  const normalized = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  DB.getSessionsForPiece(normalized).then(sessions => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const tag = session.tags.find(t => t.id === tagId);
    if (!tag) return;
    state.selectedTag    = { ...tag, sessionId };
    state.savedSessionId = sessionId;
    state.mode           = 'excerpt';
    stopAllSessionPlayers();
    goTo('screen2');
  }).catch(console.error);
}

function skipTagsScreen() {
  state.selectedTag    = null;
  state.savedSessionId = null;
  stopAllSessionPlayers();
  goTo('screen2');
}

async function deleteSessionAndRefresh(sessionId) {
  if (!confirm('Delete this session and all its tags?')) return;
  try {
    if (_sessionPlayers[sessionId]) {
      try { _sessionPlayers[sessionId].pause(); } catch(e) {}
      delete _sessionPlayers[sessionId];
    }
    await DB.deleteSession(sessionId);
    refreshExcerptBadge();
    renderTagsScreen();
  } catch(e) {
    console.error(e);
    alert('Could not delete session.');
  }
}

// ── Excerpt badge ──────────────────────────────────────────────────────────
function refreshExcerptBadge() {
  const normalized = (state.pieceName || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
  if (!normalized) return;
  DB.getSessionsForPiece(normalized).then(sessions => {
    const unpracticed = sessions.flatMap(s => s.tags || []).filter(t => !t.practiced).length;
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
  state.tags           = [];
  state.savedSessionId = null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 48000 }
    });

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    const options  = { audioBitsPerSecond: 128000, ...(mimeType && { mimeType }) };
    state.mediaRecorder = new MediaRecorder(stream, options);
    state.audioChunks   = [];
    state.recordingTime = 0;

    state.mediaRecorder.ondataavailable = e => state.audioChunks.push(e.data);
    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.audioChunks, { type: mimeType || 'audio/webm' });
      state.audioBlob        = blob;
      state.recordedAudioURL = URL.createObjectURL(blob);
      stream.getTracks().forEach(t => t.stop());
      // Reveal controls only after blob is ready
      document.getElementById('recStatus').textContent = 'Recording complete';
      document.getElementById('playbackControls').style.display = 'flex';
      document.getElementById('analyzeBtn').style.display = 'block';
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
  document.getElementById('recStatus').textContent = 'Processing…';
}

function playRecording() {
  if (state.recordedAudioURL) new Audio(state.recordedAudioURL).play();
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
  if (state.playbackAudio) { state.playbackAudio.pause(); state.playbackAudio = null; }
  cancelAnimationFrame(state.playbackRAF);
  updatePlayBtn(false);
}

function downloadRecording() {
  if (!state.recordedAudioURL) return;
  const a    = document.createElement('a');
  a.href     = state.recordedAudioURL;
  const name = (state.pieceName || 'recording').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `${name}_practice.webm`;
  a.click();
}

function resetRecording() {
  state.isRecording        = false;
  state.recordingTime      = 0;
  state.recordedAudioURL   = null;
  state.audioBlob          = null;
  state.audioChunks        = [];
  state.tags               = [];
  state.savedSessionId     = null;
  state.isIsolatedPassage  = false;
  clearInterval(state.timerInterval);

  const els = {
    timer          : el => el.textContent = '00:00',
    recIcon        : el => el.classList.remove('recording'),
    recStatus      : el => el.textContent = 'Tap to start recording',
    waveform       : el => el.style.display = 'none',
    playbackControls: el => el.style.display = 'none',
    analyzeBtn     : el => el.style.display = 'none',
  };
  Object.entries(els).forEach(([id, fn]) => { const el = document.getElementById(id); if (el) fn(el); });
}

function animateWaveform() {
  document.querySelectorAll('.waveform-bar').forEach(bar => {
    bar.style.height = (Math.random() * 38 + 12) + 'px';
  });
}

// ── Strategy expand ────────────────────────────────────────────────────────
function toggleStrategy(el) { el.classList.toggle('expanded'); }

// ── Session end ────────────────────────────────────────────────────────────
function endSession() {
  resetRecording();
  stopAllSessionPlayers();
  state.pieceName      = '';
  state.mode           = '';
  state.selectedFocus  = '';
  state.selectedTag    = null;
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
    waveform.innerHTML = Array.from({ length: 12 },
      () => '<div class="waveform-bar" style="height:20px"></div>').join('');
  }
  DB.open().catch(console.error);
});
