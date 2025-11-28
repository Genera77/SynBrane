const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeTempScript(content) {
  const tempPath = path.join(os.tmpdir(), `synbrane-${Date.now()}-${Math.random().toString(36).slice(2)}.scd`);
  fs.writeFileSync(tempPath, content, 'utf8');
  return tempPath;
}

function runSclang(script) {
  return new Promise((resolve, reject) => {
    const scriptPath = writeTempScript(script);
    const child = spawn(config.superColliderSclangPath, [scriptPath]);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const cleanup = () => {
      try {
        fs.unlinkSync(scriptPath);
      } catch (err) {
        // ignore temp cleanup errors
      }
    };

    child.on('error', (error) => {
      cleanup();
      reject(error);
    });

    child.on('close', (code) => {
      cleanup();
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`sclang exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

function mapFrequenciesToRhythm(frequencies, mappingFactor) {
  return frequencies.map((freq) => Math.max(0.5, freq * mappingFactor));
}

function buildSynthDefBlock() {
  return `
SynthDef(\"synbrane_harmony\", { |freq = 440, amp = 0.2, sustain = 1|
  var env = EnvGen.kr(Env.linen(0.01, sustain, 0.05), doneAction: 2);
  var sig = SinOsc.ar(freq) * env * amp;
  Out.ar(0, sig);
}).add;

SynthDef(\"synbrane_rhythm\", { |freq = 440, rate = 2, amp = 0.25|
  var trig = Impulse.kr(rate.max(0.5));
  var env = Decay2.kr(trig, 0.001, 0.05);
  var sig = SinOsc.ar(freq * 0.5) * env * amp;
  Out.ar(0, sig);
}).add;
`;
}

function buildRealtimeScript({ mode, frequencies, duration, mappingFactor }) {
  const rates = mapFrequenciesToRhythm(frequencies, mappingFactor || 0.01);
  const synthBlock = buildSynthDefBlock();
  return `
(
var freqs = ${JSON.stringify(frequencies)};
var rates = ${JSON.stringify(rates)};
var duration = ${duration};
var mode = \"${mode}\";
s.options.numOutputBusChannels = 1;
${synthBlock}

s.waitForBoot {
  Routine({
    var synths;
    if (mode == \"harmony\") {
      synths = freqs.collect { |freq|
        Synth(\"synbrane_harmony\", [\"freq\", freq, \"amp\", 0.6 / (freqs.size.max(1))])
      };
    } {
      synths = freqs.collect { |freq, i|
        Synth(\"synbrane_rhythm\", [\"freq\", freq, \"rate\", rates[i], \"amp\", 0.45 / ((i + 1).asFloat)])
      };
    };
    duration.wait;
    synths.do(_.free);
    0.2.wait;
    s.quit;
    0.exit;
  }).play;
};
)
`;
}

function buildRenderScript({ mode, frequencies, duration, mappingFactor, outputFile, sampleRate }) {
  const rates = mapFrequenciesToRhythm(frequencies, mappingFactor || 0.01);
  const synthBlock = buildSynthDefBlock();
  return `
(
var freqs = ${JSON.stringify(frequencies)};
var rates = ${JSON.stringify(rates)};
var duration = ${duration};
var mode = \"${mode}\";
var outputPath = \"${outputFile.replace(/\\/g, '/')}\".standardizePath;
var sampleRate = ${sampleRate};

${synthBlock}

var messages = [
  [0.0, [\"d_recv\", SynthDescLib.global.at(\"synbrane_harmony\").def.asBytes]],
  [0.0, [\"d_recv\", SynthDescLib.global.at(\"synbrane_rhythm\").def.asBytes]]
];

var targetDef = { mode == \"harmony\" } { \"synbrane_harmony\" } { \"synbrane_rhythm\" };

freqs.do { |freq, i|
  var nodeId = 1000 + i;
  var args = if (mode == \"harmony\") {
    [\"freq\", freq, \"amp\", 0.6 / (freqs.size.max(1))]
  } {
    [\"freq\", freq, \"rate\", rates[i], \"amp\", 0.45 / ((i + 1).asFloat)]
  };
  messages = messages.add([0.0, [\"s_new\", targetDef, nodeId, 0, 0] ++ args]);
  messages = messages.add([duration, [\"n_free\", nodeId]]);
};

messages = messages.add([duration + 0.1, [\"c_set\", 0, 0]]);

Score.new(messages).recordNRT(
  outputPath,
  headerFormat: \"wav\",
  sampleFormat: \"int16\",
  sampleRate: sampleRate,
  options: ServerOptions.new.numOutputBusChannels_(1)
);
0.exit;
)
`;
}

async function playRealtime({ mode, frequencies, duration, mappingFactor }) {
  const script = buildRealtimeScript({ mode, frequencies, duration, mappingFactor });
  await runSclang(script);
  return { status: 'scheduled', transport: 'supercollider' };
}

async function renderToFile({ mode, frequencies, duration, mappingFactor }) {
  ensureDir(config.renderOutputDir);
  const filename = `render-${mode}-${Date.now()}.wav`;
  const filePath = path.join(config.renderOutputDir, filename);
  const script = buildRenderScript({
    mode,
    frequencies,
    duration,
    mappingFactor,
    outputFile: filePath,
    sampleRate: config.renderSampleRate,
  });
  await runSclang(script);
  return { filePath, filename };
}

module.exports = { playRealtime, renderToFile };
