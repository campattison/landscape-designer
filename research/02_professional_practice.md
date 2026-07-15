# Professional Landscape Design Practice — How Plans Are Actually Made

Research compiled 2026-07-14 for the "design-to-scale from a satellite image" web app. Sources are primarily US university horticulture extension programs (UF/IFAS, UGA, NC State, Missouri, Oklahoma State, USU, Virginia Tech), landscape-design teaching resources, and CAD/drafting references. Every claim carries a source link. Inferences are marked **[INFERENCE]**.

---

## 1. The Design Process — Ordered Stages

Extension programs converge on a five-to-seven step sequence. The canonical version (UF/IFAS, Oklahoma State, NC State, Virginia Tech) is:

1. **Base map / base plan** — a scaled, bird's-eye drawing of existing conditions: "what is currently on the property, where it is, and what size it is." Property lines, structures, utilities, and large trees clearly labeled. This is the substrate every later drawing overlays on.
2. **Site inventory & analysis** — record soil, drainage, sun/shade, slope, climate, views, existing vegetation, microclimates. Often drawn as an overlay of arrows/notes on the base map (sun paths, bad views to screen, good views to frame, drainage direction, prevailing wind).
3. **Needs assessment** — a program: what the client wants (play area, dining, screening, vegetable beds, parking). Not a drawing; a list that drives the diagrams.
4. **Functional / bubble diagrams** — "loose circles we quickly sketch to indicate the general location of each function on the site." Blocks out public / private / service areas and their spatial relationships. No plant detail yet, just zones and circulation.
5. **Concept plan** — the bubbles "take on specific shapes and characteristics"; edges firm up, one space borders another, forms and materials get roughed in. Often several concept options are produced.
6. **Master plan (final design plan)** — the resolved, scaled plan of the whole property: all beds, hardscape, lawn shapes, major plants, drawn to scale with labels. This is the primary client deliverable.
7. **Planting plan** — done *after* spaces are located and designed. Specifies exact plants, quantities, sizes, and spacing, with a plant schedule/legend. May be a separate sheet from the master plan.
8. **Construction / detail documents** — hardscape layout & materials, grading & drainage, demolition, irrigation, lighting, site furnishings, and construction details (pergola, wall sections, outdoor kitchen). This is the contractor set.

Sources:
- [UF/IFAS EP375 — Ten Important Things to Consider](https://ask.ifas.ufl.edu/publication/EP375)
- [UF/IFAS EP456 — Drawing a Planting Plan](https://ask.ifas.ufl.edu/publication/EP456)
- [Oklahoma State Extension — Planning the Landscape](https://extension.okstate.edu/fact-sheets/homeowner-garden-design-series-planning-the-landscape)
- [NC State Extension Gardener Handbook, Ch. 19 — Landscape Design](https://content.ces.ncsu.edu/extension-gardener-handbook/19-landscape-design)
- [Verdance — Schematic Design Phase](https://www.verdancedesign.com/blog/landscape-architecture-process-schematic-design)
- [World Landscape Architect — Stages of a project](https://worldlandscapearchitect.com/practice-stages-of-a-landscape-architecture-design-project/)
- [Virginia Cooperative Extension Handbook, Ch. 16](https://pressbooks.lib.vt.edu/emgtraining/chapter/16/)

**Note on the app:** the professional order is base map → analysis → bubbles → concept → master → planting. A credible tool should at least distinguish the "existing conditions" layer (traced from the satellite image) from the "proposed design" layer, and ideally support a functional-zone step before plant placement.

---

## 2. The Base Map

### What must be on it
A base map "graphically and proportionally displays the existing conditions of a site." Required/expected elements (compiled across UF/IFAS EP427, UGA C1032-3, USU, NC State, Santa Clara Valley Water):

- **Property lines** and the **street** in front — accurate measurements are mandatory "to prevent building on your neighbor's property."
- **House footprint / all structures** — including doors, windows, HVAC condensers, spigots/hose bibs, downspouts, dryer vents, meters.
- **Driveways, sidewalks, patios, decks, walkways, steps, fences.**
- **Setback, easement, and right-of-way lines.**
- **Utilities** — underground utilities marked; overhead wires; utility boxes, poles, meters ("expensive to move and require occasional access"); septic tanks, wells, sprinkler/irrigation lines.
- **Existing vegetation** — every tree, shrub, bed, natural area, individually located; canopy spread measured "from the trunk out to the tip of the branches."
- **North arrow** (required — "needed to assess your growing conditions").
- **Scale bar / stated scale.**
- **Height measurements** for vertical features where relevant.

### How designers create it (traditional methods)
Three input paths, all documented:
1. **Legal survey / subdivision plat / deed** — the preferred starting point because "it includes many dimensions" and saves measuring; the legal survey is drawn to engineer's scale. Also sourced from local planning offices, county tax records, county GIS websites.
2. **Field measurement** — with a large sheet (≥ 24"×18"), an engineer's or architect's scale, straightedge, and pencil compass. Three techniques:
   - **Baseline / running measurements** along walls/linear features from a single point-of-beginning.
   - **Triangulation** for single points like trees — measure from two fixed house corners to the object and swing compass arcs to fix the location.
   - **Grid measurements** for large or odd-shaped features, perpendicular tapes at ~5-ft increments.
3. **Aerial / satellite imagery tracing** — county aerial imagery services are explicitly listed as a base-information source. **[INFERENCE]** This is exactly the app's method; the professional analogue is tracing a survey or georeferenced aerial, then verifying with field measurement. The tool should let users calibrate scale against a known dimension (house wall, driveway width) since satellite pixel scale must be anchored to real feet.

Sources:
- [UF/IFAS EP427 — Site Measurements and Base Maps](https://ask.ifas.ufl.edu/publication/EP427)
- [UGA CAES C1032-3 — Drawing a Landscape Plan: The Base Map](https://fieldreport.caes.uga.edu/publications/C1032-3/drawing-a-landscape-plan-the-base-map/)
- [USU Extension — Building a Basemap](https://extension.usu.edu/laep/design4everyone/building_a_basemap)
- [NC State — Map Existing Site and Vegetation](https://gardening.ces.ncsu.edu/how-to-create-wildlife-friendly-landscapes/step-1-map-existing-site-and-vegetation/)
- [Santa Clara Valley Water — Sample Base Map Instructions (PDF)](https://scvwd.dropletportal.com/documents/pdf/LDA_Base_Map_Instructions.pdf)

---

## 3. Drawing Conventions

### Scales (US residential)
- **Engineer's scale** divides the inch into decimal units: 1" = 10' (written "1:10" or "1/10 scale") is the workhorse residential scale. Also common: 1"=20', and for larger lots 1"=40'. Legal surveys use engineer's scale.
- **Architect's scale** uses fractional-inch divisions: **1/8" = 1'** (i.e., 1" = 8'), also 1/4"=1', 1/16"=1'.
- UF/IFAS calls **1"=10' the standard for residential planting plans**; UGA lists 1:10 as most common with 1:4, 1:5, 1:8, 1:16, 1:20 as alternates depending on paper size and lot dimensions.
- **[INFERENCE / practical]** Engineer's scale (decimal feet) is easier to encode in software than architect's fractional scale, and matches how surveys and aerials are dimensioned. A satellite-tracing tool should think in engineer's-scale terms (feet, decimal), and print a scale bar rather than relying on a fixed "1 inch = X" ratio (paper/zoom independent).

### Plant symbols
- **Every plant is a circle whose diameter equals the plant's MATURE spread at plan scale.** UF/IFAS: "Draw each plant as an individual circle with a diameter the same size as the width of the mature plant." A 2-ft-spread shrub = a 2-ft-diameter circle at scale. This is the single most important convention: **plants are drawn at mature size, not install size.**
- **A dot / point / crosshair at the circle center marks the trunk / root-ball / insertion point.** In CAD this center is the block insertion point.
- **Category distinctions:**
  - **Canopy / shade trees** — large circular canopy outline with centered trunk marker; often a more detailed branching or textured edge.
  - **Shrubs** — smaller scaled circles; individual shrubs drawn individually, mass plantings grouped.
  - **Groundcovers** — represented by **hatch patterns / fill** over an area rather than individual circles.
- **Deciduous vs. evergreen** — deciduous shrubs/trees drawn with "loose, irregular edges"; needled/broadleaf evergreens drawn to "suggest their rigid growth habits," typically stiffer, spikier, or more geometric outlines. (Distinction is stylistic and not fully standardized; sources agree it exists but give no single canonical glyph. **[INFERENCE]** treat as a rendering style, not a hard rule.)
- **Existing vs. proposed plants** distinguished by **lineweight or linetype** (e.g., existing shown lighter/dashed, proposed solid) — sources confirm the practice but do not fix which is which.

### Massing bubbles
- For groups, designers "draw free-form or irregular 'bubbles' within the plant beds to show the location and extent of a particular plant cluster," then "fill the bubble with plants by staggering the circles in a rickrack pattern" (offset/triangular packing) so circles touch at maturity.

### Hardscape / textures
- Hardscape is shown with **hatching and material textures** at scale — brick, flagstone, pavers, concrete, decking each get a distinct pattern. "Hatching is simply the process of making parallel lines in different concentrations… to create a shading or three-dimensional effect." Softscape (lawn, groundcover) vs. hardscape (paving, stone) are visually separated by fill.

### Labeling, callouts, schedule, and sheet furniture
- **Leader lines / callouts** point from a plant group to a label; the label uses an **abbreviation/key** that matches the first column of the plant schedule.
- **Plant schedule / legend** columns (UF/IFAS Table 2 standard): **Type** (Trees / Shrubs / Groundcover / Vines) · **Key/abbrev** · **Common name** · **Botanical (scientific) name** · **Quantity** · **Size** (container: 1 gal, 3 gal, 15 gal, or caliper/B&B) · **Spacing (o.c.)**. Some add mature spread and price.
- **Spacing notation:** center-to-center distance, written "**2' o.c.**" (on center). "2' o.c. means plants with a 2-foot mature spread are planted 2 feet apart from center to center, so they touch when at their mature size." For groundcover areas, quantity is computed from bed area ÷ o.c. spacing.
- Every professional sheet carries: **north arrow**, **scale bar**, **title block** (project name, client, address, designer, date, sheet number, revision), and **general notes**.

Sources:
- [UF/IFAS EP456 — Drawing a Planting Plan](https://ask.ifas.ufl.edu/publication/EP456)
- [UF/IFAS EP427 — Site Measurements and Base Maps](https://ask.ifas.ufl.edu/publication/EP427)
- [The Landscape Library — Plant Symbols: Types, Standards, Professional Use](https://www.thelandscapelibrary.academy/blog/plant-symbols-for-landscape-design)
- [Draftscapes — How to Draw Trees in Plan (deciduous)](https://draftscapes.com/how-to-draw-trees-in-plan-1/) · [How to Draw Conifers in Plan](https://draftscapes.com/how-to-draw-conifers-in-plan/)
- [Schnarr's Blog — Landscape Plan Drawing / Rendering Symbols](https://schnarrsblog.com/landscape-plan-drawing-practice-rendering-symbols/)
- [Land F/X — Plant Schedules: Examples](https://www.landfx.com/docs/planting/schedules/1432-examples.html) · [Getting Started](https://www.landfx.com/docs/planting/schedules/220-schedules.html)
- [Crocker Nurseries — Spacing of Plants](https://crockernurseries.com/lesson-2-spacing-of-plants-in-your-landscape-design/)
- [Bower & Branch — How to Read a Landscape Design Plan](https://bowerandbranch.com/blogs/landscape-design/how-to-read-a-landscape-design-plan)

---

## 4. Key Design Rules a Tool Should Encode

1. **Draw at mature spread, not install size.** The defining convention. Circles sized to mature width so the plan shows the landscape as it will fill in. A tool must store mature spread per species and render the symbol at that scaled diameter.
2. **On-center spacing.** Spacing = center-to-center. Plants touch at maturity when o.c. = mature spread; overlap for instant fullness, wider for open look. Groundcover counts derive from area ÷ (o.c.²-based coverage). Enforce/suggest o.c. per species.
3. **Massing & odd-number groupings.** Group like plants for unity and flow ("the eye travels through the landscape more easily"). Design lore favors planting in **odd numbers** (3, 5, 7) for naturalness — widely taught, though the extension sources emphasize *massing/repetition* more than the odd-number rule specifically. Mark odd-numbering as **[design convention, not universal law]**.
4. **Bed lines.** Prefer **fewer, grander, sweeping curves**; avoid small wavy scallops and boring straight edges. Bed lines connect house to hardscape and lead the eye. Curved edges are also easier to mow.
5. **Lawn shape.** Give lawn a **simple, well-defined shape**, free of obstacles (no isolated trees/boulders/birdbaths in the turf — site those in beds). Simple curved edges for mowing. Avoid lawn in deep shade or on steep slopes.
6. **Right plant, right place.** Match species to each spot's **sun/shade, drainage, and soil**. The tool's sun/shade zoning (from north arrow + structure/tree shadows) should filter the plant palette.
7. **Sight lines / views.** Frame good views, screen bad ones; use a "regulating line" from architectural features to organize layout. Keep sight triangles at driveways/corners clear.
8. **Utility & structure clearances.** Keep plantings off meters, utility boxes, septic fields, and away from foundations/windows at mature size; don't plant large trees under overhead wires. (Derived from base-map utility requirements.)
9. **Scale & proportion.** Vertical enclosure ≈ at least **1/3 of horizontal space** for a sense of enclosure; "go big" on major features; sequence plantings **big → small** (trees, then shrubs, then perennials, then groundcover).
10. **Repetition & unity.** Repeat a few simple elements rather than one-of-everything.

Sources:
- [Garden Design — Landscape Design Principles/Rules](https://www.gardendesign.com/landscape-design/rules.html)
- [UF/IFAS CIR536/MG086 — Basic Principles of Landscape Design](https://ask.ifas.ufl.edu/publication/MG086)
- [Missouri Extension — Residential Landscaping (MG11)](https://extension.missouri.edu/publications/mg11)
- [Landscaping Network — Expert Design Rules](https://www.landscapingnetwork.com/landscape-design/expert-rules.html)
- [Fast Growing Trees — Landscape Layout 101](https://www.fast-growing-trees.com/blogs/landscaping-guides/landscape-design-101-landscape-layout)

---

## 5. Deliverables — What Clients Receive & What "Professional" Looks Like

### Deliverable types (in ascending technical depth)
- **Rendered / colored plan (master plan):** the presentation piece. Color, plant-symbol textures, shadows, hardscape material fills, labels, north arrow, scale bar, title block. This is what a homeowner "sees" as the design.
- **CAD linework / construction documents:** precise black-line technical sheets. A full CD set can include **demolition, grading & drainage, hardscape layout & materials, construction details, irrigation, planting, lighting, and site-furnishing plans**, each a separate sheet. AutoCAD is the industry standard for line-weight control, dimensions, annotations, and schedules.
- **3D visualizations / renderings:** perspective views for client buy-in. Explicitly **complement, not replace** the 2D technical set — "detailed plans, specifications, and construction information are still required for contractors."

### What a professional residential plan looks like
A finished master/planting sheet reads as: a **scaled, north-oriented plan** with the house footprint anchoring it; **beds drawn with clean sweeping edges** filled with **mature-size plant circles** (massed groups packed rickrack); **hardscape rendered in material textures/hatch**; **lawn as a simple shape**; **every plant group tagged via leader line to a keyed abbreviation**; a **plant schedule table** (type/key/common/botanical/qty/size/spacing) on the sheet; and standard sheet furniture — **north arrow, scale bar, title block, general notes.** Color and drop-shadows on the presentation version; crisp dimensioned linework on the construction version.

Sources:
- [The Landscape Library — Complete Design Workflow: Survey to Final Rendering](https://www.thelandscapelibrary.academy/blog/the-complete-landscape-design-workflow-from-survey-to-final-rendering)
- [The Landscape Library — Site Plan Example: What to Include](https://www.thelandscapelibrary.academy/blog/site-plan-example-what-it-looks-like)
- [The Landscape Library — Main Software for Landscape Design](https://www.thelandscapelibrary.academy/blog/main-software-for-landscape-design)
- [Verdance — Construction Documentation Phase](https://www.verdancedesign.com/blog/landscape-architecture-process-construction-documents)
- [gCADPlus — Using CAD for landscape design](https://www.gcadplus.com/wp/2374-2/)
- [ProHort — 3D Landscape Design & Visualisation](https://prohort.co.uk/services/landscape-architecture/3d-landscape-design/)
- [Cedreo — 2D & 3D Landscape Plans](https://cedreo.com/landscape-plans/)

---

## Implementation Notes for the App (marked inferences)

- **[INFERENCE]** Satellite tracing maps directly onto the professional "trace the survey/aerial" method — but requires a **scale-calibration step** (draw a line on a known real-world dimension) before any feet-accurate design can happen. Without it, mature-spread circles are meaningless.
- **[INFERENCE]** Encode a **species database** keyed to mature spread, mature height, sun/shade requirement, water/soil, deciduous/evergreen, and recommended o.c. — this powers the two load-bearing conventions (mature-size circles + o.c. spacing) and right-plant-right-place filtering.
- **[INFERENCE]** Separate **existing-conditions layer** (traced) from **proposed layer**, mirroring base-map vs. master-plan, and auto-generate the **plant schedule** from placed symbols (qty by counting, spacing/size from the species record) — this is what makes output feel professional rather than a drawing toy.
- **[INFERENCE]** Auto-derive **sun/shade zones** from the north arrow plus building and mature-tree shadows to drive plant filtering.
- Ship the non-negotiable sheet furniture: **north arrow, scale bar, keyed labels + leader lines, plant schedule table, title block.**
