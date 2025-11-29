# SynBrane

Experimental music workbench for exploring alternative tunings, browsing chords, and translating pitch information into rhythm. The app ships with a minimal browser UI backed by a Node.js API and a SuperCollider-ready boundary for audio rendering. A seven-slot custom chord editor, expanded tempo/rhythm controls, and a dance-focused rhythm engine (kick on every beat, snares on 2/4, per-note toms/cymbals) are available out of the box.

## Getting started
1. Copy `.env.example` to `.env` and adjust as needed.
2. Install dependencies (none required beyond Node.js; SuperCollider is optional when `SUPER_COLLIDER_ENABLED=true`).
3. Run the server:
   ```bash
   npm run dev
   ```
4. Open the reported URL (default http://localhost:3000) to use the UI.

## Documentation
See `PROJECT_CONTEXT.md` for architecture notes, API endpoints, environment variables, and TODOs.
