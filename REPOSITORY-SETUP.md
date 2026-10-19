# Code Compare Local repository

Remote: https://github.com/donjonson-hash/code-compare-local

The project is maintained independently of Compare These Texts. The main branch
is `main`. The 0.5.0 beta includes line-numbered navigation, readable code sizes, collapsed
unchanged context, visible whitespace, and Use A / Keep B review decisions.
The UI and store listing are in English; comparison and syntax checks run locally.

## Clone and verify

```sh
git clone https://github.com/donjonson-hash/code-compare-local.git
cd code-compare-local
npm ci
npm run build
npm test
npx playwright install chromium
REQUIRE_EXTENSION=1 npm run test:browser
npm run package
```

The `Beta checks` GitHub Actions workflow builds the code, runs unit tests and
installed-extension browser tests, then uploads distribution ZIPs. A successful
local-page test does not replace the installed-extension gate.

Development dependencies, browser profiles and generated distribution archives
are excluded from version control. Supplied example files contain synthetic data.
