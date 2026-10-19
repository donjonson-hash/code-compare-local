# Store listing draft · Code Compare Local 0.4.0

Draft for a desktop Chromium beta. This document does not indicate that the
extension has been submitted, approved, or published.

## Name

Code Compare Local — Beta

## Short description

Compare and edit code side by side. Move changes, check syntax, and save files locally. No account or AI required.

## Full description

Compare two versions of code and build the result you want.

Open or paste your reference in A and the updated version in B. Review the
highlighted differences, transfer an individual block from A to B, or edit
either side directly. Download B when you are done.

Code Compare Local works locally in your browser. No account, API key, LLM,
or server is needed.

WHAT YOU CAN DO

- Compare and edit two code files side by side.
- Move individual changes from A to B or copy the whole A document.
- Undo and redo changes.
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

Open UTF-8 text files up to 512 KiB, 200,000 UTF-16 code units, and 4,000 lines
per side. This beta compares two text documents, not entire repositories. It
does not access ChatGPT, Claude, or Gemini conversations automatically; paste
or load the code you want to compare.

## Screenshot

The prepared screenshot shows the actual English beta with the supplied JavaScript files, highlighted differences, the A → B transfer control, a syntax message, and the Download B button.

## Publication checklist

- Use a screenshot captured from the packaged build.
- Provide a publicly accessible privacy-statement URL before submission.
- Add the actual support contact or issue URL once the project has one.
- Confirm the uploaded package version matches this listing.
- Verify installation and the save/reopen workflow in a normal browser.

## Prepared assets

- `screenshot-1280x800.png`: actual packaged interface with the supplied JavaScript example.
- `promo-440x280.png`: promotional tile.
- `../icons/icon128.png`: extension icon.

Image dimensions were checked against the [official Chrome Web Store image guide](https://developer.chrome.com/docs/webstore/images) on 18 October 2026.
