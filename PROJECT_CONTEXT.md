# SynBrane project context

## Overview
SynBrane is an experimental music tool that pairs a lightweight browser UI with a Node.js backend and a SuperCollider-friendly audio engine boundary. The current build focuses on:

- Selecting tunings (EDO or Scala) and browsing chords derived from those tunings.
- Auditioning chords either as pitched harmony or as rhythm patterns mapped from pitch data.
- Rendering audio to WAV files that can be downloaded from the browser.

The backend currently performs simple synthesized rendering in Node.js as a stand-in for a full SuperCollider bridge. The structure is intentionally modular so OSC/NRT integration can replace the stub easily.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served by the backend.
  - Fetches tuning lists and chord suggestions from the API.
  - Lets users choose mode (harmony vs rhythm), duration, and a pitch→rate mapping factor.
  - Calls `/api/play` for audition and `/api/render` for offline rendering. Browser-side Web Audio provides immediate preview, while the backend render produces downloadable WAVs.

- **Backend** (`server/`)
  - Minimal HTTP server (no external deps) exposing REST endpoints:
    - `GET /api/tunings` — returns available EDO counts and Scala scales discovered from `SCALES_DIR`.
    - `GET /api/chords?tuningType=...&tuningValue=...` — generates chord options for the selected tuning.
    - `POST /api/play` — logs/schedules a playback job (placeholder for SuperCollider real-time playback).
    - `POST /api/render` — renders harmony or rhythm audio to a WAV file and returns the file URL.
  - Serves static assets from `public/` and rendered files from `RENDER_OUTPUT_DIR`.
  - Tuning helpers live in `server/tuning/`, while rendering helpers live in `server/audio/`.

- **Audio engine placeholder** (`server/audio/engine.js`)
  - Generates simple sine-based harmony or click-based rhythm textures directly in Node.js.
  - Encodes mono 16-bit PCM WAV files and stores them under `RENDER_OUTPUT_DIR`.
  - `playRealtime` currently logs jobs; it is the seam where OSC messages to SuperCollider would be dispatched.

## Data flow
1. **Choose tuning/chord** — The UI fetches `/api/tunings`, selects an EDO or Scala scale, and then fetches `/api/chords` to display generated chord options. Selection updates a preview state.
2. **Hear it** — Pressing **Play** calls `/api/play` (for backend scheduling) and simultaneously triggers Web Audio preview so users can hear immediately.
3. **Export** — Pressing **Render & Export** posts to `/api/render`, which returns a WAV URL (served from `renders/`). The in-page audio element loads that file for audition and download.

## Environment variables
Located in `.env.example`:
- `PORT` / `HOST` — HTTP server bind values.
- `BASE_FREQUENCY` — Base pitch for tuning calculations (Hz).
- `SCALES_DIR` — Directory containing Scala `.scl` files.
- `RENDER_OUTPUT_DIR` — Where rendered WAV files are written and served from.
- `API_BASE_URL` — Optional override when reverse proxying the API.
- `SUPER_COLLIDER_HOST` / `SUPER_COLLIDER_PORT` / `SUPER_COLLIDER_SCLANG_PATH` — Connection details for a future SuperCollider bridge.
- `RENDER_SAMPLE_RATE` — Sample rate for offline renders (Hz).

## Scripts
- `npm run dev` — Start the backend in development mode.
- `npm start` — Start the backend with default environment.

## TODOs and extension points
- Replace `playRealtime` with actual OSC/NRT communication to SuperCollider (using `scsynth`/`sclang` or `supercolliderjs`).
- Expand chord-generation strategies and expose more interval-pattern presets.
- Add more Scala scales to `scales/` and surface descriptions in the UI.
- Provide richer UI feedback (waveform display, visual rhythm preview, progress indicators during render).
- Harden validation and error handling for API inputs.
