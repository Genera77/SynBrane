# SynBrane project context

## Overview
SynBrane is an experimental music tool pairing a lightweight browser UI with a Node.js backend. The backend can talk to SuperCollider for real audio playback/rendering or fall back to a built-in Node DSP stub when SuperCollider is unavailable. Users browse tunings, pick roots and chords, sequence a simple 4-bar loop, audition it, and export WAV renders from the browser.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served by the backend.
  - Fetches tunings and per-tuning chord lists (with roots) from the API.
  - Presents tuning selection, root selection (12-TET note names for 12-EDO, numeric degrees otherwise), chord picking, and a 4-bar sequencer where each bar can use its own tuning/root/chord.
  - Global controls: mode (harmony vs rhythm), tempo (BPM), and a rhythm-speed mapping slider that drives low-frequency beat rates.
  - Calls `/api/play` to audition a single chord or the 4-bar loop and `/api/render` to render to WAV. A small Web Audio preview mirrors the request locally.

- **Backend** (`server/`)
  - Minimal HTTP server exposing REST endpoints:
    - `GET /api/tunings` — returns available tunings (EDO presets + Scala discoveries) with ids, type, value, label, intervals (for Scala), and base frequency metadata.
    - `GET /api/chords?tuningId=...` — returns chord options and root labels for the selected tuning. Legacy `tuningType`/`tuningValue` query params still work.
    - `POST /api/play` — triggers playback (single chord or a 4-bar sequence) through the active audio engine.
    - `POST /api/render` — renders a single chord or a 4-bar sequence to WAV and returns the file URL.
  - Serves static assets from `public/` and rendered files from `RENDER_OUTPUT_DIR`.
  - Tuning helpers live in `server/tuning/`.

- **Audio engines** (`server/audio/`)
  - `supercolliderClient.js` — writes small SuperCollider scripts and executes them via `sclang`. Provides `playRealtime` and `renderToFile` using simple SynthDefs for harmony and rhythm mapping.
  - `engine.js` — Node DSP fallback that synthesizes sine/click textures and encodes mono 16-bit PCM WAV files. It now supports single-chord renders and multi-event 4-bar sequences, respecting BPM and rhythm-speed mapping.
  - `index.js` — router that selects SuperCollider when `SUPER_COLLIDER_ENABLED=true`; otherwise uses the Node fallback. If SuperCollider execution fails, it automatically falls back to the Node path.

## Audio behavior
- **SuperCollider enabled**
  - `/api/play` would launch a temporary `sclang` script for harmony or rhythm playback (still optional; fallback used otherwise).
  - `/api/render` builds a short NRT Score and renders to WAV using `recordNRT`.

- **SuperCollider disabled (default)**
  - `/api/play` logs the playback job (no audio output) using the Node stub.
  - `/api/render` renders sine (harmony) or click-based (rhythm) WAV files via the Node DSP, writing them under `RENDER_OUTPUT_DIR`.

## API request shapes
- `GET /api/tunings`
  - Response: `{ tunings: [{ id, type, value, label, intervals?, description?, count? }], baseFrequency, defaultDuration }`
- `GET /api/chords?tuningId=<id>`
  - Response: `{ chords: [{ id, label, degrees, name }], roots: [{ value, label }] }`
- `POST /api/play` / `POST /api/render`
  - Single chord payload: `{ tuningId, chord, root, mode, bpm, rhythmSpeed }`
  - 4-bar sequence payload: `{ mode, bpm, rhythmSpeed, sequence: [{ bar, durationBars, tuningId, chord, root }] }`
  - Both endpoints accept `tuningType`/`tuningValue` for backwards compatibility.

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
- Expand chord-generation strategies, including richer Scala-derived voicings and custom presets.
- Add more Scala scales to `scales/` and surface descriptions in the UI.
- Provide richer UI feedback (waveform display, visual rhythm preview, progress indicators during render).
- Harden validation and error handling for API inputs.
