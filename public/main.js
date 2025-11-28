const chordList = document.getElementById('chordList');
const tuningTypeSelect = document.getElementById('tuningType');
const edoStepsInput = document.getElementById('edoSteps');
const scalaSelect = document.getElementById('scalaSelect');
const scalaLabel = document.getElementById('scalaLabel');
const edoLabel = document.getElementById('edoStepsLabel');
const modeSelect = document.getElementById('modeSelect');
const durationInput = document.getElementById('duration');
const mappingFactorInput = document.getElementById('mappingFactor');
const statusEl = document.getElementById('status');
const tuningMeta = document.getElementById('tuningMeta');
const player = document.getElementById('player');

let tunings = { edos: [], scala: [] };
let selectedChord = null;

async function fetchTunings() {
  const res = await fetch('/api/tunings');
  const data = await res.json();
  tunings = data;
  tuningMeta.textContent = `Base frequency: ${data.baseFrequency} Hz`;
  populateScalaSelect(data.scala || []);
  loadChords();
}

function populateScalaSelect(scala) {
  scalaSelect.innerHTML = '';
  scala.forEach((scale) => {
    const option = document.createElement('option');
    option.value = scale.name;
    option.textContent = `${scale.name} (${scale.count})`;
    scalaSelect.appendChild(option);
  });
}

async function loadChords() {
  const tuningType = tuningTypeSelect.value;
  const tuningValue = tuningType === 'edo' ? edoStepsInput.value : scalaSelect.value;
  const query = new URLSearchParams({ tuningType, tuningValue });
  const res = await fetch(`/api/chords?${query.toString()}`);
  const data = await res.json();
  renderChords(data.chords || []);
}

function renderChords(chords) {
  chordList.innerHTML = '';
  selectedChord = null;
  chords.forEach((chord) => {
    const item = document.createElement('div');
    item.className = 'chord-item';
    item.textContent = `${chord.name} — degrees ${chord.degrees.join(', ')}`;
    item.onclick = () => {
      selectedChord = chord;
      document.querySelectorAll('.chord-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      statusEl.textContent = `Selected ${chord.name}`;
    };
    chordList.appendChild(item);
  });
  if (chords.length && !selectedChord) {
    chordList.firstChild.click();
  }
}

async function play() {
  if (!selectedChord) {
    statusEl.textContent = 'Pick a chord first.';
    return;
  }
  const payload = buildPayload();
  statusEl.textContent = 'Scheduling playback…';
  await fetch('/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  statusEl.textContent = 'Playback scheduled via backend. Playing locally for preview…';
  playInBrowser(payload);
}

async function renderExport() {
  if (!selectedChord) {
    statusEl.textContent = 'Pick a chord first.';
    return;
  }
  const payload = buildPayload();
  statusEl.textContent = 'Rendering…';
  const res = await fetch('/api/render', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (data.file) {
    player.classList.remove('hidden');
    player.src = data.file;
    player.load();
    statusEl.textContent = 'Rendered! Use the player controls to download or audition.';
  } else {
    statusEl.textContent = 'Render failed.';
  }
}

function buildPayload() {
  return {
    tuningType: tuningTypeSelect.value,
    tuningValue: tuningTypeSelect.value === 'edo' ? parseInt(edoStepsInput.value, 10) : scalaSelect.value,
    chord: selectedChord,
    mode: modeSelect.value,
    duration: parseFloat(durationInput.value),
    mappingFactor: parseFloat(mappingFactorInput.value),
  };
}

function playInBrowser(payload) {
  const ctx = new AudioContext();
  const now = ctx.currentTime;
  const voices = payload.chord.degrees.length;
  const amp = 0.4 / voices;
  payload.chord.degrees.forEach((degree, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = degreeToFrequency(payload, degree);
    osc.frequency.value = freq;
    if (payload.mode === 'rhythm') {
      const rate = Math.max(0.5, freq * payload.mappingFactor);
      const interval = 1 / rate;
      for (let t = 0; t < payload.duration; t += interval) {
        const clickGain = ctx.createGain();
        clickGain.gain.setValueAtTime(amp / (index + 1), now + t);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.1);
        const clickOsc = ctx.createOscillator();
        clickOsc.frequency.value = 120 + index * 10;
        clickOsc.connect(clickGain).connect(ctx.destination);
        clickOsc.start(now + t);
        clickOsc.stop(now + t + 0.1);
      }
    } else {
      osc.type = 'sine';
      osc.start(now);
      osc.stop(now + payload.duration);
      gain.gain.setValueAtTime(amp, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + payload.duration);
      osc.connect(gain).connect(ctx.destination);
    }
  });
}

function degreeToFrequency(payload, degree) {
  if (payload.tuningType === 'edo') {
    return tunings.baseFrequency * 2 ** (degree / payload.tuningValue);
  }
  const scale = tunings.scala.find((s) => s.name === payload.tuningValue);
  if (!scale) return tunings.baseFrequency;
  const index = degree % scale.count;
  const octaves = Math.floor(degree / scale.count);
  const cents = scale.intervals ? scale.intervals[index] : 1200 * (index / scale.count);
  return tunings.baseFrequency * 2 ** octaves * 2 ** (cents / 1200);
}

function toggleTuningInputs() {
  const useEdo = tuningTypeSelect.value === 'edo';
  edoLabel.classList.toggle('hidden', !useEdo);
  scalaLabel.classList.toggle('hidden', useEdo);
  loadChords();
}

function init() {
  fetchTunings();
  tuningTypeSelect.onchange = toggleTuningInputs;
  edoStepsInput.onchange = loadChords;
  scalaSelect.onchange = loadChords;
  document.getElementById('playBtn').onclick = play;
  document.getElementById('renderBtn').onclick = renderExport;
}

window.addEventListener('DOMContentLoaded', init);
