/**
 * Sync module — pushes pending IndexedDB records to server when online.
 * Handles attendance sync + offline CRUD ops (employees, projects).
 */
const SyncModule = (() => {
  let _syncing = false;

  async function syncPending() {
    if (_syncing || !navigator.onLine) return;
    _syncing = true;
    try {
      const pending = await ArchDB.getPendingAttendance();
      if (!pending.length) return;

      const res = await fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending)
      });
      if (!res.ok) return;

      const result = await res.json();
      if (result.synced > 0) {
        await ArchDB.markAllSynced();
        console.log(`[Sync] ${result.synced} attendance records synced`);
      }
    } catch (e) {
      console.warn('[Sync] Attendance sync failed:', e.message);
    } finally {
      _syncing = false;
    }
  }

  async function syncPendingOps() {
    if (!navigator.onLine) return;
    const ops = await ArchDB.getPendingOps();
    if (!ops.length) return;

    let synced = 0;
    for (const op of ops) {
      try {
        const base = op.entity === 'employee' ? '/api/employees' : '/api/projects';
        let url, method, body;

        if (op.action === 'create') {
          url = base + '/';
          method = 'POST';
          body = JSON.stringify(op.data);
        } else if (op.action === 'update') {
          url = `${base}/${op.entityId}`;
          method = 'PUT';
          body = JSON.stringify(op.data);
        } else if (op.action === 'delete') {
          url = `${base}/${op.entityId}`;
          method = 'DELETE';
        }

        const fetchOpts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) fetchOpts.body = body;

        const res = await fetch(url, fetchOpts);
        if (res.ok) {
          // Remove temp IDB record for creates (server refresh will add real one)
          if (op.action === 'create' && op.tempId) {
            if (op.entity === 'employee') await ArchDB.removeEmployee(op.tempId);
            else await ArchDB.removeProject(op.tempId);
          }
          await ArchDB.deleteOp(op.opId);
          synced++;
        } else {
          console.warn(`[Sync] Op ${op.opId} failed: ${res.status}`);
        }
      } catch (e) {
        console.warn('[Sync] Op failed:', e.message);
      }
    }

    if (synced > 0) {
      console.log(`[Sync] ${synced} offline operation(s) synced`);
      if (typeof showToast === 'function') {
        showToast(`${synced} offline change(s) synced`, 'success');
      }
    }
  }

  async function refreshCache() {
    if (!navigator.onLine) return;
    try {
      const [eRes, pRes] = await Promise.all([
        fetch('/api/employees/face-data'),
        fetch('/api/projects/')
      ]);

      if (eRes.ok) {
        const faceEmps = await eRes.json();
        if (Array.isArray(faceEmps) && faceEmps.length) {
          await ArchDB.mergeFaceData(faceEmps);
        }
      }
      if (pRes.ok) {
        const projects = await pRes.json();
        if (Array.isArray(projects)) await ArchDB.cacheProjects(projects);
      }
      console.log('[Sync] Cache refreshed');
    } catch (e) {
      console.warn('[Sync] Cache refresh failed:', e.message);
    }
  }

  // Sequential: sync all pending data, then refresh cache, then notify pages
  async function fullSync() {
    await syncPending();
    await syncPendingOps();
    await refreshCache();
    window.dispatchEvent(new CustomEvent('offlineSynced'));
  }

  window.addEventListener('online', () => fullSync());

  document.addEventListener('DOMContentLoaded', () => {
    if (navigator.onLine) fullSync();
  });

  return { syncPending, syncPendingOps, refreshCache, fullSync };
})();
