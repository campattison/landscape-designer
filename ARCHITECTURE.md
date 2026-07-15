# Landscape Designer — v1 Architecture

*Synthesized 2026-07-14 from research/01–05 (all five reports, sourced). Session 20260714-164147-7703.*

## The wedge (from research/01)

No existing tool combines: address/satellite entry → automatic real-world scale → assisted site-feature capture → a true scaled, editable, top-down plan in the browser. Pro CAD tools (Land F/X, DynaSCAPE, VizTerra) are rigorous but desktop, expensive, and 100% manual tracing. AI newcomers (Neighborbrite, DreamzAR) are ground-photo → pretty render, explicitly "not a blueprint tool." Home Outside is the closest analog (address → scaled base) but hand-placed pins and sketch-style output. v1 targets exactly that gap.

## Entry paths (from research/03)

Two ways to get a scaled base:

1. **Address search (recommended path)**: Nominatim geocode → stitch **Esri World Imagery** tiles at z19–20 (license expressly permits tracing/vector creation, attribution required; Google is legally OFF-LIMITS — its ToS bans digitizing building outlines) → deterministic scale from Web Mercator: `metersPerPixel = 156543.03392 · cos(lat) / 2^zoom`, ftPerPx = mpp × 3.28084. No user calibration needed.
2. **Drop an image** (any screenshot/drone nadir shot): **calibrate by reference line** — user draws a line over a known dimension and types its length (the PRO Landscape / CAD pattern; ±2–5% realistic). Warn against oblique imagery.

Always-on footer disclaimer: not survey-grade; verify one field measurement; never for property lines/permits/excavation. (Roof overhang ≈ 1.5 ft outside foundation.)

## Feature capture (from research/04), layered fallbacks

1. **OSM Overpass building footprints** fetched for the geocoded bbox, projected via Web Mercator onto the image → instant building polygons (fails on new construction/sheds → editable).
2. **Magic-wand color segmentation** (`magic-wand-tool`, MIT, tiny, no model) — click lawn/pavement/pool → region → contour → simplified polygon. Works on all hardware.
3. **Manual polygon tracing** with right-angle assist (orthogonalize for buildings) — the always-available floor.
4. *(v2, not v1)*: browser SAM (SlimSAM/MobileSAM via transformers.js) click-prompt segmentation; Google Solar API tier. Detection layer is pluggable to receive this.
5. **Trees: click-to-place circles** (research verdict: browser tree-crown ML is not worth it for one yard).

Mask→vector: marching squares → Douglas–Peucker (`simplify-js`) → optional orthogonalization (buildings).

## Professional-plan model (from research/02)

- **Two-layer discipline**: Site (existing conditions) layer separate from Design (proposed) layers. Fixed layer stack: Base image / Site features / Hardscape / Beds / Planting / Annotation.
- **Plants are circles at MATURE spread with a center dot** — the defining convention. Deciduous = scalloped edge, evergreen = spiky, shrubs = smaller cluster circles, groundcover = area fill with hatch, all generated **parametrically** (radius = mature spread × scale; no permissively-licensed symbol library exists — research/05).
- Spacing is center-to-center (o.c.); groundcover qty = bed area ÷ per-plant coverage.
- **Auto plant schedule** (key, qty, botanical, common, spread, spacing) generated from placed symbols — the single feature that most separates pro tools from toys.
- Sheet furniture: north arrow, scale bar, title block, keyed labels with leaders.
- Scale: engineer's scale, default **1″ = 10′** (also 1″=8′/16′/20′) at export.

## Drawing engine (from research/05)

- **Konva.js** (MIT, active): layered canvases, selectable/transformable objects, Transformer, pan/zoom, snapping.
- **World units = feet**, origin at image top-left; image node scaled so 1 world unit = 1 ft; Konva stage scale/pan = view transform. Print scale is a separate paper-space transform at export.
- Document format is **our own JSON** (never Konva `toJSON`): project { image, calibration, north, features[], beds[], hardscape[], plants[], groundcovers[], labels[], dimensions[] } — all geometry in feet.
- Freehand bed lines: pointer input → `simplify-js` → Catmull-Rom smoothing → closed editable path.
- Geometry helpers: `polygon-clipping` (Martinez booleans) for bed-minus-hardscape and area math; quantize coords before ops.
- Undo/redo: command-pattern stack over the JSON model.
- Persistence: localStorage autosave + `.json` project download/upload (canonical portable format).
- Export: high-DPI raster at exact print scale (at 1″=10′ @300 DPI → 30 px/ft) embedded via **jsPDF**, title block + scale bar + north arrow + plant-schedule page drawn in PDF space. PNG export too. (Avoids svg2pdf font gotchas for v1.)

## App shell

No build step: vanilla ES modules + vendored libs in `app/vendor/` (offline-safe, no CDN drift), served by `python3 -m http.server` like the gym app. Plain professional-drafting aesthetic — this is a working tool, not a pitch site.

## v1 scope line

IN: address→imagery+footprints, drop+calibrate, feature tracing (wand + manual + OSM), beds, hardscape materials w/ hatches, parametric plant symbols from a curated plant DB (~80 species w/ mature spreads), groundcover fills, labels/dimensions, north arrow + scale bar, plant schedule, PNG/PDF export at engineer scales, save/load, undo/redo.
OUT (v2 candidates): browser SAM, parcel-line fetch, 3D, irrigation/lighting sheets, cost take-offs, zone-aware plant filtering beyond tags, collaborative editing.
