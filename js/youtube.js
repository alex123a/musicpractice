const YouTubeModule = (() => {
  const API_KEY_STORAGE = 'yt_api_key';
  let container = null;

  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  function render(targetContainer, initialQuery) {
    container = targetContainer;
    const apiKey = getApiKey();

    container.innerHTML = `
      ${!apiKey ? '<p class="yt-status" style="margin-bottom:8px;">YouTube search unavailable — API key not configured.</p>' : ''}
      <div class="yt-search-row">
        <input class="yt-search-input" id="yt-query" type="text"
               placeholder="Search YouTube…" value="${escapeAttr(initialQuery)}"
               onkeydown="if(event.key==='Enter') YouTubeModule.search()"
               ${!apiKey ? 'disabled' : ''}>
        <button class="yt-search-btn" onclick="YouTubeModule.search()" ${!apiKey ? 'disabled style="opacity:0.5;cursor:default;"' : ''}>Search</button>
      </div>
      <div id="yt-results" class="yt-results"></div>`;
  }

  async function search() {
    const apiKey = getApiKey();
    const query  = document.getElementById('yt-query')?.value?.trim() || '';
    const resultsEl = document.getElementById('yt-results');
    if (!resultsEl) return;

    if (!apiKey) {
      resultsEl.innerHTML = '<p class="yt-status">YouTube search unavailable — API key not configured.</p>';
      return;
    }

    if (!query) {
      resultsEl.innerHTML = '<p class="yt-status">Enter a search term.</p>';
      return;
    }

    resultsEl.innerHTML = '<p class="yt-status">Searching…</p>';

    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
      const res  = await fetch(url);
      const data = await res.json();

      if (data.error) {
        resultsEl.innerHTML = `<p class="yt-status">Error: ${escapeHTML(data.error.message)}</p>`;
        return;
      }

      if (!data.items || data.items.length === 0) {
        resultsEl.innerHTML = '<p class="yt-status">No results found.</p>';
        return;
      }

      resultsEl.innerHTML = data.items.map(item => buildResultCard(item)).join('');
    } catch (err) {
      resultsEl.innerHTML = `<p class="yt-status">Network error. Check your connection.</p>`;
    }
  }

  function buildResultCard(item) {
    const videoId = item.id.videoId;
    const title   = escapeHTML(item.snippet.title);
    const thumb   = item.snippet.thumbnails?.medium?.url || '';

    return `
      <div class="yt-result-card" onclick="YouTubeModule.toggleEmbed(this, '${videoId}')">
        <div class="yt-result-header">
          <img class="yt-thumb" src="${thumb}" alt="">
          <div class="yt-result-title">${title}</div>
        </div>
        <div class="yt-embed-wrap" style="display:none">
          <iframe src="https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1"
                  allow="autoplay; encrypted-media" allowfullscreen></iframe>
        </div>
      </div>`;
  }

  function toggleEmbed(card, videoId) {
    const wrap = card.querySelector('.yt-embed-wrap');
    const isOpen = wrap.style.display !== 'none';

    // collapse all others
    document.querySelectorAll('.yt-embed-wrap').forEach(w => {
      if (w !== wrap) {
        w.style.display = 'none';
        const iframe = w.querySelector('iframe');
        if (iframe) iframe.src = iframe.src; // reset playback
      }
    });

    wrap.style.display = isOpen ? 'none' : 'block';
  }

  function escapeHTML(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
  }

  return { render, search, toggleEmbed };
})();
