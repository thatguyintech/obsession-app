An app that creates a mobile-friendly reader of the Obsession screenplay by Curry Barker.

See [docs/PLAN.md](docs/PLAN.md) for architecture, data model, and shipped status.

## Quick start

```bash
# 1. Extract screenplay JSON from PDF (once)
pnpm install
pnpm extract
pnpm validate

# 2. Run the reader
pnpm dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Dev tooling

Maintainer-only QA (not in prod build):

```bash
pnpm qa              # CLI page-by-page report
pnpm dev             # then open /qa?page=N
```

See [docs/QA-TOOL.md](docs/QA-TOOL.md) for the visual reviewer (PDF vs JSON, edit, save, linked highlighting).

## Controls

- **← →** buttons below the moment (or **← →** keys) — previous / next moment
- **Tap left / right edges** (mobile) — same prev/next moment
- **Scroll vertically** (or **↑ ↓** keys) — within the current moment
- **Home** icon or **J** / **Home** key — jump to title page
- **K** / **End** — jump to last moment
- **/** — search · **T** — scene list · **Esc** — close overlay
- Scene list also appears on the title screen at the start
- Progress saves automatically in `localStorage` (moment + scroll position)

## Stack

- **Vite + React + TypeScript** — lightweight SPA
- **Tailwind CSS v3** — small purged CSS bundle
- **TanStack Router** — routing (single route for now; no TanStack Query — static JSON loaded once)
- **TypeScript + pdfjs-dist** — one-time PDF extraction (`pnpm extract`)
