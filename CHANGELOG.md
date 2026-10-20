# Changelog

## 0.6.0 — 20 October 2026

- Introduced a versioned, immutable A → B block-transfer proposal with exact document snapshots and UTF-16 ranges.
- Validate source/target revisions, raw text, BOM, expected fragments, replacement provenance and result limits before one editor transaction.
- Reject stale proposals and replayed commands; pointer double-clicks cannot consume the next automatically selected block.
- Preserve raw-byte Undo/Redo and review progress. Separate content revisions from asynchronous file-loading cancellation tokens.
- Document the operation map and the pilot boundary: applying an explicit proposal is deterministic; current time-limited diff grouping is not claimed to be fully deterministic.
- Keep the prepared 0.5.0 store materials as the publication baseline.


## 0.5.0 — 19 October 2026

- Only changes mode folds unchanged sections with three context lines and keyboard-accessible expansion.
- Syntax diagnostic navigation reveals complete files, including identical hidden errors.
- Show spaces & tabs adds visual markers without changing content or comparison semantics.
- Space/tab-only changes receive an explicit, neutral label.
- Keep B and Use A track review progress and advance to the next unreviewed block.
- Use A undo/redo restores review progress; manual edits invalidate stale review decisions.
- No LLM, network requests or persistent session storage added.

## 0.4.0 — 18 October 2026

- Difference sidebar lists changed line ranges for both A and B, with insert/delete anchors.
- Select any change to reveal its location in both editors; Previous/Next cycles through the list.
- Use A transfers only the selected block; undo preserves exact original bytes.
- Automatically reveal the first difference after loading two nonempty files.
- Larger interface text and selectable code sizes: 14, 16 (default), 18 and 20 px.
- Responsive comparison layout, with the difference list above the editors on narrower screens.
- Added range and browser regression checks for long files, per-change application and font size.

## 0.3.0

English beta, local syntax checks, byte-preserving download and undo, CI,
synthetic examples and store materials.
