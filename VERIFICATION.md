# Beta verification 0.4.0 — 18 October 2026

## Completed

- `npm ci --ignore-scripts`: completed with the pinned dependency lockfile.
- `npm run build`: bundled editor, syntax worker, and licenses for bundled dependencies.
- `npm test`: all 26 tests passed. Includes 121 edge-case diff pairs and 200 reproducible randomized pairs.
- `npm run test:browser`: passed in Chromium 138.0.7204.0 as a local page. The page loaded from a temporary localhost server and then ran with network access disabled.
- For Python, JavaScript, TypeScript, JSON, and YAML, the browser loaded the supplied correct and broken files, detected the error, transferred the correction, downloaded B, checked exact byte equality with A, exercised undo/redo, reopened the actual download, and verified clean syntax and identical re-exported bytes.
- Existing scenarios passed: diagnostic navigation, stale result invalidation, unsupported language status, manual edits, mixed LF/CRLF/CR and BOM round-trip, format-only edits, empty files, final newlines, file limits, inert source text, compact layout, clear session.
- No external HTTP(S) requests or uncaught page errors during the browser scenarios.
- Difference overview: 240-line synthetic files show A/B line ranges, jump to a distant block, apply only the selected modification or deletion, and undo to byte-identical B. Font selection changes the rendered code size.
- Two user-supplied Python files were compared locally: four change blocks were listed; restoring the deleted function preserved all other differences, and undo restored exact B bytes. The files and private screenshots are excluded from this repository and its archives.
- Five range tests cover inserted/deleted lines, EOF, empty files, line breaks, inline edits and Unicode.
- English UI screenshots inspected at desktop and 900px widths. No page-wide horizontal overflow at 900px. Store assets use only synthetic examples.

The user separately confirmed Python and JavaScript syntax correction in the installed 0.2.0 pilot. This does not replace installation checks for 0.4.0.

## Remaining gates

- The available Chromium binary does not load extensions, so this environment verified the packaged page and worker, not a full installed MV3 extension. Downloading the Playwright Chromium distribution failed because the received archive was incomplete/invalid. No successful installed-extension run is claimed.
- The previous 0.3.0 commit passed installed-extension CI in Chromium 151: https://github.com/donjonson-hash/code-compare-local/actions/runs/39114130941 . This is historical evidence only. The 0.4.0 branch still needs its own remote CI run after upload. The job uses `REQUIRE_EXTENSION=1`, so it cannot silently fall back to a local page.
- Before publishing: install 0.4.0 in a normal desktop browser and check the extension toolbar action, clipboard, download UI, and reopen workflow. Firefox and mobile are outside this release.
- Store submission and a public privacy/support URL are not completed.

## Reproduce

```sh
npm ci
npm run build
npm test
npx playwright install chromium
REQUIRE_EXTENSION=1 npm run test:browser
npm run package
```

For local-page checks with an existing Chromium executable, omit `REQUIRE_EXTENSION` and set `CHROMIUM_EXECUTABLE`. Optional `PLAYWRIGHT_MODULE` and `TEST_OUTPUT` override the module path and temporary output directory. Browser profiles and internal test screenshots are excluded from distribution archives.

The installation archive has `manifest.json` at its root. The source archive contains code, pinned dependencies, CI, documentation, synthetic examples, and store materials; it excludes installed dependencies and browser profiles.
