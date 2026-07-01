/**
 * app.js — shared utilities: toast notifications, helpers.
 */

/* ── Modal stack: one dialog at a time ── */
const _modalStack = [];

function openModal(modal) {
  const openEl = document.querySelector('.modal.show');
  if (openEl) {
    const current = bootstrap.Modal.getInstance(openEl);
    if (current && current !== modal) {
      _modalStack.push(current);
      current.hide();
      openEl.addEventListener('hidden.bs.modal', () => modal.show(), { once: true });
      return;
    }
  }
  modal.show();
}

document.addEventListener('hidden.bs.modal', function(e) {
  const inst = bootstrap.Modal.getInstance(e.target);
  if (_modalStack.indexOf(inst) !== -1) return;
  if (_modalStack.length) _modalStack.pop().show();
});

/* ── Permission popup before browser prompt ── */
const _permConfigs = {
  location: {
    icon: 'fa-solid fa-location-dot',
    title: 'Allow Location Access',
    desc: 'This app needs your location for accurate attendance tracking.'
  },
  camera: {
    icon: 'fa-solid fa-camera',
    title: 'Allow Camera Access',
    desc: 'This app needs camera access to scan employee faces for attendance.'
  }
};

function askPermission(type) {
  return new Promise((resolve) => {
    const cfg = _permConfigs[type];
    if (!cfg) { resolve(true); return; }

    const modalEl = document.getElementById('permissionModal');
    if (!modalEl) { resolve(true); return; }

    document.getElementById('permIcon').className = cfg.icon + ' fa-3x text-primary';
    document.getElementById('permTitle').textContent = cfg.title;
    document.getElementById('permDesc').textContent = cfg.desc;

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    function cleanup() {
      document.getElementById('permAllowBtn').removeEventListener('click', onAllow);
      document.getElementById('permDenyBtn').removeEventListener('click', onDeny);
      modalEl.removeEventListener('hidden.bs.modal', onHidden);
    }

    let answered = false;
    function onAllow() { answered = true; modal.hide(); cleanup(); resolve(true); }
    function onDeny()  { answered = true; modal.hide(); cleanup(); resolve(false); }
    function onHidden() { if (!answered) { cleanup(); resolve(false); } }

    document.getElementById('permAllowBtn').addEventListener('click', onAllow);
    document.getElementById('permDenyBtn').addEventListener('click', onDeny);
    modalEl.addEventListener('hidden.bs.modal', onHidden, { once: true });

    modal.show();
  });
}

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: 'fa-circle-check',
    danger: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  const id = 'toast_' + Date.now();
  const html = `
    <div id="${id}" class="toast align-items-center text-bg-${type} border-0 show" role="alert">
      <div class="d-flex">
        <div class="toast-body d-flex align-items-center gap-2">
          <i class="fa-solid ${icons[type] || icons.info}"></i>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto"
                onclick="document.getElementById('${id}').remove()"></button>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', html);
  setTimeout(() => document.getElementById(id)?.remove(), duration);
}

function getInitials(name) {
  return (name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function imgFallback(img, text) {
  const div = document.createElement('div');
  const cls = img.className || '';
  if (cls.includes('att-card-avatar')) {
    div.className = 'att-card-avatar att-card-avatar--initials';
  } else if (cls.includes('emp-avatar-sm')) {
    div.className = 'emp-avatar-sm emp-avatar--initials-sm';
  } else {
    div.className = 'emp-avatar emp-avatar--initials';
  }
  div.textContent = text;
  img.replaceWith(div);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addDistanceLine(map, scanLng, scanLat, projLng, projLat) {
  const dist = haversineDistance(scanLat, scanLng, projLat, projLng);
  const label = dist >= 1000 ? (dist / 1000).toFixed(2) + ' km' : Math.round(dist) + ' m';
  const midLng = (scanLng + projLng) / 2;
  const midLat = (scanLat + projLat) / 2;
  const color = dist > 250 ? '#dc2626' : '#16a34a';

  map.addSource('dist-line', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[scanLng, scanLat], [projLng, projLat]] } }
  });
  map.addLayer({
    id: 'dist-line-layer', type: 'line', source: 'dist-line',
    paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [4, 3] }
  });

  const el = document.createElement('div');
  el.style.cssText = `background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;`;
  el.textContent = label;
  new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([midLng, midLat]).addTo(map);
}

function formatDateTime(dt) {
  if (!dt) return '—';
  return dt.replace('T', ' ').slice(0, 19);
}

/* ── Offline action gating ─────────────────────────────────────────────────
 * Mark any button/control with [data-online-only] and it auto-disables when
 * offline. Call applyOnlineState() after rendering dynamic markup.
 * Use requireOnline() to guard action handlers (defense in depth).            */
function applyOnlineState() {
  const offline = !navigator.onLine;
  document.querySelectorAll('[data-online-only]').forEach(el => {
    el.hidden = offline;          // remove from view entirely when offline
    el.disabled = offline;        // and disable as a backstop
    el.classList.toggle('d-none', offline);
  });
}

function requireOnline() {
  if (!navigator.onLine) {
    showToast('This action needs an internet connection', 'warning');
    return false;
  }
  return true;
}

window.addEventListener('online', applyOnlineState);
window.addEventListener('offline', applyOnlineState);
document.addEventListener('DOMContentLoaded', applyOnlineState);
