# Obsession Reader — Project Plan

> Mobile-friendly reader for the *Obsession* screenplay by Curry Barker.
> This document captures architecture and build decisions so work can continue across sessions.

---

## Goal

Extract the screenplay PDF **once** into structured JSON, then build the app entirely against that data. The PDF is an input artifact only — not needed at runtime.

**Target UX:** Book-like, left-aligned reading. **Moments** (scenes) are the unit of progress — tap left/right to move between moments. Within a moment, **vertical scroll** through contiguous dialogue, action, and dual dialogue. No PDF rendering at runtime.

---

## Source Material

| Item | Detail |
|------|--------|
| File | `obsession-2026.pdf` (repo root) |
| Pages | 99 |
| Origin | Final Draft 13 → macOS PDF |
| Text layer | ✅ Selectable text — **no OCR required** |
| Page 1 | Blank text layer (visual cover) — needs manual `title_card` entry |

**PDF page vs printed page:** Header shows `March 9th N.` — store both `pdfPage` (1-indexed) and `printedPage` when parseable.

---

## Architecture Overview

```
obsession-2026.pdf
       │
       ▼  (one-time extract)
scripts/extract.ts
       │
       ├── data/obsession.raw.json    ← line-level extract (regeneratable backup)
       └── data/obsession.json        ← elements + beats + moments
                │
                ▼
           Web app reads JSON only
                │
                ▼
           localStorage (moment progress + optional scroll position)
```

**No database or cache for screenplay data.** JSON loaded once into memory at startup (~800KB–2MB). Search runs client-side over elements.

---

## Data Model

Three layers in `data/obsession.json`:

### 1. `elements[]` — semantic screenplay structure (source of truth)

Used for search, fidelity, and building moments. **Preserves raw `lines[]` arrays** as extracted from the PDF — one entry per wrapped script line.

**Element types:**

| Type | Description |
|------|-------------|
| `title_card` | Cover page (manual entry for page 1) |
| `transition` | Cut direction (`SMASH CUT TO:`, `CUT TO:`, etc.) before a scene heading |
| `scene_heading` | `INT.` / `EXT.` lines |
| `action` | Stage direction / prose |
| `dialogue` | Character name + ordered `segments[]` (`speech` \| `parenthetical`) |
| `dual_dialogue` | Two parallel conversation tracks |

**Dialogue element example:**

```json
{
  "id": "el-042",
  "type": "dialogue",
  "character": "NICKY (O.S.)",
  "segments": [
    { "kind": "parenthetical", "text": "aggravated" },
    { "kind": "speech", "text": "Maybe she realized I wasn't in the back carving birch wood and weaving wool." }
  ],
  "pdfPage": 13,
  "printedPage": 12,
  "searchText": "..."
}
```

**Segment kinds:** `speech` (dialogue body) and `parenthetical` (stage direction within a cue; stored without wrapping parens). Inline emphasis in text uses `*italic*`, `_underline_`, `**bold**` (rendered via `InlineText`; stripped for search/QA compare).

**Dual dialogue element example:**

```json
{
  "id": "el-087",
  "type": "dual_dialogue",
  "left": [
    {
      "character": "NICKY (O.S.)",
      "parenthetical": "to Carter",
      "lines": ["Nooo, that's not-"]
    }
  ],
  "right": [
    {
      "character": "CARTER (O.S.) (CONT'D)",
      "parenthetical": "to Nicky",
      "lines": ["You get me?"]
    }
  ],
  "pdfPage": 38,
  "printedPage": 37
}
```

Each element has a stable string ID (`el-001`, `el-002`, …).

### 2. `moments[]` — navigation / progress units (primary UX)

A **moment** is a scrollable block of contiguous story content. This is what the user taps through and what progress tracks.

```json
{
  "id": "moment-012",
  "index": 11,
  "elementIds": ["el-045", "el-046", "el-047", "el-048"],
  "sceneHeadingId": "el-045",
  "printedPage": 16
}
```

**Moment grouping rules:**

| Starts a new moment | Stays in current moment |
|---------------------|-------------------------|
| `title_card` | — |
| `scene_heading` with a **large time/location jump** (new `INT.` / `EXT.` slug, `- LATER`, `- MOMENTS LATER`, `- DAY` → `- NIGHT`, etc.) | `scene_heading` ending in `- CONTINUOUS` (visual divider only; same scroll block) |
| First element after cover | All following action, dialogue, dual_dialogue until the next moment break |

**Within a moment (vertical scroll, top to bottom):**

- `scene_heading` (styled divider when `- CONTINUOUS`, or opener when starting a moment)
- `action` blocks
- `dialogue` blocks (reflowed for display — see Display layer below)
- `dual_dialogue` blocks (two columns, side-by-side, left-aligned in each column)

**Not a concern for v1:** arbitrarily long scenes — no max-height split yet.

Moments can be generated at extract time or computed client-side from elements; extract-time is preferred for stable IDs and search → moment mapping.

### 3. `beats[]` — legacy / internal

One beat per element — kept in JSON for QA/debugging. The reader navigates **moments**, not beats.

---

## Display Layer (UI responsibility)

**Principle:** Data stays faithful; display reads comfortably.

### Line reflow

Do **not** render one `<p>` per raw script line. The UI joins `lines[]` into flowing paragraphs:

- Dialogue: reflow each `speech` segment; parentheticals render as asides
- Action: split on `\n\n` into separate paragraphs
- Dual dialogue: reflow each track's `lines[]` independently

Raw lines remain in JSON for search fidelity and future reuse.

### Typography & theme (light mode)

Mobile-first, comfortable for extended reading. Warm paper background (`#faf8f5`), near-black dialogue ink.

| Role | Treatment |
|------|-----------|
| **Dialogue body** | 18–20px serif (`clamp`), near-black, line-height 1.7 |
| **Character name** | 13–14px bold caps, **per-character accent color** |
| **Dialogue block** | 2px left border + subtle tint in character color |
| **Parenthetical** | 13–14px italic, stone gray |
| **Action** | 17–19px serif, ~76% ink, neutral stone left rule |
| **Transition** | 13–14px semibold caps, rule above, right-aligned |
| **Scene opener** | 14–15px caps, tinted band, letter-spaced |
| **Scene `- CONTINUOUS`** | Divider line, small muted caps |

Per-character colors defined in `src/lib/character-colors.ts` (core cast mapped; minor characters hashed to extended palette).

### Layout

- **General content:** Left-aligned, book-like (not centered screenplay layout)
- **Dual dialogue:** Always **two columns, side-by-side** on mobile and desktop; each column **left-aligned**. Lives inside the moment scroll — not a separate tap target. Font size may be slightly smaller than single dialogue if needed (sanity-check on device later).

### Visual hierarchy (four lanes)

| Lane | Example | Treatment |
|------|---------|-----------|
| **Who** | `IAN` | 16px bold uppercase |
| **Aside** | `(knowing look at Bear)` | 14px italic, muted |
| **Speech** | `There—` / reflowed paragraph | 20px regular |
| **Stage direction** | `Sarah playfully grabs Bear's arm.` | 18px serif (or other distinct face), muted |
| **Scene** | `INT. BEAR'S HOUSE - …` | Own distinct styling |

---

## Dual Dialogue (extraction)

Two patterns exist in this PDF:

### Type A — Side-by-side coordinates (detectable)

Final Draft preserved left/right columns at the line level. Detect by comparing line `x` positions against page midpoint.

- ~12 elements in current extract
- Examples: printed p.16 (BEAR / TRIVIA GUY), printed p.37 (NICKY / CARTER)
- Extract as `dual_dialogue` element

### Type B — Stacked sequentially (visual dual, flat coordinates)

Some pages (e.g. printed p.12 — gun scene) look dual-column on screen but PDF text is vertically stacked blocks.

- Text extraction is accurate; simultaneity is lost
- **V1:** Keep as alternating `dialogue` elements in reading order
- **Later:** Optional post-pass to re-pair rapid alternations into `dual_dialogue`

### Dual dialogue UI (target)

- Inside moment scroll
- Two columns, side-by-side, left-aligned always
- Reflowed text per column
- Not its own moment or tap boundary

---

## Extraction Pipeline

**Tool:** TypeScript + `pdfjs-dist`, run via `pnpm extract`.

### Step 1 — Raw extract → `data/obsession.raw.json`

Line-level data with positions (regeneratable backup).

### Step 2 — Classify → `elements[]` in `data/obsession.json`

Rules (position + pattern based):

1. Skip page headers (`March 9th N.`)
2. `INT.` / `EXT.` at left margin → `scene_heading`
3. All-caps centered short line → character name → collect parenthetical + dialogue → `dialogue`
4. Same-`y` lines in left + right columns → `dual_dialogue`
5. Left-margin prose → `action`
6. Page 1 → manual `title_card`

### Step 3 — Generate `beats[]` (legacy)

One beat per element — used by current prototype only.

### Step 4 — Generate `moments[]` (target)

Group `elements[]` by moment rules above. Assign stable `moment-*` IDs.

### Step 5 — Validate

Automated checks (`pnpm validate`):

- [ ] Page count = 99
- [ ] All beats/moments reference valid `elementId`s
- [ ] Spot-check pages: printed 1, 12, 16, 37, 85
- [ ] Search smoke tests: `"tiny silver revolver"`, `"Got into some pills"`, `"BRICK"`
- [ ] Character list looks sane (BEAR, NICKY, IAN, SARAH, …)
- [ ] Scene heading count reasonable

---

## App UX

### Navigation

| Input | Behavior |
|-------|----------|
| ← → buttons, keys, or tap left/right edges (mobile) | Previous / next **moment** |
| Vertical scroll or ↑ ↓ keys | Within current moment |
| Home icon or J / Home key | Title page (moment 0) |
| K / End key | Last moment |
| `/` | Search |
| `T` | Scene list |
| `Esc` | Close overlay |

Progress displays **moment index** (e.g. `Scene 12 / 59 · p.16`). Each moment shows an optional **reference label** (`Location — beat`) for out-loud discussion — see `src/lib/moment-labels.ts`.

### User state — `localStorage`

Key: `obsession-reader-state`

**Target shape:**

```json
{
  "screenplayVersion": 1,
  "currentMomentId": "moment-012",
  "currentMomentIndex": 11,
  "scrollY": 0,
  "lastReadAt": "2026-06-19T12:00:00Z"
}
```

- **`currentMomentId`** is primary (stable across re-extracts)
- **`scrollY`** optional — restore scroll position within a moment
- No auth; progress persists between browser sessions
- User state is separate from screenplay JSON

### Search

Client-side, in-memory, over `elements[]`:

- Search uses raw `searchText` (faithful to extracted content)
- Results map to **`momentId`** (+ optional scroll-to-element within moment)
- No separate search database needed at this scale

---

## Repo Layout

```
obsession-app/
├── docs/
│   ├── PLAN.md
│   └── QA-TOOL.md
├── data/
│   ├── obsession.raw.json
│   └── obsession.json          ← elements + beats + moments
├── scripts/
│   ├── extract.ts
│   ├── validate.ts
│   └── lib/
├── src/                        ← web app (reads data/obsession.json only)
├── public/data/obsession.json  ← copy served to app
├── obsession-2026.pdf
└── README.md
```

---

## Shipped (Jun 2026)

**Pipeline:** PDF extract → classify → validate. `pnpm extract` backs up prior JSON and bumps `meta.version`.

**Reader:** Moment navigation + in-moment scroll, search, localStorage progress, left-aligned layout, dual dialogue columns, line reflow, mobile typography (`clamp()` scales), scene heading hierarchy, transition elements, action paragraph breaks, inline emphasis rendering, per-character colors, moment reference labels (`Location — beat`).

**Data quality:** Full QA pass complete — **98 OK · 0 WARN · 0 FAIL · 1 SKIP** (title page). Hand-fixes through `meta.version` 124. Dialogue `segments[]`, transition type, classifier wrap-row fix.

**QA tool (dev-only):** CLI report, visual split-pane editor, linked PDF highlighting, suspected-gap dismissals, delete/convert/add elements, drag reorder. See [QA-TOOL.md](./QA-TOOL.md).

**No active build backlog.** Re-open work only when reading/testing surfaces a concrete issue.

---

## Explicitly NOT P0

- Auth / accounts / server
- SQLite / IndexedDB for screenplay data
- Sound effects, movie stills, per-beat assets
- Stylized fonts beyond the action/dialogue/heading hierarchy above
- Re-pairing stacked dual dialogue (Type B)
- Splitting long scenes / moments
- Max-height "continue" breaks within a moment

**Do** use stable IDs (`el-*`, `moment-*`) and a `type` enum so future features attach cleanly.

---

## Known Issues / Edge Cases

| Issue | Mitigation |
|-------|------------|
| Page 1 has no text | Hardcode `title_card` element |
| PDF line breaks → whitespace if rendered literally | UI reflow (`lines.join(" ")`) |
| Stacked dual dialogue (Type B) | Alternating dialogue in scroll; re-pair later |
| `- CONTINUOUS` scene headings | Same moment; styled as in-scroll divider |
| PDF page ≠ printed page | Store both; show printed page in chrome |
| Dual columns tight on small phones | Sanity-check font size after moment scroll ships |

---

## Implementation Status

| Area | Status |
|------|--------|
| PDF → JSON extract | ✅ Shipped |
| QA tool + data pass | ✅ Shipped (see QA-TOOL.md) |
| Moments + scroll navigation | ✅ Shipped |
| Line reflow + segments + emphasis | ✅ Shipped |
| Typography / light theme | ✅ Shipped |
| Per-character colors + moment labels | ✅ Shipped |
| Dual side-by-side in scroll | ✅ Shipped |
| `beats[]` in JSON | 🗄️ Legacy (debug/QA only) |

---

## Tech Notes

- **Extraction:** TypeScript + `pdfjs-dist` (`pnpm extract`)
- **App:** Vite + React + TypeScript + Tailwind CSS v3 + TanStack Router
- **Skipped for weight:** TanStack Query (static JSON fetched once), TanStack Start, server/auth
- **Data size:** JSON from `/public/data/obsession.json` (~800KB, gzip-friendly)
- **Postgres convention:** N/A for app; if a server is added later, use double-quoted column names in SQL

---

## Session Handoff Checklist

When picking up a new session:

1. Read this file (`docs/PLAN.md`)
2. Check `data/obsession.json` exists — if not, `pnpm extract`
3. App reads `data/obsession.json` only, never the PDF
4. Nav is **moments + scroll** — beats in JSON are legacy only
5. User progress: `localStorage` key `obsession-reader-state` (`currentMomentId`, `scrollY`)
6. Dual dialogue: Type A = `dual_dialogue` element; Type B = sequential `dialogue` in scroll
7. Data fixes via `/qa` (dev) or hand-edit `data/obsession.json`; run `pnpm validate` before commit
8. QA baseline: `pnpm qa` — expect 98 OK, 0 WARN (Jun 2026)
