"""Rotation + align gesture + rotated export + SAM auto-detect test.
SAM part hits the network (CDN + HF weights) — first run downloads ~30 MB."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8377/index.html"
results = []
def check(name, ok, extra=""):
    results.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + (" — " + str(extra) if extra and not ok else ""), flush=True)

def make_test_image(path):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (800, 600), (110, 140, 80))
    d = ImageDraw.Draw(im)
    d.rectangle([250, 180, 520, 400], fill=(120, 118, 115))
    d.rectangle([520, 300, 800, 380], fill=(190, 182, 165))
    im.save(path)

img_path = "/tmp/ld_test_aerial.png"
make_test_image(img_path)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("dialog", lambda d: d.dismiss())
    page.goto(URL); page.wait_for_timeout(1500)
    if page.evaluate("document.getElementById('dlg-welcome').open"): page.click('#welcome-ok')

    page.set_input_files("#file-image", img_path)
    page.wait_for_timeout(1000)
    page.evaluate("(() => { LD.Model.begin(); LD.Model.setScale(0.1); LD.Model.commit('cal'); LD.View.render(); LD.View.zoomToFit(); LD.UI.refresh(); })()")
    page.wait_for_timeout(300)

    # rotation-safe screen mapping via the actual transform (+ container offset
    # — worldToScreen is canvas-relative, mouse.click is page-relative)
    def screen(wx, wy):
        return page.evaluate(f"""(() => {{
            const s = LD.View.worldToScreen({{x: {wx}, y: {wy}}});
            const box = LD.View.stage.container().getBoundingClientRect();
            return {{ x: box.x + s.x, y: box.y + s.y }};
        }})()""")

    # 1. set rotation 30 deg — world->screen roundtrip must stay exact
    page.evaluate("LD.View.setRotation(30)")
    page.wait_for_timeout(300)
    check("rotation persisted", page.evaluate("LD.Model.project.viewRotationDeg") == 30)
    rt = page.evaluate("""(() => {
        const w = {x: 40, y: 30};
        const s = LD.View.worldToScreen(w);
        const b = LD.View.contentLayer.getAbsoluteTransform().copy().invert().point(s);
        return Math.hypot(b.x - w.x, b.y - w.y);
    })()""")
    check("transform roundtrip exact", rt < 1e-6, rt)

    # 2. place a plant by clicking under rotation — must land at the world point
    page.evaluate("LD.Tools.set('plant')")
    page.evaluate("LD.Tools.currentPlantId = LD.Model.plantsDb[0].id")
    c = screen(40, 30)
    page.mouse.click(c["x"], c["y"])
    page.wait_for_timeout(300)
    pl = page.evaluate("LD.Model.project.plants[0]")
    ok = pl and abs(pl["x"] - 40) < 0.7 and abs(pl["y"] - 30) < 0.7
    check("plant lands at world point under rotation", ok, pl)

    # 3. align gesture: drag along a world line at ~20 deg -> rotation ≈ -20
    page.evaluate("LD.View.setRotation(0)")
    page.wait_for_timeout(200)
    page.evaluate("LD.Tools.startAlign()")
    a = screen(20, 20)
    import math
    bx, by = 20 + 30 * math.cos(math.radians(20)), 20 + 30 * math.sin(math.radians(20))
    b = screen(bx, by)
    page.mouse.move(a["x"], a["y"]); page.mouse.down()
    page.mouse.move(b["x"], b["y"], steps=6); page.mouse.up()
    page.wait_for_timeout(300)
    rot = page.evaluate("LD.Model.project.viewRotationDeg")
    check("align gesture sets rotation ≈ -20°", abs(rot + 20) < 1.5, rot)

    # 4. rotated PDF export
    page.evaluate("LD.Tools.set('select')")
    page.click("#btn-pdf"); page.wait_for_timeout(300)
    with page.expect_download(timeout=20000) as dl:
        page.click("#exp-go")
    import os
    check("rotated PDF exports", os.path.getsize(dl.value.path()) > 20000)

    # 5. SAM auto-detect: click the house — model download may take a while
    page.evaluate("LD.Tools.set('ai')")
    page.evaluate("LD.Tools.wandKind = 'building'")
    n0 = page.evaluate("LD.Model.project.features.length")
    c = screen(38, 29)  # house center (world ft: 250-520px x 180-400px @0.1)
    page.mouse.click(c["x"], c["y"])
    ok_sam = False
    area = None
    for i in range(120):  # up to 4 min for first-time model download on WASM
        page.wait_for_timeout(2000)
        n = page.evaluate("LD.Model.project.features.length")
        if n > n0:
            f = page.evaluate("LD.Model.project.features[LD.Model.project.features.length-1]")
            area = page.evaluate("LD.geom.polygonArea(LD.Model.project.features[LD.Model.project.features.length-1].pts)")
            ok_sam = f["source"] == "sam" and 250 < area < 1200  # true house = 594 sqft
            break
    check("SAM segmented the building (area sane)", ok_sam, f"area={area}")

    page.screenshot(path="/tmp/ld_rotation_sam.png")
    real_errors = [e for e in errs if "favicon" not in e and "Failed to load resource" not in e]
    check("no page errors", not real_errors, "; ".join(real_errors[:3]))
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed", flush=True)
sys.exit(1 if fails else 0)
