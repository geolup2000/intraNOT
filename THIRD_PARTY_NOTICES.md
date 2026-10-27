# Third-party components

## PDF.js

The backend uses Mozilla PDF.js (`pdfjs-dist`), version **6.4.299**, installed through npm with the committed lockfile. It is not loaded in the browser.

- Project: https://github.com/mozilla/pdf.js
- License: Apache License 2.0
- Included license text: `orar/dist/vendor/PDFJS-LICENSE`

The package retains its upstream notices. The Apache 2.0 license text is also retained in the source tree.

PDF.js uses `@napi-rs/canvas` for Node.js compatibility. That npm package and its platform binaries are distributed under the MIT license; their notices are included in the installed packages.

## Discipline dictionary

The discipline dictionary was transcribed from a user-provided university legend. The original PDF is excluded from this repository. The application preserves the source spelling and reports codes with multiple names.
