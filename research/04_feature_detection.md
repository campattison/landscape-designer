# Feature Detection from Aerial/Satellite Imagery for a Web App

Research brief for the Landscape Designer app: a user drops in a satellite image of their property and the app identifies site features (building footprints, driveways, sidewalks, pools, trees, lawn) so they can design a garden to scale.

Compiled 2026-07-14 from web research. Numbers are cited to sources; where a figure is my own inference it is marked **(estimate)**.

---

## TL;DR ranked recommendation for a one-developer v1

1. **Vector-footprint fetch when the address/location is known** (OSM Overpass + Microsoft/Google Open Buildings). Free, no ML, instant, and gives you a real-world-scale building polygon. Best cost/value ratio. Fails on new construction, sheds, and — critically — does *not* give you driveways/sidewalks/pools.
2. **Click-prompt SAM in the browser** (transformers.js SlimSAM, or ONNX MobileSAM/SAM2-tiny via onnxruntime-web + WebGPU) for everything the vector data misses: driveway, pool, lawn beds, individual features. Point-click UX (left click = include, right click = exclude) → mask.
3. **Magic-wand color segmentation** (`magic-wand-tool`, MIT, tiny) as a zero-model fallback. Lawn-vs-pavement and pool-vs-surroundings are often color-separable, and flood-fill is instant on any hardware.
4. **Manual snap-assisted polygon tracing** as the always-available floor. Every auto method needs an editable-polygon fallback anyway.
5. **Trees: click-to-place-circle**, not ML. Individual-crown detectors (DeepForest) are Python-only and resolution-sensitive; a manual circle tool is faster to build and more reliable for a single yard.

Mask→polygon for all of the above: **marching squares → Douglas–Peucker simplification → optional orthogonalization for buildings**. `magic-wand-tool` already emits contours; OpenCV.js `approxPolyDP` handles simplification if you pull in OpenCV.

Server-side SAM (Replicate ~$0.01/run) and commercial aerial-AI APIs (Nearmap/Ecopia/EagleView, Google Solar) are viable later but add per-call cost, keys, and (for the commercial ones) sales-contact friction. Keep them out of v1.

---

## 1. In-browser ML: Segment Anything family

### What runs in the browser today

- **transformers.js** (Hugging Face, `@xenova/transformers`) added SAM support in **v2.14**, running high-quality mask generation entirely client-side, no server. [Xenova announcement](https://huggingface.co/posts/Xenova/240458016943176), [transformers.js repo](https://github.com/xenova/transformers.js/)
- Live demo: **Xenova/segment-anything-web** — point-prompt UX where **left click = positive point, right click = negative point**. [Demo](https://xenova-segment-anything-web.static.hf.space/), [demo collection](https://huggingface.co/collections/Xenova/transformersjs-demos)
- **WebGPU + fp16** support means up to **~8x faster image encoding** vs WASM/CPU, per Xenova. [Announcement](https://huggingface.co/posts/Xenova/240458016943176)
- Other working browser ports: [sunu/SAM-in-Browser](https://github.com/sunu/SAM-in-Browser) (SAM, 100% client, onnxruntime-web), [lucasgelfond/webgpu-sam2](https://github.com/lucasgelfond/webgpu-sam2) (SAM2 fully in-browser via WebGPU), [WebSAM by Xevion](https://xevion.dev/projects/websam).

### Model variants and sizes

| Model | Encoder params | Notes | File size |
|---|---|---|---|
| SAM ViT-H (full) | 637M | Original Meta encoder; heavyweight | Large weights **878 MB**; quantized ONNX encoder **~108 MB** |
| SAM2 hiera-tiny | — | Used by browser SAM2 demos | decoder `sam2_hiera_tiny_decoder.onnx` **~15 MB** |
| **MobileSAM** | **5M** (Tiny-ViT) | **>60x smaller** than ViT-H, "performs on par" per authors | encoder is small; see repo |
| **SlimSAM** | **5.5M** (from 637M, **>100x** compression) | Lower quality but **runs on CPU when WebGPU unavailable**; used in browser image editors | small |

Sources: [Medium: SAM2 in browser](https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92), [MobileSAM repo](https://github.com/chaoningzhang/mobilesam), [Ultralytics MobileSAM docs](https://docs.ultralytics.com/models/mobile-sam), [Xenova announcement (SlimSAM 637M→5.5M)](https://huggingface.co/posts/Xenova/240458016943176).

Architecturally, SAM = a **heavyweight ViT image encoder** (runs once per image, dominates inference time) + a **lightweight prompt-guided mask decoder** (runs per click, near-instant). This split is what makes interactive point-prompt UX viable: encode once on image load, then each click is cheap. [RepViT-SAM](https://arxiv.org/pdf/2312.05760)

### Realistic performance

- Full **ViT-H encoding fully client-side is "completely impractical, taking minutes per image"** — which is why Meta's own demo encodes server-side. Use a *small* encoder (MobileSAM / SlimSAM / SAM2-tiny) for client-side. [Xenova announcement](https://huggingface.co/posts/Xenova/240458016943176)
- Published encoder timing (CPU, Intel Core i7-13700H, 32 GB RAM): **SAM-2 Large ≈ 5.59 s per image**; SAM-2 Tiny and EfficientViT-SAM-l2 are "significantly" faster with much smaller size. [SAMJ arXiv](https://arxiv.org/pdf/2506.02783)
- SAM2 constraint: inputs must be **1024×1024**, outputs are **256×256 masks** (you upscale). [Medium SAM2 browser](https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92)
- WebGPU vs WASM in transformers.js generally: WebGPU is dramatically faster where the GPU/browser support exists. [SitePoint benchmark](https://www.sitepoint.com/webgpu-vs-webasm-transformers-js/)
- Known gap: the Xenova segment-anything-web demo has reported **failures on iPhone/mobile Safari**. [Issue #801](https://github.com/xenova/transformers.js/issues/801) — plan a non-WebGPU fallback for mobile.

**Estimate:** on a mid-range laptop with WebGPU, a small-encoder SAM should encode a property image in roughly **1–3 s (estimate)**, then respond to clicks in well under a second. On CPU/WASM expect several seconds to encode and possibly sluggish first paint. Verify on target hardware before committing.

### Licensing

Meta SAM/SAM2 weights are Apache-2.0 (SAM) / permissive research-friendly licenses; MobileSAM and SlimSAM inherit permissive licenses. The transformers.js runtime is Apache-2.0. Confirm the exact license of whichever ONNX export you ship — Xenova's Hugging Face model cards state it per-model.

---

## 2. Server-side / API options

| Option | What it gives | Cost | Setup burden |
|---|---|---|---|
| **Replicate `meta/sam-2`** | Promptable segmentation via HTTP API | **~$0.0099/run (≈101 runs/$1)**, varies by input | Low — API key, POST image + prompt. [Replicate](https://replicate.com/meta/sam-2) |
| **Roboflow Inference (SAM/SAM2/SAM3)** | Hosted SAM inference, workflows, label-assist; "performs well on aerial" | Free tier + usage-based on paid plans; SAM3 training on paid plans | Low-medium. [Roboflow SAM docs](https://inference.roboflow.com/foundation/sam/), [SAM2](https://docs.roboflow.com/deploy/supported-models/sam2), [SAM3 launch](https://blog.roboflow.com/sam3/) |
| **HF Inference Endpoints** | Any SAM checkpoint as a managed endpoint | Pay for dedicated GPU time | Medium — provision + manage endpoint |
| **Google Solar API `buildingInsights`** | Roof segments + **building ground footprint** for a geocoded address | **Free ≤10,000 req/mo**, then tiered pay-as-you-go; 600 qpm cap | Low — Google Cloud key. [Building insights](https://developers.google.com/maps/documentation/solar/building-insights), [usage & billing](https://developers.google.com/maps/documentation/solar/usage-and-billing) |
| **Nearmap AI Feature API / Ecopia** | Vector building footprints + transportation planimetrics (roads, driveways, sidewalks) from 3–7 cm imagery, 87% of US pop | **Enterprise, contact-sales, no public pricing** | High — commercial contract. [Nearmap AI](https://www.nearmap.com/artificial-intelligence), [Nearmap dev](https://developer.nearmap.com/), [Ecopia×Nearmap transportation data](https://www.prnewswire.com/news-releases/ecopia-ai-and-nearmap-launch-off-the-shelf-advanced-transportation-feature-data-across-north-america-302665103.html) |
| **EagleView** | Property/roof measurements from aerial | Enterprise, no public pricing | High |

Notes:
- **Google Solar API is the standout "free-ish" server option**: give it a lat/lng and it returns a roof-segmented building plus a ground footprint, with a genuinely generous free cap (10k/month). It does **not** give driveways/sidewalks/lawn — it is roof/solar-focused. Google offered a $200/mo credit until Feb 28 2025; that was replaced March 1 2025 by per-SKU free usage caps. [release/pricing changes](https://nicolalazzari.ai/articles/understanding-google-maps-apis-a-comprehensive-guide-to-uses-and-costs)
- Nearmap/Ecopia are the only sources that ship **off-the-shelf driveway + sidewalk vectors** at scale, but they are enterprise-priced and require a sales conversation — overkill for v1.

---

## 3. Vector-data shortcut (no ML at all) — strongest v1 primitive

Fetch existing building footprints for the property's location and project them onto the image.

### Sources

- **OSM Overpass API** — query existing OSM `building=*` polygons in a bbox around the geocoded address. Free, instant, editable geometry. [Overpass building query discussion](https://community.openstreetmap.org/t/building-footprint-using-openstrret-map-overpass-api/142733), [how-to](https://sryhandiniputeri.medium.com/how-to-download-building-footprints-from-open-street-maps-osm-6abc189574f7)
- **Microsoft Global Building Footprints** — ML-derived, **1.2 billion footprints as of Dec 2025**, statewide/partitioned downloads (GitHub / Planetary Computer). [OSM wiki](https://wiki.openstreetmap.org/wiki/Microsoft_Building_Footprint_Data), [US footprints repo](https://github.com/microsoft/USBuildingFootprints)
- **VIDA Google-Microsoft-OSM combined** — merged worldwide dataset, each footprint labeled by source. [source.coop/vida](https://source.coop/vida/google-microsoft-osm-open-buildings)
- County/municipal GIS parcel + building layers where available (varies wildly by county; not worth building against for v1 nationally).

### Licensing

Microsoft footprints and the combined Google/Microsoft/OSM datasets are **ODbL v1.0** (same as OSM): **commercial use OK with attribution**. Some merged layers add CC-BY-4.0. You must display attribution. [MS license](https://wiki.openstreetmap.org/wiki/Microsoft_Building_Footprint_Data), [combined license](https://source.coop/vida/google-microsoft-osm-open-buildings)

### Projection math

Reproject footprint lat/lng vertices into the image's pixel space via **Web Mercator (EPSG:3857)**. If you render the base image from a slippy-map/tile source you already know the zoom + tile origin, so the pixel transform is deterministic. For a user-uploaded arbitrary image you need a georeference (at minimum a center lat/lng + zoom, or two control points) before footprints can be overlaid.

### When it works / fails

- **Works well:** established suburban/urban houses with a clean main structure. Instant, real scale, one polygon.
- **Fails:** **new construction** (not yet mapped/detected), **sheds/detached garages/outbuildings** (often missing), footprint **misalignment vs the specific image** (imagery offset), and — the big one for a garden app — **driveways, sidewalks, patios, pools, and lawn are essentially never in these datasets.** OSM does have `highway=service` + `service=driveway` and sidewalk tags, but **residential driveway/sidewalk coverage is sparse and inconsistent** because mapping every driveway/sidewalk is enormous manual effort. [OSM driveway tagging](https://help.openstreetmap.org/questions/50139/tagging-residential-driveways), [OSM sidewalks wiki](https://wiki.openstreetmap.org/wiki/Sidewalks)

**Conclusion:** vector footprints solve the *building* cheaply and well; you still need SAM/magic-wand/manual for everything else.

---

## 4. Semi-automatic UX fallbacks (CV, no ML server)

- **Magic-wand / flood-fill color segmentation** — `magic-wand-tool` (npm), aka **Tamersoul/magic-wand-js**, **MIT license**, tiny, pure-JS. Creates binary masks *and* contours (vector) from raster by color similarity, with adjustable tolerance. Ideal for **lawn vs pavement** and **pool vs deck**, which are often color-separable. Instant on any hardware, no model download. [repo](https://github.com/Tamersoul/magic-wand-js), [npm](https://www.npmjs.com/package/magic-wand-tool)
- **Intelligent Scissors / magnetic lasso** — OpenCV.js ships `cv::segmentation::IntelligentScissorsMB`, which snaps a contour to strong edges between two clicked points; used in the CVAT annotation tool. Good for tracing driveway/bed edges. Caveat: OpenCV.js is a **heavy WASM download** and interactive edge-following can lag unless you gate updates to "mouse stopped moving." [OpenCV.js intelligent scissors tutorial](https://docs.opencv.org/4.x/d9/df5/tutorial_js_intelligent_scissors.html), [class ref](https://docs.opencv.org/4.x/df/d6b/classcv_1_1segmentation_1_1IntelligentScissorsMB.html), [CVAT PR](https://github.com/cvat-ai/cvat/pull/2689)
- **Manual snap-assisted polygon tracing** — always-available floor; every auto path should drop into an editable polygon so the user can nudge vertices.

**OpenCV.js cost note:** the full build is large and DNN-based ops are heavy in JS/browser. If you only need magic-wand + contour + `approxPolyDP`, prefer `magic-wand-tool` + a small marching-squares/RDP helper over shipping all of OpenCV.js. Pull in OpenCV.js only if you specifically want Intelligent Scissors. [CVAT OpenCV.js perf issue](https://github.com/openvinotoolkit/cvat/issues/2800)

---

## 5. Tree detection

- **DeepForest** (weecology) is the standard: a Python package that predicts **bounding boxes for individual tree crowns** in high-res RGB, pretrained on ~30M generated crowns + 10k hand-labeled from NEON. **Python only — no browser build.** [repo](https://github.com/weecology/DeepForest), [MEE paper](https://besjournals.onlinelibrary.wiley.com/doi/10.1111/2041-210X.13472)
- Urban accuracy: **~75–85% vs municipal inventories (Amsterdam, Boston)**, but **highly sensitive to resolution, image quality, and season** (leaf-off / stale imagery hurts). [DeepForest tutorial book](https://acocac.github.io/environmental-ai-book/forest/modelling/forest-modelling-treecrown_deepforest.html)
- To use DeepForest you'd run it **server-side** (Python endpoint) and return boxes — extra infra, and the accuracy caveats make it a shaky auto-feature for a single yard where the user knows exactly where their trees are.

**Recommendation:** for v1, **click-to-place-circle** with a draggable radius. It's a few hours of UI work, 100% reliable, and matches how a homeowner thinks about "my three trees." Revisit server-side DeepForest only if users demand bulk auto-detection over many trees.

---

## 6. Mask → editable vector pipeline

Standard, well-trodden pipeline (same one used in academic building-extraction work):

1. **Marching squares** — trace the binary mask boundary into a contour. (`magic-wand-tool` already returns contours; otherwise a small marching-squares routine or OpenCV.js `findContours`.)
2. **Douglas–Peucker (Ramer–Douglas–Peucker) simplification** — reduce the dense contour to a clean vertex set. Options: OpenCV.js `approxPolyDP`, or a standalone JS RDP (`simplify-js` by mourner is the common lightweight choice — MIT, ~a few KB). [RDP/marching-squares baseline](https://openaccess.thecvf.com/content/CVPR2021/papers/Girard_Polygonal_Building_Extraction_by_Frame_Field_Learning_CVPR_2021_paper.pdf), [RDP explainer](https://medium.com/data-science/simplify-polylines-with-the-douglas-peucker-algorithm-ac8ed487a4a1)
3. **Building orthogonalization / regularization (buildings only)** — snap edges to orthogonality/parallelism so the footprint looks architectural rather than blobby. Academic pipelines do line-extraction → adjustment → regularization; for v1 a simpler "square up nearly-90° corners / snap to dominant axis" heuristic is enough. [PolyBuilding](https://arxiv.org/pdf/2211.01589), [Frame Field Learning](https://openaccess.thecvf.com/content/CVPR2021/papers/Girard_Polygonal_Building_Extraction_by_Frame_Field_Learning_CVPR_2021_paper.pdf)

Driveways/lawn/pool beds should **not** be orthogonalized — keep the RDP-simplified organic polygon.

> Note: **simplify-js** (mourner) is a real, widely-used MIT library, but my search hits for it were indirect (the polygon-simplification searches surfaced RDP theory and JTS/OpenCV rather than the simplify-js repo itself). Treat the specific "few KB" size as **(estimate)** until you check its npm page directly.

---

## Concrete v1 build recommendation

**Pipeline the app should run when a user drops an image:**

1. If a location/address is attached → **geocode → Overpass + MS/Google Open Buildings fetch → project footprint via Web Mercator** → show building polygon (editable). Attribute ODbL. *(No ML, instant.)*
2. **Load a small-encoder SAM** (transformers.js SlimSAM, or ONNX MobileSAM/SAM2-tiny + onnxruntime-web with WebGPU, WASM fallback) and encode the image once in the background. User clicks the driveway → mask → polygon. Left-click include / right-click exclude.
3. **`magic-wand-tool`** button for lawn/pool/pavement color selection — zero model, works on mobile where WebGPU SAM may fail.
4. Every result flows through **marching squares → RDP simplify → (buildings only) orthogonalize** into an **editable polygon**; manual vertex editing always available.
5. **Trees = click-to-place-circle**, draggable radius. No ML.

Defer to later: server-side SAM on Replicate (~$0.01/run) for heavy cases, Google Solar API for roof detail, and Nearmap/Ecopia only if you go enterprise.

**Model files to actually ship (verify exact sizes/licenses on the model cards before bundling):**
- transformers.js SlimSAM (auto-downloaded from HF CDN; smallest, CPU-capable) — or
- ONNX MobileSAM encoder + decoder, or SAM2-tiny decoder (~15 MB) + a small encoder, served from your CDN or jsDelivr.
- `magic-wand-tool` (npm, MIT), `simplify-js` (npm, MIT), optional OpenCV.js (large — only if you want Intelligent Scissors).

---

## Sources

- [Xenova: transformers.js v2.14 SAM / SlimSAM / WebGPU](https://huggingface.co/posts/Xenova/240458016943176)
- [Xenova segment-anything-web live demo](https://xenova-segment-anything-web.static.hf.space/)
- [transformers.js repo](https://github.com/xenova/transformers.js/) · [demos collection](https://huggingface.co/collections/Xenova/transformersjs-demos) · [mobile Safari issue #801](https://github.com/xenova/transformers.js/issues/801)
- [Geronimo — SAM2 in the browser (model sizes)](https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92)
- [sunu/SAM-in-Browser](https://github.com/sunu/SAM-in-Browser) · [lucasgelfond/webgpu-sam2](https://github.com/lucasgelfond/webgpu-sam2) · [Lucas Gelfond writeup](https://lucasgelfond.online/software/webgpu-sam2/) · [WebSAM](https://xevion.dev/projects/websam)
- [MobileSAM repo](https://github.com/chaoningzhang/mobilesam) · [Ultralytics MobileSAM](https://docs.ultralytics.com/models/mobile-sam) · [Kornia MobileSAM](https://kornia.readthedocs.io/en/latest/models/mobile_sam.html)
- [RepViT-SAM (encoder/decoder split)](https://arxiv.org/pdf/2312.05760) · [SAMJ (SAM-2 Large 5.59s CPU timing)](https://arxiv.org/pdf/2506.02783) · [Labelbox SAM2-in-browser](https://labelbox.com/blog/bringing-ai-to-the-browser-sam2-for-interactive-image-segmentation/) · [WebGPU vs WASM benchmark](https://www.sitepoint.com/webgpu-vs-webasm-transformers-js/)
- [Replicate meta/sam-2 (~$0.0099/run)](https://replicate.com/meta/sam-2)
- [Roboflow SAM inference](https://inference.roboflow.com/foundation/sam/) · [SAM2 docs](https://docs.roboflow.com/deploy/supported-models/sam2) · [SAM3 launch](https://blog.roboflow.com/sam3/)
- [Google Solar API building insights](https://developers.google.com/maps/documentation/solar/building-insights) · [usage & billing (free caps)](https://developers.google.com/maps/documentation/solar/usage-and-billing) · [buildingInsights.findClosest reference](https://developers.google.com/maps/documentation/solar/reference/rest/v1/buildingInsights/findClosest) · [Maps pricing changes 2025](https://nicolalazzari.ai/articles/understanding-google-maps-apis-a-comprehensive-guide-to-uses-and-costs)
- [Nearmap AI](https://www.nearmap.com/artificial-intelligence) · [Nearmap developer](https://developer.nearmap.com/) · [Ecopia×Nearmap transportation planimetrics](https://www.prnewswire.com/news-releases/ecopia-ai-and-nearmap-launch-off-the-shelf-advanced-transportation-feature-data-across-north-america-302665103.html)
- [OSM Overpass building query](https://community.openstreetmap.org/t/building-footprint-using-openstrret-map-overpass-api/142733) · [OSM building download how-to](https://sryhandiniputeri.medium.com/how-to-download-building-footprints-from-open-street-maps-osm-6abc189574f7)
- [Microsoft Building Footprint Data (ODbL, 1.2B)](https://wiki.openstreetmap.org/wiki/Microsoft_Building_Footprint_Data) · [US footprints repo](https://github.com/microsoft/USBuildingFootprints) · [VIDA combined dataset (license)](https://source.coop/vida/google-microsoft-osm-open-buildings)
- [OSM driveway tagging](https://help.openstreetmap.org/questions/50139/tagging-residential-driveways) · [OSM sidewalks wiki](https://wiki.openstreetmap.org/wiki/Sidewalks)
- [magic-wand-js (Tamersoul)](https://github.com/Tamersoul/magic-wand-js) · [magic-wand-tool npm (MIT)](https://www.npmjs.com/package/magic-wand-tool)
- [OpenCV.js Intelligent Scissors tutorial](https://docs.opencv.org/4.x/d9/df5/tutorial_js_intelligent_scissors.html) · [IntelligentScissorsMB class](https://docs.opencv.org/4.x/df/d6b/classcv_1_1segmentation_1_1IntelligentScissorsMB.html) · [CVAT PR](https://github.com/cvat-ai/cvat/pull/2689) · [OpenCV.js perf issue](https://github.com/openvinotoolkit/cvat/issues/2800)
- [DeepForest repo](https://github.com/weecology/DeepForest) · [DeepForest MEE paper](https://besjournals.onlinelibrary.wiley.com/doi/10.1111/2041-210X.13472) · [DeepForest tutorial (urban accuracy)](https://acocac.github.io/environmental-ai-book/forest/modelling/forest-modelling-treecrown_deepforest.html)
- [Frame Field Learning (marching squares + RDP baseline)](https://openaccess.thecvf.com/content/CVPR2021/papers/Girard_Polygonal_Building_Extraction_by_Frame_Field_Learning_CVPR_2021_paper.pdf) · [PolyBuilding (orthogonality)](https://arxiv.org/pdf/2211.01589) · [Douglas–Peucker explainer](https://medium.com/data-science/simplify-polylines-with-the-douglas-peucker-algorithm-ac8ed487a4a1)
