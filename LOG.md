# Landscape Designer — Log

## 2026-07-14 — Session 20260714-164147-7703 (TerMinty-7703)

- Project created at Cameron's request: web app for full-scale professional landscape designs from a dropped satellite image, with site-feature identification and to-scale garden design.
- Cameron's explicit instruction: research first ("do not invent the wheel on your own or by vibes"), then build.
- Dispatched 5 parallel research workers: (01) existing solutions survey, (02) professional landscape-drafting practice, (03) satellite→scale conversion + imagery licensing, (04) feature detection feasibility (browser SAM / APIs / OSM vector shortcut / semi-auto tracing), (05) web canvas drawing-engine tech.
- v1 BUILT and verified same session. 10 JS modules (~2,900 lines) + vendored libs (Konva 10.3, simplify-js, polygon-clipping, magic-wand-tool, jsPDF) + 85-species plant DB (spreads verified against NC State Extension pages by curation worker).
- Bugs found & fixed during playwright verification: (1) node draggability active in every tool swallowed drawing gestures → gated on Select tool; (2) infinite loop in PDF scale-bar sizing (seg *= 2 grew the bar length) → nice-increment lookup; (3) Konva fires dblclick for ANY two clicks within 400ms regardless of position → rapid polygon clicks self-cancelled; dblclick-finish now requires coincident last points and short drafts are kept, not cancelled; (4) Esri serves "Map data not yet available" placeholder tiles as HTTP 200 → content-based (corner variance) detection steps zoom down; (5) Overpass 504s → mirror fallback (kumi.systems).
- Verification: offline smoke 20/20 (drop→calibrate→trace→wand→plants→schedule→undo→bed→PDF→JSON); live address flow: Ryman geocode → z19 imagery (0.79 ft/px, Mercator math verified) → 43 OSM footprints aligned on the photo. Screenshots in tests/.
- Serving on http://127.0.0.1:8377 (left running for Cameron's review).

## 2026-07-14 (evening) — same session, feedback rounds
- Round 2 (rotation + automation): view rotation on layers (Konva stages don't rotate) w/ Align drag-gesture, upright labels, rotated PDF export w/ true-north arrow; SAM (SlimSAM via transformers.js CDN) click-to-segment AI tool; 7/7 test.
- Round 3 (editing UX): right-click-select from any tool; ctrl/middle-drag pan mid-task; midpoint-square handles insert vertices for boundary re-adjudication; custom plants; 10/10 test after fixing render-during-handle-drag destroying the dragged handle (keepHandles render option).
- Plant DB: 85 → 360 (4 workers: trees/shrubs/herbaceous/retrofit patch; all extension-verified, ~all with Wikipedia images + nativeRegions). Catalpa spread fixed via identity-verified MoBot page (guessed kempercode was actually Davidia — title check caught it). Palette: region/zone/native/edible filters + photos + custom plants.
- Round 4 (Vermont property): edibles/orchard worker running (ash, plum, apple, hawthorn, linden, currants, raspberries, edible:true field); Expand-map shipped — tile-ring growth around existing imagery, geometry translated, user controls cropping.
- Round 5: welcome/quick-start dialog (auto first 2 visits, ? button after; visits counter in localStorage); dialog centering fix (global CSS reset removed <dialog> margin:auto). Sharing story documented in README (zip app/ folder; fully client-side).
- Round 6: Digital fit-to-plan PDF export (auto-sized page, no paper cropping; scale-true; portrait for tall plans; schedule sheet stays letter-width). Verified via playwright download.
- Round 7: Crop feature (drag-rect keep-area; originGlobalPx/bbox updated; translateAll; image-aware undo — snapshots optionally carry the image, undo/redo symmetric); expandImagery generalized to arbitrary origins so expand still works post-crop. Published to github.com/campattison/landscape-designer with GitHub Pages (live, verified end-to-end from the hosted origin).
