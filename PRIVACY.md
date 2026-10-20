# Code Compare Local privacy statement

Versions 0.5.0 and 0.6.0 pilot · 20 October 2026

Code Compare Local compares and edits text within its own browser-extension
tab. This statement describes the included beta build.

## Code and files

The extension reads files only when you choose them in its file picker, and
processes text you paste or type into the editors. Comparison and syntax
checking run locally using bundled code and a local worker. The extension does
not execute the code being compared or send it to a server or LLM.

Editor text, undo history, prepared change snapshots, and applied-command IDs
remain in memory while the editor tab is open.
There is no persistent session database, cloud history, or automatic recovery
after closing or reloading the editor. Save your work before leaving the tab.

## Downloads and clipboard

**Download B** creates a file through the browser's download flow. The browser
controls the final location and may keep its usual download history. Downloaded
files remain on your device until you remove them.

**Copy B** writes the result to your system clipboard only when you click that
button. Clipboard handling, including any clipboard synchronization enabled on
your device, is controlled by your browser and operating system.

## Collection, access, and network use

The beta contains no analytics, advertising, telemetry, account system, remote
fonts, or external API calls. It does not collect or transmit code, filenames,
usage events, identifiers, or browsing history to the developer.

The manifest requests no optional permissions, API permissions, or website
host permissions. No content scripts run on other websites. Clicking the
extension icon opens its own editor tab; it does not read chats or other tabs.
The extension page's content security policy blocks network connections through
`connect-src 'none'` and loads scripts from the extension package.

There is no extension account or server-side dataset to delete. Clear the
editors or close the tab to discard the active session; remove downloaded files
or clipboard contents separately if desired. This does not promise secure
erasure of browser or operating-system memory.

## Feedback

Feedback is not submitted automatically. If you choose to share a screenshot
or example with the developer, review it first and include only the information
needed to reproduce the issue.

## Support and contact

For product questions or privacy questions, use the project support page:
https://github.com/donjonson-hash/code-compare-local/issues

GitHub issues are public and governed by GitHub's own privacy policy. Posting
feedback there is a separate, voluntary action; the extension does not submit
anything on your behalf. Include only a minimal, non-sensitive example.
