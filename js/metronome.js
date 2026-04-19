const MetronomeModule = (() => {
  const TIME_SIGS = ['4/4', '3/4', '2/4', '1/4', '6/8', '9/8', '12/8'];
  const SUBDIVISIONS = [
    { id: 'none',      label: 'None' },
    { id: 'eighth',    label: '♪ Eighth' },
    { id: 'triplet',   label: '♪³ Triplet' },
    { id: 'sixteenth', label: '♬ 16th' },
  ];

  const SIG_NUMERATORS   = { '4/4': 4, '3/4': 3, '2/4': 2, '1/4': 1, '6/8': 6, '9/8': 9, '12/8': 12 };
  const SIG_DENOMINATORS = { '4/4': 4, '3/4': 4, '2/4': 4, '1/4': 4, '6/8': 8, '9/8': 8, '12/8': 8 };

  let bpm          = 100;
  let timeSig      = '4/4';
  let subdivision  = 'none';
  let isRunning    = false;
  let currentBeat  = 0;
  let nextNoteTime = 0;
  let schedulerTimer = null;
  let audioCtx     = null;

  const LOOKAHEAD_MS    = 25;
  const SCHEDULE_AHEAD  = 0.1;

  function getBeatDuration() {
    return (60 / bpm) * (4 / SIG_DENOMINATORS[timeSig]);
  }

  function getBeatsPerMeasure() {
    return SIG_NUMERATORS[timeSig];
  }

  function getSubdivCount() {
    return { none: 1, eighth: 2, triplet: 3, sixteenth: 4 }[subdivision];
  }

  function scheduleClick(time, type) {
    // type: 'accent' | 'beat' | 'sub'
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'accent') {
      osc.frequency.value = 1760;
      gain.gain.setValueAtTime(0.7, time);
    } else if (type === 'beat') {
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, time);
    } else {
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.2, time);
    }

    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  function scheduleBeat(beatTime, isAccent) {
    scheduleClick(beatTime, isAccent ? 'accent' : 'beat');

    const subCount = getSubdivCount();
    const beatDur  = getBeatDuration();
    for (let i = 1; i < subCount; i++) {
      scheduleClick(beatTime + (beatDur * i / subCount), 'sub');
    }
  }

  function scheduler() {
    while (nextNoteTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
      const isAccent = currentBeat === 0;
      scheduleBeat(nextNoteTime, isAccent);

      // Highlight beat dot at the right time
      const capturedBeat = currentBeat;
      const delay = Math.max(0, (nextNoteTime - audioCtx.currentTime) * 1000);
      setTimeout(() => highlightBeat(capturedBeat), delay);

      currentBeat = (currentBeat + 1) % getBeatsPerMeasure();
      nextNoteTime += getBeatDuration();
    }
    schedulerTimer = setTimeout(scheduler, LOOKAHEAD_MS);
  }

  function highlightBeat(beat) {
    document.querySelectorAll('.beat-dots').forEach(dotRow => {
      const dots = dotRow.querySelectorAll('.beat-dot');
      dots.forEach((d, i) => {
        d.classList.remove('active');
        if (i === beat) d.classList.add('active');
      });
    });
  }

  function setPendulumDuration() {
    const dur = getBeatDuration();
    document.querySelectorAll('.pendulum-arm, .mini-pendulum-arm').forEach(arm => {
      arm.style.animationDuration = dur + 's';
    });
  }

  function start() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    isRunning    = true;
    currentBeat  = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
    scheduler();
    setPendulumDuration();
    document.querySelectorAll('.pendulum-arm, .mini-pendulum-arm').forEach(arm => arm.classList.add('swinging'));
    refreshRunState();
  }

  function stop() {
    clearTimeout(schedulerTimer);
    isRunning = false;
    document.querySelectorAll('.pendulum-arm, .mini-pendulum-arm').forEach(arm => {
      arm.classList.remove('swinging');
      arm.style.transform = 'rotate(0deg)';
    });
    document.querySelectorAll('.beat-dot').forEach(d => d.classList.remove('active'));
    refreshRunState();
  }

  function toggle() { isRunning ? stop() : start(); }

  function setBPM(val) {
    bpm = Math.min(300, Math.max(20, val));
    refreshBPMDisplay();
    if (isRunning) setPendulumDuration();
  }

  function setTimeSig(sig) {
    timeSig = sig;
    currentBeat = 0;
    refreshTimeSig();
    if (isRunning) { stop(); start(); }
    rebuildBeatDots();
  }

  function setSubdivision(sub) {
    subdivision = sub;
    refreshSubdivision();
  }

  function refreshBPMDisplay() {
    document.querySelectorAll('.bpm-display').forEach(el => el.textContent = bpm);
    document.querySelectorAll('.bpm-slider').forEach(el => el.value = bpm);
  }

  function refreshTimeSig() {
    document.querySelectorAll('.pill[data-timesig]').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.timesig === timeSig);
    });
  }

  function refreshSubdivision() {
    document.querySelectorAll('.pill[data-sub]').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.sub === subdivision);
    });
  }

  function refreshRunState() {
    document.querySelectorAll('.metro-start-btn').forEach(btn => {
      btn.textContent = isRunning ? '■ Stop' : '▶ Start';
      btn.classList.toggle('running', isRunning);
    });
  }

  function rebuildBeatDots() {
    document.querySelectorAll('.beat-dots').forEach(row => {
      const n = getBeatsPerMeasure();
      row.innerHTML = Array.from({ length: n }, (_, i) =>
        `<div class="beat-dot${i === 0 ? ' accent' : ''}"></div>`
      ).join('');
    });
  }

  function buildBeatDotsHTML() {
    return Array.from({ length: getBeatsPerMeasure() }, (_, i) =>
      `<div class="beat-dot${i === 0 ? ' accent' : ''}"></div>`
    ).join('');
  }

  function buildFullHTML() {
    const timeSigPills = TIME_SIGS.map(s =>
      `<button class="pill${s === timeSig ? ' active' : ''}" data-timesig="${s}" onclick="MetronomeModule.setTimeSig('${s}')">${s}</button>`
    ).join('');

    const subPills = SUBDIVISIONS.map(s =>
      `<button class="pill${s.id === subdivision ? ' active' : ''}" data-sub="${s.id}" onclick="MetronomeModule.setSubdivision('${s.id}')">${s.label}</button>`
    ).join('');

    return `
      <div class="metro-tool">
        <div class="pendulum-wrap">
          <div class="pendulum-container">
            <div class="pendulum-pivot"></div>
            <div class="pendulum-arm${isRunning ? ' swinging' : ''}"
                 style="animation-duration:${getBeatDuration()}s">
              <div class="pendulum-bob"></div>
            </div>
          </div>
          <div class="beat-dots">${buildBeatDotsHTML()}</div>
        </div>

        <div class="metro-bpm-row">
          <input type="range" class="bpm-slider" min="20" max="300" value="${bpm}"
                 oninput="MetronomeModule.setBPM(parseInt(this.value))">
          <div>
            <div class="bpm-display">${bpm}</div>
            <div class="bpm-label">BPM</div>
          </div>
        </div>

        <div>
          <div class="metro-row-label">Time signature</div>
          <div class="pill-row">${timeSigPills}</div>
        </div>

        <div>
          <div class="metro-row-label">Subdivision</div>
          <div class="pill-row">${subPills}</div>
        </div>

        <button class="metro-start-btn${isRunning ? ' running' : ''}" onclick="MetronomeModule.toggle()">
          ${isRunning ? '■ Stop' : '▶ Start'}
        </button>
      </div>`;
  }

  function buildMiniHTML() {
    return `
      <div class="mini-metro-row">
        <div class="mini-pendulum-container">
          <div class="mini-pendulum-arm${isRunning ? ' swinging' : ''}"
               style="animation-duration:${getBeatDuration()}s">
            <div class="mini-pendulum-bob"></div>
          </div>
        </div>
        <div class="mini-info">${bpm} BPM · ${timeSig}${subdivision !== 'none' ? ' · ' + subdivision : ''}</div>
        <button class="btn-secondary btn-sm mini-play-btn metro-start-btn${isRunning ? ' running' : ''}"
                onclick="MetronomeModule.toggle()">
          ${isRunning ? '■ Stop' : '▶ Start'}
        </button>
      </div>`;
  }

  function render(container) {
    container.innerHTML = buildFullHTML();
  }

  function renderMini(container) {
    container.innerHTML = buildMiniHTML();
  }

  return { render, renderMini, toggle, start, stop, setBPM, setTimeSig, setSubdivision, isRunning: () => isRunning };
})();
