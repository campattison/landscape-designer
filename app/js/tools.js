/* Landscape Designer — tools & interaction.
   Tool set: select, pan, calibrate, trace (site features), wand (magic-wand
   segmentation), bed (freehand), hardscape, plant, groundcover, tree, label,
   dimension. Drawing previews live on the UI layer; commits go through
   Model.begin()/commit() so everything is undoable. */
window.LD = window.LD || {};

LD.Tools = (function () {
  const M = () => LD.Model;
  const V = () => LD.View;
  const G = LD.geom;

  const T = {
    current: 'select',
    // tool options (bound to UI controls)
    traceKind: 'building',
    wandKind: 'lawn',
    wandThreshold: 18,
    material: 'pavers',
    currentPlantId: null,
    gcSpacingIn: 12,
    treeRadiusFt: 8,
    orthoAssist: true,
    onToolChanged: null
  };

  // in-progress drawing state
  let draft = null;      // { pts:[], preview: Konva nodes }
  let freehand = null;
  let calib = null;      // { a }
  let dim = null;        // { a }
  let ghost = null;      // plant-placement ghost
  let wandImage = null;  // downsampled ImageData for MagicWand
  let wandFactor = 1;
  let spacePan = false;
  let aligning = false;  // one-shot "draw a line to level the view" gesture
  let alignA = null;
  let tempPan = null;    // ctrl+drag / middle-drag panning without leaving the tool
  let cropping = false;  // one-shot "drag a rectangle to crop the image" gesture
  let cropA = null;

  // ---------------------------------------------------------------- helpers
  function stage() { return V().stage; }
  function ui() { return V().uiLayer; }

  function clearPreview() {
    ui().find('.preview').forEach(n => n.destroy());
    ui().batchDraw();
  }

  function previewNode(node) {
    node.name('preview');
    node.listening(false);
    ui().add(node);
    ui().batchDraw();
  }

  function snapPoint(w, opts) {
    const s = V().zoom();
    const tol = 10 / s;
    let best = null, bestD = tol;
    // snap to existing vertices
    const cands = [];
    M().project.features.forEach(f => f.pts && f.pts.forEach(p => cands.push(p)));
    M().project.hardscape.forEach(h => h.pts.forEach(p => cands.push(p)));
    if (draft && draft.pts.length > 2) cands.push(draft.pts[0]); // close-the-loop snap
    cands.forEach(p => {
      const d = G.dist(w, p);
      if (d < bestD) { best = p; bestD = d; }
    });
    if (best) return { x: best.x, y: best.y, snapped: true };
    // ortho assist from previous draft point (shift key or toggle)
    if (draft && draft.pts.length && (opts && opts.shift) ) {
      const prev = draft.pts[draft.pts.length - 1];
      const ang = Math.atan2(w.y - prev.y, w.x - prev.x);
      const snapped = G.snapAngle(ang, Math.PI / 4);
      const d = G.dist(prev, w);
      return { x: prev.x + Math.cos(snapped) * d, y: prev.y + Math.sin(snapped) * d, snapped: false };
    }
    return w;
  }

  function requireImage() {
    if (!M().project.image) { LD.UI.toast('Add a base image first (address search or drop an image).'); return false; }
    return true;
  }
  function requireCalibrated() {
    if (!requireImage()) return false;
    const img = M().project.image;
    if (!img.calibrated) {
      LD.UI.toast('Calibrate the scale first — pick the Calibrate tool and draw a line over a known dimension.');
      return false;
    }
    return true;
  }

  // -------------------------------------------------------------- tool set
  T.set = function (name) {
    cancelDraft();
    T.current = name;
    stage().draggable(name === 'pan');
    const cursors = { select: 'default', pan: 'grab' };
    stage().container().style.cursor = cursors[name] || 'crosshair';
    if (name !== 'select') { M().select(null); V().clearHandles(); }
    V().render(); // re-render so node draggability tracks the active tool
    if (T.onToolChanged) T.onToolChanged(name);
  };

  function cancelDraft() {
    draft = null; freehand = null; calib = null; dim = null;
    if (ghost) { ghost.destroy(); ghost = null; }
    clearPreview();
  }
  T.cancelDraft = cancelDraft;

  // ------------------------------------------------------------undo/redo/kb
  function onKeyDown(e) {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) M().redo(); else M().undo();
      V().render(); LD.UI.refresh();
      return;
    }
    if (e.key === 'Escape') {
      if (cropping || aligning) setGestureShield(false);
      cropping = false; cropA = null; aligning = false; alignA = null;
      cancelDraft(); M().select(null); V().clearHandles(); V().render();
      return;
    }
    if (e.key === 'Enter') { finishPolygon(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (M().selection) {
        e.preventDefault();
        M().begin();
        M().removeById(M().selection.id);
        M().select(null);
        M().commit('delete');
        V().clearHandles(); V().render(); LD.UI.refresh();
      }
      return;
    }
    if (e.key === ' ') { if (!spacePan) { spacePan = true; stage().draggable(true); stage().container().style.cursor = 'grab'; } e.preventDefault(); return; }
    const keyTools = { v: 'select', h: 'pan', t: 'trace', w: 'wand', a: 'ai', b: 'bed', s: 'hardscape', p: 'plant', g: 'groundcover', e: 'tree', l: 'label', d: 'dimension', c: 'calibrate' };
    const t = keyTools[e.key.toLowerCase()];
    if (t && !mod) { T.set(t); LD.UI.refresh(); }
  }
  function onKeyUp(e) {
    if (e.key === ' ') { spacePan = false; if (T.current !== 'pan') { stage().draggable(false); stage().container().style.cursor = T.current === 'select' ? 'default' : 'crosshair'; } }
  }

  // --------------------------------------------------------------- polygon
  function startOrExtendPolygon(w, shift) {
    const p = snapPoint(w, { shift });
    if (!draft) draft = { pts: [] };
    // close if clicking the first vertex
    if (draft.pts.length > 2 && G.dist(p, draft.pts[0]) < 8 / V().zoom()) { finishPolygon(); return; }
    draft.pts.push({ x: p.x, y: p.y });
    drawPolyPreview(p);
  }

  function drawPolyPreview(cursorPt) {
    clearPreview();
    if (!draft || !draft.pts.length) return;
    const pts = cursorPt ? [...draft.pts, cursorPt] : draft.pts;
    previewNode(new Konva.Line({
      points: G.flat(pts),
      stroke: '#1a73e8', strokeWidth: 1.6, strokeScaleEnabled: false,
      dash: [6, 4],
      closed: false
    }));
    draft.pts.forEach((p, i) => previewNode(new Konva.Circle({
      x: p.x, y: p.y, radius: (i === 0 ? 5 : 3.5) / V().zoom(),
      fill: i === 0 ? '#1a73e8' : '#fff',
      stroke: '#1a73e8', strokeWidth: 1.5, strokeScaleEnabled: false
    })));
    // live segment length
    if (cursorPt && draft.pts.length) {
      const prev = draft.pts[draft.pts.length - 1];
      const c = G.mid(prev, cursorPt);
      previewNode(new Konva.Text({
        x: c.x, y: c.y, text: G.fmtFeet(G.dist(prev, cursorPt)),
        fontSize: 12 / V().zoom(), fontStyle: '600',
        fontFamily: 'Inter, system-ui, sans-serif', fill: '#1a73e8'
      }));
    }
  }

  function finishPolygon() {
    if (!draft) return;
    if (draft.pts.length < 3) return; // too few points — keep drawing (Esc cancels)
    const pts = draft.pts;
    M().begin();
    if (T.current === 'trace') {
      const kind = T.traceKind;
      const finalPts = (kind === 'building' && T.orthoAssist) ? G.orthogonalize(pts) : pts;
      M().project.features.push({
        id: M().newId('f'), kind,
        pts: finalPts,
        closed: kind !== 'fence' && kind !== 'property',
        label: null, source: 'traced'
      });
    } else if (T.current === 'hardscape') {
      M().project.hardscape.push({ id: M().newId('h'), material: T.material, pts, label: null });
    } else if (T.current === 'groundcover') {
      if (!T.currentPlantId) { M().cancel(); cancelDraft(); LD.UI.toast('Pick a groundcover species in the palette first.'); return; }
      const p = M().plant(T.currentPlantId);
      M().project.groundcovers.push({
        id: M().newId('g'), plantId: T.currentPlantId, pts,
        spacingIn: (p && p.spacingInches) || T.gcSpacingIn
      });
    } else {
      M().cancel(); cancelDraft(); return;
    }
    M().commit('add ' + T.current);
    cancelDraft();
    V().render(); LD.UI.refresh();
  }
  T.finishPolygon = finishPolygon;

  // for fence/property: allow finishing an open polyline with Enter
  // (handled by finishPolygon — closed flag set by kind)

  // --------------------------------------------------------------- freehand
  function bedDown(w) {
    freehand = { pts: [{ x: w.x, y: w.y }] };
  }
  function bedMove(w) {
    if (!freehand) return;
    const last = freehand.pts[freehand.pts.length - 1];
    if (G.dist(last, w) > 0.5) {
      freehand.pts.push({ x: w.x, y: w.y });
      clearPreview();
      previewNode(new Konva.Line({
        points: G.flat(freehand.pts),
        stroke: '#7d6b4f', strokeWidth: 2, strokeScaleEnabled: false,
        tension: 0.3
      }));
    }
  }
  function bedUp() {
    if (!freehand) return;
    if (freehand.pts.length > 4) {
      const simplified = G.simplifyPts(freehand.pts, 1.2);
      if (simplified.length >= 3) {
        M().begin();
        M().project.beds.push({ id: M().newId('b'), pts: simplified, label: 'Planting bed' });
        M().commit('add bed');
      }
    }
    freehand = null;
    clearPreview();
    V().render(); LD.UI.refresh();
  }

  // ------------------------------------------------------------- magic wand
  function ensureWandImage() {
    const img = M().project.image;
    if (!img) return null;
    if (wandImage && wandImage._src === img.dataURL) return wandImage;
    const el = new Image();
    el.src = img.dataURL;
    if (!el.complete) return null; // dataURL decode is sync in practice; guard anyway
    const maxDim = 1600;
    wandFactor = Math.min(1, maxDim / Math.max(img.widthPx, img.heightPx));
    const c = document.createElement('canvas');
    c.width = Math.round(img.widthPx * wandFactor);
    c.height = Math.round(img.heightPx * wandFactor);
    const ctx = c.getContext('2d');
    ctx.drawImage(el, 0, 0, c.width, c.height);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    wandImage = { data: data.data, width: c.width, height: c.height, bytes: 4, _src: img.dataURL };
    return wandImage;
  }
  T.invalidateWand = function () { wandImage = null; };

  function wandClick(w) {
    if (!requireCalibrated()) return;
    const imgMeta = M().project.image;
    const im = ensureWandImage();
    if (!im) { LD.UI.toast('Image still decoding — try again.'); return; }
    const fpp = imgMeta.ftPerPx;
    const px = Math.round((w.x / fpp) * wandFactor);
    const py = Math.round((w.y / fpp) * wandFactor);
    if (px < 0 || py < 0 || px >= im.width || py >= im.height) return;

    let mask;
    try {
      mask = MagicWand.floodFill(im, px, py, T.wandThreshold, null, true);
      mask = MagicWand.gaussBlurOnlyBorder(mask, 5);
    } catch (err) {
      console.warn('magic wand failed', err);
      LD.UI.toast('Magic wand could not segment there — try adjusting tolerance.');
      return;
    }
    let contours = MagicWand.traceContours(mask);
    contours = MagicWand.simplifyContours(contours, 1.5, 24);
    const outer = contours.filter(c => !c.inner);
    if (!outer.length) { LD.UI.toast('No region found — try a different spot or tolerance.'); return; }
    // largest outer contour
    let bestC = outer[0], bestA = 0;
    outer.forEach(c => {
      const pts = c.points.map(p => ({ x: p.x, y: p.y }));
      const a = G.polygonArea(pts);
      if (a > bestA) { bestA = a; bestC = c; }
    });
    let pts = bestC.points.map(p => ({
      x: (p.x / wandFactor) * fpp,
      y: (p.y / wandFactor) * fpp
    }));
    pts = G.simplifyPts(pts, 0.8);
    if (pts.length < 3) { LD.UI.toast('Region too small.'); return; }
    if (T.wandKind === 'building' && T.orthoAssist) pts = G.orthogonalize(pts);

    M().begin();
    M().project.features.push({
      id: M().newId('f'), kind: T.wandKind, pts, closed: true, label: null, source: 'wand'
    });
    M().commit('wand ' + T.wandKind);
    V().render(); LD.UI.refresh();
    LD.UI.toast(`Added ${T.wandKind} (${G.fmtArea(G.polygonArea(pts))}) — edit vertices with the Select tool.`);
  }

  // -------------------------------------------------------------- calibrate
  function calibrateClick(w) {
    if (!requireImage()) return;
    if (!calib) {
      calib = { a: w };
      previewNode(new Konva.Circle({ x: w.x, y: w.y, radius: 4 / V().zoom(), fill: '#e8710a' }));
      return;
    }
    const a = calib.a, b = w;
    clearPreview(); calib = null;
    const distWorld = G.dist(a, b);
    if (distWorld < 0.001) return;
    const img = M().project.image;
    const distPx = distWorld / (img.ftPerPx || 1);
    LD.UI.promptDistance(distPx).then(feet => {
      if (!feet || feet <= 0) return;
      M().begin();
      M().setScale(feet / distPx);
      M().commit('calibrate');
      V().render(); V().zoomToFit(); LD.UI.refresh();
      LD.UI.toast(`Scale set: 1 px = ${(feet / distPx).toFixed(3)} ft. All geometry rescaled.`);
      T.invalidateWand();
    });
  }
  function calibrateMove(w) {
    if (!calib) return;
    clearPreview();
    previewNode(new Konva.Line({
      points: [calib.a.x, calib.a.y, w.x, w.y],
      stroke: '#e8710a', strokeWidth: 2, strokeScaleEnabled: false, dash: [6, 4]
    }));
    previewNode(new Konva.Circle({ x: calib.a.x, y: calib.a.y, radius: 4 / V().zoom(), fill: '#e8710a' }));
  }

  // -------------------------------------------------------------- dimension
  function dimensionClick(w) {
    if (!dim) { dim = { a: w }; return; }
    M().begin();
    M().project.dimensions.push({ id: M().newId('d'), ax: dim.a.x, ay: dim.a.y, bx: w.x, by: w.y });
    M().commit('add dimension');
    dim = null; clearPreview();
    V().render();
  }
  function dimensionMove(w) {
    if (!dim) return;
    clearPreview();
    previewNode(new Konva.Line({
      points: [dim.a.x, dim.a.y, w.x, w.y],
      stroke: '#b04747', strokeWidth: 1.5, strokeScaleEnabled: false, dash: [4, 3]
    }));
  }

  // ------------------------------------------------------------------ plant
  function plantMove(w) {
    if (!T.currentPlantId) return;
    const p = M().plant(T.currentPlantId);
    const r = (p ? p.spreadFt : 6) / 2;
    if (!ghost) {
      ghost = new Konva.Circle({
        radius: r, stroke: '#33532c', strokeWidth: 1.4, strokeScaleEnabled: false,
        dash: [5, 4], fill: 'rgba(80,120,70,0.12)', listening: false, name: 'preview'
      });
      ui().add(ghost);
    }
    ghost.radius(r);
    ghost.position(w);
    ui().batchDraw();
  }
  function plantClick(w) {
    if (!requireCalibrated()) return;
    if (!T.currentPlantId) { LD.UI.toast('Pick a plant from the palette first.'); return; }
    const p = M().plant(T.currentPlantId);
    M().begin();
    M().project.plants.push({
      id: M().newId('p'), plantId: T.currentPlantId,
      x: w.x, y: w.y, spreadFt: p ? p.spreadFt : 6
    });
    M().commit('add plant');
    V().render(); LD.UI.refresh();
  }

  // ------------------------------------------------------------------- tree
  function treeClick(w) {
    if (!requireCalibrated()) return;
    M().begin();
    M().project.features.push({
      id: M().newId('f'), kind: 'tree-existing',
      pts: [{ x: w.x, y: w.y }], radiusFt: T.treeRadiusFt,
      closed: false, label: null, source: 'manual'
    });
    M().commit('add tree');
    V().render();
  }

  // ---------------------------------------------------------------- AI (SAM)
  async function aiClick(w) {
    if (!requireCalibrated()) return;
    const img = M().project.image;
    const fpp = img.ftPerPx;
    const px = w.x / fpp, py = w.y / fpp;
    if (px < 0 || py < 0 || px >= img.widthPx || py >= img.heightPx) return;
    if (LD.Sam.busy()) { LD.UI.toast('Still working on the last click…'); return; }
    try {
      const ptsPx = await LD.Sam.segmentAt(img, px, py, s => LD.UI.samStatus(s));
      if (!ptsPx || ptsPx.length < 3) { LD.UI.toast('No region found there — try the magic wand or trace it.'); return; }
      let pts = ptsPx.map(p => ({ x: p.x * fpp, y: p.y * fpp }));
      pts = G.simplifyPts(pts, 0.8);
      if (pts.length < 3) { LD.UI.toast('Region too small.'); return; }
      if (T.wandKind === 'building' && T.orthoAssist) pts = G.orthogonalize(pts);
      M().begin();
      M().project.features.push({
        id: M().newId('f'), kind: T.wandKind, pts, closed: true, label: null, source: 'sam'
      });
      M().commit('ai ' + T.wandKind);
      V().render(); LD.UI.refresh();
      LD.UI.samStatus('');
      LD.UI.toast(`AI added ${T.wandKind} (${G.fmtArea(G.polygonArea(pts))}) — adjust vertices with Select.`);
    } catch (err) {
      console.warn('SAM failed', err);
      LD.UI.samStatus('');
      LD.UI.toast('AI detection failed (' + (err.message || err) + '). Magic wand and tracing still work.', 6000);
    }
  }

  // ------------------------------------------- right-click select (any tool)
  function entityIdFromNode(node) {
    let n = node;
    while (n && n !== stage()) {
      if (n.getAttr && n.getAttr('entityId')) return n.getAttr('entityId');
      n = n.getParent && n.getParent();
    }
    return null;
  }

  function rightClickSelect(target) {
    if (draft || freehand) return; // don't nuke an in-progress drawing
    const eid = entityIdFromNode(target);
    if (!eid) return;
    const found = M().find(eid);
    if (!found) return;
    T.set('select');
    M().select({ type: found.collection, id: eid });
    V().render();
    if (found.item.pts && found.item.kind !== 'tree-existing') V().showHandles(found.item);
    LD.UI.editEntity(found.collection, found.item); // focus the Object panel
    LD.UI.toast('Selected — drag handles to reshape (squares add points), Delete removes it.');
  }

  // ------------------------------------------------------------ crop image
  /* Crop/align gestures must own the pointer completely — otherwise a drag
     that starts on a draggable object becomes an accidental object move. */
  function setGestureShield(on) {
    V().contentLayer.listening(!on);
  }

  T.startCrop = function () {
    if (!requireImage()) return;
    cropping = true; cropA = null;
    setGestureShield(true);
    stage().container().style.cursor = 'crosshair';
    LD.UI.toast('Drag a rectangle over the area to KEEP — it follows your page orientation (⌘Z undoes). Esc cancels.', 7000);
  };

  // rotated-frame helpers: r = A·w rotates world into the screen-aligned frame
  function toRot(w, th) { return { x: w.x * Math.cos(th) - w.y * Math.sin(th), y: w.x * Math.sin(th) + w.y * Math.cos(th) }; }
  function fromRot(r, th) { return toRot(r, -th); }

  function cropPreview(w) {
    clearPreview();
    const R = M().project.viewRotationDeg || 0;
    const th = R * Math.PI / 180;
    const ra = toRot(cropA, th), rb = toRot(w, th);
    const rx0 = Math.min(ra.x, rb.x), ry0 = Math.min(ra.y, rb.y);
    const c0 = fromRot({ x: rx0, y: ry0 }, th);
    previewNode(new Konva.Rect({
      x: c0.x, y: c0.y,
      width: Math.abs(rb.x - ra.x), height: Math.abs(rb.y - ra.y),
      rotation: -R, // node counter-rotation → rect reads screen-aligned
      stroke: '#e8710a', strokeWidth: 2, strokeScaleEnabled: false, dash: [8, 4],
      fill: 'rgba(232,113,10,0.08)'
    }));
  }

  async function cropUp(w) {
    const a = cropA;
    cropping = false; cropA = null;
    setGestureShield(false);
    clearPreview();
    stage().container().style.cursor = T.current === 'select' ? 'default' : 'crosshair';
    const img = M().project.image;
    const fpp = img.ftPerPx || 1;
    const R = M().project.viewRotationDeg || 0;

    const el = new Image();
    el.src = img.dataURL;
    if (!el.complete) await new Promise((res, rej) => { el.onload = res; el.onerror = rej; });

    if (Math.abs(R) < 0.5) {
      // ---- axis-aligned crop: keeps geo metadata (Expand / footprints live on)
      let x0 = Math.max(0, Math.min(a.x, w.x)), y0 = Math.max(0, Math.min(a.y, w.y));
      let x1 = Math.min(LD.Model.imageWidthFt(), Math.max(a.x, w.x));
      let y1 = Math.min(LD.Model.imageHeightFt(), Math.max(a.y, w.y));
      if (x1 - x0 < 10 * fpp || y1 - y0 < 10 * fpp) { LD.UI.toast('Crop area too small — nothing changed.'); return; }
      const px0 = Math.round(x0 / fpp), py0 = Math.round(y0 / fpp);
      const px1 = Math.round(x1 / fpp), py1 = Math.round(y1 / fpp);
      const c = document.createElement('canvas');
      c.width = px1 - px0; c.height = py1 - py0;
      c.getContext('2d').drawImage(el, -px0, -py0);

      M().begin(true); // image travels with the undo snapshot
      img.dataURL = c.toDataURL('image/jpeg', 0.92);
      img.widthPx = c.width; img.heightPx = c.height;
      if (img.originGlobalPx) {
        img.originGlobalPx = { x: img.originGlobalPx.x + px0, y: img.originGlobalPx.y + py0 };
        const nw = LD.Imagery.globalPxToLatLon(img.originGlobalPx.x, img.originGlobalPx.y, img.zoom);
        const se = LD.Imagery.globalPxToLatLon(img.originGlobalPx.x + img.widthPx, img.originGlobalPx.y + img.heightPx, img.zoom);
        img.bbox = { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon };
      }
      M().translateAll(-px0 * fpp, -py0 * fpp);
      M().commit('crop image');
      LD.UI.toast(`Cropped to ${LD.geom.fmtFeet((px1 - px0) * fpp)} × ${LD.geom.fmtFeet((py1 - py0) * fpp)} — drawings kept their positions.`, 5000);
    } else {
      // ---- rotated crop: the rect follows the work-page orientation and that
      // orientation is BAKED into the image (resampled) and all geometry.
      const th = R * Math.PI / 180;
      const ra = toRot(a, th), rb = toRot(w, th);
      const rx0 = Math.min(ra.x, rb.x), ry0 = Math.min(ra.y, rb.y);
      const wFt = Math.abs(rb.x - ra.x), hFt = Math.abs(rb.y - ra.y);
      if (wFt < 10 * fpp || hFt < 10 * fpp) { LD.UI.toast('Crop area too small — nothing changed.'); return; }
      const c = document.createElement('canvas');
      c.width = Math.round(wFt / fpp); c.height = Math.round(hFt / fpp);
      const ctx = c.getContext('2d');
      // canvasPx = A·(imagePx) − r0/fpp
      ctx.translate(-rx0 / fpp, -ry0 / fpp);
      ctx.rotate(th);
      ctx.drawImage(el, 0, 0);

      M().begin(true);
      img.dataURL = c.toDataURL('image/jpeg', 0.92);
      img.widthPx = c.width; img.heightPx = c.height;
      // rotation is no longer just a view — geo metadata can't survive it
      delete img.originGlobalPx; delete img.bbox;
      M().transformAll((x, y) => {
        const r = toRot({ x, y }, th);
        return { x: r.x - rx0, y: r.y - ry0 };
      });
      M().project.northDeg = (M().project.northDeg || 0) + R;
      M().project.viewRotationDeg = 0;
      M().commit('crop image (rotated)');
      LD.UI.toast(`Cropped to ${LD.geom.fmtFeet(wFt)} × ${LD.geom.fmtFeet(hFt)} in your page orientation. Note: Expand map / footprints are disabled once rotation is baked in.`, 7000);
    }
    T.invalidateWand();
    V().render(); V().zoomToFit(); LD.UI.refresh();
  }

  // -------------------------------------------------- align (level the view)
  T.startAlign = function () {
    if (!requireImage()) return;
    aligning = true; alignA = null;
    setGestureShield(true);
    stage().container().style.cursor = 'crosshair';
    LD.UI.toast('Drag a line along an edge that should read horizontal (e.g., the front of the house).', 6000);
  };

  function alignUp(w) {
    if (!alignA) { aligning = false; setGestureShield(false); return; }
    const a = alignA;
    aligning = false; alignA = null;
    setGestureShield(false);
    clearPreview();
    if (G.dist(a, w) < 2 / V().zoom()) return; // too short to mean anything
    const theta = Math.atan2(w.y - a.y, w.x - a.x) * 180 / Math.PI;
    let r = -theta;
    while (r > 90) r -= 180;   // stay near-upright; never flips the view over
    while (r < -90) r += 180;
    V().setRotation(r);
    LD.UI.refresh();
    stage().container().style.cursor = T.current === 'select' ? 'default' : 'crosshair';
  }

  // ------------------------------------------------------------------ label
  function labelClick(w) {
    LD.UI.promptText('Label text').then(text => {
      if (!text) return;
      M().begin();
      M().project.labels.push({
        id: M().newId('l'), text,
        x: w.x + 4, y: w.y - 4,
        anchorX: w.x, anchorY: w.y, hasLeader: true
      });
      M().commit('add label');
      V().render();
    });
  }

  // ------------------------------------------------------------ stage wiring
  T.init = function () {
    const st = stage();

    // right-click / ctrl+click never opens the browser menu on the canvas
    st.container().addEventListener('contextmenu', e => e.preventDefault());

    st.on('mousedown touchstart', e => {
      const btn = e.evt.button;
      // ctrl+drag or middle-drag = pan without leaving the current tool
      if (btn === 1 || (btn === 0 && e.evt.ctrlKey)) {
        tempPan = { x: e.evt.clientX, y: e.evt.clientY };
        st.container().style.cursor = 'grabbing';
        e.evt.preventDefault();
        return;
      }
      // right-click = select whatever is under the cursor, from any tool
      if (btn === 2) { rightClickSelect(e.target); return; }
      if (spacePan || T.current === 'pan') return;
      const wAll = V().worldFromPointer();
      if (cropping) { if (wAll) cropA = wAll; return; }
      if (aligning) { if (wAll) alignA = wAll; return; }
      if (e.target !== st && T.current === 'select') return; // node handles it
      const w = wAll;
      if (!w) return;
      const shift = e.evt.shiftKey;
      switch (T.current) {
        case 'select':
          M().select(null); V().clearHandles(); V().render(); LD.UI.refresh();
          break;
        case 'trace': case 'hardscape': case 'groundcover':
          if (!requireCalibrated()) return;
          startOrExtendPolygon(w, shift);
          break;
        case 'bed':
          if (!requireCalibrated()) return;
          bedDown(w);
          break;
        case 'wand': wandClick(w); break;
        case 'ai': aiClick(w); break;
        case 'calibrate': calibrateClick(w); break;
        case 'dimension': dimensionClick(w); break;
        case 'plant': plantClick(w); break;
        case 'tree': treeClick(w); break;
        case 'label': labelClick(w); break;
      }
    });

    st.on('mousemove touchmove', e => {
      if (tempPan) {
        V().nudgeView(e.evt.clientX - tempPan.x, e.evt.clientY - tempPan.y);
        tempPan = { x: e.evt.clientX, y: e.evt.clientY };
        return;
      }
      const w = V().worldFromPointer();
      if (!w) return;
      if (cropping && cropA) { cropPreview(w); return; }
      if (aligning && alignA) {
        clearPreview();
        previewNode(new Konva.Line({
          points: [alignA.x, alignA.y, w.x, w.y],
          stroke: '#7b3fbf', strokeWidth: 2, strokeScaleEnabled: false, dash: [8, 4]
        }));
        return;
      }
      switch (T.current) {
        case 'trace': case 'hardscape': case 'groundcover':
          if (draft) drawPolyPreview(snapPoint(w, { shift: false }));
          break;
        case 'bed': bedMove(w); break;
        case 'calibrate': calibrateMove(w); break;
        case 'dimension': dimensionMove(w); break;
        case 'plant': plantMove(w); break;
      }
      LD.UI.updateStatus(w);
    });

    st.on('mouseup touchend', () => {
      if (tempPan) {
        tempPan = null;
        st.container().style.cursor = T.current === 'select' ? 'default' : (T.current === 'pan' ? 'grab' : 'crosshair');
        return;
      }
      if (cropping && cropA) { const w = V().worldFromPointer(); if (w) cropUp(w); return; }
      if (aligning) { const w = V().worldFromPointer(); if (w) alignUp(w); return; }
      if (T.current === 'bed') bedUp();
    });

    st.on('dblclick dbltap', () => {
      // Konva fires dblclick for ANY two clicks within 400ms regardless of
      // position, so rapid polygon clicking lands here constantly. Only treat
      // it as "finish" when the last two points coincide (a true double-click
      // in place); drop the duplicate point the second click added.
      if (!['trace', 'hardscape', 'groundcover'].includes(T.current)) return;
      if (!draft || draft.pts.length < 4) return;
      const n = draft.pts.length;
      const tol = 6 / V().zoom();
      if (G.dist(draft.pts[n - 1], draft.pts[n - 2]) < tol) {
        draft.pts.pop();
        finishPolygon();
      }
    });

    // node events from View
    V().onNodeEvent = function (evtName, info, e) {
      if (T.current !== 'select') return;
      if (info.locked) return;
      if (evtName === 'down') {
        e.cancelBubble = true;
        M().select({ type: info.type, id: info.entity.id });
        V().render();
        if (info.entity.pts && info.entity.kind !== 'tree-existing') {
          V().showHandles(info.entity);
        } else {
          V().clearHandles();
        }
        LD.UI.refresh();
      } else if (evtName === 'dblclick') {
        LD.UI.editEntity(info.type, info.entity);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  };

  return T;
})();
