"""Landscape Designer v1 smoke test — drop-image flow, calibrate, trace, plant, schedule, export."""
import base64, io, json, sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8377/index.html"
results = []
def check(name, ok, extra=""):
    results.append((name, bool(ok), extra))
    print(("PASS " if ok else "FAIL ") + name + (" — " + str(extra) if extra and not ok else ""))

# make a synthetic "aerial" test image: 800x600, green lawn, gray house rect, tan driveway
def make_test_image(path):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return False
    im = Image.new("RGB", (800, 600), (110, 140, 80))          # lawn
    d = ImageDraw.Draw(im)
    d.rectangle([250, 180, 520, 400], fill=(120, 118, 115))    # house
    d.rectangle([520, 300, 800, 380], fill=(190, 182, 165))    # driveway
    d.ellipse([80, 80, 180, 180], fill=(60, 90, 50))           # tree
    im.save(path)
    return True

img_path = "/tmp/ld_test_aerial.png"
have_img = make_test_image(img_path)

console_errors = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    page.on("dialog", lambda d: d.dismiss())  # decline autosave restore

    page.goto(URL)
    page.wait_for_timeout(1500)
    if page.evaluate("document.getElementById('dlg-welcome').open"): page.click('#welcome-ok')

    # 1. boot: start screen visible, toolbar built, plants loaded
    check("start screen visible", page.is_visible("#start-screen"))
    check("toolbar has 13 tools", page.locator("#toolbar .tool-btn").count() == 13,
          page.locator("#toolbar .tool-btn").count())
    n_plants = page.evaluate("LD.Model.plantsDb.length")
    check("plants db loaded (419)", n_plants == 419, n_plants)

    if have_img:
        # 2. drop image via file input
        page.set_input_files("#file-image", img_path)
        page.wait_for_timeout(1200)
        check("start screen hidden after image", not page.is_visible("#start-screen"))
        check("calibrate badge shown", page.is_visible("#calib-badge"))
        cur = page.evaluate("LD.Tools.current")
        check("auto-switched to calibrate tool", cur == "calibrate", cur)

        # 3. calibrate: click two points on the canvas (driveway edge ~280px apart in image px)
        # find screen coords of two world points via the stage transform
        def screen(wx, wy):
            return page.evaluate(f"""(() => {{
                const s = LD.View.worldToScreen({{x: {wx}, y: {wy}}});
                const box = LD.View.stage.container().getBoundingClientRect();
                return {{ x: box.x + s.x, y: box.y + s.y }};
            }})()""")
        # world coords: provisional ftPerPx = 0.15 → image px 520..800 = world x 78..120
        a = screen(78, 51);  page.mouse.click(a["x"], a["y"])
        page.wait_for_timeout(200)
        b = screen(120, 51); page.mouse.click(b["x"], b["y"])
        page.wait_for_timeout(400)
        check("distance dialog open", page.is_visible("#dlg-distance"))
        page.fill("#dist-input", "28")   # 280 image px = 28 ft → 0.1 ft/px
        page.click("#dist-ok")
        page.wait_for_timeout(400)
        fpp = page.evaluate("LD.Model.project.image.ftPerPx")
        check("scale ≈ 0.1 ft/px", abs(fpp - 0.1) < 0.001, fpp)
        check("calibrate badge cleared", not page.is_visible("#calib-badge"))

        # 4. trace a building polygon
        page.evaluate("LD.Tools.set('trace')")
        page.wait_for_timeout(200)
        pts = [(25, 18), (52, 18), (52, 40), (25, 40)]
        for wx, wy in pts:
            c = screen(wx, wy); page.mouse.click(c["x"], c["y"]); page.wait_for_timeout(120)
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        nf = page.evaluate("LD.Model.project.features.length")
        check("building traced", nf == 1, nf)

        # 5. magic wand on the lawn
        page.evaluate("LD.Tools.set('wand')")
        page.evaluate("LD.Tools.wandKind = 'lawn'")
        page.wait_for_timeout(200)
        c = screen(10, 55); page.mouse.click(c["x"], c["y"])
        page.wait_for_timeout(800)
        nf2 = page.evaluate("LD.Model.project.features.length")
        check("wand added lawn region", nf2 == 2, nf2)

        # 6. place plants
        page.evaluate("LD.Tools.set('plant')")
        page.evaluate("LD.Tools.currentPlantId = LD.Model.plantsDb[0].id")
        for wx, wy in [(15, 15), (65, 15), (40, 52)]:
            c = screen(wx, wy); page.mouse.click(c["x"], c["y"]); page.wait_for_timeout(150)
        np_ = page.evaluate("LD.Model.project.plants.length")
        check("3 plants placed", np_ == 3, np_)

        # 7. schedule
        page.click("#side-tabs button[data-pane='schedule']")
        page.wait_for_timeout(300)
        rows = page.evaluate("LD.Schedule.rows().length")
        qty = page.evaluate("LD.Schedule.rows()[0].qty")
        check("schedule 1 row qty 3", rows == 1 and qty == 3, f"rows={rows} qty={qty}")

        # 8. undo/redo
        page.keyboard.press("Meta+z")
        page.wait_for_timeout(200)
        check("undo removed a plant", page.evaluate("LD.Model.project.plants.length") == 2)
        page.keyboard.press("Meta+Shift+z")
        page.wait_for_timeout(200)
        check("redo restored plant", page.evaluate("LD.Model.project.plants.length") == 3)

        # 9. bed freehand (drag)
        page.evaluate("LD.Tools.set('bed')")
        c1 = screen(60, 45); c2 = screen(75, 45); c3 = screen(75, 55); c4 = screen(60, 55)
        page.mouse.move(c1["x"], c1["y"]); page.mouse.down()
        for c in (c2, c3, c4):
            page.mouse.move(c["x"], c["y"], steps=8)
        page.mouse.up()
        page.wait_for_timeout(300)
        check("bed drawn", page.evaluate("LD.Model.project.beds.length") == 1,
              page.evaluate("LD.Model.project.beds.length"))

        # 10. PDF export (expect a download)
        page.evaluate("LD.UI.refresh()")
        page.click("#btn-pdf")
        page.wait_for_timeout(300)
        check("export dialog open", page.is_visible("#dlg-export"))
        with page.expect_download(timeout=15000) as dl:
            page.click("#exp-go")
        path = dl.value.path()
        import os
        check("PDF downloaded", path and os.path.getsize(path) > 20000, os.path.getsize(path) if path else 0)

        # 11. JSON save
        with page.expect_download(timeout=10000) as dl2:
            page.click("#btn-save")
        proj = json.load(open(dl2.value.path()))
        check("project JSON valid", proj.get("version") == 1 and len(proj.get("plants", [])) == 3)

        # 12. screenshot for review
        page.screenshot(path="/tmp/ld_smoke_final.png")

    real_errors = [e for e in console_errors if "favicon" not in e]
    check("no console errors", not real_errors, "; ".join(real_errors[:4]))
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed")
sys.exit(1 if fails else 0)
