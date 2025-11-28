# SynBrane project context

## Overview
SynBrane is an experimental music tool pairing a lightweight browser UI with a Node.js backend. The backend can either talk to SuperCollider for real audio playback/rendering or fall back to a built-in Node DSP stub when SuperCollider is unavailable. Users browse tunings and chords, audition them, and export WAV renders from the browser.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served by the backend.
  - Fetches tuning lists and chord suggestions from the API.
  - Lets users choose mode (harmony vs rhythm), duration, and a pitch→rate mapping factor.
  - Calls `/api/play` for audition and `/api/render` for offline rendering. The UI shape stays unchanged regardless of the audio backend.

- **Backend** (`server/`)
  - Minimal HTTP server exposing REST endpoints:
    - `GET /api/tunings` — returns available EDO counts and Scala scales discovered from `SCALES_DIR` plus the base frequency and default duration.
    - `GET /api/chords?tuningType=...&tuningValue=...` — generates chord options for the selected tuning.
    - `POST /api/play` — triggers playback through the active audio engine.
    - `POST /api/render` — renders harmony or rhythm audio to a WAV file and returns the file URL.
  - Serves static assets from `public/` and rendered files from `RENDER_OUTPUT_DIR`.
  - Tuning helpers live in `server/tuning/`.

- **Audio engines** (`server/audio/`)
  - `supercolliderClient.js` — writes small SuperCollider scripts and executes them via `sclang`. Provides `playRealtime` (fire-and-forget real-time play) and `renderToFile` (offline Score rendering to WAV) using simple SynthDefs for harmony and rhythm mapping.
  - `engine.js` — Node DSP fallback that synthesizes sine/click textures and encodes mono 16-bit PCM WAV files.
  - `index.js` — router that selects SuperCollider when `SUPER_COLLIDER_ENABLED=true`; otherwise uses the Node fallback. If SuperCollider execution fails, it automatically falls back to the Node path.

## Audio behavior
- **SuperCollider enabled**
  - `/api/play` launches a temporary `sclang` script that boots scsynth, loads the SynthDefs, starts the requested chord in harmony or rhythm mode, waits for the requested duration, then quits.
  - `/api/render` builds a short NRT Score with the same SynthDefs and renders directly to the target WAV under `RENDER_OUTPUT_DIR` using `recordNRT`.

- **SuperCollider disabled (default)**
  - `/api/play` logs the playback job (no audio output) using the Node stub.
  - `/api/render` renders a sine/click WAV file via the Node DSP and writes it under `RENDER_OUTPUT_DIR`.

## Environment variables
Only variables that the running code consumes are listed here.

| Name | Required? | Purpose | Default if missing |
| --- | --- | --- | --- |
| `PORT` | Optional | HTTP server port | `3000` |
| `HOST` | Optional | HTTP server host | `0.0.0.0` |
| `BASE_FREQUENCY` | Optional | Base pitch (Hz) for tuning calculations | `440` |
| `SCALES_DIR` | Optional | Directory containing Scala `.scl` files | `<repo>/scales` |
| `RENDER_OUTPUT_DIR` | Optional | Directory where rendered WAV files are written and served | `<repo>/renders` |
| `RENDER_SAMPLE_RATE` | Optional | Sample rate (Hz) for offline renders | `44100` |
| `SUPER_COLLIDER_ENABLED` | Optional | When `true`, use SuperCollider for play/render; otherwise use the Node DSP fallback | `false` |
| `SUPER_COLLIDER_SCLANG_PATH` | Optional | Path to the `sclang` executable used for SuperCollider scripts | `sclang` |

## Scripts
- `npm run dev` — Start the backend in development mode.
- `npm start` — Start the backend with default environment.

## TODOs and extension points
- Improve error reporting/health checks for the SuperCollider pathway.
- Expand chord-generation strategies and expose more interval-pattern presets.
- Add more Scala scales to `scales/` and surface descriptions in the UI.
- Provide richer UI feedback (waveform display, visual rhythm preview, progress indicators during render).
- Harden validation and error handling for API inputs.
