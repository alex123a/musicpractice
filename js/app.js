// ── State ──────────────────────────────────────────────────────────────────
const state = {
  pieceName: '',
  mode: '',          // 'playthrough' | 'excerpt'
  selectedFocus: '', // 'pitch' | 'rhythm'
  recordingTime: 0,
  recordedAudioURL: null,
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  timerInterval: null,
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
    renderMiniPanel();
  }

  if (screenId === 'screen5') {
    const mins = Math.floor(state.recordingTime / 60).toString().padStart(2, '0');
    const secs = (state.recordingTime % 60).toString().padStart(2, '0');
    setText('s5-recording-duration', `Your recording (${mins}:${secs})`);
  }
}

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
  goTo('screen2');
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
      const blob = new Blob(state.audioChunks, { type: 'audio/wav' });
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

function playS5Recording() {
  if (state.recordedAudioURL) {
    new Audio(state.recordedAudioURL).play();
  }
}

function resetRecording() {
  state.isRecording    = false;
  state.recordingTime  = 0;
  state.recordedAudioURL = null;
  state.audioChunks    = [];
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
  state.pieceName     = '';
  state.mode          = '';
  state.selectedFocus = '';
  DroneModule.stop();
  MetronomeModule.stop();
  document.querySelectorAll('.focus-item').forEach(f => f.classList.remove('selected'));
  document.getElementById('piece-name-input').value = '';
  goTo('screen0');
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Build waveform bars
  const waveform = document.getElementById('waveform');
  if (waveform) {
    waveform.innerHTML = Array.from({ length: 12 }, () => '<div class="waveform-bar" style="height:20px"></div>').join('');
  }
});
