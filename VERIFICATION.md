# Verification — 0.9.0 candidate and accepted 0.8.0

## 0.9.0 local checks — 20 October 2026

- Build passed; all 53 unit tests passed, including installation/update lifecycle and localized manifest validation.
- Full browser suite passed in local-page Chromium 138.0.7204.0, including welcome links, one-time example launch, narrow layout and preserving B/Undo when opening help. Installed-extension CI is the remote PR gate.
- Store screenshots were captured from the current English interface with synthetic files; welcome fits a 1280×800 frame and a 375 px viewport without horizontal overflow.
- All 22 metadata catalogs resolve the manifest fields within name/short-description limits.
- The store kit contains 22 full descriptions, metadata, all five icon sizes, three screenshots, two promotional images and submission instructions.
- ZIP integrity, payload/working-file equality, embedded SHA-256 checksums, PNG dimensions and transparent 96×96 artwork inside the 128×128 store icon were checked.
- Full descriptions were reviewed for consistent capabilities and limits; native-speaker review of every translation has not been performed.
- The editor and welcome page remain English. No new permissions, dependencies, telemetry, persistent session storage or code-processing service.
- 0.9.0 is a candidate, not a newly accepted/tagged release or a store submission.

## Historical 0.8.0 comparison checks — 20 October 2026

## Completed locally

- `npm run build`: the guarded merge adapter applied to pinned 6.12.2, with original licenses and a local-modification notice retained.
- `npm test`: all 51 tests passed. Build guards reject changed upstream code/version, double application and silent omission of the adapter.
- Targeted browser regression: a 350-line repeated-text fixture produces the same seven visible blocks after direct loading and keyboard editing. The identical check fails against the old 0.7.0 ZIP, which produces four blocks on the edited route.
- Equivalent A-edit and B-edit routes match fresh-load card text, line ranges and block counts. Insertion caret/focus, keyboard history in A, B toolbar history and source contents survive recalculation.
- Actual downloads match the expected B bytes after edits, Undo/Redo and all-copy/Undo. No user-uploaded code is part of this synthetic regression corpus.
- `npm run test:browser`: the complete offline suite passed in local-page Chromium 138.0.7204.0. This is not an installed-extension result.
- Existing selected-block/replay/stale checks, review progress, BOM/mixed line endings, five-language syntax correction/download/reopen, context folding, whitespace, limits and visible controls passed.
- Normal and rapidly advancing clocks still produce identical comparison results and downloaded files.
- No external HTTP(S) requests or uncaught page errors in the passing full browser run.

## Acceptance and remote gate

Version 0.8.0 was accepted by the user on 20 October 2026 after transfers,
Undo/Redo and Download B. The submitted A/B outputs matched byte for byte and
both parsed as Python. These files were checked locally and were not committed.
PR #6 merged at `dccd0c25ed0cd11514e6fb55e76470e02e3bbabb`; the user pushed
`v0.8.0` at that commit.

Installed-extension checks passed on the PR head and on main:
https://github.com/donjonson-hash/code-compare-local/actions/runs/39408116810
The workflow requires `REQUIRE_EXTENSION=1`, so it cannot silently fall back to
a local page. The 0.8.0 store preparation used synthetic JavaScript files only.
That preparation changed documentation and assets only. The subsequent 0.9.0
candidate adds welcome behavior and metadata as described above. No store submission is claimed.

## Scope and cost

`DETERMINISM.md` defines `canonical-full-v1`: identical normalized A/B, pinned
code and policy yield identical difference ranges irrespective of edit history.
Original line endings/BOM, review decisions and asynchronous diagnostics are
separate state. Repeatable grouping is not a promise of minimal differences.

Full comparison costs more than an incremental update on some files. Local
synthetic Chunk.build samples ranged from about 1.6 ms for 4,000 lines with three
far-apart changes to about 23 ms for 3,999 short lines with every twelfth changed.
These are desktop observations, not end-to-end browser or slow-device guarantees.
The existing character/line limits and fixed search-depth fallback remain.

No new runtime dependency, permission, network call or persistent code storage.
The adapter changes bundled library source at build time only; it does not edit
node_modules or monkey-patch methods in the running extension. Dependency upgrades
must review and update its source/version guard explicitly.

## Reproduce

```sh
npm ci
npm run build
npm test
npx playwright install chromium
REQUIRE_EXTENSION=1 npm run test:browser
npm run package
```

For local-page fallback omit `REQUIRE_EXTENSION` and set `CHROMIUM_EXECUTABLE`.
`TEST_OUTPUT` controls temporary screenshots/profiles, excluded from archives.
The installation archive has `manifest.json` at its root.
