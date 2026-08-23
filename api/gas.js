// Proxy antara frontend Vercel dan Google Apps Script Web App.
// GET  -> aksi baca publik (?action=...&...params)
// POST -> aksi bendahara, body JSON { action, pin, ... }
//
// Google Apps Script Web App biasanya mengembalikan redirect 30x.
// Redirect ditangani manual agar POST + body tetap dipertahankan.

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
        if (key !== 'path' && value !== undefined) {
          url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
        }
      });

      const response = await fetchFollowingRedirect(url.toString(), {
        method: 'GET',
        cache: 'no-store'
      });

      return sendGasResponse(res, response);
    }

    if (req.method === 'POST') {
      // Vercel biasanya sudah mem-parse JSON body, tetapi beberapa konfigurasi
      // dapat memberikan body sebagai string. Normalisasi supaya GAS selalu
      // menerima JSON object yang valid.
      let body = req.body || {};

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (_) {
          return res.status(400).json({
            success: false,
            error: 'Body request bukan JSON yang valid.'
          });
        }
      }

      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({
          success: false,
          error: 'Body request harus berupa object JSON.'
        });
      }

      const response = await fetchFollowingRedirect(gasUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify(body)
      });

      return sendGasResponse(res, response);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      success: false,
      error: 'Method tidak didukung.'
    });
  } catch (error) {
    console.error('GAS proxy error:', error);

    return res.status(500).json({
      success: false,
      error: error?.message || String(error)
    });
  }
}

/**
 * Follow redirect manually while preserving the original HTTP method and body.
 * This is important for Google Apps Script Web Apps because following the
 * redirect automatically can turn POST into GET and lose the request body.
 */
async function fetchFollowingRedirect(url, options, maxHops = 5) {
  let currentUrl = url;

  for (let hop = 0; hop <= maxHops; hop++) {
    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual'
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get('location');

    if (!location) {
      return response;
    }

    // Location can be relative or absolute.
    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new Error('Terlalu banyak redirect dari Google Apps Script.');
}

async function sendGasResponse(res, response) {
  const text = await response.text();

  let payload;

  try {
    payload = JSON.parse(text);
  } catch (_) {
    // Jangan membocorkan seluruh HTML Google ke frontend.
    // Ambil sedikit informasi untuk diagnosis saja.
    const contentType = response.headers.get('content-type') || '';

    console.error('Google Apps Script returned non-JSON:', {
      status: response.status,
      contentType,
      preview: text.slice(0, 1000)
    });

    return res.status(502).json({
      success: false,
      error: 'Response Google Apps Script bukan JSON.',
      status: response.status,
      contentType,
      raw: text.slice(0, 500)
    });
  }

  // GAS JSON sudah valid. Pertahankan payload apa adanya.
  return res.status(response.ok ? 200 : response.status).json(payload);
}
