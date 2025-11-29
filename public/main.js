const chordList = document.getElementById('chordList');
const tuningSelect = document.getElementById('tuningSelect');
const rootSelect = document.getElementById('rootSelect');
const chordSourceSelect = document.getElementById('chordSource');
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
const customChordEditor = document.getElementById('customChordEditor');
const customChordSummary = document.getElementById('customChordSummary');

function createDefaultCustomChord() {
  return {
    slots: Array.from({ length: 7 }, (_, index) => ({
      enabled: index === 0,
      degree: 0,
      octave: 0,
    })),
  };
}

function createDefaultArpeggio() {
  return {
    enabled: false,
    pattern: 'up',
    rate: '1/8',
  };
}

const state = {
  tunings: [],
  baseFrequency: 440,
  chordsByTuning: {},
  selectedTuningId: null,
  selectedChordId: null,
  selectedRoot: 0,
  chordSource: 'preset',
  bars: [],
  selectedBar: 0,
  mode: 'harmony',
  bpm: 120,
  rhythmSpeed: 3,
  customChord: createDefaultCustomChord(),
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

const ARPEGGIO_PATTERNS = [
  { value: 'up', label: 'Up (low → high)' },
  { value: 'down', label: 'Down (high → low)' },
  { value: 'upDown', label: 'Up-Down (bounce)' },
];

const ARPEGGIO_RATES = [
  { value: '1/4', label: 'Quarter notes (1/4)' },
  { value: '1/8', label: 'Eighth notes (1/8)' },
  { value: '1/16', label: 'Sixteenth notes (1/16)' },
];

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

function getDegreeSpan(tuning) {
  if (!tuning) return 12;
  if (tuning.type === 'edo') return tuning.value || 12;
  return tuning.intervals?.length || tuning.count || 12;
}

function degreeLabel(tuning, degree) {
  if (tuning?.type === 'edo' && tuning.value === 12) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[degree % 12];
  }
  return `deg ${degree}`;
}

function cloneCustomChordSlots(slots = state.customChord.slots) {
  return slots.map((slot) => ({ ...slot }));
}

function cloneCustomChord(customChord = state.customChord) {
  return { ...customChord, slots: cloneCustomChordSlots(customChord.slots) };
}

function combinedDegreeValue(slot, span) {
  return Number(slot.degree || 0) + span * Number(slot.octave || 0);
}

function degreeOptionsForTuning(tuning, span) {
  const range = Math.max(span, span * 2);
  return Array.from({ length: range }, (_, index) => index);
}

function normalizeCustomChordForTuning(customChord, tuning) {
  const span = getDegreeSpan(tuning);
  const maxRange = Math.max(span, span * 2);
  return {
    ...customChord,
    slots: (customChord?.slots || []).map((slot) => {
      const combined = combinedDegreeValue(slot, span);
      const clamped = Math.max(0, Math.min(combined, maxRange - 1));
      return {
        ...slot,
        degree: clamped % span,
        octave: Math.floor(clamped / span),
      };
    }),
  };
}

function degreeOptionLabel(tuning, degreeValue, span, root = 0) {
  const octave = Math.floor(degreeValue / span);
  const baseLabel = degreeLabel(tuning, degreeValue % span);
  const octaveText = octave === 0 ? '' : `${octave > 0 ? '+' : ''}${octave} oct`;
  const freq = degreeToFrequency(tuning?.id, Number(root || 0) + degreeValue);
  const freqText = Number.isFinite(freq) ? ` · ≈ ${freq.toFixed(1)} Hz` : '';
  return `${baseLabel}${octaveText ? ` (${octaveText})` : ''}${freqText}`;
}

function ensureBarCustomChord(bar) {
  if (!bar.customChord) {
    // eslint-disable-next-line no-param-reassign
    bar.customChord = createDefaultCustomChord();
  }
  return bar.customChord;
}

function ensureBarArpeggio(bar) {
  return {
    enabled: Boolean(bar.arpeggioEnabled),
    pattern: bar.arpeggioPattern || 'up',
    rate: bar.arpeggioRate || '1/8',
  };
}

function resolveCustomChord(tuningId, root, customChord = state.customChord) {
  const tuning = getTuning(tuningId);
  const span = getDegreeSpan(tuning);
  const activeSlots = (customChord?.slots || []).filter((slot) => slot.enabled);
  const degrees = activeSlots.map((slot) => Number(slot.degree || 0) + Number(root || 0) + span * Number(slot.octave || 0));
  const frequencies = degrees.map((degree) => degreeToFrequency(tuningId, degree));
  return { degrees, frequencies, activeSlots, span, tuning };
}

function updateCustomChordSummary() {
  if (!customChordSummary) return;
  const { activeSlots, tuning } = resolveCustomChord(state.selectedTuningId, state.selectedRoot);
  if (!activeSlots.length) {
    customChordSummary.textContent = 'No active notes';
    return;
  }
  const span = getDegreeSpan(tuning || getTuning(state.selectedTuningId));
  const items = activeSlots.map((slot) => {
    const baseLabel = degreeLabel(tuning, Number(slot.degree || 0));
    const octaveText = slot.octave === 0 ? '' : `${slot.octave > 0 ? '+' : ''}${slot.octave} oct`;
    const degValue = Number(slot.degree || 0) + span * Number(slot.octave || 0);
    return `${baseLabel}${octaveText ? ` (${octaveText})` : ''} → deg ${degValue}`;
  });
  customChordSummary.innerHTML = `<strong>${items.length} note${items.length === 1 ? '' : 's'}</strong><br />${items.join('<br />')}`;
  if (state.bars.some((bar) => (bar.chordType || 'preset') === 'custom')) {
    renderBars();
  }
}

function renderCustomChordEditor() {
  if (!customChordEditor) return;
  const tuning = getTuning(state.selectedTuningId);
  const span = getDegreeSpan(tuning);
  const degreeOptions = Array.from({ length: span }, (_, index) => index);
  customChordEditor.innerHTML = '';

  cloneCustomChordSlots().forEach((slot, index) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'custom-slot';

    const header = document.createElement('header');
    const title = document.createElement('span');
    title.textContent = `Slot ${index + 1}`;
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = slot.enabled;
    const noteLabel = document.createElement('div');
    noteLabel.className = 'note-label';
    const slotLabelUpdate = () => {
      const slotState = state.customChord.slots[index];
      const slotInfo = resolveCustomChord(state.selectedTuningId, state.selectedRoot, { slots: [{ ...slotState, enabled: slotState.enabled }] });
      const freq = slotInfo.frequencies[0];
      const baseLabel = degreeLabel(tuning, Number(slotState.degree || 0));
      const octaveText = slotState.octave === 0 ? '' : `${slotState.octave > 0 ? '+' : ''}${slotState.octave} oct`;
      if (slotState.enabled && Number.isFinite(freq)) {
        noteLabel.textContent = `${baseLabel}${octaveText ? ` (${octaveText})` : ''} ≈ ${freq.toFixed(2)} Hz`;
      } else {
        noteLabel.textContent = 'Disabled';
      }
    };
    toggle.onchange = (e) => {
      state.customChord.slots[index].enabled = e.target.checked;
      slotLabelUpdate();
      updateCustomChordSummary();
    };
    header.appendChild(title);
    header.appendChild(toggle);
    slotEl.appendChild(header);

    const controls = document.createElement('div');
    controls.className = 'slot-controls';

    const degreeLabelEl = document.createElement('label');
    degreeLabelEl.textContent = 'Degree';
    const degreeSelect = document.createElement('select');
    degreeOptions.forEach((deg) => {
      const option = document.createElement('option');
      option.value = deg;
      option.textContent = `${degreeLabel(tuning, deg)} (${deg})`;
      degreeSelect.appendChild(option);
    });
    degreeSelect.value = slot.degree;
    degreeSelect.onchange = (e) => {
      state.customChord.slots[index].degree = Number(e.target.value);
      slotLabelUpdate();
      updateCustomChordSummary();
    };
    degreeLabelEl.appendChild(degreeSelect);
    controls.appendChild(degreeLabelEl);

    const octaveLabel = document.createElement('label');
    octaveLabel.textContent = 'Octave offset';
    const octaveSelect = document.createElement('select');
    [-2, -1, 0, 1, 2].forEach((oct) => {
      const option = document.createElement('option');
      option.value = oct;
      option.textContent = `${oct > 0 ? '+' : ''}${oct}`;
      octaveSelect.appendChild(option);
    });
    octaveSelect.value = slot.octave;
    octaveSelect.onchange = (e) => {
      state.customChord.slots[index].octave = Number(e.target.value);
      slotLabelUpdate();
      updateCustomChordSummary();
    };
    octaveLabel.appendChild(octaveSelect);
    controls.appendChild(octaveLabel);

    slotLabelUpdate();

    slotEl.appendChild(controls);
    slotEl.appendChild(noteLabel);
    customChordEditor.appendChild(slotEl);
  });

  updateCustomChordSummary();
}

function hasActiveCustomNotes() {
  const { activeSlots } = resolveCustomChord(state.selectedTuningId, state.selectedRoot);
  return activeSlots.length > 0;
}

function updateSelectedBarLabel() {
  const barNumber = state.selectedBar + 1;
  if (selectedBarLabel) {
    selectedBarLabel.textContent = `Selected Bar: ${barNumber}`;
  }
  if (assignChordBtn) {
    const sourceLabel = state.chordSource === 'custom' ? 'Custom chord' : 'Preset chord';
    assignChordBtn.textContent = `Use ${sourceLabel} for Bar ${barNumber}`;
    assignChordBtn.disabled = state.chordSource === 'preset' ? !state.selectedChordId : !hasActiveCustomNotes();
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
    renderCustomChordEditor();
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
    chordType: 'preset',
    customChord: createDefaultCustomChord(),
    arpeggioEnabled: false,
    arpeggioPattern: 'up',
    arpeggioRate: '1/8',
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
  const barIndex = state.selectedBar;
  const current = state.bars[barIndex];
  if (state.chordSource === 'custom') {
    if (!hasActiveCustomNotes()) {
      updateStatus('Enable at least one custom chord slot first.');
      return;
    }
    state.bars[barIndex] = {
      ...current,
      tuningId: state.selectedTuningId,
      root: Number(state.selectedRoot || 0),
      chordId: null,
      chordType: 'custom',
      customChord: cloneCustomChord(),
    };
    updateStatus(`Assigned custom chord to bar ${barIndex + 1}.`);
  } else {
    const chord = getChord(state.selectedTuningId, state.selectedChordId);
    if (!chord) {
      updateStatus('Pick a chord in Explore first.');
      return;
    }
    state.bars[barIndex] = {
      ...current,
      tuningId: state.selectedTuningId,
      root: Number(state.selectedRoot || 0),
      chordId: state.selectedChordId,
      chordType: 'preset',
    };
    updateStatus(`Assigned ${chord.label || chord.name} to bar ${barIndex + 1}.`);
  }
  renderBars();
  updateSelectedBarLabel();
}

function renderBars() {
  barsContainer.innerHTML = '';
  state.bars.forEach((bar) => {
    const arpeggio = ensureBarArpeggio(bar);
    const card = document.createElement('div');
    card.className = `bar-card ${bar.bar === state.selectedBar ? 'active-bar' : ''}`;
    card.onclick = (event) => {
      const targetTag = event.target.tagName.toLowerCase();
      if (['select', 'option', 'button'].includes(targetTag)) return;
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
      const tuning = getTuning(e.target.value);
      const normalizedCustom = normalizeCustomChordForTuning(ensureBarCustomChord(bar), tuning);
      state.bars[bar.bar] = {
        ...bar,
        tuningId: e.target.value,
        root: cache.roots[0]?.value || 0,
        chordId: cache.chords[0]?.id || null,
        chordType: bar.chordType || 'preset',
        customChord: normalizedCustom,
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
      renderBars();
    };
    rootLabel.appendChild(rootSelectEl);
    card.appendChild(rootLabel);

    const chordTypeLabel = document.createElement('label');
    chordTypeLabel.textContent = 'Chord source';
    const chordTypeSelect = document.createElement('select');
    ['preset', 'custom'].forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type === 'custom' ? 'Custom chord' : 'Preset';
      chordTypeSelect.appendChild(option);
    });
    chordTypeSelect.value = bar.chordType || 'preset';
    chordTypeSelect.onchange = (e) => {
      const current = state.bars[bar.bar];
      const next = { ...current, chordType: e.target.value };
      if (e.target.value === 'preset' && !next.chordId) {
        const firstChord = (state.chordsByTuning[next.tuningId]?.chords || [])[0];
        next.chordId = firstChord?.id || null;
      }
      state.bars[bar.bar] = next;
      renderBars();
    };
    chordTypeLabel.appendChild(chordTypeSelect);
    card.appendChild(chordTypeLabel);

    if ((bar.chordType || 'preset') === 'preset') {
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
    }

    const playbackLabel = document.createElement('label');
    playbackLabel.textContent = 'Playback';
    const playbackSelect = document.createElement('select');
    [
      { value: 'chord', label: 'Chord (together)' },
      { value: 'arpeggio', label: 'Arpeggio (sequenced)' },
    ].forEach((optionDef) => {
      const option = document.createElement('option');
      option.value = optionDef.value;
      option.textContent = optionDef.label;
      playbackSelect.appendChild(option);
    });
    playbackSelect.value = arpeggio.enabled ? 'arpeggio' : 'chord';
    playbackSelect.onchange = (e) => {
      const nextEnabled = e.target.value === 'arpeggio';
      state.bars[bar.bar] = { ...state.bars[bar.bar], arpeggioEnabled: nextEnabled };
      renderBars();
    };
    playbackLabel.appendChild(playbackSelect);
    card.appendChild(playbackLabel);

    if (arpeggio.enabled) {
      const arpWrapper = document.createElement('div');
      arpWrapper.className = 'arpeggio-controls';

      const patternLabel = document.createElement('label');
      patternLabel.textContent = 'Arpeggio pattern';
      const patternSelect = document.createElement('select');
      ARPEGGIO_PATTERNS.forEach((pattern) => {
        const option = document.createElement('option');
        option.value = pattern.value;
        option.textContent = pattern.label;
        patternSelect.appendChild(option);
      });
      patternSelect.value = arpeggio.pattern;
      patternSelect.onchange = (e) => {
        state.bars[bar.bar] = { ...state.bars[bar.bar], arpeggioPattern: e.target.value };
      };
      patternLabel.appendChild(patternSelect);
      arpWrapper.appendChild(patternLabel);

      const rateLabel = document.createElement('label');
      rateLabel.textContent = 'Arpeggio rate';
      const rateSelect = document.createElement('select');
      ARPEGGIO_RATES.forEach((rate) => {
        const option = document.createElement('option');
        option.value = rate.value;
        option.textContent = rate.label;
        rateSelect.appendChild(option);
      });
      rateSelect.value = arpeggio.rate;
      rateSelect.onchange = (e) => {
        state.bars[bar.bar] = { ...state.bars[bar.bar], arpeggioRate: e.target.value };
      };
      rateLabel.appendChild(rateSelect);
      arpWrapper.appendChild(rateLabel);

      card.appendChild(arpWrapper);
    }

    const customEditor = createBarCustomEditor(bar, chordTypeSelect);
    card.appendChild(customEditor);

    barsContainer.appendChild(card);
  });
}

function createBarCustomEditor(bar, chordTypeSelect) {
  const tuning = getTuning(bar.tuningId);
  const span = getDegreeSpan(tuning);
  const customChord = ensureBarCustomChord(bar);
  const degreeOptions = degreeOptionsForTuning(tuning, span);
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-chord-panel bar-custom-panel';

  const header = document.createElement('div');
  header.className = 'custom-chord-header bar-custom-header';
  const titleWrap = document.createElement('div');
  const title = document.createElement('h4');
  title.textContent = 'Custom chord (this bar)';
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = 'Enable notes and pick degrees from this bar\'s tuning. Two-octave span shown when available.';
  titleWrap.appendChild(title);
  titleWrap.appendChild(meta);
  const summary = document.createElement('div');
  summary.className = 'custom-chord-summary bar-custom-summary';
  const resolved = resolveCustomChord(bar.tuningId, bar.root, customChord);
  summary.textContent = resolved.degrees.length
    ? `${resolved.degrees.length} active note${resolved.degrees.length === 1 ? '' : 's'}`
    : 'No active notes yet';
  header.appendChild(titleWrap);
  header.appendChild(summary);
  wrapper.appendChild(header);

  const slots = document.createElement('div');
  slots.className = 'custom-chord custom-chord--compact';
  const rootValue = Number(bar.root || 0);

  customChord.slots.forEach((slot, index) => {
    const slotEl = document.createElement('div');
    slotEl.className = 'custom-slot custom-slot--bar';

    const slotHeader = document.createElement('header');
    slotHeader.className = 'bar-slot-header';
    const slotTitle = document.createElement('span');
    slotTitle.textContent = `Note ${index + 1}`;
    const controls = document.createElement('div');
    controls.className = 'bar-slot-controls';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = slot.enabled;
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'preview-btn';
    previewBtn.textContent = '🔊';
    previewBtn.title = 'Preview this note';
    previewBtn.disabled = !slot.enabled;

    const persistSlot = (updates) => {
      const currentBar = state.bars[bar.bar];
      const currentChord = ensureBarCustomChord(currentBar);
      const updatedSlots = cloneCustomChordSlots(currentChord.slots);
      updatedSlots[index] = { ...updatedSlots[index], ...updates };
      state.bars[bar.bar] = {
        ...currentBar,
        chordType: 'custom',
        customChord: { ...currentChord, slots: updatedSlots },
      };
      if (chordTypeSelect) chordTypeSelect.value = 'custom';
      renderBars();
      updateSelectedBarLabel();
    };

    toggle.onchange = (e) => {
      persistSlot({ enabled: e.target.checked });
    };

    previewBtn.onclick = (e) => {
      e.stopPropagation();
      const current = state.bars[bar.bar];
      const spanValue = getDegreeSpan(getTuning(current.tuningId));
      const currentChord = ensureBarCustomChord(current);
      const slotState = currentChord.slots[index];
      const combined = combinedDegreeValue(slotState, spanValue);
      playNotePreview(current.tuningId, current.root, combined);
    };

    controls.appendChild(toggle);
    controls.appendChild(previewBtn);
    slotHeader.appendChild(slotTitle);
    slotHeader.appendChild(controls);

    const body = document.createElement('div');
    body.className = 'bar-slot-body';
    const noteLabel = document.createElement('label');
    noteLabel.textContent = 'Note selection';
    const degreeSelect = document.createElement('select');
    degreeOptions.forEach((deg) => {
      const option = document.createElement('option');
      option.value = deg;
      option.textContent = degreeOptionLabel(tuning, deg, span, rootValue);
      degreeSelect.appendChild(option);
    });
    const combined = combinedDegreeValue(slot, span);
    degreeSelect.value = Math.min(combined, degreeOptions[degreeOptions.length - 1] || combined);
    degreeSelect.onchange = (e) => {
      const next = Number(e.target.value);
      const nextDegree = next % span;
      const nextOctave = Math.floor(next / span);
      persistSlot({ degree: nextDegree, octave: nextOctave, enabled: true });
    };
    noteLabel.appendChild(degreeSelect);
    body.appendChild(noteLabel);

    const slotMeta = document.createElement('div');
    slotMeta.className = 'note-label';
    const updateMeta = () => {
      const current = state.bars[bar.bar];
      const currentChord = ensureBarCustomChord(current);
      const slotState = currentChord.slots[index];
      if (!slotState.enabled) {
        slotMeta.textContent = 'Disabled';
        previewBtn.disabled = true;
        return;
      }
      const combo = combinedDegreeValue(slotState, span);
      const freq = degreeToFrequency(current.tuningId, Number(current.root || 0) + combo);
      const baseLabel = degreeLabel(tuning, Number(slotState.degree || 0));
      const octaveText = slotState.octave === 0 ? '' : `${slotState.octave > 0 ? '+' : ''}${slotState.octave} oct`;
      slotMeta.textContent = Number.isFinite(freq)
        ? `${baseLabel}${octaveText ? ` (${octaveText})` : ''} ≈ ${freq.toFixed(2)} Hz`
        : `${baseLabel}${octaveText ? ` (${octaveText})` : ''}`;
      previewBtn.disabled = false;
    };
    updateMeta();

    slotEl.appendChild(slotHeader);
    slotEl.appendChild(body);
    slotEl.appendChild(slotMeta);
    slots.appendChild(slotEl);
  });

  wrapper.appendChild(slots);
  return wrapper;
}

function degreeToFrequency(tuningId, degree) {
  const tuning = getTuning(tuningId);
  if (!tuning) return state.baseFrequency;
  if (tuning.type === 'edo') {
    return state.baseFrequency * 2 ** (degree / tuning.value);
  }
  const intervals = tuning.intervals || [];
  const span = intervals.length || 1;
  const wrappedIndex = ((degree % span) + span) % span;
  const octaves = Math.floor(degree / span);
  const cents = intervals[wrappedIndex] || 0;
  return state.baseFrequency * 2 ** octaves * 2 ** (cents / 1200);
}

function frequenciesForEvent(event) {
  if (Array.isArray(event.frequencies) && event.frequencies.length) return event.frequencies;
  if (event.chordType === 'custom' || event.customChord) {
    const resolved = resolveCustomChord(event.tuningId, event.root, event.customChord || state.customChord);
    return resolved.frequencies;
  }
  const chord = event.chord || getChord(event.tuningId, event.chordId);
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

const RHYTHM_BASE_MAPPING = 0.005;

function rhythmRateForFrequency(freq) {
  return Math.max(0.5, freq * RHYTHM_BASE_MAPPING * state.rhythmSpeed);
}

const DRUM_VOICES = [
  { baseFrequency: 70, decay: 0.28, noiseMix: 0.12, partials: [1, 1.7, 2.2, 3.1], saturation: 0.8, amplitude: 0.95 },
  { baseFrequency: 105, decay: 0.22, noiseMix: 0.1, partials: [1, 1.9, 2.6, 3.6], saturation: 0.8, amplitude: 0.85 },
  { baseFrequency: 150, decay: 0.18, noiseMix: 0.14, partials: [1, 2.3, 3.3, 4.6], saturation: 0.8, amplitude: 0.8 },
  { baseFrequency: 320, decay: 0.08, noiseMix: 0.55, partials: [2, 5, 7, 11], saturation: 0.9, amplitude: 0.7 },
  { baseFrequency: 320, decay: 0.18, noiseMix: 0.6, partials: [3, 7, 10, 14], saturation: 0.95, amplitude: 0.75 },
  { baseFrequency: 380, decay: 0.22, noiseMix: 0.45, partials: [3, 7, 11, 15], saturation: 0.85, amplitude: 0.7 },
  { baseFrequency: 520, decay: 0.06, noiseMix: 0.35, partials: [5, 9, 13, 17], saturation: 0.9, amplitude: 0.6 },
];

function scheduleBackbone(ctx, startTime, duration) {
  const secondsPerBeat = 60 / state.bpm;
  const totalBeats = Math.ceil(duration / secondsPerBeat);
  for (let beat = 0; beat < totalBeats; beat += 1) {
    const hitTime = startTime + beat * secondsPerBeat;
    createPercussiveHit(ctx, hitTime, {
      amplitude: 1,
      attack: 0.003,
      decay: 0.26,
      baseFrequency: 55,
      partials: [1, 2.1, 2.9],
      noiseMix: 0.08,
      saturation: 0.9,
    });
    if (beat % 4 === 1 || beat % 4 === 3) {
      createPercussiveHit(ctx, hitTime, {
        amplitude: 0.8,
        attack: 0.002,
        decay: 0.18,
        baseFrequency: 180,
        partials: [1.5, 2.5, 3.5, 4.5],
        noiseMix: 0.6,
        saturation: 0.9,
      });
    }
  }
}

function scheduleRhythm(ctx, startTime, duration, freqs) {
  scheduleBackbone(ctx, startTime, duration);
  freqs.forEach((freq, index) => {
    const rate = rhythmRateForFrequency(freq || 80);
    const interval = 1 / rate;
    const voice = DRUM_VOICES[index] || DRUM_VOICES[DRUM_VOICES.length - 1];
    for (let t = 0; t < duration; t += interval) {
      createPercussiveHit(ctx, startTime + t, {
        amplitude: voice.amplitude || 0.6,
        attack: voice.attack ?? 0.004,
        decay: voice.decay ?? 0.12,
        baseFrequency: voice.baseFrequency ?? Math.max(40, Math.min((freq || 80) * 0.5, 260)),
        partials: voice.partials,
        noiseMix: voice.noiseMix ?? 0.35,
        saturation: voice.saturation ?? 0.85,
      });
    }
  });
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

function arpeggioStepSeconds(rate) {
  const secondsPerBeat = 60 / state.bpm;
  if (rate === '1/4') return secondsPerBeat;
  if (rate === '1/16') return secondsPerBeat / 4;
  return secondsPerBeat / 2;
}

function arpeggioCycle(freqs, pattern) {
  if (!freqs?.length) return [];
  if (pattern === 'down') return [...freqs].slice().reverse();
  if (pattern === 'upDown') {
    const ascent = [...freqs];
    const descent = freqs.length > 1 ? [...freqs].slice(1, -1).reverse() : [];
    return [...ascent, ...descent];
  }
  return [...freqs];
}

function scheduleHarmonyArpeggio(ctx, startTime, duration, freqs, synthSettings, arpeggio) {
  const stepDuration = arpeggioStepSeconds(arpeggio?.rate || '1/8');
  const cycle = arpeggioCycle(freqs, arpeggio?.pattern || 'up');
  if (!cycle.length || !Number.isFinite(stepDuration) || stepDuration <= 0) {
    scheduleHarmony(ctx, startTime, duration, freqs, synthSettings);
    return;
  }
  const steps = Math.max(1, Math.floor(duration / stepDuration));
  for (let step = 0; step < steps; step += 1) {
    const noteStart = startTime + step * stepDuration;
    const remaining = duration - step * stepDuration;
    if (remaining <= 0) break;
    const noteDuration = Math.min(stepDuration, remaining);
    const freq = cycle[step % cycle.length];
    scheduleHarmony(ctx, noteStart, noteDuration, [freq], synthSettings);
  }
}

function playNotePreview(tuningId, root, degreeValue) {
  const freq = degreeToFrequency(tuningId, Number(root || 0) + Number(degreeValue || 0));
  if (!Number.isFinite(freq)) return;
  const ctx = new AudioContext();
  const start = ctx.currentTime + 0.02;
  const duration = 0.6;
  scheduleHarmony(ctx, start, duration, [freq], state.synth);
  setTimeout(() => {
    ctx.close();
  }, (duration + 0.6) * 1000);
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
    const arpeggio = event?.arpeggioEnabled
      ? { enabled: true, pattern: event.arpeggioPattern, rate: event.arpeggioRate }
      : null;
    if (arpeggio?.enabled) {
      scheduleHarmonyArpeggio(ctx, start, duration, freqs, state.synth, arpeggio);
    } else {
      scheduleHarmony(ctx, start, duration, freqs, state.synth);
    }
  }
}

function playSequenceOnce(ctx, startTime, barDuration, events) {
  events.forEach((event) => {
    const freqs = frequenciesForEvent(event);
    const eventStart = startTime + barDuration * event.bar;
    if (state.mode === 'rhythm') {
      scheduleRhythm(ctx, eventStart, barDuration * (event.durationBars || 1), freqs);
    } else {
      const arpeggio = event?.arpeggioEnabled
        ? { enabled: true, pattern: event.arpeggioPattern, rate: event.arpeggioRate }
        : null;
      const duration = barDuration * (event.durationBars || 1);
      if (arpeggio?.enabled) {
        scheduleHarmonyArpeggio(ctx, eventStart, duration, freqs, state.synth, arpeggio);
      } else {
        scheduleHarmony(ctx, eventStart, duration, freqs, state.synth);
      }
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

function buildCustomChordEvent(tuningId, root, customChord = state.customChord) {
  const resolved = resolveCustomChord(tuningId, root, customChord);
  return {
    tuningId,
    chordType: 'custom',
    root: Number(root || 0),
    chord: { id: 'custom', name: 'Custom chord', degrees: resolved.degrees },
    customChord: { slots: cloneCustomChordSlots(customChord.slots), degrees: resolved.degrees },
    frequencies: resolved.frequencies,
  };
}

function buildChordPayload() {
  if (state.chordSource === 'custom') {
    if (!hasActiveCustomNotes()) return null;
    const custom = buildCustomChordEvent(state.selectedTuningId, state.selectedRoot);
    return {
      ...custom,
      mode: state.mode,
      bpm: state.bpm,
      rhythmSpeed: state.rhythmSpeed,
      synthSettings: state.synth,
    };
  }
  const chord = getChord(state.selectedTuningId, state.selectedChordId);
  if (!chord) return null;
  return {
    tuningId: state.selectedTuningId,
    chord,
    chordId: state.selectedChordId,
    chordType: 'preset',
    root: Number(state.selectedRoot || 0),
    frequencies: chord.degrees.map((degree) => degreeToFrequency(state.selectedTuningId, degree + Number(state.selectedRoot || 0))),
    mode: state.mode,
    bpm: state.bpm,
    rhythmSpeed: state.rhythmSpeed,
    synthSettings: state.synth,
  };
}

function buildLoopPayload() {
  const sequence = state.bars
    .map((bar) => {
      const arpeggio = ensureBarArpeggio(bar);
      const base = {
        bar: bar.bar,
        durationBars: 1,
        tuningId: bar.tuningId,
        root: Number(bar.root || 0),
        arpeggioEnabled: arpeggio.enabled,
        arpeggioPattern: arpeggio.pattern,
        arpeggioRate: arpeggio.rate,
      };
      if ((bar.chordType || 'preset') === 'custom') {
        return { ...base, ...buildCustomChordEvent(bar.tuningId, bar.root, bar.customChord || createDefaultCustomChord()) };
      }
      const chord = getChord(bar.tuningId, bar.chordId);
      if (!chord) return null;
      return {
        ...base,
        chordType: 'preset',
        chord,
        chordId: bar.chordId,
        frequencies: chord.degrees.map((degree) => degreeToFrequency(bar.tuningId, degree + Number(bar.root || 0))),
      };
    })
    .filter(Boolean);
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
  playChordPreview({
    tuningId: payload.tuningId,
    chordId: payload.chordId || payload.chord?.id,
    chord: payload.chord,
    chordType: payload.chordType,
    customChord: payload.customChord,
    root: payload.root,
    bar: 0,
    durationBars: 1,
    frequencies: payload.frequencies,
  });
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
    renderCustomChordEditor();
    updateTuningMeta();
    updateSelectedBarLabel();
  };

  rootSelect.onchange = (e) => {
    state.selectedRoot = Number(e.target.value);
    updateCustomChordSummary();
    renderCustomChordEditor();
  };

  chordSourceSelect.onchange = (e) => {
    state.chordSource = e.target.value;
    updateSelectedBarLabel();
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
    rhythmLabel.textContent = `${state.rhythmSpeed.toFixed(2)}× pitch → beat`;
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
  bpmLabel.textContent = `${state.bpm} BPM`;
  rhythmLabel.textContent = `${state.rhythmSpeed.toFixed(2)}× pitch → beat`;
  chordSourceSelect.value = state.chordSource;
  updateSelectedBarLabel();
  fetchTunings();
  updateStatus('Loading tunings…');
}

window.addEventListener('DOMContentLoaded', init);
