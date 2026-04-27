const DashboardModule = (() => {
  let _currentPiece = null;   // piece name when drilling into piece detail

  // ── Public: render main dashboard ─────────────────────────────────────────
  async function render() {
    _currentPiece = null;
    const [events, streak] = await Promise.all([
      DB.getAllPracticeEvents(),
      DB.getStreakData(),
    ]);

    _renderStreakHeader(streak);
    _renderCalendar(streak ? streak.practicedDates || [] : []);
    _renderStats(events);
    _renderPiecesList(events);

    const listSection   = document.getElementById('dash-list-section');
    const detailSection = document.getElementById('dash-detail-section');
    if (listSection)   listSection.style.display   = 'block';
    if (detailSection) detailSection.style.display  = 'none';
  }

  // ── Public: show piece detail ──────────────────────────────────────────────
  async function showPiece(pieceName) {
    _currentPiece = pieceName;
    const events  = await DB.getEventsForPiece(pieceName);

    const listSection   = document.getElementById('dash-list-section');
    const detailSection = document.getElementById('dash-detail-section');
    if (listSection)   listSection.style.display   = 'none';
    if (detailSection) detailSection.style.display  = 'block';

    _renderPieceDetail(pieceName, events);
  }

  // ── Public: back to list ───────────────────────────────────────────────────
  function showPiecesList() { render(); }

  // ── Streak Header ──────────────────────────────────────────────────────────
  function _renderStreakHeader(streak) {
    const current = streak ? streak.current       : 0;
    const longest = streak ? streak.longest       : 0;
    const tokens  = streak ? streak.freezeTokens  : 0;

    const el = document.getElementById('dash-streak-header');
    if (!el) return;

    const tokenDots = Array.from({ length: 3 }, (_, i) =>
      `<span class="dash-token-dot${i < tokens ? ' filled' : ''}"></span>`
    ).join('');

    el.innerHTML = `
      <div class="dash-streak-row">
        <div class="dash-streak-main">
          <span class="dash-fire">${current > 0 ? '🔥' : '○'}</span>
          <span class="dash-streak-number">${current}</span>
          <span class="dash-streak-label">day streak</span>
        </div>
        <div class="dash-streak-meta">
          <span class="dash-longest">Best: ${longest} days</span>
        </div>
      </div>
      <div class="dash-tokens-row">
        <span class="dash-tokens-label">Rest days</span>
        <div class="dash-token-dots">${tokenDots}</div>
        <span class="dash-tokens-count">${tokens}/3 available</span>
      </div>`;
  }

  // ── Calendar ───────────────────────────────────────────────────────────────
  function _renderCalendar(practicedDates) {
    const el = document.getElementById('dash-calendar');
    if (!el) return;

    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth();

    const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const firstDay  = new Date(year, month, 1).getDay();  // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr  = _dateStr(now);

    const dateSet = new Set(practicedDates);

    // Build calendar grid
    let cells = '';
    // Day headers
    ['S','M','T','W','T','F','S'].forEach(d => {
      cells += `<div class="dash-cal-hdr">${d}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells += `<div class="dash-cal-cell dash-cal-empty"></div>`;
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const practiced = dateSet.has(dateKey);
      const isToday   = dateKey === todayStr;
      let cls = 'dash-cal-cell';
      if (practiced) cls += ' practiced';
      if (isToday)   cls += ' today';
      cells += `<div class="${cls}">${d}</div>`;
    }

    el.innerHTML = `
      <div class="dash-cal-month">${monthName}</div>
      <div class="dash-cal-grid">${cells}</div>`;
  }

  // ── Stats row ──────────────────────────────────────────────────────────────
  function _renderStats(events) {
    const el = document.getElementById('dash-stats-row');
    if (!el) return;

    const problems = _getProblems(events);
    const solved   = problems.filter(p => p.status === 'solved').length;
    const inProg   = problems.filter(p => p.status !== 'solved').length;
    const pieces   = new Set(events.map(e => e.piece)).size;

    el.innerHTML = `
      <div class="dash-stat">
        <div class="dash-stat-num">${events.length}</div>
        <div class="dash-stat-lbl">sessions</div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-num dash-stat-solved">${solved}</div>
        <div class="dash-stat-lbl">solved</div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-num dash-stat-inprog">${inProg}</div>
        <div class="dash-stat-lbl">in progress</div>
      </div>
      <div class="dash-stat">
        <div class="dash-stat-num">${pieces}</div>
        <div class="dash-stat-lbl">pieces</div>
      </div>`;
  }

  // ── Pieces list ────────────────────────────────────────────────────────────
  function _renderPiecesList(events) {
    const el = document.getElementById('dash-pieces-list');
    if (!el) return;

    if (!events.length) {
      el.innerHTML = `<p class="dash-empty">No practice sessions yet. Complete a Loop B cycle to see your progress here.</p>`;
      return;
    }

    // Group by piece
    const pieceMap = {};
    events.forEach(ev => {
      if (!pieceMap[ev.piece]) pieceMap[ev.piece] = [];
      pieceMap[ev.piece].push(ev);
    });

    // Sort pieces by most recent event
    const pieces = Object.entries(pieceMap).sort((a, b) => {
      const latestA = Math.max(...a[1].map(e => new Date(e.timestamp)));
      const latestB = Math.max(...b[1].map(e => new Date(e.timestamp)));
      return latestB - latestA;
    });

    el.innerHTML = pieces.map(([piece, evs]) => {
      const problems = _getProblems(evs);
      const solved   = problems.filter(p => p.status === 'solved').length;
      const inProg   = problems.filter(p => p.status !== 'solved').length;
      const lastDate = new Date(Math.max(...evs.map(e => new Date(e.timestamp))));
      const lastStr  = lastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      return `
        <div class="dash-piece-card" onclick="DashboardModule.showPiece(${_esc(JSON.stringify(piece))})">
          <div class="dash-piece-name">${_esc(piece)}</div>
          <div class="dash-piece-meta">
            <span class="dash-piece-solved">${solved} solved</span>
            <span class="dash-piece-sep">·</span>
            <span class="dash-piece-inprog">${inProg} in progress</span>
          </div>
          <div class="dash-piece-last">Last: ${lastStr}</div>
          <div class="dash-piece-arrow">›</div>
        </div>`;
    }).join('');
  }

  // ── Piece detail: timeline view ────────────────────────────────────────────
  function _renderPieceDetail(pieceName, events) {
    const titleEl = document.getElementById('dash-detail-title');
    if (titleEl) titleEl.textContent = pieceName;

    const problems = _getProblems(events);

    // Stats row
    const statsEl = document.getElementById('dash-detail-stats');
    if (statsEl) {
      const solved = problems.filter(p => p.status === 'solved').length;
      const inProg = problems.filter(p => p.status !== 'solved').length;
      statsEl.innerHTML = `
        <span class="dash-piece-solved">${solved} solved</span>
        <span class="dash-piece-sep">·</span>
        <span class="dash-piece-inprog">${inProg} in progress</span>`;
    }

    // Timeline: group problems by date of first identification
    const timelineEl = document.getElementById('dash-detail-timeline');
    if (!timelineEl) return;

    if (!problems.length) {
      timelineEl.innerHTML = `<p class="dash-empty">No problems logged yet for this piece.</p>`;
      return;
    }

    // Sort problems by firstIdentified desc
    const sorted = [...problems].sort((a, b) =>
      new Date(b.firstIdentified) - new Date(a.firstIdentified)
    );

    // Group by date
    const dateGroups = {};
    sorted.forEach(p => {
      const d = p.firstIdentified.split('T')[0];
      if (!dateGroups[d]) dateGroups[d] = [];
      dateGroups[d].push(p);
    });

    timelineEl.innerHTML = Object.entries(dateGroups).map(([date, probs]) => {
      const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString(undefined,
        { weekday: 'long', month: 'long', day: 'numeric' });

      const cards = probs.map((p, i) => _buildProblemCard(p, `${date}-${i}`)).join('');

      return `
        <div class="dash-timeline-date">${dateLabel}</div>
        ${cards}`;
    }).join('');
  }

  // ── Problem card (collapsed/expanded) ─────────────────────────────────────
  function _buildProblemCard(problem, uid) {
    const statusClass = problem.status === 'solved' ? 'solved' : 'inprog';
    const statusLabel = problem.status === 'solved' ? '✓ SOLVED' : '⚠ IN PROGRESS';
    const focusBadge  = problem.focusArea
      ? `<span class="dash-focus-badge">${_esc(problem.focusArea)}</span>`
      : '';

    // Build strategies list for expanded view
    const strategies = problem.sessions
      .filter(s => s.strategyUsed)
      .map(s => {
        const d = new Date(s.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const result = s.result === 'solved' ? ' — Solved ✓'
                     : s.result === 'partial' ? ' — Improved'
                     : '';
        return `<li>${_esc(s.strategyUsed)} <span class="dash-strat-date">(${d})${result}</span></li>`;
      }).join('');

    const firstDate    = new Date(problem.firstIdentified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const resolvedDate = problem.resolvedDate
      ? new Date(problem.resolvedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;

    return `
      <div class="dash-problem-card" id="dash-prob-${uid}">
        <div class="dash-problem-summary" onclick="DashboardModule.toggleProblem('dash-prob-${uid}')">
          <div class="dash-problem-left">
            <div class="dash-problem-stmt">${_esc(problem.statement)}</div>
            <div class="dash-problem-badges">
              ${focusBadge}
              <span class="dash-status-badge ${statusClass}">${statusLabel}</span>
            </div>
          </div>
          <div class="dash-problem-expand">›</div>
        </div>
        <div class="dash-problem-detail" style="display:none">
          <div class="dash-problem-meta">
            <span>First identified: ${firstDate}</span>
            ${resolvedDate ? `<span>Resolved: ${resolvedDate}</span>` : ''}
            <span>Sessions: ${problem.sessions.length}</span>
          </div>
          ${strategies ? `
            <div class="dash-problem-strategies">
              <div class="dash-strategies-label">Strategies applied:</div>
              <ul>${strategies}</ul>
            </div>` : '<p class="dash-empty" style="font-size:12px">No strategies recorded yet.</p>'}
        </div>
      </div>`;
  }

  // ── Toggle problem expansion ───────────────────────────────────────────────
  function toggleProblem(id) {
    const card   = document.getElementById(id);
    if (!card) return;
    const detail = card.querySelector('.dash-problem-detail');
    const arrow  = card.querySelector('.dash-problem-expand');
    if (!detail) return;
    const isOpen = detail.style.display !== 'none';
    detail.style.display = isOpen ? 'none' : 'block';
    if (arrow) arrow.textContent = isOpen ? '›' : '‹';
  }

  // ── Data helpers ───────────────────────────────────────────────────────────

  // Collapse events into unique problem objects
  function _getProblems(events) {
    const map = {};

    events.forEach(ev => {
      if (!ev.problemStatement) return;
      const key = `${ev.piece}||${ev.problemStatement}`;
      if (!map[key]) {
        map[key] = {
          statement      : ev.problemStatement,
          focusArea      : ev.focusArea,
          piece          : ev.piece,
          firstIdentified: ev.timestamp,
          resolvedDate   : null,
          sessions       : [],
          status         : 'in_progress',
        };
      }
      const prob = map[key];
      prob.sessions.push(ev);

      // Track first identified date
      if (new Date(ev.timestamp) < new Date(prob.firstIdentified)) {
        prob.firstIdentified = ev.timestamp;
      }

      // Update status based on most recent result_evaluated
      if (ev.completedAction === 'result_evaluated') {
        if (ev.result === 'solved') {
          prob.status      = 'solved';
          prob.resolvedDate = ev.timestamp;
        } else if (prob.status !== 'solved') {
          prob.status = ev.result || 'in_progress';
        }
      }
    });

    return Object.values(map);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function _dateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { render, showPiece, showPiecesList, toggleProblem };
})();
