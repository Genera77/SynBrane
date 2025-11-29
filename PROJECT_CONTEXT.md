# SynBrane project context

## Overview
SynBrane is an experimental music tool pairing a lightweight browser UI with a Node.js backend. The browser now focuses on a streamlined two-panel layout: a **Chords** box for editing four loop chords (one at a time) using a circular note selector, and a **Synth Parameters** box for global playback controls and patch management. Chord edits are sent to the backend/audio engine for live playback or WAV renders. The top of the page carries a cyberpunk-style ASCII "SynBrane" banner above the subtitle.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served statically (locally by the Node server or by Vercel in production).
  - Chords panel: four chord slots navigated via tabs. Each chord stores its own tuning and a set of active degrees selected on a circular picker (12 labeled note names for 12-EDO; numeric degree labels for other EDO/Scala tunings). Only one chord editor is visible at a time.
  - Synth Parameters panel: compact controls for mode (Harmony/Rhythm), tempo, rhythm multiplier, waveform, ADSR, and filter settings, plus loop playback/render buttons. The rhythm slider now ranges from roughly 0.1–1.0× (default ~0.3×) for subtle timing shifts instead of fast multipliers.
  - Patch system: Save downloads a JSON file carrying global mode/tempo/rhythm/synth plus per-chord tuning and selected degrees. Load applies a JSON patch and updates the UI; rhythm multipliers are clamped to the current slider range when loading.
  - Loop playback/render: builds a four-event sequence (one per chord) with explicit tuning ids, degree lists, and derived frequencies and sends it to `/api/play` or `/api/render`. Chord and loop preview buttons now trigger immediate Web Audio playback in the browser using the active synth/filter/envelope settings (while still sending `/api/play` in the background for parity).

- **Backend** (`server/`)
  - Minimal HTTP server exposing REST endpoints:
    - `GET /api/tunings` — returns available tunings (EDO presets + Scala discoveries) with ids, type, value, label, description, intervals, and base frequency metadata.
    - `GET /api/chords?tuningId=...` — returns chord options and root labels for the selected tuning. Legacy `tuningType`/`tuningValue` query params still work.
    - `POST /api/play` — triggers playback (single chord or a 4-bar sequence) through the active audio engine, carrying synth settings when provided.
    - `POST /api/render` — renders a single chord or a 4-bar sequence to WAV with the requested synth/rhythm settings and returns the file URL.
  - Serves static assets from `public/` and rendered files from `RENDER_OUTPUT_DIR`.
  - Tuning helpers live in `server/tuning/`.

- **Audio engines** (`server/audio/`)
  - `supercolliderClient.js` — writes small SuperCollider scripts and executes them via `sclang`. Provides `playRealtime` and `renderToFile` using SynthDefs for harmony and overtone-rich rhythm mapping.
  - `engine.js` — Node DSP fallback synthesizing harmony voices with selectable waveforms, ADSR envelopes, and an optional resonant low-pass filter. Rhythm voices layer a four-on-the-floor kick plus snares on beats 2 and 4, and map chord notes onto drum voices. Supports single-chord renders and multi-event sequences.
  - `index.js` — selects SuperCollider when `SUPER_COLLIDER_ENABLED=true`; otherwise uses the Node path and falls back automatically on errors.

## Audio behavior
- **Harmony mode (Node DSP)**: oscillator waveforms (sine/saw/square), ADSR envelope, optional resonant low-pass filter, and loudness normalized around -4 dBFS. Arpeggio patterns are present in the backend but the current UI sends stacked chord events.
  - **Rhythm mode (Node DSP)**: drum-like hits with overtone partials and saturation. Rhythm-speed slider now spans roughly 0.1–1.0× to slow or subtly accelerate patterns.
- **Browser preview** mirrors these designs using in-browser Web Audio for chord/loop previews while still calling backend play endpoints for parity.

## Deployment model
- Backend (Node + audio engine) runs on a DigitalOcean droplet at `http://147.182.251.148:3000`.
- Frontend is hosted on Vercel at `https://syn-brane.vercel.app`.
- Vercel exposes API proxy routes (`/api/tunings`, `/api/chords`, `/api/play`, `/api/render`) that forward requests to the droplet (`http://147.182.251.148:3000/api/...`) and return the responses to the browser.
- The browser only calls these relative APIs via `apiUrl('/api/...')`, so all requests stay on the Vercel origin and avoid mixed-content issues while the server-to-server hop uses HTTP.
- `/api/render` now rewrites any returned `file` path to point to `/api/render-file?path=...`, and `/api/render-file` streams the actual WAV from the droplet (e.g., `http://147.182.251.148:3000/renders/...`) back to the browser over HTTPS. No droplet changes or TLS termination are required.

## UI controls
- Chords panel: four tabs labeled 1–4, active chord label, per-chord tuning select, circular note selector with toggleable degrees, Clear/Play buttons.
- Synth Parameters: mode (harmony/rhythm), tempo (30–300 BPM), rhythm multiplier (~0.1–1.0), waveform, attack/decay/sustain/release, cutoff/resonance, loop playback/render buttons, and patch Save/Load.
- Patch JSON shape (v1):
```
{
  "version": 1,
  "global": {
      "mode": "harmony",
      "tempo": 120,
      "rhythmMultiplier": 0.3,
    "synth": { "waveform": "saw", "envelope": { ... }, "filter": { ... } }
  },
  "chords": [
    { "tuningId": "edo:12", "notes": [0,4,7], "arp": {"enabled": false, "pattern": "up", "rate": "1/8"} },
    { ... },
    { ... },
    { ... }
  ]
}
```
- Loop playback uses the four chord circles as the single source of truth; no explore palette or bar-level editors remain.

## Configuration
- Local use requires no environment variables; all defaults are hard-coded for development and adjustable via the UI.
- Frontend API base: all browser fetches go through a global `API_BASE` constant defined in `public/main.js`, which defaults to an empty string so requests use the same-origin Vercel proxy routes. A `window.SYNBRANE_API_BASE` override is available for local development if you need to target a different backend directly.
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
