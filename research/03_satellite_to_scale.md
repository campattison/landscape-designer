# Satellite/Aerial Imagery to Real-World Scale — Research Report

**Topic:** Establishing accurate real-world scale (feet/meters per pixel) for user-supplied or app-fetched imagery, so a garden-design web app produces dimensionally correct drawings.

**Date:** 2026-07-14
**Author:** research worker (delegated task)

> Scope note: This report covers the georeferencing/scale math, imagery source terms and licensing, manual calibration approaches, address→parcel/footprint data, and accuracy realities. ToS/pricing terms are quoted or closely paraphrased from sources found via web search; unverified items are marked `[unverified]`.

---

## 1. Web Mercator Math — Ground Resolution

### The standard formula

Nearly all consumer web maps (Google, Bing, Mapbox, Esri, OSM) use the **Web Mercator / Spherical Mercator** projection (EPSG:3857) with a **256×256-pixel tile scheme**. Ground resolution (meters per pixel) is:

```
metersPerPixel = 156543.03392 * cos(latitude_radians) / (2 ^ zoom)
```

where `latitude_radians = latitude_degrees * π / 180`.

- **156543.03392** = ground distance per pixel at zoom 0 on the equator. It derives from the earth's circumference at the assumed sphere radius **R = 6378137 m** (WGS84 semi-major axis): `2π·R / 256 = 40075016.686 / 256 ≈ 156543.03`.
- **cos(latitude)** corrects for Web Mercator's east-west stretch, which grows toward the poles. Scale is only true at the equator; at higher latitudes each pixel covers *less* real ground than the raw z0 constant implies.
- **2^zoom** encodes the standard doubling of resolution per zoom level (each zoom quarters the ground area per pixel).

Source constant and formula confirmed by [Bing Maps "Understanding Scale and Resolution" (Microsoft Learn)](https://learn.microsoft.com/en-us/bingmaps/articles/understanding-scale-and-resolution) and [perrygeo Web Mercator scale gist (GitHub)](https://gist.github.com/perrygeo/4478844). Some sources round the constant to `156543.04`; the difference is negligible (<1 mm/px at residential zooms).

Note: this is for **256 px tiles**. Retina/512 px tiles (Mapbox `@2x`, etc.) halve the meters/pixel again — treat a 512 px tile at zoom Z as equivalent resolution to zoom Z+1. Always confirm the tile size of whatever you actually fetch.

### Zoom → resolution table (256 px tiles)

Meters/pixel at the equator (cos = 1), and at latitude 36° N (Nashville, cos ≈ 0.809):

| Zoom | m/px @ equator | m/px @ 36° N | ~ft/px @ 36° N | Notes |
|-----:|---------------:|-------------:|---------------:|-------|
| 17 | 1.194 | 0.966 | 3.17 | too coarse for design |
| 18 | 0.597 | 0.483 | 1.58 | rough site outline only |
| 19 | 0.299 | 0.242 | 0.79 | minimum usable for residential |
| 20 | 0.149 | 0.121 | 0.40 | good residential detail (~4.7 in/px) |
| 21 | 0.0746 | 0.0604 | 0.20 | excellent, where available (~2.4 in/px) |
| 22 | 0.0373 | 0.0302 | 0.10 | rarely available as real imagery |

Worked example at z20, lat 36°: `156543.03392 · cos(36°) / 2^20 = 156543.03392 · 0.8090 / 1048576 ≈ 0.1208 m/px`.

### What zoom is needed for residential design accuracy

- **z19** is the practical floor (~0.24 m/px ≈ 9.5 in/px at mid-US latitudes). Fine for bed layouts and hardscape masses; individual small plants blur.
- **z20** (~0.12 m/px ≈ 4.7 in/px) is the sweet spot for residential garden design — you can resolve walkway edges, individual shrubs, patio joints.
- **z21** (~0.06 m/px) is ideal but **not universally available**; many areas top out at z20 for genuine (non-upsampled) imagery. Above the max native zoom, providers serve *interpolated/upsampled* tiles — the reported zoom keeps climbing but real ground resolution does not improve. Always sanity-check whether z21+ imagery is real or stretched.

**Key point for the app:** if you fetch tiles at a known lat and zoom, the scale is *deterministic* from the formula — no user calibration needed. Scale ambiguity only arises when a user pastes an arbitrary screenshot with unknown zoom/crop (see §3).

---

## 2. Imagery Sources & Their Terms

The critical legal question for a tracing app: **does the license permit creating measured drawings / derived vector geometry from the imagery?** This is where the sources differ sharply.

### Google Maps Static API & Google Solar API — DO NOT TRACE

- **Static Maps pricing:** ~**$2.00 per 1,000 requests**; Essentials-tier SKUs get **10,000 free events/month**, then $2–$7 per 1,000. The old flat $200/month credit was replaced on **March 1, 2025** with per-SKU free caps. Sources: [Maps Static API Usage and Billing (Google)](https://developers.google.com/maps/documentation/maps-static/usage-and-billing), [Google Maps Platform pricing](https://mapsplatform.google.com/pricing/).
- **Solar API:** Building Insights sits in the Environment/Environment-APIs tier with a **10,000 free cap**, then usage-based; **Data Layers** has a much smaller **1,000 free cap** and is significantly more expensive. Data Layers returns GeoTIFFs including an **RGB overhead image and a DSM at 0.1 m/px** (0.25 m/px for high-altitude-derived areas), plus roof-segment geometry via Building Insights. Sources: [Solar API Usage and Billing (Google)](https://developers.google.com/maps/documentation/solar/usage-and-billing), [Solar API Data Layers (Google)](https://developers.google.com/maps/documentation/solar/data-layers).
- **TERMS — tracing prohibited.** The Google Maps Platform Terms state (closely paraphrased/quoted from [Google Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) and [Google Maps APIs ToS](https://developers.google.com/maps/terms-20180207)):
  - *"You will not modify or create a derivative work based on any Content unless expressly permitted."*
  - Prohibited: *"tracing or copying the copyrightable elements of Google's maps or building outlines and creating a new work, such as a new mapping or navigation dataset."*
  - Explicitly disallowed examples: *"trace or digitize roadways, building outlines, utility posts, or electrical lines from the ... Satellite base map type"*; *"create 3D building models from 45° Imagery"*; *"build terrain models based on elevation values from the Elevation API."*

  **Implication:** Building a measured, to-scale drawing by tracing over Google satellite tiles (or Solar API RGB layers) is a **derivative-work / tracing use that Google's ToS prohibits.** Google is the *worst* legal choice for a trace-over app despite having the best consumer imagery. `[Verified against Google ToS pages above.]`

### Mapbox Satellite — non-commercial tracing only

- **Pricing:** generous free tier (e.g., **50,000 static image requests/month** cited), then pay-as-you-go tiered. Source: [Mapbox pricing (docs)](https://docs.mapbox.com/accounts/guides/pricing/).
- **TERMS (from [Mapbox Product Terms, 2025](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/68dddd2815cb3d82685f0096_Mapbox%20Product%20Terms%20(October%201,%202025).pdf)):** Customers *"shall not trace or otherwise derive or extract content ... from the Services,"* **except** they *"may use Studio or third-party software to trace Mapbox Maps solely comprised of satellite imagery and produce derivative vector datasets for **non-commercial purposes**."* Mapbox also prohibits using its imagery to improve the accuracy of *other* imagery.
  - **Implication:** Tracing Mapbox Satellite is permitted **only for non-commercial** output. A paid/commercial garden-design product would fall outside this carve-out. Usable for a free/hobby v1; risky for a monetized app. `[Verified against Mapbox Product Terms PDF.]`

### Esri World Imagery — tracing EXPRESSLY PERMITTED

- **TERMS (from the [Esri World Imagery "Uses Permitted" item on ArcGIS Online](https://www.arcgis.com/home/item.html?id=8e90a00a0a6845a49262e0b756f57a10)):** *"Esri and its imagery contributors grant Users the non-exclusive right to use the World Imagery map to **trace features and validate edits in the creation of vector data**."* Users may publicly share vector data created this way through ArcGIS Open Data or OSM. For OSM specifically, Esri has granted use without attribution requirement.
  - **Implication:** Esri World Imagery is one of the **most trace-friendly** commercial basemaps. The permission is framed around ArcGIS/OSM workflows; for an independent web app you should still review the current [Esri Master Agreement / Web Services ToU](https://www.esri.com/en-us/legal/terms/web-site-service) and likely need an ArcGIS Location Platform/Online account and API key. Attribution to Esri + contributors is expected. `[Verified against the ArcGIS "Uses Permitted" item; commercial-app specifics [unverified] — confirm subscription tier.]`
  - Esri resolution: World Imagery reaches ~0.3 m in many US metros (from Maxar/aerial contributors), often ~15–30 cm; "Wayback" gives historical versions.

### USGS NAIP — public domain, trace freely (BEST legal option)

- **Resolution:** current NAIP is mosaicked **0.6 m** (and increasingly **0.3 m** in newer collections), 4-band (RGB+NIR), natural color, **orthorectified** (true nadir, georeferenced). Sources: [USGS NAIP ImageServer (The National Map)](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer), [USGS EROS NAIP archive](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-agriculture-imagery-program-naip).
- **License:** **public domain** (US federal government work). Free to download, use, trace, and build derived measured drawings with no license restriction. Available as a live **ArcGIS ImageServer** (tile/WMS/export) and as GeoTIFF/JPEG2000 downloads via EarthExplorer and The National Map.
  - **Implication:** NAIP is the **legally safest** imagery to trace for a commercial app — no ToS forbidding derivatives because there is no copyright. The trade-off is resolution: 0.3–0.6 m/px is roughly z19–z20 equivalent, adequate for site/bed layout but softer than Google's z20–21. It is also **leaf-on summer imagery, refreshed every ~2–3 years** per state, so it can be a year or two stale. `[Verified: public-domain status and resolution from USGS pages.]`

### State/County GIS orthophotos — usually public, often higher-res

- Many US counties/states fly their own orthophotography at **7.5 cm–15 cm (3–6 in)** resolution, typically leaf-off, updated every 1–3 years, served via ArcGIS REST ImageServer/WMS. These are generally **public records / open data** (verify per jurisdiction — most are public domain or CC-BY-like). Often **higher resolution and more current than NAIP**, and free.
  - **Implication:** For a US app, county/state ortho endpoints are a strong free+legal source where available, but coverage and access are fragmented (no single national API). `[General pattern; per-county terms [unverified] — must check each jurisdiction's data portal.]`

### Bing / Azure Maps — commercial license required

- Bing/Azure Maps aerial imagery: general license rights are *"limited solely to aerial imagery use in a non-commercial online editor application"* (i.e., the OSM-style editor carve-out). Commercial use requires a separate paid Azure Maps/Bing Maps license (one reseller cited **from $999/yr for 40,000 transactions**). Sources: [Bing Maps — OSM Wiki](https://wiki.openstreetmap.org/wiki/Bing_Maps), [OnTerra Bing Maps licensing](https://www.onterrasystems.com/bing-maps-licensing/).
  - **Implication:** Similar posture to Google — the free tracing right is scoped to non-commercial editors. Not recommended for a commercial trace-over app without a negotiated license. `[Verified pattern; exact current Azure Maps terms [unverified].]`

### Nearmap — commercial high-res, paid

- **Resolution:** HyperCamera3 vertical imagery down to **~1.5 in (≈3.8 cm) GSD**; vertical coverage for **~87% of US population**, refreshed up to 3×/year, history to 2014. Source: [Nearmap vertical imagery](https://www.nearmap.com/products/imagery/vertical).
- **Pricing/terms:** subscription, quote-based; historically expensive; licensing governs derived products. `[Exact pricing [unverified] — contact sales.]`
  - **Implication:** Best-in-class currency and resolution; appropriate for a premium/pro tier, not a free v1. Derived-drawing rights depend on the paid license terms.

### Quick licensing verdict (trace-over legality)

| Source | Resolution | Trace/derive measured drawing? | Cost |
|--------|-----------|-------------------------------|------|
| **USGS NAIP** | 0.3–0.6 m | **YES — public domain, unrestricted** | Free |
| **State/county ortho** | 0.03–0.15 m | Usually yes (public records) — verify each | Free |
| **Esri World Imagery** | ~0.15–0.3 m | **YES — expressly granted** (attribution; check tier) | Free/paid tiers |
| **Mapbox Satellite** | ~0.3 m+ | Only **non-commercial** tracing | Free tier + PAYG |
| **Bing/Azure Maps** | ~0.3 m | Non-commercial editor only; commercial needs license | Paid |
| **Google Maps/Solar** | 0.1–0.25 m (best) | **NO — tracing/derivative works prohibited** | $2/1k + |
| **Nearmap** | ~0.04 m | Per paid license | Paid (premium) |

---

## 3. The "User Drops an Arbitrary Screenshot" Path — Manual Scale Calibration

When a user pastes a screenshot (unknown zoom, crop, provider), the app cannot derive scale from tile math. The standard solution is **calibrate-by-reference-line** (a.k.a. "set scale" / "known distance"):

### The interaction pattern

1. User loads the image.
2. User draws a line over a feature whose real length they know (driveway width, house wall from the deed/plat, a fence run, or a distance they measured in Google Maps' "Measure distance" tool).
3. User types the real-world length + units.
4. App computes `unitsPerPixel = knownLength / lineLengthInPixels` and applies that scale to all subsequent drawing/measuring.

This is exactly how measurement/CAD tools implement it:
- **PRO Landscape+** lets pros *"scale a survey, plot plan or map to create a base plan,"* drawing from their own measurements with live distance readout. Source: [PRO Landscape CAD](https://prolandscape.com/en/software/cad/).
- **iScape** is a photo-based *visualization* tool (2D/3D AR over a yard photo) and is explicitly **not CAD** — good for look-and-feel, weak for dimensional accuracy. Source: [iScape](https://www.iscapeit.com/).
- **SketchUp "Match Photo"** and generic image-based CAD (AutoCAD `SCALE`/reference, Bluebeam "Calibrate," PDF-measure tools) all use the same set-a-known-distance calibration primitive. `[SketchUp Match Photo is for perspective photos, not a pure scale set — it solves camera pose; [unverified] beyond general knowledge.]`

### Accuracy expectations & pitfalls

The reference-line method is only as good as (a) the accuracy of the known dimension and (b) the geometry of the image:

- **Nadir vs. oblique/tilt:** Calibration assumes an **orthographic, straight-down (nadir)** image where every pixel covers equal ground. In **nadir imagery** objects are not tilted and scale is uniform (slight edge distortion). In **oblique** imagery, scale varies **3× or more between the near and far edges**, so a single reference line calibrated in one part of the image is wrong elsewhere. Screenshots from Google's default satellite view are usually near-nadir; the 45° "aerial/oblique" views are **not** usable for scale. Sources: [Nadir vs. orthophoto vs. oblique (Autel)](https://www.autelpilot.com/blogs/drone-technology/nadir-orthophotography-oblique), [Scales of oblique photographs (ISPRS/ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0924271623003362).
- **Lens distortion (drone/phone shots):** Uncorrected wide-angle lenses bow straight lines; error is worst at frame edges. Drone gimbals hold nadir to ~±0.1° when stable, but wind/maneuvering induces tilt that degrades scale. Source: [Lens distortion & calibration (Prowell)](https://prowelllife.com/lens-distortion-and-calibration-how-to-correct-geometric-errors-in-aerial-images/).
- **Terrain relief:** On sloped lots, a flat-scale assumption underestimates real ground distance along the slope.
- **Shadows & occlusion:** Long shadows and tree canopy obscure edges the user needs to trace, causing them to misplace the reference endpoints.
- **Reference-length error propagates linearly:** if the known dimension is off by 5%, every drawn dimension is off by 5%. **Use the longest reliable reference available** (a long fence or property edge, not a 3-ft step) to minimize the relative error of endpoint-picking (a few px of endpoint slop on a short line is a large % error).

**Practical accuracy:** with a clean near-nadir screenshot and a good long reference dimension, users can realistically hit **±2–5%** on drawn dimensions — fine for garden layout, plant spacing, mulch/material estimates; **not** survey-grade and not suitable for fences on property lines or permit drawings.

---

## 4. Address → Parcel / Footprint Data

If you can geocode the user's address and pull vector geometry, you can seed the base plan (lot boundary + house footprint) without any tracing at all — the cleanest path.

### Parcel boundaries (lot lines)

- **County parcel GIS:** The authoritative source; most US counties publish parcels via ArcGIS REST/GeoJSON. Free, public, but **fragmented** across ~3,000 counties with no uniform schema.
- **Regrid (formerly Loveland/Landgrid):** Commercial aggregator — *"standardized parcel boundaries, ownership, addresses, zoning, building footprints"* across the US + major Canadian provinces via one API; cites **187M+ building footprints matched to parcels**. Paid API. Source: [Regrid Parcel API](https://regrid.com/api).
- **OpenStreetMap:** Does **not** systematically carry legal parcel/property boundaries (out of scope for OSM); don't rely on it for lot lines. Source: [OSM Parcel wiki](https://wiki.openstreetmap.org/wiki/Parcel).
- **Caveat:** Parcel polygons are **cadastral/tax-map geometry, not survey-accurate.** They routinely differ from a legal survey by several feet and must not be presented as authoritative property lines.

### Building footprints

- **OSM via Overpass API:** Free (ODbL). Query `way["building"]` around a point; returns hand-drawn/imported footprints. Coverage is good in cities, patchy in rural areas; quality varies. Source: [Overpass API (OSM wiki)](https://wiki.openstreetmap.org/wiki/Overpass_API). Note ODbL is **share-alike** — derived databases may carry attribution/share-alike obligations.
- **Microsoft Building Footprints:** Two datasets — **US Building Footprints (~130M, ODbL)** and the newer **Global ML Building Footprints (999M global, CDLA-Permissive-2.0)**. ML-derived from satellite imagery, GeoJSON/GeoParquet, free. CDLA-Permissive-2.0 is a **very permissive** license (essentially use-as-you-like with a downstream license-notice pass-through) — friendlier for a commercial app than ODbL's share-alike. Sources: [microsoft/GlobalMLBuildingFootprints](https://github.com/microsoft/GlobalMLBuildingFootprints/), [microsoft/USBuildingFootprints](https://github.com/microsoft/USBuildingFootprints).
- **Google Open Buildings (CC-BY-4.0 / ODbL):** **Does NOT cover the US** — it targets Africa, South/SE Asia, Latin America. Not useful for a US app. Source: [Google Open Buildings](https://sites.research.google/gr/open-buildings/).

**US recommendation:** Microsoft US/Global ML Building Footprints (permissive license, national coverage) as the primary free footprint layer, with OSM Overpass as a supplement/fallback. For lot lines, use county GIS where free, or Regrid if you want one API and can pay.

### Footprint accuracy caveats

ML footprints are **roof-derived polygons** (see §5) and are generalized/simplified — good enough to seed a base plan the user then adjusts, not to publish as a measured survey.

---

## 5. Accuracy Realities & the Disclaimer the App Must Show

- **Consumer-tile positional accuracy:** Web Mercator satellite/ortho tiles are typically **~1–4 m absolute horizontal accuracy** (georegistration error) for consumer basemaps; purpose-built orthophoto can reach **~0.3–0.75 m** absolute, with relative (within-image) accuracy of **~11–15 cm**. So *relative* measurements (feature-to-feature within one clean image) are far better than *absolute* geolocation. Sources: [Aerial roof measurement accuracy (1ESX)](https://www.1esx.com/aerial-roof-measurements-guide-2026/), and orthoimagery accuracy figures cited therein. `[Consumer-tile ~1–4 m is an industry rule of thumb; exact per-provider figures [unverified].]`
- **Roof overhang vs. foundation footprint:** Overhead imagery sees the **roof edge, not the foundation.** Eaves overhang the foundation, so a footprint traced from imagery is **larger than the true foundation** — systems correct by insetting roof edges by a typical overhang (**~1.5 ft / ~0.45 m** default). For garden design (beds against the house), this offset matters: a bed measured to the roofline sits ~1.5 ft inside the drip line. Source: [building-footprint / roof-overhang patents & off-nadir footprint extraction (arXiv 2204.13637)](https://arxiv.org/pdf/2204.13637).
- **Building lean / parallax:** Anything above ground (walls, tall trees) leans away from image nadir except at the exact center; taller structures show more displacement. This shifts traced wall positions.
- **Why pros still tape-measure:** Imagery gives a fast, approximately-scaled base plan, but currency (stale imagery), overhang offset, terrain, and georegistration error mean **professionals verify critical dimensions on-site with a tape/wheel or measuring app** before ordering materials or setting anything on a property line.

### Recommended in-app disclaimer / verification step

The app should:
1. Show a persistent notice: *"Measurements are estimates derived from aerial imagery and your calibration. Accuracy is typically within a few percent under good conditions but is not survey-grade."*
2. **Require the user to confirm one field-measured dimension** (e.g., "measure your driveway/house wall with a tape and enter it") as the calibration reference, rather than trusting the screenshot alone.
3. Warn explicitly: **do not use for property-line placement, fences on boundaries, permits, or excavation** — those need a licensed survey / 811 call.
4. Flag oblique/tilted images and refuse (or heavily caveat) 45° "aerial" views.

---

## 6. Recommended Strategy for a v1 Web App

### Two-track design

**Track A — App-fetched, deterministic scale (preferred default).**
Geocode the address → fetch **orthorectified, trace-legal imagery** at a known lat/zoom so scale comes straight from the Web Mercator formula (no user calibration). Seed the base plan with a **Microsoft ML building footprint** (permissive license) and, where free, a **county parcel** outline. User adjusts, then designs to a known scale.

**Track B — User screenshot, manual calibration (fallback).**
For pasted images of unknown provenance, use **calibrate-by-reference-line**: user draws a line on a known dimension (ideally a long, tape-verified one) and enters its length → `unitsPerPixel`. Warn about oblique/tilt and short references.

### Legally-safest imagery choice

**USGS NAIP (public domain, 0.3–0.6 m, orthorectified) is the safest source to trace/derive measured drawings — no copyright, no ToS derivative-work restriction.** Where you need sharper/newer imagery, **state/county ortho endpoints** (usually public) and **Esri World Imagery** (tracing *expressly granted*, attribution + appropriate account) are the next-safest. **Avoid Google Maps/Solar imagery for tracing entirely** — its ToS explicitly prohibits tracing building outlines and creating derivative measured works, even though its resolution is the best. **Mapbox** tracing is non-commercial-only, so unsuitable if you monetize. **Bing/Azure** needs a commercial license.

### Bottom line

For a monetizable v1: default to **NAIP + Microsoft footprints + county parcels**, deterministic Web-Mercator scale (no calibration in Track A), Esri World Imagery as a higher-res legal upgrade, and a robust reference-line calibrator for arbitrary screenshots. Ship the "estimate, not survey-grade; verify one dimension with a tape" disclaimer. Reserve Google/Nearmap-quality imagery for a future paid tier only under a license that permits derived drawings.

---

## Sources

- [Bing Maps — Understanding Scale and Resolution (Microsoft Learn)](https://learn.microsoft.com/en-us/bingmaps/articles/understanding-scale-and-resolution)
- [Web Mercator scale/resolution gist (perrygeo, GitHub)](https://gist.github.com/perrygeo/4478844)
- [Google Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [Google Maps APIs Terms of Service (2018-02-07)](https://developers.google.com/maps/terms-20180207)
- [Google Maps Platform Terms of Service (Cloud)](https://cloud.google.com/maps-platform/terms)
- [Maps Static API Usage and Billing (Google)](https://developers.google.com/maps/documentation/maps-static/usage-and-billing)
- [Google Maps Platform pricing](https://mapsplatform.google.com/pricing/)
- [Solar API Usage and Billing (Google)](https://developers.google.com/maps/documentation/solar/usage-and-billing)
- [Solar API Data Layers (Google)](https://developers.google.com/maps/documentation/solar/data-layers)
- [Mapbox Product Terms (Oct 2025, PDF)](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/68dddd2815cb3d82685f0096_Mapbox%20Product%20Terms%20(October%201,%202025).pdf)
- [Mapbox pricing (docs)](https://docs.mapbox.com/accounts/guides/pricing/)
- [Esri World Imagery "Uses Permitted" (ArcGIS Online)](https://www.arcgis.com/home/item.html?id=8e90a00a0a6845a49262e0b756f57a10)
- [Esri Web Site and Service Terms of Use](https://www.esri.com/en-us/legal/terms/web-site-service)
- [USGS NAIP ImageServer (The National Map)](https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer)
- [USGS EROS Archive — NAIP](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-agriculture-imagery-program-naip)
- [Bing Maps licensing (OSM Wiki)](https://wiki.openstreetmap.org/wiki/Bing_Maps)
- [OnTerra — Bing Maps Licensing](https://www.onterrasystems.com/bing-maps-licensing/)
- [Nearmap vertical imagery](https://www.nearmap.com/products/imagery/vertical)
- [PRO Landscape+ CAD](https://prolandscape.com/en/software/cad/)
- [iScape landscape design app](https://www.iscapeit.com/)
- [Nadir vs. orthophotography vs. oblique (Autel)](https://www.autelpilot.com/blogs/drone-technology/nadir-orthophotography-oblique)
- [Scales of oblique photographs (ScienceDirect/ISPRS)](https://www.sciencedirect.com/science/article/pii/S0924271623003362)
- [Lens distortion and calibration (Prowell)](https://prowelllife.com/lens-distortion-and-calibration-how-to-correct-geometric-errors-in-aerial-images/)
- [Regrid Property/Parcel API](https://regrid.com/api)
- [Overpass API (OSM Wiki)](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [OSM Parcel (wiki)](https://wiki.openstreetmap.org/wiki/Parcel)
- [microsoft/GlobalMLBuildingFootprints (GitHub)](https://github.com/microsoft/GlobalMLBuildingFootprints/)
- [microsoft/USBuildingFootprints (GitHub)](https://github.com/microsoft/USBuildingFootprints)
- [Google Open Buildings (Google Research)](https://sites.research.google/gr/open-buildings/)
- [Aerial roof measurement accuracy guide (1ESX)](https://www.1esx.com/aerial-roof-measurements-guide-2026/)
- [Learning to Extract Building Footprints from Off-Nadir Aerial Images (arXiv 2204.13637)](https://arxiv.org/pdf/2204.13637)
