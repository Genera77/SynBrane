const config = require('../config');
const { loadScalaScales } = require('./scalaLoader');

const NOTE_NAMES_12EDO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const EDO_PRESETS = {
  // 12-TET chromatic system with full major/minor families and 7th extensions.
  12: {
    label: '12-EDO (chromatic)',
    description: 'Standard 12-TET with extended chord families across all roots.',
    chords: [
      { id: '12E-major', name: 'Major triad', label: 'Type: Maj — [0,4,7]', degrees: [0, 4, 7] },
      { id: '12E-minor', name: 'Minor triad', label: 'Type: Min — [0,3,7]', degrees: [0, 3, 7] },
      { id: '12E-diminished', name: 'Diminished', label: 'Type: Dim — [0,3,6]', degrees: [0, 3, 6] },
      { id: '12E-augmented', name: 'Augmented', label: 'Type: Aug — [0,4,8]', degrees: [0, 4, 8] },
      { id: '12E-sus2', name: 'Suspended 2', label: 'Type: Sus2 — [0,2,7]', degrees: [0, 2, 7] },
      { id: '12E-sus4', name: 'Suspended 4', label: 'Type: Sus4 — [0,5,7]', degrees: [0, 5, 7] },
      { id: '12E-dominant7', name: 'Dominant 7', label: 'Type: Dom7 — [0,4,7,10]', degrees: [0, 4, 7, 10] },
      { id: '12E-major7', name: 'Major 7', label: 'Type: Maj7 — [0,4,7,11]', degrees: [0, 4, 7, 11] },
      { id: '12E-minor7', name: 'Minor 7', label: 'Type: Min7 — [0,3,7,10]', degrees: [0, 3, 7, 10] },
      { id: '12E-half-dim7', name: 'Half-diminished 7', label: 'Type: Half-dim7 — [0,3,6,10]', degrees: [0, 3, 6, 10] },
      { id: '12E-add9', name: 'Add9', label: 'Type: Add9 — [0,4,7,14]', degrees: [0, 4, 7, 14] },
      { id: '12E-sixth', name: 'Sixth chord', label: 'Type: 6 — [0,4,7,9]', degrees: [0, 4, 7, 9] },
    ],
    rootCount: 12,
  },
  // 19-EDO with 4:5:6-like triads and additional color spreads.
  19: {
    label: '19-EDO',
    description: '19-tone equal temperament with 4:5:6-like color and microtonal spreads.',
    chords: [
      { id: '19E-major-like', name: 'Major-like triad', label: 'Pattern: [0,6,10] (≈4:5:6)', degrees: [0, 6, 10] },
      { id: '19E-minor-like', name: 'Minor-like triad', label: 'Pattern: [0,5,10] (≈10:12:15)', degrees: [0, 5, 10] },
      { id: '19E-dominantish', name: 'Dominant-like 7', label: 'Pattern: [0,6,10,14] (b7 color)', degrees: [0, 6, 10, 14] },
      { id: '19E-color-wide', name: 'Wide color chord', label: 'Pattern: [0,8,11] (bright stretch)', degrees: [0, 8, 11] },
      { id: '19E-color-narrow', name: 'Narrow color chord', label: 'Pattern: [0,3,9] (clustered)', degrees: [0, 3, 9] },
      { id: '19E-sus', name: 'Suspended flavor', label: 'Pattern: [0,6,9,14] (open sus)', degrees: [0, 6, 9, 14] },
    ],
    rootCount: 38,
  },
  // 24-EDO quarter-tone terrain with neutral thirds and tight clusters.
  24: {
    label: '24-EDO',
    description: 'Quarter-tone 24-EDO with neutral and clustered colors.',
    chords: [
      { id: '24E-neutral', name: 'Neutral triad', label: 'Pattern: [0,7,14] (neutral third/fifth)', degrees: [0, 7, 14] },
      { id: '24E-majorish', name: 'Bright quarter triad', label: 'Pattern: [0,8,14] (major-ish)', degrees: [0, 8, 14] },
      { id: '24E-minorish', name: 'Soft quarter triad', label: 'Pattern: [0,6,14] (minor-ish)', degrees: [0, 6, 14] },
      { id: '24E-cluster', name: 'Quarter-tone cluster', label: 'Pattern: [0,1,7,13] (tight cluster)', degrees: [0, 1, 7, 13] },
      { id: '24E-sus-color', name: 'Suspended color', label: 'Pattern: [0,6,12,18] (stacked fourths)', degrees: [0, 6, 12, 18] },
      { id: '24E-extended', name: 'Extended shimmer', label: 'Pattern: [0,8,14,20] (wide top)', degrees: [0, 8, 14, 20] },
    ],
    rootCount: 48,
  },
  // 32-EDO dense lattice with small-step interval play.
  32: {
    label: '32-EDO',
    description: 'Dense microtonal 32-EDO showcasing small-step color.',
    chords: [
      { id: '32E-steps-235', name: 'Step weave', label: 'Pattern: [0,2,5,9] (2/3/5 steps)', degrees: [0, 2, 5, 9] },
      { id: '32E-steps-357', name: 'Cascading 3/5/7', label: 'Pattern: [0,3,7,12] (3/5/7 steps)', degrees: [0, 3, 7, 12] },
      { id: '32E-bright', name: 'Bright fifth stack', label: 'Pattern: [0,5,10,17] (stacked fifth-ish)', degrees: [0, 5, 10, 17] },
      { id: '32E-color', name: 'Color lattice', label: 'Pattern: [0,7,14,21] (sevenths apart)', degrees: [0, 7, 14, 21] },
      { id: '32E-tight', name: 'Tight micro cluster', label: 'Pattern: [0,2,4,7] (close lead)', degrees: [0, 2, 4, 7] },
      { id: '32E-wide', name: 'Wide micro spread', label: 'Pattern: [0,5,11,19] (arching spread)', degrees: [0, 5, 11, 19] },
    ],
    rootCount: 64,
  },
};

function edoFrequency(baseFrequency, stepCount, degree) {
  return baseFrequency * 2 ** (degree / stepCount);
}

function scalaFrequency(baseFrequency, intervals, degree) {
  if (!intervals.length) return baseFrequency;
  const index = degree % intervals.length;
  const octaves = Math.floor(degree / intervals.length);
  const cents = intervals[index];
  return baseFrequency * 2 ** octaves * 2 ** (cents / 1200);
}

function parseTuningId(tuningId, fallbackType, fallbackValue) {
  if (tuningId) {
    const [type, ...rest] = tuningId.split(':');
    const value = rest.join(':');
    return { tuningType: type, tuningValue: type === 'edo' ? parseInt(value, 10) : value };
  }
  return { tuningType: fallbackType, tuningValue: fallbackValue };
}

function tuningRoots({ tuningType, tuningValue, rootCount }) {
  if (tuningType === 'edo' && tuningValue === 12) {
    return NOTE_NAMES_12EDO.map((name, index) => ({ value: index, label: name }));
  }
  const degreeCount = tuningType === 'edo' ? tuningValue : tuningValue;
  const count = rootCount || degreeCount * (tuningType === 'edo' ? 2 : 1) || 24;
  return Array.from({ length: count }, (_, index) => ({ value: index, label: `Degree ${index}` }));
}

function generateEdoChords(stepCount) {
  const patterns = [
    { name: 'Bright triad', semitones: [0, 4, 7] },
    { name: 'Mild triad', semitones: [0, 3, 7] },
    { name: 'Tetrad', semitones: [0, 4, 7, 10] },
  ];
  return patterns.map((pattern, index) => {
    const degrees = pattern.semitones.map((semi) => Math.round((semi / 12) * stepCount));
    return {
      id: `edo-${stepCount}-pattern-${index}`,
      name: `${pattern.name}`,
      label: `${pattern.name} (${stepCount}-EDO)`,
      degrees,
    };
  });
}

function generateScalaChords(intervals, name) {
  if (!intervals.length) return [];
  const chords = [];
  for (let i = 0; i < Math.min(intervals.length, 5); i += 1) {
    const base = i;
    const triad = [base, base + 2, base + 4].filter((d) => d < intervals.length);
    const tetrad = [base, base + 1, base + 3, base + 6].filter((d) => d < intervals.length);
    if (triad.length >= 3) {
      chords.push({ id: `scala-${name}-triad-${base}`, name: `Triad from degree ${base + 1}`, label: `Triad (degree ${base + 1})`, degrees: triad });
    }
    if (tetrad.length >= 3) {
      chords.push({ id: `scala-${name}-color-${base}`, name: `Color chord ${base + 1}`, label: `Color chord (degree ${base + 1})`, degrees: tetrad });
    }
  }
  return chords;
}

function listTunings() {
  const edoSteps = [12, 19, 24, 32, 8, 31];
  const edoList = edoSteps.map((steps) => ({
    id: `edo:${steps}`,
    type: 'edo',
    value: steps,
    label: EDO_PRESETS[steps]?.label || `${steps}-EDO`,
    description: EDO_PRESETS[steps]?.description,
  }));

  const scala = loadScalaScales(config.scalesDir).map((scale) => ({
    id: `scala:${scale.name}`,
    type: 'scala',
    value: scale.name,
    label: `${scale.name} (Scala)`,
    description: scale.description,
    count: scale.count,
    intervals: scale.intervals,
  }));

  return { tunings: [...edoList, ...scala] };
}

function chordFrequencies({ tuningType, tuningValue, chord, root = 0, baseFrequency }) {
  const frequencies = [];
  if (!chord || !Array.isArray(chord.degrees)) return frequencies;
  const degrees = chord.degrees.map((degree) => degree + root);
  if (tuningType === 'edo') {
    degrees.forEach((degree) => {
      frequencies.push(edoFrequency(baseFrequency, tuningValue, degree));
    });
  } else if (tuningType === 'scala') {
    const scales = loadScalaScales(config.scalesDir);
    const selected = scales.find((scale) => scale.name === tuningValue);
    if (!selected) return frequencies;
    degrees.forEach((degree) => {
      frequencies.push(scalaFrequency(baseFrequency, selected.intervals, degree));
    });
  }
  return frequencies;
}

function chordsForEdo(tuningValue) {
  const preset = EDO_PRESETS[tuningValue];
  if (preset) {
    return { chords: preset.chords, roots: tuningRoots({ tuningType: 'edo', tuningValue, rootCount: preset.rootCount }) };
  }
  return { chords: generateEdoChords(tuningValue), roots: tuningRoots({ tuningType: 'edo', tuningValue }) };
}

function chordsForTuning({ tuningId, tuningType: rawType, tuningValue: rawValue }) {
  const { tuningType, tuningValue } = parseTuningId(tuningId, rawType, rawValue);
  if (tuningType === 'edo') {
    return chordsForEdo(tuningValue);
  }
  if (tuningType === 'scala') {
    const scales = loadScalaScales(config.scalesDir);
    const selected = scales.find((scale) => scale.name === tuningValue);
    if (!selected) return { chords: [], roots: [] };
    return { chords: generateScalaChords(selected.intervals, selected.name), roots: tuningRoots({ tuningType, tuningValue: selected.count }) };
  }
  return { chords: [], roots: [] };
}

module.exports = { listTunings, chordsForTuning, chordFrequencies, parseTuningId, tuningRoots, NOTE_NAMES_12EDO };
