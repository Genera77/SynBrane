const fs = require('fs');
const path = require('path');
const config = require('../config');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mapFrequenciesToRhythm(frequencies, mappingFactor) {
  return frequencies.map((freq) => Math.max(0.5, freq * mappingFactor));
}

function generateSamples({ mode, frequencies, duration, sampleRate, mappingFactor }) {
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);
  if (mode === 'harmony') {
    const amplitude = 0.6 / Math.max(frequencies.length, 1);
    for (let i = 0; i < totalSamples; i += 1) {
      const t = i / sampleRate;
      let value = 0;
      frequencies.forEach((freq) => {
        value += Math.sin(2 * Math.PI * freq * t);
      });
      samples[i] = value * amplitude;
    }
  } else {
    const rates = mapFrequenciesToRhythm(frequencies, mappingFactor || 0.01);
    rates.forEach((rate, index) => {
      const clickSpacing = Math.max(1, sampleRate / rate);
      for (let sample = 0; sample < totalSamples; sample += 1) {
        const position = sample % Math.floor(clickSpacing);
        if (position === 0) {
          const amplitude = 0.4 / (index + 1);
          samples[sample] += amplitude;
          if (sample + 1 < totalSamples) samples[sample + 1] += amplitude * 0.6;
        }
      }
    });
  }
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

function renderToFile({ mode, frequencies, duration, mappingFactor }) {
  ensureDir(config.renderOutputDir);
  const sampleRate = config.renderSampleRate;
  const samples = generateSamples({ mode, frequencies, duration, sampleRate, mappingFactor });
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
