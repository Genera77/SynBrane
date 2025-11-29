# SynBrane project context

## Overview
SynBrane is an experimental music tool pairing a lightweight browser UI with a Node.js backend. The browser now focuses on a streamlined two-panel layout: a **Chords** box for editing up to five loop chords (one at a time) using a circular note selector, and a **Synth Parameters** box for global playback controls and patch management. Chord edits are sent to the backend/audio engine for live playback or WAV renders. The top of the page carries a cyberpunk-style ASCII "SynBrane" banner above the subtitle.
The header includes a simple link to a dedicated About page (`/about.html`) with centered copy that walks through how SynBrane works across harmony and rhythm modes, looping, patching, and supported tunings.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served statically (locally by the Node server or by Vercel in production).
  - Chords panel: up to five chord tabs, with the visible count controlled by a "Chords in loop" selector. Each chord stores its own tuning, root, notes, preset, and arpeggiator settings on a concentric circular picker that shows octave rings from -1 to +1 for the current temperament rather than any circle-of-fifths ordering. The picker uses compact degree labels with a ° symbol (e.g., `7°`), spacing tuned for dense temperaments like 31-EDO, and temperament-specific color themes with subdued inactive bubbles and high-contrast highlighted selections. Preset chords (major, minor, dominant 7, suspended, add9/add11/add13, etc.) remap their target intervals to the currently selected temperament, and users can still toggle any point afterward. Root selectors track degree names per temperament. Interval and frequency readouts explain the chosen notes (cents/steps from root, Hz). Each chord exposes an arpeggiator toggle, pattern (up/down/up-down/random), musical rate (1/4–1/16 with triplet eighths), and a preview loop toggle.
  - Synth Parameters panel: compact controls for mode (Harmony/Rhythm), tempo, rhythm multiplier, waveform, ADSR, filter settings, loop chord count, and loop playback/render buttons. The rhythm slider now ranges from roughly 0.1–1.0× (default ~0.3×) for subtle timing shifts instead of fast multipliers. A gentle detune control smooths polyphonic previews for dense temperaments.
  - Patch system: Save downloads a JSON file carrying global mode/tempo/rhythm/synth/preview plus per-chord tuning, root, preset id, notes, arpeggiator settings, and the loop chord count. Load applies a JSON patch and updates the UI; rhythm multipliers are clamped to the current slider range when loading.
  - Loop playback/render: builds a loop-length-limited (1–5 chords) sequence (one bar per visible chord) with explicit tuning ids, degree lists, arpeggiator settings, and derived frequencies and sends it to `/api/render`. Chord and loop preview buttons trigger immediate Web Audio playback in the browser using the active synth/filter/envelope settings. Loop preview repeats the chord set 10 times unless stopped, and renders request the backend to apply the same 10-loop sequence.

- **Backend** (`server/`)
  - Minimal HTTP server exposing REST endpoints:
    - `GET /api/tunings` — returns available tunings (EDO presets + Scala discoveries) with ids, type, value, label, description, intervals, and base frequency metadata.
    - `GET /api/chords?tuningId=...` — returns chord options and root labels for the selected tuning. Legacy `tuningType`/`tuningValue` query params still work.
    - `POST /api/play` — triggers playback (single chord or a sequence) through the active audio engine, carrying synth settings when provided.
    - `POST /api/render` — renders a single chord or a multi-bar sequence to WAV with the requested synth/rhythm settings and returns the file URL.
  - Serves static assets from `public/` and rendered files from `RENDER_OUTPUT_DIR`.
  - Tuning helpers live in `server/tuning/`.

- **Audio engines** (`server/audio/`)
  - `supercolliderClient.js` — writes small SuperCollider scripts and executes them via `sclang`. Provides `playRealtime` and `renderToFile` using SynthDefs for harmony and overtone-rich rhythm mapping.
  - `engine.js` — Node DSP fallback synthesizing harmony voices with selectable waveforms, ADSR envelopes, optional resonant low-pass filter, and arpeggiated rendering based on per-event pattern/rate fields. Rhythm voices lock a four-on-the-floor kick with snares on beats 2 and 4, add steady hats, and map chord notes onto toms/claps/percussion on 4–16 step grids. Supports single-chord renders and multi-event sequences.
  - `index.js` — selects SuperCollider when `SUPER_COLLIDER_ENABLED=true`; otherwise uses the Node path and falls back automatically on errors.

## Audio behavior
- **Harmony mode (Node DSP)**: oscillator waveforms (sine/saw/square), ADSR envelope, optional resonant low-pass filter, and loudness normalized around -4 dBFS. Arpeggio patterns are active and honor per-chord arpeggiator settings (enabled/pattern/rate) from the UI.
- **Rhythm mode (Node DSP)**: drum kit voices with overtone partials and saturation. A kick + snare backbone anchors beats 1/3 and 2/4, hats ride across 4–16 step grids, and chord tones map onto toms/claps/extra percussion with density shaped by the rhythm-speed slider (0.1–1.0×).
- **Browser preview** mirrors these designs using in-browser Web Audio for chord/loop previews without relying on backend playback. The preview path supports per-chord arpeggiated or looped chords with per-note detune for smoother stacks.

## Deployment model
- Backend (Node + audio engine) runs on a DigitalOcean droplet at `http://147.182.251.148:3000`.
- Frontend is hosted on Vercel at `https://syn-brane.vercel.app`.
- Vercel exposes API proxy routes (`/api/tunings`, `/api/chords`, `/api/play`, `/api/render`) that forward requests to the droplet (`http://147.182.251.148:3000/api/...`) and return the responses to the browser.
- The browser only calls these relative APIs via `apiUrl('/api/...')`, so all requests stay on the Vercel origin and avoid mixed-content issues while the server-to-server hop uses HTTP.
- `/api/render` now rewrites any returned `file` path to point to `/api/render-file?path=...`, and `/api/render-file` streams the actual WAV from the droplet (e.g., `http://147.182.251.148:3000/renders/...`) back to the browser over HTTPS. No droplet changes or TLS termination are required.

## Temperaments
- EDO tunings include 12, 19, 22, 24, 31 (plus 8-EDO) with temperament-specific chord presets sourced from the backend; Scala tunings come from the `scales` directory. Interval mapping in the UI uses cents approximations to highlight equivalent functions across temperaments and redraws the circle with the proper number of divisions. Each temperament paints the spiral with its own color theme, and the UI no longer exposes 32-EDO.

## UI controls
- Chords panel: configurable tab count (1–5) based on the loop length selector, active chord label, per-chord tuning select, root selector, chord preset dropdown (major/minor/dim/aug/sus/add chords), per-chord arpeggiator (enable/pattern/rate), loop toggle, circular note selector with toggleable degrees, interval/frequency readouts, Clear/Play buttons.
- Synth Parameters: mode (harmony/rhythm), tempo (30–300 BPM), rhythm multiplier (~0.1–1.0), waveform, attack/decay/sustain/release, detune, cutoff/resonance, loop length selector, loop playback/render buttons, and patch Save/Load.
- Patch JSON shape (v1):
```
{
  "version": 1,
  "loopChordCount": 4,
  "global": {
      "mode": "harmony",
      "tempo": 120,
      "rhythmMultiplier": 0.3,
    "synth": { "waveform": "saw", "envelope": { ... }, "filter": { ... }, "detuneCents": 3 },
    "preview": { "arpeggiate": false, "arpRateMs": 180, "loop": false }
  },
  "chords": [
    { "tuningId": "edo:12", "root": 0, "preset": "major", "notes": [0,4,7], "arp": {"enabled": false, "pattern": "up", "rate": "1/8"} },
    { ... }
  ]
}
```
- Loop playback uses the chord circles as the single source of truth; no explore palette or bar-level editors remain.

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
