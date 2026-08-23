/*
 * Kas Kelas 12.5 — helper bersama untuk halaman Admin & Transparansi.
 * (index.html/app.js portal siswa punya salinan sendiri, sengaja tidak
 * diubah supaya yang sudah jalan tidak ikut berisiko.)
 */
const API_BASE = '/api/gas';

function rupiah(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? '-' : '';
  return sign + 'Rp' + Math.abs(Math.round(number)).toLocaleString('id-ID');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiGet(action, params = {}) {
  const url = new URL(API_BASE, window.location.origin);
  url.searchParams.set('action', action);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  });
  return unwrapGasResponse(response);
}

async function apiPost(action, payload = {}) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  return unwrapGasResponse(response);
}

async function unwrapGasResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    throw new Error('Server mengembalikan response yang bukan JSON.');
  }
  if (!response.ok || !payload || payload.success !== true) {
    throw new Error((payload && payload.error) || `Request gagal (${response.status}).`);
  }
  return payload.data;
}

// Banner error global — supaya error JS apa pun terlihat di layar,
// bukan diam-diam gagal tanpa penjelasan.
window.addEventListener('error', function(e) {
  showGlobalError(e.message);
});

function showGlobalError(message) {
  let banner = document.getElementById('globalErr');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'globalErr';
    banner.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;' +
      'background:#FDECEC;color:#B91C1C;border:1px solid #F5D1D1;border-radius:10px;' +
      'padding:10px 14px;font-size:12px;box-shadow:0 10px 30px rgba(31,41,55,.15);';
    document.body.appendChild(banner);
  }
  banner.textContent = '⚠ Terjadi error: ' + message;
}
