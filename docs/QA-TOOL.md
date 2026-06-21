# QA Tool — Progress & Plan

> Internal maintainer tooling for verifying `data/obsession.json` against the PDF.
> **Not deployed.** Reader prod app is unaffected.

---

## Goal

Verify the full screenplay is present and correctly structured — nothing dropped, mangled, or misclassified — then fix issues and commit data separately from tooling code.

---

## What's built today

### Shipped

| Tool | Command / path | Purpose |
|------|----------------|---------|
| **CLI report** | `pnpm qa` | Page-by-page word comparison: `obsession.raw.json` vs `obsession.json`. Prints OK / WARN / FAIL summary. |
| **Visual reviewer** | `http://localhost:5173/qa` | Dev-only split-pane UI: PDF + extracted JSON + raw lines, edit, save, linked highlighting. |

**Requires (visual):** `pnpm dev` + `obsession-2026.pdf` in repo root + `pnpm extract` (for raw JSON with bboxes).

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Dev QA · page nav · OK/WARN badge · Save · prev/next review │
├──────────────────────────┬──────────────────────────────────┤
│ PDF (canvas)             │ Extracted elements               │
│  + highlight on select   │ (obsession.json) · click to edit │
└──────────────────────────┴──────────────────────────────────┘
```

**Deep link:** `/qa?page=16` jumps to a flagged page.

**Suspected gaps:** After normalization (hyphens, PDF line-break splits like `wonde red` → `wondered`), remaining token diffs appear as **Suspected gaps**. Each gap has **Show on PDF** (red) and **Looks fine** (dismiss for this browser). Dismissals live in `localStorage` only.

**Linked highlighting:** Click an extracted card → amber fill on the matching PDF region. Each element stores `rawLineStart` / `rawLineEnd` (indices into `obsession.raw.json` page lines), refreshed automatically on **`pnpm extract`** and **QA Save**. Falls back to sequential fuzzy match when anchors are missing. PDF overlay uses percentage positioning so highlights track CSS-scaled canvas (`max-w-full`).

**Refresh manually:** `pnpm refresh-highlights` — re-anchors all elements without re-extracting.

**Key files:**

| Path | Role |
|------|------|
| `lib/qa-compare.ts` | Shared word-compare logic (CLI + visual rescore) |
| `lib/qa-element-lines.ts` | Element → raw line indices + PDF bboxes |
| `scripts/qa.ts` | CLI entry |
| `scripts/qa-save.ts` | Save pipeline (searchText, moments, beats, validate) |
| `src/qa/QaPage.tsx` | Main UI |
| `src/qa/PdfPane.tsx` | PDF render + highlight overlay |
| `src/qa/ExtractedPane.tsx` | Element list (click to select) |
| `src/qa/ElementEditor.tsx` | Edit panel by element type |
| `vite.config.ts` | Dev middleware: `/__qa/source.pdf`, `/__qa/raw.json`, `POST /__qa/save` |
| `src/router.tsx` | `/qa` route registered only when `import.meta.env.DEV` |

**CLI baseline (approx.):** 89 OK · 9 WARN · 0 FAIL · 1 SKIP (title page)

**Pages needing review:** 16, 35, 49, 63, 64, 70, 87, 90, 93

Pipe CLI to file: `pnpm qa > qa-report.txt`

---

## What CLI catches vs visual

| Issue | CLI | Visual |
|-------|-----|--------|
| Missing words / lines | ✅ | ✅ |
| Wrong spacing (`a"poor`) | ❌ | 👁️ manual |
| Misclassification (dialogue → action) | ❌ | 👁️ type badge + highlight |
| All words present, wrong element type | ❌ | 👁️ manual |
| Dropped transitions (`SMASH CUT TO:`) | ✅ (READ-002) | 👁️ transition element + highlight |

**Known pattern (fixed on page 3):** Classifier split Nicky voicemail — dialogue tail landed in a separate action element while word score stayed OK. Fix: merge text into correct element (segments for mid-speech asides), delete orphan, Save. Page 3 el-015/el-017 ✅ at v11.

---

## Team decisions (locked for v1)

1. **Save model:** Whole-file save (atomic write of `obsession.json`).
2. **Dual dialogue:** Editable in v1 (both tracks: character, parenthetical, lines).
3. **Merge / split elements:** v1.5 (needed for page-boundary classifier bugs).
4. **`meta.version`:** Bump on every save (invalidates reader `localStorage` progress).
5. **Git:** Data fixes and tooling code in **separate commits**.
6. **Deploy:** Visual tool stays **dev-only**; no prod route, no PDF in deploy.

---

## Phases

### Phase A — Read-only visual ✅

- [x] Split pane: PDF + extracted + raw
- [x] Page navigation + review-page cycling
- [x] OK/WARN/FAIL badge (shared compare logic)
- [x] Fix PDF canvas mount bug
- [x] Commit tooling separately from data

### Phase B — Edit in memory ✅

- [x] Editor drawer/panel on element select
- [x] Editable fields by type (including dual_dialogue)
- [x] Dirty state + unsaved warning on page change
- [x] Live page rescore after edits (client-side `analyzeQaPage`)
- [x] Revert selected element

### Phase C — Save pipeline ✅

- [x] `POST /__qa/save` Vite dev middleware
- [x] `scripts/qa-save.ts` — rebuild searchText, moments, beats, bump version
- [x] Write `data/` + `public/data/`, run validate
- [x] Global Save button + success/error feedback

### Phase C½ — Linked highlighting ✅

- [x] Click extracted card → highlight PDF region
- [x] Fuzzy match element text → contiguous raw lines (`lib/qa-element-lines.ts`)
- [x] PDF overlay aligned to scaled canvas (percentage positioning)

**Highlight caveats:**

- Anchors are recomputed on extract/save; unsaved QA edits still highlight the PDF source region (stored or sequential fuzzy)
- Match fallback is fuzzy (75% element word coverage) when anchors cannot be resolved
- Orphan raw lines without a matching element are rare after READ-002 (transitions captured)
- Long-term improvement: store `rawLineStart`/`rawLineEnd` at extract time

**Editor fields (v1):**

| Type | Fields |
|------|--------|
| `action` | `text` |
| `scene_heading` | `text`, optional **Transition** field (creates/updates preceding `transition` element) |
| `transition` | `text` (also editable directly when selected) |
| `dialogue` | `character`, `segments[]` (`speech` \| `parenthetical`) |
| `dual_dialogue` | per-track `character`, `segments[]` |
| `title_card` | `title`, `author`, `subtitle` (rare) |

### Phase D — Review workflow

- [ ] `localStorage` reviewed/fixed page tracking
- [ ] "Mark page reviewed" checkbox
- [ ] CLI output hints: `Open /qa?page=N` for WARN pages
- [ ] Optional: link from reader dev footer to `/qa` (dev only)

### Phase E — Structural fixes

- [x] Delete element (with confirmation) — copy text to neighbor, then delete orphan
- [x] Dialogue segments schema (SCHEMA-001) — types, migration, reader, QA segment editor
- [x] Transition element type (READ-002) — classifier, migrate script, reader, QA scene-heading field
- [x] Change element type (QA-006) — type dropdown in editor; Add element on page
- [x] Classifier: dialogue wrap at left margin (EXTRACT-001) — wrap-row merge + action-column exit

See [PLAN.md — Current priorities](./PLAN.md#current-priorities-jun-2026) for full stack.

**Delete workflow:** paste misclassified text into the correct element → Delete the orphan → Save. Or use **Element type** dropdown to convert in place (e.g. action → dialogue). **Add** (extracted pane) inserts a new empty element after the selected card, or at end of page if none selected.

**Convert workflow (QA-006):** select element → **Element type** dropdown → confirm → fill character/segments → Save. Text is preserved when converting action ↔ dialogue ↔ scene_heading ↔ transition.

---

## Backlog (QA / extract)

| ID | Status | Ticket |
|----|--------|--------|
| **QA-005** | ✅ Done | **Delete element** — confirmation in editor; removed on Save |
| **QA-006** | ✅ Done | **Change / add element type** — type dropdown in editor (action, dialogue, scene_heading, transition); **Add** menu in extracted pane inserts after selection or end of page. Save regenerates beats/moments. |
| **EXTRACT-001** | ✅ Done | **Dialogue wrap** — same-row left+right speech merge; `endsDialogueForAction` for action column. `pnpm extract` auto-backs up prior JSON. |
| **SCHEMA-001** | ✅ Done | **Dialogue segments** — `segments: [{ kind: speech \| parenthetical, text }]`. Run `pnpm migrate-dialogue-segments` on legacy JSON. |
| **READ-002** | ✅ Done | **Transition directions** — `transition` element type; edit via scene heading QA field. Run `pnpm migrate-transitions`. |
| **READ-001** | Todo | **Inline emphasis** — `*italic*`, `_underline_`, `**bold**`; render in reader + QA; strip delimiters in QA compare. See [PLAN.md — READ-001](./PLAN.md#backlog-ticket-reference). |

---

## Recommended workflow

```bash
pnpm qa                          # terminal report → note WARN pages
pnpm dev                         # open /qa?page=16
# compare PDF | extracted — click cards to link-highlight
# edit → merge text manually → Delete orphan element → Save
pnpm validate
git commit -m "fix: correct dialogue on page 3" -- data/ public/data/
```

Keep tooling commits separate:

```bash
git commit -m "feat: add QA visual editor" -- src/qa/ lib/ scripts/ vite.config.ts docs/QA-TOOL.md
```

---

## Architecture notes

```
obsession-2026.pdf (local, gitignored)
        │
        ▼ extract (pnpm extract)
data/obsession.raw.json ──────► lib/qa-compare.ts ◄── pnpm qa (CLI)
        │         │                      ▲
        │         └────► lib/qa-element-lines.ts (highlight mapping)
        ▼                              │
data/obsession.json ───────────────────┘
        │                    /qa visual tool (dev)
        ▼
public/data/obsession.json → reader app (prod)
```

**Source of truth for fixes:** `data/obsession.json` only. Never edit `obsession.raw.json` by hand (regenerate via extract).

**Re-extract:** `pnpm extract` overwrites structured JSON but saves `data/obsession.v{N}.backup.json` first and bumps `meta.version`. After classifier fixes, prefer re-extract over hand-merging; re-QA WARN pages afterward.

---

## Open questions (for future brainstorms)

- Auto-strip printed page numbers from raw compare (reduce false WARN noise)?
- Type heuristic: flag `action` blocks that start mid-sentence lowercase after dialogue?
- Export QA session log (which pages reviewed, what changed)?

---

## Related docs

- [PLAN.md](./PLAN.md) — data model, element types, reader backlog, **current priorities**
