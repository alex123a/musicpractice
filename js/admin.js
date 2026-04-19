const AdminModule = (() => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  let authenticated = false;

  function open() {
    if (!authenticated) {
      const pw = prompt('Admin password:');
      if (pw !== CONFIG.adminPassword) {
        alert('Incorrect password.');
        return;
      }
      authenticated = true;
    }
    const adminScreen = document.getElementById('screen-admin');
    render(adminScreen);
    goTo('screen-admin');
  }

  function render(container) {
    const savedUrls = getSavedUrls();
    const savedKey  = localStorage.getItem('yt_api_key') || '';

    const noteRows = NOTES.map(note => {
      const val = savedUrls[note] || CONFIG.droneVideoIds[note] || '';
      return `
        <div class="admin-row">
          <label>${note}</label>
          <input type="text" id="admin-drone-${note.replace('#','s')}"
                 value="${val}" placeholder="YouTube video ID">
        </div>`;
    }).join('');

    container.innerHTML = `
      <button class="back-btn" onclick="goTo('screen1'); AdminModule.resetAuth();">← Back</button>
      <div class="admin-panel">
        <div class="header" style="margin-bottom:1rem;">
          <h1>Admin panel</h1>
          <p>Update drone video IDs and API settings</p>
        </div>

        <div class="admin-section-label">Drone note video IDs (YouTube)</div>
        <p style="font-size:12px;color:var(--color-text-secondary);margin-bottom:8px;">
          Enter the 11-character YouTube video ID (the part after <code>watch?v=</code>)
        </p>
        <div class="admin-form">${noteRows}</div>

        <button class="btn-primary admin-save-btn" onclick="AdminModule.saveDroneUrls()" style="margin-top:4px;">
          Save drone URLs
        </button>

        <div class="admin-section-label" style="margin-top:16px;">YouTube API key</div>
        <div class="admin-row">
          <label style="min-width:60px;font-size:12px;">Key</label>
          <input type="text" id="admin-yt-key" value="${savedKey}" placeholder="YouTube Data API v3 key">
        </div>
        <button class="btn-primary admin-save-btn" onclick="AdminModule.saveYtKey()" style="margin-top:4px;">
          Save API key
        </button>

        <div class="admin-section-label" style="margin-top:16px;">Change admin password</div>
        <div class="admin-row">
          <label style="min-width:60px;font-size:12px;">New</label>
          <input type="password" id="admin-new-pw" placeholder="New password">
        </div>
        <button class="btn-secondary admin-save-btn" onclick="AdminModule.changePassword()" style="margin-top:4px;">
          Change password
        </button>
      </div>`;
  }

  function getSavedUrls() {
    try { return JSON.parse(localStorage.getItem('drone_urls') || '{}'); } catch(e) { return {}; }
  }

  function saveDroneUrls() {
    const urls = {};
    NOTES.forEach(note => {
      const id = `admin-drone-${note.replace('#','s')}`;
      const val = (document.getElementById(id)?.value || '').trim();
      if (val) urls[note] = val;
    });
    localStorage.setItem('drone_urls', JSON.stringify(urls));
    Object.assign(CONFIG.droneVideoIds, urls);
    alert('Drone URLs saved.');
  }

  function saveYtKey() {
    const key = (document.getElementById('admin-yt-key')?.value || '').trim();
    if (key) {
      localStorage.setItem('yt_api_key', key);
      alert('YouTube API key saved.');
    }
  }

  function changePassword() {
    const pw = (document.getElementById('admin-new-pw')?.value || '').trim();
    if (!pw) { alert('Password cannot be empty.'); return; }
    CONFIG.adminPassword = pw;
    document.getElementById('admin-new-pw').value = '';
    alert('Password changed for this session. Note: it resets on page reload unless you update config.js.');
  }

  function resetAuth() { authenticated = false; }

  return { open, render, saveDroneUrls, saveYtKey, changePassword, resetAuth };
})();
