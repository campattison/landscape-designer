"""Crop regression: gesture shielding (drag starting on an object must not move it),
rotated-view crop (rect follows page orientation, rotation baked), image-aware undo."""
import math, sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8377/index.html"
results = []
def check(name, ok, extra=""):
    results.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + (" — " + str(extra) if extra and not ok else ""), flush=True)

def make_test_image(path):
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (800, 600), (110, 140, 80))
    ImageDraw.Draw(im).rectangle([250, 180, 520, 400], fill=(120, 118, 115))
    im.save(path)

img_path = "/tmp/ld_test_aerial.png"
make_test_image(img_path)

def boot(p):
    browser = p.chromium.launch()
    page = browser.new_context().new_page()
    page.on("dialog", lambda d: d.dismiss())
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(URL); page.wait_for_timeout(1200)
    if page.evaluate("document.getElementById('dlg-welcome').open"): page.click("#welcome-ok")
    page.set_input_files("#file-image", img_path); page.wait_for_timeout(900)
    page.evaluate("(() => { LD.Model.begin(); LD.Model.setScale(0.1); LD.Model.commit('cal'); LD.View.render(); LD.View.zoomToFit(); LD.UI.refresh(); })()")
    # big lawn feature covering most of the map + a marker plant
    page.evaluate("""(() => {
        const M = LD.Model; M.begin();
        M.project.features.push({ id: 'f_lawn', kind: 'lawn',
            pts: [{x:5,y:5},{x:75,y:5},{x:75,y:55},{x:5,y:55}], closed: true, label: null, source: 'traced' });
        M.project.plants.push({ id: 'p1', plantId: M.plantsDb[0].id, x: 40, y: 30, spreadFt: 10 });
        M.commit('seed'); LD.View.render(); LD.UI.refresh();
    })()""")
    page.wait_for_timeout(300)
    def screen(wx, wy):
        return page.evaluate(f"""(() => {{
            const s = LD.View.worldToScreen({{x: {wx}, y: {wy}}});
            const box = LD.View.stage.container().getBoundingClientRect();
            return {{ x: box.x + s.x, y: box.y + s.y }};
        }})()""")
    return browser, page, screen, errs

with sync_playwright() as p:
    # ---- scenario 1: unrotated crop, drag STARTS on the lawn feature -------
    browser, page, screen, errs = boot(p)
    lawn0 = page.evaluate("LD.Model.find('f_lawn').item.pts[0]")
    page.click("#btn-crop"); page.wait_for_timeout(200)
    a = screen(20, 10); b = screen(70, 50)          # (20,10) is ON the lawn polygon
    page.mouse.move(a["x"], a["y"]); page.mouse.down()
    page.mouse.move(b["x"], b["y"], steps=6); page.mouse.up()
    page.wait_for_timeout(700)
    img = page.evaluate("({w: LD.Model.project.image.widthPx, h: LD.Model.project.image.heightPx})")
    check("s1: crop applied (≈500x400)", abs(img["w"] - 500) <= 2 and abs(img["h"] - 400) <= 2, img)
    lawn1 = page.evaluate("LD.Model.find('f_lawn').item.pts[0]")
    # lawn should have been translated by exactly the crop offset (-20,-10), NOT dragged
    ok = abs(lawn1["x"] - (lawn0["x"] - 20)) < 0.6 and abs(lawn1["y"] - (lawn0["y"] - 10)) < 0.6
    check("s1: lawn not hijack-dragged (only crop translation)", ok, f"{lawn0} -> {lawn1}")
    check("s1: object interaction restored", page.evaluate("LD.View.contentLayer.listening()"))
    # ONE undo restores image + geometry
    page.keyboard.press("Meta+z"); page.wait_for_timeout(500)
    w2 = page.evaluate("LD.Model.project.image.widthPx")
    lawn2 = page.evaluate("LD.Model.find('f_lawn').item.pts[0]")
    check("s1: single undo restores image", w2 == 800, w2)
    check("s1: single undo restores geometry", abs(lawn2["x"] - lawn0["x"]) < 0.1, lawn2)
    check("s1: no page errors", not errs, errs[:2])
    browser.close()

    # ---- scenario 2: rotated crop bakes orientation -------------------------
    browser, page, screen, errs = boot(p)
    R = 30
    page.evaluate(f"LD.View.setRotation({R})"); page.wait_for_timeout(300)
    # crop rect in the ROTATED frame: r-frame corners (r0=(10,12), r1=(60,42))
    th = math.radians(R)
    def from_rot(rx, ry):
        return (rx * math.cos(-th) - ry * math.sin(-th), rx * math.sin(-th) + ry * math.cos(-th))
    aw = from_rot(10, 12); bw = from_rot(60, 42)
    a = screen(*aw); b = screen(*bw)
    page.click("#btn-crop"); page.wait_for_timeout(200)
    page.mouse.move(a["x"], a["y"]); page.mouse.down()
    page.mouse.move(b["x"], b["y"], steps=6); page.mouse.up()
    page.wait_for_timeout(800)
    img = page.evaluate("({w: LD.Model.project.image.widthPx, h: LD.Model.project.image.heightPx})")
    check("s2: rotated crop dims ≈500x300", abs(img["w"] - 500) <= 3 and abs(img["h"] - 300) <= 3, img)
    check("s2: view rotation baked to 0", abs(page.evaluate("LD.Model.project.viewRotationDeg")) < 0.01)
    check("s2: north arrow carries rotation", abs(page.evaluate("LD.Model.project.northDeg") - R) < 0.01,
          page.evaluate("LD.Model.project.northDeg"))
    # plant at world (40,30): new pos = Rot(th)·(40,30) − (10,12)
    ex = 40 * math.cos(th) - 30 * math.sin(th) - 10
    ey = 40 * math.sin(th) + 30 * math.cos(th) - 12
    pl = page.evaluate("LD.Model.project.plants[0]")
    check("s2: geometry rotated+translated correctly",
          abs(pl["x"] - ex) < 0.7 and abs(pl["y"] - ey) < 0.7, f"{pl} expected ({ex:.1f},{ey:.1f})")
    check("s2: geo metadata dropped", page.evaluate("LD.Model.project.image.originGlobalPx === undefined"))
    # undo: image, rotation, and geometry all return
    page.keyboard.press("Meta+z"); page.wait_for_timeout(600)
    check("s2: undo restores image", page.evaluate("LD.Model.project.image.widthPx") == 800)
    check("s2: undo restores view rotation", abs(page.evaluate("LD.Model.project.viewRotationDeg") - R) < 0.01,
          page.evaluate("LD.Model.project.viewRotationDeg"))
    pl2 = page.evaluate("LD.Model.project.plants[0]")
    check("s2: undo restores plant", abs(pl2["x"] - 40) < 0.1 and abs(pl2["y"] - 30) < 0.1, pl2)
    check("s2: layers resynced to rotation", abs(page.evaluate("LD.View.rotationDeg()") - R) < 0.01,
          page.evaluate("LD.View.rotationDeg()"))
    page.screenshot(path="/tmp/ld_crop_rotated.png")
    check("s2: no page errors", not errs, errs[:2])
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed", flush=True)
sys.exit(1 if fails else 0)
