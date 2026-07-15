# Web Technology for a 2D CAD-like Landscape Design Canvas

Research brief for the drawing engine of a browser-based landscape plan tool: drop a satellite image, trace/detect site features, draw a to-scale plan (curved beds, hardscape, plant symbols at mature spread, labels + leader lines, legend/plant schedule, north arrow, scale bar), and export a print/PDF at a stated scale (e.g. 1"=10').

Scope framing: "lightweight Land F/X in the browser," one developer, v1.

Version/date/license claims below were checked against the linked repos and docs where possible. Anything I could not confirm from a fetched source is tagged `[unverified]`.

---

## 0. TL;DR recommendation (one-developer v1)

**Rendering/editing engine: Konva.js** (MIT, actively maintained, latest v10.3.0 released ~Apr 2026). It gives you a real selectable/transformable object model, groups, multiple layers on separate `<canvas>` elements (a natural fit for "background image / site features / hardscape / planting / annotation" layer stack), a built-in `Transformer` for resize/rotate, JSON serialization out of the box, a hidden hit canvas for cheap event detection, and first-class pan/zoom-relative-to-pointer and object-snapping demos. It comfortably handles a few hundred vector objects over one large background raster.

**Geometry/boolean helper: Paper.js used headless as a geometry library, OR `polygon-clipping` (Martinez).** Konva has no boolean ops. For "bed minus hardscape," "merge overlapping beds," and offsetting, either (a) run Paper.js in the background purely for `path.unite/subtract/intersect` on control-point paths and hand the resulting geometry back to Konva, or (b) flatten bed/hardscape outlines to polygons and use `polygon-clipping` (MIT, Martinez-Rueda). Paper.js keeps curves as curves (better for bed outlines); `polygon-clipping` is lighter but polygon-only. See §3 for the tradeoff and the gotcha.

**Freehand bed drawing: perfect-freehand + simplify.js, then fit to editable control points.** Capture pointer input, `simplify.js` to thin it, then either render a Catmull-Rom/Bézier smoothed outline or convert to editable anchor points for later bezier editing.

**Units strategy: keep the model in real-world units (feet or meters), render with a single world→screen transform via Konva stage `scale` + `position`.** Store geometry in feet; derive pixels only at draw time. This makes scale bars, dimension labels, and "1"=10' at print" exact and pan/zoom lossless.

**Export: build a print-ready SVG from the model at the target scale, then `svg2pdf.js` → `jsPDF` for true vector PDF; use canvas `pixelRatio` for high-DPI PNG.** This gives real vector line-work at an exact plotted scale and multi-page (plan page + plant-schedule table page) without rasterizing.

**App shell: light Vite + TypeScript build; Dexie (IndexedDB) for local projects + `.json` file download/upload for portability.** A single-file vanilla app is viable but TypeScript pays off fast once you have a real object model, undo stack, and export pipeline.

**Undo/redo: command stack (do/undo pairs) as the primary model, with occasional full-state snapshots as checkpoints.** Konva's own guidance uses lightweight state history; a command stack scales better than snapshotting the whole scene on every edit.

---

## 1. Canvas libraries compared

### Summary table

| Library | Renderer | Editable object model | Layers | Serialize (JSON) | Boolean/curve math | TS-friendly | License | Maintenance |
|---|---|---|---|---|---|---|---|---|
| **Konva.js** | Canvas 2D, multi-canvas | Yes — shapes, groups, Transformer | Yes (each Layer = own canvas) | Yes (`toJSON`/`Node.create`) | No booleans; bezier via `Path` data only | Yes (ships types) | MIT | Active; v10.3.0 ~Apr 2026 |
| **Fabric.js** | Canvas 2D, single canvas | Yes — rich object model, brushes | Single canvas (no true layers) | Yes (`toObject`/`toJSON`/`loadFromJSON`) | No booleans; SVG parse/export | Yes (v6 TS rewrite) | MIT | Active; v6 (2024), current 7.x |
| **Paper.js** | Canvas 2D | Yes — vector item model, full path/segment editing | Yes (project layers) | Yes (`exportJSON`/`importJSON`) | **Yes — unite/subtract/intersect/exclude/divide** | Types exist `[unverified quality]` | MIT | Last tagged release v0.12.15 (Mar 2021); low activity |
| **Pixi.js** | WebGL/WebGPU | No editing UI — you build it | Container graph | No app-level scene JSON | No | Yes | MIT | Very active |
| **Plain SVG (+ d3)** | SVG DOM | DOM elements = your model | SVG `<g>` groups | It's the DOM/serialize XML | Use external libs | N/A | — | N/A |
| **tldraw** | React canvas | Yes — full editor | Yes | Yes | N/A (shapes) | Yes | **Custom tldraw license — commercial needs paid key ($6k/yr)** | Very active (Series A Apr 2025) |
| **Excalidraw** | Canvas | Yes — sketchy editor | Limited | Yes | N/A | Yes | MIT (app) | Active |

### Konva.js — recommended engine
- **Object model:** `Stage → Layer → Group → Shape`. Shapes (Rect, Circle, Line, Path, Text, Image, custom `Shape`) are individually selectable, draggable, and transformable. A built-in `Konva.Transformer` gives interactive resize/rotate/scale handles — exactly what you want for placing/scaling plant symbols and rotating a north arrow. Groups let you bundle a plant symbol + its label + leader line and move them together.
- **Layers:** Each `Konva.Layer` is a **separate `<canvas>`** with its own scene renderer plus a hidden **hit-graph renderer** for high-performance event detection. Static content (the satellite image) sits on its own layer and does not re-render when you drag a bed on another layer. This maps cleanly to your layer panel (image / site features / hardscape / planting / annotation). Caveat: don't create dozens of layers — the docs recommend keeping layer count small (each is a real canvas); use `Group`s within a few layers instead. `[verify exact recommended max in Konva perf docs]`
- **Events:** Rich event system (`click`, `dragmove`, `mouseover`, custom) resolved via the hit canvas, so hit-testing is pixel-accurate and cheap even with hundreds of shapes.
- **Serialization:** `stage.toJSON()` returns all node attributes; `Konva.Node.create(json, container)` rebuilds. **Event handlers and images are NOT serialized** — you re-attach handlers and re-load the satellite image by URL/blob after load. In practice you'll want your *own* project schema (model in world-units) and treat Konva's toJSON as a convenience, not the source of truth. See gotcha in §2.
- **Performance:** Independent benchmarks put Konva ahead of Fabric on large object counts (e.g. ~23fps vs ~9fps in Chrome at 8k boxes on a 2019 MBP, per the DEV/Oreate comparisons — treat as indicative, not authoritative). A few hundred vector objects + one large background image is well within range; use `layer.cache()` on complex static groups and shape caching for detailed plant symbols.
- **Freehand/bezier:** No dedicated bezier-editing UI, but `Konva.Path` accepts SVG path data (including `C`/`Q` beziers), and `Konva.Line` with `tension` gives Catmull-Rom-like smoothing for quick freehand. You build the control-point editing handles yourself (draggable small circles bound to path segments).
- **TS/vanilla:** Ships TypeScript types; works in vanilla JS or with official `react-konva`, Vue, Svelte, Angular bindings — no framework lock-in.
- **License/maintenance:** MIT, maintained since 2014, latest **v10.3.0 (~Apr 2026)**.
- Sources: https://konvajs.org/docs/overview.html · https://konvajs.org/docs/data_and_serialization/Serialize_a_Stage.html · https://konvajs.org/docs/select_and_transform/ · https://github.com/konvajs/konva/releases

### Fabric.js — strong alternative, weaker on layers
- Mature object-oriented model, built-in free-drawing brushes, and **SVG import/export** (useful if you want to ingest CAD-block SVGs directly). `toObject`/`toJSON` + `loadFromJSON` handle persistence.
- **v6 (2024) is a full TypeScript rewrite** (ES6 classes, promises, modular imports `import { Canvas, Image } from 'fabric'`), MIT; current npm is in the 7.x line `[verify exact current version at publish time]`.
- **Main drawback for this app:** single-canvas architecture — no true multi-layer canvases, so the "static background doesn't repaint" win of Konva isn't native (you fake layering with z-order and `objectCaching`). Its built-in brushes and SVG parsing are the reasons to consider it if satellite-image editing + SVG-block ingestion dominate.
- Sources: https://fabricjs.com/docs/upgrading/upgrading-to-fabric-60/ · https://github.com/fabricjs/fabric.js/releases · https://github.com/fabricjs/fabric.js/blob/master/LICENSE

### Paper.js — best geometry, stale as a UI engine
- Purpose-built for **vector math, Bézier curves, and boolean path operations** (`unite`, `intersect`, `subtract`, `exclude`, `divide`; plus `getIntersections`, CompoundPath support). Full segment/handle editing model — the richest curve editing of the group.
- MIT. **But the last tagged release is v0.12.15 (March 2021)**; the develop branch shows commits but no recent release. For a v1 I'd avoid making it the primary UI engine, and instead **use it headless as a geometry helper** (see §3) where its staleness matters less.
- Sources: http://paperjs.org/examples/boolean-operations/ · https://paperjs.org/reference/pathitem/ · https://github.com/paperjs/paper.js

### Pixi.js — overkill / wrong shape
- WebGL/WebGPU renderer, superb for tens of thousands of sprites or a massive zoomable raster. **But it provides no editing UI, no transform handles, no selectable-object model, and no scene serialization** — you would rebuild everything Konva gives you for free. Only worth it if you later need GPU-scale raster tiling of very large orthophotos. MIT, very active. Not recommended for v1.
- Source: general Pixi docs `[not separately fetched — treat renderer/feature claims as background knowledge]`

### Plain SVG (+ d3) — viable but you build the framework
- SVG elements *are* your object model and serialize as XML; infinitely crisp; trivial vector PDF story. `d3-zoom` gives pan/zoom, `d3-drag` gives dragging. **Cost:** you hand-roll selection, transform handles, hit-testing, z-order/layers, and performance management. At a few hundred nodes SVG is fine; it degrades with thousands of nodes or a huge inline raster. Reasonable if you strongly value "the document is just an SVG," but it's more plumbing than Konva for the same v1.

### tldraw / excalidraw — embeddable editors
- **tldraw:** the most polished infinite-canvas SDK (React), with editing, selection, undo/redo, persistence, and pan/zoom built in. **Licensing is the blocker:** the SDK ships under tldraw's **own license, and production/commercial use requires a paid license key — ~$6,000/yr** (100-day trial; discretionary free hobby/non-commercial license by request). Also React-only and opinionated; bending its shape system to CAD-accurate world-units + scaled PDF plotting is possible but fights the grain.
- **Excalidraw:** MIT and lovely, but its "hand-drawn/sketchy" aesthetic and diagram-first shape model are the opposite of a to-scale CAD plan; retrofitting exact scale and plant symbology is awkward.
- Neither is a good fit for a *precision* landscape plan v1. Konva gives more control at zero license cost.
- Sources: https://tldraw.dev/pricing · https://tldraw.dev/community/license · https://github.com/tldraw/tldraw

---

## 2. CAD-like features and how to get them

### Real-world units on top of pixels (the core decision)
Keep the **model in real-world units** (store bed vertices, symbol centers, spreads in **feet** — or meters; pick one and store a project unit flag). Never store pixels in the document. Convert only at render time with one transform:

```
screen = (world * PPU * stageScale) + stagePan
```
where `PPU` (pixels-per-unit) is a fixed constant you choose for the "1:1" zoom (e.g. 4 px/ft), `stageScale`/`stagePan` come from Konva's `stage.scale()`/`stage.position()`. Because Konva scales/pans the whole stage, you get lossless zoom for free and only need `PPU` to relate feet↔px. Dimension labels compute directly from world coordinates (distance in feet = `hypot(dx,dy)` on model points), so they're exact regardless of zoom. Print scale (1"=10') is then a separate paper-space transform at export (§5), fully decoupled from screen zoom.

Gotcha: **don't let Konva's `toJSON` be your project format.** Because a resize is stored as `scaleX/scaleY` on nodes, "size" in Konva-space drifts from world-units. Serialize your own world-unit model and rebuild Konva nodes from it; use `toJSON` only for scratch/debug.

### Infinite pan/zoom
Konva has ready recipes: zoom-relative-to-pointer (wheel/trackpad), draggable stage, pinch-zoom, and an explicit "infinite canvas" demo. Use `stage.scale({x:k,y:k})` + reposition so the point under the cursor stays fixed.
- https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html
- https://konvajs.org/docs/sandbox/Infinite_Canvas.html

### Snapping (grid, object, angle)
- **Grid snap:** round world coordinates to nearest grid step (e.g. 0.5 ft) during `dragmove`.
- **Object snap:** Konva's official "Objects Snapping" demo shows edge/edge and edge/stage snapping with guide lines drawn on drag; extend it to snap to bed vertices, path endpoints, and symbol centers.
- **Angle snap:** while drawing a line/segment, if `Shift` held (or always), snap the segment angle to nearest 15°/45°.
- https://konvajs.org/docs/sandbox/Objects_Snapping.html · https://konvajs.org/docs/select_and_transform/Resize_Snaps.html

### Rulers and on-canvas dimension labels
No built-in ruler; draw rulers as a thin fixed overlay (an HTML/absolutely-positioned layer or a Konva layer pinned in screen space) with tick marks computed from the current world→screen transform. Dimension labels = a `Group` with a line, arrowheads, and a `Text` showing the world-space length; recompute on edit. This is straightforward custom code, not a library gap.

### Undo/redo
Use a **command stack** as the spine: each user action pushes a `{do, undo}` command (e.g. `AddBed`, `MoveVertex`, `SetSpread`). This is memory-cheap and scales to long sessions. Take an occasional **full model snapshot** (structured-clone of the world-unit model) as a checkpoint every N commands or before risky ops (boolean merges), so you can recover without replaying the whole log. Konva's React undo/redo doc and the Fabric TS tutorial both illustrate the lighter state-history approach; the Memento+Command combination is the standard pattern. Avoid snapshotting rendered canvas images (memory/perf killer).
- https://konvajs.org/docs/react/Undo-Redo.html · https://refactoring.guru/design-patterns/memento/java/example

### Layer panel with lock/hide
Model layers as your own array of layer descriptors (name, visible, locked, z) mapped onto a small number of Konva layers/groups. `visible` → `node.visible()`; `locked` → set `listening(false)` and skip in selection. Keep the count of actual `Konva.Layer` canvases low (a handful) and use `Group`s for finer structure.

---

## 3. Curve drawing for bed lines

### Freehand capture → smoothing → editable path
1. **Capture** pointer moves (pointer events, coalesced events for high-frequency input).
2. **Thin** with **simplify.js** (Douglas-Peucker; MIT) to drop redundant points. `[verify current simplify.js version]`
3. **Smooth/render** one of:
   - **perfect-freehand** (`getStroke` → `getSvgPathFromStroke`) for a pressure-style filled outline — great for a "brush" feel but produces an *outline polygon*, not a centerline; MIT, current ~v1.2.x. Best for sketchy annotation, less for a precise bed edge you'll later edit vertex-by-vertex.
   - **Catmull-Rom → Bézier**: fit a smooth spline through the simplified points and convert to cubic Bézier segments for an editable `Path`. This is the right choice for **bed outlines** because you keep editable anchors/handles.
4. **Edit:** render draggable anchor handles bound to each Bézier segment; dragging updates the path data. (Paper.js does this natively if you adopt it as the geometry layer.)
- https://github.com/steveruizok/perfect-freehand · https://www.npmjs.com/package/perfect-freehand · https://pomax.github.io/bezierinfo/

### Boolean ops (bed minus hardscape, merge beds, offset)
Two realistic paths:

- **A — Paper.js as a headless geometry service (curve-accurate).** Keep bed/hardscape outlines as Paper `Path`/`CompoundPath`, call `pathA.subtract(pathB)`, `unite`, `intersect`, `exclude`, `divide`; read back the resulting segments and render in Konva. **Pro:** preserves curves through the boolean (no polygon faceting on curved bed edges). **Con:** Paper.js is stale (v0.12.15, 2021) and you're carrying it just for math; you also translate between Paper geometry and your model.
- **B — `polygon-clipping` (Martinez-Rueda; MIT).** Flatten each outline to a polygon (sample curves to line segments at a tolerance), run `union/intersection/difference/xor` on `[Polygon|MultiPolygon]`. **Pro:** small, focused, MIT, handles holes/multipolygons; O((n+k)log n). **Con:** polygon-only — curved bed edges become polylines; and **floating-point round-off can cause errors/infinite-loop guards** (the lib exposes env limits precisely because FP math on near-coincident edges is its known failure mode). Mitigate by snapping/quantizing coordinates before clipping and choosing a sensible flattening tolerance.
  - Also in this family: **martinez-polygon-clipping** (the underlying algorithm), and **clipper-lib / Clipper2** (Angus Johnson) which additionally offer **polygon offsetting** — valuable if you want "buffer a path outward by 2 ft" for planting bands or mow strips. Clipper2 is primarily C++/C#/Delphi; JS use is via the older **clipper-lib** JS port (integer-coordinate API — you scale up, clip, scale down).
- **Recommendation:** For v1, if beds are mostly smooth curves and you care about clean curved subtractions, use **Paper.js headless (A)**. If you want the lightest dependency and can accept polygonal booleans (with a fine flattening tolerance), use **polygon-clipping (B)**; add **clipper-lib** only when you need offsetting. Quantize coordinates before any boolean op regardless.
- https://github.com/mfogel/polygon-clipping · https://github.com/w8r/martinez · https://github.com/junmer/clipper-lib · https://www.angusj.com/clipper2/Docs/Overview.htm

### Groundcover / area fill
For hatch or pattern fill within a bed polygon: use a Canvas pattern (Konva `fillPatternImage`) or an SVG `<pattern>` clipped to the bed path. For dot-matrix groundcover symbols, generate a point grid inside the polygon (point-in-polygon test) and stamp a small symbol at each — cap the count and switch to a flat tint when zoomed out for performance.

---

## 4. Plant symbols

### Reality check on "free open-source SVG symbol libraries"
Web search surfaces many **free CAD-block (DWG/DXF)** libraries for trees/shrubs in plan view (FreeCADS, DWGShare, LineCAD, First In Architecture, AppisCAD, CAD Forum), and some sites advertise **SVG/PDF** exports (AppisCAD). **But**: licenses on these block sites are often "free to download, unclear to redistribute," and DWG/DXF needs conversion to SVG. **I did not find a well-known, clearly-MIT/CC0, ready-made SVG *landscape plant symbol* library.** Treat any specific claim of a permissively-licensed SVG plant-symbol set as `[unverified]` until you read that site's license page. Sources (blocks, verify license before shipping):
- https://www.freecads.com/cad-category/landscape/ · https://dwgshare.com/47-free-cad-blocks-tree-plant-symbols-for-plan-view/ · https://www.firstinarchitecture.co.uk/free-cad-blocks-plants-and-shrubs/ · https://www.appiscad.com/product-category/landscape/

### Better path for v1: parametric/programmatic symbol generation
Landscape plan symbols are highly regular and cheaply generated in code, which also makes them **scale-exact** (radius = mature spread × scale) and restyleable. Generate as SVG paths or Konva custom `Shape`s from a few parameters:
- **Generic tree / shrub:** circle of radius `spread/2` (in world units) + center dot; optional inner concentric ring.
- **Deciduous (scalloped/cloud):** circle whose edge is a series of small arcs/scallops around the circumference (N lobes as a param).
- **Evergreen/conifer (spiky):** star/sawtooth polygon — alternate outer/inner radius around the circle to make points.
- **Shrub mass/cluster:** union of several overlapping smaller circles (use the boolean helper, or just overlap-draw).
- **Groundcover:** repeated small glyph or stipple within the bed (see §3 area fill).
Parameterize by `{spread, style, strokeWeight, lobes, points}` and instance per plant. Store only `{center, spread, styleId, rotation}` in the model; render deterministically. This eliminates the licensing problem and keeps files tiny.

Because symbols scale with mature spread in world-units, they automatically read correctly at any zoom and plot at the right size in the PDF.

---

## 5. Export

### High-DPI PNG
Konva: `stage.toDataURL({ pixelRatio: N })` or `stage.toImage({pixelRatio})` renders at N× resolution for crisp raster export. Choose `pixelRatio` from target DPI ÷ 96. Good for quick shareable previews; not for scaled plotting.

### Vector PDF at exact print scale (the important one)
**Build a fresh SVG of the plan in "paper space" at the target scale, then convert with `svg2pdf.js` → `jsPDF`.** Steps:
1. Compute the paper→world scale: for **1"=10'**, 1 paper inch = 10 world feet ⇒ paper mm-per-foot = `25.4/10`. Every world coordinate maps to an exact mm position on the sheet.
2. Emit an SVG sized to the sheet (e.g. Arch D 24"×36" = 609.6×914.4 mm) with all line-work, symbols, labels, north arrow, scale bar, and title block placed in mm.
3. `const doc = new jsPDF({ orientation:'l', unit:'mm', format:[914.4,609.6] });` then `await doc.svg(svgEl, { x, y, width, height });` (svg2pdf integrates as `doc.svg(...)`), then `doc.save()`.
4. **Multi-page:** `doc.addPage([...])` for a second sheet, render the **plant-schedule/legend table** (built as its own SVG or via jsPDF-AutoTable) on page 2.
- **Paper sizes:** define in mm — Letter 215.9×279.4, A3 297×420, Arch D 609.6×914.4, Arch C 457.2×609.6, ANSI D 558.8×863.6. Pass as `format` arrays.
- **Title block:** a fixed SVG group (border, firm/name, project, date, scale, sheet number, north arrow, scale bar) placed at sheet margins in mm.
- **Licenses:** jsPDF is MIT; svg2pdf.js (yWorks) is MIT `[verify — confirm on its repo LICENSE at publish time]`.
- **Known gotchas (from svg2pdf issue tracker):** text scaling/positioning bugs (issue #95), imperfect coverage of some SVG features, and font handling (embed/register fonts you use). Keep the export SVG simple — explicit paths, avoid exotic filters/`foreignObject`, pre-flatten transforms — to stay on the happy path. Test the scale bar physically (print, measure) as your acceptance check.
- https://github.com/yWorks/svg2pdf.js/ · https://github.com/yWorks/svg2pdf.js/issues/95

### Alternative export: print CSS with mm sizing
For a purely-SVG document you can skip PDF libs and use an `@media print` stylesheet sizing the SVG in mm/`@page { size: ... }` and let the browser "Save as PDF." Simpler, fewer deps, but less control over multi-page pagination and title-block placement than the jsPDF path. Reasonable fallback.

---

## 6. Persistence & app shell

- **Build:** **Vite + TypeScript.** A single-file vanilla app is tempting for a "just open index.html" tool, but once you have a world-unit model, command-stack undo, boolean helpers, and an export pipeline, TS types and module imports (Konva, perfect-freehand, simplify, polygon-clipping, jsPDF, svg2pdf) save real time. Vite dev server + a static production build keeps deployment trivial (any static host).
- **Local project store:** **Dexie** (IndexedDB wrapper; typed tables, transactions, schema versioning) is the best default for "a list of saved projects, each a JSON blob + thumbnail." Use **idb** if you want a thinner wrapper, **localForage** if you only need dumb key-value. Store the **satellite image** as a Blob in IndexedDB (don't inline as base64 in the project JSON — it bloats and slows saves).
- **File-based save:** serialize the world-unit model to a **`.landplan.json`** and trigger a download (`Blob` + object URL); load via `<input type=file>` / drag-drop + `File.text()`. This is your portable/backup format and should be the canonical schema (Dexie stores the same JSON). Consider bundling the image reference separately or as a base64 field the user can opt into for a fully self-contained file.
- https://dexie.org/ · https://www.pkgpulse.com/guides/dexie-vs-localforage-vs-idb-indexeddb-browser-storage-2026

---

## 7. Concrete v1 stack (with rationale)

| Concern | Pick | Why |
|---|---|---|
| Render/edit engine | **Konva.js** (MIT) | Real object model + Transformer + true layers + hit canvas + JSON + pan/zoom/snap demos; MIT; active (v10.3.0). No license cost, no framework lock-in. |
| Units | **World-units model (feet), single stage transform** | Exact dimensions/scale bar/print scale; lossless zoom; decouples screen zoom from plot scale. |
| Freehand → bed | **perfect-freehand (sketch) + simplify.js + Catmull-Rom→Bézier (editable)** | Smooth capture, thin points, keep editable anchors for real bed editing. |
| Booleans / offset | **Paper.js headless** (curve-accurate) *or* **polygon-clipping** (light, polygon) **+ clipper-lib for offsets** | bed−hardscape, merge beds, planting buffers. Quantize coords first. |
| Plant symbols | **Parametric SVG/Konva generation** (radius = spread×scale) | Sidesteps unclear CAD-block licensing; scale-exact; tiny files. |
| PNG export | **Konva `toDataURL({pixelRatio})`** | High-DPI raster preview. |
| PDF export | **Build paper-space SVG → svg2pdf.js → jsPDF** (both MIT) | True vector at exact scale; multi-page (plan + schedule); title block in mm. |
| Persistence | **Dexie (IndexedDB) + `.json` file download/upload** | Multiple local projects; image as Blob; portable canonical JSON. |
| Undo/redo | **Command stack + periodic full snapshots** | Memory-cheap, scales; snapshot checkpoints before boolean ops. |
| Build/shell | **Vite + TypeScript** | Types across model/undo/export pay off immediately. |

### Gotchas to keep on the radar
1. **Konva serialization is not your document format.** Resizes live as `scaleX/scaleY`; keep the world-unit model authoritative and rebuild Konva from it. Event handlers + images aren't serialized (re-attach/reload after `Node.create`).
2. **Paper.js is effectively frozen at v0.12.15 (2021).** Fine as a headless geometry helper; risky as the primary interactive engine.
3. **Polygon booleans + floating point.** `polygon-clipping` guards against FP-induced infinite loops via size limits — a signal that near-coincident edges break it. Snap/quantize coordinates and pick a sane curve-flattening tolerance before clipping.
4. **svg2pdf.js is good but not pixel-perfect** (text scaling/positioning issues, partial SVG feature coverage, font registration). Keep the export SVG minimal and **verify the scale bar by measuring a physical print** as an acceptance test.
5. **tldraw looks perfect until you read the license** — production/commercial needs a paid key (~$6k/yr) and it's React-only; not worth it for a precision CAD-style v1 when Konva is MIT.
6. **"Free" CAD block/plant-symbol libraries have murky redistribution licenses** and ship as DWG/DXF, not SVG. Prefer parametric generation; if you use downloaded symbols, read each site's license.
7. **Don't over-create Konva layers** (each is a real canvas). Use a handful of layers + `Group`s; `cache()` heavy static content.
8. **Store the satellite image as a Blob**, not base64 in the project JSON, to keep saves fast.

---

## Sources

Canvas libraries
- Konva overview / serialization / releases: https://konvajs.org/docs/overview.html · https://konvajs.org/docs/data_and_serialization/Serialize_a_Stage.html · https://github.com/konvajs/konva/releases
- Konva pan/zoom, snapping: https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html · https://konvajs.org/docs/sandbox/Infinite_Canvas.html · https://konvajs.org/docs/sandbox/Objects_Snapping.html
- Konva vs Fabric comparisons: https://konvajs.org/docs/guides/best-canvas-library.html · https://dev.to/lico/react-comparison-of-js-canvas-libraries-konvajs-vs-fabricjs-1dan · https://www.oreateai.com/blog/konvajs-vs-fabricjs-choosing-your-canvas-companion/9d255e8dbd093ab89c868295b2d20187
- Fabric v6 / license: https://fabricjs.com/docs/upgrading/upgrading-to-fabric-60/ · https://github.com/fabricjs/fabric.js/releases · https://github.com/fabricjs/fabric.js/blob/master/LICENSE
- Paper.js: http://paperjs.org/examples/boolean-operations/ · https://paperjs.org/reference/pathitem/ · https://github.com/paperjs/paper.js
- tldraw license/pricing: https://tldraw.dev/pricing · https://tldraw.dev/community/license · https://github.com/tldraw/tldraw

Curves & geometry
- perfect-freehand: https://github.com/steveruizok/perfect-freehand · https://www.npmjs.com/package/perfect-freehand
- Bézier/Catmull-Rom primer: https://pomax.github.io/bezierinfo/ · https://dev.to/ndesmic/splines-from-scratch-catmull-rom-3m66
- polygon-clipping / martinez / clipper: https://github.com/mfogel/polygon-clipping · https://github.com/w8r/martinez · https://github.com/junmer/clipper-lib · https://www.angusj.com/clipper2/Docs/Overview.htm

Plant symbols (CAD blocks — verify license)
- https://www.freecads.com/cad-category/landscape/ · https://dwgshare.com/47-free-cad-blocks-tree-plant-symbols-for-plan-view/ · https://www.firstinarchitecture.co.uk/free-cad-blocks-plants-and-shrubs/ · https://www.appiscad.com/product-category/landscape/

Export
- svg2pdf.js: https://github.com/yWorks/svg2pdf.js/ · https://github.com/yWorks/svg2pdf.js/issues/95

Persistence / undo
- Dexie vs idb vs localForage: https://www.pkgpulse.com/guides/dexie-vs-localforage-vs-idb-indexeddb-browser-storage-2026 · https://dexie.org/
- Undo/redo: https://konvajs.org/docs/react/Undo-Redo.html · https://refactoring.guru/design-patterns/memento/java/example

---

### Verification notes
- **Verified from fetched sources:** Konva latest v10.3.0 (~Apr 2026, releases page); Konva MIT + serialization behavior (handlers/images not serialized); Paper.js last tagged release v0.12.15 Mar 2021 + MIT + boolean op names; Fabric v6 TS rewrite + MIT; tldraw custom license + ~$6k/yr commercial; polygon-clipping MIT + Martinez algorithm + FP round-off guards; perfect-freehand MIT + getStroke/getSvgPathFromStroke; jsPDF paper-size/mm constructor + svg2pdf `doc.svg()` API + text-scaling issue #95.
- **`[unverified]` / verify before shipping:** exact current Fabric npm version; simplify.js current version; svg2pdf.js exact LICENSE text; any specific permissively-licensed SVG plant-symbol library (none clearly found); Konva's documented "max layers" guidance; Pixi feature claims (not separately fetched). Version/date strings drift — re-check at implementation time.
