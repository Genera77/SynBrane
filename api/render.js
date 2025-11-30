const BACKEND_BASE = 'http://147.182.251.148:3001';

export default async function handler(req, res) {
  const targetUrl = `${BACKEND_BASE}/api/render`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
      },
      body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    });

    const contentType = upstream.headers.get('content-type') || '';
    const text = await upstream.text();

    if (contentType.includes('application/json')) {
      try {
        const data = JSON.parse(text);

        if (data && typeof data === 'object' && typeof data.file === 'string') {
          data.file = `/api/render-file?path=${encodeURIComponent(data.file)}`;
        }

        res.setHeader('content-type', 'application/json');
        return res.status(upstream.status).json(data);
      } catch (err) {
        // Fall back to passthrough below if JSON parsing fails
      }
    }

    if (contentType) {
      res.setHeader('content-type', contentType);
    }
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(500).json({ error: 'Proxy error (render)', detail: String(err) });
  }
}
