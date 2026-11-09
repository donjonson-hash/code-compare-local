# Compare Code website launch

Target origin: `https://comparecode.pro` (without www).
The website candidate lives in `feature/comparecode-pro`, PR #10.

## Prepared source

- Compare Code brand on the home page, workspace, Privacy and Support.
- Absolute canonical URLs, descriptive titles and descriptions; social metadata
  on the home page. `sitemap.xml` lists the home, privacy and support pages.
- The interactive workspace uses `noindex,follow`. `robots.txt` permits crawling
  so a crawler can read that directive. The demo query is consumed on entry.
- Help links from the workspace open a new tab without replacing live edits.
- Privacy describes application-local processing separately from hosting logs.
- `npm ci`, `npm run build`, `npm run build:web` produce `dist/client`.
  The web output excludes the extension-only `PRIVACY.md` and all source/tests.

## Hosting configuration

`vercel.json` is a prepared deployment option, not proof of an active deployment.
It selects the static web output, rebuilds the runtime from source and configures
permanent redirects from www to the apex and `/index.html` to `/`. URLs retain
their `.html` suffixes, matching the page links and canonicals. On another host,
configure equivalent redirects there; copying `dist/client` alone does not apply
Vercel configuration.

Use Node 24 for the pinned dependencies. First inspect the selected account for
an existing matching project; do not create a duplicate. Deploy the CI-verified
commit as a preview and verify its pages and worker before production promotion.
The configuration makes no registrar changes and contains no deployment credentials.

## State checked on 9 November 2026

- Existing private prototype: Sites project
  `appgprj_6ae6ee1e8a588191939479c0f828f6bf`, published version 2. No custom domains.
- Its source checkout could not open because the executor could not resolve
  `git.chatgpt-team.site`. The existing publication was not replaced.
- DNS inspection for `comparecode.pro` returned Porkbun nameservers
  (`maceio`, `fortaleza`, `salvador`, `curitiba.ns.porkbun.com`) and A records
  `207.207.210.50`, `207.207.210.36`, `207.207.210.23`.
  This confirms a DNS zone, not the user's ownership or an active app deployment.
- The browser session could not open the Porkbun management page.
- Vercel project inventory returned access denied for team
  `team_eEZk2ubaH91u9eJHEK0nUpDg`; team access is required before selecting or
  creating a project. No Vercel project or deployment was created.

## Remaining live verification

1. Resolve hosting access and inspect the correct project/account.
2. Deploy the tested revision; verify home, editor, local worker, Privacy,
   Support, robots, sitemap and genuine missing-page HTTP 404 responses.
3. Attach apex and www; use the exact required DNS records returned by that
   hosting provider. Preserve unrelated MX/TXT records at Porkbun.
4. Verify domain ownership, certificate readiness and HTTPS. Check www and
   `/index.html` redirects, query preservation and absence of redirect loops.
5. Confirm production is publicly accessible before requesting indexing.
   Submit `https://comparecode.pro/sitemap.xml` in the verified Search Console
   property. No Search Console submission has been performed.

Configuration references:
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/routing/redirects/configuration-redirects
