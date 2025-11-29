const BACKEND_BASE = 'http://147.182.251.148:3000';

export default async function handler(req, res) {
  const targetUrl = `${BACKEND_BASE}/api/tunings`;

  try {
    const upstream = await fetch(targetUrl, { method: 'GET' });
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      res.setHeader('content-type', contentType);
    }
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error (tunings)', detail: String(err) });
  }
}
