const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const config = require('./config');
const {
  listTunings,
  chordsForTuning,
  chordFrequencies,
  parseTuningId,
  resolveCustomChordDegrees,
} = require('./tuning/tuningService');
const { renderToFile, playRealtime } = require('./audio');

const publicDir = path.join(process.cwd(), 'public');
let loggedTuningsPayload = false;

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

function parseArpeggioFields(source = {}) {
  const raw = source.arpeggio || {};
  const rawPattern = (raw.pattern || source.arpeggioPattern || 'up').toLowerCase();
  const pattern = rawPattern === 'updown' ? 'updown' : rawPattern;
  return {
    enabled: raw.enabled ?? Boolean(source.arpeggioEnabled),
    pattern,
    rate: raw.rate || source.arpeggioRate || '1/8',
  };
}

function expandSequence(events = [], loopCount = 1) {
  const iterations = Math.max(1, Number(loopCount) || 1);
  if (!events.length || iterations === 1) return events;
  const barsPerLoop = events.reduce((max, event) => {
    const start = event.bar || 0;
    const duration = event.durationBars || 1;
    return Math.max(max, start + duration);
  }, 0) || events.length;
  const expanded = [];
  for (let loopIndex = 0; loopIndex < iterations; loopIndex += 1) {
    events.forEach((event) => {
      expanded.push({
        ...event,
        bar: (event.bar || 0) + loopIndex * barsPerLoop,
      });
    });
  }
  return expanded;
}

function handleTunings(req, res) {
  const payload = listTunings();
  if (!loggedTuningsPayload && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log('Tunings payload', payload);
    loggedTuningsPayload = true;
  }
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
    const baseArpeggio = parseArpeggioFields(body);

    if (Array.isArray(body.sequence) && body.sequence.length) {
      const events = body.sequence.map((event, index) => {
        const parsed = parseTuningId(event.tuningId, event.tuningType, event.tuningValue);
        let frequencies = Array.isArray(event.frequencies) && event.frequencies.length ? event.frequencies : [];
        let customChord = event.customChord;
        const arpeggio = parseArpeggioFields(event);
        if (!frequencies.length && event.customChord) {
          const resolved = resolveCustomChordDegrees({
            customChord: event.customChord,
            root: event.root || 0,
            tuningType: parsed.tuningType,
            tuningValue: parsed.tuningValue,
            baseFrequency: config.baseFrequency,
          });
          frequencies = resolved.frequencies;
          customChord = { ...event.customChord, degrees: resolved.degrees };
        }
        if (!frequencies.length) {
          frequencies = chordFrequencies({
            ...parsed,
            chord: event.chord,
            root: event.root || 0,
            baseFrequency: config.baseFrequency,
          });
        }
        const degrees = customChord?.degrees || event.customChord?.degrees || event.degrees || [];
        return {
          ...parsed,
          tuningId: event.tuningId || `${parsed.tuningType}:${parsed.tuningValue}`,
          chord: event.chord,
          root: event.root || 0,
          bar: event.bar ?? index,
          durationBars: event.durationBars || 1,
          frequencies,
          customChord,
          degrees,
          arpeggio,
        };
      });
      const expanded = expandSequence(events, loopCount || 1);
      const playResult = await playRealtime({ mode, rhythmSpeed, bpm, events: expanded, synthSettings, loopCount });
      sendJson(res, 200, { status: 'ok', playResult });
      return;
    }

    const parsed = parseTuningId(body.tuningId, body.tuningType, body.tuningValue);
    let frequencies = Array.isArray(body.frequencies) && body.frequencies.length ? body.frequencies : [];
    let customChord = body.customChord;
    if (!frequencies.length && body.customChord) {
      const resolved = resolveCustomChordDegrees({
        customChord: body.customChord,
        root: body.root || 0,
        tuningType: parsed.tuningType,
        tuningValue: parsed.tuningValue,
        baseFrequency: config.baseFrequency,
      });
      frequencies = resolved.frequencies;
      customChord = { ...body.customChord, degrees: resolved.degrees };
    }
    if (!frequencies.length) {
      frequencies = chordFrequencies({
        ...parsed,
        chord: body.chord,
        root: body.root || 0,
        baseFrequency: config.baseFrequency,
      });
    }
    const duration = body.duration || 4;
    const degrees = (customChord?.degrees || body.customChord?.degrees || body.degrees || []);
    const playResult = await playRealtime({
      ...parsed,
      chord: body.chord,
      root: body.root || 0,
      mode,
      duration,
      rhythmSpeed,
      bpm,
      frequencies,
      degrees,
      synthSettings,
      loopCount,
      customChord,
      arpeggio: baseArpeggio,
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
    const baseArpeggio = parseArpeggioFields(body);

    if (Array.isArray(body.sequence) && body.sequence.length) {
      const events = body.sequence.map((event, index) => {
        const parsed = parseTuningId(event.tuningId, event.tuningType, event.tuningValue);
        let frequencies = Array.isArray(event.frequencies) && event.frequencies.length ? event.frequencies : [];
        let customChord = event.customChord;
        const arpeggio = parseArpeggioFields(event);
        if (!frequencies.length && event.customChord) {
          const resolved = resolveCustomChordDegrees({
            customChord: event.customChord,
            root: event.root || 0,
            tuningType: parsed.tuningType,
            tuningValue: parsed.tuningValue,
            baseFrequency: config.baseFrequency,
          });
          frequencies = resolved.frequencies;
          customChord = { ...event.customChord, degrees: resolved.degrees };
        }
        if (!frequencies.length) {
          frequencies = chordFrequencies({
            ...parsed,
            chord: event.chord,
            root: event.root || 0,
            baseFrequency: config.baseFrequency,
          });
        }
        const degrees = customChord?.degrees || event.customChord?.degrees || event.degrees || [];
        return {
          ...parsed,
          tuningId: event.tuningId || `${parsed.tuningType}:${parsed.tuningValue}`,
          chord: event.chord,
          root: event.root || 0,
          bar: event.bar ?? index,
          durationBars: event.durationBars || 1,
          frequencies,
          customChord,
          degrees,
          arpeggio,
        };
      });
      const expanded = expandSequence(events, body.loopCount || 1);
      const renderResult = await renderToFile({ mode, bpm, rhythmSpeed, events: expanded, synthSettings });
      const relativeUrl = `/renders/${renderResult.filename}`;
      sendJson(res, 200, { status: 'ok', file: relativeUrl });
      return;
    }

    const parsed = parseTuningId(body.tuningId, body.tuningType, body.tuningValue);
    let frequencies = Array.isArray(body.frequencies) && body.frequencies.length ? body.frequencies : [];
    let customChord = body.customChord;
    if (!frequencies.length && body.customChord) {
      const resolved = resolveCustomChordDegrees({
        customChord: body.customChord,
        root: body.root || 0,
        tuningType: parsed.tuningType,
        tuningValue: parsed.tuningValue,
        baseFrequency: config.baseFrequency,
      });
      frequencies = resolved.frequencies;
      customChord = { ...body.customChord, degrees: resolved.degrees };
    }
    if (!frequencies.length) {
      frequencies = chordFrequencies({ ...parsed, chord: body.chord, root: body.root || 0, baseFrequency: config.baseFrequency });
    }
    const duration = body.duration || 4;
    const degrees = (customChord?.degrees || body.customChord?.degrees || body.degrees || []);
    const renderResult = await renderToFile({
      mode,
      frequencies,
      degrees,
      duration,
      rhythmSpeed,
      bpm,
      synthSettings,
      customChord,
      arpeggio: baseArpeggio,
    });
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
