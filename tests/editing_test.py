"""Editing UX test: right-click select, delete, ctrl+drag pan, midpoint vertex insert, custom plant."""
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
    ImageDraw.Draw(im).rectangle([250, 180, 520, 400], fill=(120, 118, 115))
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

    def screen(wx, wy):
        return page.evaluate(f"""(() => {{
            const s = LD.View.worldToScreen({{x: {wx}, y: {wy}}});
            const box = LD.View.stage.container().getBoundingClientRect();
            return {{ x: box.x + s.x, y: box.y + s.y }};
        }})()""")

    # seed: one plant + one traced rectangle feature via model
    page.evaluate("""(() => {
        const M = LD.Model;
        M.begin();
        M.project.plants.push({ id: 'p_test', plantId: M.plantsDb[0].id, x: 20, y: 15, spreadFt: 10 });
        M.project.features.push({ id: 'f_test', kind: 'driveway',
            pts: [{x:55,y:35},{x:75,y:35},{x:75,y:45},{x:55,y:45}], closed: true, label: null, source: 'traced' });
        M.commit('seed');
        LD.View.render(); LD.UI.refresh();
    })()""")
    page.wait_for_timeout(300)

    # 1. ctrl+drag pans while in the PLANT tool (no plant placed, view moves)
    page.evaluate("LD.Tools.set('plant')")
    page.evaluate("LD.Tools.currentPlantId = LD.Model.plantsDb[0].id")
    pos0 = page.evaluate("({x: LD.View.contentLayer.x(), y: LD.View.contentLayer.y()})")
    n0 = page.evaluate("LD.Model.project.plants.length")
    c1 = screen(40, 30); c2 = screen(30, 25)
    page.keyboard.down("Control")
    page.mouse.move(c1["x"], c1["y"]); page.mouse.down()
    page.mouse.move(c2["x"], c2["y"], steps=5)
    page.mouse.up()
    page.keyboard.up("Control")
    page.wait_for_timeout(200)
    pos1 = page.evaluate("({x: LD.View.contentLayer.x(), y: LD.View.contentLayer.y()})")
    moved = abs(pos1["x"] - pos0["x"]) > 20 or abs(pos1["y"] - pos0["y"]) > 20
    n1 = page.evaluate("LD.Model.project.plants.length")
    check("ctrl+drag pans in plant tool", moved, f"{pos0} -> {pos1}")
    check("ctrl+drag placed no plant", n1 == n0, n1)

    # 2. right-click the plant (still in plant tool) → selects + switches to select
    c = screen(20, 15)
    page.mouse.click(c["x"], c["y"], button="right")
    page.wait_for_timeout(300)
    sel = page.evaluate("LD.Model.selection")
    tool = page.evaluate("LD.Tools.current")
    check("right-click selects plant from plant tool", sel and sel["id"] == "p_test" and tool == "select", f"sel={sel} tool={tool}")

    # 3. Delete key removes it
    page.keyboard.press("Delete")
    page.wait_for_timeout(200)
    check("Delete removes selected plant", page.evaluate("LD.Model.project.plants.length") == n0 - 1)

    # 4. right-click the driveway → handles appear (4 vertices + 4 midpoints)
    c = screen(65, 40)
    page.mouse.click(c["x"], c["y"], button="right")
    page.wait_for_timeout(300)
    nh = page.evaluate("LD.View.handles.length")
    check("driveway handles: 4 vertices + 4 midpoints", nh == 8, nh)

    # 5. drag a midpoint handle → vertex inserted (4 -> 5 pts)
    m = screen(65, 35)  # midpoint of top edge
    page.mouse.move(m["x"], m["y"]); page.mouse.down()
    tgt = screen(65, 30)
    page.mouse.move(tgt["x"], tgt["y"], steps=5)
    page.mouse.up()
    page.wait_for_timeout(300)
    npts = page.evaluate("LD.Model.find('f_test').item.pts.length")
    newpt = page.evaluate("LD.Model.find('f_test').item.pts[1]")
    ok5 = npts == 5 and abs(newpt["x"] - 65) < 1.5 and abs(newpt["y"] - 30) < 1.5
    check("midpoint drag inserts vertex at drop point", ok5, f"npts={npts} newpt={newpt}")

    # 6. undo restores 4 points
    page.keyboard.press("Meta+z")
    page.wait_for_timeout(200)
    check("undo removes inserted vertex", page.evaluate("LD.Model.find('f_test').item.pts.length") == 4)

    # 7. custom plant dialog
    page.evaluate("LD.Tools.set('plant')")
    page.wait_for_timeout(200)
    page.click("#pal-custom")
    page.wait_for_timeout(200)
    page.fill("#cp-common", "Test Maple")
    page.fill("#cp-spread", "35")
    page.fill("#cp-height", "50")
    page.click("#cp-ok")
    page.wait_for_timeout(300)
    cp = page.evaluate("LD.Model.project.customPlants")
    cur = page.evaluate("LD.Tools.currentPlantId")
    check("custom plant added & selected", len(cp) == 1 and cp[0]["spreadFt"] == 35 and cur == cp[0]["id"], cp)
    c = screen(30, 40)
    page.mouse.click(c["x"], c["y"])
    page.wait_for_timeout(200)
    placed = page.evaluate("LD.Model.project.plants[LD.Model.project.plants.length-1]")
    check("custom plant placeable", placed and placed["spreadFt"] == 35, placed)

    real_errors = [e for e in errs if "favicon" not in e]
    check("no page errors", not real_errors, "; ".join(real_errors[:3]))
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed", flush=True)
sys.exit(1 if fails else 0)
