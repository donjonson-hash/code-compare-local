# Deterministic transfer pilot 0.6.0 — 20 October 2026

## Completed locally

- `npm run build`: bundled editor, syntax worker, and third-party notices with the existing pinned dependencies.
- `npm test`: all 46 tests passed, including 11 proposal-validation tests and the existing diff, byte-preservation, review-state and syntax tests.
- `npm run test:browser`: the complete offline suite passed in local-page Chromium 138.0.7204.0. This local run is not an installed-extension check.
- New end-to-end checks replay a consumed list button and inline arrow, edit A/B after a proposal is displayed, reload B with unchanged visible text but different BOM/line endings, apply a fresh proposal, and double-click the selected-block action. Each scenario checks actual downloaded B bytes.
- Undo/Redo restores both the expected raw document and review progress. An old command remains consumed after Undo; a fresh proposal can be applied normally.
- The real long-file regression covers signed relative CodeMirror change offsets for deleted lines, while absolute positions remain bounded.
- Existing five-language correction/download/reopen, syntax navigation, collapsed context, whitespace display, limits, compact layout and clear-session checks passed.
- No external HTTP(S) requests or uncaught page errors during the passing browser run.

## Remote and manual gates

The GitHub `Beta checks` workflow runs with `REQUIRE_EXTENSION=1` and cannot
silently fall back to local-page mode. Consult this pilot pull request's checks
for installed-extension status and the exact tested commit. This document records
the local results before upload and does not claim a remote result in advance.

The user confirmed the previous 0.5.0 behavior on 19 October 2026. The 0.6.0
pilot still needs the user's own-file acceptance before replacing that baseline.
Store materials in `store/` describe 0.5.0; no 0.6.0 store submission is claimed.

## Scope and known boundary

The contract and operation map are in `DETERMINISM.md`. This pilot validates
application of an explicit versioned block proposal. The existing time-limited
diff grouping is not claimed to be fully deterministic. No external plugin API,
LLM call, new permission, dependency or persistent source storage is introduced.

## Reproduce

```sh
npm ci
npm run build
npm test
npx playwright install chromium
REQUIRE_EXTENSION=1 npm run test:browser
npm run package
```

For the local-page fallback, omit `REQUIRE_EXTENSION` and set
`CHROMIUM_EXECUTABLE`. `TEST_OUTPUT` controls temporary profiles/screenshots;
they are excluded from distribution ZIPs. Test files are synthetic.

The beta archive has `manifest.json` at its root. The source archive includes
implementation, tests and the contract; it excludes installed dependencies,
browser profiles and generated archives.
