const config = require('../config');
const { loadScalaScales } = require('./scalaLoader');

const NOTE_NAMES_12EDO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const EDO_PRESETS = {
  // 12-TET chromatic system with full major/minor families and 7th extensions.
  12: {
    label: '12-EDO (chromatic)',
    description: 'Standard 12-TET with extended and altered chord families across all roots.',
    chords: [
      { id: '12E-major', name: 'Major triad', label: '12-EDO major triad [0,4,7]', degrees: [0, 4, 7] },
      { id: '12E-minor', name: 'Minor triad', label: '12-EDO minor triad [0,3,7]', degrees: [0, 3, 7] },
      { id: '12E-diminished', name: 'Diminished', label: '12-EDO diminished [0,3,6]', degrees: [0, 3, 6] },
      { id: '12E-augmented', name: 'Augmented', label: '12-EDO augmented [0,4,8]', degrees: [0, 4, 8] },
      { id: '12E-sus2', name: 'Suspended 2', label: '12-EDO sus2 [0,2,7]', degrees: [0, 2, 7] },
      { id: '12E-sus4', name: 'Suspended 4', label: '12-EDO sus4 [0,5,7]', degrees: [0, 5, 7] },
      { id: '12E-sixth', name: 'Sixth chord', label: '12-EDO 6 chord [0,4,7,9]', degrees: [0, 4, 7, 9] },
      { id: '12E-add9', name: 'Add9', label: '12-EDO add9 [0,4,7,14]', degrees: [0, 4, 7, 14] },
      { id: '12E-dominant7', name: 'Dominant 7', label: '12-EDO dom7 [0,4,7,10]', degrees: [0, 4, 7, 10] },
      { id: '12E-major7', name: 'Major 7', label: '12-EDO maj7 [0,4,7,11]', degrees: [0, 4, 7, 11] },
      { id: '12E-minor7', name: 'Minor 7', label: '12-EDO min7 [0,3,7,10]', degrees: [0, 3, 7, 10] },
      { id: '12E-half-dim7', name: 'Half-diminished 7', label: '12-EDO half-diminished 7 [0,3,6,10]', degrees: [0, 3, 6, 10] },
      { id: '12E-dominant9', name: 'Dominant 9', label: '12-EDO dom9 [0,4,7,10,14]', degrees: [0, 4, 7, 10, 14] },
      { id: '12E-major9', name: 'Major 9', label: '12-EDO maj9 [0,4,7,11,14]', degrees: [0, 4, 7, 11, 14] },
      { id: '12E-dominant11', name: 'Dominant 11', label: '12-EDO dom11 [0,4,7,10,14,17]', degrees: [0, 4, 7, 10, 14, 17] },
      { id: '12E-major11', name: 'Major 11', label: '12-EDO maj11 [0,4,7,11,14,17]', degrees: [0, 4, 7, 11, 14, 17] },
      { id: '12E-dominant13', name: 'Dominant 13', label: '12-EDO dom13 [0,4,7,10,14,17,21]', degrees: [0, 4, 7, 10, 14, 17, 21] },
      { id: '12E-major13', name: 'Major 13', label: '12-EDO maj13 [0,4,7,11,14,17,21]', degrees: [0, 4, 7, 11, 14, 17, 21] },
      { id: '12E-alt-b9', name: 'Altered dom b9', label: '12-EDO altered dom (b9) [0,4,7,10,13]', degrees: [0, 4, 7, 10, 13] },
      { id: '12E-alt-sharp9', name: '#9 altered dom', label: '12-EDO altered dom (#9) [0,4,7,10,15]', degrees: [0, 4, 7, 10, 15] },
      { id: '12E-alt-b5', name: 'Altered dom b5', label: '12-EDO altered dom (b5) [0,4,6,10]', degrees: [0, 4, 6, 10] },
      { id: '12E-alt-sharp5', name: '#5 altered dom', label: '12-EDO altered dom (#5) [0,4,8,10]', degrees: [0, 4, 8, 10] },
      { id: '12E-quartal', name: 'Quartal stack', label: '12-EDO quartal stack [0,5,10,15]', degrees: [0, 5, 10, 15] },
      { id: '12E-quintal', name: 'Quintal stack', label: '12-EDO quintal stack [0,7,14]', degrees: [0, 7, 14] },
      { id: '12E-cluster-tight', name: 'Cluster 0-1-2', label: '12-EDO cluster [0,1,2]', degrees: [0, 1, 2] },
      { id: '12E-cluster-0235', name: 'Cluster 0-2-3-5', label: '12-EDO cluster [0,2,3,5]', degrees: [0, 2, 3, 5] },
    ],
    rootCount: 12,
  },
  // 19-EDO with 4:5:6-like triads and additional color spreads.
  19: {
    label: '19-EDO',
    description: '19-tone equal temperament with 4:5:6-like color, clusters, and stacked shapes.',
    chords: [
      { id: '19E-major-like', name: 'Major-like triad', label: '19-EDO major-like triad (root + 6 + 10)', degrees: [0, 6, 10] },
      { id: '19E-minor-like', name: 'Minor-like triad', label: '19-EDO minor-like triad (root + 5 + 10)', degrees: [0, 5, 10] },
      { id: '19E-dominantish', name: 'Dominant-like 7', label: '19-EDO dominant-like 7 (0,6,10,14)', degrees: [0, 6, 10, 14] },
      { id: '19E-quartal', name: 'Stacked fourths', label: '19-EDO stack of 4ths (0,5,10,15)', degrees: [0, 5, 10, 15] },
      { id: '19E-tight-cluster', name: 'Tight cluster', label: '19-EDO cluster (0,1,3)', degrees: [0, 1, 3] },
      { id: '19E-wide-spread', name: 'Wide spread', label: '19-EDO spread (0,9,15)', degrees: [0, 9, 15] },
      { id: '19E-color-weave', name: 'Woven steps', label: '19-EDO weave (0,4,9,13)', degrees: [0, 4, 9, 13] },
    ],
    rootCount: 38,
  },
  // 24-EDO quarter-tone terrain with neutral thirds and tight clusters.
  24: {
    label: '24-EDO',
    description: 'Quarter-tone 24-EDO with neutral, bright, and clustered colors.',
    chords: [
      { id: '24E-neutral', name: 'Neutral triad', label: '24-EDO neutral triad (0,7,14)', degrees: [0, 7, 14] },
      { id: '24E-majorish', name: 'Bright quarter triad', label: '24-EDO major-like triad (0,8,14)', degrees: [0, 8, 14] },
      { id: '24E-minorish', name: 'Soft quarter triad', label: '24-EDO minor-like triad (0,6,14)', degrees: [0, 6, 14] },
      { id: '24E-dominant', name: 'Dominant-like 7', label: '24-EDO dominant-like 7 (0,8,14,20)', degrees: [0, 8, 14, 20] },
      { id: '24E-stack-4ths', name: 'Stacked fourths', label: '24-EDO stack of 4ths (0,6,12,18)', degrees: [0, 6, 12, 18] },
      { id: '24E-tight-cluster', name: 'Tight cluster', label: '24-EDO cluster (0,1,3,7)', degrees: [0, 1, 3, 7] },
      { id: '24E-wide-color', name: 'Wide color spread', label: '24-EDO spread (0,10,18)', degrees: [0, 10, 18] },
      { id: '24E-extended', name: 'Extended shimmer', label: '24-EDO extended color (0,8,14,21)', degrees: [0, 8, 14, 21] },
    ],
    rootCount: 48,
  },
  // 22-EDO bright meantone-adjacent lattice with flexible thirds.
  22: {
    label: '22-EDO',
    description: '22-tone equal temperament with close meantone color and flexible thirds.',
    chords: [
      { id: '22E-majorish', name: 'Major-ish triad', label: '22-EDO major-ish triad (0,7,13)', degrees: [0, 7, 13] },
      { id: '22E-minorish', name: 'Minor-ish triad', label: '22-EDO minor-ish triad (0,6,13)', degrees: [0, 6, 13] },
      { id: '22E-dominantish', name: 'Dominant-ish 7', label: '22-EDO dominant-ish 7 (0,7,13,19)', degrees: [0, 7, 13, 19] },
      { id: '22E-sus2', name: 'Suspended 2', label: '22-EDO sus2 (0,4,13)', degrees: [0, 4, 13] },
      { id: '22E-sus4', name: 'Suspended 4', label: '22-EDO sus4 (0,8,13)', degrees: [0, 8, 13] },
      { id: '22E-add9', name: 'Add9', label: '22-EDO add9 (0,7,13,22)', degrees: [0, 7, 13, 22] },
    ],
    rootCount: 44,
  },
};

function edoFrequency(baseFrequency, stepCount, degree) {
  return baseFrequency * 2 ** (degree / stepCount);
}

function scalaFrequency(baseFrequency, intervals, degree) {
  if (!intervals.length) return baseFrequency;
  const span = intervals.length;
  const wrappedIndex = ((degree % span) + span) % span;
  const octaves = Math.floor(degree / span);
  const cents = intervals[wrappedIndex];
  return baseFrequency * 2 ** octaves * 2 ** (cents / 1200);
}

function degreeSpanForTuning({ tuningType, tuningValue }) {
  if (tuningType === 'edo') return tuningValue || 12;
  if (tuningType === 'scala') {
    const scales = loadScalaScales(config.scalesDir);
    const selected = scales.find((scale) => scale.name === tuningValue);
    if (selected) return selected.intervals?.length || selected.count || 12;
  }
  return 12;
}

function degreeToFrequencyValue({ tuningType, tuningValue, degree, baseFrequency }) {
  if (tuningType === 'edo') {
    return edoFrequency(baseFrequency, tuningValue, degree);
  }
  if (tuningType === 'scala') {
    const scales = loadScalaScales(config.scalesDir);
    const selected = scales.find((scale) => scale.name === tuningValue);
    if (!selected) return baseFrequency;
    return scalaFrequency(baseFrequency, selected.intervals, degree);
  }
  return baseFrequency;
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
  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  for (let degree = 0; degree < intervals.length; degree += 1) {
    const triad = [degree, degree + 2, degree + 4];
    const seventh = [degree, degree + 2, degree + 4, degree + 6];
    chords.push({
      id: `scala-${safeName}-triad-${degree}`,
      name: `Deg ${degree} triad (1-3-5)`,
      label: `Deg ${degree} triad (1-3-5)`,
      degrees: triad,
    });
    chords.push({
      id: `scala-${safeName}-7th-${degree}`,
      name: `Deg ${degree} seventh (1-3-5-7)`,
      label: `Deg ${degree} seventh (1-3-5-7)`,
      degrees: seventh,
    });
  }
  return chords;
}

function listTunings() {
  const edoSteps = [12, 19, 22, 24, 8, 31];
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

  const tunings = [...edoList, ...scala].filter((tuning) => !(tuning.type === 'edo' && tuning.value === 32));
  return { tunings };
}

function chordFrequencies({ tuningType, tuningValue, chord, root = 0, baseFrequency }) {
  const frequencies = [];
  if (!chord || !Array.isArray(chord.degrees)) return frequencies;
  const degrees = chord.degrees.map((degree) => degree + root);
  degrees.forEach((degree) => {
    frequencies.push(degreeToFrequencyValue({ tuningType, tuningValue, degree, baseFrequency }));
  });
  return frequencies;
}

function resolveCustomChordDegrees({ customChord, root = 0, tuningType, tuningValue, baseFrequency }) {
  if (!customChord) return { degrees: [], frequencies: [], span: degreeSpanForTuning({ tuningType, tuningValue }) };
  const providedDegrees = Array.isArray(customChord.degrees) && customChord.degrees.length
    ? customChord.degrees.map((deg) => Number(deg))
    : null;
  const span = degreeSpanForTuning({ tuningType, tuningValue });
  const slots = Array.isArray(customChord.slots) ? customChord.slots : customChord.notes || [];
  const degrees = providedDegrees
    || slots.filter((slot) => slot.enabled).map((slot) => Number(slot.degree || 0) + Number(root || 0) + span * Number(slot.octave || 0));
  const frequencies = degrees.map((degree) => degreeToFrequencyValue({ tuningType, tuningValue, degree, baseFrequency }));
  return { degrees, frequencies, span };
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

module.exports = {
  listTunings,
  chordsForTuning,
  chordFrequencies,
  parseTuningId,
  tuningRoots,
  NOTE_NAMES_12EDO,
  degreeSpanForTuning,
  degreeToFrequencyValue,
  resolveCustomChordDegrees,
};
