/* Landscape Designer — canvas view (Konva).
   World coordinates are FEET (1 Konva unit = 1 ft); the stage transform is the
   view (scale = px/ft zoom, position = pan). Strokes use strokeScaleEnabled(false)
   so linework stays crisp at any zoom; pattern fills are scaled to world units so
   hatches stay scale-true. Full rebuild on model change (cheap at this scale). */
window.LD = window.LD || {};

LD.View = (function () {
  const M = () => LD.Model;
  const G = LD.geom;

  const FEATURE_STYLE = {
    building:      { fill: 'rgba(216,216,216,0.88)', stroke: '#454545', name: 'Building' },
    driveway:      { fill: 'rgba(207,201,191,0.75)', stroke: '#6b665e', name: 'Driveway' },
    sidewalk:      { fill: 'rgba(228,224,215,0.75)', stroke: '#7a756c', name: 'Sidewalk' },
    patio:         { fill: 'rgba(222,215,203,0.75)', stroke: '#7a756c', name: 'Patio (existing)' },
    pool:          { fill: 'rgba(185,217,234,0.8)',  stroke: '#4f7f9a', name: 'Pool' },
    lawn:          { fill: 'rgba(217,230,200,0.5)',  stroke: '#7a9464', name: 'Lawn' },
    'bed-existing':{ fill: 'rgba(229,217,192,0.6)',  stroke: '#8f7f63', name: 'Bed (existing)' },
    'tree-existing':{fill: 'rgba(0,0,0,0)',          stroke: '#6f6f6f', name: 'Existing tree' },
    fence:         { fill: 'rgba(0,0,0,0)',          stroke: '#555555', name: 'Fence' },
    property:      { fill: 'rgba(0,0,0,0)',          stroke: '#b04747', name: 'Property line' },
    other:         { fill: 'rgba(221,221,221,0.6)',  stroke: '#666666', name: 'Other' }
  };
  const FEATURE_KINDS = Object.keys(FEATURE_STYLE);

  const V = {
    stage: null,
    groups: {},        // base, site, hardscape, beds, planting, annotation
    uiLayer: null,
    contentLayer: null,
    imageNode: null,
    gridGroup: null,
    handles: [],       // vertex-edit handles
    FEATURE_STYLE, FEATURE_KINDS,
    onNodeEvent: null  // set by Tools: (evtName, entity, konvaEvt) => {}
  };

  /* The view transform (zoom + rotation + pan) lives on the LAYERS, not the
     stage — Konva does not reliably support stage-level rotation. Both layers
     always carry identical transforms. */
  V.zoom = () => V.contentLayer.scaleX();
  V.rotationDeg = () => V.contentLayer.rotation();

  function eachViewLayer(fn) { [V.contentLayer, V.uiLayer].forEach(fn); }
  function setView(scale, rotationDeg, pos) {
    eachViewLayer(l => {
      l.scale({ x: scale, y: scale });
      l.rotation(rotationDeg);
      if (pos) l.position(pos);
    });
  }
  function nudgeView(dx, dy) {
    eachViewLayer(l => l.position({ x: l.x() + dx, y: l.y() + dy }));
  }
  V.nudgeView = nudgeView;

  V.init = function (containerId) {
    const el = document.getElementById(containerId);
    V.stage = new Konva.Stage({
      container: containerId,
      width: el.clientWidth,
      height: el.clientHeight
    });
    V.contentLayer = new Konva.Layer();
    V.uiLayer = new Konva.Layer({ listening: false });

    ['base', 'site', 'hardscape', 'beds', 'planting', 'annotation'].forEach(k => {
      V.groups[k] = new Konva.Group({ name: k });
      V.contentLayer.add(V.groups[k]);
    });
    V.stage.add(V.contentLayer);
    V.stage.add(V.uiLayer);

    window.addEventListener('resize', () => {
      V.stage.width(el.clientWidth);
      V.stage.height(el.clientHeight);
    });

    // wheel zoom around cursor (rotation-safe: work through the transform)
    V.stage.on('wheel', e => {
      e.evt.preventDefault();
      const pointer = V.stage.getPointerPosition();
      const w = V.worldFromPointer();
      if (!w) return;
      const old = V.zoom();
      const factor = e.evt.deltaY > 0 ? 0.9 : 1.1;
      const ns = Math.max(0.05, Math.min(400, old * factor));
      setView(ns, V.rotationDeg(), null);
      const q = V.contentLayer.getAbsoluteTransform().point(w);
      nudgeView(pointer.x - q.x, pointer.y - q.y);
      V.refreshHandles();
      if (V.onViewChanged) V.onViewChanged();
    });
  };

  V.worldFromPointer = function () {
    const p = V.stage.getPointerPosition();
    if (!p) return null;
    return V.contentLayer.getAbsoluteTransform().copy().invert().point(p);
  };

  V.worldToScreen = function (w) {
    return V.contentLayer.getAbsoluteTransform().point(w);
  };

  function extentCorners() {
    const proj = M().project;
    let b;
    if (proj.image) {
      b = { minX: 0, minY: 0, maxX: LD.Model.imageWidthFt(), maxY: LD.Model.imageHeightFt() };
    } else {
      b = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    }
    return [
      { x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }
    ];
  }

  V.zoomToFit = function () {
    const rot = M().project.viewRotationDeg || 0;
    const corners = extentCorners();
    const rad = rot * Math.PI / 180;
    const rx = corners.map(c => c.x * Math.cos(rad) - c.y * Math.sin(rad));
    const ry = corners.map(c => c.x * Math.sin(rad) + c.y * Math.cos(rad));
    const w = Math.max(...rx) - Math.min(...rx), h = Math.max(...ry) - Math.min(...ry);
    const pad = 40; // px
    const s = Math.min((V.stage.width() - pad * 2) / w, (V.stage.height() - pad * 2) / h);
    setView(s, rot, { x: 0, y: 0 });
    const t = V.contentLayer.getAbsoluteTransform();
    const pts = corners.map(c => t.point(c));
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    nudgeView(
      (V.stage.width() - (maxX - minX)) / 2 - minX,
      (V.stage.height() - (maxY - minY)) / 2 - minY
    );
    if (V.onViewChanged) V.onViewChanged();
  };

  /* Rotate the view around the viewport center; keeps world geometry (and the
     model) untouched — only the presentation rotates. Persisted so exports
     share the orientation. */
  V.setRotation = function (deg) {
    const c = { x: V.stage.width() / 2, y: V.stage.height() / 2 };
    const w = V.contentLayer.getAbsoluteTransform().copy().invert().point(c);
    setView(V.zoom(), deg, null);
    const q = V.contentLayer.getAbsoluteTransform().point(w);
    nudgeView(c.x - q.x, c.y - q.y);
    M().project.viewRotationDeg = deg;
    M().autosaveNow();
    V.render(); // labels re-derive their keep-upright rotation
    if (V.onViewChanged) V.onViewChanged();
  };

  // ---- render -------------------------------------------------------------
  let imageCacheURL = null, imageEl = null;

  V.render = function (opts) {
    const proj = M().project;
    Object.values(V.groups).forEach(g => g.destroyChildren());
    // keepHandles: a vertex/midpoint handle is mid-drag — destroying it would
    // kill the drag gesture itself
    if (!opts || !opts.keepHandles) V.clearHandles();

    // layer visibility
    Object.keys(V.groups).forEach(k => {
      const st = proj.layerState[k];
      V.groups[k].visible(st ? st.visible : true);
    });

    renderBase(proj);
    renderSite(proj);
    renderHardscape(proj);
    renderBeds(proj);
    renderGroundcovers(proj);
    renderPlants(proj);
    renderAnnotation(proj);
    renderSelectionHighlight();

    V.contentLayer.batchDraw();
  };

  function interactive(node, entity, type, layerKey) {
    node.setAttr('entityId', entity.id);
    node.setAttr('entityType', type);
    const locked = M().project.layerState[layerKey] && M().project.layerState[layerKey].locked;
    node.on('mousedown tap', e => { if (V.onNodeEvent) V.onNodeEvent('down', { type, entity, layerKey, locked }, e); });
    node.on('dblclick dbltap', e => { if (V.onNodeEvent) V.onNodeEvent('dblclick', { type, entity, layerKey, locked }, e); });
    node.on('mouseenter', () => { if (LD.Tools && LD.Tools.current === 'select' && !locked) V.stage.container().style.cursor = 'move'; });
    node.on('mouseleave', () => { V.stage.container().style.cursor = ''; });
  }

  function selectMode() { return !LD.Tools || LD.Tools.current === 'select'; }

  function makeDraggable(node, entity, apply) {
    node.draggable(selectMode()); // draggable only under the Select tool — otherwise
                                  // node drags swallow drawing gestures (bed, trace)
    node.on('dragstart', () => { M().begin(); });
    node.on('dragend', () => {
      apply(node);
      node.position({ x: 0, y: 0 });
      M().commit('move');
    });
  }

  function renderBase(proj) {
    const g = V.groups.base;
    if (proj.image) {
      if (imageCacheURL !== proj.image.dataURL) {
        imageCacheURL = proj.image.dataURL;
        imageEl = new Image();
        imageEl.onload = () => { V.render(); };
        imageEl.src = proj.image.dataURL;
      }
      if (imageEl && imageEl.complete && imageEl.naturalWidth) {
        const fpp = proj.image.ftPerPx || 1;
        g.add(new Konva.Image({
          image: imageEl,
          x: 0, y: 0,
          scaleX: fpp, scaleY: fpp,
          listening: false,
          opacity: proj.layerState.base.dim ? 0.45 : 1
        }));
      }
    }
    // optional 10-ft grid
    if (proj.layerState.base.grid && proj.image) {
      const wf = LD.Model.imageWidthFt(), hf = LD.Model.imageHeightFt();
      const grid = new Konva.Group({ listening: false });
      for (let x = 0; x <= wf; x += 10) {
        grid.add(new Konva.Line({ points: [x, 0, x, hf], stroke: 'rgba(60,90,150,0.25)', strokeWidth: 1, strokeScaleEnabled: false }));
      }
      for (let y = 0; y <= hf; y += 10) {
        grid.add(new Konva.Line({ points: [0, y, wf, y], stroke: 'rgba(60,90,150,0.25)', strokeWidth: 1, strokeScaleEnabled: false }));
      }
      g.add(grid);
    }
  }

  function polyNode(pts, closed, style, extra) {
    return new Konva.Line(Object.assign({
      points: G.flat(pts),
      closed,
      fill: closed ? style.fill : undefined,
      stroke: style.stroke,
      strokeWidth: 1.6,
      strokeScaleEnabled: false,
      lineJoin: 'round'
    }, extra || {}));
  }

  // text stays upright on screen/sheet regardless of view rotation
  function uprightDeg() { return -(M().project.viewRotationDeg || 0); }

  function kindLabel(pts, text, color) {
    const c = G.centroid(pts);
    return new Konva.Text({
      x: c.x, y: c.y,
      text,
      fontSize: 2.2, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: '600',
      fill: color || '#555',
      listening: false,
      offsetX: text.length * 0.62, // rough centering (world units)
      offsetY: 1.1,
      letterSpacing: 0.2,
      rotation: uprightDeg()
    });
  }

  function renderSite(proj) {
    const g = V.groups.site;
    proj.features.forEach(f => {
      const style = FEATURE_STYLE[f.kind] || FEATURE_STYLE.other;
      let node;
      if (f.kind === 'tree-existing') {
        node = new Konva.Shape({
          x: f.pts[0].x, y: f.pts[0].y,
          radiusFt: f.radiusFt || 8,
          symbolStyle: 'wobble',
          seedStr: f.id,
          stroke: style.stroke, strokeWidth: 1.4, strokeScaleEnabled: false,
          dash: [6, 4],
          fill: 'rgba(255,255,255,0.05)',
          sceneFunc: LD.Symbols.plantSceneFunc
        });
        const r = f.radiusFt || 8;
        node.hitFunc(function (ctx, shape) {
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.closePath();
          ctx.fillStrokeShape(shape);
        });
        interactive(node, f, 'feature', 'site');
        if (!proj.layerState.site.locked) makeDraggable(node, f, n => {
          f.pts[0].x += n.x(); f.pts[0].y += n.y();
        });
      } else {
        node = polyNode(f.pts, f.closed !== false, style,
          f.kind === 'fence' ? { dash: [5, 3] } :
          f.kind === 'property' ? { dash: [10, 4, 2, 4], strokeWidth: 2 } : {});
        interactive(node, f, 'feature', 'site');
        if (!proj.layerState.site.locked) makeDraggable(node, f, n => {
          f.pts.forEach(p => { p.x += n.x(); p.y += n.y(); });
        });
      }
      g.add(node);
      if (f.closed !== false && f.pts.length > 2 && f.kind !== 'tree-existing') {
        g.add(kindLabel(f.pts, (f.label || style.name).toUpperCase(), style.stroke));
      }
    });
  }

  function renderHardscape(proj) {
    const g = V.groups.hardscape;
    proj.hardscape.forEach(h => {
      const pat = LD.Symbols.pattern(h.material);
      const scale = pat.worldFt / pat.canvas.width;
      const node = new Konva.Line({
        points: G.flat(h.pts), closed: true,
        fillPatternImage: pat.canvas,
        fillPatternScale: { x: scale, y: scale },
        fillPatternRepeat: 'repeat',
        stroke: '#6d675d', strokeWidth: 1.8, strokeScaleEnabled: false,
        lineJoin: 'round'
      });
      interactive(node, h, 'hardscape', 'hardscape');
      if (!proj.layerState.hardscape.locked) makeDraggable(node, h, n => {
        h.pts.forEach(p => { p.x += n.x(); p.y += n.y(); });
      });
      g.add(node);
      const mat = LD.Symbols.MATERIALS.find(m => m.id === h.material);
      g.add(kindLabel(h.pts, (h.label || (mat ? mat.name : h.material)).toUpperCase(), '#6d675d'));
    });
  }

  function renderBeds(proj) {
    const g = V.groups.beds;
    proj.beds.forEach(b => {
      const node = new Konva.Line({
        points: G.flat(b.pts), closed: true, tension: 0.4,
        fill: 'rgba(238,227,205,0.55)',
        stroke: '#7d6b4f', strokeWidth: 2.2, strokeScaleEnabled: false,
        lineJoin: 'round'
      });
      interactive(node, b, 'bed', 'beds');
      if (!proj.layerState.beds.locked) makeDraggable(node, b, n => {
        b.pts.forEach(p => { p.x += n.x(); p.y += n.y(); });
      });
      g.add(node);
      if (b.label) g.add(kindLabel(b.pts, b.label.toUpperCase(), '#7d6b4f'));
    });
  }

  function renderGroundcovers(proj) {
    const g = V.groups.beds;
    proj.groundcovers.forEach(gc => {
      const pat = LD.Symbols.pattern('groundcover');
      const scale = pat.worldFt / pat.canvas.width;
      const node = new Konva.Line({
        points: G.flat(gc.pts), closed: true,
        fillPatternImage: pat.canvas,
        fillPatternScale: { x: scale, y: scale },
        fillPatternRepeat: 'repeat',
        stroke: '#5f7d54', strokeWidth: 1.4, strokeScaleEnabled: false,
        dash: [4, 3], lineJoin: 'round'
      });
      interactive(node, gc, 'groundcover', 'beds');
      if (!proj.layerState.beds.locked) makeDraggable(node, gc, n => {
        gc.pts.forEach(p => { p.x += n.x(); p.y += n.y(); });
      });
      g.add(node);
      const plant = M().plant(gc.plantId);
      const keys = LD.Schedule.keys();
      const qty = LD.Schedule.groundcoverQty(gc);
      const label = plant ? `${keys[gc.plantId] || ''} (${qty})` : `? (${qty})`;
      g.add(kindLabel(gc.pts, label, '#3f5c38'));
    });
  }

  function renderPlants(proj) {
    const g = V.groups.planting;
    const keys = LD.Schedule.keys();
    proj.plants.forEach(pl => {
      const plant = M().plant(pl.plantId);
      const r = (pl.spreadFt || (plant ? plant.spreadFt : 6)) / 2;
      const grp = new Konva.Group({ x: pl.x, y: pl.y });
      const shape = new Konva.Shape({
        radiusFt: r,
        symbolStyle: LD.Symbols.styleFor(plant),
        seedStr: pl.id,
        stroke: '#33532c', strokeWidth: 1.6, strokeScaleEnabled: false,
        fill: 'rgba(255,255,255,0.25)',
        sceneFunc: LD.Symbols.plantSceneFunc
      });
      shape.hitFunc(function (ctx, s) {
        ctx.beginPath(); ctx.arc(0, 0, Math.max(r, 1.2), 0, Math.PI * 2); ctx.closePath();
        ctx.fillStrokeShape(s);
      });
      grp.add(shape);
      const key = keys[pl.plantId] || '?';
      const fs = Math.max(1.6, Math.min(3, r * 0.55));
      const keyText = new Konva.Text({
        text: key,
        fontSize: fs,
        fontFamily: 'Inter, system-ui, sans-serif', fontStyle: '700',
        fill: '#33532c',
        offsetX: key.length * fs * 0.28,
        offsetY: fs * 1.4,
        listening: false,
        rotation: uprightDeg()
      });
      grp.add(keyText);
      interactive(grp, pl, 'plant', 'planting');
      if (!proj.layerState.planting.locked) {
        grp.draggable(selectMode());
        grp.on('dragstart', () => M().begin());
        grp.on('dragend', () => { pl.x = grp.x(); pl.y = grp.y(); M().commit('move plant'); });
      }
      g.add(grp);
    });
  }

  function renderAnnotation(proj) {
    const g = V.groups.annotation;

    proj.labels.forEach(l => {
      const grp = new Konva.Group();
      const txt = new Konva.Text({
        x: l.x, y: l.y, text: l.text,
        fontSize: 2.4, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: '600',
        fill: '#333', letterSpacing: 0.15,
        rotation: uprightDeg()
      });
      if (l.hasLeader) {
        grp.add(new Konva.Line({
          points: [l.x, l.y + 1.2, l.anchorX, l.anchorY],
          stroke: '#777', strokeWidth: 1, strokeScaleEnabled: false
        }));
        grp.add(new Konva.Circle({ x: l.anchorX, y: l.anchorY, radius: 0.5, fill: '#777' }));
      }
      grp.add(txt);
      interactive(grp, l, 'label', 'annotation');
      if (!proj.layerState.annotation.locked) {
        grp.draggable(selectMode());
        grp.on('dragstart', () => M().begin());
        grp.on('dragend', () => { l.x += grp.x(); l.y += grp.y(); grp.position({ x: 0, y: 0 }); M().commit('move label'); });
      }
      g.add(grp);
    });

    proj.dimensions.forEach(d => {
      const a = { x: d.ax, y: d.ay }, b = { x: d.bx, y: d.by };
      const grp = new Konva.Group();
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const tick = 1.2;
      const perp = { x: Math.cos(ang + Math.PI / 2) * tick, y: Math.sin(ang + Math.PI / 2) * tick };
      grp.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: '#b04747', strokeWidth: 1.2, strokeScaleEnabled: false }));
      [a, b].forEach(p => grp.add(new Konva.Line({
        points: [p.x - perp.x, p.y - perp.y, p.x + perp.x, p.y + perp.y],
        stroke: '#b04747', strokeWidth: 1.2, strokeScaleEnabled: false
      })));
      const len = G.dist(a, b);
      const c = G.mid(a, b);
      const t = new Konva.Text({
        x: c.x, y: c.y,
        text: G.fmtFeet(len),
        fontSize: 2, fontFamily: 'Inter, system-ui, sans-serif', fontStyle: '600',
        fill: '#b04747'
      });
      let deg = ang * 180 / Math.PI;
      const total = ((deg + (M().project.viewRotationDeg || 0)) % 360 + 360) % 360;
      if (total > 90 && total < 270) deg += 180; // keep text upright on the sheet
      t.rotation(deg);
      t.offsetX(t.text().length * 0.55);
      t.offsetY(2.6);
      grp.add(t);
      interactive(grp, d, 'dimension', 'annotation');
      g.add(grp);
    });

    // north arrow (top-right of image)
    if (proj.image) {
      const wf = LD.Model.imageWidthFt();
      const na = new Konva.Group({ x: proj.northX != null ? proj.northX : wf - 12, y: proj.northY != null ? proj.northY : 12, rotation: proj.northDeg || 0 });
      na.add(new Konva.Circle({ radius: 5, stroke: '#333', strokeWidth: 1.4, strokeScaleEnabled: false, fill: 'rgba(255,255,255,0.85)' }));
      na.add(new Konva.Line({ points: [0, 3.4, 0, -3.2], stroke: '#333', strokeWidth: 1.4, strokeScaleEnabled: false }));
      na.add(new Konva.Line({ points: [-1.6, -0.8, 0, -3.2, 1.6, -0.8], closed: true, fill: '#333' }));
      na.add(new Konva.Text({ text: 'N', x: -1.05, y: -8.6, fontSize: 3, fontStyle: '700', fontFamily: 'Inter, system-ui, sans-serif', fill: '#333' }));
      na.setAttr('entityType', 'north');
      na.draggable(!proj.layerState.annotation.locked);
      na.on('dragend', () => {
        M().begin();
        proj.northX = na.x(); proj.northY = na.y();
        M().commit('move north arrow');
      });
      V.groups.annotation.add(na);
    }
  }

  // ---- selection & vertex handles ------------------------------------------
  function renderSelectionHighlight() {
    const sel = M().selection;
    if (!sel) return;
    const found = M().find(sel.id);
    if (!found) return;
    const item = found.item;
    if (found.collection === 'plants') {
      const plant = M().plant(item.plantId);
      const r = (item.spreadFt || (plant ? plant.spreadFt : 6)) / 2;
      V.groups.planting.add(new Konva.Circle({
        x: item.x, y: item.y, radius: r + 0.8,
        stroke: '#1a73e8', strokeWidth: 1.6, strokeScaleEnabled: false, dash: [6, 4],
        listening: false
      }));
    }
  }

  V.clearHandles = function () {
    // only remove handle nodes — in-progress tool previews live on the same
    // layer and must survive incidental renders
    V.handles.forEach(h => h.destroy());
    V.handles = [];
    V.uiLayer.batchDraw();
  };

  /* Vertex-edit handles for the selected polygon-ish entity.
     Circles = existing vertices (drag to move, double-click to remove).
     Squares = segment midpoints (drag to insert a new vertex there). */
  V.showHandles = function (entity, opts) {
    V.clearHandles();
    const pts = entity.pts;
    if (!pts) return;
    const s = V.zoom();
    V.uiLayer.listening(true);

    // midpoint insert handles first (under the vertex handles)
    const open = entity.closed === false;
    const segCount = open ? pts.length - 1 : pts.length;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const m = G.mid(a, b);
      const size = 7 / s;
      const h = new Konva.Rect({
        x: m.x, y: m.y,
        width: size, height: size,
        offsetX: size / 2, offsetY: size / 2,
        fill: '#fff', stroke: '#1a73e8', strokeWidth: 1.3, strokeScaleEnabled: false,
        opacity: 0.75,
        draggable: true
      });
      let inserted = null;
      h.on('dragstart', () => {
        M().begin();
        inserted = { x: h.x(), y: h.y() };
        pts.splice(i + 1, 0, inserted);
      });
      h.on('dragmove', () => {
        if (!inserted) return;
        inserted.x = h.x(); inserted.y = h.y();
        V.render({ keepHandles: true });
      });
      h.on('dragend', () => {
        M().commit('insert vertex');
        V.showHandles(entity, opts);
      });
      V.uiLayer.add(h);
      V.handles.push(h);
    }

    pts.forEach((p, i) => {
      const h = new Konva.Circle({
        x: p.x, y: p.y,
        radius: 5 / s,
        fill: '#fff', stroke: '#1a73e8', strokeWidth: 1.6, strokeScaleEnabled: false,
        draggable: true
      });
      h.on('dragstart', () => M().begin());
      h.on('dragmove', () => {
        p.x = h.x(); p.y = h.y();
        V.render({ keepHandles: true });
      });
      h.on('dragend', () => { M().commit('edit vertex'); V.showHandles(entity, opts); });
      h.on('dblclick dbltap', () => {
        if (pts.length <= 3) return;
        M().begin();
        pts.splice(i, 1);
        M().commit('delete vertex');
        V.showHandles(entity, opts);
      });
      V.uiLayer.add(h);
      V.handles.push(h);
    });
    V.uiLayer.batchDraw();
  };

  V.refreshHandles = function () {
    // keep handle size constant in screen px as zoom changes
    const s = V.zoom();
    V.handles.forEach(h => {
      if (h.getClassName() === 'Circle') h.radius(5 / s);
      else {
        h.width(7 / s); h.height(7 / s);
        h.offsetX(3.5 / s); h.offsetY(3.5 / s);
      }
    });
    V.uiLayer.batchDraw();
  };

  return V;
})();
