// Proxy antara frontend Vercel dan Google Apps Script Web App.
//
// GET  -> diteruskan ke GAS sebagai GET.
// POST -> diteruskan ke GAS sebagai POST.
//
// Catatan penting:
// Google Apps Script Web App (URL /exec) dapat mengembalikan 302 ke
// script.googleusercontent.com. Redirect 302 pada POST tidak aman untuk
// dipertahankan sebagai POST: endpoint redirect GAS dapat membalas 405.
// Karena itu kita mengikuti redirect secara normal untuk POST (fetch akan
// mengubah 302 menjadi GET sesuai perilaku HTTP), lalu mengembalikan response
// GAS. Untuk action POST yang membutuhkan body, backend GAS harus menyediakan
// jalur GET yang setara; lihat Code.gs.

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

      // GAS Web App menggunakan redirect 302 setelah menerima request pada
      // /exec. Jangan mempertahankan POST secara manual ke URL redirect,
      // karena script.googleusercontent.com dapat mengembalikan 405.
      const response = await fetch(gasUrl, {
        method: 'POST',
        cache: 'no-store',
        redirect: 'follow',
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
