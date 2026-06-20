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

**Linked highlighting:** Click an extracted card → amber fill on the matching PDF region. Mapping uses fuzzy word match against raw line text + bboxes from `obsession.raw.json` (loaded in memory for scoring; not shown in UI). PDF overlay uses percentage positioning so highlights track CSS-scaled canvas (`max-w-full`).

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
| Dropped transitions (`SMASH CUT TO:`) | ❌ | 👁️ raw pane (no element) |

**Known example:** Page 3, `el-015` / `el-016` — Nicky voicemail split; dialogue tail misclassified as action. Word score can still be OK. Highlight on `el-015` covers only the dialogue portion, not the misclassified action tail.

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

- Match is fuzzy (75% element word coverage); fails if edited text drifts far from raw
- Orphan raw lines (e.g. `SMASH CUT TO:`) have no element — no highlight until READ-002
- Long-term improvement: store `rawLineStart`/`rawLineEnd` at extract time

**Editor fields (v1):**

| Type | Fields |
|------|--------|
| `action` | `text` |
| `scene_heading` | `text` |
| `dialogue` | `character`, `parenthetical`, `lines[]` |
| `dual_dialogue` | per-track `character`, `parenthetical`, `lines[]` |
| `title_card` | `title`, `author`, `subtitle` (rare) |

### Phase D — Review workflow

- [ ] `localStorage` reviewed/fixed page tracking
- [ ] "Mark page reviewed" checkbox
- [ ] CLI output hints: `Open /qa?page=N` for WARN pages
- [ ] Optional: link from reader dev footer to `/qa` (dev only)

### Phase E — Structural fixes

- [x] Delete element (with confirmation) — copy text to neighbor, then delete orphan
- [ ] Dialogue segments schema (SCHEMA-001) — speech/parenthetical blocks in one element
- [ ] Change element type (QA-006)
- [ ] Classifier: dialogue wrap at left margin (EXTRACT-001) — manual QA fixes first; re-extract only with care

**Delete workflow (el-015 / el-016 pattern):** paste misclassified text into the correct element → Delete the orphan → Save. Save regenerates beats/moments; element IDs may gap (el-015, el-017, …).

---

## Backlog (QA / extract)

| ID | Status | Ticket |
|----|--------|--------|
| **QA-005** | ✅ Done | **Delete element** — confirmation in editor; removed on Save |
| **QA-006** | Todo | **Change element type** — e.g. action → dialogue without merge |
| **EXTRACT-001** | Todo | **Dialogue wrap at left margin** — `parseDialogue` breaks when wrapped line hits `x0 < 120`, tail misclassified as action. Fix classifier for future extracts; do not re-run full extract until QA hand-fixes are merged or backed up |
| **SCHEMA-001** | Todo | **Dialogue segments** — `segments: [{ kind: speech \| parenthetical, text }]` replaces single `parenthetical` + `lines[]` for mid-speech asides. Example: page 3 `(some movement)` + `God damn it.` inside Nicky voicemail. Full spec in [PLAN.md](./PLAN.md#schema-001--dialogue-segments-spec). Implement migration before EXTRACT-001 re-extract. |

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

**Do not** re-run full `pnpm extract` after manual QA edits unless you have a merge strategy — extract would overwrite hand fixes.

---

## Open questions (for future brainstorms)

- Auto-strip printed page numbers from raw compare (reduce false WARN noise)?
- Type heuristic: flag `action` blocks that start mid-sentence lowercase after dialogue?
- Export QA session log (which pages reviewed, what changed)?
- Extract-time raw line provenance for bulletproof highlighting after edits?

---

## Related docs

- [PLAN.md](./PLAN.md) — data model, element types, reader backlog (READ-001–003)
