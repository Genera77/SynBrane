const fs = require('fs');
const path = require('path');
const config = require('../config');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function dbToLinear(db) {
  return 10 ** (db / 20);
}

function applyNormalization(samples, targetDb = -4) {
  const targetPeak = dbToLinear(targetDb);
  let peak = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }

  if (peak === 0) {
    return { gain: 1, peak };
  }

  const gain = targetPeak / peak;
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] *= gain;
  }

  return { gain, peak };
}

const RHYTHM_BASE_MAPPING = 0.005;

const DRUM_VOICES = [
  { baseFrequency: 70, decay: 0.28, noiseMix: 0.12, partials: [1, 1.7, 2.2, 3.1], saturation: 0.8, amplitude: 0.95 },
  { baseFrequency: 105, decay: 0.22, noiseMix: 0.1, partials: [1, 1.9, 2.6, 3.6], saturation: 0.8, amplitude: 0.85 },
  { baseFrequency: 150, decay: 0.18, noiseMix: 0.14, partials: [1, 2.3, 3.3, 4.6], saturation: 0.8, amplitude: 0.8 },
  { baseFrequency: 320, decay: 0.08, noiseMix: 0.55, partials: [2, 5, 7, 11], saturation: 0.9, amplitude: 0.7 },
  { baseFrequency: 320, decay: 0.18, noiseMix: 0.6, partials: [3, 7, 10, 14], saturation: 0.95, amplitude: 0.75 },
  { baseFrequency: 380, decay: 0.22, noiseMix: 0.45, partials: [3, 7, 11, 15], saturation: 0.85, amplitude: 0.7 },
  { baseFrequency: 520, decay: 0.06, noiseMix: 0.35, partials: [5, 9, 13, 17], saturation: 0.9, amplitude: 0.6 },
];

function mapFrequenciesToRhythm(frequencies, mappingFactor) {
  const multiplier = Math.max(0.5, Number(mappingFactor) || 3);
  return frequencies.map((freq) => Math.max(0.5, freq * RHYTHM_BASE_MAPPING * multiplier));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSynthSettings(raw = {}) {
  const envelope = raw.envelope || raw.adsr || {};
  const filter = raw.filter || {};
  return {
    waveform: raw.waveform || 'saw',
    envelope: {
      attackMs: clamp(Number(envelope.attackMs ?? 40), 0, 5000),
      decayMs: clamp(Number(envelope.decayMs ?? 200), 0, 5000),
      sustainLevel: clamp(Number(envelope.sustainLevel ?? 0.7), 0, 1),
      releaseMs: clamp(Number(envelope.releaseMs ?? 800), 0, 5000),
    },
    filter: {
      cutoffHz: clamp(Number(filter.cutoffHz ?? 12000), 50, 20000),
      resonance: clamp(Number(filter.resonance ?? 0.2), 0, 1),
    },
  };
}

function createAdsrEnvelope(totalSamples, sampleRate, sustainUntil, envelope) {
  const env = new Float32Array(totalSamples);
  const attack = envelope.attackMs / 1000;
  const decay = envelope.decayMs / 1000;
  const release = envelope.releaseMs / 1000;
  const sustain = envelope.sustainLevel;
  const sustainEnd = Math.max(sustainUntil, attack + decay);

  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    if (attack > 0 && t < attack) {
      env[i] = t / attack;
    } else if (decay > 0 && t < attack + decay) {
      const progress = (t - attack) / Math.max(decay, 1e-6);
      env[i] = 1 - (1 - sustain) * progress;
    } else if (t < sustainEnd) {
      env[i] = sustain;
    } else if (release > 0) {
      const releasePos = (t - sustainEnd) / release;
      env[i] = Math.max(0, sustain * (1 - releasePos));
    } else {
      env[i] = sustain;
    }
  }

  return env;
}

function waveSample(phase, waveform) {
  const twoPi = Math.PI * 2;
  const wrapped = phase % twoPi;
  if (waveform === 'square') {
    return wrapped < Math.PI ? 1 : -1;
  }
  if (waveform === 'saw') {
    return 1 - (2 * wrapped) / twoPi;
  }
  return Math.sin(wrapped);
}

function applyLowPassFilter(samples, sampleRate, cutoffHz, resonance = 0.2) {
  const nyquist = sampleRate / 2;
  const cutoff = clamp(cutoffHz, 50, nyquist - 100);
  const q = 0.5 + resonance * 11.5; // map 0–1 to a musically useful Q span
  const omega = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const cosw = Math.cos(omega);

  const b0 = (1 - cosw) / 2;
  const b1 = 1 - cosw;
  const b2 = (1 - cosw) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw;
  const a2 = 1 - alpha;

  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    samples[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
}

function addBackboneHits(samples, startSample, sampleRate, durationSeconds, bpm) {
  const secondsPerBeat = 60 / bpm;
  const totalBeats = Math.ceil(durationSeconds / secondsPerBeat);
  for (let beat = 0; beat < totalBeats; beat += 1) {
    const hitSample = startSample + Math.floor(beat * secondsPerBeat * sampleRate);
    addPercussiveHit(samples, hitSample, sampleRate, {
      amplitude: 1,
      attack: 0.003,
      decay: 0.26,
      baseFrequency: 55,
      partials: [1, 2.1, 2.9],
      noiseMix: 0.08,
      saturation: 0.9,
    });
    if (beat % 4 === 1 || beat % 4 === 3) {
      addPercussiveHit(samples, hitSample, sampleRate, {
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

function addRhythmVoices(samples, startSample, sampleRate, durationSeconds, frequencies, mappingFactor) {
  const rates = mapFrequenciesToRhythm(frequencies, mappingFactor || 3);
  const durationSamples = Math.floor(durationSeconds * sampleRate);
  rates.forEach((rate, index) => {
    const intervalSamples = Math.max(1, Math.floor(sampleRate / rate));
    const voice = DRUM_VOICES[index] || DRUM_VOICES[DRUM_VOICES.length - 1];
    for (let offset = 0; offset < durationSamples; offset += intervalSamples) {
      addPercussiveHit(samples, startSample + offset, sampleRate, {
        amplitude: voice.amplitude || 0.6,
        attack: voice.attack ?? 0.004,
        decay: voice.decay ?? 0.12,
        baseFrequency: voice.baseFrequency ?? Math.max(40, Math.min((frequencies[index] || 80) * 0.5, 260)),
        partials: voice.partials,
        noiseMix: voice.noiseMix ?? 0.35,
        saturation: voice.saturation ?? 0.85,
      });
    }
  });
}

function generateChordSamples({ mode, frequencies = [], duration, sampleRate, mappingFactor, synthSettings, bpm = 120 }) {
  if (mode === 'rhythm') {
    const totalSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(totalSamples);
    addBackboneHits(samples, 0, sampleRate, duration, bpm);
    addRhythmVoices(samples, 0, sampleRate, duration, frequencies, mappingFactor);
    return samples;
  }

  const synth = normalizeSynthSettings(synthSettings);
  const baseDuration = duration || 1;
  const releaseSeconds = synth.envelope.releaseMs / 1000;
  const totalDuration = baseDuration + releaseSeconds;
  const totalSamples = Math.max(1, Math.floor(sampleRate * totalDuration));
  const samples = new Float32Array(totalSamples);
  const envelope = createAdsrEnvelope(totalSamples, sampleRate, baseDuration, synth.envelope);
  const amplitude = 0.5 / Math.max(frequencies.length, 1);

  frequencies.forEach((freq) => {
    let phase = 0;
    const phaseIncrement = (2 * Math.PI * freq) / sampleRate;
    for (let i = 0; i < totalSamples; i += 1) {
      samples[i] += waveSample(phase, synth.waveform) * envelope[i] * amplitude;
      phase += phaseIncrement;
    }
  });

  if (synth.filter && synth.filter.cutoffHz) {
    applyLowPassFilter(samples, sampleRate, synth.filter.cutoffHz, synth.filter.resonance);
  }

  return samples;
}

function addPercussiveHit(samples, startSample, sampleRate, {
  amplitude = 1,
  attack = 0.004,
  decay = 0.12,
  baseFrequency = 80,
  partials = [1, 2, 3, 4],
  noiseMix = 0.25,
  saturation = 0.85,
} = {}) {
  const attackSamples = Math.max(1, Math.floor(attack * sampleRate));
  const decaySamples = Math.max(1, Math.floor(decay * sampleRate));
  const totalSamples = attackSamples + decaySamples;

  for (let i = 0; i < totalSamples; i += 1) {
    const env = i < attackSamples
      ? i / attackSamples
      : 1 - (i - attackSamples) / decaySamples;
    const time = i / sampleRate;
    let sampleValue = 0;

    if (noiseMix > 0) {
      sampleValue += (Math.random() * 2 - 1) * noiseMix;
    }

    if (partials?.length) {
      partials.forEach((partial, index) => {
        const weight = 1 / Math.max(1.5, index + 1);
        sampleValue += Math.sin(2 * Math.PI * baseFrequency * partial * time) * weight;
      });
    }

    const targetIndex = startSample + i;
    if (targetIndex < samples.length) {
      const raw = sampleValue * env * amplitude;
      const clipped = Math.tanh(raw * (1 + saturation * 2));
      samples[targetIndex] += clipped;
    }
  }
}

function generateSequenceSamples({ mode, events, bpm, sampleRate, mappingFactor, synthSettings }) {
  const beatsPerBar = 4;
  const secondsPerBeat = 60 / bpm;
  const barDuration = secondsPerBeat * beatsPerBar;
  const normalizedSynth = mode === 'harmony' ? normalizeSynthSettings(synthSettings) : null;
  const releaseSeconds = normalizedSynth ? normalizedSynth.envelope.releaseMs / 1000 : 0;
  const totalBars = Math.max(...events.map((event) => (event.bar || 0) + (event.durationBars || 1)), 1);
  const totalDuration = totalBars * barDuration + releaseSeconds;
  const totalSamples = Math.ceil(sampleRate * totalDuration);
  const samples = new Float32Array(totalSamples);

  events.forEach((event) => {
    const startTime = barDuration * (event.bar || 0);
    const duration = barDuration * (event.durationBars || 1);
    const startSample = Math.floor(startTime * sampleRate);
    const buffer = generateChordSamples({
      mode,
      frequencies: event.frequencies || [],
      duration,
      sampleRate,
      mappingFactor,
      synthSettings: normalizedSynth || synthSettings,
      bpm,
    });
    const copyLength = Math.min(buffer.length, samples.length - startSample);
    for (let i = 0; i < copyLength; i += 1) {
      samples[startSample + i] += buffer[i];
    }
  });

  return samples;
}

function encodeWav(samples, sampleRate) {
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

function renderToFile({ mode, frequencies, duration, mappingFactor, rhythmSpeed, events, bpm, synthSettings }) {
  ensureDir(config.renderOutputDir);
  const sampleRate = config.renderSampleRate;
  const effectiveMapping = rhythmSpeed ?? mappingFactor;
  let samples;
  if (Array.isArray(events) && events.length) {
    samples = generateSequenceSamples({ mode, events, bpm: bpm || 120, sampleRate, mappingFactor: effectiveMapping, synthSettings });
  } else {
    samples = generateChordSamples({
      mode,
      frequencies,
      duration,
      sampleRate,
      mappingFactor: effectiveMapping,
      synthSettings,
      bpm: bpm || 120,
    });
  }
  applyNormalization(samples);
  const wav = encodeWav(samples, sampleRate);
  const filename = `render-${mode}-${Date.now()}.wav`;
  const filePath = path.join(config.renderOutputDir, filename);
  fs.writeFileSync(filePath, wav);
  return { filePath, filename };
}

function playRealtime(job) {
  // Placeholder for SuperCollider integration. In a full build, this would
  // send OSC messages or score data to scsynth/sclang. Here we simply log the
  // job so that the backend can be wired to a sound engine later.
  // eslint-disable-next-line no-console
  console.log('[playRealtime]', { ...job, loopCount: job.loopCount || 1, synthSettings: normalizeSynthSettings(job.synthSettings) });
  return { status: 'scheduled' };
}

module.exports = { renderToFile, playRealtime };
