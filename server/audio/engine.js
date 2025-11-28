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

function exponentialDecayEnvelope(length, sampleRate, decayTime, endLevel = 0.0001) {
  const envelope = new Float32Array(length);
  const decaySamples = Math.max(1, Math.floor(decayTime * sampleRate));
  const decayRate = Math.log(endLevel) / decaySamples;
  for (let i = 0; i < length; i += 1) {
    const position = Math.min(i, decaySamples);
    envelope[i] = Math.exp(decayRate * position);
  }
  return envelope;
}

function addHarmonicTone(samples, startSample, frequency, duration, sampleRate, amplitude) {
  const totalSamples = Math.min(samples.length - startSample, Math.floor(duration * sampleRate));
  const envelope = exponentialDecayEnvelope(totalSamples, sampleRate, duration);
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    samples[startSample + i] += Math.sin(2 * Math.PI * frequency * t) * amplitude * envelope[i];
  }
}

function addPercussiveHit(samples, startSample, sampleRate, {
  amplitude = 1,
  attack = 0.001,
  decay = 0.02,
  toneFrequency = null,
  toneMix = 0,
  noiseMix = 1,
  highpassCutoff = 2500,
} = {}) {
  const attackSamples = Math.max(1, Math.floor(attack * sampleRate));
  const decaySamples = Math.max(1, Math.floor(decay * sampleRate));
  const totalSamples = attackSamples + decaySamples;
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * highpassCutoff);
  const alpha = rc / (rc + dt);
  let prevY = 0;
  let prevX = 0;

  for (let i = 0; i < totalSamples; i += 1) {
    const env = i < attackSamples
      ? i / attackSamples
      : 1 - (i - attackSamples) / decaySamples;
    const time = i / sampleRate;
    let sampleValue = 0;

    if (noiseMix > 0) {
      let noise = Math.random() * 2 - 1;
      const y = alpha * (prevY + noise - prevX);
      prevY = y;
      prevX = noise;
      noise = y;
      sampleValue += noise * noiseMix;
    }

    if (toneMix > 0 && toneFrequency) {
      sampleValue += Math.sin(2 * Math.PI * toneFrequency * time) * toneMix;
    }

    const targetIndex = startSample + i;
    if (targetIndex < samples.length) {
      samples[targetIndex] += sampleValue * env * amplitude;
    }
  }
}

function mapFrequenciesToRhythm(frequencies, mappingFactor) {
  return frequencies.map((freq) => Math.max(0.5, freq * mappingFactor));
}

function generateChordSamples({ mode, frequencies, duration, sampleRate, mappingFactor }) {
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);
  if (mode === 'harmony') {
    const amplitude = 0.5 / Math.max(frequencies.length, 1);
    frequencies.forEach((freq) => {
      addHarmonicTone(samples, 0, freq, duration, sampleRate, amplitude);
    });
  } else {
    const rates = mapFrequenciesToRhythm(frequencies, mappingFactor || 0.01);
    rates.forEach((rate, index) => {
      const intervalSeconds = 1 / rate;
      const voiceIsKick = index === 0;
      const toneFrequency = voiceIsKick ? 70 : null;
      const toneMix = voiceIsKick ? 0.6 : 0;
      const noiseMix = voiceIsKick ? 0.4 : 1;
      const decay = voiceIsKick ? 0.08 : 0.025;
      const hpCutoff = voiceIsKick ? 1800 : 3200;
      for (let t = 0; t < duration; t += intervalSeconds) {
        const startSample = Math.floor(t * sampleRate);
        addPercussiveHit(samples, startSample, sampleRate, {
          amplitude: 1 / (index + 1),
          attack: 0.0005,
          decay,
          toneFrequency,
          toneMix,
          noiseMix,
          highpassCutoff: hpCutoff,
        });
      }
    });
  }
  return samples;
}

function generateSequenceSamples({ mode, events, bpm, sampleRate, mappingFactor }) {
  const beatsPerBar = 4;
  const secondsPerBeat = 60 / bpm;
  const barDuration = secondsPerBeat * beatsPerBar;
  const totalBars = Math.max(...events.map((event) => (event.bar || 0) + (event.durationBars || 1)), 1);
  const totalDuration = totalBars * barDuration;
  const totalSamples = Math.ceil(sampleRate * totalDuration);
  const samples = new Float32Array(totalSamples);

  events.forEach((event) => {
    const startTime = barDuration * (event.bar || 0);
    const duration = barDuration * (event.durationBars || 1);
    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.min(totalSamples, Math.floor((startTime + duration) * sampleRate));
    const localSamples = endSample - startSample;
    const buffer = generateChordSamples({ mode, frequencies: event.frequencies, duration, sampleRate, mappingFactor });
    for (let i = 0; i < localSamples; i += 1) {
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

function renderToFile({ mode, frequencies, duration, mappingFactor, rhythmSpeed, events, bpm }) {
  ensureDir(config.renderOutputDir);
  const sampleRate = config.renderSampleRate;
  const effectiveMapping = rhythmSpeed ?? mappingFactor;
  let samples;
  if (Array.isArray(events) && events.length) {
    samples = generateSequenceSamples({ mode, events, bpm: bpm || 120, sampleRate, mappingFactor: effectiveMapping });
  } else {
    samples = generateChordSamples({ mode, frequencies, duration, sampleRate, mappingFactor: effectiveMapping });
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
  console.log('[playRealtime]', job);
  return { status: 'scheduled' };
}

module.exports = { renderToFile, playRealtime };
