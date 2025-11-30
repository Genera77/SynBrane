# SynBrane

Experimental music workbench for exploring alternative tunings, browsing chords, and translating pitch information into rhythm. The app ships with a minimal browser UI backed by a Node.js API and a SuperCollider-ready boundary for audio rendering. A five-slot custom chord editor, expanded tempo/rhythm controls, and a groove-focused rhythm engine (four-on-the-floor kick/snare spine with hats and per-note tom/clap layers on slowed grids) are available out of the box.

## Getting started
1. Copy `.env.example` to `.env` and adjust as needed.
2. Install dependencies (none required beyond Node.js; SuperCollider is optional when `SUPER_COLLIDER_ENABLED=true`).
3. Run the server:
   ```bash
   npm run dev
   ```
4. Open the reported URL (default http://localhost:3001) to use the UI.

## Documentation
See `PROJECT_CONTEXT.md` for architecture notes, API endpoints, environment variables, and TODOs.
