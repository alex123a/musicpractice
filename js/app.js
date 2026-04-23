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
  loopB: {
    problemDescription : '',
    teacherReview      : false,
    focusCategory      : '',   // set from selectedFocus when entering B3
    questionIndex      : 0,    // current question in strategy tree
    showStrategy       : false,// whether strategy panel is open on current question
  },
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

  // Stop audio tools whenever leaving screen 4 (they persist through 3→4 transition)
  if (screenId !== 'screen4') {
    MetronomeModule.stop();
    DroneModule.stop();
  }

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
      if (state.selectedFocus !== 'none') {
        // Collapse drone/metronome by default on comparison recording screen to reduce distraction
        miniRefPanel.open = state.isIsolatedPassage ? false : true;
      }
    }

    // Note picker: only for pitch focus
    const notePickerPanel = document.getElementById('note-picker-panel');
    if (notePickerPanel) {
      notePickerPanel.style.display = state.selectedFocus === 'pitch' ? '' : 'none';
      if (state.selectedFocus === 'pitch') notePickerPanel.open = false;
    }

    // Skip-to-eval button: only in isolated-passage sub-loop
    const skipBtn = document.getElementById('skip-to-eval-btn');
    if (skipBtn) skipBtn.style.display = 'block';

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

  // ── Loop B screen handlers ──────────────────────────────────────────────
  if (screenId === 'screen-b1') {
    setText('sb1-piece', state.pieceName || 'Your piece');
  }

  if (screenId === 'screen-b2-2') {
    renderB2Player();
  }

  if (screenId === 'screen-b2-3') {
    // Lazy-load metronome when details opens
    const det = document.getElementById('b2-3-metro-details');
    if (det) {
      det.open = false;
      det.addEventListener('toggle', function _once() {
        if (this.open) {
          MetronomeModule.render(document.getElementById('b2-3-metro-container'));
          det.removeEventListener('toggle', _once);
        }
      });
    }
  }

  if (screenId === 'screen-b2-3-coord') {
    renderCoordStrategies();
  }

  if (screenId === 'screen-b3') {
    renderB3();
  }

  if (screenId === 'screen-comparison') {
    renderComparisonScreen();
  }

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

function analyzeRecording() {
  if (state.isIsolatedPassage) {
    goTo('screen-comparison');
  } else {
    goTo('screen5');
  }
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
  if (state.selectedFocus === 'pitch') {
    DroneModule.renderMini(bodyEl);
  } else {
    // Pendulum + start/stop always visible; BPM/timesig/subdivision in collapsible section
    bodyEl.innerHTML = `
      <div class="metro-tool">
        <div id="metro-s4-display"></div>
        <details class="metro-config-details">
          <summary class="metro-config-summary">Configure metronome</summary>
          <div id="metro-s4-config"></div>
        </details>
      </div>`;
    MetronomeModule.renderDisplay(document.getElementById('metro-s4-display'));
    bodyEl.querySelector('.metro-config-details').addEventListener('toggle', function() {
      if (this.open) MetronomeModule.renderConfig(document.getElementById('metro-s4-config'));
    });
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

// ══════════════════════════════════════════════════════════════════════════
// LOOP B: Problem Solving
// ══════════════════════════════════════════════════════════════════════════

// ── Loop B helpers ─────────────────────────────────────────────────────────
function restartPracticeLoop() {
  state.loopB.problemDescription = '';
  state.loopB.teacherReview      = false;
  state.loopB.questionIndex      = 0;
  state.loopB.showStrategy       = false;
  state.loopB.focusCategory      = '';
  resetRecording();
  state.selectedTag   = null;
  state.isIsolatedPassage = false;
  goTo('screen2');
}

// ── B2-2: Compact recording player ─────────────────────────────────────────
function renderB2Player() {
  const container = document.getElementById('b2-player-section');
  if (!container) return;
  if (!state.recordedAudioURL) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `
    <div class="b2-player">
      <span class="b2-player-label">Your recording</span>
      <div class="b2-player-controls">
        <button class="s5-play-btn" id="b2-play-btn" onclick="toggleB2Playback()">▶</button>
        <div class="s5-progress-wrap" onclick="seekB2(event)">
          <div class="s5-progress-bar">
            <div class="s5-progress-fill" id="b2-progress-fill"></div>
          </div>
        </div>
        <span id="b2-playback-time" class="s5-playback-time">0:00</span>
      </div>
    </div>`;
}

let _b2Audio = null;
let _b2RAF   = null;

function toggleB2Playback() {
  if (!state.recordedAudioURL) return;
  if (!_b2Audio) {
    _b2Audio = new Audio(state.recordedAudioURL);
    _b2Audio.onended = () => {
      document.getElementById('b2-play-btn').textContent = '▶';
      cancelAnimationFrame(_b2RAF);
      setText('b2-playback-time', '0:00');
      const fill = document.getElementById('b2-progress-fill');
      if (fill) fill.style.width = '0%';
      _b2Audio = null;
    };
  }
  if (_b2Audio.paused) {
    _b2Audio.play();
    document.getElementById('b2-play-btn').textContent = '⏸';
    _tickB2();
  } else {
    _b2Audio.pause();
    document.getElementById('b2-play-btn').textContent = '▶';
    cancelAnimationFrame(_b2RAF);
  }
}

function _tickB2() {
  if (!_b2Audio || _b2Audio.paused) return;
  const elapsed  = _b2Audio.currentTime;
  const duration = _b2Audio.duration || 1;
  const fill = document.getElementById('b2-progress-fill');
  if (fill) fill.style.width = Math.min((elapsed / duration) * 100, 100) + '%';
  const m = Math.floor(elapsed / 60);
  const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
  setText('b2-playback-time', `${m}:${s}`);
  _b2RAF = requestAnimationFrame(_tickB2);
}

function seekB2(e) {
  if (!_b2Audio || !_b2Audio.duration) return;
  const bar  = e.currentTarget.querySelector('.s5-progress-bar');
  const rect = bar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  _b2Audio.currentTime = pct * _b2Audio.duration;
}

// ── B2-2: Save problem description ─────────────────────────────────────────
function saveProblemAndContinue() {
  const input = document.getElementById('b2-problem-input');
  state.loopB.problemDescription = input ? input.value.trim() : '';
  state.loopB.teacherReview = false;
  _saveProblemToSession();
  goTo('screen-b2-3');
}

function flagForTeacherAndContinue() {
  const input = document.getElementById('b2-problem-input');
  state.loopB.problemDescription = input ? input.value.trim() : '';
  state.loopB.teacherReview = true;
  _saveProblemToSession();
  goTo('screen-b2-3');
}

function _saveProblemToSession() {
  if (!state.savedSessionId) return;
  DB.addProblemNote(state.savedSessionId, {
    description  : state.loopB.problemDescription,
    teacherReview: state.loopB.teacherReview,
    timestamp    : Date.now(),
  }).catch(console.error);
}

// ── B2-3-coord: Coordination strategies ────────────────────────────────────
const COORD_STRATEGIES = [
  {
    category: 'Tempo/Speed',
    title : 'Gradual Metronome Increase',
    intro : 'Build speed step by step with the metronome',
    detail: 'Start at the tempo where you can play the passage cleanly 2–3 times in a row. Then increase by 4–5 BPM and repeat. Only move up when the passage is clean, not just playable. Continue until you reach your target tempo.',
  },
  {
    category: 'Pattern Work',
    title : 'Rhythmic Pattern Variations',
    intro : 'Use dotted or reversed rhythms to break habit patterns',
    detail: 'Play the passage with exaggerated dotted rhythms (long-short), then reversed (short-long). This disrupts automatic muscle memory and forces you to focus on each note individually. Great for passages where your hands "run away."',
  },
  {
    category: 'Pattern Work',
    title : 'Reduce and Add Notes',
    intro : 'Play a skeleton version, then gradually add notes back',
    detail: 'Play only the first note of each beat (or group), leaving the rest silent. Once that is clean, add the next note, and so on. This simplifies the technical demand and lets you build coordination one piece at a time.',
  },
  {
    category: 'Tempo/Speed',
    title : 'Anchor Notes and Stopping Points',
    intro : 'Define checkpoints and play between them',
    detail: 'Choose 2–3 "anchor" notes in the passage (stable notes where you can pause and reset). Practice playing cleanly from anchor to anchor. This breaks the passage into manageable segments and prevents rushing through problem spots.',
  },
  {
    category: 'Pattern Work',
    title : 'Note Grouping',
    intro : 'Organize notes into musical groups and practice by group',
    detail: 'Identify the natural musical groupings (e.g. by bow direction, beat, or phrase). Play each group as a unit, stopping between groups. This creates structure that aids both memory and coordination.',
  },
  {
    category: 'Articulation/Touch',
    title : 'Articulation Variations',
    intro : 'Change the articulation to expose the coordination problem',
    detail: 'Play the passage legato (smooth), then staccato (short and bouncy), then portato (separated but connected). Also try variable legato: 2-note groups, then 3-note groups. Different articulations change the muscle pattern and often reveal where coordination breaks down.',
  },
  {
    category: 'Hand Coordination',
    title : 'Left Hand Only (Silent Fingering)',
    intro : 'Finger the passage without the bow to isolate left-hand coordination',
    detail: 'Lay the bow aside and finger the passage silently (or very lightly on the string). Focus entirely on left-hand accuracy, timing, and relaxation. This removes bow coordination as a variable and lets you feel where the left hand is struggling.',
  },
  {
    category: 'Hand Coordination',
    title : 'Right Hand (Bow) Only',
    intro : 'Play with bow alone, focusing on bow changes and articulation',
    detail: 'Lay your left hand down or away from the violin completely. With the bow on the strings, practice the exact bowing pattern of the problem passage without the left-hand coordination. Be very clear where each string change happens and where the bow direction changes (up-bow vs. down-bow). Once bow coordination feels secure, slowly re-introduce the left hand.',
  },
  {
    category: 'Articulation/Touch',
    title : 'Pizzicato',
    intro : 'Pluck the strings to remove bow coordination',
    detail: 'Play the passage pizzicato (plucked). This removes all bow technique from the equation. If the passage feels easier or cleaner pizzicato, the bow is the coordination problem. If it is still difficult, focus shifts to the left hand.',
  },
];

function renderCoordStrategies() {
  const list = document.getElementById('coord-strategy-list');
  if (!list) return;

  const categories = {
    'Tempo/Speed': [],
    'Hand Coordination': [],
    'Articulation/Touch': [],
    'Pattern Work': []
  };

  // Group strategies by category
  COORD_STRATEGIES.forEach(s => {
    if (categories[s.category]) {
      categories[s.category].push(s);
    }
  });

  // Render with category headers
  let html = '';
  Object.entries(categories).forEach(([cat, strategies]) => {
    if (strategies.length > 0) {
      html += `<div class="strategy-group-header">${cat}</div>`;
      strategies.forEach(s => {
        html += `<li onclick="toggleStrategy(this)">
          <strong>${s.title}</strong>
          <p>${s.intro}</p>
          <div class="strategy-detail">${s.detail}</div>
        </li>`;
      });
    }
  });

  list.innerHTML = html;
}

// ── Comparison screen functions ─────────────────────────────────────────────
function renderComparisonScreen() {
  // Load initial recording (from saved session)
  if (!state.savedSessionId) return;

  DB.getAudio(state.savedSessionId).then(audioBlob => {
    if (audioBlob) {
      const initialUrl = URL.createObjectURL(audioBlob);
      renderComparisonPlayer('comparison-initial-player', initialUrl);
    }
  }).catch(console.error);

  if (state.recordedAudioURL) {
    renderComparisonPlayer('comparison-current-player', state.recordedAudioURL);
  }
}

function renderComparisonPlayer(elementId, audioURL) {
  const container = document.getElementById(elementId);
  if (!container || !audioURL) return;

  // Create audio element to get duration
  const audio = new Audio(audioURL);
  let duration = 0;

  // Update duration when metadata loads
  audio.onloadedmetadata = () => {
    duration = audio.duration;
    updateComparisonTime(elementId);
  };

  container.innerHTML = `
    <div class="s5-player-controls">
      <button class="s5-play-btn" onclick="toggleComparisonPlayback('${elementId}')">▶</button>
      <div class="s5-progress-wrap" onclick="seekComparisonPlayback('${elementId}', event)">
        <div class="s5-progress-bar">
          <div class="s5-progress-fill" id="${elementId}-fill"></div>
        </div>
      </div>
      <span class="s5-playback-time" id="${elementId}-time">0:00 / 0:00</span>
    </div>
  `;

  // Store reference for playback control
  window[elementId + '_audio'] = audio;
}

function updateComparisonTime(elementId) {
  const audio = window[elementId + '_audio'];
  if (!audio) return;
  const timeEl = document.getElementById(elementId + '-time');
  if (timeEl) {
    const mins = Math.floor(audio.currentTime / 60);
    const secs = Math.floor(audio.currentTime % 60);
    const durMins = Math.floor(audio.duration / 60);
    const durSecs = Math.floor(audio.duration % 60);
    timeEl.textContent = `${mins}:${secs.toString().padStart(2, '0')} / ${durMins}:${durSecs.toString().padStart(2, '0')}`;
  }
}

function toggleComparisonPlayback(elementId) {
  const audio = window[elementId + '_audio'];
  if (!audio) return;

  const btn = event.target.closest('.s5-play-btn');
  if (audio.paused) {
    audio.play();
    btn.textContent = '⏸';
    updateComparisonProgress(elementId);
  } else {
    audio.pause();
    btn.textContent = '▶';
  }
}

function updateComparisonProgress(elementId) {
  const audio = window[elementId + '_audio'];
  if (!audio) return;

  const fill = document.getElementById(elementId + '-fill');
  if (!fill) return;

  // Set up interval to update progress
  const updateProgress = () => {
    if (audio.paused) return;
    const percent = (audio.currentTime / audio.duration) * 100;
    fill.style.width = percent + '%';
    updateComparisonTime(elementId);
    requestAnimationFrame(updateProgress);
  };

  updateProgress();
}

function seekComparisonPlayback(elementId, e) {
  const audio = window[elementId + '_audio'];
  if (!audio) return;
  const wrap = e.currentTarget;
  const rect = wrap.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  audio.currentTime = percent * audio.duration;
}

function showStrategyChoice() {
  const modal = document.getElementById('strategy-choice-modal');
  if (modal) modal.style.display = 'block';
}

function goToIntonationStrategies() {
  state.loopB.questionIndex = 0;
  state.loopB.showStrategy = false;
  goTo('screen-b3-strategy');
  renderB3StrategyScreen(0, false);
}

function goToCoordStrategies() {
  goTo('screen-b2-3-coord');
}

function saveComparisonForTeacher() {
  // Append problem note to session
  _saveProblemToSession();
  // Flag for teacher
  state.loopB.teacherReview = true;
  alert('Saved for teacher discussion.');
}

// ── B3: Focus confirmation ──────────────────────────────────────────────────
function renderB3() {
  const container = document.getElementById('screen-b3-body');
  if (!container) return;

  if (!state.loopB.focusCategory) {
    state.loopB.focusCategory = state.selectedFocus || 'pitch';
  }
  const label = state.loopB.focusCategory === 'pitch' ? 'Pitch / Intonation' : 'Pulse / Rhythm';

  container.innerHTML = `
    <div class="b-step-card">
      <p class="b-step-text">Before we dive into strategies, let's confirm we are targeting the right aspect of your playing.</p>
    </div>
    <div class="question">Is the focus still <strong>${label}</strong>?</div>
    <div class="btn-group">
      <button class="btn-primary" onclick="confirmFocusAndStartTree()">Yes, keep this focus</button>
      <button class="btn-secondary" onclick="showB3FocusPicker()">No, my focus has shifted</button>
    </div>
    <div id="b3-focus-picker" style="display:none; margin-top:0.5rem;">
      <div class="question" style="margin-bottom:0.5rem;">Choose new focus:</div>
      <div class="btn-group">
        <button class="btn-secondary" onclick="setB3Focus('pitch')">Pitch / Intonation</button>
        <button class="btn-secondary" onclick="setB3Focus('rhythm')">Pulse / Rhythm</button>
      </div>
    </div>`;
}

function showB3FocusPicker() {
  const picker = document.getElementById('b3-focus-picker');
  if (picker) picker.style.display = 'block';
}

function setB3Focus(focus) {
  state.loopB.focusCategory = focus;
  confirmFocusAndStartTree();
}

function confirmFocusAndStartTree() {
  state.loopB.questionIndex = 0;
  state.loopB.showStrategy  = false;
  goTo('screen-b3-strategy');
  if (state.loopB.focusCategory === 'rhythm') {
    renderB3ComingSoon();
  } else {
    renderB3StrategyScreen(0, false);
  }
}

// ── B3-strategy: Coming soon (rhythm) ──────────────────────────────────────
function renderB3ComingSoon() {
  const container = document.getElementById('screen-b3-strategy-body');
  if (!container) return;
  container.innerHTML = `
    <div class="coming-soon">
      <div class="coming-soon-icon">🥁</div>
      <h2 class="coming-soon-title">Rhythm Strategies</h2>
      <p class="coming-soon-text">The targeted strategy tree for Pulse / Rhythm is coming in a future update.</p>
      <p class="coming-soon-text" style="margin-top:0.5rem;">In the meantime, try the coordination strategies, as they often address rhythm and pulse issues directly.</p>
    </div>
    <div class="btn-group" style="margin-top:auto;">
      <button class="btn-secondary" onclick="goTo('screen-b2-3-coord')">See coordination strategies</button>
      <button class="btn-secondary" onclick="goTo('screen-b4')">Continue to final coordination</button>
      <button class="btn-secondary" onclick="endSession()">End practice session</button>
    </div>`;
}

// ── B3-strategy: Intonation question tree ──────────────────────────────────
const INTONATION_TREE = [
  {
    screenTitle: 'Understanding Intervals',
    question   : 'Do you understand exactly what intervals (distances between notes) are between each note in this section, and how they should sound?',
    yesLabel   : 'Yes, I understand them clearly',
    noLabel    : 'No, not completely',
    trigger    : 'no',
    strategy: {
      title: 'Study the Intervals',
      body : `<p>Before your hands can play in tune, your mind needs a clear map of the passage.</p>
        <p style="margin-top:0.5rem;"><strong>What to do:</strong></p>
        <ol style="margin:0.4rem 0 0 1.2rem;line-height:1.9;font-size:13px;">
          <li>Look at the score and name every interval between adjacent notes</li>
          <li>Note which fingers are close together and which stretch apart</li>
          <li>Identify the position and any shifts</li>
          <li>Sing the passage on pitch names, syllables, or just "la"</li>
          <li>Listen to a recording while following along in the score</li>
        </ol>
        <p class="b3-strategy-why">Without a clear target, your hands have nothing to aim for. This step builds the mental blueprint your fingers will follow.</p>`,
    },
  },
  {
    screenTitle: 'Hearing Intonation',
    question   : 'When you play, do you clearly hear which notes are out of tune?',
    yesLabel   : 'Yes, I can hear them',
    noLabel    : 'No, I\'m not always sure',
    trigger    : 'no',
    strategy: {
      title: 'Build a Clear Mental Reference',
      body : `<p>You need a vivid inner sound to compare against what you play. Here are two approaches:</p>
        <p style="margin-top:0.5rem;"><strong>Option A: Listen to a recording:</strong></p>
        <ol style="margin:0.3rem 0 0 1.2rem;line-height:1.9;font-size:13px;">
          <li>Listen 1–2 times with full attention (no distractions)</li>
          <li>Play the passage from memory</li>
          <li>Compare: does it match what you heard?</li>
          <li>Listen again if needed, repeat until the reference is vivid</li>
        </ol>
        <p style="margin-top:0.5rem;"><strong>Option B: Drone practice:</strong></p>
        <ol style="margin:0.3rem 0 0 1.2rem;line-height:1.9;font-size:13px;">
          <li>Set a drone on the tonic note of the passage</li>
          <li>Play each note slowly and listen for how it harmonizes with the drone</li>
          <li>Hold each note; adjust the pitch until it sounds "at rest"</li>
          <li>Repeat the passage, noticing how quickly you now find the correct pitch</li>
        </ol>
        <p class="b3-strategy-why">A clear mental reference lets you immediately detect the difference between what you play and what you want to play.</p>`,
    },
  },
  {
    screenTitle: 'Direct vs. Corrected Intonation',
    question   : 'Does a note sound out of tune when you first play it, but you can find the right pitch by correcting it afterward, never hitting it directly on the first try?',
    yesLabel   : 'Yes, I always have to correct it',
    noLabel    : 'No, I hit notes on the first try',
    trigger    : 'yes',
    strategy: {
      title: 'Hit the Note Directly',
      body : `<p>You already have a good ear: you can detect errors and correct them. Now train your muscles to land on the correct pitch from the start.</p>
        <p style="margin-top:0.5rem;"><strong>Choose one approach:</strong></p>
        <p><strong>Option A: Hit the note out of nowhere</strong></p>
        <ol style="margin:0.3rem 0 0 1.2rem;line-height:1.9;font-size:13px;">
          <li>Release your left arm completely from the violin</li>
          <li>Play a single target note from memory</li>
          <li>Ask yourself: was it too sharp, too flat, or correct?</li>
          <li>Reset your hand and try again, aiming slightly differently</li>
          <li>Repeat 5–10 times until you land correctly several times</li>
        </ol>
        <p style="margin-top:0.5rem;"><strong>Option B: Hit the note in context</strong></p>
        <ol style="margin:0.3rem 0 0 1.2rem;line-height:1.9;font-size:13px;">
          <li>Play the notes leading up to your target note</li>
          <li>When you reach the target note, do NOT correct it</li>
          <li>Evaluate: was it too sharp, too flat, or correct?</li>
          <li>Pause, reset, and play the approach + target note again</li>
          <li>Repeat until you land correctly several times</li>
        </ol>
        <p class="b3-strategy-why">Both approaches train your muscles to find the right position on the very first contact, rather than relying on correction afterward.</p>`,
    },
  },
  {
    screenTitle: 'Consistency Challenge',
    question   : 'After practicing intonation, are you unsure whether you will hit the notes correctly again next time you play?',
    yesLabel   : 'Yes, I worry about consistency',
    noLabel    : 'No, I feel confident repeating it',
    trigger    : 'yes',
    strategy: {
      title: 'Develop Internal Anticipation',
      body : `<p>Having a clear mental image before you play helps create muscle memory and consistency.</p>
        <p style="margin-top:0.5rem;"><strong>The exercise:</strong></p>
        <ol style="margin:0.4rem 0 0 1.2rem;line-height:1.9;font-size:13px;">
          <li>Set a very slow tempo, about half your normal speed</li>
          <li>Before each note, pause briefly</li>
          <li>Imagine the pitch, the feeling in your hand, where the finger lands on the string</li>
          <li>Now play the note</li>
          <li>Compare: did it match what you imagined?</li>
          <li>Adjust and move to the next note</li>
        </ol>
        <p class="b3-strategy-why">When you imagine first, your body builds a consistent map. Anticipation becomes your anchor for reliable repetition.</p>`,
    },
  },
  {
    screenTitle: 'Persistent Sharp or Flat Notes',
    question   : 'Are there specific notes that consistently end up too sharp or too flat, no matter how carefully you try?',
    yesLabel   : 'Yes, certain notes keep going wrong',
    noLabel    : 'No, the problem is more general',
    trigger    : 'yes',
    strategy: {
      title: 'Exaggeration Exercise',
      body : `<p>When a note stubbornly stays out of tune, exaggeration breaks the pattern and expands your physical awareness.</p>
        <p style="margin-top:0.5rem;"><strong>The exercise:</strong></p>
        <ol style="margin:0.4rem 0 0 1.2rem;line-height:1.9;font-size:13px;">
          <li>Identify which notes are consistently sharp or flat</li>
          <li>Exaggerate in the opposite direction:
            <br>→ Always flat? Aim extremely high (even unnaturally so)
            <br>→ Always sharp? Aim extremely low</li>
          <li>Play the exaggerated version 3–5 times</li>
          <li>Return to the correct pitch; it now feels easier to find</li>
        </ol>
        <p class="b3-strategy-why">Exaggeration expands what your body believes it can do. After hitting an extreme, the correct pitch might feel like the comfortable middle, much more accessible.</p>`,
    },
  },
  {
    screenTitle: 'Physical Tension Check',
    question   : 'Do you feel physical discomfort, tension, or strain when trying to play in tune?',
    yesLabel   : 'Yes, I notice tension',
    noLabel    : 'No, I feel relaxed',
    trigger    : 'yes',
    strategy: {
      title: 'Identify and Release Tension',
      body : `<p>Tension prevents your muscles from working efficiently. Check each area while you play the problem section:</p>
        <ul style="margin:0.4rem 0 0 1.2rem;line-height:2;font-size:13px;">
          <li><strong>Feet &amp; legs:</strong> balanced, grounded, knees not locked</li>
          <li><strong>Back &amp; spine:</strong> upright, centered, not rigid</li>
          <li><strong>Shoulders:</strong> relaxed, not raised toward the ears</li>
          <li><strong>Left elbow:</strong> hanging with gravity, not tense or locked</li>
          <li><strong>Left wrist:</strong> relaxed, flexes naturally while playing</li>
          <li><strong>Left thumb &amp; fingers:</strong> soft contact, not gripping the neck</li>
        </ul>
        <p class="b3-strategy-why">Tension is often a topic best addressed with a teacher; patterns are easier to spot from outside. Consider saving this for your next lesson.</p>`,
    },
  },
];

// ── B3 video helpers ───────────────────────────────────────────────────────
function getB3Videos() {
  try { return JSON.parse(localStorage.getItem('b3_strategy_videos') || '{}'); }
  catch(e) { return {}; }
}

function buildB3VideoHTML(questionIndex) {
  const allVideos = getB3Videos();
  const videos    = (allVideos[String(questionIndex)] || []).filter(Boolean);
  if (!videos.length) return '';

  if (videos.length === 1) {
    return `
      <div class="b3-video-section">
        <div class="b3-video-label">Video reference</div>
        <video class="b3-video" controls playsinline preload="none"
               src="${_esc(videos[0])}"></video>
      </div>`;
  }

  const tabs = videos.map((_, i) =>
    `<button class="b3-video-tab${i === 0 ? ' active' : ''}"
             onclick="switchB3Video(${questionIndex}, ${i}, this)">
       Video ${i + 1}
     </button>`
  ).join('');

  const players = videos.map((url, i) =>
    `<video class="b3-video${i > 0 ? ' b3-video-hidden' : ''}"
            id="b3-vid-${questionIndex}-${i}"
            controls playsinline preload="none"
            src="${_esc(url)}"></video>`
  ).join('');

  return `
    <div class="b3-video-section">
      <div class="b3-video-label">Video reference</div>
      <div class="b3-video-tabs">${tabs}</div>
      ${players}
    </div>`;
}

function switchB3Video(questionIndex, videoIndex, tabEl) {
  const allVideos = getB3Videos();
  const count     = (allVideos[String(questionIndex)] || []).length;
  for (let i = 0; i < count; i++) {
    const v = document.getElementById(`b3-vid-${questionIndex}-${i}`);
    if (v) {
      v.pause();
      v.classList.toggle('b3-video-hidden', i !== videoIndex);
    }
  }
  const tabsWrap = tabEl && tabEl.closest('.b3-video-tabs');
  if (tabsWrap) {
    tabsWrap.querySelectorAll('.b3-video-tab').forEach((btn, i) => {
      btn.classList.toggle('active', i === videoIndex);
    });
  }
}

// ── B3 strategy screen renderer ────────────────────────────────────────────
function renderB3StrategyScreen(index, showStrategy) {
  const container = document.getElementById('screen-b3-strategy-body');
  if (!container) return;

  const item      = INTONATION_TREE[index];
  const isLast    = index === INTONATION_TREE.length - 1;
  const stepLabel = `Question ${index + 1} of ${INTONATION_TREE.length} · ${item.screenTitle}`;

  const yesIsTrigger = item.trigger === 'yes';
  // Split labels so skip is always top (grey), trigger always bottom (blue)
  const skipLabel    = yesIsTrigger ? item.noLabel  : item.yesLabel;
  const triggerLabel = yesIsTrigger ? item.yesLabel : item.noLabel;

  const videoHTML = showStrategy ? buildB3VideoHTML(index) : '';

  const strategyHTML = showStrategy ? `
    <div class="b3-strategy-card">
      <div class="b3-strategy-title">Strategy: ${item.strategy.title}</div>
      <div class="b3-strategy-body">${item.strategy.body}</div>
    </div>` : '';

  const buttonsHTML = showStrategy ? `
    <div class="btn-group">
      <button class="btn-primary"
              onclick="${isLast ? `goTo('screen-b4')` : `renderB3StrategyScreen(${index + 1}, false)`}">
        ${isLast ? 'Finish strategy tree →' : 'Continue to next question →'}
      </button>
      <button class="btn-secondary btn-sm" style="text-align:center;"
              onclick="saveProblemForTeacher()">
        Save for teacher discussion
      </button>
    </div>` : `
    <div class="b3-answer-options">
      <div class="b3-answer-block">
        <p class="b3-answer-label">${skipLabel}</p>
        <button class="btn-secondary" onclick="b3AnswerSkip(${index})">Next question →</button>
      </div>
      <div class="b3-answer-block">
        <p class="b3-answer-label">${triggerLabel}</p>
        <button class="btn-primary" onclick="b3AnswerTrigger(${index})">Show strategies</button>
      </div>
    </div>`;

  container.innerHTML = `
    <div class="b3-step-indicator">${stepLabel}</div>
    <div class="b3-question-card">
      <p class="b3-question-text">${item.question}</p>
    </div>
    ${strategyHTML}
    ${videoHTML}
    ${buttonsHTML}`;

  state.loopB.questionIndex = index;
  state.loopB.showStrategy  = showStrategy;
}

function b3AnswerTrigger(index) {
  // The answer that triggers showing the strategy
  renderB3StrategyScreen(index, true);
}

function b3AnswerSkip(index) {
  // The answer that skips the strategy and moves to next question
  const isLast = index === INTONATION_TREE.length - 1;
  if (isLast) {
    goTo('screen-b4');
  } else {
    renderB3StrategyScreen(index + 1, false);
  }
}

function b3StrategyBack() {
  const index = state.loopB.questionIndex;
  if (state.loopB.showStrategy) {
    // Collapse the strategy, stay on same question
    renderB3StrategyScreen(index, false);
  } else if (index > 0) {
    renderB3StrategyScreen(index - 1, false);
  } else {
    goTo('screen-b3');
  }
}

function saveProblemForTeacher() {
  state.loopB.teacherReview = true;
  _saveProblemToSession();
  alert('Saved for teacher review! Continue working through the strategies.');
}

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
