# QA Tool — Reference

> Internal maintainer tooling for verifying `data/obsession.json` against the PDF.
> **Not deployed.** Reader prod app is unaffected.

---

## Goal

Verify the full screenplay is present and correctly structured — nothing dropped, mangled, or misclassified — then fix issues and commit data separately from tooling code.

---

## What's built

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

**Deep link:** `/qa?page=N` jumps to a page.

**Suspected gaps:** After normalization (hyphens, PDF line-break splits like `wonde red` → `wondered`), remaining token diffs appear as **Suspected gaps**. Each gap has **Show on PDF** (red) and **Looks fine** (dismiss for this browser). Dismissals live in `localStorage` only.

**Linked highlighting:** Click an extracted card → amber fill on the matching PDF region. Each element stores `rawLineStart` / `rawLineEnd` (indices into `obsession.raw.json` page lines), refreshed automatically on **`pnpm extract`** and **QA Save**. Falls back to sequential fuzzy match when anchors are missing. PDF overlay uses percentage positioning so highlights track CSS-scaled canvas (`max-w-full`).

**Refresh manually:** `pnpm refresh-highlights` — re-anchors all elements without re-extracting.

**Key files:**

| Path | Role |
|------|------|
| `lib/qa-compare.ts` | Shared word-compare logic (CLI + visual rescore) |
| `lib/qa-element-lines.ts` | Element → raw line indices + PDF bboxes |
| `lib/qa-normalize.ts` | Word normalization for compare |
| `lib/qa-gaps.ts` | Suspected-gap detection |
| `scripts/qa.ts` | CLI entry |
| `scripts/qa-save.ts` | Save pipeline (searchText, moments, beats, validate) |
| `src/qa/QaPage.tsx` | Main UI |
| `src/qa/PdfPane.tsx` | PDF render + highlight overlay |
| `src/qa/ExtractedPane.tsx` | Element list (click to select) |
| `src/qa/ElementEditor.tsx` | Edit panel by element type |
| `vite.config.ts` | Dev middleware: `/__qa/source.pdf`, `/__qa/raw.json`, `POST /__qa/save` |
| `src/router.tsx` | `/qa` route registered only when `import.meta.env.DEV` |

**CLI baseline (Jun 2026):** 98 OK · 0 WARN · 0 FAIL · 1 SKIP (title page)

Pipe CLI to file: `pnpm qa > qa-report.txt`

---

## What CLI catches vs visual

| Issue | CLI | Visual |
|-------|-----|--------|
| Missing words / lines | ✅ | ✅ |
| Wrong spacing (`a"poor`) | ❌ | 👁️ manual |
| Misclassification (dialogue → action) | ❌ | 👁️ type badge + highlight |
| All words present, wrong element type | ❌ | 👁️ manual |
| Dropped transitions (`SMASH CUT TO:`) | ✅ | 👁️ transition element + highlight |

**Known pattern (fixed on page 3):** Classifier split Nicky voicemail — dialogue tail landed in a separate action element while word score stayed OK. Fix: merge text into correct element (segments for mid-speech asides), delete orphan, Save.

---

## Team decisions (locked)

1. **Save model:** Whole-file save (atomic write of `obsession.json`).
2. **Dual dialogue:** Editable (both tracks: character + segments).
3. **`meta.version`:** Bump on every save (invalidates reader `localStorage` progress).
4. **Git:** Data fixes and tooling code in **separate commits**.
5. **Deploy:** Visual tool stays **dev-only**; no prod route, no PDF in deploy.

---

## Editor capabilities

**Read-only visual:** split pane, page nav, OK/WARN/FAIL badge, linked highlighting.

**Edit + save:** in-memory edits, dirty state, live page rescore, `POST /__qa/save` → rebuild searchText/moments/beats, write `data/` + `public/data/`, validate.

**Structural edits:**

- **Delete** — confirmation in editor; removed on Save
- **Convert type** — dropdown (action, dialogue, scene_heading, transition); text preserved
- **Add element** — inserts after selection or end of page
- **Reorder** — drag ⋮⋮ on extracted cards (within page) and segment handles in dialogue editor

**Editor fields:**

| Type | Fields |
|------|--------|
| `action` | `text` |
| `scene_heading` | `text`, optional **Transition** field (creates/updates preceding `transition` element) |
| `transition` | `text` |
| `dialogue` | `character`, `segments[]` (`speech` \| `parenthetical`) |
| `dual_dialogue` | per-track `character`, `segments[]` |
| `title_card` | `title`, `author`, `subtitle` (rare) |

**Workflows:**

- **Delete:** paste misclassified text into the correct element → Delete orphan → Save. Or convert type in place.
- **Convert:** select element → **Element type** dropdown → confirm → fill character/segments → Save.
- **Reorder:** drag handles → Save (beats/moments follow element order).

**Highlight caveats:**

- Anchors recomputed on extract/save; unsaved edits still highlight stored or fuzzy-matched regions
- Match fallback is fuzzy (75% element word coverage) when anchors cannot be resolved

---

## Recommended workflow

```bash
pnpm qa                           # sanity check — expect 98 OK, 0 WARN
pnpm dev                          # open /qa?page=N if investigating
# compare PDF | extracted — click cards to link-highlight
# edit → Save
pnpm validate
git commit -m "fix: correct dialogue on page 3" -- data/ public/data/
```

Keep tooling commits separate:

```bash
git commit -m "feat: add QA visual editor" -- src/qa/ lib/ scripts/ vite.config.ts docs/QA-TOOL.md
```

---

## Architecture

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

**Re-extract:** `pnpm extract` overwrites structured JSON but saves `data/obsession.v{N}.backup.json` first and bumps `meta.version`. Re-extract overwrites QA hand fixes — coordinate before running on a hand-tuned JSON.

---

## Related docs

- [PLAN.md](./PLAN.md) — data model, reader architecture, shipped status
