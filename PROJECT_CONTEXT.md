# SynBrane project context

## Overview
SynBrane is an experimental music tool pairing a lightweight browser UI with a Node.js backend. The backend can talk to SuperCollider for real audio playback/rendering or fall back to a built-in Node DSP engine when SuperCollider is unavailable. Users browse tunings, pick roots and chord patterns, sequence a simple 4-bar loop, audition it, and export WAV renders from the browser.

Harmony mode now uses a synth-style voice: selectable waveforms (sine, saw, square), an ADSR envelope (attack/decay/sustain/release), and an optional low-pass filter with resonance. Rhythm mode keeps its bright, percussive noise-and-thump design tuned for Ableton’s drum analysis. All synth controls are exposed in the UI and forwarded to the backend for previews and renders.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served by the backend.
  - Fetches tunings and per-tuning chord lists (with roots) from the API.
  - Presents tuning selection, root selection (12-TET note names for 12-EDO, numeric degrees otherwise), chord picking, and a 4-bar sequencer where each bar can use its own tuning/root/chord.
  - Global controls: mode (harmony vs rhythm), tempo (BPM), rhythm-speed mapping slider, and synth controls (waveform, ADSR envelope, low-pass cutoff/resonance).
  - Calls `/api/play` to audition a single chord or the 4-bar loop and `/api/render` to render to WAV. A Web Audio preview mirrors the synth/rhythm design locally.

- **Backend** (`server/`)
  - Minimal HTTP server exposing REST endpoints:
    - `GET /api/tunings` — returns available tunings (EDO presets + Scala discoveries) with ids, type, value, label, description, intervals (for Scala), and base frequency metadata.
    - `GET /api/chords?tuningId=...` — returns chord options and root labels for the selected tuning. Legacy `tuningType`/`tuningValue` query params still work.
    - `POST /api/play` — triggers playback (single chord or a 4-bar sequence) through the active audio engine, carrying synth settings when provided.
    - `POST /api/render` — renders a single chord or a 4-bar sequence to WAV with the requested synth/rhythm settings and returns the file URL.
  - Serves static assets from `public/` and rendered files from `RENDER_OUTPUT_DIR`.
  - Tuning helpers live in `server/tuning/`.

- **Audio engines** (`server/audio/`)
  - `supercolliderClient.js` — writes small SuperCollider scripts and executes them via `sclang`. Provides `playRealtime` and `renderToFile` using simple SynthDefs for harmony and rhythm mapping.
  - `engine.js` — Node DSP fallback that synthesizes harmony voices with selectable waveforms, ADSR envelopes, and an optional resonant low-pass filter. Rhythm voices remain noise/tone bursts. It supports single-chord renders and multi-event 4-bar sequences, respecting BPM, rhythm-speed mapping, and synth parameters.
  - `index.js` — router that selects SuperCollider when `SUPER_COLLIDER_ENABLED=true`; otherwise uses the Node fallback. If SuperCollider execution fails, it automatically falls back to the Node path.

## Audio behavior
- **Harmony mode (Node DSP)**
  - Oscillator waveforms: sine, saw, or square.
  - Envelope: attack/decay/sustain/release in milliseconds. Release time extends rendered duration so tails are preserved.
  - Optional resonant low-pass filter with adjustable cutoff and resonance to tame or brighten harmonics.
  - Loudness normalized around -4 dBFS so preview loudness and rendered WAVs align.
- **Rhythm mode (Node DSP)**
  - Noise bursts (with optional low sine thump on the first voice), fast attack (~0.5 ms), short decay (25–80 ms), and a bright high-pass tilt for Ableton-friendly transients. Uses pitch→rate mapping via the rhythm-speed slider.
- **Browser preview** mirrors these designs: ADSR/filter for harmony, noise/tone clicks for rhythm, so local audition matches renders.

## Tuning and chord presets
- **12-EDO (chromatic)** — all 12 roots with majors, minors, diminished, augmented, sus2/sus4, add9, sixth, dominant 7, major 7, minor 7, and half-diminished 7 patterns.
- **19-EDO** — degree roots across two octaves with 4:5:6-like triads, minor-like triads, dominant-like sevenths, and wider/narrower color chords.
- **24-EDO (quarter-tone)** — two-octave degree roots with neutral/bright/soft triads, tight quarter-tone clusters, stacked-fourth sus colors, and extended upper voices.
- **32-EDO** — dense microtonal sets using 2/3/5/7-step patterns, stacked fifth-ish shapes, tight clusters, and wide spreads.
- **Scala imports** — still supported; chords are auto-derived from scale degrees when a Scala tuning is selected.

## API request shapes
- `GET /api/tunings`
  - Response: `{ tunings: [{ id, type, value, label, description?, intervals?, count? }], baseFrequency, defaultDuration }`
- `GET /api/chords?tuningId=<id>`
  - Response: `{ chords: [{ id, label, degrees, name }], roots: [{ value, label }] }`
- `POST /api/play` / `POST /api/render`
  - Single chord payload: `{ tuningId, chord, root, mode, bpm, rhythmSpeed, synthSettings }`
  - 4-bar sequence payload: `{ mode, bpm, rhythmSpeed, synthSettings, sequence: [{ bar, durationBars, tuningId, chord, root }] }`
  - Both endpoints accept `tuningType`/`tuningValue` for backwards compatibility.
  - `synthSettings` shape: `{ waveform, envelope: { attackMs, decayMs, sustainLevel, releaseMs }, filter: { cutoffHz, resonance } }` (all optional; defaults applied server-side).

## UI controls
- Tuning selection per bar (mix tunings freely), root selection (note names for 12-EDO, degrees otherwise), and chord selection from the curated sets above.
- Global controls: tempo, harmony vs rhythm mode, rhythm-speed mapping.
- Synth controls (harmony): waveform, attack, decay, sustain level, release, low-pass cutoff, resonance.
- Preview/render actions for a single chord or the full 4-bar loop.

## Configuration
- Local use requires no environment variables; all defaults are hard-coded for development and adjustable via the UI.
- Optional environment variables remain supported for overrides:
  - `PORT` (default `3000`)
  - `HOST` (default `0.0.0.0`)
  - `BASE_FREQUENCY` (default `440`)
  - `SCALES_DIR` (default `<repo>/scales`)
  - `RENDER_OUTPUT_DIR` (default `<repo>/renders`)
  - `RENDER_SAMPLE_RATE` (default `44100`)
  - `SUPER_COLLIDER_ENABLED` (default `false`)
  - `SUPER_COLLIDER_SCLANG_PATH` (default `sclang`)

## Scripts
- `npm run dev` — Start the backend in development mode.
- `npm start` — Start the backend with default environment.

## TODOs and extension points
- Improve error reporting/health checks for the SuperCollider pathway.
- Expand Scala chord-generation strategies and add more Scala scales.
- Provide richer UI feedback (waveform display, visual rhythm preview, progress indicators during render).
- Harden validation and error handling for API inputs.
