# Store listing draft · Code Compare Local 0.8.0

Prepared on 20 October 2026 for the accepted 0.8.0 desktop Chromium beta.
This document does not indicate that the extension has been submitted, approved,
or published. Copy only the Full description section into that store field.

## Name

Code Compare Local — Beta

## Short description

Compare and edit code locally. Check syntax, copy changes, and save. No AI, account, or uploads.

## Full description

THIS EXTENSION IS FOR BETA TESTING.

Free to use. All included features are available without payment.

Compare two versions of code and build the result you want.

Open or paste your reference in A and the updated version in B. Review the
highlighted differences, transfer an individual block from A to B, or edit
either side directly. Download B when you are done.

Code Compare Local works offline in your browser. No account, API key, AI,
or server is needed.

WHAT YOU CAN DO

- Compare and edit two code files side by side.
- Move individual changes from A to B or copy the whole A document.
- Undo and redo edits and block transfers while you work.
- See consistent difference blocks for the same code, whether you open files
  directly, edit them, or undo and redo your changes.
- Review each difference with Use A or Keep B and track your session progress.
- Collapse unchanged sections and reveal spaces and tabs without modifying code.
- See a difference list with A/B line numbers and jump to any changed block.
- Choose a readable code size (14–20 px) and turn line wrapping on or off.
- Check syntax automatically after edits and jump to reported errors.
- Copy B or download it as a UTF-8 file.
- Preserve tabs, spaces, original line endings, and UTF-8 BOM in downloaded
  output. Transferred blocks retain their source line endings.

SYNTAX CHECKS

JavaScript, JSX, TypeScript, TSX, JSON, and YAML are supported. Python has
preliminary grammar and indentation checks. TypeScript type checking and YAML
schema validation are not included. Other available languages provide
highlighting without syntax validation.

The extension does not run code or fix it automatically. Checks treat each side
as a standalone file, so an unfinished fragment may produce errors. Valid syntax
does not guarantee correct behavior.

LOCAL PROCESSING

No analytics, accounts, website access, or code uploads. Editor contents stay
in memory during the session. Download your result before closing or reloading
the editor; session recovery is not included.

BETA LIMITS

Open UTF-8 text files up to 512 KiB and 4,000 lines per side. There is also a
200,000 UTF-16 code-unit limit per side. Large differences may be grouped
into broader blocks. This beta compares two text documents, not entire repositories. It
does not access ChatGPT, Claude, or Gemini conversations automatically; paste
or load the code you want to compare.

## Screenshots

Use a capture of the actual English 0.8.0 interface with synthetic JavaScript
files. Keep highlighted differences, line numbers, Use A / Keep B, Undo / Redo,
and Download B visible. Screenshots must match the uploaded package; do not
include user files or private code.

## Publication checklist

- Use a screenshot captured from the packaged build.
- Privacy policy: https://github.com/donjonson-hash/code-compare-local/blob/main/PRIVACY.md
- Support: https://github.com/donjonson-hash/code-compare-local/issues
- Homepage: https://github.com/donjonson-hash/code-compare-local
- Confirm the uploaded package version matches this listing.
- Verify installation and the save/reopen workflow in a normal browser.

## Prepared assets

- `screenshot-1280x800.png`: actual packaged interface with the supplied JavaScript example.
- `screenshot-fixed-1280x800.png`: the same example after Use A, with matching versions, no reported syntax issues and Undo available.
- `promo-440x280.png`: promotional tile.
- `../icons/icon128.png`: extension icon.

Image specifications: [official Chrome Web Store image guide](https://developer.chrome.com/docs/webstore/images).
See the submission worksheet for the current preparation and verification status.

## Submission worksheet

Use `SUBMISSION-RU.md` for the package, dashboard answers, and review instructions.
