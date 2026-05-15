# Urban Farm Hand

Urban Farm Hand is a modular web app for planning and managing small-space edible gardening.

## Current Services

- Plant Library: alphabetical, searchable edible plant information from Perenual.
- Calendar: full month calendar with date-based task creation and deletion.
- Notes: local idea creation, editing, and deletion.

## Run Locally

```powershell
npm run dev
```

Then open `https://localhost:4173`.

The local server creates a self-signed certificate in `.cert/` the first time it starts. Your browser may ask you to confirm the local certificate before loading the app.

Plant data is loaded from Perenual through the local `/api/plants` proxy. Put your API key in `.env.local`:

```powershell
PERENUAL_API_KEY=your-perenual-api-key
```

## Project Shape

Each service lives in `src/services/<service-name>` and exposes a small module contract:

- `id`
- `label`
- `navLabel`
- `summary`
- `render(context)`

Add future services by creating a folder under `src/services`, exporting that same contract, and registering it in `src/services/index.js`.

Planned service folders can follow the same pattern later:

- `src/services/accounts`
- `src/services/daily-tip`
- `src/services/forum`
