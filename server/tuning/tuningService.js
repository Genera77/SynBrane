const config = require('../config');
const { loadScalaScales } = require('./scalaLoader');

const NOTE_NAMES_12EDO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ORWELL_ID = 'edo:9-orwell';

const EDO_TUNINGS = [
  {
    id: 'edo:12',
    value: 12,
    label: '12-EDO (chromatic)',
    description: 'Standard 12-TET with extended and altered chord families across all roots.',
  },
  {
    id: 'edo:19',
    value: 19,
    label: '19-EDO',
    description: '19-tone equal temperament with 4:5:6-like color, clusters, and stacked shapes.',
    rootCount: 38,
  },
  {
    id: 'edo:22',
    value: 22,
    label: '22-EDO',
    description: '22-tone equal temperament with close meantone color and flexible thirds.',
    rootCount: 44,
  },
  {
    id: 'edo:24',
    value: 24,
    label: '24-EDO',
    description: 'Quarter-tone 24-EDO with neutral, bright, and clustered colors.',
    rootCount: 48,
  },
  {
    id: 'edo:8',
    value: 8,
    label: '8-EDO',
    description: '8-tone equal temperament with symmetric structures and alternating step colors.',
  },
  {
    id: 'edo:31',
    value: 31,
    label: '31-EDO',
    description: '31-tone meantone lattice with tight 5-limit approximations and extended dominants.',
  },
  {
    id: ORWELL_ID,
    value: 9,
    label: 'Orwell-9',
    description: 'Orwell 9-EDO — designed by Erv Wilson; supports neutral thirds, wide tetrads, non-octave colorations.',
  },
];

function ratioToCents(ratio) {
  return 1200 * Math.log2(ratio);
}

const UNIVERSAL_PRESETS = [
  { id: 'major-triad', label: 'Major Triad', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2)] },
  { id: 'minor-triad', label: 'Minor Triad', cents: [0, ratioToCents(6 / 5), ratioToCents(3 / 2)] },
  { id: 'diminished-triad', label: 'Diminished Triad', cents: [0, 300, 600] },
  { id: 'augmented-triad', label: 'Augmented Triad', cents: [0, 400, 800] },
  { id: 'major-7', label: 'Major 7', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), ratioToCents(15 / 8)] },
  { id: 'minor-7', label: 'Minor 7', cents: [0, ratioToCents(6 / 5), ratioToCents(3 / 2), 1000] },
  { id: 'dominant-7', label: 'Dominant 7', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 1000] },
  { id: 'sus2', label: 'Suspended 2', cents: [0, 200, ratioToCents(3 / 2)] },
  { id: 'sus4', label: 'Suspended 4', cents: [0, ratioToCents(4 / 3), ratioToCents(3 / 2)] },
  { id: 'add9', label: 'Add9', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 1400] },
  { id: 'add11', label: 'Add11', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 1700] },
  { id: 'add13', label: 'Add13', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 2100] },
  { id: 'sixth', label: '6 Chord', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 900] },
  { id: 'dominant-9', label: '9 Chord', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 1000, 1400] },
  { id: 'dominant-11', label: '11 Chord', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 1000, 1400, 1700] },
  { id: 'dominant-13', label: '13 Chord', cents: [0, ratioToCents(5 / 4), ratioToCents(3 / 2), 1000, 1400, 1700, 2100] },
  { id: 'quartal', label: 'Quartal Triad', cents: [0, ratioToCents(4 / 3), ratioToCents(4 / 3) * 2] },
  { id: 'quintal', label: 'Quintal Triad', cents: [0, ratioToCents(3 / 2), ratioToCents(3 / 2) * 2] },
  { id: 'cluster-tight', label: 'Tight Cluster', cents: [0, 120, 240] },
  { id: 'cluster-wide', label: '2–3 Step Cluster', cents: [0, 200, 350] },
];

const TEMPERAMENT_SPECIFIC = {
  'edo:12': [
    { id: '12-edo-half-dim7', label: 'Half-diminished 7', degrees: [0, 3, 6, 10] },
    { id: '12-edo-alt-b9', label: 'Altered dom (b9)', degrees: [0, 4, 7, 10, 13] },
    { id: '12-edo-alt-sharp9', label: 'Altered dom (#9)', degrees: [0, 4, 7, 10, 15] },
    { id: '12-edo-alt-b5', label: 'Altered dom (b5)', degrees: [0, 4, 6, 10] },
    { id: '12-edo-alt-sharp5', label: 'Altered dom (#5)', degrees: [0, 4, 8, 10] },
  ],
  'edo:8': [
    { id: '8-edo-symmetric-tetrad', label: 'Symmetric Tetrad', degrees: [0, 2, 4, 6] },
    { id: '8-edo-alt-steps', label: 'Alternating 1–2 Steps', degrees: [0, 1, 3, 4, 6] },
    { id: '8-edo-diminished-like', label: '8-EDO Diminished Symmetry', degrees: [0, 2, 5] },
    { id: '8-edo-tetrachord-chain', label: 'Tetrachord Chain', degrees: [0, 2, 4, 7] },
  ],
  'edo:19': [
    { id: '19-edo-neutral-triad', label: 'Neutral Third Triad', degrees: [0, 6, 11] },
    { id: '19-edo-supermajor', label: 'Supermajor Triad', degrees: [0, 7, 12] },
    { id: '19-edo-subminor', label: 'Subminor Triad', degrees: [0, 5, 11] },
    { id: '19-edo-aug-cluster', label: 'Augmented Cluster', degrees: [0, 8, 15] },
    { id: '19-edo-wilsonic-hexad', label: 'Wilsonic Hexad', degrees: [0, 3, 6, 10, 13, 16] },
  ],
  'edo:22': [
    { id: '22-edo-wide-major', label: 'Wide Major Triad', degrees: [0, 8, 14] },
    { id: '22-edo-septimalish', label: 'Septimal Approximant', degrees: [0, 6, 10, 15] },
    { id: '22-edo-blues-hexad', label: '22-EDO Blues Hexad', degrees: [0, 3, 6, 10, 14, 18] },
  ],
  'edo:24': [
    { id: '24-edo-half-flat', label: 'Half-Flat Triad', degrees: [0, 7, 14] },
    { id: '24-edo-half-sharp', label: 'Half-Sharp Triad', degrees: [0, 8, 14] },
    { id: '24-edo-arabic-jins', label: 'Arabic Jins Tetrachord', degrees: [0, 3, 7, 10] },
    { id: '24-edo-aug-neutral', label: 'Augmented Neutral', degrees: [0, 8, 16] },
    { id: '24-edo-quarter-cluster', label: 'Quarter-Tone Cluster', degrees: [0, 1, 2, 5] },
  ],
  'edo:31': [
    { id: '31-edo-supermajor', label: 'Supermajor Triad', degrees: [0, 10, 19] },
    { id: '31-edo-ultramajor', label: 'Ultramajor Third', degrees: [0, 11, 19] },
    { id: '31-edo-subminor-pentad', label: 'Subminor + Supermajor Pentad', degrees: [0, 8, 16, 21, 27] },
    { id: '31-edo-5-limit', label: '31-EDO 5-limit Approximant', degrees: [0, 9, 18] },
    { id: '31-edo-extended-dominant', label: 'Extended Meantone Dominant', degrees: [0, 9, 18, 25] },
  ],
  [ORWELL_ID]: [
    { id: 'orwell-neutral-triad', label: 'Neutral Triad', degrees: [0, 3, 6] },
    { id: 'orwell-wide-tetrad', label: 'Orwell Wide Tetrad', degrees: [0, 3, 6, 8] },
    { id: 'orwell-neutral-pentad', label: 'Neutral Pentad', degrees: [0, 2, 4, 6, 8] },
    { id: 'orwell-meta-major', label: 'Wilson Meta-Major', degrees: [0, 3, 7] },
    { id: 'orwell-symmetric-333', label: 'Symmetric 3-3-3', degrees: [0, 3, 6, 9] },
  ],
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

function nearestScalaDegree(intervals = [], cents) {
  if (!intervals.length) return 0;
  const remainder = ((cents % 1200) + 1200) % 1200;
  let bestIndex = 0;
  let bestDiff = Infinity;
  intervals.forEach((val, idx) => {
    const diff = Math.abs(val - remainder);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = idx;
    }
  });
  return bestIndex;
}

function mapCentsToDegree({ cents, tuningType, tuningValue, intervals }) {
  const span = tuningType === 'edo' ? tuningValue : intervals.length || tuningValue;
  if (!span) return 0;
  const octaves = Math.floor(cents / 1200);
  const remainder = ((cents % 1200) + 1200) % 1200;
  if (tuningType === 'edo') {
    const degree = Math.round((remainder / 1200) * span);
    return degree + octaves * span;
  }
  const degree = nearestScalaDegree(intervals, remainder);
  return degree + octaves * span;
}

function degreesFromCentsList({ centsList, tuningType, tuningValue, intervals }) {
  const degrees = centsList.map((cents) => mapCentsToDegree({ cents, tuningType, tuningValue, intervals }));
  return Array.from(new Set(degrees)).sort((a, b) => a - b);
}

function mapUniversalPresetsToTuning({ tuningType, tuningValue, intervals, tuningId }) {
  return UNIVERSAL_PRESETS.map((preset) => ({
    id: preset.id,
    label: preset.label,
    degrees: degreesFromCentsList({
      centsList: preset.cents,
      tuningType,
      tuningValue,
      intervals,
    }),
    tuningId,
  }));
}

function temperamentSpecificForTuning(tuningId, tuningValue) {
  const direct = TEMPERAMENT_SPECIFIC[tuningId];
  if (direct) return direct;
  const genericKey = `edo:${tuningValue}`;
  return TEMPERAMENT_SPECIFIC[genericKey] || [];
}

function generateScalaSpecificChords(intervals, name) {
  if (!intervals.length) return [];
  const span = intervals.length;
  const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const chords = [];

  for (let degree = 0; degree < span; degree += 1) {
    const triad = [degree, degree + 2, degree + 4];
    const tetrad = [degree, degree + 2, degree + 4, degree + 6];
    chords.push({ id: `scala-${safeName}-triad-${degree}`, label: `Deg ${degree} triad (1-3-5)`, degrees: triad });
    chords.push({ id: `scala-${safeName}-tetrad-${degree}`, label: `Deg ${degree} modal tetrad`, degrees: tetrad });
  }

  const fifthTarget = ratioToCents(3 / 2);
  const closestFifth = nearestScalaDegree(intervals, fifthTarget) || 1;
  chords.push({ id: `scala-${safeName}-fifth-stack`, label: 'Fifth-stack chord', degrees: [0, closestFifth, closestFifth * 2] });

  const steps = intervals.map((cents, idx) => {
    const next = intervals[(idx + 1) % span] || 1200;
    const width = idx === span - 1 ? 1200 - cents : next - cents;
    return width;
  });
  const sortedSteps = [...steps].sort((a, b) => a - b);
  const smallest = sortedSteps[0];
  const largest = sortedSteps[sortedSteps.length - 1];
  const median = sortedSteps[Math.floor(sortedSteps.length / 2)];
  const modalCents = [0, smallest, smallest + median, smallest + median + largest];
  chords.push({
    id: `scala-${safeName}-step-weave`,
    label: 'Step-type weave',
    degrees: degreesFromCentsList({ centsList: modalCents, tuningType: 'scala', tuningValue: span, intervals }),
  });

  return chords;
}

function listTunings() {
  const edoList = EDO_TUNINGS.map((edo) => ({
    id: edo.id,
    type: 'edo',
    value: edo.value,
    label: edo.label,
    description: edo.description,
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

function chordsForEdo(tuningValue, tuningId) {
  const universal = mapUniversalPresetsToTuning({ tuningType: 'edo', tuningValue, intervals: [], tuningId });
  const specific = temperamentSpecificForTuning(tuningId || `edo:${tuningValue}`, tuningValue);
  const meta = EDO_TUNINGS.find((edo) => edo.id === tuningId) || EDO_TUNINGS.find((edo) => edo.value === tuningValue);
  return {
    chords: [...universal, ...specific],
    roots: tuningRoots({ tuningType: 'edo', tuningValue, rootCount: meta?.rootCount }),
  };
}

function chordsForTuning({ tuningId, tuningType: rawType, tuningValue: rawValue }) {
  const { tuningType, tuningValue } = parseTuningId(tuningId, rawType, rawValue);
  if (tuningType === 'edo') {
    return chordsForEdo(tuningValue, tuningId);
  }
  if (tuningType === 'scala') {
    const scales = loadScalaScales(config.scalesDir);
    const selected = scales.find((scale) => scale.name === tuningValue);
    if (!selected) return { chords: [], roots: [] };
    const span = selected.intervals?.length || selected.count || 12;
    const universal = mapUniversalPresetsToTuning({ tuningType, tuningValue: span, intervals: selected.intervals, tuningId });
    const scalaChords = generateScalaSpecificChords(selected.intervals, selected.name);
    return { chords: [...universal, ...scalaChords], roots: tuningRoots({ tuningType, tuningValue: span }) };
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
