# Obsession Reader — Project Plan

> Mobile-friendly, story-style reader for the *Obsession* screenplay by Curry Barker.
> This document captures architecture and build decisions so work can continue across sessions.

---

## Goal

Extract the screenplay PDF **once** into structured JSON, then build the app entirely against that data. The PDF is an input artifact only — not needed at runtime.

**Prototype UX:** Instagram Story–like navigation — one beat (chunk) per screen, tap left/right (or arrow keys) to advance, reading progress persisted in the browser via `localStorage` (no auth).

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
scripts/extract.py
       │
       ├── data/obsession.raw.json    ← line-level extract (regeneratable backup)
       └── data/obsession.json        ← app schema (elements + beats)
                │
                ▼
           Web app reads JSON only
                │
                ▼
           localStorage (user progress)
```

**No database or cache for screenplay data.** JSON loaded once into memory at startup (~500KB–2MB). Search runs client-side over elements.

---

## Data Model

Two layers in a single file (`data/obsession.json`):

### 1. `elements[]` — semantic screenplay structure

Used for search, scene logic, and faithful representation of the script.

**Element types:**

| Type | Description |
|------|-------------|
| `title_card` | Cover page (manual entry for page 1) |
| `scene_heading` | `INT.` / `EXT.` lines |
| `action` | Full-width prose / stage direction |
| `dialogue` | Character name + optional parenthetical + lines |
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
  "printedPage": 12
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

### 2. `beats[]` — navigation units

What the user taps through. One beat ≈ one screen.

**V1 rule: 1 element = 1 beat** (simplest; tune grouping later).

```json
{
  "id": "beat-087",
  "elementId": "el-087",
  "index": 86,
  "type": "dual_dialogue"
}
```

Beats may denormalize content from their element for simpler rendering, or resolve `elementId` at runtime — either is fine at this scale.

**Future beat splitting (not P0):** Long action blocks split at sentence boundaries into sub-beats sharing an `elementId`:

```json
{
  "id": "beat-006a",
  "elementId": "el-006",
  "part": 1,
  "type": "action",
  "text": "In the center of the room, a DEAD CAT lies where the coffee table should be."
}
```

---

## Dual Dialogue

Two patterns exist in this PDF:

### Type A — Side-by-side coordinates (detectable)

Final Draft preserved left/right columns at the line level. Detect by comparing line `x` positions against page midpoint.

- ~8 pages have true side-by-side dual dialogue
- Examples: printed p.16 (BEAR / TRIVIA GUY), printed p.37 (NICKY / CARTER)
- Extract as `dual_dialogue` element → single beat with split UI

### Type B — Stacked sequentially (visual dual, flat coordinates)

Some pages (e.g. printed p.12 — gun scene) look dual-column on screen but PDF text is vertically stacked blocks.

- Text extraction is accurate; simultaneity is lost
- **V1:** Keep as alternating `dialogue` elements in reading order
- **Later:** Optional post-pass heuristic to re-pair rapid alternations into `dual_dialogue`

**Dual dialogue beat UI:**
- Portrait: stacked with character labels
- Landscape: side-by-side columns
- Always one tap to advance past the whole moment

---

## Extraction Pipeline

**Tool:** PyMuPDF (`fitz`) in a Python venv (`.venv` at repo root).

### Step 1 — Raw extract → `data/obsession.raw.json`

Line-level data with positions:

```json
{
  "page": 2,
  "lines": [
    { "x0": 108, "y0": 71, "x1": 325, "y1": 83, "text": "INT. BEAR'S HOUSE - LIVING ROOM - NIGHT" }
  ]
}
```

### Step 2 — Classify → `data/obsession.json`

Rules (position + pattern based):

1. Skip page headers (`March 9th N.`)
2. `INT.` / `EXT.` at left margin → `scene_heading`
3. All-caps centered short line → character name → collect parenthetical + dialogue → `dialogue`
4. Same-`y` lines in left + right columns → `dual_dialogue`
5. Left-margin prose → `action`
6. Page 1 → manual `title_card`

### Step 3 — Generate beats

For each element (in order): create one beat with `elementId`, sequential `index`, matching `type`.

### Step 4 — Validate

Automated checks (`scripts/validate.py`):

- [ ] Page count = 99
- [ ] All beats have valid `elementId` references
- [ ] Spot-check pages: printed 1, 12, 16, 37, 85
- [ ] Search smoke tests: `"tiny silver revolver"`, `"Got into some pills"`, `"BRICK"`
- [ ] Character list looks sane (BEAR, NICKY, IAN, SARAH, …)
- [ ] Scene heading count reasonable

---

## App UX (Prototype)

### Navigation

- **Primary:** Tap left/right halves of screen
- **Keyboard:** ← → or ↑ ↓ arrow keys
- One beat per screen; no PDF rendering

### Beat rendering by type

| Type | Layout |
|------|--------|
| `title_card` | Centered title / author |
| `scene_heading` | Title card — centered, distinct styling |
| `action` | Full-width prose |
| `dialogue` | Centered character name, optional parenthetical, dialogue block |
| `dual_dialogue` | Two tracks (side-by-side or stacked) |

### User state — `localStorage`

Key: `obsession-reader-state`

```json
{
  "screenplayVersion": 1,
  "currentBeatId": "beat-087",
  "currentBeatIndex": 86,
  "lastReadAt": "2026-06-19T12:00:00Z"
}
```

- **`currentBeatId`** is primary (stable across re-extracts)
- **`currentBeatIndex`** is a cache for fast lookup
- No auth; progress persists between browser sessions
- User state is separate from screenplay JSON — never mixed in

### Search

Client-side, in-memory, over `elements[]`:

- Build searchable text per element (character names + dialogue + action text)
- Results map to `beatId` for "jump to scene"
- No separate search database needed at this scale

---

## Repo Layout (target)

```
obsession-app/
├── docs/
│   └── PLAN.md                 ← this file
├── data/
│   ├── obsession.raw.json      ← line-level extract
│   └── obsession.json          ← app schema (committed to git)
├── scripts/
│   ├── extract.py              ← PDF → raw → structured
│   └── validate.py             ← sanity checks
├── src/                        ← web app (reads data/obsession.json only)
├── obsession-2026.pdf          ← source PDF (optional in git)
├── .venv/                      ← Python venv for extraction scripts
└── README.md
```

---

## Build Order

1. **Extract** — `scripts/extract.py` → `data/obsession.raw.json` + `data/obsession.json`
2. **Validate** — `scripts/validate.py` + manual spot-check
3. **App shell** — load JSON, render one beat, left/right navigation
4. **Progress** — `localStorage` read/write on beat change
5. **Search** — client-side element search → jump to beat
6. **Polish** — scene heading styling, dual dialogue layout, mobile viewport

---

## Explicitly NOT P0

Do not build or schema for these yet:

- Auth / accounts / server
- SQLite / IndexedDB for screenplay data
- Stylized fonts per beat
- Sound effects
- Images from the movie
- Separate asset manifest
- Smart beat grouping / action splitting
- Re-pairing stacked dual dialogue (Type B)

**Do** use stable IDs (`el-*`, `beat-*`) and a `type` enum so these can be added later without restructuring.

---

## Known Issues / Edge Cases

| Issue | Mitigation |
|-------|------------|
| Page 1 has no text | Hardcode or manually add `title_card` element |
| Long action blocks overflow screen | Allow scroll within beat for v1; split beats later |
| Back-to-back scene headings feel choppy | Acceptable for v1; merge heading+action later if needed |
| Stacked dual dialogue (Type B) | Alternating dialogue beats; re-pair in v2 if needed |
| PDF page ≠ printed page | Store both; show printed page in UI footer |

---

## Sanity Check Reference (PDF pages 1–3)

Validated against actual PDF content. Opening sequence (PDF p.2–3) produces ~17 beats:

- 1 title card (cover)
- 4 scene headings
- 12 action beats
- No dialogue in opening — all action/heading types work fine
- Beat 6 (dead cat paragraph) is the densest — candidate for future split
- Beat 17 ("Bear's eyes widen. He calls Nicky back immediately.") is a natural pause point

---

## Tech Notes

- **Extraction:** Python 3 + PyMuPDF in `.venv`
- **App:** Web (mobile-first); exact stack TBD
- **Data size:** ~500KB–2MB JSON — load entirely into memory
- **Postgres convention:** N/A for app; if a server is added later, use double-quoted column names in SQL

---

## Session Handoff Checklist

When picking up a new session:

1. Read this file (`docs/PLAN.md`)
2. Check if `data/obsession.json` exists — if not, run extraction first
3. App should only import from `data/obsession.json`, never the PDF
4. User progress lives in `localStorage`, key `obsession-reader-state`
5. Dual dialogue: Type A = `dual_dialogue` element; Type B = sequential `dialogue` for v1
