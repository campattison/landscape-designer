"""Live test of the address → imagery → footprints flow (hits Nominatim/Esri/Overpass)."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8377/index.html"
def log(*a): print(*a, flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("dialog", lambda d: d.dismiss())
    page.goto(URL); page.wait_for_timeout(1200)
    if page.evaluate("document.getElementById('dlg-welcome').open"): page.click('#welcome-ok')

    # search a well-known address (public building, downtown Nashville)
    page.fill("#addr-input", "Ryman Auditorium, Nashville")
    page.click("#addr-go")
    page.wait_for_selector(".addr-result", timeout=20000)
    n = page.locator(".addr-result").count()
    log("geocode results:", n)
    page.locator(".addr-result").first.click()

    # wait for imagery fetch to complete (start screen hides)
    page.wait_for_selector("#start-screen", state="hidden", timeout=40000)
    img = page.evaluate("LD.Model.project.image")
    log("imagery: zoom", img["zoom"], "size", img["widthPx"], "x", img["heightPx"],
        "ftPerPx", round(img["ftPerPx"], 4), "calibrated", img["calibrated"])
    ok_scale = 0.05 < img["ftPerPx"] < 1.0
    log("PASS scale plausible" if ok_scale else "FAIL scale implausible")

    # footprints button visible?
    vis = page.is_visible("#btn-footprints")
    log("footprints button visible:", vis)
    if vis:
        page.click("#btn-footprints")
        page.wait_for_timeout(12000)  # overpass can be slow
        nb = page.evaluate("LD.Model.project.features.filter(f => f.source === 'osm').length")
        log("OSM building footprints added:", nb)
        if nb:
            # sanity: footprint pts within image bounds
            inb = page.evaluate("""(() => {
                const f = LD.Model.project.features.find(f => f.source === 'osm');
                const W = LD.Model.imageWidthFt(), H = LD.Model.imageHeightFt();
                return f.pts.every(p => p.x > -50 && p.x < W + 50 && p.y > -50 && p.y < H + 50);
            })()""")
            log("PASS footprints project inside image" if inb else "FAIL footprints out of bounds")

    # expand map: place a marker plant, expand, verify image grew and geometry shifted with it
    page.evaluate("""(() => {
        const M = LD.Model;
        M.begin();
        M.project.plants.push({ id: 'p_anchor', plantId: M.plantsDb[0].id, x: 100, y: 100, spreadFt: 10 });
        M.commit('anchor');
    })()""")
    w0 = page.evaluate("LD.Model.project.image.widthPx")
    fpp = page.evaluate("LD.Model.project.image.ftPerPx")
    page.click("#btn-expand")
    for _ in range(30):
        page.wait_for_timeout(1000)
        if page.evaluate("LD.Model.project.image.widthPx") != w0:
            break
    page.wait_for_timeout(500)
    w1 = page.evaluate("LD.Model.project.image.widthPx")
    log("expand: widthPx", w0, "->", w1)
    log("PASS map expanded by one tile ring" if w1 == w0 + 512 else f"FAIL expand ({w0}->{w1})")
    px = page.evaluate("LD.Model.project.plants.find(p => p.id === 'p_anchor').x")
    expected = 100 + 256 * fpp
    log("PASS geometry shifted with origin" if abs(px - expected) < 0.5 else f"FAIL geometry shift (x={px}, expected {expected})")

    page.screenshot(path="/tmp/ld_address_test.png")
    log("errors:", [e for e in errs if "favicon" not in e][:5])
    browser.close()
log("done")
