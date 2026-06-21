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
| `dialogue` | Character name + ordered `segments[]` (see SCHEMA-001; legacy: optional `parenthetical` + `lines[]`) |
| `dual_dialogue` | Two parallel conversation tracks |

**Dialogue element example:**

```json
{
  "id": "el-042",
  "type": "dialogue",
  "character": "NICKY (O.S.)",
  "parenthetical": "aggravated",
  "lines": [
    "Maybe she realized I wasn't in the back carving birch wood and weaving wool."
  ],
  "pdfPage": 13,
  "printedPage": 12,
  "searchText": "..."
}
```

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

### 3. `beats[]` — legacy / internal (current prototype)

The live prototype still navigates **beats** (1 element = 1 tap). Beats remain in JSON for now but are **not the target navigation model**. They may be removed or kept only for debugging once moments ship.

---

## Display Layer (UI responsibility)

**Principle:** Data stays faithful; display reads comfortably.

### Line reflow

Do **not** render one `<p>` per raw script line. The UI joins `lines[]` into flowing paragraphs:

- Dialogue: `lines.join(" ")` → single paragraph per speech (unless we later detect intentional blank-line breaks)
- Action: already a single `text` field; render as one paragraph
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
| **Action** | 17–19px serif, ~76% ink, neutral stone left rule (READ-005) |
| **Transition** | 13–14px semibold caps, rule above, right-aligned (READ-005) |
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

### Navigation (target)

| Input | Behavior |
|-------|----------|
| Tap left / right (or ← / →) | Previous / next **moment** |
| Vertical scroll | Within current moment |
| `/` | Search (unchanged) |
| `Esc` | Close search |

Progress displays **moment index** (e.g. `12 / 87`), not beat count. Printed page shown when available.

### Navigation (current prototype)

Still on **beats** — one element per tap, no moment scroll. To be migrated.

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

**Current prototype** still uses `currentBeatId` / `currentBeatIndex` — migrate when moments ship.

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
│   └── PLAN.md
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

## Build Order

### Done

1. ✅ Extract — `pnpm extract` → raw + structured JSON + moments
2. ✅ Validate — `pnpm validate`
3. ✅ App shell — Vite + React + Tailwind + TanStack Router
4. ✅ Moment navigation + in-moment scroll + localStorage progress
5. ✅ Search → jump to moment (+ scroll to element)
6. ✅ Left-aligned layout; dual dialogue side-by-side in scroll
7. ✅ Display reflow — joined dialogue lines in UI
8. ✅ Typography — dialogue 20px, character 16px, parenthetical 14px italic, action 18px serif

### Later

1. **Dual font tuning** — sanity-check column size on small phones
2. **Re-pair stacked dual dialogue** (Type B) in extract
3. **Split long scenes** — only if needed after reading through

---

## Current priorities (Jun 2026)

Ordered stack for what to build next. **Ops work in parallel:** finish QA pass on 9 WARN pages (16, 35, 49, 63, 64, 70, 87, 90, 93) via `/qa?page=N`.

### Tier 1 — Unblock correct content

| # | ID | Why now |
|---|-----|---------|
| 1 | **READ-004** | ✅ Done — action `\n\n` → separate paragraphs in reader + QA |
| 2 | *(ops)* | WARN page review — 9 pages left (16, 35, 49, 63, 64, 70, 87, 90, 93). |
| — | **READ-002** | ✅ Done — `transition` element type, classifier, migrate script, reader + QA editor. |
| — | **READ-003** | ✅ Done — scene heading hierarchy (bold/prominent slugs, quieter action). |
| — | **SCHEMA-001** | ✅ Done — segments schema, page 3 data (v11). |

### Tier 2 — QA velocity & reader polish

| # | ID | Why |
|---|-----|-----|
| 4 | **QA-006** | ✅ Done — change/add element type in QA editor |
| 5 | **READ-003** | Scene headings should lead visually (prod feedback); mostly CSS |
| 6 | **Phase D** | Review workflow — mark pages done, CLI hints to `/qa?page=N` |

### Tier 3 — Extract & structural capture (after hand-fixes stable)

| # | ID | Gate |
|---|-----|------|
| 7 | **EXTRACT-001** | ✅ Done — dialogue wrap-row fix + action-column exit; fresh `pnpm extract` backs up prior JSON and bumps version |
| 8 | **READ-002** | Transitions (`SMASH CUT TO:`) — fidelity, not blocking QA |

### Tier 4 — Backlog / research

| ID | Notes |
|----|--------|
| **READ-001** | Inline emphasis — render ✅; QA editor buttons + extract todo |
| **READ-005** | ✅ Done — mobile typography & lane balance (action/transition presence) |
| **Later** (build order) | Dual font tuning, Type B dual re-pair, split long scenes |
| *(un ticketed)* | CLI page-number noise, mis-split heuristics, QA session log, extract line provenance |

### Suggested sequence

```
READ-001 editor buttons → Phase D
```

**Dependencies:** EXTRACT-001 waits on stable hand-fixes + backup strategy. READ-004 is independent.

---

## Backlog (ticket reference)

| ID | Area | Ticket |
|----|------|--------|
| **READ-001** | Reader + QA + extract | **Inline emphasis — `*italic*` + `_underline_` + `**bold**`**. Convention: `*` italic, `_` underline (project-specific). **Done:** `InlineText` component in reader + QA preview; strip delimiters in QA compare + `rebuildSearchText`. **Todo:** QA editor wrap buttons; extract auto-wrap from pdf.js font flags. |
| **READ-002** | ✅ Done | **Capture transition directions** — `transition` element type; 5 instances migrated; classifier + `pnpm migrate-transitions`. |
| **READ-003** | ✅ Done | **Scene heading visual hierarchy** — bold/prominent slugs, quieter action body. |
| **READ-004** | Reader + QA | ✅ Done — action `\n\n` paragraph breaks |
| **READ-005** | Reader CSS | ✅ Done — **Mobile typography & lane balance** — raised mobile `clamp()` floors; action 17–19px + 76% ink + stone left rule; transitions 13–14px semibold + top rule; scene headings bumped; dual dialogue slightly smaller; `px-4` / full width on phone. |
| **QA-006** | QA tool | ✅ Done — **Change / add element type** — see [QA-TOOL.md](./QA-TOOL.md). |
| **EXTRACT-001** | Extract pipeline | **Dialogue wrap at left margin** — classifier splits Nicky-style voicemail when wrapped lines hit left margin (`parseDialogue` `x0 < 120` break). Causes el-015/el-016-style bugs. Fix in `scripts/lib/classifier.ts` for future `pnpm extract` only — re-extract overwrites QA hand fixes unless coordinated. See [QA-TOOL.md](./QA-TOOL.md). |
| **SCHEMA-001** | ✅ Done | **Dialogue segments** — ordered speech/parenthetical blocks within one dialogue element. Shipped v7 tooling / v11 data; page 3 el-015/el-017 fixed. Full spec below. |

### SCHEMA-001 — Dialogue segments (spec)

**Problem:** Dialogue today is `character` + optional `parenthetical` + `lines[]`. The reader renders **Who → one aside → speech**. Screenplay dialogue can interleave: speech → `(some movement)` → more speech in the **same** cue (page 3 Nicky voicemail after `Oh fuck! fuck!`). Classifier drops or mis-buckets the paren; even with QA edits there is no first-class place to store it.

**Example (target JSON after migration):**

```json
{
  "id": "el-015",
  "type": "dialogue",
  "character": "NICKY (V.O.)",
  "segments": [
    { "kind": "speech", "text": "Hey! You are so lucky you weren't scheduled today. ... Oh fuck! fuck!" },
    { "kind": "parenthetical", "text": "some movement" },
    { "kind": "speech", "text": "God damn it." }
  ],
  "pdfPage": 3,
  "searchText": "..."
}
```

`el-017` stays action-only: `Bear's eyes widen. He calls Nicky back immediately.`

**Types (TypeScript):**

```ts
type DialogueSegmentKind = "speech" | "parenthetical";

interface DialogueSegment {
  kind: DialogueSegmentKind;
  text: string; // parenthetical text WITHOUT wrapping parens (matches legacy parenthetical field)
}

interface DialogueTrack {
  character: string;
  segments: DialogueSegment[];
  // legacy during migration — see below
}

// dialogue element: character + segments[]
// dual_dialogue: left/right tracks each use segments[]
```

**Reader display:** For each segment in order — `speech` → dialogue body (`text-dialogue`); `parenthetical` → aside (`text-parenthetical`, render as `(text)`). Character name once at top. Same four-lane hierarchy as today, but repeatable within one block.

**Migration (one-time script + bump `meta.version`):**

| Legacy | → `segments` |
|--------|----------------|
| `lines: ["a", "b"]`, no `parenthetical` | `[{ kind: speech, text: "a" }, { kind: speech, text: "b" }]` |
| `parenthetical: "laughter"`, `lines: ["Yeah"]` | `[{ kind: parenthetical, text: "laughter" }, { kind: speech, text: "Yeah" }]` |
| Reflowed single-line dialogue (QA merges) | `[{ kind: speech, text: "..." }]` — keep as one speech segment unless editor splits |

- **Canonical after migration:** `segments` required on dialogue / dual tracks; drop `parenthetical` + `lines` from JSON once migrated (or accept both in read path temporarily, write path emits `segments` only).
- **Do not** re-run full `pnpm extract` until EXTRACT-001 emits `segments` — migrate existing hand-fixed JSON first.

**Touch points (implementation order):**

1. `src/types.ts`, `scripts/lib/types.ts` — add types
2. `scripts/migrate-dialogue-segments.ts` (or similar) — convert `data/obsession.json`, run validate
3. `scripts/lib/cleanup.ts` — `rebuildSearchText`, reflow helpers
4. `scripts/lib/classifier.ts` — `parseDialogue` builds `segments[]`; `denormalizeBeat`
5. `lib/qa-compare.ts` — `extractElementText` flattens segments for word compare
6. `src/components/ElementView.tsx` — render segments
7. `src/qa/ElementEditor.tsx` — segment list editor (add/remove/reorder speech vs paren rows)
8. `scripts/qa-save.ts` — already rebuilds on save; ensure segment-aware
9. `scripts/validate.ts` — require `segments`, forbid empty, validate kinds

**Extract (pairs with EXTRACT-001):** While inside an active dialogue track, lines matching `(…)` append `{ kind: parenthetical }` and continue parsing; do not hand off to `parseAction` until true action column / new character cue.

**Non-goals for v1:**

- Inline emphasis within a speech segment (READ-001) — separate
- Action paragraph `\n\n` (READ-004) — stays on `action.text`
- Nesting segments beyond speech/parenthetical

**QA workflow (page 3, done):** el-015 segments `(some movement)` + trailing speech; el-017 action-only — committed at meta.version 11.

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
| PDF → JSON extract | ✅ Shipped (TypeScript + pdfjs-dist) |
| Moments + scroll navigation | ✅ Shipped |
| Line reflow in UI | ✅ Shipped |
| Typography / light theme | ✅ Shipped |
| Per-character colors | ✅ Shipped |
| Moment-based progress | ✅ Shipped |
| Dual side-by-side in scroll | ✅ Shipped |
| Beat-based reader | 🗄️ Legacy (beats still in JSON) |

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
4. **Target nav:** moments + scroll (see Implementation Status)
5. User progress: `localStorage` key `obsession-reader-state` (`currentMomentId`, `scrollY`)
6. Dual dialogue: Type A = `dual_dialogue` element; Type B = sequential `dialogue` for v1
7. Display reflow is a UI concern — do not re-extract to fix line breaks
