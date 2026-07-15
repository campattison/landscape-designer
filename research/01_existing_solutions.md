# Existing Landscape-Design Software — Competitive Landscape

**Research date:** 2026-07-14
**Purpose:** Map what already exists before building a web app that starts from a satellite/aerial image, helps identify site features (buildings, sidewalks, driveways), and lets a user design a garden to scale like a professional.

**Method note:** All findings below come from web search results and fetched vendor/help/review pages during this session. Source URLs are inline. Items I could not verify from a page are marked `[unverified]`. Reddit could not be fetched directly (Claude Code is blocked from reddit.com), so user-complaint findings come from secondary roundups and review sites that quote/summarize community sentiment; treat those as second-hand.

---

## 1. Professional CAD-class tools

These target landscape architects and design-build firms. The common thread: they are precision drafting environments where scale is a first-class concept, but almost none *auto-detect* site features — the aerial image is a georeferenced or manually-calibrated *backdrop* that the designer traces over.

### Land F/X
- **Platform:** Desktop plugin that runs *inside* AutoCAD / Civil 3D (or their own cut-down "F/X CAD"). ([landfx.com](https://www.landfx.com/))
- **Workflow:** Adapts AutoCAD to landscape architecture and irrigation. Designer builds plant palettes, plant lists, location plans, irrigation equipment layouts, spot elevations, and site-takeoff data. Large symbology and hatch library differentiates plant/hardscape/softscape types. ([landfx.com](https://www.landfx.com/), [G2](https://www.g2.com/products/land-f-x/reviews))
- **Aerial imagery / scale:** Supports **georeferenced images** that drop to real-world coordinates; scale is inherited from CAD/GIS coordinate data. ([livetoplant.com summary](https://livetoplant.com/how-to-use-aerial-imagery-for-landscape-design-planning/)) Integrates with Moasure and survey/measurement inputs. ([moasure.com/landfx](https://www.moasure.com/pages/landfx))
- **Auto-detect features:** No. Designer traces/drafts over the base. Scale comes from CAD georeferencing, not image recognition.
- **Plant/symbol library:** Extensive CAD symbol + hatch library; plant schedules and callouts auto-generate. ([G2](https://www.g2.com/products/land-f-x/reviews))
- **Export:** DWG/CAD-native (AutoCAD ecosystem).
- **Pricing:** Modular yearly subscription — Design ~$175, Planting ~$575, Irrigation ~$875, F/X CAD ~$775; **requires a compatible AutoCAD license** (extra cost if not owned). ([Capterra](https://www.capterra.com/p/126176/Land-F-X/), search summary of vendor packages)
- **Main weakness:** Requires AutoCAD knowledge + license; moderate-to-steep learning curve; reports of glitches/crashes. Not usable by homeowners. ([G2](https://www.g2.com/products/land-f-x/reviews))

### DynaSCAPE (Design)
- **Platform:** Desktop CAD (proprietary, purpose-built rather than an AutoCAD plugin). ([ArchiVinci roundup](https://www.archivinci.com/blogs/top-landscape-design-software))
- **Workflow:** CAD-based design-build tool — concept, planting, hardscape, and construction documentation with curated symbols, labels, schedules, and sheet sets. Emphasis on clean linework and selling concepts with color/presentation. ([ArchiVinci roundup](https://www.archivinci.com/blogs/top-landscape-design-software))
- **Aerial imagery / scale:** Draws to real scale; imports base images. `[unverified]` on specifics of georeferenced aerial import.
- **Auto-detect features:** No — manual drafting workflow.
- **Plant/symbol library:** Curated symbol libraries; auto plant schedules.
- **Export:** CAD / print sheet sets.
- **Main weakness:** Professional learning curve; oriented to design-build firms, not homeowners.

### Vectorworks Landmark
- **Platform:** Desktop (macOS/Windows), BIM-capable. ([vectorworks.net/landmark](https://www.vectorworks.net/en-US/landmark))
- **Workflow:** Full landscape-architecture pipeline — conceptual sketch → site analysis → detailed documentation → 3D/BIM. Starts from a "base file" built from field measurements, surveys, GIS, or drone data. Supports pre-development analysis: sun/shade, surface drainage, slope. ([vectorworks.net BIM-for-landscape](https://www.vectorworks.net/en-US/start/bim-for-landscape))
- **Aerial imagery / scale:** Strongest georeferencing story of the group — **imports georeferenced high-res images, IFC and DWG that auto-place at real-world coordinates**; a geolocated aerial image appears in-file via GIS. ([vectorworks.net BIM-for-landscape](https://www.vectorworks.net/en-US/start/bim-for-landscape))
- **Auto-detect features:** No feature auto-detection; the aerial/GIS layer is contextual backdrop for manual modeling.
- **Plant/symbol library:** Full plant database + BIM objects.
- **Export:** DWG, IFC, PDF, 3D.
- **Main weakness:** Expensive, professional learning curve; overkill for a homeowner.

### PRO Landscape (PRO Landscape+)
- **Platform:** Desktop (Windows/Mac) + iPad/Android companion app. Markets itself as AI-powered. ([prolandscape.com](https://prolandscape.com/))
- **Workflow:** Two entry paths. (1) **Photo Imaging** — start from a photo of the customer's house/yard and drag-drop from 19,000+ images of plants, grass, mulch, hardscapes, lighting to create a photorealistic "after." (2) **CAD** — accurate, scaled plan drawings via plant symbols, pavers, walls, irrigation with material take-off; 3D renderings/walkthroughs generated from the scaled CAD. ([prolandscape.com/software](https://prolandscape.com/en/software/), [photo-imaging](https://prolandscape.com/en/software/photo-imaging/), [cad](https://prolandscape.com/en/software/cad/))
- **Aerial imagery / scale:** CAD module produces scaled drawings "in any size or scale"; photo module is a perspective photo edit (not scaled). Imports common file formats. Aerial-specific import `[unverified]` — its signature is ground-level *photo* imaging, not overhead aerial.
- **Auto-detect features:** No — manual drag-drop / drafting.
- **Plant/symbol library:** 19,000+ photo images + CAD symbol library; material take-offs.
- **Export:** Common formats (import/export/print/email). ([softwareadvice](https://www.softwareadvice.com/landscaping/pro-landscape-profile/))
- **Pricing:** ~$90/month or ~$900/year. ([prolandscape.com](https://prolandscape.com/), [Capterra](https://www.capterra.com/p/126135/PRO-Landscape/))
- **Main weakness:** Photo-imaging output is perspective (not a scaled plan); CAD and photo are somewhat separate worlds; contractor-oriented.

### VizTerra (Structure Studios)
- **Platform:** Desktop, professional 3D. ([structurestudios.com/vizterra](https://www.structurestudios.com/vizterra-3d-landscape-design-software))
- **Workflow:** 2D scaled plan → automatic 3D. Built for decks, patios, hardscapes, outdoor kitchens, fences, pools. Library of 77,000+ items (1,900+ 3D objects, 1,200 materials, 1,700 plants/trees) and build-ready site plans. ([structurestudios.com/vizterra](https://www.structurestudios.com/vizterra-3d-landscape-design-software))
- **Aerial imagery / scale:** Optional paid **GIS & 3D Terrain Data** add-on gives high-res property imagery down to **1" per pixel** plus 3D terrain from public survey data. Choose engineering scale (⅛" or 1/16") and print to any paper size. ([letuspaveit technical guide](https://letuspaveit.com/vizterra-3d-landscape-design-software-technical-guide-to-features-pricing-tools-workflows-comparisons-and-faqs/))
- **Auto-detect features:** No auto-detection; GIS imagery + terrain is an accurate backdrop to model over.
- **Plant/symbol library:** 77,000-item curated library.
- **Export:** Scaled plan prints, 3D presentations.
- **Pricing:** One-time ~$95 setup fee + monthly/annual subscription, pay-as-you-go, cancel anytime; GIS/terrain is an extra cost. ([structurestudios pricing](https://www.structurestudios.com/landscape-design-software-and-pool-design-software-pricing-compare))
- **Main weakness:** Hardscape/pool-centric; GIS accuracy is a paid add-on; professional tool.

### Realtime Landscaping Architect (Idea Spectrum)
- **Platform:** Desktop (Windows). ([ideaspectrum.com](https://ideaspectrum.com/professional-landscape-software/))
- **Workflow:** 2D/3D design; positioned as affordable and approachable for small shops needing quick visuals. ([structurestudios comparison note via search](https://www.structurestudios.com/vizterra-3d-landscape-design-software))
- **Aerial imagery / scale:** Has a **Satellite Picture Import Wizard**. Process is explicitly manual: user grabs an image from Google/Bing Maps or a drone, the wizard imports it as an overlay object at the design center, and the user manually resizes with a **"Resize using known distance"** tool. Docs recommend the image contain a building of known length or a scale legend. **No automatic feature recognition or scale detection** — scale depends entirely on the user knowing a real distance. ([Realtime Landscaping help](https://ideaspectrum.com/help/realtime/satellite-picture-import-wizard.html))
- **Auto-detect features:** No — confirmed manual per help docs.
- **Plant/symbol library:** Large plant/object library.
- **Export:** 2D plans, 3D renders/walkthroughs.
- **Main weakness:** Libraries and drafting precision feel limited for complex scopes; manual calibration; Windows-only. ([structurestudios comparison](https://www.structurestudios.com/vizterra-3d-landscape-design-software))

**Pattern across the CAD tier:** scale is native and rigorous, but it comes from *georeferencing / manual calibration*, not from computer-vision feature detection. Every one requires the designer to trace or model over the base image. All are priced and pitched at professionals.

---

## 2. Consumer / prosumer web + mobile tools

### iScape (iScape It)
- **Platform:** iOS + Android (AR); some full functionality gated to desktop/tablet. ([iscapeit.com](https://www.iscapeit.com/))
- **Workflow:** Photo-based, on-site. Start from a photo of the yard (or a flat site-plan image), drag-drop plants/pavers/features into the scene; on ARKit devices place 3D assets true-to-scale and "walk" the idea. Tools: virtual pen/texture fills (mulch, gravel, turf, paving), magic-eraser cut-outs for renovation, sun slider for shadows. Produces plant + hardscape material lists. ([iscapeit.com blog](https://www.iscapeit.com/blog/best-landscape-design-tools-for-homeowners-in-2026))
- **Scale:** AR placement is "true-to-scale" on-device, but it is a perspective photo/AR overlay, not a scaled top-down plan.
- **Auto-detect features:** No.
- **Plant/symbol library:** Trees, shrubs, perennials, hardscape assets.
- **Export:** Renders + material lists.
- **Weakness:** Steep learning curve for non-tech users; premium features costly; not a measured top-down plan. ([iscapeit.com blog](https://www.iscapeit.com/blog/best-landscape-design-tools-for-homeowners-in-2026))

### Yardzen (service, not software)
- **Platform:** Web-mediated **done-for-you service**. ([roundups](https://www.iscapeit.com/blog/best-landscape-design-tools-for-homeowners-in-2026))
- **Workflow:** A **human** landscape designer produces the plan. Customer gets build-ready CAD files, 3D renders, plant + materials lists, and contractor matching. Nothing to place yourself.
- **Scale:** Professional CAD deliverables (human-produced) — scaled.
- **Auto-detect:** N/A (human-driven; likely uses satellite + client photos).
- **Export:** CAD files, renders, plant lists.
- **Pricing:** ~$695–$3,495; ~2–3 week turnaround. ([iscapeit.com blog](https://www.iscapeit.com/blog/best-landscape-design-tools-for-homeowners-in-2026))
- **Weakness:** Priciest and slowest; you're buying labor, not a tool. (Note: Yardzen also now ships an AI arm — "Yard AI" — see §3.)

### Cedreo
- **Platform:** Cloud (web). ([cedreo.com/landscape-planner](https://cedreo.com/landscape-planner/))
- **Workflow:** 2D drafting + photorealistic 3D in one flow. Site-plan and terrain tools for lots, paths, drives, slopes, elevation changes, embankments; one-click photorealistic renders. Aimed at pros who want to draft precisely and sell the vision fast. ([cedreo.com/landscape-planner](https://cedreo.com/landscape-planner/))
- **Scale:** Precise 2D drafting with terrain — scaled.
- **Auto-detect features:** No — manual site-plan drawing.
- **Library:** Home + landscape objects, materials.
- **Export:** 2D plans + 3D renders.
- **Weakness:** More home/building-centric; subscription; still manual site setup.

### Planner 5D
- **Platform:** Web + mobile (also markets an AI generator, see §3). ([planner5d.com landscape](https://planner5d.com/use/landscape-design-software))
- **Workflow:** Drag-drop 2D/3D for yards, patios, decks, paths, pools. User defines site dimensions, draws property boundaries, adds walls/fences, marks features — **or imports an image of the yard** to trace shapes/zones. Scale/texture/lighting adjustable. ([planner5d.com landscape](https://planner5d.com/use/landscape-design-software))
- **Scale:** User enters site dimensions manually; can trace an imported image.
- **Auto-detect features:** No.
- **Library:** Broad 2D/3D object catalog.
- **Export:** 2D/3D renders.
- **Weakness:** General home-design tool; scale is only as good as the manually-entered dimensions.

### SmallBluePrinter — Garden Planner
- **Platform:** Web + downloadable (Home Edition). ([smallblueprinter.com/garden](https://smallblueprinter.com/garden/))
- **Workflow:** Simple drag-drop garden/landscape design with 2D/3D preview and a large plant/object symbol set. ([smallblueprinter.com features](https://smallblueprinter.com/garden/homeedition.html))
- **Scale:** Grid-based drawing; user sets scale manually. `[unverified]` on satellite import.
- **Auto-detect:** No.
- **Library:** Large symbol library (plants, structures, objects).
- **Export:** Image/print.
- **Weakness:** Lightweight/2D-first; no aerial or automated scale.

### Gardena myGarden
- **Platform:** Free web. ([sourceforge listing](https://sourceforge.net/software/compare/Garden-Planner-vs-Gardena-myGarden/))
- **Workflow:** Free online planner with a hand-drawn aesthetic; draw and plan your garden. Notable extra: a **sprinkler-system planner** with automatic planning assistance to spec GARDENA irrigation. ([sourceforge](https://sourceforge.net/software/compare/Garden-Planner-vs-Gardena-myGarden/))
- **Scale:** Draw-to-plan; manual dimensions.
- **Auto-detect:** No.
- **Library:** Plants + GARDENA products.
- **Export:** Plan/print.
- **Weakness:** Marketing tool for GARDENA hardware; basic; no aerial import.

### Home Outside (Yard Planner)
- **Platform:** iOS + Android app (Julie Moir Messervy Design Studio). ([homeoutside.com/mobile-app](https://homeoutside.com/mobile-app/))
- **Workflow:** **Closest consumer analog to the proposed app.** A **Map Tool** takes your full address, shows satellite imagery, and you drag light-blue pins around your property outline. It then imports that outlined area into the design canvas. ([homeoutside.com app tip](https://homeoutside.com/app-tip-how-to-create-a-property-base-plan-with-a-map-image/))
- **Scale:** **Yes** — the Map Tool imports the outlined area "with a corresponding scale (in feet or meters) and universal north arrow," and rulers stay calibrated to the map. This is genuine address→scaled-base. ([homeoutside.com app tip](https://homeoutside.com/app-tip-how-to-create-a-property-base-plan-with-a-map-image/))
- **Auto-detect features:** **No** — user manually places boundary pins (magenta lines flag placement errors, but there's no auto-recognition of buildings/driveways/sidewalks).
- **Library:** Hand-drawn-style landscape icons/palette.
- **Export:** Sketch/plan; Premium Tools bundle (Sketch tool) implies tiers; exact pricing `[unverified]`.
- **Weakness:** Hand-drawn/loose aesthetic, not a construction-grade plan; boundary + features are all manual; consumer-grade symbol set.

### PlanningWiz
- **Platform:** Web (2D/3D floor planner). ([planningwiz.com](https://planningwiz.com/))
- **Workflow:** Primarily an **indoor floor planner** for residential/commercial spaces and sales/marketing teams; can do outdoor layouts but is **not marketed as a landscape tool**. ([Capterra](https://www.capterra.com/p/164199/PlanningWiz-Floor-Planner/))
- **Scale:** Floor-plan scaling (interior-oriented).
- **Auto-detect:** No.
- **Weakness:** Not a landscape/garden tool; included here only because it was on the list to check — low relevance.

### Shoot (ShootGardening) — Garden Planner
- **Platform:** Web + a **ShootPlantPlanner plugin for SketchUp**. ([shootgardening.com/garden-planner](https://www.shootgardening.com/design-and-plan/garden-planner))
- **Workflow:** Positioned as the "only software developed specifically for garden designers." Award-winning 2D garden planner + premium plant lists tied to the Shoot plant database, seasonal flower/foliage charts. **ShootMatch** uses AI to add hundreds of plants in one click; ShootPlantPlanner brings planting plans into SketchUp. ([shootgardening.com/garden-planner](https://www.shootgardening.com/design-and-plan/garden-planner))
- **Scale:** 2D planner; SketchUp plugin inherits SketchUp's scale.
- **Auto-detect:** No.
- **Library:** Deep horticultural plant database (its real strength).
- **Export:** Plant lists, 2D plans, SketchUp models.
- **Weakness:** Planting-focused (best at *what to plant*, not site geometry); no aerial import.

**Pattern across the consumer tier:** most are photo-overlay or drag-drop 2D tools where scale is either absent or manually entered. **Home Outside is the notable exception** — it genuinely does address→satellite→scaled base — but even it requires fully manual boundary/feature placement and outputs a loose, consumer-grade sketch rather than a professional scaled plan.

---

## 3. AI-first newcomers

The 2026 wave is almost entirely **photo-to-render** (upload a ground-level yard photo → generative "after" image). Strengths: instant, beautiful, cheap/free. Weaknesses: no top-down scaled plan, poor physical-scale fidelity, hardiness-zone hallucination, and often no measurements or buildable output.

### Neighborbrite
- **Platform:** Free web (unlimited, no credit card). ([neighborbrite.com](https://neighborbrite.com/))
- **Workflow:** Upload a yard photo, tap the area to redesign, pick location (auto-selects climate zone), choose from 16+ garden styles → photorealistic render. ([toolmage](https://www.toolmage.com/en/tool/neighborbrite/), [aitoolsbakery review](https://aitoolsbakery.com/blog/neighborbrite-review/))
- **Scale:** **None.** Explicitly "a visualization tool, not a blueprint tool — you will not get top-down plans, measurements, or construction drawings." ([aitoolsbakery review](https://aitoolsbakery.com/blog/neighborbrite-review/))
- **Auto-detect:** User taps the region; no measured feature detection.
- **Library:** Style presets; climate-zone awareness.
- **Export:** Render images.
- **Weakness:** Pure inspiration; nothing buildable/scaled.

### DreamzAR (also "DreamYard")
- **Platform:** iOS app + web. ([dreamzar.app](https://www.dreamzar.app/))
- **Workflow:** Upload photo → 38+ styles → chat-refine → generate; then **AR walkthrough** to walk the design in your actual yard. Also has a 2D landscape editor. 2,000+ USDA plants. ([dreamzar.app](https://www.dreamzar.app/), [blog](https://blog.dreamzar.app/post/design-your-dream-yard-with-ai-introducing-the-ai-landscape-design-stylist-in-dreamzar))
- **Scale:** AR places plants at "true-to-life scale" in the live camera view — but that's AR overlay, not a measured top-down plan. ([dreamzar AR blog](https://blog.dreamzar.app/post/how-to-use-ar-in-landscape-from-inspiration-to-reality))
- **Auto-detect:** No.
- **Library:** 2,000+ USDA plants (real hardiness data — better than generic image gens).
- **Export:** Renders, AR, 2D layouts.
- **Weakness:** Consumer inspiration + AR; no scaled construction plan.

### Yard AI (YardAI — Yardzen's AI arm)
- **Platform:** Web. ([yardai.app](https://yardai.app/))
- **Workflow:** Upload a yard photo, describe goals → AI generates a design **trained on 50,000 real Yardzen designs** (not stock imagery). Outputs visualizations, cost estimates, action steps, plant guides, materials lists, and local contractor matches. ([yardai.app landscape design](https://yardai.app/ai-landscape-design-perfect-your-outdoor-space))
- **Scale:** Photo-to-render; no measured top-down plan `[unverified]`.
- **Auto-detect:** No.
- **Library:** Trained on real professional projects; plant guides + materials lists.
- **Export:** Renders, cost estimates, plant/materials lists, contractor leads.
- **Weakness:** Still ground-photo render-first; the professional plan path is the paid Yardzen human service.

### LandscapioAI
- **Platform:** Web. ([landscapioai.com](https://www.landscapioai.com/blog/best-free-ai-landscape-design-tools))
- **Workflow:** Upload a yard photo **or use satellite view of your property** and design from the overhead perspective. Outputs regional plant lists, **material take-offs** (mulch, pavers, plant quantities), and an itemized budget claiming ±15% accuracy. ([Fastio roundup](https://fast.io/resources/best-ai-for-landscape-design-2026/))
- **Scale:** Satellite-view entry is a step toward overhead design, but the take-off accuracy claim is vendor-stated; measured-scale rigor `[unverified]`.
- **Auto-detect:** Uses satellite view; degree of auto feature-detection `[unverified]`.
- **Library:** Regional/zone-aware plant lists.
- **Export:** Plant list, material take-off, itemized budget.
- **Weakness:** Cost/take-off is the pitch; the "how accurate is the scale" question is unproven.

### AI Garden Planner
- **Platform:** Web. ([search roundups](https://aitoolsbakery.com/blog/best-ai-landscaping-tools/))
- **Workflow:** Photo → styled render, with the broadest *stylistic* range (beyond the Japanese/cottage/modern-minimalist defaults). Credit-based; a full 3D render costs ~30 credits (≈⅓ of the Starter monthly allowance). ([Fastio roundup](https://fast.io/resources/best-ai-for-landscape-design-2026/))
- **Scale:** Render-first; no scaled plan noted.
- **Weakness:** Credit economics; inspiration-grade.

### Planner 5D — AI Landscape Generator
- **Platform:** Web/mobile add-on to Planner 5D. ([planner5d AI generator](https://planner5d.com/use/ai-landscape-design-generator))
- **Workflow:** AI-generates landscape visuals; can hand off to the Planner 5D manual 2D/3D editor for scaled work.
- **Scale:** Manual editor provides scale; the AI layer is generative.
- **Weakness:** Two-mode (generate vs. draft) rather than a unified scaled AI plan.

### Others surfaced (lower priority / less verified)
- **HomeDesigns.AI** — largest user base, 7-day trial, photo-to-render. ([aitoolsbakery](https://aitoolsbakery.com/blog/best-ai-landscaping-tools/))
- **AI Yard Design Studio** (ai-yard-design.com), **DreamYard** (dreamyard.ai), **Gardenly**, **Remodel AI**, **Rendair AI**, **PaintIt.ai**, **aitwo.co**, **Decai.ai** — all photo-to-render / visualization tools per 2026 roundups. ([remodelai](https://www.remodelai.io/blog/best-ai-landscape-design-apps), [rendair](https://rendair.ai/blog/tools-top-ai-tools-for-landscape-designers-in-2026), [gardenly](https://gardenly.app/blog/best-ai-landscape-design-apps-2026)) None verified to produce a measured, to-scale top-down plan from aerial imagery. `[unverified]` on individual scale claims.
- **"YardAI" as a distinct product** (separate from Yardzen's Yard AI): I did **not** find a clearly separate, notable tool by that exact name — the prominent product is Yardzen's Yard AI at yardai.app. `[unverified]`.

**Pattern across the AI tier:** overwhelmingly **ground-level photo → generative render**. Only **LandscapioAI** advertises a satellite-view starting point, and only it + Yard AI push toward material take-offs/budgets. None demonstrably produces a *scaled, professional-grade top-down plan* with verified real-world measurements and reliable site-feature segmentation.

---

## 4. Tools that specifically start from satellite/aerial imagery or address lookup

Ranked by how central the aerial/address workflow is:

| Tool | Entry | Scale established how | Feature detection |
|---|---|---|---|
| **Home Outside** | **Address → satellite** | **Auto scale (ft/m) + north arrow on import**; user pins boundary | Manual pin placement |
| **LandscapioAI** | Photo **or satellite view** | Vendor-claimed take-off ±15%; rigor `[unverified]` | `[unverified]` |
| **Realtime Landscaping** | Import satellite image | **Manual** "resize using known distance" | Manual tracing |
| **Vectorworks Landmark** | Georeferenced image / GIS | Real-world coords via GIS | Manual modeling |
| **Land F/X** | Georeferenced image | CAD georeferencing | Manual drafting |
| **VizTerra** | Paid GIS/terrain add-on (1"/px) | Engineering scale, chosen | Manual modeling |
| **Google Maps/Earth → CAD** (DIY) | Address → export PDF w/ scale bar | Scale bar → calibrate in CAD | Fully manual |

Supporting context: guides widely teach a **DIY workflow** — pull your address in Google Maps/Earth, export a PDF that includes the scale bar, then import and calibrate in a CAD/drawing tool. ([sfbaygardening](https://sfbaygardening.com/garden-planning/plan-your-garden-with-google-maps/), [draftscapes](https://draftscapes.com/how-to-create-a-landscape-design-base-map-from-google-maps/), [Home Outside](https://homeoutside.com/app-tip-how-to-create-a-property-base-plan-with-a-map-image/)) **Nearmap** is the higher-detail commercial aerial-imagery source pros use for surface area, pools, fences, decks, and vegetation height. ([nearmap blog](https://www.nearmap.com/blog/top-5-uses-of-aerial-maps-for-landscaping)) There are also **satellite property-measurement tools** (e.g., MapMeasure Pro) aimed at contractor quoting rather than design. ([myquoteiq](https://myquoteiq.com/features/mapmeasure-pro/))

**Critical finding:** *Every* tool that starts from aerial imagery establishes scale through **georeferencing (GIS coordinates) or manual known-distance calibration**, and *none* of them auto-detects site features (buildings, driveways, sidewalks) with computer vision. Feature identification is universally manual.

---

## 5. Synthesis

### (a) Common workflow patterns
Four archetypes dominate:

1. **CAD-drafting-over-a-georeferenced-base** (Land F/X, Vectorworks, DynaSCAPE, VizTerra, Realtime, Cedreo). Rigorous scale, manual tracing, professional learning curve, professional price. Scale via GIS coordinates or manual known-distance calibration.
2. **Ground-photo overlay / AR** (iScape, PRO Landscape photo module, DreamzAR). Perspective renders and AR at "true-to-scale," but no top-down measured plan.
3. **AI photo-to-render** (Neighborbrite, Yard AI, AI Garden Planner, most of the 2026 wave). Instant, beautiful, cheap; explicitly *not* blueprints; scale absent or unreliable.
4. **Address → satellite base** (Home Outside; partially LandscapioAI; DIY Google Maps→CAD). The rarest pattern — and even here, boundary/feature placement is manual and output is either loose (Home Outside) or unverified for rigor (LandscapioAI).

Universal gaps in the current market: **(i)** scale is either manual or GIS-inherited — never derived automatically from the image with confidence; **(ii)** site-feature detection (buildings, driveways, sidewalks, existing beds/trees) is **always manual** — no tool auto-segments the aerial photo; **(iii)** the two things a homeowner wants together — a *pretty render* and a *buildable scaled plan* — live in separate tools/tiers.

### (b) What users complain about
(Secondary sources; Reddit not directly fetchable this session.)

- **"Pretty pictures, no plan."** The most-cited AI complaint: tools "give only pretty pictures with no plant names," stopping at visualization and leaving users to figure out what to plant, how to build it, and what it costs. The gap is between "a fantasy image of your yard" and "what to plant, what to order, what it'll cost." ([landscapioai blog](https://www.landscapioai.com/blog/best-free-ai-landscape-design-tools))
- **Ignores physical constraints / hallucination.** AI "doesn't always respect physical constraints — it'll place plants over a site"; if your yard has hoses/tools/debris the AI hallucinates them into the design. ([ideaplan buyer's guide](https://www.ideaplan.io/blog/ai-design-tool-landscape-2026), [fast.io](https://fast.io/resources/best-ai-for-landscape-design-2026/))
- **Wrong-climate plants.** Generic AI image generators render "tropical plants in zone 4 — looks great on screen and dies in the ground." ([fast.io](https://fast.io/resources/best-ai-for-landscape-design-2026/))
- **Not buildable.** "None of these replace a landscape contractor for grading, drainage, irrigation, or structural elements." ([fast.io](https://fast.io/resources/best-ai-for-landscape-design-2026/))
- **Pro tools too hard / too costly.** Land F/X needs AutoCAD + license and has a real learning curve with crash reports ([G2](https://www.g2.com/products/land-f-x/reviews)); iScape has "a steep learning curve for non-tech-savvy users" and costly premium tiers ([iscapeit blog](https://www.iscapeit.com/blog/best-landscape-design-tools-for-homeowners-in-2026)).
- **Scale vs. beauty tradeoff.** Reviewers note "few tools lead at both scale accuracy and realistic visualization," and if you need to order materials or fit elements, "a measured 3D planner matters more than a pretty picture." ([iscapeit blog](https://www.iscapeit.com/blog/best-landscape-design-tools-for-homeowners-in-2026))

### (c) Where the genuine gap is

**The unoccupied position: an automatic address/satellite → auto-segmented → scaled professional plan, for non-professionals, in the browser.**

Concretely, no current tool combines all of these:

1. **Address/satellite entry with automatic real-world scale.** Home Outside gets closest (address → scaled base) but makes the user hand-place everything and outputs a loose sketch. Everyone else is manual known-distance calibration or a paid GIS add-on.
2. **Automatic site-feature detection (computer vision).** *Nobody* auto-detects buildings, driveways, sidewalks, existing trees/beds from the aerial image. This is the single clearest technical whitespace — every incumbent makes the user trace. A segment-the-aerial step (buildings/hardscape/lawn/canopy) would remove the most tedious part of every existing workflow.
3. **A true scaled top-down plan, not a perspective render.** The entire AI wave outputs perspective renders; the tools that output scaled plans are professional CAD packages. A homeowner-usable *scaled plan* editor is missing from the consumer/AI tier.
4. **Bridging render ↔ buildable output.** Users repeatedly ask for plant lists (zone-correct), material take-offs, and cost — currently split across tiers (Yard AI and LandscapioAI gesture at it; the scaled-plan tools don't auto-generate it for consumers).
5. **Web-based and low-friction.** The rigorous tools are desktop/AutoCAD; the easy tools aren't rigorous. A browser app that is *both* accurate and easy is unoccupied.

**Sharpest wedge:** the **auto-segmentation of the aerial image + automatic scaling** is the differentiator no incumbent has. If the app can take an address, pull correctly-scaled aerial imagery (Google/Nearmap-class), automatically identify house footprint / driveway / sidewalk / lawn / tree canopy, and hand the user a *scaled, editable, snap-to-real-features* canvas to design a garden on — with zone-correct plants and material take-offs — it would collapse four separate tool categories (georeferenced base + manual feature tracing + plant DB + take-off) into one consumer-friendly web flow. That specific combination did not appear in any product found in this survey.

---

## Source list
- Land F/X: https://www.landfx.com/ · https://www.g2.com/products/land-f-x/reviews · https://www.capterra.com/p/126176/Land-F-X/ · https://www.moasure.com/pages/landfx
- Vectorworks Landmark: https://www.vectorworks.net/en-US/landmark · https://www.vectorworks.net/en-US/start/bim-for-landscape
- DynaSCAPE / roundup: https://www.archivinci.com/blogs/top-landscape-design-software
- PRO Landscape: https://prolandscape.com/ · https://prolandscape.com/en/software/ · https://prolandscape.com/en/software/cad/ · https://prolandscape.com/en/software/photo-imaging/ · https://www.softwareadvice.com/landscaping/pro-landscape-profile/ · https://www.capterra.com/p/126135/PRO-Landscape/
- VizTerra / Structure Studios: https://www.structurestudios.com/vizterra-3d-landscape-design-software · https://letuspaveit.com/vizterra-3d-landscape-design-software-technical-guide-to-features-pricing-tools-workflows-comparisons-and-faqs/ · https://www.structurestudios.com/landscape-design-software-and-pool-design-software-pricing-compare
- Realtime Landscaping: https://ideaspectrum.com/help/realtime/satellite-picture-import-wizard.html · https://ideaspectrum.com/professional-landscape-software/
- iScape: https://www.iscapeit.com/ · https://www.iscapeit.com/blog/best-landscape-design-tools-for-homeowners-in-2026
- Yardzen / Yard AI: https://yardai.app/ · https://yardai.app/ai-landscape-design-perfect-your-outdoor-space
- Cedreo: https://cedreo.com/landscape-planner/ · https://cedreo.com/blog/best-landscape-design-software/
- Planner 5D: https://planner5d.com/use/landscape-design-software · https://planner5d.com/use/ai-landscape-design-generator
- SmallBluePrinter Garden Planner: https://smallblueprinter.com/garden/ · https://smallblueprinter.com/garden/homeedition.html
- Gardena myGarden: https://sourceforge.net/software/compare/Garden-Planner-vs-Gardena-myGarden/
- Home Outside: https://homeoutside.com/mobile-app/ · https://homeoutside.com/app-tip-how-to-create-a-property-base-plan-with-a-map-image/
- PlanningWiz: https://planningwiz.com/ · https://www.capterra.com/p/164199/PlanningWiz-Floor-Planner/
- Shoot Gardening: https://www.shootgardening.com/design-and-plan/garden-planner
- Neighborbrite: https://neighborbrite.com/ · https://aitoolsbakery.com/blog/neighborbrite-review/ · https://www.toolmage.com/en/tool/neighborbrite/
- DreamzAR / DreamYard: https://www.dreamzar.app/ · https://blog.dreamzar.app/post/how-to-use-ar-in-landscape-from-inspiration-to-reality · https://dreamyard.ai/
- LandscapioAI: https://www.landscapioai.com/blog/best-free-ai-landscape-design-tools
- AI roundups / criticism: https://fast.io/resources/best-ai-for-landscape-design-2026/ · https://www.ideaplan.io/blog/ai-design-tool-landscape-2026 · https://aitoolsbakery.com/blog/best-ai-landscaping-tools/ · https://rendair.ai/blog/tools-top-ai-tools-for-landscape-designers-in-2026 · https://www.remodelai.io/blog/best-ai-landscape-design-apps · https://gardenly.app/blog/best-ai-landscape-design-apps-2026
- Aerial/DIY workflow: https://sfbaygardening.com/garden-planning/plan-your-garden-with-google-maps/ · https://draftscapes.com/how-to-create-a-landscape-design-base-map-from-google-maps/ · https://www.nearmap.com/blog/top-5-uses-of-aerial-maps-for-landscaping · https://myquoteiq.com/features/mapmeasure-pro/
