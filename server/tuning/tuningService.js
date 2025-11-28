const config = require('../config');
const { loadScalaScales } = require('./scalaLoader');

function edoFrequency(baseFrequency, stepCount, degree) {
  return baseFrequency * 2 ** (degree / stepCount);
}

function scalaFrequency(baseFrequency, intervals, degree) {
  if (!intervals.length) return baseFrequency;
  const index = degree % intervals.length;
  const octaves = Math.floor(degree / intervals.length);
  const cents = intervals[index];
  return baseFrequency * 2 ** (octaves) * 2 ** (cents / 1200);
}

function generateEdoChords(stepCount) {
  const patterns = [
    { name: 'Bright triad', semitones: [0, 4, 7] },
    { name: 'Mild triad', semitones: [0, 3, 7] },
    { name: 'Tetrad', semitones: [0, 4, 7, 10] },
  ];
  return patterns.map((pattern) => {
    const degrees = pattern.semitones.map((semi) => Math.round((semi / 12) * stepCount));
    return { name: `${pattern.name} (${stepCount}-EDO)`, degrees };
  });
}

function generateScalaChords(intervals) {
  if (!intervals.length) return [];
  const chords = [];
  for (let i = 0; i < Math.min(intervals.length, 5); i += 1) {
    const base = i;
    const triad = [base, base + 2, base + 4].filter((d) => d < intervals.length);
    const tetrad = [base, base + 1, base + 3, base + 6].filter((d) => d < intervals.length);
    if (triad.length >= 3) chords.push({ name: `Triad from degree ${base + 1}`, degrees: triad });
    if (tetrad.length >= 3) chords.push({ name: `Color chord ${base + 1}`, degrees: tetrad });
  }
  return chords;
}

function listTunings() {
  const edos = [8, 12, 19, 24, 31];
  const scala = loadScalaScales(config.scalesDir).map((scale) => ({
    name: scale.name,
    description: scale.description,
    count: scale.count,
    intervals: scale.intervals,
  }));
  return { edos, scala };
}

function chordFrequencies({ tuningType, tuningValue, chord, baseFrequency }) {
  const frequencies = [];
  if (tuningType === 'edo') {
    chord.degrees.forEach((degree) => {
      frequencies.push(edoFrequency(baseFrequency, tuningValue, degree));
    });
  } else if (tuningType === 'scala') {
    const scales = loadScalaScales(config.scalesDir);
    const selected = scales.find((scale) => scale.name === tuningValue);
    if (!selected) return frequencies;
    chord.degrees.forEach((degree) => {
      frequencies.push(scalaFrequency(baseFrequency, selected.intervals, degree));
    });
  }
  return frequencies;
}

function chordsForTuning({ tuningType, tuningValue }) {
  if (tuningType === 'edo') {
    return generateEdoChords(tuningValue);
  }
  if (tuningType === 'scala') {
    const scales = loadScalaScales(config.scalesDir);
    const selected = scales.find((scale) => scale.name === tuningValue);
    if (!selected) return [];
    return generateScalaChords(selected.intervals);
  }
  return [];
}

module.exports = { listTunings, chordsForTuning, chordFrequencies };
