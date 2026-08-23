// Proxy antara frontend Vercel dan Google Apps Script Web App.
// POST GAS harus mempertahankan method/body ketika Apps Script mengembalikan
// redirect 302 ke script.googleusercontent.com. fetch(..., redirect:'follow')
// dapat mengubah POST menjadi GET pada 302, sehingga action/body hilang dan
// GAS dapat mengembalikan 405. Di sini redirect diikuti manual dengan POST.

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

      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        redirect: 'follow'
      });

      return sendGasResponse(res, response);
    }

    if (req.method === 'POST') {
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

      const response = await postToGasPreservingRedirect(gasUrl, body);
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

async function postToGasPreservingRedirect(gasUrl, body) {
  const requestBody = JSON.stringify(body);

  // Apps Script biasanya mengembalikan 302 dari /exec ke
  // script.googleusercontent.com. Jangan biarkan fetch mengubah POST menjadi
  // GET. Ikuti redirect secara manual dan kirim ulang body POST.
  let url = gasUrl;
  const maxRedirects = 5;

  for (let i = 0; i <= maxRedirects; i++) {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json, text/plain, */*'
      },
      body: requestBody
    });

    const location = response.headers.get('location');
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);

    if (isRedirect && location) {
      url = new URL(location, url).toString();
      continue;
    }

    return response;
  }

  throw new Error('Terlalu banyak redirect dari Google Apps Script.');
}

async function sendGasResponse(res, response) {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  let payload;

  try {
    payload = JSON.parse(text);
  } catch (_) {
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

  return res.status(response.ok ? 200 : response.status).json(payload);
}
