const BACKEND_BASE = 'http://147.182.251.148:3001';

export default async function handler(req, res) {
  const { path } = req.query;

  if (!path || (Array.isArray(path) && path.length === 0)) {
    return res.status(400).json({ error: 'Missing path query parameter' });
  }

  const targetPath = Array.isArray(path) ? path[0] : path;
  const decodedPath = decodeURIComponent(targetPath);
  const targetUrl = `${BACKEND_BASE}${decodedPath.startsWith('/') ? '' : '/'}${decodedPath}`;

  try {
    const upstream = await fetch(targetUrl);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'Upstream render file fetch failed' });
    }

    const contentType = upstream.headers.get('content-type') || 'audio/wav';
    const contentLength = upstream.headers.get('content-length');
    const arrayBuffer = await upstream.arrayBuffer();

    res.setHeader('content-type', contentType);
    if (contentLength) {
      res.setHeader('content-length', contentLength);
    }

    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    return res
      .status(500)
      .json({ error: 'Proxy error (render-file)', detail: String(err) });
  }
}
