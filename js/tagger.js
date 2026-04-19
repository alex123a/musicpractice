const TaggerModule = (() => {
  // State injected from app.js via init()
  let _state      = null;
  let _audioBlob  = null;
  let _audio      = null;
  let _raf        = null;
  let _container  = null;
  let _isSaving   = false;

  function init(appState) {
    _state = appState;
  }

  // Called when entering screen5 in playthrough mode
  function render(container, audioBlob) {
    _container = container;
    _audioBlob = audioBlob;
    _audio     = null;
    _raf       = null;

    container.innerHTML = buildHTML();
    attachEvents();
  }

  function buildHTML() {
    return `
      <div class="tagger-wrap">
        <!-- Player -->
        <div class="tagger-player">
          <div class="tagger-player-info">
            <span class="tagger-duration-label">Your recording</span>
            <span class="tagger-time" id="tg-time">0:00</span>
          </div>
          <div class="tagger-controls">
            <button class="s5-play-btn" id="tg-play-btn" onclick="TaggerModule.togglePlay()">▶</button>
            <div class="s5-progress-wrap" id="tg-progress-wrap">
              <div class="s5-progress-bar" id="tg-bar">
                <div class="s5-progress-fill" id="tg-fill"></div>
                <div class="tagger-markers" id="tg-markers"></div>
              </div>
            </div>
            <button class="s5-download-btn" onclick="TaggerModule.download()" title="Download recording">⬇</button>
          </div>
        </div>

        <!-- Tap to tag -->
        <div class="tagger-tap-zone" id="tg-tap-zone" onclick="TaggerModule.addTag()">
          <span class="tagger-tap-icon">⚑</span>
          <span>Tap to tag this moment</span>
        </div>

        <!-- Tag list -->
        <div class="tagger-tag-list" id="tg-tag-list"></div>

        <!-- Actions -->
        <div class="tagger-actions">
          <button class="btn-primary" id="tg-save-btn" onclick="TaggerModule.saveSession()">Save session</button>
          <button class="btn-secondary" onclick="TaggerModule.discardSession()">Discard</button>
        </div>
      </div>`;
  }

  function attachEvents() {
    const wrap = document.getElementById('tg-progress-wrap');
    if (wrap) wrap.addEventListener('click', seekClick);
  }

  function getOrCreateAudio() {
    if (_audio) return _audio;
    const url = URL.createObjectURL(_audioBlob);
    _audio = new Audio(url);
    _audio.onended = () => {
      _setPlayBtn(false);
      cancelAnimationFrame(_raf);
    };
    return _audio;
  }

  function togglePlay() {
    const audio = getOrCreateAudio();
    if (audio.paused) {
      audio.play();
      _setPlayBtn(true);
      tick();
    } else {
      audio.pause();
      _setPlayBtn(false);
      cancelAnimationFrame(_raf);
    }
  }

  function tick() {
    const audio = _audio;
    if (!audio || audio.paused) return;

    const elapsed  = audio.currentTime;
    const duration = audio.duration || 1;
    const pct      = Math.min((elapsed / duration) * 100, 100);

    const fill = document.getElementById('tg-fill');
    if (fill) fill.style.width = pct + '%';

    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60).toString().padStart(2, '0');
    const el = document.getElementById('tg-time');
    if (el) el.textContent = `${m}:${s}`;

    _raf = requestAnimationFrame(tick);
  }

  function seekClick(e) {
    const audio = _audio;
    if (!audio) return;
    const bar  = document.getElementById('tg-bar');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    // Only seek if not clicking a marker
    if (e.target.closest('.tg-marker')) return;
    if (audio.duration) audio.currentTime = pct * audio.duration;
  }

  function addTag() {
    const audio    = getOrCreateAudio();
    const wasPlaying = !audio.paused;
    if (wasPlaying) { audio.pause(); _setPlayBtn(false); cancelAnimationFrame(_raf); }

    const ts = audio.currentTime;
    const id = Date.now();

    // Build inline label form
    const list = document.getElementById('tg-tag-list');
    if (!list) return;

    const item = document.createElement('div');
    item.className  = 'tg-tag-item tg-tag-editing';
    item.dataset.id = id;
    item.dataset.ts = ts;
    item.innerHTML = `
      <span class="tg-tag-ts">${_fmtTime(ts)}</span>
      <input class="tg-tag-input text-input" type="text" placeholder="Describe the issue…" maxlength="80" autofocus>
      <div class="tg-tag-btns">
        <button class="btn-primary btn-sm" onclick="TaggerModule.confirmTag(${id})">Add</button>
        <button class="btn-secondary btn-sm" onclick="TaggerModule.cancelTag(${id})">Cancel</button>
      </div>`;
    list.appendChild(item);
    item.querySelector('.tg-tag-input').focus();

    if (wasPlaying) {
      // Resume after user has a moment to type
    }
  }

  function confirmTag(id) {
    const item  = document.querySelector(`.tg-tag-item[data-id="${id}"]`);
    if (!item) return;
    const ts    = parseFloat(item.dataset.ts);
    const label = item.querySelector('.tg-tag-input').value.trim() || 'Problem section';
    const tag   = { id, timestamp: ts, label, practiced: false };

    _state.tags.push(tag);
    _renderTagItem(item, tag);
    _placeMarker(tag);
    updateSaveBadge();
  }

  function cancelTag(id) {
    const item = document.querySelector(`.tg-tag-item[data-id="${id}"]`);
    if (item) item.remove();
  }

  function removeTag(id) {
    _state.tags = _state.tags.filter(t => t.id !== id);
    const item  = document.querySelector(`.tg-tag-item[data-id="${id}"]`);
    if (item) item.remove();
    const marker = document.querySelector(`.tg-marker[data-id="${id}"]`);
    if (marker) marker.remove();
    updateSaveBadge();
  }

  function seekToTag(ts) {
    const audio = getOrCreateAudio();
    if (audio.duration) audio.currentTime = ts;
  }

  function _renderTagItem(existingEl, tag) {
    existingEl.className  = 'tg-tag-item';
    existingEl.innerHTML  = `
      <button class="tg-tag-seek" onclick="TaggerModule.seekToTag(${tag.timestamp})">${_fmtTime(tag.timestamp)}</button>
      <span class="tg-tag-label">${_esc(tag.label)}</span>
      <button class="tg-tag-del" onclick="TaggerModule.removeTag(${tag.id})" title="Remove tag">✕</button>`;
  }

  function _placeMarker(tag) {
    const audio    = _audio || { duration: 0 };
    const duration = audio.duration || (_state.recordingTime || 1);
    const pct      = Math.min((tag.timestamp / duration) * 100, 100);
    const markers  = document.getElementById('tg-markers');
    if (!markers) return;
    const dot       = document.createElement('div');
    dot.className   = 'tg-marker';
    dot.dataset.id  = tag.id;
    dot.style.left  = pct + '%';
    dot.title       = tag.label;
    dot.onclick     = e => { e.stopPropagation(); seekToTag(tag.timestamp); };
    markers.appendChild(dot);
  }

  function updateSaveBadge() {
    const btn = document.getElementById('tg-save-btn');
    if (btn) btn.textContent = `Save session${_state.tags.length ? ` (${_state.tags.length} tag${_state.tags.length > 1 ? 's' : ''})` : ''}`;
  }

  async function saveSession() {
    if (_isSaving) return;
    _isSaving = true;
    const btn = document.getElementById('tg-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    const normalized = (_state.pieceName || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const session = {
      pieceName : normalized,
      displayName: _state.pieceName || 'Unknown piece',
      date      : new Date().toISOString(),
      duration  : _state.recordingTime,
      tags      : _state.tags.slice(),
    };

    try {
      const id = await DB.saveSession(session, _audioBlob);
      _state.savedSessionId = id;
      _state.tags = session.tags; // keep reference consistent
      if (btn) { btn.textContent = 'Saved ✓'; }
      // Update excerpt button badge
      refreshExcerptBadge();
      setTimeout(() => goTo('screen7'), 800);
    } catch (err) {
      console.error('Save failed', err);
      if (btn) { btn.disabled = false; btn.textContent = 'Save session'; }
      alert('Could not save session. Please try again.');
    }
    _isSaving = false;
  }

  function discardSession() {
    if (_state.tags.length === 0) {
      if (confirm('Discard this recording?')) _doDiscard();
    } else {
      if (confirm(`Discard recording and ${_state.tags.length} tag(s)?`)) _doDiscard();
    }
  }

  function _doDiscard() {
    _state.tags = [];
    stop();
    goTo('screen7');
  }

  function stop() {
    if (_audio) { try { _audio.pause(); } catch(e){} }
    cancelAnimationFrame(_raf);
    _audio  = null;
    _raf    = null;
  }

  function download() {
    if (!_audioBlob) return;
    const url = URL.createObjectURL(_audioBlob);
    const a   = document.createElement('a');
    a.href    = url;
    const name = (_state.pieceName || 'recording').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    a.download = `${name}_practice.webm`;
    a.click();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _setPlayBtn(playing) {
    const btn = document.getElementById('tg-play-btn');
    if (btn) btn.textContent = playing ? '⏸' : '▶';
  }

  function _fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function _esc(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { init, render, stop, togglePlay, addTag, confirmTag, cancelTag, removeTag, seekToTag, saveSession, discardSession, download };
})();
