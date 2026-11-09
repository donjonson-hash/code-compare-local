# Anime Studio integration

## Provenance

Recovered on 2026-11-09 from the owner's existing published prototype:
https://code-compare-local-studio.doj2046.chatgpt.site/ (Sites version 2).
The service records its source commit as `58f4bf1fd02ac287d9125f941c3f3166a2b94c0b`.
Direct Git source access was unavailable in this environment. This is a recovery
of published presentation files, not a claim to have cloned that source commit.

- `index.html`: recovered from the rendered page's HTML. Hosting-injected widget
  code is omitted. Home links explicitly use `index.html` to work in an extension.
- `studio.css`, `workspace-theme.css`, `assets/anime-studio.png`, `assets/mark.svg`:
  original downloaded assets, without visual changes.
- `workspace-theme.js`: original focus/demo adapter; removing the demo query now
  preserves the current pathname, other query parameters, and fragment.
- `app.html`: current GitHub editor markup with the recovered theme, focus button,
  home navigation and prototype introduction. The baseline version remains visible.

Original asset SHA-256:

| Asset | SHA-256 |
| --- | --- |
| anime-studio.png | 5225752a20cd9573e2ee81448b9a029cd4b37ea2d53eaf8e0da6171a6cf664c7 |
| studio.css | 1671842e90f53403cba133bc08e794f71bad30b81681bdcc945b5d64315995d5 |
| mark.svg | 6a3de1d1eb5b6d1510a6a03d04bfac3eb8cce77b6933dab9dd023a0c39bda9a5 |
| workspace-theme.css | 915d3d3f575c27590a5d5a162f3347be95f25d01f931f79c87f145418aea0e5c |

## Shared editor

The engine comes from GitHub main `0e7884c7239a725c22a2ea32028037e69ba20860`,
including the shared UTF-8 codec. No older prototype engine or 0.2.0 archive is
substituted. Comparison, transfer validation, review history and byte-preserving
export are unchanged. No new permission, dependency, API call or persistent
source storage is introduced.

The toolbar icon continues to open the local editor. Studio opens the bundled
home page; the extension does not need the hosted site to use its interface.

## Build and verification

Use Node 24 and the pinned lockfile:

```sh
npm ci
npm run build
npm test
npm run build:web
npx playwright install chromium
REQUIRE_EXTENSION=1 npm run test:browser
npm run test:web
npm run package
```

`dist/client` is the static web output. It contains only the allowlisted runtime
and public information files, not the extension manifest, background script,
sources, tests or node_modules. Serve it over HTTP(S) for Web Worker support.
The website processes code locally once loaded; offline reload of the website
is not promised. The installed extension remains self-contained and offline.

The browser suite exercises the actual web output as well as the installed
extension, including syntax, transfers, Undo/Redo, downloads, reopen, focus and
home/example navigation. A successful CI run is required before acceptance.

Local verification limits during recovery: npm's offline cache lacked pinned
dependencies, and the executor could not open a local HTTP socket. Full rebuild
and browser checks therefore run in GitHub Actions, not a claimed local pass.

## Remaining release work

- Compare Code branding, release version, domain, Privacy/Support pages and SEO.
- Reconcile welcome/store PR #8 with this branch and update screenshots.
- Complete macOS/WebKit coverage and package acceptance before store submission.
- No domain switch, store submission, merge or hosted prototype replacement is
  performed by this integration.
