# SynBrane project context

## Overview
SynBrane is an experimental music tool pairing a lightweight browser UI with a Node.js backend. The backend can talk to SuperCollider for real audio playback/rendering or fall back to a built-in Node DSP engine when SuperCollider is unavailable. Users browse tunings, pick roots and chord patterns in the **Explore** palette, sequence a simple 4-bar loop, audition it, and export WAV renders from the browser.

Harmony mode now uses a synth-style voice: selectable waveforms (sine, saw, square), an ADSR envelope (attack/decay/sustain/release), and an optional low-pass filter with resonance. Rhythm mode now fires overtone-rich drum voices (fundamental + partials, optional noise, gentle saturation). All synth controls are exposed in the UI and forwarded to the backend for previews and renders.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served by the backend.
  - Fetches tunings and per-tuning chord lists (with roots) from the API.
  - **Explore palette:** tuning selection, root selection (12-TET note names for 12-EDO, numeric degrees otherwise), and chord browsing. Selecting a bar in the 4-bar sequencer highlights the destination; the Explore palette can assign the current tuning/root/chord to that bar via the “Use for Bar X” control.
  - **Sequencer:** 4-bar grid where each bar can use its own tuning/root/chord; click a bar to mark it as the destination for Explore assignments.
  - Global controls: mode (harmony vs rhythm), tempo (BPM), rhythm-speed mapping slider, and synth controls (waveform, ADSR envelope, low-pass cutoff/resonance).
  - Calls `/api/play` to audition a single chord or the 4-bar loop and `/api/render` to render to WAV. A Web Audio preview mirrors the synth/rhythm design locally. Loop previews repeat until stopped or until 10 passes are reached.

- **Backend** (`server/`)
  - Minimal HTTP server exposing REST endpoints:
    - `GET /api/tunings` — returns available tunings (EDO presets + Scala discoveries) with ids, type, value, label, description, intervals (for Scala), and base frequency metadata.
    - `GET /api/chords?tuningId=...` — returns chord options and root labels for the selected tuning. Legacy `tuningType`/`tuningValue` query params still work.
    - `POST /api/play` — triggers playback (single chord or a 4-bar sequence) through the active audio engine, carrying synth settings when provided.
    - `POST /api/render` — renders a single chord or a 4-bar sequence to WAV with the requested synth/rhythm settings and returns the file URL.
  - Serves static assets from `public/` and rendered files from `RENDER_OUTPUT_DIR`.
  - Tuning helpers live in `server/tuning/`.

- **Audio engines** (`server/audio/`)
  - `supercolliderClient.js` — writes small SuperCollider scripts and executes them via `sclang`. Provides `playRealtime` and `renderToFile` using SynthDefs for harmony and overtone-rich rhythm mapping.
  - `engine.js` — Node DSP fallback that synthesizes harmony voices with selectable waveforms, ADSR envelopes, and an optional resonant low-pass filter. Rhythm voices render drum-like hits with fundamentals, overtones, noise, and light saturation. It supports single-chord renders and multi-event 4-bar sequences, respecting BPM, rhythm-speed mapping, and synth parameters.
  - `index.js` — router that selects SuperCollider when `SUPER_COLLIDER_ENABLED=true`; otherwise uses the Node fallback. If SuperCollider execution fails, it automatically falls back to the Node path.

## Audio behavior
- **Harmony mode (Node DSP)**
  - Oscillator waveforms: sine, saw, or square.
  - Envelope: attack/decay/sustain/release in milliseconds. Release time extends rendered duration so tails are preserved.
  - Optional resonant low-pass filter with adjustable cutoff and resonance to tame or brighten harmonics.
  - Loudness normalized around -4 dBFS so preview loudness and rendered WAVs align.
- **Rhythm mode (Node DSP)**
  - Drum-like hits with a low fundamental, multiple overtone partials, optional noise for attack, and soft saturation. Uses pitch→rate mapping via the rhythm-speed slider.
- **Browser preview** mirrors these designs: ADSR/filter for harmony, overtone-rich drum clicks for rhythm, so local audition matches renders.

## Tuning and chord presets
- **12-EDO (chromatic)** — extended library including majors/minors, diminished/augmented, sus2/sus4, sixth/add9, dominant/major/minor/half-diminished 7ths, dominant/major 9/11/13 stacks, altered dominants (b9/#9/b5/#5), quartal/quintal shapes, and curated clusters.
- **19-EDO** — degree roots across two octaves with major-like/minor-like triads, dominant-like sevenths, stacked-fourth voicings, tight clusters, wide spreads, and woven micro-steps.
- **24-EDO (quarter-tone)** — neutral/major-like/minor-like triads, dominant-like sevenths, stacked-fourth sus colors, tight quarter-tone clusters, wide spreads, and extended shimmer voicings.
- **32-EDO** — dense microtonal sets with major/minor-like triads, dominant-like sevenths, stacked fourth-ish/fifth-ish shapes, tight clusters, woven small-step colors, and wide spreads.
- **Scala imports** — supported; each Scala scale auto-derives triads and 7ths from every degree (patterns 1-3-5 and 1-3-5-7) with degree-aware labels.

## API request shapes
- `GET /api/tunings`
  - Response: `{ tunings: [{ id, type, value, label, description?, intervals?, count? }], baseFrequency, defaultDuration }`
- `GET /api/chords?tuningId=<id>`
  - Response: `{ chords: [{ id, label, degrees, name }], roots: [{ value, label }] }`
- `POST /api/play` / `POST /api/render`
  - Single chord payload: `{ tuningId, chord, root, mode, bpm, rhythmSpeed, synthSettings, loopCount? }`
  - 4-bar sequence payload: `{ mode, bpm, rhythmSpeed, synthSettings, loopCount?, sequence: [{ bar, durationBars, tuningId, chord, root }] }`
  - Both endpoints accept `tuningType`/`tuningValue` for backwards compatibility.
  - `synthSettings` shape: `{ waveform, envelope: { attackMs, decayMs, sustainLevel, releaseMs }, filter: { cutoffHz, resonance } }` (all optional; defaults applied server-side).

## UI controls
- Explore palette for tuning/root/chord selection; assign the selected chord to the highlighted bar via “Use for Bar X.”
- Sequencer shows four bars; click any bar to select it for assignment. Mix tunings freely per bar.
- Global controls: tempo, harmony vs rhythm mode, rhythm-speed mapping.
- Synth controls (harmony): waveform, attack, decay, sustain level, release, low-pass cutoff, resonance.
- Preview/render actions for a single chord or the full 4-bar loop. Loop playback repeats until you press Stop or until 10 passes have played.

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
