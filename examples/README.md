# Test files

Each language folder has an **A-correct** file and a **B-error** file with one
deliberate syntax error. Files are synthetic and can be freely used for testing.

| Folder | Error in B |
| --- | --- |
| python | Missing indentation on line 5 |
| javascript | Missing `)` on line 4 |
| typescript | Missing property type on line 3 |
| json | Missing value on line 3 |
| yaml | Tab used for indentation on line 3 |

Open the files in A and B. Check that only B reports an error. Click the block
arrow A → B, download B, and reopen the downloaded file. It should be identical
to A and have no reported syntax error. Undo should restore the error; redo
should remove it again. Test files are also used by the browser regression test.
