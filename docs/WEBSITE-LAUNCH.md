# Compare Code website launch

Updated: 10 November 2026. Scope: **website only**; extension release work and
PR #8 remain outside this launch. The installed-extension tests guard the shared
core and do not represent a Chrome Web Store release.

## Current production

- Origin: [https://comparecode.pro](https://comparecode.pro) (without www).
  Workspace: [https://comparecode.pro/app.html](https://comparecode.pro/app.html).
- PR [#10](https://github.com/donjonson-hash/code-compare-local/pull/10) and
  [#11](https://github.com/donjonson-hash/code-compare-local/pull/11) are merged.
  Main: `77abda4675b9f592df92854af85111ac3d231483`.
- Production deployment: `dpl_9KzzWEjqMzJrBCmLu1TQAuAngBas`.
- Tested tree: `f3d13a85e5a42b0af195a1ceb8c7811e4a25316a`.
  [CI 42788850553](https://github.com/donjonson-hash/code-compare-local/actions/runs/42788850553)
  passed 92 unit tests and the full website and installed-extension Chromium suites.
- Production HTTP/HTTPS and www redirects were verified. Production bundle SHA
  hashes match the tested CI artifacts exactly.

These are the completed production checks. WebKit/Linux and native Safari/macOS
have not yet passed verification, and Search Console submission has not been done.

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

## Active next step: WebKit on Linux

Run website automation in WebKit on Linux, covering file load/download/reopen,
exact UTF-8/BOM/mixed-EOL preservation, edits and Undo/Redo, sessions, syntax
comparison, quick-fix previews and stale-dialog guards, navigation and narrow
viewports. Record the tested revision and CI result. This work is **not yet
complete**. WebKit/Linux automation is not a native Safari/macOS or iOS test;
those environments remain unverified.

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
