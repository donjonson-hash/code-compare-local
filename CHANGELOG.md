# Changelog

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
