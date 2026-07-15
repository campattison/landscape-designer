# Vendored JavaScript Libraries

No-build vanilla-JS app. All files are browser-ready UMD/IIFE builds that attach a
global when loaded via `<script>` (no bundler, no ESM imports). Downloaded from the
unpkg npm CDN with pinned versions on 2026-07-14.

| File | Package | Version | Global | Format | License | Size (bytes) |
|------|---------|---------|--------|--------|---------|--------------|
| `konva-10.3.0.min.js` | konva | 10.3.0 | `Konva` | UMD (minified) | MIT | 185,931 |
| `simplify-1.2.4.js` | simplify-js | 1.2.4 | `simplify` | UMD/IIFE (unminified) | BSD-2-Clause | 3,195 |
| `polygon-clipping-0.15.7.umd.min.js` | polygon-clipping | 0.15.7 | `polygonClipping` | UMD (minified) | MIT | 29,106 |
| `magic-wand-1.1.7.min.js` | magic-wand-tool | 1.1.7 | `MagicWand` | IIFE (minified, `window.MagicWand`) | MIT | 7,961 |
| `jspdf-4.2.1.umd.min.js` | jspdf | 4.2.1 | `jspdf` | UMD (minified) | MIT | 420,165 |

## Source URLs

- Konva: https://unpkg.com/konva@10.3.0/konva.min.js
- simplify-js: https://unpkg.com/simplify-js@1.2.4/simplify.js
- polygon-clipping: https://unpkg.com/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js
- magic-wand-tool: https://unpkg.com/magic-wand-tool@1.1.7/dist/magic-wand.min.js
- jsPDF: https://unpkg.com/jspdf@4.2.1/dist/jspdf.umd.min.js

## Notes / verification

- Each file's first line was checked to confirm it is JS, not an HTML error page.
- Each expected global was grep-confirmed present in the downloaded file.
- Global-attachment mechanisms confirmed:
  - `simplify` self/window-attaches (`self.simplify = simplify; ... window.simplify = simplify`).
  - `magic-wand` sets `window.MagicWand`.
  - Konva, polygon-clipping, jsPDF use standard UMD factory wrappers.
- **License deviation:** simplify-js is **BSD-2-Clause**, not MIT (the task anticipated
  MIT for all five). BSD-2-Clause is permissive and compatible; noted here for accuracy.
  All other four are MIT per their npm `package.json`.
- Usage note: jsPDF's global is `jspdf` (an object); the constructor is `jspdf.jsPDF`.
