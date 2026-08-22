export default async function handler(req, res) {
  const gasUrl = process.env.GAS_API_URL;

  if (!gasUrl) {
    return res.status(500).json({
      success: false,
      error: 'GAS_API_URL belum diatur di Vercel Environment Variables.'
    });
  }

  try {
    const url = new URL(gasUrl);
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (key !== 'path' && value !== undefined) url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store'
    });

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
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error?.message || String(error)
    });
  }
}
