# Deterministic operations — comparison policy and transfers

Version 0.8.0 is the accepted baseline (tag `v0.8.0`). It adds
canonical full comparison after every document-changing transaction. It keeps
versioned transfers, raw-byte history, and the existing editor instances.
It does not introduce a plugin API or LLM integration. Store materials in
`store/` now describe 0.8.0; no store submission or approval is claimed.

## Operation map

| Operation | Inputs and rules | Result / boundary |
| --- | --- | --- |
| Decode a file | UTF-8, optional BOM; explicit byte/character/line limits | Raw text, BOM, preferred line ending; unsupported input is rejected |
| Compare | LF-normalized UTF-16 text; pinned CodeMirror version and diff configuration | Canonical difference blocks under `canonical-full-v1`; full comparison of current normalized A/B, fixed search-depth fallback, no elapsed-time cutoff |
| Prepare a block transfer | A and B snapshots, content revisions, selected chunk, caller-provided command ID | Immutable schema-v1 proposal; no editor mutation |
| Check a proposal | Exact snapshots/revisions, ranges, expected text and consumed IDs | Ready candidate or explicit rejection; no editor mutation |
| Commit a proposal | Accepted candidate and normalized editor changes | One isolated CodeMirror transaction; consume ID only after successful commit |
| Undo / redo | CodeMirror history with raw-document restoration | Exact raw contents/BOM and review-state restoration; a new content revision |
| Syntax check | Selected language, pinned parser and source text | Diagnostics within parser coverage; not a runtime or type-correctness guarantee |
| Download B | Raw B plus its BOM flag, UTF-8 encoder | Saved bytes; filename and browser download location are outside the text transformation |

The transfer contract guarantees repeatable **evaluation of a specified proposal**
for the same inputs, revisions and consumed-ID set.

## Comparison policy — stage 3

`src/diff-policy.mjs` identifies `canonical-full-v1`. The diff configuration
remains frozen: `scanLimit: 1500`, `timeout: 0`, with the dependency pinned in
the lockfile. The UI and core comparison tests share this configuration.

Version 0.7.0 removed the wall-clock cutoff but retained incremental grouping.
That allowed different edit histories to produce different blocks for identical
final files. Version 0.8.0 computes `Chunk.build(currentA, currentB, policy)`
after every document-changing transaction batch, including typing, file loads,
block transfers and Undo/Redo. Selection-only/configuration transactions keep
the current blocks because text is unchanged.

For identical **LF-normalized UTF-16 A/B text**, pinned dependency and policy,
block ranges, character-change ranges and precision flags are now identical,
regardless of load order, edit history or system-clock behavior. BOM and original
line endings remain separate raw-document data; a format-only change does not
change these text-difference blocks. The format notice and exact download still
preserve that distinction. History, review decisions, active selection and
syntax-worker timing are separate state and are not promised identical.

### Guarded integration

The pinned MergeView has no public API to replace the chunk state in both
editors while retaining their states. `scripts/canonical-merge-plugin.mjs`
applies one build-time modification to `@codemirror/merge` 6.12.2:

- Check the full upstream distribution SHA-256, version and exact-one target.
- Replace only the incremental chunk calculation inside transaction dispatch
  with full `Chunk.build` on the current pair.
- Preserve the original transaction delivery, shared chunk effects, selection,
  history, raw-document effects and layout scheduling.
- Fail the build if upstream source changes or the adapter is not applied exactly
  once. Never silently fall back to incremental comparison.

No installed dependency file is rewritten and no private method is monkey-patched
at runtime. Third-party notices retain the original license and disclose the
modification. A dependency upgrade requires explicit adapter review.

### Limits

The search-depth cutoff and grouped fallback remain. `scanLimit` bounds detailed
search per subproblem, not total work or milliseconds. Existing 200,000-character
and 4,000-line input limits remain enforced. Full comparison can cost more than
incremental updates on slow devices; no hard latency guarantee is made.

Where the library reports reduced precision, the UI shows the grouped label.
Its precision flag does not promise a minimal diff: some very-large-range
fallback paths return a single block without lowering that flag. Canonical means
repeatable, not necessarily the smallest possible set of changes. Every accepted
transfer must still preserve the expected contents without loss.

## Proposal contract

`prepareBlockTransfer` receives `id`, `source`, `target`, `sourceRevision`,
`targetRevision`, and the selected `chunk`.

- `schemaVersion: 1`, `kind: copy-block-a-to-b`, `origin: user`, and `reason`.
- `id`: session-scoped command identity, independent of wall-clock time/randomness.
- `source` and `target`: detached snapshots of `raw`, `bom`, `eol`, and `revision`.
- `edits`: source and target ranges with expected raw text, and exact raw replacement.
- All ranges use normalized UTF-16 offsets, matching CodeMirror. Expected text
  and replacements retain original line endings. B's BOM remains unchanged.

CodeMirror may express a preceding newline as a negative offset relative to
the chunk. The adapter converts it to an absolute position before checking
nonnegative bounds.

The operation and nested objects are frozen. It can be serialized as JSON;
validation does not rely on object identity. The caller supplies identity and
revision state; preparing the same inputs with the same ID yields the same proposal.

Content revisions increase on accepted document edits, raw-format changes and
document replacement, including Undo/Redo. Async file-load request IDs are
separate: a failed file load must not invalidate otherwise usable proposals.

## Validation and commit

`checkBlockTransfer` is pure. It checks the proposal's shape, supported version,
document snapshots, ranges, expected contents, replacement provenance, and
result limits before returning a candidate. No accepted subset is applied when
another edit fails. A missing match is never repaired by fuzzy search or by
silently creating a new proposal for the latest document.

Statuses: `ready`, `already-applied`, `stale`, `invalid`, `no-change`, and
`limit-exceeded`. Only `ready` may reach the editor transaction.

The UI prepares proposals when it displays the difference list. Every block
button and the selected-block toolbar action uses that displayed proposal.
After commit, the adapter verifies that editor text and the raw document match
the candidate before consuming the ID and recording review progress.

An applied command stays consumed after Undo. The refreshed difference list
creates a new proposal that can be applied deliberately. Replaying an old DOM
button/serialized command cannot reapply it. Inline arrows also capture their
proposal once; the native library mouse handler is blocked to prevent bypass. A pointer double-click on the
selected-block control must not also apply the automatically selected next block.

All proposal snapshots and consumed IDs stay in session memory. They are not
sent anywhere, persisted to storage, or added to downloaded code.

## Acceptance evidence

- Unit checks: repeatability, serialization, detached snapshots, stale A/B,
  format-only changes, replayed IDs, malformed ranges, Unicode, empty insert/delete,
  line endings/BOM, and rejection of an oversized combined result.
- Browser checks: replay the original button, change A or B after preparation,
  reload B with identical visible text but different BOM/line endings, apply a
  fresh proposal, and compare actual downloaded bytes through Undo/Redo.
- Review progress changes only after an accepted transfer. Existing syntax,
  collapse, navigation, and offline scenarios remain in the required CI suite.

See the pull request's CI result for the exact tested commit. This document
describes the contract; it is not a substitute for a successful test run.

## Performance boundary

The initial implementation validates full snapshots for each prepared block.
A bounded synthetic measurement with 334 independently supplied chunks and
3,999 lines took about 0.8 seconds in Node; two large inputs using the actual
diff builder were grouped into one block and took about 5 ms to prepare.
These are local observations, not a browser performance guarantee. Batch
preparation and indexed raw offsets are a possible follow-up if real files
produce many independent chunks; no performance claim is made by this pilot.
