# Clock-independent comparison pilot 0.7.0 — 20 October 2026

## Completed locally

- `npm run build`: editor and syntax worker bundled using unchanged pinned dependencies.
- `npm test`: all 49 tests passed, including 3 new comparison-policy tests.
- Full comparisons retain their ranges and precision flags under frozen, jumping and unavailable clocks; interleaving a grouped comparison does not leak its state.
- The same incremental A/B edit and undo trace produces the same intermediate results under those clocks.
- Depth-limited and large-range fallback transfers reconstruct source contents without losing the target BOM.
- `npm run test:browser`: the complete offline suite passed in local-page Chromium 138.0.7204.0. This is not an installed-extension result.
- The real UI compares 120 changed JavaScript lines under normal and rapidly advancing clocks. Visible grouping/cards match, the untouched download remains B, and Use A downloads A exactly.
- Existing five-language correction/download/reopen, stale/replayed proposals, Undo/Redo, review progress, whitespace, context folding and limits passed.
- Visible controls remain checked at 1440, 1280, 1100 and 900 × 720 before clicks, followed by double-click Use A → Undo → Redo and download-byte assertions.
- No external HTTP(S) requests or uncaught page errors in the passing browser run.

## Prior acceptance and remaining gate

The user's corrected B file from the 0.6.1 pilot matched the original A
byte-for-byte and compiled successfully with Python 3.12.14. Uploaded file
contents are not included in the repository or this regression corpus.

The GitHub `Beta checks` workflow requires `REQUIRE_EXTENSION=1`; it cannot
silently fall back to local-page mode. Consult this stage's pull request checks
for the exact tested commit and installed-extension status. This document
records local results before upload. The 0.7.0 pilot has not yet received the
user's own-file acceptance. Store materials still describe 0.5.0.

## Scope

`DETERMINISM.md` defines `clock-independent-v1` and its boundary: a full build,
or the same incremental history, no longer depends on wall-clock time. Different
edit histories can still group identical final documents differently. Search
depth is bounded, not total elapsed time. The library precision flag is not a
minimal-diff guarantee. Syntax-worker timeout behavior is outside this stage.
No new dependencies, network calls, permissions or persistent code storage.

## Reproduce

```sh
npm ci
npm run build
npm test
npx playwright install chromium
REQUIRE_EXTENSION=1 npm run test:browser
npm run package
```

For the local-page fallback omit `REQUIRE_EXTENSION` and set
`CHROMIUM_EXECUTABLE`. `TEST_OUTPUT` controls temporary screenshots/profiles.
Distribution archives exclude dependencies, browser profiles and other ZIPs.
The installation archive has `manifest.json` at its root.
