# Landscape Designer — TODO

## v1 (shipped 2026-07-14, session 7703)
- [x] Research phase (5 reports in research/)
- [x] ARCHITECTURE.md synthesis
- [x] App: image entry (address/drop/paste), calibration, tracing, wand, beds, hardscape, plants, schedule, export, persistence, undo
- [x] Verified: 20/20 offline smoke + live address→imagery→footprints flow
- [ ] **Cameron review checkpoint** — try it on the house; direction feedback before more building

## v1.x polish candidates
- [ ] Print a PDF at 1″=10′ and tape-measure the scale bar (verify physical print scale)
- [ ] Plant search by attribute (native-only filter, sun filter)
- [ ] Bed boolean ops (bed minus hardscape) — polygon-clipping is vendored but unused
- [ ] Snap-to-footprint edges when drawing beds/hardscape
- [ ] Mobile/touch pass (pinch zoom)

## v2 candidates (from research/04)
- [ ] Browser SAM (SlimSAM via transformers.js) click-prompt segmentation as a progressive enhancement over the magic wand
- [ ] USGS NAIP imagery tier (public domain) + county parcel lines
- [ ] Sun/shade zone painting + right-plant-right-place warnings
- [ ] Cost take-offs from hardscape areas + plant schedule
