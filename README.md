An app that creates a mobile-friendly reader of the Obsession screenplay by Curry Barker.

See [docs/PLAN.md](docs/PLAN.md) for architecture, data model, and build plan.

## Quick start

```bash
# 1. Extract screenplay JSON from PDF (once)
npm install
npm run extract
npm run validate

# 2. Run the reader
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Controls

- Tap **left / right** edges to go to prev/next **moment**
- **Scroll vertically** within a moment
- **← →** or **↑ ↓** — prev/next moment
- **J** — jump to start · **K** — jump to end
- **Home** / **End** — start / end (also works on laptop)
- **/** — search · **T** — scene list · **Esc** — close overlay
- Scene list also appears on the title screen at the start
- Progress saves automatically in `localStorage` (moment + scroll position)

## Stack

- **Vite + React + TypeScript** — lightweight SPA
- **Tailwind CSS v3** — small purged CSS bundle
- **TanStack Router** — routing (single route for now; no TanStack Query — static JSON loaded once)
- **TypeScript + pdfjs-dist** — one-time PDF extraction (`npm run extract`)
