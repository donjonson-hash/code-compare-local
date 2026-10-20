# Changelog

## 0.9.0 — Welcome and localized store kit (candidate)

- Open a local getting-started page on first install; updates remain quiet.
- Launch the existing example explicitly and open help without replacing edits.
- Add localized manifest metadata and full store descriptions for 22 locales; the editor and welcome remain English.
- Complete 16/32/48/64/128 icons, three screenshots, small and marquee promos, and bootcamp submission materials.
- Keep comparison, transfer, syntax-check algorithms and offline/session behavior unchanged.

## 0.8.0 — 20 October 2026

- Rebuild all difference blocks from current A/B after document edits, transfers and Undo/Redo, removing grouping dependence on edit history.
- Keep editor instances, selection, raw-document effects and history through the original transaction delivery.
- Guard the narrow build-time merge adapter by dependency version, full source hash and exact-once application; disclose the local modification in license notices.
- Retain the fixed search-depth budget, file limits and existing transfer validation.

## 0.7.0 — 20 October 2026

- Share a versioned, clock-independent comparison policy across the editor and core tests.
- Remove the 100 ms wall-clock cutoff while retaining the fixed search-depth limit and grouped fallback.
- Document the incremental-history boundary: identical final files are not promised identical grouping after different edit histories.
- Preserve existing transfer proposals, raw-byte Undo/Redo, syntax checks and visible controls.

## 0.6.1 — 20 October 2026

- Group Use A, Keep B, Undo, Redo and Download B above the editors; add visible Undo/Redo labels.
- Prevent compact difference cards from shrinking and clipping their action buttons.
- Keep the pilot version visible in narrower windows.
- Test control visibility before scrolling at laptop sizes, then double-click Use A, Undo, Redo and verify downloaded bytes.

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
