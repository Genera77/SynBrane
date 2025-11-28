const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const config = require('./config');
const { listTunings, chordsForTuning, chordFrequencies, parseTuningId } = require('./tuning/tuningService');
const { renderToFile, playRealtime } = require('./audio');

const publicDir = path.join(process.cwd(), 'public');

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

function serveStatic(req, res) {
  const parsed = url.parse(req.url);
  const safePath = path.normalize(parsed.pathname).replace(/^\\|\/+/, '');
  let filePath = path.join(publicDir, safePath);
  if (!safePath || safePath === '/') {
    filePath = path.join(publicDir, 'index.html');
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentType = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        const parsed = data ? JSON.parse(data) : {};
        resolve(parsed);
      } catch (error) {
        reject(error);
      }
    });
  });
}

function handleTunings(req, res) {
  const payload = listTunings();
  sendJson(res, 200, {
    ...payload,
    baseFrequency: config.baseFrequency,
    defaultDuration: 4,
  });
}

function handleChords(req, res, query) {
  const tuningId = query.tuningId;
  const tuningType = query.tuningType || 'edo';
  const tuningValue = tuningType === 'edo' ? parseInt(query.tuningValue || '12', 10) : query.tuningValue;
  const { chords, roots } = chordsForTuning({ tuningId, tuningType, tuningValue });
  sendJson(res, 200, { chords, roots });
}

async function handlePlay(req, res) {
  try {
    const body = await parseBody(req);
    const { mode = 'harmony', rhythmSpeed = body.mappingFactor, bpm = 120, synthSettings, loopCount } = body;

    if (Array.isArray(body.sequence) && body.sequence.length) {
      const events = body.sequence.map((event, index) => {
        const parsed = parseTuningId(event.tuningId, event.tuningType, event.tuningValue);
        const frequencies = chordFrequencies({
          ...parsed,
          chord: event.chord,
          root: event.root || 0,
          baseFrequency: config.baseFrequency,
        });
        return {
          ...parsed,
          tuningId: event.tuningId || `${parsed.tuningType}:${parsed.tuningValue}`,
          chord: event.chord,
          root: event.root || 0,
          bar: event.bar ?? index,
          durationBars: event.durationBars || 1,
          frequencies,
        };
      });
      const playResult = await playRealtime({ mode, rhythmSpeed, bpm, events, synthSettings, loopCount });
      sendJson(res, 200, { status: 'ok', playResult });
      return;
    }

    const parsed = parseTuningId(body.tuningId, body.tuningType, body.tuningValue);
    const frequencies = chordFrequencies({
      ...parsed,
      chord: body.chord,
      root: body.root || 0,
      baseFrequency: config.baseFrequency,
    });
    const duration = body.duration || 4;
    const playResult = await playRealtime({
      ...parsed,
      chord: body.chord,
      root: body.root || 0,
      mode,
      duration,
      rhythmSpeed,
      bpm,
      frequencies,
      synthSettings,
      loopCount,
    });
    sendJson(res, 200, { status: 'ok', playResult });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

async function handleRender(req, res) {
  try {
    const body = await parseBody(req);
    const { mode = 'harmony', rhythmSpeed = body.mappingFactor, bpm = 120, synthSettings } = body;

    if (Array.isArray(body.sequence) && body.sequence.length) {
      const events = body.sequence.map((event, index) => {
        const parsed = parseTuningId(event.tuningId, event.tuningType, event.tuningValue);
        const frequencies = chordFrequencies({
          ...parsed,
          chord: event.chord,
          root: event.root || 0,
          baseFrequency: config.baseFrequency,
        });
        return {
          ...parsed,
          tuningId: event.tuningId || `${parsed.tuningType}:${parsed.tuningValue}`,
          chord: event.chord,
          root: event.root || 0,
          bar: event.bar ?? index,
          durationBars: event.durationBars || 1,
          frequencies,
        };
      });
      const renderResult = await renderToFile({ mode, bpm, rhythmSpeed, events, synthSettings });
      const relativeUrl = `/renders/${renderResult.filename}`;
      sendJson(res, 200, { status: 'ok', file: relativeUrl });
      return;
    }

    const parsed = parseTuningId(body.tuningId, body.tuningType, body.tuningValue);
    const frequencies = chordFrequencies({ ...parsed, chord: body.chord, root: body.root || 0, baseFrequency: config.baseFrequency });
    const duration = body.duration || 4;
    const renderResult = await renderToFile({ mode, frequencies, duration, rhythmSpeed, bpm, synthSettings });
    const relativeUrl = `/renders/${renderResult.filename}`;
    sendJson(res, 200, { status: 'ok', file: relativeUrl });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function handleRenders(req, res, pathname) {
  const filename = pathname.replace('/renders/', '');
  const filePath = path.join(config.renderOutputDir, filename);
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'audio/wav',
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    });
    res.end();
    return;
  }

  if (parsedUrl.pathname.startsWith('/api/tunings') && req.method === 'GET') {
    handleTunings(req, res);
    return;
  }

  if (parsedUrl.pathname.startsWith('/api/chords') && req.method === 'GET') {
    handleChords(req, res, parsedUrl.query);
    return;
  }

  if (parsedUrl.pathname.startsWith('/api/play') && req.method === 'POST') {
    await handlePlay(req, res);
    return;
  }

  if (parsedUrl.pathname.startsWith('/api/render') && req.method === 'POST') {
    await handleRender(req, res);
    return;
  }

  if (parsedUrl.pathname.startsWith('/renders/')) {
    handleRenders(req, res, parsedUrl.pathname);
    return;
  }

  const served = serveStatic(req, res);
  if (!served) {
    sendText(res, 404, 'Not found');
  }
});

server.listen(config.port, config.host, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://${config.host}:${config.port}`);
});
