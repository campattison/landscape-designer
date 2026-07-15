# Landscape Designer

Web app: get a satellite/aerial image of your property (address search or drop a screenshot) → the app establishes real-world scale and helps identify site features (buildings, driveways, lawns, trees) → design your garden **to scale** with professional landscape-plan conventions → export a print-scale PDF plan with title block and plant schedule.

## Run

```bash
cd "2026-7/Landscape_Designer/app"
python3 -m http.server 8377 --bind 127.0.0.1
# open http://127.0.0.1:8377
```

No build step, no keys, no accounts. Everything runs in the browser; projects autosave to IndexedDB and save/load as `.json` files.

## What it does (v1)

- **Address search** → Esri World Imagery tiles at z19–20 (tracing expressly permitted with attribution; detects Esri's "no data" placeholder tiles and steps down zoom), scale set **deterministically** from Web-Mercator math — no calibration needed.
- **Drop/paste an image** → calibrate by drawing a line over one known dimension (±2–5%). Oblique imagery warned against.
- **Fetch building footprints** → OSM Overpass (with mirror fallback), projected onto the image in feet.
- **Site capture**: magic-wand color segmentation (click a lawn/roof/pavement region → auto-traced polygon), manual polygon tracing with angle snap + building squaring, click-to-place existing trees.
- **Design**: freehand planting beds (auto-smoothed), hardscape with scale-true material hatches (pavers/brick/flagstone/gravel/mulch/deck/concrete), plants from an 419-species database (sizes verified against extension sources; photos, native-region + zone + edible filters, custom plants) drawn as **circles at mature spread with center dots** — deciduous scalloped, evergreen spiky; groundcover area fills with o.c.-spacing quantity math.
- **Plan furniture**: auto plant schedule (keys from botanical initials, quantities live), labels with leaders, dimensions, north arrow, dynamic scale bar.
- **Export**: PDF at true engineer's scale (1″=8/10/16/20/30/40′) on Letter/Tabloid/Arch D with title block, scale bar, north arrow, attribution + not-survey-grade disclaimer, and a plant-schedule sheet; PNG; CSV schedule; JSON project.
- Undo/redo, 6-layer visibility/locking, vertex editing, keyboard shortcuts (V/H/C/T/W/E/B/S/P/G/L/D, Esc/Enter/Delete, ⌘Z).

## Design decisions (see ARCHITECTURE.md + research/)

- **Google imagery deliberately unsupported** — Google ToS prohibits digitizing building outlines. Esri/NAIP are the legal tracing sources.
- World coordinates are **feet** end to end; the Konva stage transform is only a view. Document format is our own JSON, never Konva serialization.
- Plant symbols generated parametrically (no permissively-licensed symbol library exists).
- v2 candidates in TODO.md: browser SAM click-segmentation, parcel lines, NAIP tier, sun/shade zoning.

## Sharing

The app is fully client-side: zip the `app/` folder and send it — recipients run `python3 -m http.server 8377` inside it (or any static server) and open localhost. First-time visitors get a quick-start welcome dialog (auto-shows twice, then lives behind the ? button).

## Verify

```bash
python3 tests/smoke_test.py          # 20 assertions, offline (needs Pillow + playwright)
python3 tests/address_flow_test.py   # live: Nominatim → Esri → Overpass
```

## Structure

- `app/` — the application (vanilla JS + vendored libs, no build)
- `research/` — 5 pre-build research reports with sources (existing tools, professional drafting practice, satellite→scale + licensing, feature detection, canvas tech)
- `tests/` — playwright regression suite + reference screenshots
