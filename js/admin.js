const AdminModule = (() => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  let authenticated = false;
  let _activeTab    = 'drone'; // 'drone' | 'strategy' | 'settings'

  function open() {
    if (!authenticated) {
      const pw = prompt('Admin password:');
      if (pw !== CONFIG.adminPassword) { alert('Incorrect password.'); return; }
      authenticated = true;
    }
    render(document.getElementById('screen-admin'));
    goTo('screen-admin');
  }

  function setTab(tab) {
    _activeTab = tab;
    render(document.getElementById('screen-admin'));
  }

  // ── Storage helpers ────────────────────────────────────────────────────
  function getSavedDroneUrls() {
    try { return JSON.parse(localStorage.getItem('drone_urls') || '{}'); } catch(e) { return {}; }
  }

  function getStrategyVideos() {
    try { return JSON.parse(localStorage.getItem('b3_strategy_videos') || '{}'); } catch(e) { return {}; }
  }

  function saveStrategyVideos(data) {
    localStorage.setItem('b3_strategy_videos', JSON.stringify(data));
  }

  // ── Tab: Drone videos ──────────────────────────────────────────────────
  function renderDroneTab() {
    const savedUrls = getSavedDroneUrls();
    const noteRows  = NOTES.map(note => {
      const val = savedUrls[note] || CONFIG.droneVideoIds[note] || '';
      return `
        <div class="admin-row">
          <label>${note}</label>
          <input type="text" id="admin-drone-${note.replace('#','s')}"
                 value="${val}" placeholder="YouTube video ID">
        </div>`;
    }).join('');

    return `
      <div class="admin-section-label">Drone note video IDs (YouTube)</div>
      <p class="admin-hint">Enter the 11-character YouTube video ID (the part after <code>watch?v=</code>)</p>
      <div class="admin-form">${noteRows}</div>
      <button class="btn-primary admin-save-btn" onclick="AdminModule.saveDroneUrls()">
        Save drone URLs
      </button>`;
  }

  // ── Tab: Strategy videos ───────────────────────────────────────────────
  function renderStrategyTab() {
    // INTONATION_TREE is defined in app.js — access via the global
    const tree   = typeof INTONATION_TREE !== 'undefined' ? INTONATION_TREE : [];
    const videos = getStrategyVideos();

    const questionBlocks = tree.map((item, qi) => {
      const qVideos = (videos[String(qi)] || []).filter(Boolean);

      const videoRows = qVideos.length
        ? qVideos.map((url, vi) => `
            <div class="admin-video-row">
              <span class="admin-video-url" title="${_adminEsc(url)}">${_adminEsc(url)}</span>
              <button class="admin-video-delete" onclick="AdminModule.deleteStrategyVideo(${qi}, ${vi})"
                      title="Remove">×</button>
            </div>`).join('')
        : `<p class="admin-hint" style="margin:4px 0 6px;">No videos added yet.</p>`;

      return `
        <div class="admin-strategy-item">
          <div class="admin-strategy-item-title">Q${qi + 1} · ${item.screenTitle}</div>
          <div class="admin-video-list">${videoRows}</div>
          <div class="admin-add-video-row">
            <input type="text" id="admin-b3-url-${qi}"
                   placeholder="https://your-cdn.b-cdn.net/video.mp4">
            <button class="btn-secondary btn-sm admin-add-video-btn"
                    onclick="AdminModule.addStrategyVideo(${qi})">Add</button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="admin-section-label">Strategy video URLs (Bunny CDN)</div>
      <p class="admin-hint">Paste direct .mp4 URLs from your Bunny storage for each question. Multiple videos show as tabs.</p>
      <div class="admin-strategy-list">${questionBlocks}</div>`;
  }

  // ── Tab: Settings ──────────────────────────────────────────────────────
  function renderSettingsTab() {
    const savedKey = localStorage.getItem('yt_api_key') || '';
    return `
      <div class="admin-section-label">YouTube API key</div>
      <p class="admin-hint">Used for the audio reference search on screen 3.</p>
      <div class="admin-row">
        <label style="min-width:60px;font-size:12px;">Key</label>
        <input type="text" id="admin-yt-key" value="${savedKey}"
               placeholder="YouTube Data API v3 key">
      </div>
      <button class="btn-primary admin-save-btn" onclick="AdminModule.saveYtKey()">
        Save API key
      </button>

      <div class="admin-section-label" style="margin-top:16px;">Change admin password</div>
      <p class="admin-hint">Resets on page reload unless you update config.js.</p>
      <div class="admin-row">
        <label style="min-width:60px;font-size:12px;">New</label>
        <input type="password" id="admin-new-pw" placeholder="New password">
      </div>
      <button class="btn-secondary admin-save-btn" onclick="AdminModule.changePassword()">
        Change password
      </button>`;
  }

  // ── Main render ────────────────────────────────────────────────────────
  function render(container) {
    if (!container) return;

    const tabDefs = [
      { id: 'drone',    label: 'Drone'    },
      { id: 'strategy', label: 'Strategy Videos' },
      { id: 'settings', label: 'Settings' },
    ];

    const tabsHTML = tabDefs.map(t => `
      <button class="admin-tab${_activeTab === t.id ? ' active' : ''}"
              onclick="AdminModule.setTab('${t.id}')">${t.label}</button>`
    ).join('');

    let bodyHTML = '';
    if (_activeTab === 'drone')    bodyHTML = renderDroneTab();
    if (_activeTab === 'strategy') bodyHTML = renderStrategyTab();
    if (_activeTab === 'settings') bodyHTML = renderSettingsTab();

    container.innerHTML = `
      <button class="back-btn" onclick="goTo('screen1'); AdminModule.resetAuth();">← Back</button>
      <div class="admin-panel">
        <div class="header" style="margin-bottom:0.75rem;">
          <h1>Admin panel</h1>
        </div>
        <div class="admin-tabs">${tabsHTML}</div>
        <div class="admin-tab-body">${bodyHTML}</div>
      </div>`;
  }

  // ── Actions ────────────────────────────────────────────────────────────
  function saveDroneUrls() {
    const urls = {};
    NOTES.forEach(note => {
      const id  = `admin-drone-${note.replace('#','s')}`;
      const val = (document.getElementById(id)?.value || '').trim();
      if (val) urls[note] = val;
    });
    localStorage.setItem('drone_urls', JSON.stringify(urls));
    Object.assign(CONFIG.droneVideoIds, urls);
    alert('Drone URLs saved.');
  }

  function addStrategyVideo(qi) {
    const input = document.getElementById(`admin-b3-url-${qi}`);
    const url   = (input?.value || '').trim();
    if (!url) { alert('Please enter a URL first.'); return; }
    const data  = getStrategyVideos();
    if (!data[String(qi)]) data[String(qi)] = [];
    data[String(qi)].push(url);
    saveStrategyVideos(data);
    render(document.getElementById('screen-admin'));
  }

  function deleteStrategyVideo(qi, vi) {
    const data = getStrategyVideos();
    if (!data[String(qi)]) return;
    data[String(qi)].splice(vi, 1);
    saveStrategyVideos(data);
    render(document.getElementById('screen-admin'));
  }

  function saveYtKey() {
    const key = (document.getElementById('admin-yt-key')?.value || '').trim();
    if (key) { localStorage.setItem('yt_api_key', key); alert('YouTube API key saved.'); }
  }

  function changePassword() {
    const pw = (document.getElementById('admin-new-pw')?.value || '').trim();
    if (!pw) { alert('Password cannot be empty.'); return; }
    CONFIG.adminPassword = pw;
    document.getElementById('admin-new-pw').value = '';
    alert('Password changed for this session.');
  }

  function resetAuth() { authenticated = false; }

  // Escape helper local to admin (avoids dependency on app.js _esc at load time)
  function _adminEsc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return {
    open, setTab, render,
    saveDroneUrls, addStrategyVideo, deleteStrategyVideo,
    saveYtKey, changePassword, resetAuth,
  };
})();
