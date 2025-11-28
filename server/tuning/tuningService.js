const config = require('../config');
const { loadScalaScales } = require('./scalaLoader');

const NOTE_NAMES_12EDO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

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

function tuningRoots({ tuningType, tuningValue }) {
  if (tuningType === 'edo' && tuningValue === 12) {
    return NOTE_NAMES_12EDO.map((name, index) => ({ value: index, label: name }));
  }
  const degreeCount = tuningType === 'edo' ? tuningValue : tuningValue;
  const count = degreeCount || 24;
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
  const edoList = [8, 12, 19, 24, 31].map((steps) => ({
    id: `edo:${steps}`,
    type: 'edo',
    value: steps,
    label: `${steps}-EDO`,
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

function chordsForTuning({ tuningId, tuningType: rawType, tuningValue: rawValue }) {
  const { tuningType, tuningValue } = parseTuningId(tuningId, rawType, rawValue);
  if (tuningType === 'edo') {
    return { chords: generateEdoChords(tuningValue), roots: tuningRoots({ tuningType, tuningValue }) };
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
