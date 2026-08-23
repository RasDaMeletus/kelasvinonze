// Proxy antara frontend Vercel dan Google Apps Script Web App.
// GET  -> aksi baca publik (?action=...&...params)
// POST -> aksi bendahara, body JSON { action, pin, ... }
//
// Catatan: Apps Script Web App (/exec) membalas dengan redirect 302 ke
// script.googleusercontent.com. fetch() bawaan Node akan mengubah method
// POST menjadi GET saat mengikuti redirect itu (sesuai spesifikasi fetch),
// yang akan membuang body JSON kita. Karena itu redirect di-ikuti manual
// di sini, mempertahankan method + body aslinya.

export default async function handler(req, res) {
  const gasUrl = process.env.GAS_API_URL;

  if (!gasUrl) {
    return res.status(500).json({
      success: false,
      error: 'GAS_API_URL belum diatur di Vercel Environment Variables.'
    });
  }

  try {
    if (req.method === 'GET') {
      const url = new URL(gasUrl);
      Object.entries(req.query || {}).forEach(([key, value]) => {
        if (key !== 'path' && value !== undefined) url.searchParams.set(key, value);
      });

      const response = await fetchFollowingRedirect(url.toString(), {
        method: 'GET',
        cache: 'no-store'
      });

      return sendGasResponse(res, response);
    }

    if (req.method === 'POST') {
      const response = await fetchFollowingRedirect(gasUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(req.body || {})
      });

      return sendGasResponse(res, response);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ success: false, error: 'Method tidak didukung.' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || String(error)
    });
  }
}

// Fetch dengan redirect manual: kalau Apps Script membalas 30x, request
// diulang ke Location header memakai method + body yang sama, bukan lewat
// auto-redirect fetch bawaan (yang bisa mengubah POST jadi GET).
async function fetchFollowingRedirect(url, options, maxHops = 3) {
  let currentUrl = url;
  let response = await fetch(currentUrl, { ...options, redirect: 'manual' });

  let hops = 0;
  while (response.status >= 300 && response.status < 400 && hops < maxHops) {
    const location = response.headers.get('location');
    if (!location) break;
    currentUrl = location;
    response = await fetch(currentUrl, { ...options, redirect: 'manual' });
    hops++;
  }

  return response;
}

async function sendGasResponse(res, response) {
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    payload = {
      success: false,
      error: 'Response Google Apps Script bukan JSON.',
      raw: text.slice(0, 500)
    };
  }
  return res.status(response.ok ? 200 : response.status).json(payload);
}
