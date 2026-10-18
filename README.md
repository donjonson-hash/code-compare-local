# Code Compare Local · beta 0.4.0

Compare two versions of code, edit them side by side, move changes from A to B,
check syntax, and download the result. Processing stays in the browser. No LLM,
API key, account, or server is required.

This is an unpacked desktop Chromium extension, not a published or approved
store release. The beta interface is in English. Firefox is not included in this
release. [Инструкция на русском](README-RU.md).

## Install or update

1. Extract the archive to a permanent folder.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the extracted folder containing `manifest.json`.
5. Click the extension icon to open the editor in a new tab.

The archive includes `app.js` and `syntax-worker.js`; installation does not
require Node.js or a build step.

To update an existing installation, download any work you want to keep, close
the editor, replace the files in the installed folder, and click the extension's
reload button on the extensions page. Open a new editor tab afterward.

## Compare, correct, save

1. Choose **Try example**, paste two versions, or open a UTF-8 text file in each
   editor. A is your reference; B is your result. Both sides are editable.
2. Review the **Differences** list, with line numbers for A and B. Click a card
   to reveal that block in both editors; **Previous / Next** walks the list.
   **Use A** transfers just that block to B. The inline **→** also works.
3. Edit B directly if needed. The toolbar undo/redo buttons affect B;
   Ctrl/Cmd+Z works in the focused editor. **All A → B** replaces the entire B
   document and can be undone.
4. Choose the language. It applies to both sides; opening a file selects a
   language from its extension.
5. Review syntax messages. Click a message to jump to its line and column.
6. Set an output filename and choose **Download B**. Reopen the downloaded file
   to check the final result.

**Code size** offers 14, 16, 18, or 20 px (16 px by default). The first
difference opens automatically after loading two nonempty files. Insertions
and deletions show an anchor in the side with no corresponding text.

**Copy B** writes text to the clipboard. Use **Download B** when line endings
and a UTF-8 byte order mark (BOM) must be preserved exactly. Downloading creates
a new file; the extension does not overwrite the source file.

## Syntax checking

Checks run automatically after loading, pasting, editing, transferring a block,
or undoing a change. **Check syntax** runs them again. The extension parses code;
it does not execute it or automatically format or repair it.

| Language | Check provided |
| --- | --- |
| JavaScript, JSX, TypeScript, TSX | Syntax parsing; no type checking |
| JSON | Strict JSON syntax |
| YAML | Syntax, indentation, duplicate keys; no schema validation |
| Python | Preliminary grammar and indentation checks |
| HTML, CSS, Java, C/C++, SQL, Markdown, plain text | Highlighting where supported; no syntax validation |

Python checks are not a replacement for CPython. Some contextual errors and
language constructs are not covered. Unsupported parenthesized `with (…)`
headers produce a warning for verification in Python. Moving a line into a
different valid Python block can change behavior without causing a syntax
error. In JavaScript, changing indentation alone usually is not a syntax error.

Each side is parsed as a standalone file. Incomplete fragments can therefore
produce errors. A successful syntax check does not establish that the program
is logically correct or safe to run. Saving remains available when errors exist.

Checks run in a bundled local worker, with a three-second timeout and up to 50
messages per editor. A failed or timed-out check is shown explicitly, not as a
successful check.

## Files and session limits

- UTF-8 text files up to 512 KiB each, 200,000 UTF-16 code units, and 4,000 lines
  per editor. Binary input and invalid UTF-8 are rejected.
- Tabs, spaces, final newlines, UTF-8 BOM, and LF/CRLF/CR line endings are
  preserved in unchanged text on download. Transferred blocks retain A's line
  endings; newly typed lines use B's predominant line-ending style.
- When only line endings or BOM differ, a separate notice lets you copy A's
  format to B. Clipboard operations may normalize line endings.
- Large differences may be grouped into broader blocks, identified in the UI.
- Editor contents and undo history live in memory. Closing or reloading the
  editor, or restarting the browser, does not restore the session. Download
  your result first.
- No project-wide comparison, Git integration, code execution, cloud history,
  automatic access to ChatGPT/Claude/Gemini, or paid features in this beta.

See [PRIVACY.md](PRIVACY.md) for data handling.

## A short beta check

Use a small example without personal or confidential information:

1. Open a correct file in A and a copy with one syntax error in B.
2. Confirm the error appears in B and its message opens the expected line.
3. Transfer the correction A → B. Confirm the error disappears.
4. Undo, check that the error returns, then redo the correction.
5. Download B under a new filename. Open that downloaded file in B and check
   that the corrected text and indentation remain intact.

If something fails, record the extension version, browser version, selected
language, steps, expected result, and actual result. Include only a minimal
reproducible example you are comfortable sharing. The extension does not
automatically submit feedback or code.

For product feedback, note whether you completed a real comparison without
switching editors, which action was unclear, and whether you used it again for
another task. A one-time successful test alone does not establish repeat usage.

## Development

Use the source archive for development; the installation ZIP contains the bundled runtime.
Node.js 24+ is required for development. Sources are in `src/`; regression
checks are in `tests/`. Dependencies are pinned in `package-lock.json`.

```sh
npm ci
npm run build
npm test
npx playwright install chromium
REQUIRE_EXTENSION=1 npm run test:browser
npm run package
```

CodeMirror 6 provides the editor and merge view. A separate document model
preserves raw line endings and BOM. Babel Parser, Lezer, and YAML provide syntax
parsing. `src/syntax-ui.mjs` manages worker checks and diagnostic display.

See `VERIFICATION.md` for the scope of verification and
`THIRD-PARTY-NOTICES.txt` for dependency licenses. The package is currently
marked `UNLICENSED`; bundled third-party components retain their own licenses.

The GitHub Actions workflow in `.github/workflows/ci.yml` builds the extension,
runs the unit and browser checks, and packages the verified result. Its browser
job requires a loaded extension; it will not silently fall back to a web page.
See [REPOSITORY-SETUP.md](REPOSITORY-SETUP.md) for repository setup and
[examples/README.md](examples/README.md) for the supplied test files.
