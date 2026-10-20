# Deterministic operations — comparison policy and transfers

The 0.6.1 pilot introduced checked, versioned block transfers and was verified
against the user's corrected B file: it matched A byte-for-byte. The 0.7.0 pilot
adds a clock-independent comparison policy. It does not implement a shared
plugin API or LLM integration. Store materials remain the prepared 0.5.0 set.

## Operation map

| Operation | Inputs and rules | Result / boundary |
| --- | --- | --- |
| Decode a file | UTF-8, optional BOM; explicit byte/character/line limits | Raw text, BOM, preferred line ending; unsupported input is rejected |
| Compare | LF-normalized UTF-16 text; pinned CodeMirror version and diff configuration | Difference blocks under `clock-independent-v1`; fixed search-depth fallback, no elapsed-time cutoff; incremental updates also depend on previous chunks and edits |
| Prepare a block transfer | A and B snapshots, content revisions, selected chunk, caller-provided command ID | Immutable schema-v1 proposal; no editor mutation |
| Check a proposal | Exact snapshots/revisions, ranges, expected text and consumed IDs | Ready candidate or explicit rejection; no editor mutation |
| Commit a proposal | Accepted candidate and normalized editor changes | One isolated CodeMirror transaction; consume ID only after successful commit |
| Undo / redo | CodeMirror history with raw-document restoration | Exact raw contents/BOM and review-state restoration; a new content revision |
| Syntax check | Selected language, pinned parser and source text | Diagnostics within parser coverage; not a runtime or type-correctness guarantee |
| Download B | Raw B plus its BOM flag, UTF-8 encoder | Saved bytes; filename and browser download location are outside the text transformation |

The transfer contract guarantees repeatable **evaluation of a specified proposal**
for the same inputs, revisions and consumed-ID set.

## Comparison policy — stage 2

`src/diff-policy.mjs` defines `clock-independent-v1`: a frozen CodeMirror
configuration with `scanLimit: 1500` and `timeout: 0`. The installed dependency
remains pinned in the lockfile. The UI and comparison/transfer tests share this
policy. Changing dependency versions or policy can change grouping and requires
review of the regression corpus.

The former 100 ms cutoff made grouping depend on elapsed wall-clock time.
The new policy retains the existing search-depth cutoff and deterministic
fallback for difficult regions. `scanLimit` bounds detailed search per
subproblem; it is not a hard limit on total operations or milliseconds. Existing
200,000-character / 4,000-line input limits remain enforced. Where the library
reports reduced precision, the UI retains the grouped label. Its precision flag
is not a promise of a minimal diff: some very-large-range fallback paths return
a single block without lowering that flag. Transfers must still reconstruct
the expected contents without loss.

Guarantees with pinned code and the same policy:

- A full `Chunk.build(A, B)` returns the same ranges and precision flags without
  consulting the clock.
- An incremental update returns the same result for the same previous chunks,
  documents and change set. A replay of the same edit trace is repeatable.
- CPU load and forward/backward wall-clock jumps do not select a different
  fallback branch.

**Boundary:** CodeMirror updates only affected regions and retains existing
chunks. Different edit histories can produce different grouping for the same
final A/B. This stage does not promise a canonical, history-independent grouping.
No private editor APIs are patched to force one. A later stage can evaluate a
canonical full-comparison adapter separately from editor history and selection.
Syntax-worker timeouts and asynchronous UI scheduling are also outside this
comparison guarantee. No guarantee about runtime or type correctness is added.

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
