const CONFIG = {
  droneVideoIds: {
    'C':  'KvUzRnbyT2w',
    'C#': 'utyKY-WhfLU',
    'D':  '0X4CN39EdwY',
    'D#': 'EIWMklVB1TU',
    'E':  'aId0Cy_bNCo',
    'F':  '9dCXpZ_KqV8',
    'F#': 'ZPFAuGlugTk',
    'G':  'WsRN5Euar2Q',
    'G#': '8c56yOf0Icc',
    'A':  'JvrJEVECzYk',
    'A#': 'Acjs0U6N3M0',
    'B':  'Fqa9_54XUog',
  },
  defaultAStandard: 442,
  adminPassword: 'music2024',
};

// Override drone URLs from localStorage (admin edits)
(function applyAdminOverrides() {
  try {
    const saved = localStorage.getItem('drone_urls');
    if (saved) {
      const overrides = JSON.parse(saved);
      Object.assign(CONFIG.droneVideoIds, overrides);
    }
  } catch (e) {}
})();
