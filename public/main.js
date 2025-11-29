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
const chordPreset = document.getElementById('chordPreset');
const chordRoot = document.getElementById('chordRoot');
const intervalInfo = document.getElementById('intervalInfo');
const frequencyInfo = document.getElementById('frequencyInfo');
const chordArpEnabled = document.getElementById('chordArpEnabled');
const chordArpPattern = document.getElementById('chordArpPattern');
const chordArpRate = document.getElementById('chordArpRate');
const loopChord = document.getElementById('loopChord');
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
const detuneInput = document.getElementById('detune');
const detuneLabel = document.getElementById('detuneLabel');
const cutoffInput = document.getElementById('cutoff');
const cutoffLabel = document.getElementById('cutoffLabel');
const resonanceInput = document.getElementById('resonance');
const resonanceLabel = document.getElementById('resonanceLabel');
const playLoopBtn = document.getElementById('playLoop');
const stopLoopBtn = document.getElementById('stopLoop');
const renderLoopBtn = document.getElementById('renderLoop');
const loopChordCountInput = document.getElementById('loopChordCount');
const statusEl = document.getElementById('status');
const player = document.getElementById('player');
const savePatchBtn = document.getElementById('savePatch');
const loadPatchBtn = document.getElementById('loadPatch');
const patchFileInput = document.getElementById('patchFile');

const NOTE_NAMES_12 = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHORD_PRESETS = [
  { id: 'major', label: 'Major', intervals: [0, 400, 700] },
  { id: 'minor', label: 'Minor', intervals: [0, 300, 700] },
  { id: 'diminished', label: 'Diminished', intervals: [0, 300, 600] },
  { id: 'augmented', label: 'Augmented', intervals: [0, 400, 800] },
  { id: 'dom7', label: 'Dominant 7', intervals: [0, 400, 700, 1000] },
  { id: 'maj7', label: 'Major 7', intervals: [0, 400, 700, 1100] },
  { id: 'min7', label: 'Minor 7', intervals: [0, 300, 700, 1000] },
  { id: 'sus2', label: 'Suspended 2', intervals: [0, 200, 700] },
  { id: 'sus4', label: 'Suspended 4', intervals: [0, 500, 700] },
  { id: 'add9', label: 'Add9', intervals: [0, 400, 700, 1400] },
  { id: 'add11', label: 'Add11', intervals: [0, 400, 700, 1700] },
  { id: 'add13', label: 'Add13', intervals: [0, 400, 700, 2100] },
];

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
  detuneCents: 3,
};

const MIN_OCTAVE_RING = -1;
const MAX_OCTAVE_RING = 1;

function defaultArp() {
  return { enabled: false, pattern: 'up', rate: '1/8' };
}

function defaultChord() {
  return { tuningId: null, root: 0, notes: [0, 4, 7], preset: 'major', arp: defaultArp() };
}

const MAX_CHORDS = 8;

const state = {
  tunings: [],
  baseFrequency: 440,
  activeChord: 0,
  chords: Array.from({ length: MAX_CHORDS }, () => defaultChord()),
  loopChordCount: 4,
  mode: 'harmony',
  bpm: 120,
  rhythmSpeed: 0.3,
  synth: JSON.parse(JSON.stringify(defaultSynth)),
  preview: { arpeggiate: false, arpRateMs: 180, loop: false },
  loopPreview: { ctx: null, timer: null, stop: false, nodes: [] },
};

  function clampRhythmSpeed(value) {
    return Math.min(1, Math.max(0.1, Number(value) || 0.3));
  }

const OSC_TYPE_MAP = {
  sine: 'sine',
  square: 'square',
  saw: 'sawtooth',
  triangle: 'triangle',
};

function waveformToOscType(waveform) {
  return OSC_TYPE_MAP[waveform] || 'sine';
}

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

  function degreeLabel(tuning, degree, root = 0) {
    const span = getDegreeSpan(tuning);
    const wrappedDegree = ((degree % span) + span) % span;
    const wrappedRoot = ((root % span) + span) % span;
    const isRoot = wrappedDegree === wrappedRoot;
    if (tuning?.type === 'edo' && tuning.value === 12) {
      const label = NOTE_NAMES_12[wrappedDegree % 12];
      return isRoot ? `${label} •` : label;
    }
    return `${isRoot ? 'R ' : ''}${wrappedDegree}°`;
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

function centsForDegree(tuning, degree) {
  if (!tuning) return 0;
  if (tuning.type === 'edo') {
    const step = 1200 / (tuning.value || 12);
    return degree * step;
  }
  const intervals = tuning.intervals || [];
  if (!intervals.length) return degree * 100;
  const span = intervals.length;
  const wrapped = ((degree % span) + span) % span;
  const oct = Math.floor(degree / span);
  return (intervals[wrapped] || 0) + oct * 1200;
}

function degreeForCentsTarget(target, tuning) {
  if (!tuning) return Math.round(target / 100);
  if (tuning.type === 'edo') {
    const step = 1200 / (tuning.value || 12);
    return Math.round(target / step);
  }
  const intervals = tuning.intervals || [];
  if (!intervals.length) return Math.round(target / 100);
  const span = intervals.length;
  const oct = Math.floor(target / 1200);
  const remainder = ((target % 1200) + 1200) % 1200;
  let bestIndex = 0;
  let bestDiff = Infinity;
  intervals.forEach((cents, idx) => {
    const diff = Math.abs(cents - remainder);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = idx;
    }
  });
  return bestIndex + oct * span;
}

function mapIntervalsToDegrees(intervals, tuning, root = 0) {
  const degrees = intervals.map((interval) => root + degreeForCentsTarget(interval, tuning));
  return Array.from(new Set(degrees)).sort((a, b) => a - b);
}

  function normalizeChordNotes(chord) {
    const tuning = getTuning(chord.tuningId);
    const span = getDegreeSpan(tuning);
    const minDeg = MIN_OCTAVE_RING * span;
    const maxDeg = (MAX_OCTAVE_RING + 1) * span - 1;
    chord.arp = {
      ...defaultArp(),
      ...(chord.arp || {}),
    };
    chord.notes = (chord.notes || [])
      .map((deg) => {
        const safe = Number.isFinite(deg) ? Math.round(deg) : 0;
        return Math.max(minDeg, Math.min(safe, maxDeg));
      });
    if (!chord.notes.length) chord.notes = [];
    return chord;
  }

function renderChordSwitcher() {
  chordSwitcher.innerHTML = '';
  const visibleChords = Math.max(1, Math.min(state.loopChordCount || 1, state.chords.length));
  if (state.activeChord >= visibleChords) {
    state.activeChord = visibleChords - 1;
  }
  state.chords.slice(0, visibleChords).forEach((_, idx) => {
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

function renderPresetOptions() {
  chordPreset.innerHTML = '';
  CHORD_PRESETS.forEach((preset) => {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.label;
    chordPreset.appendChild(opt);
  });
}

function renderRootOptions() {
  const chord = state.chords[state.activeChord];
  const tuning = getTuning(chord.tuningId);
  const span = getDegreeSpan(tuning);
  const rootCount = tuning?.type === 'edo' ? Math.max(span * 2, span) : span;
  chordRoot.innerHTML = '';
  if (chord.root >= rootCount) {
    chord.root = 0;
  }
  for (let i = 0; i < rootCount; i += 1) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = degreeLabel(tuning, i, i);
    chordRoot.appendChild(opt);
  }
  chordRoot.value = chord.root || 0;
}

function baseHueForTuning(tuning) {
  if (!tuning) return 200;
  if (tuning.type === 'edo') {
    const hueMap = {
      8: 150,
      12: 188,
      19: 295,
      22: 48,
      24: 328,
      31: 32,
    };
    return hueMap[tuning.value] ?? ((tuning.value * 11 + 60) % 360);
  }
  return 135;
}

function octaveColor(tuning, octave) {
  const baseHue = baseHueForTuning(tuning);
  const hue = (baseHue + octave * 8 + 360) % 360;
  const baseSaturation = tuning?.type === 'scala' ? 58 : 68;
  const saturation = Math.max(48, Math.min(82, baseSaturation + octave * 6));
  const baseLightness = tuning?.type === 'scala' ? 48 : 52;
  const lightness = Math.max(32, Math.min(80, baseLightness + octave * 10));
  const mutedLight = Math.max(30, Math.min(78, lightness - 8));
  const highlightLight = Math.max(50, Math.min(92, lightness + 12));
  const textColor = lightness > 62 ? '#0c1118' : '#f7fbff';
  const strongText = lightness > 58 ? '#0b0f14' : '#f9fbff';
  return {
    main: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    muted: `hsla(${hue}, ${saturation - 10}%, ${mutedLight}%, 0.7)`,
    mutedStroke: `hsla(${hue}, ${saturation - 8}%, ${mutedLight + 6}%, 0.9)`,
    highlight: `hsl(${hue}, ${Math.min(95, saturation + 8)}%, ${highlightLight}%)`,
    glow: `hsla(${hue}, ${Math.min(95, saturation + 12)}%, ${highlightLight + 6}%, 0.85)`,
    shadow: `hsla(${hue}, ${saturation}%, ${lightness}%, 0.45)`,
    outline: `hsla(${hue}, ${Math.min(96, saturation + 4)}%, ${highlightLight}%, 0.95)`,
    text: textColor,
    strongText,
  };
}

  function renderCircle() {
    const chord = state.chords[state.activeChord];
    normalizeChordNotes(chord);
    const tuning = getTuning(chord.tuningId);
    const span = getDegreeSpan(tuning);
    noteCircle.innerHTML = '';
    const minOctave = MIN_OCTAVE_RING;
    const maxOctave = MAX_OCTAVE_RING;
    const octaves = [];
    for (let octave = minOctave; octave <= maxOctave; octave += 1) {
      octaves.push(octave);
    }

    const ringCount = octaves.length;
    const pointSize = span > 30 ? 15 : span > 22 ? 19 : span > 16 ? 22 : 28;
    const densityBoost = span >= 30 ? 1.16 : span >= 24 ? 1.08 : 1.02;
    const preferredBase = span >= 28 ? 380 : span >= 22 ? 360 : 340;
    const preferredSize = Math.max(
      preferredBase * densityBoost,
      ringCount * (pointSize + 40)
    );
    const wrapSize = noteCircle.parentElement?.clientWidth || preferredSize;
    const circleSize = Math.min(preferredSize, Math.max(300, wrapSize - 12));
    noteCircle.style.width = `${circleSize}px`;
    noteCircle.style.height = `${circleSize}px`;
    const center = circleSize / 2;
    const maxRadius = center - pointSize / 2 - 8;
    const innerRadius = Math.max(pointSize * 1.35, 34);
    const ringSpacing = ringCount > 1 ? (maxRadius - innerRadius) / (ringCount - 1) : 0;
    const spacingBoost = span >= 28 ? 5 : span >= 22 ? 3 : 0;
    const twistPerRing = Math.PI / (span * 1.2);

    octaves.forEach((octave, ringIndex) => {
      const radius = Math.min(maxRadius, innerRadius + ringIndex * (ringSpacing + spacingBoost));
      for (let degree = 0; degree < span; degree += 1) {
        const baseAngle = (Math.PI * 2 * degree) / span - Math.PI / 2;
        const angle = baseAngle + ringIndex * twistPerRing;
        const x = center + radius * Math.cos(angle) - pointSize / 2;
        const y = center + radius * Math.sin(angle) - pointSize / 2;
        const absoluteDegree = degree + octave * span;
        const palette = octaveColor(tuning, octave);
        const isActive = chord.notes.includes(absoluteDegree);
        const point = document.createElement('div');
        point.className = 'note-point';
        point.classList.add(isActive ? 'active' : 'muted');
        point.style.width = `${pointSize}px`;
        point.style.height = `${pointSize}px`;
        point.style.fontSize = `${span >= 28 ? 9 : span >= 22 ? 10 : Math.max(10, pointSize - 8)}px`;
        point.style.lineHeight = `${pointSize}px`;
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        point.style.setProperty('--bubble-main', palette.main);
        point.style.setProperty('--bubble-muted', palette.muted);
        point.style.setProperty('--bubble-highlight', palette.highlight);
        point.style.setProperty('--bubble-glow', palette.glow);
        point.style.setProperty('--bubble-text', palette.text);
        point.style.setProperty('--bubble-text-strong', palette.strongText);
        point.style.setProperty('--bubble-shadow', palette.shadow);
        point.style.setProperty('--bubble-outline', palette.outline);
        point.style.background = isActive ? palette.highlight : palette.muted;
        point.style.borderColor = isActive ? palette.outline : palette.mutedStroke;
        point.style.color = isActive ? palette.strongText : palette.text;
        point.style.opacity = isActive ? '1' : '0.6';
        point.style.boxShadow = isActive
          ? `0 0 0 2px ${palette.outline}, 0 0 14px ${palette.glow}, 0 12px 26px rgba(0, 0, 0, 0.55)`
          : '0 2px 8px rgba(0, 0, 0, 0.32)';
        point.textContent = degreeLabel(tuning, degree, chord.root || 0);
        point.title = `Degree ${degree} (oct ${octave >= 0 ? `+${octave}` : octave})`;
        point.onclick = () => {
          if (chord.notes.includes(absoluteDegree)) {
            chord.notes = chord.notes.filter((n) => n !== absoluteDegree);
          } else {
            chord.notes = [...chord.notes, absoluteDegree].sort((a, b) => a - b);
          }
          normalizeChordNotes(chord);
          renderCircle();
        };
        noteCircle.appendChild(point);
      }
    });
    renderIntervalPanels();
  }

function intervalLabelByIndex(idx) {
  const labels = ['Root', '2nd', '3rd', '4th', '5th', '6th', '7th', '9th', '11th', '13th'];
  return labels[idx] || `${idx}°`;
}

function renderIntervalPanels() {
  const chord = state.chords[state.activeChord];
  const tuning = getTuning(chord.tuningId);
  const span = getDegreeSpan(tuning);
    const sorted = [...(chord.notes || [])].sort((a, b) => a - b);
    const infoLines = [];
    const freqLines = [];
    sorted.forEach((degree, idx) => {
      const offset = degree - (chord.root || 0);
      const cents = centsForDegree(tuning, offset);
      const label = degreeLabel(tuning, degree, chord.root || 0);
      const name = intervalLabelByIndex(idx);
      infoLines.push(`${name}: ${label} (${cents.toFixed(1)}¢ from root)`);
      const freq = degreeToFrequency(chord.tuningId, degree).toFixed(2);
      const steps = tuning?.type === 'edo' ? `${offset} steps` : `${offset}°`;
      freqLines.push(`${label}: ${freq} Hz (${steps})`);
  });
  intervalInfo.textContent = infoLines.join('\n') || 'Pick notes to see intervals.';
  frequencyInfo.textContent = freqLines.join('\n') || 'Frequencies will appear here.';
}

function renderActiveChord() {
  renderChordSwitcher();
  const chord = normalizeChordNotes(state.chords[state.activeChord]);
  if (!chord.tuningId && state.tunings[0]) {
    chord.tuningId = state.tunings[0].id;
  }
  if (chord.root == null) chord.root = 0;
  chordLabel.textContent = `Chord ${state.activeChord + 1}`;
  chordTuning.value = chord.tuningId || '';
  chordPreset.value = chord.preset || 'major';
  chordArpEnabled.checked = Boolean(chord.arp?.enabled);
  chordArpPattern.value = chord.arp?.pattern || 'up';
  chordArpRate.value = chord.arp?.rate || '1/8';
  renderRootOptions();
  renderCircle();
}

function syncSynthLabels() {
  bpmLabel.textContent = `${state.bpm} BPM`;
  rhythmLabel.textContent = `${state.rhythmSpeed.toFixed(2)}×`;
  attackLabel.textContent = `${state.synth.envelope.attackMs} ms`;
  decayLabel.textContent = `${state.synth.envelope.decayMs} ms`;
  sustainLabel.textContent = state.synth.envelope.sustainLevel.toFixed(2);
  releaseLabel.textContent = `${state.synth.envelope.releaseMs} ms`;
  detuneLabel.textContent = `${state.synth.detuneCents?.toFixed(1) || 0}¢`;
  cutoffLabel.textContent = `${state.synth.filter.cutoffHz} Hz`;
  resonanceLabel.textContent = state.synth.filter.resonance.toFixed(2);
}

function attachControlListeners() {
  chordTuning.onchange = (e) => {
    const chord = state.chords[state.activeChord];
    chord.tuningId = e.target.value;
    normalizeChordNotes(chord);
    const preset = CHORD_PRESETS.find((p) => p.id === chord.preset);
    const tuning = getTuning(chord.tuningId);
    if (preset && tuning) {
      chord.notes = mapIntervalsToDegrees(preset.intervals, tuning, chord.root || 0);
    }
    renderRootOptions();
    renderCircle();
  };

  chordPreset.onchange = (e) => {
    const chord = state.chords[state.activeChord];
    chord.preset = e.target.value;
    const preset = CHORD_PRESETS.find((p) => p.id === chord.preset);
    const tuning = getTuning(chord.tuningId);
    if (preset && tuning) {
      chord.notes = mapIntervalsToDegrees(preset.intervals, tuning, chord.root || 0);
    }
    renderCircle();
  };

  chordRoot.onchange = (e) => {
    const chord = state.chords[state.activeChord];
    const oldRoot = chord.root || 0;
    const newRoot = Number(e.target.value);
    const delta = newRoot - oldRoot;
    chord.root = newRoot;
    chord.notes = (chord.notes || []).map((deg) => deg + delta);
    normalizeChordNotes(chord);
    renderCircle();
  };

  chordArpEnabled.onchange = (e) => {
    const chord = state.chords[state.activeChord];
    chord.arp.enabled = e.target.checked;
  };

  chordArpPattern.onchange = (e) => {
    const chord = state.chords[state.activeChord];
    chord.arp.pattern = e.target.value;
  };

  chordArpRate.onchange = (e) => {
    const chord = state.chords[state.activeChord];
    chord.arp.rate = e.target.value;
  };

  loopChord.onchange = (e) => {
    state.preview.loop = e.target.checked;
  };

  loopChordCountInput.onchange = (e) => {
    const value = Math.max(1, Math.min(MAX_CHORDS, Number(e.target.value) || 1));
    state.loopChordCount = value;
    renderChordSwitcher();
    renderActiveChord();
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
      state.rhythmSpeed = clampRhythmSpeed(e.target.value);
      rhythmInput.value = state.rhythmSpeed;
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
  detuneInput.oninput = (e) => {
    state.synth.detuneCents = Number(e.target.value);
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
    root: chord.root || 0,
    chordType: 'custom',
    chord: { id: `circle-${index}`, degrees: [...chord.notes] },
    customChord: { degrees: [...chord.notes] },
    frequencies,
    arpeggioEnabled: Boolean(chord.arp?.enabled),
    arpeggioPattern: chord.arp?.pattern || 'up',
    arpeggioRate: chord.arp?.rate || '1/8',
  };
}

function getPreviewContext() {
  if (state.loopPreview.ctx) {
    if (state.loopPreview.ctx.state === 'suspended') {
      state.loopPreview.ctx.resume();
    }
    state.loopPreview.stop = false;
    return state.loopPreview.ctx;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  state.loopPreview.ctx = new AudioCtx();
  state.loopPreview.nodes = [];
  state.loopPreview.stop = false;
  return state.loopPreview.ctx;
}

function trackPreviewNodes(...nodes) {
  if (!state.loopPreview.nodes) state.loopPreview.nodes = [];
  nodes.forEach((node) => {
    if (node) state.loopPreview.nodes.push(node);
  });
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

function orderFrequenciesForPattern(freqs, pattern) {
  const sorted = [...freqs].sort((a, b) => a - b);
  if (pattern === 'down') return [...sorted].reverse();
  if (pattern === 'updown') {
    const ascent = [...sorted];
    const descent = sorted.length > 1 ? sorted.slice(1, -1).reverse() : [];
    return [...ascent, ...descent];
  }
  if (pattern === 'random') {
    const shuffle = [...sorted];
    for (let i = shuffle.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffle[i], shuffle[j]] = [shuffle[j], shuffle[i]];
    }
    return shuffle;
  }
  return sorted;
}

function stepDurationFromRate(rate, bpm) {
  const secondsPerBeat = 60 / Math.max(30, bpm || 120);
  const map = {
    '1/4': 1,
    '1/8': 0.5,
    '1/8T': 1 / 3,
    '1/16': 0.25,
  };
  const beatPortion = map[rate] ?? 0.5;
  return secondsPerBeat * beatPortion;
}

function scheduleChordPreview(chord, startTime, durationSec) {
  if (state.loopPreview.stop) return 0;
  const tuning = getTuning(chord.tuningId);
  if (!tuning) throw new Error('Chord missing tuning');
  if (!chord.notes?.length) throw new Error('Chord has no notes');

  const ctx = getPreviewContext();
  const envelope = state.synth.envelope || defaultSynth.envelope;
  const filterCfg = state.synth.filter || {};
  const freqs = chord.notes.map((deg) => degreeToFrequency(chord.tuningId, deg));
  const chordArp = chord.arp || defaultArp();
  const useArp = chordArp.enabled && freqs.length > 1;
  const orderedFreqs = useArp ? orderFrequenciesForPattern(freqs, chordArp.pattern) : freqs;
  const stepSec = useArp ? stepDurationFromRate(chordArp.rate, state.bpm) : durationSec;
  const noteDuration = useArp ? Math.min(durationSec, Math.max(0.08, stepSec * 0.9)) : durationSec;
  const steps = useArp ? Math.max(1, Math.floor(durationSec / stepSec)) : orderedFreqs.length;

  let lastOffset = 0;
  for (let idx = 0; idx < steps; idx += 1) {
    const freq = orderedFreqs[idx % orderedFreqs.length];
    const osc = ctx.createOscillator();
    const oscType = waveformToOscType(state.synth.waveform || defaultSynth.waveform);
    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, startTime);
    const detuneRange = getDegreeSpan(tuning) > 12 ? state.synth.detuneCents || 0 : 0;
    const detune = detuneRange ? (Math.random() * 2 - 1) * detuneRange : 0;
    osc.detune.setValueAtTime(detune, startTime);

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
      trackPreviewNodes(filter);
    }

    const noteStart = startTime + (useArp ? idx * stepSec : 0);
    const totalDuration = applyEnvelope(gain, ctx, noteStart, noteDuration, envelope);
    gain.gain.setValueAtTime(0.0001, noteStart - 0.01);
    lastNode.connect(gain);
    gain.connect(ctx.destination);

    osc.start(noteStart);
    osc.stop(noteStart + totalDuration + 0.05);
    trackPreviewNodes(osc, gain);
    lastOffset = useArp ? idx * stepSec + noteDuration : noteDuration;
  }

  const releaseSec = Math.max(0, (state.synth.envelope?.releaseMs || 0) / 1000);
  return lastOffset + releaseSec;
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
      state.loopPreview.timer = setTimeout(() => {
        if (state.preview.loop) {
          playChord(index);
        } else {
          stopPreview('Preview ended');
        }
      }, (total + 0.2) * 1000);

      state.rhythmSpeed = clampRhythmSpeed(state.rhythmSpeed);
    } catch (error) {
      updateStatus(error.message);
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  function buildLoopPayload() {
    state.rhythmSpeed = clampRhythmSpeed(state.rhythmSpeed);
    const visibleChords = state.chords.slice(0, Math.max(1, Math.min(state.loopChordCount, state.chords.length)));
    const sequence = visibleChords.map((chord, idx) => chordToEvent(chord, idx));
    const loopCount = 10;
    return {
      mode: state.mode,
      bpm: state.bpm,
      rhythmSpeed: state.rhythmSpeed,
      synthSettings: { ...state.synth },
      loopCount,
      sequence,
      loopChordCount: sequence.length,
    };
  }

async function playLoop() {
  try {
    stopPreview();
    const visibleChords = state.chords.slice(0, Math.max(1, Math.min(state.loopChordCount, state.chords.length)));
    visibleChords.forEach((chord, idx) => ensureChordComplete(chord, idx));

    const ctx = getPreviewContext();
    state.loopPreview.stop = false;
    const beatsPerBar = 4;
    const barSeconds = (60 / Math.max(30, state.bpm)) * beatsPerBar;
    const rhythmValue = clampRhythmSpeed(state.rhythmSpeed);
    state.rhythmSpeed = rhythmValue;
    const rhythmFactor = 0.75 + rhythmValue * 0.45;
    const barDuration = barSeconds / rhythmFactor;
    const startTime = ctx.currentTime + 0.1;
    const loopCount = 10;

    const chordDuration = Math.max(0.35, barDuration * 0.85);
    const totalBars = visibleChords.length * loopCount;
    for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
      visibleChords.forEach((chord, idx) => {
        const chordStart = startTime + (loopIndex * visibleChords.length + idx) * barDuration;
        scheduleChordPreview(chord, chordStart, chordDuration);
      });
    }

    const totalDuration = totalBars * barDuration + (state.synth.envelope.releaseMs || 0) / 1000;
    state.loopPreview.timer = setTimeout(
      () => stopPreview('Loop preview finished'),
      (totalDuration + 0.3) * 1000,
    );
    updateStatus(`Loop previewing ${visibleChords.length} chords × 10 at ${state.bpm} BPM`);
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
  state.loopPreview.stop = true;
  if (state.loopPreview.nodes?.length) {
    state.loopPreview.nodes.forEach((node) => {
      if (!node) return;
      try {
        if (typeof node.stop === 'function') {
          node.stop();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
      try {
        if (typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });
    state.loopPreview.nodes = [];
  }
  if (state.loopPreview.ctx && state.loopPreview.ctx.state === 'running') {
    state.loopPreview.ctx.suspend();
  }
  if (reason) updateStatus(reason);
}

function buildPatch() {
  return {
    version: 1,
    loopChordCount: state.loopChordCount,
    global: {
      mode: state.mode,
      tempo: state.bpm,
      rhythmMultiplier: state.rhythmSpeed,
      synth: { ...state.synth },
      preview: { ...state.preview },
    },
    chords: state.chords.map((chord) => ({
      tuningId: chord.tuningId,
      notes: [...(chord.notes || [])],
      root: chord.root || 0,
      preset: chord.preset,
      arp: { ...defaultArp(), ...(chord.arp || {}) },
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
  const chords = Array.isArray(data.chords) ? data.chords.slice(0, state.chords.length) : [];
  const loopChordCount = Math.max(1, Math.min(MAX_CHORDS, Number(data.loopChordCount || data.chords?.length || state.loopChordCount) || state.loopChordCount));
  state.loopChordCount = loopChordCount;
  chords.forEach((entry, idx) => {
    if (!state.chords[idx]) return;
    state.chords[idx].tuningId = entry.tuningId || state.tunings[0]?.id || null;
    state.chords[idx].notes = Array.isArray(entry.notes) ? entry.notes.map((n) => Number(n)) : [];
    state.chords[idx].root = Number(entry.root ?? state.chords[idx].root ?? 0);
    state.chords[idx].preset = entry.preset || state.chords[idx].preset || 'major';
    state.chords[idx].arp = { ...defaultArp(), ...(entry.arp || {}) };
    normalizeChordNotes(state.chords[idx]);
  });
  for (let idx = chords.length; idx < state.chords.length; idx += 1) {
    state.chords[idx] = defaultChord();
    state.chords[idx].tuningId = state.tunings[0]?.id || null;
    normalizeChordNotes(state.chords[idx]);
  }
    if (data.global) {
      state.mode = data.global.mode || state.mode;
      state.bpm = Number(data.global.tempo || state.bpm);
      const nextRhythm = Number(data.global.rhythmMultiplier ?? state.rhythmSpeed);
      state.rhythmSpeed = clampRhythmSpeed(nextRhythm);
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
        detuneCents: Number(data.global.synth.detuneCents ?? state.synth.detuneCents),
      };
    }
    if (data.global.preview) {
      state.preview = {
        arpeggiate: Boolean(data.global.preview.arpeggiate ?? state.preview.arpeggiate),
        arpRateMs: Number(data.global.preview.arpRateMs ?? state.preview.arpRateMs),
        loop: Boolean(data.global.preview.loop ?? state.preview.loop),
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
  detuneInput.value = state.synth.detuneCents;
  cutoffInput.value = state.synth.filter.cutoffHz;
  resonanceInput.value = state.synth.filter.resonance;
  loopChordCountInput.value = state.loopChordCount;
  loopChord.checked = state.preview.loop;
  syncSynthLabels();
  renderChordSwitcher();
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
  renderPresetOptions();
  loopChordCountInput.value = state.loopChordCount;
  loopChord.checked = state.preview.loop;
  const res = await fetch(apiUrl('/api/tunings'));
  const data = await res.json();
  state.tunings = (data.tunings || []).filter((tuning) => !(tuning.type === 'edo' && Number(tuning.value) === 32));
  state.baseFrequency = data.baseFrequency || 440;
  state.chords.forEach((chord) => {
    chord.tuningId = state.tunings[0]?.id || null;
    chord.root = chord.root || 0;
    chord.preset = chord.preset || 'major';
    const preset = CHORD_PRESETS.find((p) => p.id === chord.preset);
    const tuning = getTuning(chord.tuningId);
    if (preset && tuning) {
      chord.notes = mapIntervalsToDegrees(preset.intervals, tuning, chord.root);
    }
    normalizeChordNotes(chord);
  });
  renderTuningOptions();
  renderRootOptions();
  renderActiveChord();
  updateStatus('Ready');
}

init();
