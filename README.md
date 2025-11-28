# SynBrane

Experimental music workbench for exploring alternative tunings, browsing chords, and translating pitch information into rhythm. The app ships with a minimal browser UI backed by a Node.js API and a SuperCollider-ready boundary for audio rendering.

## Getting started
1. Copy `.env.example` to `.env` and adjust as needed.
2. Install dependencies (none required beyond Node.js for the current stubbed build).
3. Run the server:
   ```bash
   npm run dev
   ```
4. Open the reported URL (default http://localhost:3000) to use the UI.

## Documentation
See `PROJECT_CONTEXT.md` for architecture notes, API endpoints, environment variables, and TODOs.
