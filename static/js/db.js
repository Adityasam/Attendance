/**
 * ArchDB — IndexedDB wrapper for offline-first operation.
 * Stores: employees, projects, attendance, pendingOps.
 */
const ArchDB = (() => {
  const DB_NAME = 'arch_attendance';
  const DB_VERSION = 4;
  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('employees')) {
          const es = db.createObjectStore('employees', { keyPath: 'id' });
          es.createIndex('EmployeeCode', 'EmployeeCode', { unique: false });
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('attendance')) {
          const as = db.createObjectStore('attendance', { keyPath: 'localId', autoIncrement: true });
          as.createIndex('status', 'status', { unique: false });
          as.createIndex('EmployeeCode', 'EmployeeCode', { unique: false });
        }
        if (!db.objectStoreNames.contains('pendingOps')) {
          const ps = db.createObjectStore('pendingOps', { keyPath: 'opId', autoIncrement: true });
          ps.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('faceModels')) {
          db.createObjectStore('faceModels', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('appSettings')) {
          db.createObjectStore('appSettings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const req = fn(s);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  function getAll(store) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, 'readonly');
      const req = t.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  // ── Employees ─────────────────────────────────────────────────────────────

  async function cacheEmployees(employees) {
    if (!Array.isArray(employees) || !employees.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('employees', 'readwrite');
      const s = t.objectStore('employees');
      // Preserve locally-created records (negative temp IDs) during server refresh
      const getReq = s.getAll();
      getReq.onsuccess = () => {
        const localOnly = (getReq.result || []).filter(e => e.id < 0);
        s.clear();
        employees.forEach(emp => s.put(emp));
        localOnly.forEach(emp => s.put(emp));
      };
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  async function getEmployees() {
    return getAll('employees');
  }

  async function getEmployeesWithFaceData() {
    const all = await getAll('employees');
    return all.filter(e => e.FaceData && e.FaceData.length > 0);
  }

  async function mergeFaceData(faceEmployees) {
    if (!Array.isArray(faceEmployees) || !faceEmployees.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('employees', 'readwrite');
      const s = t.objectStore('employees');
      faceEmployees.forEach(emp => {
        const req = s.get(emp.id);
        req.onsuccess = () => {
          const existing = req.result;
          if (existing) {
            s.put({ ...existing, FaceData: emp.FaceData, Picture: emp.Picture });
          } else {
            s.put(emp);
          }
        };
      });
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  async function putEmployee(emp) {
    return tx('employees', 'readwrite', s => s.put(emp));
  }

  async function removeEmployee(id) {
    return tx('employees', 'readwrite', s => s.delete(id));
  }

  // ── Projects ──────────────────────────────────────────────────────────────

  async function cacheProjects(projects) {
    if (!Array.isArray(projects) || !projects.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('projects', 'readwrite');
      const s = t.objectStore('projects');
      // Preserve locally-created records (negative temp IDs) during server refresh
      const getReq = s.getAll();
      getReq.onsuccess = () => {
        const localOnly = (getReq.result || []).filter(p => p.id < 0);
        s.clear();
        projects.forEach(p => s.put(p));
        localOnly.forEach(p => s.put(p));
      };
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  async function getProjects() {
    return getAll('projects');
  }

  async function putProject(proj) {
    return tx('projects', 'readwrite', s => s.put(proj));
  }

  async function removeProject(id) {
    return tx('projects', 'readwrite', s => s.delete(id));
  }

  // ── Attendance ─────────────────────────────────────────────────────────────

  async function saveAttendance(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('attendance', 'readwrite');
      const req = t.objectStore('attendance').add({ ...record, status: record.status || 'pending' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getPendingAttendance() {
    const all = await getAll('attendance');
    return all.filter(r => r.status === 'pending');
  }

  async function markAllSynced() {
    const db = await openDB();
    const all = await getAll('attendance');
    return new Promise((resolve, reject) => {
      const t = db.transaction('attendance', 'readwrite');
      const s = t.objectStore('attendance');
      all.filter(r => r.status === 'pending').forEach(r => {
        s.put({ ...r, status: 'synced' });
      });
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  async function cacheTodayAttendance(serverRecords) {
    if (!Array.isArray(serverRecords)) return;
    const today = new Date().toLocaleDateString('en-CA');
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('attendance', 'readwrite');
      const s = t.objectStore('attendance');
      const getReq = s.getAll();
      getReq.onsuccess = () => {
        const all = getReq.result || [];
        // Remove old synced records for today — server data replaces them
        all.forEach(r => {
          if (r.status === 'synced' && (r.AttendanceDateTime || '').startsWith(today)) {
            s.delete(r.localId);
          }
        });
        // Keep pending records; skip server duplicates of pending ones
        const pendingKeys = new Set(
          all.filter(r => r.status === 'pending')
             .map(r => r.EmployeeCode + '|' + r.AttendanceDateTime)
        );
        serverRecords.forEach(r => {
          const key = r.EmployeeCode + '|' + r.AttendanceDateTime;
          if (!pendingKeys.has(key)) {
            const clean = { ...r };
            delete clean.localId;
            s.add({ ...clean, status: 'synced' });
          }
        });
      };
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  async function getTodayAttendance() {
    const today = new Date().toLocaleDateString('en-CA');
    const all = await getAll('attendance');
    return all.filter(r => (r.AttendanceDateTime || '').startsWith(today));
  }

  // ── Pending Operations (offline CRUD queue) ────────────────────────────────

  async function savePendingOp(op) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('pendingOps', 'readwrite');
      const req = t.objectStore('pendingOps').add({ ...op, status: 'pending', timestamp: Date.now() });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getPendingOps() {
    const all = await getAll('pendingOps');
    return all.filter(r => r.status === 'pending');
  }

  async function deleteOp(opId) {
    return tx('pendingOps', 'readwrite', s => s.delete(opId));
  }

  async function removePendingOpsForTempId(entity, tempId) {
    const all = await getAll('pendingOps');
    const matching = all.filter(op => op.entity === entity && op.tempId === tempId);
    if (!matching.length) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction('pendingOps', 'readwrite');
      const s = t.objectStore('pendingOps');
      matching.forEach(op => s.delete(op.opId));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  }

  // ── Dashboard summary (offline) ───────────────────────────────────────────

  async function getDashboardSummary() {
    const [employees, attendance] = await Promise.all([getEmployees(), getTodayAttendance()]);
    const total = employees.filter(e => e.Active).length;
    const presentCodes = new Set(attendance.map(r => r.EmployeeCode));
    const present = presentCodes.size;

    const allAtt = await getAll('attendance');
    const monthStr = new Date().toLocaleDateString('en-CA').slice(0, 7);
    const byDay = {};
    allAtt.filter(r => (r.AttendanceDateTime || '').startsWith(monthStr)).forEach(r => {
      const day = (r.AttendanceDateTime || '').slice(8, 10);
      if (!byDay[day]) byDay[day] = new Set();
      byDay[day].add(r.EmployeeCode);
    });
    const monthly = Object.entries(byDay).map(([day, codes]) => ({ day, count: codes.size }));

    return { total, present, absent: Math.max(0, total - present), monthly };
  }

  // ── Face Models (offline cache) ─────────────────────────────────────────────

  async function cacheFaceModel(name, data, type) {
    return tx('faceModels', 'readwrite', s => s.put({ name, data, type }));
  }

  async function getAllFaceModels() {
    return getAll('faceModels');
  }

  // ── App Settings (offline cache) ────────────────────────────────────────────

  async function cacheAppSettings(settings) {
    return tx('appSettings', 'readwrite', s => s.put({ key: 'main', ...settings }));
  }

  async function getAppSettings() {
    return tx('appSettings', 'readonly', s => s.get('main'));
  }

  return {
    cacheEmployees, getEmployees, getEmployeesWithFaceData, mergeFaceData,
    putEmployee, removeEmployee,
    cacheProjects, getProjects, putProject, removeProject,
    saveAttendance, getPendingAttendance, markAllSynced, cacheTodayAttendance, getTodayAttendance,
    savePendingOp, getPendingOps, deleteOp, removePendingOpsForTempId,
    getDashboardSummary,
    cacheFaceModel, getAllFaceModels,
    cacheAppSettings, getAppSettings
  };
})();
