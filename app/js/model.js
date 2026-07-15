/* Landscape Designer — document model, undo/redo, persistence.
   Single source of truth: LD.Model.project. All geometry in FEET,
   origin at the base image's top-left corner. */
window.LD = window.LD || {};

LD.Model = (function () {
  let counter = 0;
  function id(prefix) { return `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`; }

  function blankProject() {
    return {
      version: 1,
      name: 'Untitled plan',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      units: 'ft',
      // image: dataURL kept OUT of undo snapshots (large)
      image: null, // { dataURL, widthPx, heightPx, ftPerPx, source, attribution, centerLat, centerLon, zoom, calibrated }
      northDeg: 0,             // 0 = image-up is north
      viewRotationDeg: 0,      // view/sheet rotation so the property reads square
      layerState: {            // visibility / lock per layer
        base:       { visible: true,  locked: false },
        site:       { visible: true,  locked: false },
        hardscape:  { visible: true,  locked: false },
        beds:       { visible: true,  locked: false },
        planting:   { visible: true,  locked: false },
        annotation: { visible: true,  locked: false }
      },
      customPlants: [],  // user-defined species (project-local, schema like plantsDb)
      features: [],      // { id, kind, pts:[{x,y}], closed, label, source }
      hardscape: [],     // { id, material, pts:[{x,y}], label }
      beds: [],          // { id, pts:[{x,y}] (spline anchors), label }
      plants: [],        // { id, plantId, x, y, spreadFt, label }
      groundcovers: [],  // { id, plantId, pts:[{x,y}], spacingIn }
      labels: [],        // { id, text, x, y, anchorX, anchorY, hasLeader }
      dimensions: []     // { id, ax, ay, bx, by }
    };
  }

  const M = {
    project: blankProject(),
    plantsDb: [],        // loaded from data/plants.json
    plantsById: {},
    selection: null,     // { type: 'feature'|'hardscape'|'bed'|'plant'|'groundcover'|'label'|'dimension', id }
    undoStack: [],
    redoStack: [],
    listeners: [],
    UNDO_CAP: 80
  };

  M.newId = id;

  M.onChange = function (fn) { M.listeners.push(fn); };
  function emit(kind) { M.listeners.forEach(fn => fn(kind)); }

  // ---- collections ----------------------------------------------------
  const COLLECTIONS = ['features', 'hardscape', 'beds', 'plants', 'groundcovers', 'labels', 'dimensions'];
  M.COLLECTIONS = COLLECTIONS;

  M.find = function (eid) {
    for (const c of COLLECTIONS) {
      const item = M.project[c].find(o => o.id === eid);
      if (item) return { collection: c, item };
    }
    return null;
  };

  M.removeById = function (eid) {
    for (const c of COLLECTIONS) {
      const i = M.project[c].findIndex(o => o.id === eid);
      if (i >= 0) { M.project[c].splice(i, 1); return true; }
    }
    return false;
  };

  // ---- undo/redo --------------------------------------------------------
  // Snapshots normally EXCLUDE the image payload (it's large and rarely
  // changes). Image-mutating operations (crop, expand, calibrate-after-draw)
  // call begin(true) so the image travels with the snapshot and undo can
  // restore it — otherwise geometry would shift back under a stale image.
  function snapshot(withImage) {
    const { image, ...rest } = M.project;
    return JSON.stringify(withImage ? { ...rest, image } : rest);
  }
  function restoreParsed(data) {
    const currentImage = M.project.image;
    M.project = Object.assign(blankProject(), data);
    if (!('image' in data)) M.project.image = currentImage;
  }

  let pendingSnap = null;
  // Call BEFORE mutating (captures the pre-change state)…
  M.begin = function (withImage) { pendingSnap = snapshot(!!withImage); };
  // …and commit AFTER mutating.
  M.commit = function (label) {
    if (pendingSnap === null) pendingSnap = snapshot(); // tolerate missing begin()
    M.undoStack.push(pendingSnap);
    if (M.undoStack.length > M.UNDO_CAP) M.undoStack.shift();
    M.redoStack = [];
    pendingSnap = null;
    M.project.modified = new Date().toISOString();
    emit(label || 'commit');
    scheduleAutosave();
  };
  M.cancel = function () { pendingSnap = null; };

  M.undo = function () {
    if (!M.undoStack.length) return false;
    const data = JSON.parse(M.undoStack.pop());
    const withImage = 'image' in data;
    M.redoStack.push(snapshot(withImage)); // symmetric: redo can restore forward image
    restoreParsed(data);
    M.selection = null;
    emit('undo'); scheduleAutosave();
    return true;
  };
  M.redo = function () {
    if (!M.redoStack.length) return false;
    const data = JSON.parse(M.redoStack.pop());
    const withImage = 'image' in data;
    M.undoStack.push(snapshot(withImage));
    restoreParsed(data);
    M.selection = null;
    emit('redo'); scheduleAutosave();
    return true;
  };

  // ---- scale ------------------------------------------------------------
  // Recalibration rescales ALL existing geometry so the model stays in feet.
  M.setScale = function (newFtPerPx) {
    const img = M.project.image;
    if (!img) return;
    const old = img.ftPerPx || 1;
    const k = newFtPerPx / old;
    if (Math.abs(k - 1) > 1e-9) {
      const sc = pts => pts.forEach(p => { p.x *= k; p.y *= k; });
      M.project.features.forEach(f => sc(f.pts));
      M.project.hardscape.forEach(h => sc(h.pts));
      M.project.beds.forEach(b => sc(b.pts));
      M.project.groundcovers.forEach(g => sc(g.pts));
      M.project.plants.forEach(p => { p.x *= k; p.y *= k; });
      M.project.labels.forEach(l => { l.x *= k; l.y *= k; l.anchorX *= k; l.anchorY *= k; });
      M.project.dimensions.forEach(d => { d.ax *= k; d.ay *= k; d.bx *= k; d.by *= k; });
    }
    img.ftPerPx = newFtPerPx;
    img.calibrated = true;
  };

  // Shift every piece of geometry (used when the base image grows and its
  // origin moves — e.g., "Expand map" adds a tile ring on all sides).
  M.translateAll = function (dxFt, dyFt) {
    const mv = pts => pts.forEach(p => { p.x += dxFt; p.y += dyFt; });
    M.project.features.forEach(f => mv(f.pts));
    M.project.hardscape.forEach(h => mv(h.pts));
    M.project.beds.forEach(b => mv(b.pts));
    M.project.groundcovers.forEach(g => mv(g.pts));
    M.project.plants.forEach(p => { p.x += dxFt; p.y += dyFt; });
    M.project.labels.forEach(l => { l.x += dxFt; l.y += dyFt; l.anchorX += dxFt; l.anchorY += dyFt; });
    M.project.dimensions.forEach(d => { d.ax += dxFt; d.ay += dyFt; d.bx += dxFt; d.by += dyFt; });
    if (M.project.northX != null) { M.project.northX += dxFt; M.project.northY += dyFt; }
  };

  M.imageWidthFt = function ()  { const i = M.project.image; return i ? i.widthPx  * i.ftPerPx : 0; };
  M.imageHeightFt = function () { const i = M.project.image; return i ? i.heightPx * i.ftPerPx : 0; };

  // ---- plant db ---------------------------------------------------------
  M.setPlantsDb = function (arr) {
    M.plantsDb = arr;
    M.plantsById = {};
    arr.forEach(p => { M.plantsById[p.id] = p; });
  };
  M.plant = function (pid) {
    return M.plantsById[pid] ||
      (M.project.customPlants || []).find(p => p.id === pid) || null;
  };

  // ---- persistence -------------------------------------------------------
  // IndexedDB for autosave (image dataURLs exceed localStorage quotas).
  const DB_NAME = 'landscape-designer', STORE = 'projects';
  function withStore(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(STORE, mode);
        const st = tx.objectStore(STORE);
        const req = fn(st);
        tx.oncomplete = () => { open.result.close(); resolve(req && req.result); };
        tx.onerror = () => { open.result.close(); reject(tx.error); };
      };
    });
  }

  let autosaveTimer = null;
  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      withStore('readwrite', st => st.put(JSON.parse(JSON.stringify(M.project)), 'autosave'))
        .catch(e => console.warn('autosave failed', e));
    }, 800);
  }
  M.autosaveNow = scheduleAutosave;

  M.loadAutosave = function () {
    return withStore('readonly', st => st.get('autosave'));
  };
  M.clearAutosave = function () {
    return withStore('readwrite', st => st.delete('autosave'));
  };

  M.toJSONFile = function () {
    return JSON.stringify(M.project, null, 1);
  };
  M.loadProject = function (obj) {
    M.project = Object.assign(blankProject(), obj);
    M.undoStack = []; M.redoStack = []; M.selection = null;
    emit('load'); scheduleAutosave();
  };
  M.reset = function () {
    M.project = blankProject();
    M.undoStack = []; M.redoStack = []; M.selection = null;
    emit('load');
  };

  M.select = function (sel) { M.selection = sel; emit('selection'); };

  return M;
})();
