const chordList = document.getElementById('chordList');
const tuningSelect = document.getElementById('tuningSelect');
const rootSelect = document.getElementById('rootSelect');
const modeSelect = document.getElementById('modeSelect');
const bpmInput = document.getElementById('bpm');
const bpmLabel = document.getElementById('bpmLabel');
const rhythmSpeedInput = document.getElementById('rhythmSpeed');
const rhythmLabel = document.getElementById('rhythmLabel');
const statusEl = document.getElementById('status');
const tuningMeta = document.getElementById('tuningMeta');
const barsContainer = document.getElementById('barsContainer');
const player = document.getElementById('player');
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
const selectedBarLabel = document.getElementById('selectedBarLabel');
const assignChordBtn = document.getElementById('assignChordBtn');
const stopLoopBtn = document.getElementById('stopLoopBtn');

const state = {
  tunings: [],
  baseFrequency: 440,
  chordsByTuning: {},
  selectedTuningId: null,
  selectedChordId: null,
  selectedRoot: 0,
  bars: [],
  selectedBar: 0,
  mode: 'harmony',
  bpm: 120,
  rhythmSpeed: 0.01,
  synth: {
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
  },
};

const loopPreview = {
  ctx: null,
  timer: null,
  loops: 0,
  stopRequested: false,
};

function updateStatus(text) {
  statusEl.textContent = text;
}

function updateTuningMeta() {
  const tuning = getTuning(state.selectedTuningId);
  const detail = tuning?.description ? ` · ${tuning.description}` : '';
  tuningMeta.textContent = `Base frequency ${state.baseFrequency} Hz${detail}`;
}

function getTuning(tuningId) {
  return state.tunings.find((t) => t.id === tuningId);
}

function getChord(tuningId, chordId) {
  const cache = state.chordsByTuning[tuningId];
  if (!cache) return null;
  return cache.chords.find((chord) => chord.id === chordId);
}

function updateSelectedBarLabel() {
  const barNumber = state.selectedBar + 1;
  if (selectedBarLabel) {
    selectedBarLabel.textContent = `Selected Bar: ${barNumber}`;
  }
  if (assignChordBtn) {
    assignChordBtn.textContent = `Use for Bar ${barNumber}`;
    assignChordBtn.disabled = !state.selectedChordId;
  }
}

function updateSynthLabels() {
  attackLabel.textContent = `${state.synth.envelope.attackMs} ms`;
  decayLabel.textContent = `${state.synth.envelope.decayMs} ms`;
  sustainLabel.textContent = state.synth.envelope.sustainLevel.toFixed(2);
  releaseLabel.textContent = `${state.synth.envelope.releaseMs} ms`;
  cutoffLabel.textContent = `${state.synth.filter.cutoffHz} Hz`;
  resonanceLabel.textContent = state.synth.filter.resonance.toFixed(2);
}

function syncSynthControls() {
  waveformSelect.value = state.synth.waveform;
  attackInput.value = state.synth.envelope.attackMs;
  decayInput.value = state.synth.envelope.decayMs;
  sustainInput.value = state.synth.envelope.sustainLevel;
  releaseInput.value = state.synth.envelope.releaseMs;
  cutoffInput.value = state.synth.filter.cutoffHz;
  resonanceInput.value = state.synth.filter.resonance;
  updateSynthLabels();
}

async function fetchTunings() {
  const res = await fetch('/api/tunings');
  const data = await res.json();
  state.tunings = data.tunings || [];
  state.baseFrequency = data.baseFrequency || 440;
  state.selectedTuningId = state.tunings[0]?.id || null;
  updateTuningMeta();
  if (state.selectedTuningId) {
    await ensureChords(state.selectedTuningId);
    seedSelections();
    renderTunings();
    renderRoots();
    renderChords();
    renderBars();
    updateSelectedBarLabel();
  }
}

async function ensureChords(tuningId) {
  if (state.chordsByTuning[tuningId]) return;
  const res = await fetch(`/api/chords?tuningId=${encodeURIComponent(tuningId)}`);
  const data = await res.json();
  state.chordsByTuning[tuningId] = { chords: data.chords || [], roots: data.roots || [] };
}

function seedSelections() {
  const cache = state.chordsByTuning[state.selectedTuningId];
  state.selectedRoot = cache?.roots[0]?.value || 0;
  state.selectedChordId = cache?.chords[0]?.id || null;
  state.bars = Array.from({ length: 4 }, (_, index) => ({
    bar: index,
    tuningId: state.selectedTuningId,
    root: state.selectedRoot,
    chordId: state.selectedChordId,
  }));
  state.selectedBar = 0;
}

function renderTunings() {
  tuningSelect.innerHTML = '';
  state.tunings.forEach((tuning) => {
    const option = document.createElement('option');
    option.value = tuning.id;
    option.textContent = tuning.label;
    tuningSelect.appendChild(option);
  });
  tuningSelect.value = state.selectedTuningId;
}

function renderRoots() {
  const cache = state.chordsByTuning[state.selectedTuningId];
  const roots = cache?.roots || [];
  rootSelect.innerHTML = '';
  roots.forEach((root) => {
    const option = document.createElement('option');
    option.value = root.value;
    option.textContent = root.label;
    rootSelect.appendChild(option);
  });
  if (!roots.find((r) => r.value === state.selectedRoot) && roots.length) {
    state.selectedRoot = roots[0].value;
  }
  rootSelect.value = state.selectedRoot;
}

function renderChords() {
  const cache = state.chordsByTuning[state.selectedTuningId];
  const chords = cache?.chords || [];
  chordList.innerHTML = '';
  chords.forEach((chord) => {
    const item = document.createElement('div');
    item.className = 'chord-item';
    item.textContent = `${chord.label || chord.name} — pattern [${chord.degrees.join(', ')}]`;
    item.onclick = () => {
      state.selectedChordId = chord.id;
      document.querySelectorAll('.chord-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      updateStatus(`Selected ${chord.label || chord.name}`);
      updateSelectedBarLabel();
    };
    chordList.appendChild(item);
  });
  if (chords.length && !state.selectedChordId) {
    state.selectedChordId = chords[0].id;
  }
  if (chords.length && !chords.find((c) => c.id === state.selectedChordId)) {
    state.selectedChordId = chords[0].id;
  }
  const active = chordList.querySelector(
    `.chord-item:nth-child(${chords.findIndex((c) => c.id === state.selectedChordId) + 1 || 1})`
  );
  if (active) active.classList.add('active');
  updateSelectedBarLabel();
}

function assignChordToSelectedBar() {
  const chord = getChord(state.selectedTuningId, state.selectedChordId);
  if (!chord) {
    updateStatus('Pick a chord in Explore first.');
    return;
  }
  const barIndex = state.selectedBar;
  const current = state.bars[barIndex];
  state.bars[barIndex] = {
    ...current,
    tuningId: state.selectedTuningId,
    root: Number(state.selectedRoot || 0),
    chordId: state.selectedChordId,
  };
  renderBars();
  updateSelectedBarLabel();
  updateStatus(`Assigned ${chord.label || chord.name} to bar ${barIndex + 1}.`);
}

function renderBars() {
  barsContainer.innerHTML = '';
  state.bars.forEach((bar) => {
    const card = document.createElement('div');
    card.className = `bar-card ${bar.bar === state.selectedBar ? 'active-bar' : ''}`;
    card.onclick = (event) => {
      const targetTag = event.target.tagName.toLowerCase();
      if (targetTag === 'select' || targetTag === 'option') return;
      state.selectedBar = bar.bar;
      renderBars();
      updateSelectedBarLabel();
    };
    const title = document.createElement('h3');
    title.textContent = `Bar ${bar.bar + 1}`;
    card.appendChild(title);

    const tuningLabel = document.createElement('label');
    tuningLabel.textContent = 'Tuning';
    const tuningSelectEl = document.createElement('select');
    state.tunings.forEach((tuning) => {
      const option = document.createElement('option');
      option.value = tuning.id;
      option.textContent = tuning.label;
      tuningSelectEl.appendChild(option);
    });
    tuningSelectEl.value = bar.tuningId;
    tuningSelectEl.onchange = async (e) => {
      await ensureChords(e.target.value);
      const cache = state.chordsByTuning[e.target.value];
      state.bars[bar.bar] = {
        ...bar,
        tuningId: e.target.value,
        root: cache.roots[0]?.value || 0,
        chordId: cache.chords[0]?.id || null,
      };
      renderBars();
      updateSelectedBarLabel();
    };
    tuningLabel.appendChild(tuningSelectEl);
    card.appendChild(tuningLabel);

    const rootLabel = document.createElement('label');
    rootLabel.textContent = 'Root';
    const rootSelectEl = document.createElement('select');
    const rootOptions = state.chordsByTuning[bar.tuningId]?.roots || [];
    rootOptions.forEach((root) => {
      const option = document.createElement('option');
      option.value = root.value;
      option.textContent = root.label;
      rootSelectEl.appendChild(option);
    });
    rootSelectEl.value = bar.root;
    rootSelectEl.onchange = (e) => {
      const current = state.bars[bar.bar];
      state.bars[bar.bar] = { ...current, root: Number(e.target.value) };
    };
    rootLabel.appendChild(rootSelectEl);
    card.appendChild(rootLabel);

    const chordLabel = document.createElement('label');
    chordLabel.textContent = 'Chord';
    const chordSelectEl = document.createElement('select');
    const chordOptions = state.chordsByTuning[bar.tuningId]?.chords || [];
    chordOptions.forEach((chord) => {
      const option = document.createElement('option');
      option.value = chord.id;
      option.textContent = `${chord.label || chord.name}`;
      chordSelectEl.appendChild(option);
    });
    chordSelectEl.value = bar.chordId;
    chordSelectEl.onchange = (e) => {
      const current = state.bars[bar.bar];
      state.bars[bar.bar] = { ...current, chordId: e.target.value };
    };
    chordLabel.appendChild(chordSelectEl);
    card.appendChild(chordLabel);

    barsContainer.appendChild(card);
  });
}

function degreeToFrequency(tuningId, degree) {
  const tuning = getTuning(tuningId);
  if (!tuning) return state.baseFrequency;
  if (tuning.type === 'edo') {
    return state.baseFrequency * 2 ** (degree / tuning.value);
  }
  const intervals = tuning.intervals || [];
  const index = degree % intervals.length;
  const octaves = Math.floor(degree / intervals.length);
  const cents = intervals[index] || 0;
  return state.baseFrequency * 2 ** octaves * 2 ** (cents / 1200);
}

function frequenciesForEvent(event) {
  const chord = getChord(event.tuningId, event.chordId);
  if (!chord) return [];
  return chord.degrees.map((degree) => degreeToFrequency(event.tuningId, degree + Number(event.root || 0)));
}

function makeSaturationCurve(amount = 0.8) {
  const k = Math.max(0.1, amount * 3);
  const nSamples = 1024;
  const curve = new Float32Array(nSamples);
  for (let i = 0; i < nSamples; i += 1) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = Math.tanh(k * x);
  }
  return curve;
}

function createPercussiveHit(ctx, startTime, {
  amplitude = 0.9,
  attack = 0.005,
  decay = 0.1,
  baseFrequency = 80,
  partials = [1, 2, 3, 4],
  noiseMix = 0.25,
  saturation = 0.8,
} = {}) {
  const duration = attack + decay + 0.08;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(amplitude, startTime + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + attack + decay);

  const mixBus = ctx.createGain();

  if (noiseMix > 0) {
    const noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = noiseMix;
    noise.connect(noiseGain).connect(mixBus);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  if (partials?.length) {
    partials.forEach((partial, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = baseFrequency * partial;
      const toneGain = ctx.createGain();
      toneGain.gain.value = 1 / Math.max(1.5, index + 1);
      osc.connect(toneGain).connect(mixBus);
      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSaturationCurve(saturation);
  shaper.oversample = '4x';

  mixBus.connect(shaper).connect(gain).connect(ctx.destination);
}

function scheduleHarmony(ctx, startTime, duration, freqs, synthSettings) {
  const synth = synthSettings || state.synth;
  const amp = 0.5 / Math.max(freqs.length, 1);
  const attack = synth.envelope.attackMs / 1000;
  const decay = synth.envelope.decayMs / 1000;
  const sustainLevel = synth.envelope.sustainLevel;
  const release = synth.envelope.releaseMs / 1000;
  const sustainTime = Math.max(0, duration - attack - decay);

  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const useFilter = synth.filter && synth.filter.cutoffHz;
    const destination = useFilter ? ctx.createBiquadFilter() : gain;

    osc.frequency.value = freq;
    osc.type = synth.waveform === 'square' ? 'square' : synth.waveform === 'saw' ? 'sawtooth' : 'sine';

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(amp, startTime + attack);
    gain.gain.linearRampToValueAtTime(amp * sustainLevel, startTime + attack + decay);
    gain.gain.setValueAtTime(amp * sustainLevel, startTime + attack + decay + sustainTime);
    gain.gain.linearRampToValueAtTime(0.0001, startTime + attack + decay + sustainTime + release);

    if (useFilter) {
      destination.type = 'lowpass';
      destination.frequency.value = synth.filter.cutoffHz;
      destination.Q.value = 0.5 + (synth.filter.resonance || 0) * 11.5;
      osc.connect(destination).connect(gain).connect(ctx.destination);
    } else {
      osc.connect(gain).connect(ctx.destination);
    }

    const stopTime = startTime + attack + decay + sustainTime + release + 0.05;
    osc.start(startTime);
    osc.stop(stopTime);
  });
}

function scheduleRhythm(ctx, startTime, duration, freqs) {
  const baseAmp = 0.75;
  freqs.forEach((freq, index) => {
    const rate = Math.max(0.5, freq * state.rhythmSpeed);
    const interval = 1 / rate;
    const baseFrequency = Math.max(40, Math.min((freq || 80) * 0.5, 260));
    const partials = [1, 2, 3, 4];
    const decay = index === 0 ? 0.2 : 0.12;
    const noiseMix = index === 0 ? 0.2 : 0.35;
    for (let t = 0; t < duration; t += interval) {
      createPercussiveHit(ctx, startTime + t, {
        amplitude: baseAmp / (index + 1),
        attack: 0.004,
        decay,
        baseFrequency,
        partials,
        noiseMix,
        saturation: 0.85,
      });
    }
  });
}

function playChordPreview(event) {
  const ctx = new AudioContext();
  const start = ctx.currentTime + 0.05;
  const duration = (60 / state.bpm) * 4;
  const freqs = frequenciesForEvent(event);
  if (!freqs.length) return;
  if (state.mode === 'rhythm') {
    scheduleRhythm(ctx, start, duration, freqs);
  } else {
    scheduleHarmony(ctx, start, duration, freqs, state.synth);
  }
}

function playSequenceOnce(ctx, startTime, barDuration, events) {
  events.forEach((event) => {
    const freqs = frequenciesForEvent(event);
    const eventStart = startTime + barDuration * event.bar;
    if (state.mode === 'rhythm') {
      scheduleRhythm(ctx, eventStart, barDuration * (event.durationBars || 1), freqs);
    } else {
      scheduleHarmony(ctx, eventStart, barDuration * (event.durationBars || 1), freqs, state.synth);
    }
  });
}

function stopLoopPreview(reason) {
  loopPreview.stopRequested = true;
  if (loopPreview.timer) {
    clearTimeout(loopPreview.timer);
    loopPreview.timer = null;
  }
  if (loopPreview.ctx) {
    loopPreview.ctx.close();
    loopPreview.ctx = null;
  }
  if (reason) {
    updateStatus(reason);
  }
}

function playLoopPreview(events) {
  stopLoopPreview();
  const ctx = new AudioContext();
  const beatsPerBar = 4;
  const secondsPerBeat = 60 / state.bpm;
  const barDuration = beatsPerBar * secondsPerBeat;
  const totalBars = Math.max(...events.map((event) => (event.bar || 0) + (event.durationBars || 1)), 1);
  const loopDuration = barDuration * totalBars;
  const start = ctx.currentTime + 0.05;
  loopPreview.ctx = ctx;
  loopPreview.stopRequested = false;
  loopPreview.loops = 0;

  const queuePass = (loopIndex) => {
    if (loopPreview.stopRequested) return;
    if (loopIndex >= 10) {
      stopLoopPreview('Reached 10 loops.');
      return;
    }
    const loopStart = start + loopIndex * loopDuration;
    playSequenceOnce(ctx, loopStart, barDuration, events);
    loopPreview.loops = loopIndex + 1;
    loopPreview.timer = setTimeout(() => queuePass(loopIndex + 1), loopDuration * 1000);
  };

  queuePass(0);
}

function buildChordPayload() {
  const chord = getChord(state.selectedTuningId, state.selectedChordId);
  if (!chord) return null;
  return {
    tuningId: state.selectedTuningId,
    chord,
    root: Number(state.selectedRoot || 0),
    mode: state.mode,
    bpm: state.bpm,
    rhythmSpeed: state.rhythmSpeed,
    synthSettings: state.synth,
  };
}

function buildLoopPayload() {
  const sequence = state.bars.map((bar) => ({
    bar: bar.bar,
    durationBars: 1,
    tuningId: bar.tuningId,
    chord: getChord(bar.tuningId, bar.chordId),
    chordId: bar.chordId,
    root: Number(bar.root || 0),
  })).filter((item) => item.chord);
  return {
    mode: state.mode,
    bpm: state.bpm,
    rhythmSpeed: state.rhythmSpeed,
    synthSettings: state.synth,
    loopCount: 10,
    sequence,
  };
}

async function playChord() {
  const payload = buildChordPayload();
  if (!payload) {
    updateStatus('Pick a chord first.');
    return;
  }
  stopLoopPreview();
  updateStatus('Scheduling chord…');
  await fetch('/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  playChordPreview({ tuningId: payload.tuningId, chordId: payload.chord.id, root: payload.root, bar: 0, durationBars: 1 });
  updateStatus('Chord scheduled. Preview playing locally.');
}

async function renderChord() {
  const payload = buildChordPayload();
  if (!payload) {
    updateStatus('Pick a chord first.');
    return;
  }
  updateStatus('Rendering chord…');
  const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.file) {
    player.classList.remove('hidden');
    player.src = data.file;
    player.load();
    updateStatus('Rendered chord.');
  } else {
    updateStatus('Render failed.');
  }
}

async function playLoop() {
  const payload = buildLoopPayload();
  if (!payload.sequence.length) {
    updateStatus('Add at least one chord to the loop.');
    return;
  }
  updateStatus('Scheduling loop…');
  await fetch('/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  playLoopPreview(payload.sequence);
  updateStatus('Loop scheduled. Preview looping locally until stopped or 10 passes.');
}

async function renderLoop() {
  const payload = buildLoopPayload();
  if (!payload.sequence.length) {
    updateStatus('Add at least one chord to the loop.');
    return;
  }
  updateStatus('Rendering loop…');
  const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.file) {
    player.classList.remove('hidden');
    player.src = data.file;
    player.load();
    updateStatus('Rendered loop.');
  } else {
    updateStatus('Render failed.');
  }
}

function hookEvents() {
  tuningSelect.onchange = async (e) => {
    state.selectedTuningId = e.target.value;
    await ensureChords(state.selectedTuningId);
    renderRoots();
    renderChords();
    updateTuningMeta();
    updateSelectedBarLabel();
  };

  rootSelect.onchange = (e) => {
    state.selectedRoot = Number(e.target.value);
  };

  modeSelect.onchange = (e) => {
    state.mode = e.target.value;
  };

  bpmInput.oninput = (e) => {
    state.bpm = Number(e.target.value);
    bpmLabel.textContent = `${state.bpm} BPM`;
  };

  rhythmSpeedInput.oninput = (e) => {
    state.rhythmSpeed = Number(e.target.value);
    rhythmLabel.textContent = `${state.rhythmSpeed.toFixed(3)}× pitch → beat`;
  };

  waveformSelect.onchange = (e) => {
    state.synth.waveform = e.target.value;
  };

  attackInput.oninput = (e) => {
    state.synth.envelope.attackMs = Number(e.target.value);
    updateSynthLabels();
  };

  decayInput.oninput = (e) => {
    state.synth.envelope.decayMs = Number(e.target.value);
    updateSynthLabels();
  };

  sustainInput.oninput = (e) => {
    state.synth.envelope.sustainLevel = Number(e.target.value);
    updateSynthLabels();
  };

  releaseInput.oninput = (e) => {
    state.synth.envelope.releaseMs = Number(e.target.value);
    updateSynthLabels();
  };

  cutoffInput.oninput = (e) => {
    state.synth.filter.cutoffHz = Number(e.target.value);
    updateSynthLabels();
  };

  resonanceInput.oninput = (e) => {
    state.synth.filter.resonance = Number(e.target.value);
    updateSynthLabels();
  };

  document.getElementById('playChordBtn').onclick = playChord;
  document.getElementById('renderChordBtn').onclick = renderChord;
  document.getElementById('playLoopBtn').onclick = playLoop;
  document.getElementById('renderLoopBtn').onclick = renderLoop;
  if (assignChordBtn) assignChordBtn.onclick = assignChordToSelectedBar;
  if (stopLoopBtn) stopLoopBtn.onclick = () => stopLoopPreview('Stopped loop.');
}

function init() {
  hookEvents();
  syncSynthControls();
  updateSelectedBarLabel();
  fetchTunings();
  updateStatus('Loading tunings…');
}

window.addEventListener('DOMContentLoaded', init);
