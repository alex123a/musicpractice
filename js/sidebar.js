const SidebarModule = (() => {
  let _isOpen = false;
  const _excerptAudios  = {};  // sessionId → Audio object
  let _currentExcerptKey = null;  // `${sessionId}-${tagId}`
  let _excerptTimeout   = null;

  function toggle() { _isOpen ? close() : open(); }

  function open() {
    _isOpen = true;
    document.getElementById('sidebar').classList.add('sidebar-open');
    document.getElementById('sidebar-overlay').classList.add('sidebar-overlay-visible');
    render();
  }

  function close() {
    _isOpen = false;
    document.getElementById('sidebar').classList.remove('sidebar-open');
    document.getElementById('sidebar-overlay').classList.remove('sidebar-overlay-visible');
    _stopExcerpt();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  async function render() {
    const content = document.getElementById('sidebar-content');
    if (!content) return;
    content.innerHTML = '<p class="sb-loading">Loading…</p>';

    let sessions;
    try { sessions = await DB.getAllSessions(); }
    catch(e) { content.innerHTML = '<p class="sb-empty">Could not load sessions.</p>'; return; }

    if (!sessions.length) {
      content.innerHTML = '<p class="sb-empty">No sessions saved yet.</p>';
      return;
    }

    // Group by displayName, sort each group by date desc
    const groups = {};
    sessions.forEach(s => {
      const key = s.displayName || s.pieceName || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    Object.values(groups).forEach(arr => arr.sort((a, b) => new Date(b.date) - new Date(a.date)));

    // Sort group keys by most recent session
    const sortedKeys = Object.keys(groups).sort((a, b) =>
      new Date(groups[b][0].date) - new Date(groups[a][0].date)
    );

    content.innerHTML = sortedKeys.map((key, i) => {
      const groupSessions = groups[key];

      const sessionsHtml = groupSessions.map(session => {
        const dateStr = new Date(session.date).toLocaleDateString(undefined,
          { month: 'short', day: 'numeric', year: 'numeric' });
        const dur = _fmtTime(session.duration || 0);

        const tags = (session.tags || []).slice().sort((a, b) => a.timestamp - b.timestamp);
        const tagRows = tags.map(tag => {
          const p = tag.practiced;
          return `
            <div class="sb-tag${p ? ' sb-tag-practiced' : ''}" data-session="${session.id}" data-tag="${tag.id}">
              <button class="sb-excerpt-play-btn"
                      onclick="SidebarModule.playExcerpt(${session.id}, ${tag.id}, ${tag.timestamp})"
                      title="Play 5s excerpt">▶</button>
              <div class="sb-tag-info">
                <span class="sb-tag-ts">${_fmtTime(tag.timestamp)}</span>
                <span class="sb-tag-label">${_esc(tag.label)}</span>
              </div>
              <div class="sb-tag-actions">
                ${p
                  ? `<button class="sb-practiced-btn sb-practiced-done"
                            onclick="SidebarModule.setPracticed(${session.id}, ${tag.id}, false)"
                            title="Undo practiced">✓</button>`
                  : `<button class="sb-practiced-btn"
                            onclick="SidebarModule.setPracticed(${session.id}, ${tag.id}, true)"
                            title="Mark as practiced">○</button>`}
                <button class="sb-work-btn"
                        onclick="SidebarModule.workOn(${session.id}, ${tag.id})">Work →</button>
              </div>
            </div>`;
        }).join('');

        return `
          <div class="sb-session">
            <div class="sb-session-header">
              <span class="sb-session-date">${dateStr}</span>
              <span class="sb-session-dur">${dur}</span>
              <button class="sb-delete-btn"
                      onclick="SidebarModule.deleteSession(${session.id})"
                      title="Delete session">✕</button>
            </div>
            ${tagRows || '<p class="sb-no-tags">No tagged sections</p>'}
          </div>`;
      }).join('');

      return `
        <details class="sb-project"${i === 0 ? ' open' : ''}>
          <summary class="sb-project-summary">
            <span class="sb-project-name">${_esc(key)}</span>
            <span class="sb-project-count">${groupSessions.length} session${groupSessions.length !== 1 ? 's' : ''}</span>
          </summary>
          <div class="sb-project-body">${sessionsHtml}</div>
        </details>`;
    }).join('');
  }

  // ── Excerpt playback ────────────────────────────────────────────────────────
  async function playExcerpt(sessionId, tagId, timestamp) {
    const key = `${sessionId}-${tagId}`;

    if (_currentExcerptKey === key) {
      _stopExcerpt();
      return;
    }

    _stopExcerpt();
    _currentExcerptKey = key;
    _setExcerptBtnState(key, '…');

    let audio = _excerptAudios[sessionId];
    if (!audio) {
      try {
        const blob = await DB.getAudio(sessionId);
        if (!blob) { _currentExcerptKey = null; return; }
        audio = new Audio(URL.createObjectURL(blob));
        _excerptAudios[sessionId] = audio;
      } catch(e) { _currentExcerptKey = null; return; }
    }

    const doPlay = () => {
      if (_currentExcerptKey !== key) return;
      audio.currentTime = timestamp;
      audio.play();
      _setExcerptBtnState(key, '⏸');
      _excerptTimeout = setTimeout(() => {
        try { audio.pause(); } catch(e) {}
        _setExcerptBtnState(key, '▶');
        _currentExcerptKey = null;
      }, 5000);
      audio.onended = () => {
        clearTimeout(_excerptTimeout);
        _setExcerptBtnState(key, '▶');
        _currentExcerptKey = null;
      };
    };

    if (audio.readyState >= 1) doPlay();
    else audio.addEventListener('loadedmetadata', doPlay, { once: true });
  }

  function _stopExcerpt() {
    clearTimeout(_excerptTimeout);
    _excerptTimeout = null;
    if (_currentExcerptKey) {
      const sid = parseInt(_currentExcerptKey.split('-')[0]);
      const audio = _excerptAudios[sid];
      if (audio) { try { audio.pause(); } catch(e) {} }
      _setExcerptBtnState(_currentExcerptKey, '▶');
      _currentExcerptKey = null;
    }
  }

  function _setExcerptBtnState(key, text) {
    const [sid, tid] = key.split('-');
    const btn = document.querySelector(
      `.sb-tag[data-session="${sid}"][data-tag="${tid}"] .sb-excerpt-play-btn`
    );
    if (btn) btn.textContent = text;
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function setPracticed(sessionId, tagId, practiced) {
    try {
      await DB.setTagPracticed(sessionId, tagId, practiced);
      if (typeof refreshExcerptBadge === 'function') refreshExcerptBadge();
      render();
    } catch(e) { console.error(e); }
  }

  async function deleteSession(sessionId) {
    if (!confirm('Delete this session and all its tags?')) return;
    try {
      if (_excerptAudios[sessionId]) {
        try { _excerptAudios[sessionId].pause(); } catch(e) {}
        delete _excerptAudios[sessionId];
      }
      await DB.deleteSession(sessionId);
      if (typeof refreshExcerptBadge === 'function') refreshExcerptBadge();
      render();
    } catch(e) { console.error(e); alert('Could not delete session.'); }
  }

  async function workOn(sessionId, tagId) {
    let sessions;
    try { sessions = await DB.getAllSessions(); }
    catch(e) { console.error(e); return; }

    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const tag = (session.tags || []).find(t => t.id === tagId);
    if (!tag) return;

    state.pieceName       = session.displayName || session.pieceName || 'Your piece';
    state.mode            = 'excerpt';
    state.selectedTag     = { ...tag, sessionId };
    state.savedSessionId  = sessionId;
    state.selectedFocus   = '';

    if (typeof DroneModule !== 'undefined') DroneModule.stop();
    if (typeof MetronomeModule !== 'undefined') MetronomeModule.stop();
    if (typeof stopAllSessionPlayers === 'function') stopAllSessionPlayers();

    _stopExcerpt();
    close();
    goTo('screen2');
  }

  // ── Utilities ────────────────────────────────────────────────────────────────
  function _fmtTime(s) {
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { toggle, open, close, render, playExcerpt, setPracticed, deleteSession, workOn };
})();
