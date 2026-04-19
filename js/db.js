const DB = (() => {
  const DB_NAME    = 'practice-coach';
  const DB_VERSION = 1;
  let dbPromise    = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          s.createIndex('pieceName', 'pieceName', { unique: false });
        }
        if (!db.objectStoreNames.contains('audio')) {
          db.createObjectStore('audio', { keyPath: 'sessionId' });
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t     = db.transaction(storeName, mode);
      const store = t.objectStore(storeName);
      const req   = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = ()  => reject(req.error);
    }));
  }

  // Save session metadata + audio blob atomically
  function saveSession(session, audioBlob) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(['sessions', 'audio'], 'readwrite');
      t.onerror = () => reject(t.error);

      const sReq = t.objectStore('sessions').add(session);
      sReq.onsuccess = () => {
        const id   = sReq.result;
        const aReq = t.objectStore('audio').put({ sessionId: id, blob: audioBlob });
        aReq.onsuccess = () => resolve(id);
        aReq.onerror   = () => reject(aReq.error);
      };
    }));
  }

  function getSessionsForPiece(pieceName) {
    return open().then(db => new Promise((resolve, reject) => {
      const t     = db.transaction('sessions', 'readonly');
      const index = t.objectStore('sessions').index('pieceName');
      const req   = index.getAll(pieceName);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  function getAllSessions() {
    return open().then(db => new Promise((resolve, reject) => {
      const req = db.transaction('sessions', 'readonly').objectStore('sessions').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    }));
  }

  function getAudio(sessionId) {
    return tx('audio', 'readonly', s => s.get(sessionId)).then(r => r ? r.blob : null);
  }

  function deleteSession(id) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(['sessions', 'audio'], 'readwrite');
      t.onerror = () => reject(t.error);
      t.objectStore('sessions').delete(id);
      const aReq = t.objectStore('audio').delete(id);
      aReq.onsuccess = () => resolve();
      aReq.onerror   = () => reject(aReq.error);
    }));
  }

  // Update a single tag inside a session
  function markTagPracticed(sessionId, tagId) {
    return open().then(db => new Promise((resolve, reject) => {
      const t     = db.transaction('sessions', 'readwrite');
      const store = t.objectStore('sessions');
      const req   = store.get(sessionId);
      req.onsuccess = () => {
        const session = req.result;
        if (!session) return reject(new Error('Session not found'));
        const tag = session.tags.find(tg => tg.id === tagId);
        if (tag) tag.practiced = true;
        const upd = store.put(session);
        upd.onsuccess = () => resolve();
        upd.onerror   = () => reject(upd.error);
      };
      req.onerror = () => reject(req.error);
    }));
  }

  // Update all tags for a session (e.g. after label edits)
  function updateSessionTags(sessionId, tags) {
    return open().then(db => new Promise((resolve, reject) => {
      const t     = db.transaction('sessions', 'readwrite');
      const store = t.objectStore('sessions');
      const req   = store.get(sessionId);
      req.onsuccess = () => {
        const session = req.result;
        if (!session) return reject(new Error('Session not found'));
        session.tags = tags;
        const upd = store.put(session);
        upd.onsuccess = () => resolve();
        upd.onerror   = () => reject(upd.error);
      };
      req.onerror = () => reject(req.error);
    }));
  }

  return { open, saveSession, getSessionsForPiece, getAllSessions, getAudio, deleteSession, markTagPracticed, updateSessionTags };
})();
