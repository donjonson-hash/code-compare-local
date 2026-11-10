# Compare Code website launch

Updated: 10 November 2026. Scope: **website only**; extension release work and
PR #8 remain outside this launch. The installed-extension tests guard the shared
core and do not represent a Chrome Web Store release.

## Current production

- Origin: [https://comparecode.pro](https://comparecode.pro) (without www).
  Workspace: [https://comparecode.pro/app.html](https://comparecode.pro/app.html).
- PR [#10](https://github.com/donjonson-hash/code-compare-local/pull/10) and
  [#11](https://github.com/donjonson-hash/code-compare-local/pull/11) are merged.
  Released main revision: `77abda4675b9f592df92854af85111ac3d231483`.
- Production deployment: `dpl_9KzzWEjqMzJrBCmLu1TQAuAngBas`.
- Tested tree: `f3d13a85e5a42b0af195a1ceb8c7811e4a25316a`.
  [CI 42788850553](https://github.com/donjonson-hash/code-compare-local/actions/runs/42788850553)
  passed 92 unit tests and the full website and installed-extension Chromium suites.
- Production HTTP/HTTPS and www redirects were verified. Production bundle SHA
  hashes match the tested CI artifacts exactly.

These are the completed production checks for the released revision. The WebKit/Linux
verification below is now complete. Native Safari/macOS verification and Search
Console submission remain unconfirmed.

## Shipped source and behavior

- Compare Code branding on the home page, workspace, Privacy and Support.
- Absolute canonical URLs, descriptive titles and descriptions; social metadata
  on the home page. `sitemap.xml` lists the home, privacy and support pages.
- The interactive workspace uses `noindex,follow`. `robots.txt` permits crawling
  so a crawler can read that directive. The demo query is consumed on entry.
- Help links from the workspace open a new tab without replacing live edits.
- Privacy describes application-local processing separately from hosting logs.
- Save/Open session uses a downloaded JSON file containing both texts, filenames,
  language, view settings and remaining Keep B marks. Undo/Redo history is omitted;
  there is no automatic recovery or browser-storage persistence.
- Syntax before & after compares the A/B diagnostics. Preview fix supports five
  conservative punctuation repairs: JSON trailing comma removal, missing JSON
  object-member comma, missing JSON key colon, JavaScript/TypeScript rest-element
  trailing comma removal, and a missing Python header colon. A candidate must pass
  another parser check; Python remains preliminary. Insertions exceeding the
  200,000 UTF-16-unit editor limit are rejected before candidate validation.
- `npm ci`, `npm run build`, `npm run build:web` produce `dist/client`.
  The web output excludes the extension-only `PRIVACY.md` and all source/tests.

## Hosting configuration

The deployed `vercel.json` selects the static web output, rebuilds the runtime
from source and configures permanent redirects from www to the apex and
`/index.html` to `/`. URLs retain their `.html` suffixes, matching page links and
canonicals. Production verification above is the evidence of live behavior;
configuration alone is not a deployment check.

Use Node 24 for the pinned dependencies. For later releases, use the existing
project, deploy the CI-verified revision as a preview, verify its pages and worker,
then promote the tested deployment. The configuration makes no registrar changes
and contains no deployment credentials.

## Completed WebKit verification on Linux

The full website suite passed in WebKit 26.5/Linux at
`40eb611f599c232f94769207734d112f0c580c93`:
[successful job](https://github.com/donjonson-hash/code-compare-local/actions/runs/42793697775/job/129753300229).
Coverage includes file load/download/reopen, exact UTF-8/BOM/mixed-EOL bytes,
edits and Undo/Redo, sessions, syntax comparison, quick-fix previews and stale
modal guards, canceled navigation, and narrow viewports. No functional assertions
were skipped. The successful run recorded no app HTTP(S) attempts and no worker
cache replays. The CI job is `Website / WebKit`; run it locally after installing
WebKit with `npm run test:web:webkit`.

This result is not a native Safari/macOS or iOS test, or proof of their offline
behavior. Those environments remain unverified.

### WebKit test environment

The pinned WebKit runner rejects local `File.arrayBuffer()` reads when Playwright
`setOffline(true)` is enabled. The isolated `tests/file-read-probe.mjs` diagnostic
measured 12 combinations of online/offline, input reset timing and buffer/disk
uploads: all six online cases preserved the exact bytes; all six offline cases
failed with `NotReadableError`. This happened without application code.
The diagnostic can be rerun with `node tests/file-read-probe.mjs` after installing
Playwright WebKit; it reports observations and does not waive the full suite.

WebKit therefore uses HTTP(S) request blocking after initial page load. Because
[Playwright routing disables HTTP cache](https://playwright.dev/docs/api/class-browsercontext#browser-context-route),
the test replays only an exact GET for the already-loaded syntax worker from the
same local build. Other requests are rejected; independent probes verify the
blocker. The result distinguishes this mode from Chromium's offline emulation.
It is not proof of native Safari offline behavior or of offline page reloads.

Search Console remains a separate pending action: submit
`https://comparecode.pro/sitemap.xml` in the verified property. No submission has
been performed.

## Historical context: 9 November 2026

Before source recovery and production deployment, the private Sites prototype
was version 2 of project `appgprj_6ae6ee1e8a588191939479c0f828f6bf` without a custom
domain. Its source checkout failed to resolve `git.chatgpt-team.site`, and Vercel
inventory access was denied for the then-selected team. No production deployment
was made during that initial inspection. Those access and publication notes are
historical; they do not describe the current production state above.

Configuration references:
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/routing/redirects/configuration-redirects
