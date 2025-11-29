# SynBrane project context

## Overview
SynBrane is an experimental music tool pairing a lightweight browser UI with a Node.js backend. The backend can talk to SuperCollider for real audio playback/rendering or fall back to a built-in Node DSP engine when SuperCollider is unavailable. Users browse tunings, pick roots and chord patterns in the palette, design custom chords with up to seven notes (including octave offsets and per-note mute toggles), sequence a simple 4-bar loop, audition it (including per-bar chord previews), and export WAV renders from the browser. Each bar can optionally switch into an arpeggiated playback style with per-bar pattern/rate controls for harmony mode.

Harmony mode uses a synth-style voice: selectable waveforms (sine, saw, square), an ADSR envelope (attack/decay/sustain/release), and an optional low-pass filter with resonance. Rhythm mode now layers a four-on-the-floor kick and snares on beats 2/4 with overtone-rich drum voices mapped per chord note. All synth controls are exposed in the UI and forwarded to the backend for previews and renders.

## Architecture
- **Frontend** (`public/`)
  - Plain HTML/CSS/JS served by the backend.
  - Fetches tunings and per-tuning chord lists (with roots) from the API.
  - Compact layout: top strip for global mode/tempo/rhythm/synth controls and patch save/load, a palette panel for tuning/root/chord selection, and a 4-bar grid panel with per-bar editors and instant chord preview buttons.
  - **Palette:** tuning selection, root selection (12-TET note names for 12-EDO, numeric degrees otherwise), chord browsing, and a **Custom Chord** editor with seven slots. Each slot can be toggled, muted (without losing its degree/octave), assigned to any degree in the active tuning, and shifted up or down by octaves. Selecting a bar in the 4-bar sequencer highlights the destination; the palette can assign either a preset chord or the current Custom Chord to that bar via the “Use for Bar X” control.
  - **Sequencer:** 4-bar grid where each bar can use its own tuning/root and choose between a preset chord or a per-bar Custom Chord; click a bar to mark it as the destination for palette assignments. Each bar exposes its own seven-slot custom editor with tuning-aware dropdowns, per-slot enable/mute toggles, 🔊 note previews, and a bar-level chord preview that plays a short audition without interrupting the loop.
  - Global controls: mode (harmony vs rhythm), expanded tempo slider (30–300 BPM), rhythm-speed multiplier slider (2.0–5.0 with fine steps), and synth controls (waveform, ADSR envelope, low-pass cutoff/resonance).
  - Patch system: patch name input, save/load buttons, and a dropdown of saved patches stored in browser `localStorage` (`synbrane_patches`). Patches capture mode, tempo, rhythm multiplier, synth settings, palette selection, per-bar tunings/roots/chords, custom slot degrees + mute states, and arpeggio choices.
  - Calls `/api/play` to audition a single chord or the 4-bar loop and `/api/render` to render to WAV. Web Audio drives local preview for chords (including per-bar chord previews), rhythm clicks, and per-slot note auditions so edits can be heard immediately. Loop previews repeat until stopped or until 10 passes are reached.

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
  - `engine.js` — Node DSP fallback that synthesizes harmony voices with selectable waveforms, ADSR envelopes, and an optional resonant low-pass filter. Rhythm voices layer a four-on-the-floor kick plus snares on beats 2 and 4, and map up to seven chord notes onto distinct tom/cymbal-style voices. It supports single-chord renders and multi-event 4-bar sequences, respecting BPM, rhythm-speed mapping, and synth parameters. Renders now default to 48 kHz / 24-bit WAV with normalization around -5 dBFS.
  - `index.js` — router that selects SuperCollider when `SUPER_COLLIDER_ENABLED=true`; otherwise uses the Node fallback. If SuperCollider execution fails, it automatically falls back to the Node path.

## Audio behavior
- **Harmony mode (Node DSP)**
  - Oscillator waveforms: sine, saw, or square.
  - Envelope: attack/decay/sustain/release in milliseconds. Release time extends rendered duration so tails are preserved.
  - Optional resonant low-pass filter with adjustable cutoff and resonance to tame or brighten harmonics.
  - Loudness normalized around -5 dBFS so preview loudness and rendered WAVs align while leaving headroom.
  - Per-bar arpeggio: when enabled on a bar, harmony notes render in sequence instead of as a stacked chord. Patterns: Up, Down, Up-Down. Rates: 1/4, 1/8, 1/16 notes synced to tempo. When arpeggio is off, chords play together as before.
- **Rhythm mode (Node DSP)**
  - Drum-like hits with a low fundamental, multiple overtone partials, optional noise for attack, and soft saturation. Uses pitch→rate mapping via the rhythm-speed slider (effective multiplier 2.0–5.0).
  - Four-on-the-floor backbone: kick on every beat with snares on beats 2 and 4 across the loop duration.
  - Note-mapped percussion for up to seven chord notes: floor/mid/high toms, closed/open hats, ride, and a metallic click.
  - Arpeggio toggles on bars currently leave rhythm timing unchanged; drum mapping still follows the chord notes.
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
  - Single chord payload: `{ tuningId, chord, root, mode, bpm, rhythmSpeed, synthSettings, customChord?, frequencies?, loopCount? }` (customChord carries slots/degrees/frequencies for custom notes).
  - 4-bar sequence payload: `{ mode, bpm, rhythmSpeed, synthSettings, loopCount?, sequence: [{ bar, durationBars, tuningId, chord, chordType, root, customChord?, frequencies?, arpeggioEnabled?, arpeggioPattern?, arpeggioRate? }] }`
  - Both endpoints accept `tuningType`/`tuningValue` for backwards compatibility.
  - `synthSettings` shape: `{ waveform, envelope: { attackMs, decayMs, sustainLevel, releaseMs }, filter: { cutoffHz, resonance } }` (all optional; defaults applied server-side).

## UI controls
- Palette for tuning/root/chord selection plus a seven-slot Custom Chord editor with octave offsets and mute toggles; assign the selected preset or the custom layout to the highlighted bar via “Use for Bar X.”
- Sequencer shows four bars; click any bar to select it for assignment. Mix tunings freely per bar, toggle each bar between preset chords and its own per-bar Custom Chord, and edit that bar’s seven slots directly with tuning-aware dropdowns, enable/mute toggles, and 🔊 note previews.
- Per-slot previews and per-bar chord previews play short Web Audio tones using the bar’s tuning/root and current synth settings without interrupting the loop.
- Per-bar playback style: each bar offers a “Chord vs Arpeggio” selector. When set to Arpeggio, pattern options (Up/Down/Up-Down) and rate options (1/4, 1/8, 1/16) appear. These settings currently affect harmony-mode playback and renders; rhythm-mode output stays mapped to the chord notes.
- Global controls: tempo (30–300 BPM), harmony vs rhythm mode, rhythm-speed multiplier (2.0–5.0).
- Synth controls (harmony): waveform, attack, decay, sustain level, release, low-pass cutoff, resonance.
- Preview/render actions for a single chord or the full 4-bar loop. Loop playback repeats until you press Stop or until 10 passes have played.
- Patch save/load: browser-local patches capture global controls, synth settings, palette selection, per-bar tunings/roots/chords, custom slot mute states, and arpeggio settings. Stored in `localStorage` under `synbrane_patches`.

## Configuration
- Local use requires no environment variables; all defaults are hard-coded for development and adjustable via the UI.
- Arpeggio controls are fully UI-driven with hard-coded defaults; no additional environment flags are needed.
- Optional environment variables remain supported for overrides:
  - `PORT` (default `3000`)
  - `HOST` (default `0.0.0.0`)
  - `BASE_FREQUENCY` (default `440`)
  - `SCALES_DIR` (default `<repo>/scales`)
  - `RENDER_OUTPUT_DIR` (default `<repo>/renders`)
  - `RENDER_SAMPLE_RATE` (default `48000`)
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
