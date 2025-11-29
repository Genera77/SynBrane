// Base URL for the backend API.
// Default to empty string (relative) so Vercel can proxy requests on the same origin.
// Allow override from window for local development when needed.
const API_BASE =
  (typeof window !== 'undefined' && window.SYNBRANE_API_BASE) || '';

function apiUrl(path) {
  // ensure path starts with /
  if (!path.startsWith('/')) path = `/${path}`;
  return `${API_BASE}${path}`;
}

const chordSwitcher = document.getElementById('chordSwitcher');
const chordLabel = document.getElementById('activeChordLabel');
const chordTuning = document.getElementById('chordTuning');
const noteCircle = document.getElementById('noteCircle');
const clearChordBtn = document.getElementById('clearChord');
const playActiveBtn = document.getElementById('playActiveChord');
const modeSelect = document.getElementById('modeSelect');
const bpmInput = document.getElementById('bpm');
const bpmLabel = document.getElementById('bpmLabel');
const rhythmInput = document.getElementById('rhythmSpeed');
const rhythmLabel = document.getElementById('rhythmLabel');
const waveformSelect = document.getElementById('waveform');
const attackInput = document.getElementById('attack');
const attackLabel = document.getElementById('attackLabel');
const decayInput = document.getElementById('decay');
const decayLabel = document.getElementById('decayLabel');
const sustainInput = document.getElementById('sustain');
const sustainLabel = document.getElementById('sustainLabel');
const releaseInput = document.getElementById('release');
const releaseLabel = document.getElementById('releaseLabel');
const cutoffInput = document.getElementById('cutoff');
const cutoffLabel = document.getElementById('cutoffLabel');
const resonanceInput = document.getElementById('resonance');
const resonanceLabel = document.getElementById('resonanceLabel');
const playLoopBtn = document.getElementById('playLoop');
const stopLoopBtn = document.getElementById('stopLoop');
const renderLoopBtn = document.getElementById('renderLoop');
const statusEl = document.getElementById('status');
const player = document.getElementById('player');
const savePatchBtn = document.getElementById('savePatch');
const loadPatchBtn = document.getElementById('loadPatch');
const patchFileInput = document.getElementById('patchFile');

const NOTE_NAMES_12 = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const defaultSynth = {
  waveform: 'saw',
  envelope: {
    attackMs: 40,
    decayMs: 200,
    sustainLevel: 0.7,
    releaseMs: 800,
  },
  filter: {
    cutoffHz: 12000,
    resonance: 0.2,
  },
};

const state = {
  tunings: [],
  baseFrequency: 440,
  activeChord: 0,
  chords: Array.from({ length: 4 }, () => ({ tuningId: null, notes: [0, 4, 7] })),
  mode: 'harmony',
  bpm: 120,
  rhythmSpeed: 0.3,
  synth: JSON.parse(JSON.stringify(defaultSynth)),
  loopPreview: { ctx: null, timer: null, stop: false },
};

function updateStatus(text) {
  statusEl.textContent = text || '';
}

function getTuning(id) {
  return state.tunings.find((t) => t.id === id);
}

function getDegreeSpan(tuning) {
  if (!tuning) return 12;
  if (tuning.type === 'edo') return tuning.value || 12;
  return tuning.intervals?.length || tuning.count || 12;
}

function degreeLabel(tuning, degree) {
  if (tuning?.type === 'edo' && tuning.value === 12) {
    return NOTE_NAMES_12[degree % 12];
  }
  return `deg ${degree}`;
}

function degreeToFrequency(tuningId, degree) {
  const tuning = getTuning(tuningId);
  if (!tuning) return state.baseFrequency;
  if (tuning.type === 'edo') {
    return state.baseFrequency * 2 ** (degree / tuning.value);
  }
  const intervals = tuning.intervals || [];
  const span = intervals.length || 1;
  const wrapped = ((degree % span) + span) % span;
  const oct = Math.floor(degree / span);
  const cents = intervals[wrapped] || 0;
  return state.baseFrequency * 2 ** oct * 2 ** (cents / 1200);
}

function normalizeChordNotes(chord) {
  const tuning = getTuning(chord.tuningId);
  const span = getDegreeSpan(tuning);
  const maxDeg = Math.max(span, span * 2);
  chord.notes = (chord.notes || [])
    .map((deg) => {
      const safe = Number.isFinite(deg) ? deg : 0;
      return Math.max(0, Math.min(safe, maxDeg - 1));
    });
  if (!chord.notes.length) chord.notes = [];
  return chord;
}

function renderChordSwitcher() {
  chordSwitcher.innerHTML = '';
  state.chords.forEach((_, idx) => {
    const btn = document.createElement('button');
    btn.textContent = idx + 1;
    btn.className = idx === state.activeChord ? 'active' : '';
    btn.onclick = () => {
      state.activeChord = idx;
      renderActiveChord();
    };
    chordSwitcher.appendChild(btn);
  });
}

function renderTuningOptions() {
  chordTuning.innerHTML = '';
  state.tunings.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    chordTuning.appendChild(opt);
  });
}

function renderCircle() {
  const chord = state.chords[state.activeChord];
  const tuning = getTuning(chord.tuningId);
  const span = getDegreeSpan(tuning);
  const basePoints = tuning?.type === 'edo' && tuning.value === 12 ? 12 : Math.min(span * 2, 32);
  const highest = chord.notes.length ? Math.max(...chord.notes) + 1 : 0;
  const totalPoints = Math.max(basePoints, highest, span);
  noteCircle.innerHTML = '';
  const radius = 115;
  const center = 130;
  for (let i = 0; i < totalPoints; i += 1) {
    const angle = (Math.PI * 2 * i) / totalPoints - Math.PI / 2;
    const x = center + radius * Math.cos(angle) - 22;
    const y = center + radius * Math.sin(angle) - 22;
    const point = document.createElement('div');
    point.className = `note-point ${chord.notes.includes(i) ? 'active' : ''}`;
    point.style.left = `${x}px`;
    point.style.top = `${y}px`;
    point.textContent = degreeLabel(tuning, i % span);
    point.title = `Degree ${i}`;
    point.onclick = () => {
      if (chord.notes.includes(i)) {
        chord.notes = chord.notes.filter((n) => n !== i);
      } else {
        chord.notes = [...chord.notes, i].sort((a, b) => a - b);
      }
      normalizeChordNotes(chord);
      renderCircle();
    };
    noteCircle.appendChild(point);
  }
}

function renderActiveChord() {
  renderChordSwitcher();
  const chord = normalizeChordNotes(state.chords[state.activeChord]);
  if (!chord.tuningId && state.tunings[0]) {
    chord.tuningId = state.tunings[0].id;
  }
  chordLabel.textContent = `Chord ${state.activeChord + 1}`;
  chordTuning.value = chord.tuningId || '';
  renderCircle();
}

function syncSynthLabels() {
  bpmLabel.textContent = `${state.bpm} BPM`;
  rhythmLabel.textContent = `${state.rhythmSpeed.toFixed(2)}×`;
  attackLabel.textContent = `${state.synth.envelope.attackMs} ms`;
  decayLabel.textContent = `${state.synth.envelope.decayMs} ms`;
  sustainLabel.textContent = state.synth.envelope.sustainLevel.toFixed(2);
  releaseLabel.textContent = `${state.synth.envelope.releaseMs} ms`;
  cutoffLabel.textContent = `${state.synth.filter.cutoffHz} Hz`;
  resonanceLabel.textContent = state.synth.filter.resonance.toFixed(2);
}

function attachControlListeners() {
  chordTuning.onchange = (e) => {
    const chord = state.chords[state.activeChord];
    chord.tuningId = e.target.value;
    normalizeChordNotes(chord);
    renderCircle();
  };

  clearChordBtn.onclick = () => {
    state.chords[state.activeChord].notes = [];
    renderCircle();
  };

  playActiveBtn.onclick = () => playChord(state.activeChord);

  modeSelect.onchange = (e) => {
    state.mode = e.target.value;
  };

  bpmInput.oninput = (e) => {
    state.bpm = Number(e.target.value);
    syncSynthLabels();
  };

  rhythmInput.oninput = (e) => {
    state.rhythmSpeed = Number(e.target.value);
    syncSynthLabels();
  };

  waveformSelect.onchange = (e) => {
    state.synth.waveform = e.target.value;
  };

  attackInput.oninput = (e) => {
    state.synth.envelope.attackMs = Number(e.target.value);
    syncSynthLabels();
  };
  decayInput.oninput = (e) => {
    state.synth.envelope.decayMs = Number(e.target.value);
    syncSynthLabels();
  };
  sustainInput.oninput = (e) => {
    state.synth.envelope.sustainLevel = Number(e.target.value);
    syncSynthLabels();
  };
  releaseInput.oninput = (e) => {
    state.synth.envelope.releaseMs = Number(e.target.value);
    syncSynthLabels();
  };
  cutoffInput.oninput = (e) => {
    state.synth.filter.cutoffHz = Number(e.target.value);
    syncSynthLabels();
  };
  resonanceInput.oninput = (e) => {
    state.synth.filter.resonance = Number(e.target.value);
    syncSynthLabels();
  };

  playLoopBtn.onclick = () => playLoop();
  renderLoopBtn.onclick = () => renderLoop();
  stopLoopBtn.onclick = () => stopPreview('Stopped');

  savePatchBtn.onclick = () => savePatch();
  loadPatchBtn.onclick = () => patchFileInput.click();
  patchFileInput.onchange = (e) => {
    const file = e.target.files?.[0];
    if (file) loadPatch(file);
    patchFileInput.value = '';
  };
}

function ensureChordComplete(chord, index) {
  if (!chord.tuningId) {
    throw new Error(`Chord ${index + 1} is missing a tuning.`);
  }
  if (!chord.notes?.length) {
    throw new Error(`Chord ${index + 1} has no notes.`);
  }
}

function chordToEvent(chord, index) {
  ensureChordComplete(chord, index);
  const frequencies = chord.notes.map((deg) => degreeToFrequency(chord.tuningId, deg));
  return {
    bar: index,
    durationBars: 1,
    tuningId: chord.tuningId,
    root: 0,
    chordType: 'custom',
    chord: { id: `circle-${index}`, degrees: [...chord.notes] },
    customChord: { degrees: [...chord.notes] },
    frequencies,
    arpeggioEnabled: false,
    arpeggioPattern: 'up',
    arpeggioRate: '1/8',
  };
}

function getPreviewContext() {
  if (state.loopPreview.ctx) {
    return state.loopPreview.ctx;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  state.loopPreview.ctx = new AudioCtx();
  state.loopPreview.stop = false;
  return state.loopPreview.ctx;
}

function applyEnvelope(gainNode, ctx, startTime, durationSec, envelope) {
  const attack = Math.max(0, (envelope.attackMs || 0) / 1000);
  const decay = Math.max(0, (envelope.decayMs || 0) / 1000);
  const sustain = Math.max(0, Math.min(1, envelope.sustainLevel ?? 0.7));
  const release = Math.max(0, (envelope.releaseMs || 0) / 1000);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(1, startTime + attack);
  gainNode.gain.linearRampToValueAtTime(sustain, startTime + attack + decay);
  gainNode.gain.setValueAtTime(sustain, startTime + durationSec);
  gainNode.gain.linearRampToValueAtTime(0, startTime + durationSec + release);

  return durationSec + release;
}

function scheduleChordPreview(chord, startTime, durationSec) {
  const tuning = getTuning(chord.tuningId);
  if (!tuning) throw new Error('Chord missing tuning');
  if (!chord.notes?.length) throw new Error('Chord has no notes');

  const ctx = getPreviewContext();
  const envelope = state.synth.envelope || defaultSynth.envelope;
  const filterCfg = state.synth.filter || {};
  const freqs = chord.notes.map((deg) => degreeToFrequency(chord.tuningId, deg));

  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = state.synth.waveform || 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    const gain = ctx.createGain();
    let lastNode = osc;

    if (filterCfg.cutoffHz) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterCfg.cutoffHz, startTime);
      const resonance = Math.max(0.0001, filterCfg.resonance || 0);
      filter.Q.setValueAtTime(resonance * 12 + 0.0001, startTime);
      lastNode.connect(filter);
      lastNode = filter;
    }

    const totalDuration = applyEnvelope(gain, ctx, startTime, durationSec, envelope);
    lastNode.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + totalDuration + 0.05);
  });

  const releaseSec = Math.max(0, (state.synth.envelope?.releaseMs || 0) / 1000);
  return durationSec + releaseSec;
}

async function playChord(index) {
  try {
    stopPreview();
    const chord = state.chords[index];
    ensureChordComplete(chord, index);

    const ctx = getPreviewContext();
    const startTime = ctx.currentTime + 0.05;
    const sustainDuration = 1;
    const total = scheduleChordPreview(chord, startTime, sustainDuration);

    updateStatus(`Previewing chord ${index + 1}`);
    state.loopPreview.timer = setTimeout(() => stopPreview('Preview ended'), (total + 0.2) * 1000);

    const payload = {
      tuningId: chord.tuningId,
      chord: { id: `circle-${index}`, degrees: [...chord.notes] },
      chordType: 'custom',
      root: 0,
      frequencies: chord.notes.map((deg) => degreeToFrequency(chord.tuningId, deg)),
      mode: state.mode,
      bpm: state.bpm,
      rhythmSpeed: state.rhythmSpeed,
      synthSettings: state.synth,
    };
    fetch(apiUrl('/api/play'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (error) {
    updateStatus(error.message);
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

function buildLoopPayload() {
  const sequence = state.chords.map((chord, idx) => chordToEvent(chord, idx));
  return {
    mode: state.mode,
    bpm: state.bpm,
    rhythmSpeed: state.rhythmSpeed,
    synthSettings: state.synth,
    loopCount: 10,
    sequence,
  };
}

async function playLoop() {
  try {
    stopPreview();
    const payload = buildLoopPayload();

    const ctx = getPreviewContext();
    const beatsPerBar = 4;
    const baseBeatSeconds = 60 / Math.max(1, state.bpm);
    const speedMultiplier = Math.max(0.0001, state.rhythmSpeed || 1);
    const barDuration = (baseBeatSeconds * beatsPerBar) / speedMultiplier;
    const startTime = ctx.currentTime + 0.1;

    let longest = 0;
    state.chords.forEach((chord, idx) => {
      ensureChordComplete(chord, idx);
      const chordStart = startTime + idx * barDuration;
      const chordDuration = Math.max(0.2, barDuration * 0.9);
      const total = scheduleChordPreview(chord, chordStart, chordDuration);
      longest = Math.max(longest, idx * barDuration + total);
    });

    state.loopPreview.timer = setTimeout(
      () => stopPreview('Loop preview finished'),
      (longest + 0.3) * 1000,
    );
    updateStatus('Loop previewing');

    fetch(apiUrl('/api/play'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (error) {
    updateStatus(error.message);
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

async function renderLoop() {
  try {
    const payload = buildLoopPayload();
    const res = await fetch(apiUrl('/api/render'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.file) {
      player.classList.remove('hidden');
      player.src = data.file;
      player.play();
      updateStatus('Render ready');
    } else {
      updateStatus('Render complete');
    }
  } catch (error) {
    updateStatus(error.message);
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

function stopPreview(reason) {
  if (state.loopPreview.timer) {
    clearTimeout(state.loopPreview.timer);
    state.loopPreview.timer = null;
  }
  if (state.loopPreview.ctx) {
    state.loopPreview.ctx.close();
    state.loopPreview.ctx = null;
  }
  state.loopPreview.stop = true;
  if (reason) updateStatus(reason);
}

function buildPatch() {
  return {
    version: 1,
    global: {
      mode: state.mode,
      tempo: state.bpm,
      rhythmMultiplier: state.rhythmSpeed,
      synth: { ...state.synth },
    },
    chords: state.chords.map((chord) => ({
      tuningId: chord.tuningId,
      notes: [...(chord.notes || [])],
      arp: { enabled: false, pattern: 'up', rate: '1/8' },
    })),
  };
}

function savePatch() {
  try {
    const patch = buildPatch();
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'synbrane_patch.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    updateStatus('Patch saved');
  } catch (error) {
    updateStatus('Failed to save patch');
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

function applyPatch(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid patch');
  const chords = Array.isArray(data.chords) ? data.chords.slice(0, 4) : [];
  chords.forEach((entry, idx) => {
    if (!state.chords[idx]) return;
    state.chords[idx].tuningId = entry.tuningId || state.tunings[0]?.id || null;
    state.chords[idx].notes = Array.isArray(entry.notes) ? entry.notes.map((n) => Number(n)) : [];
    normalizeChordNotes(state.chords[idx]);
  });
  if (data.global) {
    state.mode = data.global.mode || state.mode;
    state.bpm = Number(data.global.tempo || state.bpm);
    const minRhythm = Number(rhythmInput.min) || 0;
    const maxRhythm = Number(rhythmInput.max) || Infinity;
    const nextRhythm = Number(data.global.rhythmMultiplier ?? state.rhythmSpeed);
    state.rhythmSpeed = Math.min(maxRhythm, Math.max(minRhythm, nextRhythm));
    if (data.global.synth) {
      state.synth = {
        waveform: data.global.synth.waveform || state.synth.waveform,
        envelope: {
          attackMs: Number(data.global.synth.envelope?.attackMs ?? state.synth.envelope.attackMs),
          decayMs: Number(data.global.synth.envelope?.decayMs ?? state.synth.envelope.decayMs),
          sustainLevel: Number(data.global.synth.envelope?.sustainLevel ?? state.synth.envelope.sustainLevel),
          releaseMs: Number(data.global.synth.envelope?.releaseMs ?? state.synth.envelope.releaseMs),
        },
        filter: {
          cutoffHz: Number(data.global.synth.filter?.cutoffHz ?? state.synth.filter.cutoffHz),
          resonance: Number(data.global.synth.filter?.resonance ?? state.synth.filter.resonance),
        },
      };
    }
  }
  modeSelect.value = state.mode;
  bpmInput.value = state.bpm;
  rhythmInput.value = state.rhythmSpeed;
  waveformSelect.value = state.synth.waveform;
  attackInput.value = state.synth.envelope.attackMs;
  decayInput.value = state.synth.envelope.decayMs;
  sustainInput.value = state.synth.envelope.sustainLevel;
  releaseInput.value = state.synth.envelope.releaseMs;
  cutoffInput.value = state.synth.filter.cutoffHz;
  resonanceInput.value = state.synth.filter.resonance;
  syncSynthLabels();
  renderActiveChord();
}

function loadPatch(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      applyPatch(parsed);
      updateStatus('Patch loaded');
    } catch (error) {
      updateStatus('Invalid patch file');
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };
  reader.readAsText(file);
}

async function init() {
  attachControlListeners();
  syncSynthLabels();
  const res = await fetch(apiUrl('/api/tunings'));
  const data = await res.json();
  state.tunings = data.tunings || [];
  state.baseFrequency = data.baseFrequency || 440;
  state.chords.forEach((chord) => {
    chord.tuningId = state.tunings[0]?.id || null;
    normalizeChordNotes(chord);
  });
  renderTuningOptions();
  renderActiveChord();
  updateStatus('Ready');
}

init();
