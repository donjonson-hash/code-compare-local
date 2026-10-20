# Canonical comparison pilot 0.8.0 — 20 October 2026

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

Version 0.7.0 was accepted by the user and tagged `v0.7.0` on main. This 0.8.0
pilot still needs the user's own-file acceptance. The GitHub `Beta checks`
workflow requires `REQUIRE_EXTENSION=1`, so it cannot silently fall back to a
local page. Consult the pilot pull request checks for the exact installed-
extension commit/result. This document records local results before upload.
Store materials remain the prepared 0.5.0 set; no store submission is claimed.

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
