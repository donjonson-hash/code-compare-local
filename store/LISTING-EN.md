# Store listing draft · Code Compare Local 0.9.0

Prepared on 20 October 2026 for the 0.9.0 desktop Chromium beta candidate.
This document does not indicate that the extension has been submitted, approved,
or published. Copy only the Full description section into that store field.

## Name

Code Compare Local — Beta

## Short description

Compare code side by side with a local code diff tool. Edit changes, check syntax, and save files offline.

## Full description

THIS EXTENSION IS FOR BETA TESTING.

Compare two versions of code, review their differences, and save the result you want. Code Compare Local is a code comparison tool that works offline in your browser. Open your reference in A and your revised version in B, then work through the highlighted changes side by side.

START WITH AN EXAMPLE
The welcome page opens after first installation. Open the editor or try a built-in JavaScript example without preparing files. The editor and welcome page are in English. Translated store descriptions and extension names do not change the interface language.

FIND THE CHANGED LINES
Use the code diff view to see additions, removals, and replacements. The Differences list shows A/B line numbers and a preview of each changed block. Select an entry or use Previous and Next to jump to it, including changes far apart in a longer file.

CHOOSE WHAT GOES INTO B
Click Use A to copy the selected block into B, or Keep B to mark that difference reviewed without changing it. Use A → B works on one difference at a time; All A → B replaces the entire result. Review progress helps you track the decisions made during this session.

EDIT AND UNDO
Edit code directly in either pane. Undo and Redo above the editors apply to B; Ctrl/Cmd+Z acts on the focused editor. Block transfers can be undone as well. Keep B is a review mark, not a text edit. Manual edits restart review progress so earlier decisions are not silently carried over to changed text.

GET CONSISTENT DIFFERENCES
The same final A/B text produces the same difference blocks whether you load files directly, edit them, or undo and redo changes. This makes it easier to compare code again after saving. Difficult differences may be grouped into broader blocks; a block is not always the smallest possible change.

MAKE CODE EASIER TO READ
Choose a code size from 14 to 20 px and turn line wrapping on or off. Only changes folds long unchanged sections, with three context lines around the differences. Expand a folded section whenever you need more context. Show spaces & tabs makes indentation visible without changing the code.

CHECK SUPPORTED SYNTAX
Syntax checks run locally after loading, pasting, editing, and transferring code. Click Check syntax to run them again, then select a reported location to jump to the problem. JavaScript, JSX, TypeScript, TSX, JSON, and YAML have syntax checks. Python has preliminary grammar and indentation checks.

KNOW WHAT A CHECK MEANS
The extension does not execute code or repair it automatically. Each side is checked as a standalone file, so an unfinished snippet can report errors. TypeScript type checking and YAML schema validation are not included. Python checks do not replace validation with Python itself. Other listed languages offer highlighting only; valid syntax does not prove correct behavior.

SAVE YOUR REVISED FILE
Download B creates a new UTF-8 file without overwriting the original. Downloads preserve spaces, tabs, the UTF-8 byte order mark, and original line endings in unchanged text. Transferred blocks retain A's line endings. Newly typed lines use the edited file's main line-ending style. Use Copy B for the clipboard; it may normalize line endings.

USE IT FOR EVERYDAY CODE REVIEW
Compare JavaScript code before copying an update into your project. Review a Python file when indentation may have changed during a transfer. Compare JSON or YAML configuration files and inspect changed values as text. JSON comparison is textual: it does not match objects by meaning or ignore key order. These are two-file checks, not a review of an entire repository.

KEEP PROCESSING ON YOUR DEVICE
No account, API key, external AI service, analytics, or code upload is needed. The extension works in its own editor tab and does not read other tabs or conversations. Paste or open code yourself, including snippets from a chat. It does not connect automatically to ChatGPT, Claude, or Gemini.

SAVE BEFORE CLOSING
Text, undo history, and review state stay in memory during the session. Closing or reloading the editor does not restore your work. Download your result before leaving the tab. There is no cloud history or background backup.

BETA FILE LIMITS
Open UTF-8 text files up to 512 KiB, 200,000 UTF-16 code units, and 4,000 lines per side. PDF, Word documents, binary files, and whole folders are not supported. Start with two code files you know: find a difference, make a correction, try Undo, and download B.

## Screenshots

Use a capture of the actual English 0.9.0 interface with synthetic JavaScript
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
- `screenshot-welcome-1280x800.png`: actual first-install guide.
- `promo-440x280.png`: promotional tile.
- `promo-1400x560.png`: optional marquee with the actual editor screenshot.
- `../icons/`: extension icons in 16, 32, 48, 64 and 128 px. The store icon is 128 px with 96 px artwork and transparent padding.
- Localized metadata and full descriptions accompany the store kit; the editor and welcome page stay in English.

Image specifications: [official Chrome Web Store image guide](https://developer.chrome.com/docs/webstore/images).
See the submission worksheet for the current preparation and verification status.

## Submission worksheet

Use `SUBMISSION-RU.md` for the package, dashboard answers, and review instructions.
