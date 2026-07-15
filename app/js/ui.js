/* Landscape Designer — UI shell: toolbar, palette, layers, schedule panel,
   props panel, start screen, dialogs, status bar. Plain DOM, no framework. */
window.LD = window.LD || {};

LD.UI = (function () {
  const M = () => LD.Model;
  const V = () => LD.View;
  const T = () => LD.Tools;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  const TOOLS = [
    { id: 'select',    key: 'V', icon: '⬚', name: 'Select / edit' },
    { id: 'pan',       key: 'H', icon: '✋', name: 'Pan' },
    { id: 'calibrate', key: 'C', icon: '📏', name: 'Calibrate scale' },
    { id: 'trace',     key: 'T', icon: '⬠', name: 'Trace site feature' },
    { id: 'wand',      key: 'W', icon: '🪄', name: 'Magic wand (auto-select region)' },
    { id: 'ai',        key: 'A', icon: '✨', name: 'AI detect (Segment Anything — click a building, driveway, lawn…)' },
    { id: 'tree',      key: 'E', icon: '◍', name: 'Existing tree' },
    { id: 'bed',       key: 'B', icon: '◠', name: 'Planting bed (freehand)' },
    { id: 'hardscape', key: 'S', icon: '▦', name: 'Hardscape (patio, path)' },
    { id: 'plant',     key: 'P', icon: '❀', name: 'Place plant' },
    { id: 'groundcover', key: 'G', icon: '﹅', name: 'Groundcover area' },
    { id: 'label',     key: 'L', icon: 'A', name: 'Label' },
    { id: 'dimension', key: 'D', icon: '↔', name: 'Dimension' }
  ];

  const LAYERS = [
    { id: 'base',       name: 'Base image' },
    { id: 'site',       name: 'Site (existing)' },
    { id: 'hardscape',  name: 'Hardscape' },
    { id: 'beds',       name: 'Beds & groundcover' },
    { id: 'planting',   name: 'Planting' },
    { id: 'annotation', name: 'Annotation' }
  ];

  const UI = {};
  let paletteCategory = 'all';
  let paletteSearch = '';
  // region/zone preferences persist across projects (per browser)
  const REGIONS = [
    ['', 'All regions'],
    ['northeast', 'Northeast (VT, NY, New England…)'],
    ['southeast', 'Southeast (TN, KY, Carolinas…)'],
    ['midwest', 'Midwest'],
    ['great-plains', 'Great Plains'],
    ['southwest', 'Southwest'],
    ['mountain-west', 'Mountain West'],
    ['pacific-northwest', 'Pacific Northwest'],
    ['california', 'California']
  ];
  let prefRegion = localStorage.getItem('ld.region') || '';
  let prefZone = parseInt(localStorage.getItem('ld.zone') || '', 10) || null;
  let nativeOnly = localStorage.getItem('ld.nativeOnly') === '1';
  let edibleOnly = localStorage.getItem('ld.edibleOnly') === '1';

  // ------------------------------------------------------------- bootstrap
  UI.init = function () {
    buildToolbar();
    buildTabs();
    buildToolOptions();
    wireHeader();
    wireStartScreen();
    wireDropAndPaste();
    UI.refresh();
  };

  function buildToolbar() {
    const bar = $('#toolbar');
    TOOLS.forEach(t => {
      const b = document.createElement('button');
      b.className = 'tool-btn';
      b.dataset.tool = t.id;
      b.title = `${t.name} (${t.key})`;
      b.innerHTML = `<span class="tool-icon">${t.icon}</span>`;
      b.onclick = () => { T().set(t.id); UI.refresh(); };
      bar.appendChild(b);
    });
    T().onToolChanged = () => { UI.refresh(); buildToolOptions(); };
  }

  // ---------------------------------------------------------- tool options
  function buildToolOptions() {
    const el = $('#tool-options');
    const cur = T().current;
    let html = '';
    if (cur === 'trace' || cur === 'wand' || cur === 'ai') {
      const kinds = V().FEATURE_KINDS.filter(k => k !== 'tree-existing');
      const sel = cur === 'trace' ? T().traceKind : T().wandKind;
      html += `<label>Feature</label><select id="opt-kind">` +
        kinds.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${V().FEATURE_STYLE[k].name}</option>`).join('') +
        `</select>`;
      if (cur === 'wand') {
        html += `<label>Tolerance <span id="opt-thr-val">${T().wandThreshold}</span></label>
                 <input type="range" id="opt-threshold" min="5" max="60" value="${T().wandThreshold}">`;
      }
      if (cur === 'trace') {
        html += `<div class="hint">Click to add points · Enter or double-click to finish · Shift = angle snap · Esc cancels</div>`;
      } else if (cur === 'wand') {
        html += `<div class="hint">Click a region (lawn, pavement, roof) to auto-trace it by color</div>`;
      } else {
        html += `<div class="hint">Click anything — Segment Anything traces its outline. First use downloads the model (~30 MB); runs entirely in your browser.</div>
                 <div class="hint" id="sam-status" style="color:#7b3fbf;font-weight:600"></div>`;
      }
      html += `<label class="chk"><input type="checkbox" id="opt-ortho" ${T().orthoAssist ? 'checked' : ''}> Square up buildings</label>`;
    } else if (cur === 'hardscape') {
      html += `<label>Material</label><select id="opt-material">` +
        LD.Symbols.MATERIALS.map(m => `<option value="${m.id}" ${m.id === T().material ? 'selected' : ''}>${m.name}</option>`).join('') +
        `</select><div class="hint">Click to add points · Enter/double-click to finish</div>`;
    } else if (cur === 'tree') {
      html += `<label>Canopy spread (ft)</label>
               <input type="number" id="opt-tree-r" min="4" max="80" value="${T().treeRadiusFt * 2}">
               <div class="hint">Click to place an existing tree at its canopy size</div>`;
    } else if (cur === 'plant' || cur === 'groundcover') {
      html += `<div class="hint">${cur === 'plant' ? 'Pick a species below, then click the plan to place. Symbols draw at mature spread.' : 'Pick a groundcover below, then draw the area (click points, Enter to finish).'}</div>`;
    } else if (cur === 'calibrate') {
      html += `<div class="hint">Click two ends of something you know the length of (driveway width, house wall), then enter the real distance.</div>`;
    } else if (cur === 'bed') {
      html += `<div class="hint">Draw the bed outline freehand — it smooths automatically.</div>`;
    } else if (cur === 'select') {
      html += `<div class="hint">Click to select · drag to move · circle handles reshape, square handles add points · double-click a vertex to remove it · Delete key removes the object</div>`;
    }
    html += `<div class="hint" style="margin-top:8px;border-top:1px solid var(--line);padding-top:6px">Ctrl+drag or middle-drag pans in any tool · right-click selects any object (then Delete removes, Type re-classifies)</div>`;
    el.innerHTML = html;

    const kindSel = $('#opt-kind');
    if (kindSel) kindSel.onchange = () => { if (cur === 'trace') T().traceKind = kindSel.value; else T().wandKind = kindSel.value; }; // wand & ai share wandKind
    const thr = $('#opt-threshold');
    if (thr) thr.oninput = () => { T().wandThreshold = +thr.value; $('#opt-thr-val').textContent = thr.value; };
    const mat = $('#opt-material');
    if (mat) mat.onchange = () => { T().material = mat.value; };
    const treeR = $('#opt-tree-r');
    if (treeR) treeR.onchange = () => { T().treeRadiusFt = Math.max(2, +treeR.value / 2); };
    const ortho = $('#opt-ortho');
    if (ortho) ortho.onchange = () => { T().orthoAssist = ortho.checked; };

    // palette shows for plant tools
    $('#palette-wrap').style.display = (cur === 'plant' || cur === 'groundcover') ? 'block' : 'none';
    if (cur === 'plant' || cur === 'groundcover') renderPalette();
  }

  // ---------------------------------------------------------------- palette
  const CATS = [
    ['all', 'All'], ['canopy', 'Canopy'], ['ornamental', 'Ornamental'],
    ['evergreen-tree', 'Evergreen'], ['shrub-deciduous', 'Shrub (dec.)'],
    ['shrub-evergreen', 'Shrub (ev.)'], ['perennial', 'Perennial'],
    ['grass', 'Grass'], ['groundcover', 'Groundcover']
  ];

  function symbolThumb(plant) {
    const c = document.createElement('canvas');
    c.width = 40; c.height = 40;
    const g = c.getContext('2d');
    g.strokeStyle = '#33532c'; g.fillStyle = 'rgba(80,120,70,0.12)'; g.lineWidth = 1.4;
    g.save(); g.translate(20, 20);
    LD.Symbols.drawOutline(g, 15, LD.Symbols.styleFor(plant), LD.geom.hashSeed(plant.id));
    g.fill(); g.stroke();
    g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fillStyle = '#33532c'; g.fill();
    g.restore();
    return c;
  }

  function plantThumb(p) {
    // photo when available; parametric symbol as fallback
    if (p.image) {
      const holder = document.createElement('div');
      holder.className = 'thumb-holder';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = p.image;
      img.alt = p.common;
      img.onerror = () => { holder.innerHTML = ''; holder.appendChild(symbolThumb(p)); };
      holder.appendChild(img);
      return holder;
    }
    return symbolThumb(p);
  }

  function nativeHere(p) {
    if (!prefRegion) return p.native || (p.nativeRegions && p.nativeRegions.length > 0);
    return (p.nativeRegions || []).includes(prefRegion);
  }

  function renderPalette() {
    const wrap = $('#palette');
    const forGc = T().current === 'groundcover';
    const all = [...M().plantsDb, ...(M().project.customPlants || [])];
    let list = all.filter(p => forGc ? p.category === 'groundcover' : true);
    if (!forGc && paletteCategory !== 'all') list = list.filter(p => p.category === paletteCategory);
    if (nativeOnly) list = list.filter(nativeHere);
    if (edibleOnly) list = list.filter(p => p.edible);
    if (prefZone) list = list.filter(p => !p.zones || (p.zones[0] <= prefZone && prefZone <= p.zones[1]));
    if (paletteSearch) {
      const q = paletteSearch.toLowerCase();
      list = list.filter(p => p.common.toLowerCase().includes(q) || (p.botanical || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => a.common.localeCompare(b.common));

    // region / zone / native filter row
    $('#palette-filters').innerHTML =
      `<select id="pal-region" title="Your region — used for the Native filter">` +
        REGIONS.map(([id, name]) => `<option value="${id}" ${prefRegion === id ? 'selected' : ''}>${name}</option>`).join('') +
      `</select>
       <input id="pal-zone" type="number" min="1" max="13" placeholder="zone" value="${prefZone || ''}" title="USDA hardiness zone (e.g., 7 for Nashville, 4 for much of Vermont) — hides plants not hardy there">
       <button class="chip ${nativeOnly ? 'on' : ''}" id="pal-native" title="Show only plants native to your region">Native</button>
       <button class="chip ${edibleOnly ? 'on' : ''}" id="pal-edible" title="Fruit trees, berries, and other food plants">Edible</button>
       <button class="chip" id="pal-custom" title="Add a plant that isn't in the database">+ Custom</button>`;
    $('#pal-region').onchange = e => { prefRegion = e.target.value; localStorage.setItem('ld.region', prefRegion); renderPalette(); };
    $('#pal-zone').onchange = e => {
      prefZone = parseInt(e.target.value, 10) || null;
      localStorage.setItem('ld.zone', prefZone || '');
      renderPalette();
    };
    $('#pal-native').onclick = () => { nativeOnly = !nativeOnly; localStorage.setItem('ld.nativeOnly', nativeOnly ? '1' : '0'); renderPalette(); };
    $('#pal-edible').onclick = () => { edibleOnly = !edibleOnly; localStorage.setItem('ld.edibleOnly', edibleOnly ? '1' : '0'); renderPalette(); };
    $('#pal-custom').onclick = promptCustomPlant;

    // category chips
    $('#palette-cats').innerHTML = forGc ? '' : CATS.map(([id, name]) =>
      `<button class="chip ${paletteCategory === id ? 'on' : ''}" data-cat="${id}">${name}</button>`).join('');
    $$('#palette-cats .chip').forEach(b => { b.onclick = () => { paletteCategory = b.dataset.cat; renderPalette(); }; });

    wrap.innerHTML = '';
    list.forEach(p => {
      const d = document.createElement('div');
      d.className = 'plant-card' + (T().currentPlantId === p.id ? ' on' : '');
      d.appendChild(plantThumb(p));
      const info = document.createElement('div');
      info.className = 'plant-info';
      const badge = nativeHere(p) && (prefRegion || p.native)
        ? `<span class="native-badge">native</span>` : '';
      const photoLink = p.imagePage ? ` <a href="${p.imagePage}" target="_blank" rel="noopener" class="photo-link" title="Photo & info (Wikipedia)">ⓘ</a>` : '';
      info.innerHTML = `<div class="pc">${p.common} ${badge}${p.custom ? '<span class="native-badge" style="background:#8a857c">custom</span>' : ''}</div>
        <div class="pb">${p.botanical || ''}${photoLink}</div>
        <div class="pm">${p.spreadFt}′ spread · ${p.heightFt}′ tall · ${p.sun}${p.zones ? ` · z${p.zones[0]}–${p.zones[1]}` : ''}</div>`;
      d.appendChild(info);
      d.onclick = e => {
        if (e.target.classList.contains('photo-link')) return; // let the link work
        T().currentPlantId = p.id; renderPalette();
      };
      wrap.appendChild(d);
    });
    if (!list.length) wrap.innerHTML = '<div class="hint" style="padding:8px">No matches — loosen the native/zone filters, or add it with + Custom.</div>';
    $('#palette-count').textContent = `${list.length} of ${all.length}`;
  }

  function promptCustomPlant() {
    const dlg = $('#dlg-plant');
    dlg.showModal();
    $('#cp-ok').onclick = () => {
      const common = $('#cp-common').value.trim();
      const spread = parseFloat($('#cp-spread').value);
      const height = parseFloat($('#cp-height').value) || spread;
      if (!common || !spread || spread <= 0) { UI.toast('Name and mature spread are required.'); return; }
      dlg.close();
      const p = {
        id: 'custom-' + M().newId('cp'),
        common,
        botanical: $('#cp-botanical').value.trim(),
        category: $('#cp-category').value,
        form: $('#cp-evergreen').checked ? 'evergreen' : 'deciduous',
        spreadFt: spread, spreadRangeFt: [spread, spread], heightFt: height,
        sun: 'any', water: 'medium', zones: null, spacingInches: null,
        native: false, nativeRegions: [], bloom: null,
        notes: 'user-added', src: null, image: null, imagePage: null,
        custom: true
      };
      M().begin();
      M().project.customPlants.push(p);
      M().commit('add custom plant');
      T().currentPlantId = p.id;
      ['#cp-common', '#cp-botanical', '#cp-spread', '#cp-height'].forEach(s => { $(s).value = ''; });
      renderPalette();
      UI.toast(`${common} added — click the plan to place it.`);
    };
    $('#cp-cancel').onclick = () => dlg.close();
  }

  // ------------------------------------------------------------------ tabs
  function buildTabs() {
    $$('#side-tabs button').forEach(b => {
      b.onclick = () => {
        $$('#side-tabs button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        $$('.side-pane').forEach(p => p.style.display = 'none');
        $('#pane-' + b.dataset.pane).style.display = 'block';
        UI.refresh();
      };
    });
    $('#palette-search').oninput = e => { paletteSearch = e.target.value; renderPalette(); };
  }

  function renderLayers() {
    const el = $('#pane-layers');
    const st = M().project.layerState;
    el.innerHTML = LAYERS.map(l => {
      const s = st[l.id] || { visible: true, locked: false };
      return `<div class="layer-row">
        <button class="mini ${s.visible ? 'on' : ''}" data-act="vis" data-layer="${l.id}" title="Show/hide">${s.visible ? '👁' : '–'}</button>
        <button class="mini ${s.locked ? 'on' : ''}" data-act="lock" data-layer="${l.id}" title="Lock">${s.locked ? '🔒' : '🔓'}</button>
        <span>${l.name}</span>
      </div>`;
    }).join('') +
    `<div class="layer-row"><button class="mini ${st.base.dim ? 'on' : ''}" data-act="dim" data-layer="base">◐</button>
     <button class="mini ${st.base.grid ? 'on' : ''}" data-act="grid" data-layer="base">#</button>
     <span>Dim image / 10-ft grid</span></div>`;
    $$('#pane-layers .mini').forEach(b => {
      b.onclick = () => {
        const s = M().project.layerState[b.dataset.layer];
        if (b.dataset.act === 'vis') s.visible = !s.visible;
        if (b.dataset.act === 'lock') s.locked = !s.locked;
        if (b.dataset.act === 'dim') s.dim = !s.dim;
        if (b.dataset.act === 'grid') s.grid = !s.grid;
        M().autosaveNow();
        V().render(); renderLayers();
      };
    });
  }

  function renderSchedule() {
    const rows = LD.Schedule.rows();
    const el = $('#pane-schedule');
    if (!rows.length) { el.innerHTML = '<div class="hint" style="padding:10px">Place plants to build the schedule.</div>'; return; }
    el.innerHTML = `<table class="sched"><thead><tr>
      <th>KEY</th><th>QTY</th><th>PLANT</th><th>SPREAD</th><th>SPACING</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td class="k">${r.key}</td><td>${r.qty}</td>
        <td><div class="pc">${r.common}</div><div class="pb">${r.botanical}</div></td>
        <td>${r.spreadFt != null ? r.spreadFt + '′' : '—'}</td><td>${r.spacing}</td></tr>`).join('') +
      `</tbody></table>
      <button class="btn" id="csv-btn" style="margin:10px">Download CSV</button>`;
    $('#csv-btn').onclick = () => LD.Exporter.exportCSV();
  }

  // ---------------------------------------------------------------- props
  function renderProps() {
    const el = $('#pane-props');
    const sel = M().selection;
    if (!sel) { el.innerHTML = '<div class="hint" style="padding:10px">Select an object to edit its properties.</div>'; return; }
    const found = M().find(sel.id);
    if (!found) { el.innerHTML = ''; return; }
    const { collection, item } = found;
    let html = `<div class="props">`;
    if (collection === 'features') {
      html += `<label>Type</label><select id="pr-kind">` +
        V().FEATURE_KINDS.map(k => `<option value="${k}" ${item.kind === k ? 'selected' : ''}>${V().FEATURE_STYLE[k].name}</option>`).join('') + `</select>`;
      html += `<label>Label</label><input id="pr-label" value="${item.label || ''}" placeholder="(default)">`;
      if (item.kind === 'tree-existing') {
        html += `<label>Canopy spread (ft)</label><input type="number" id="pr-radius" value="${(item.radiusFt || 8) * 2}">`;
      } else if (item.pts && item.closed !== false) {
        html += `<div class="stat">Area: ${LD.geom.fmtArea(LD.geom.polygonArea(item.pts))}</div>`;
        html += `<button class="btn" id="pr-ortho">Square up corners</button>`;
      }
    } else if (collection === 'hardscape') {
      html += `<label>Material</label><select id="pr-material">` +
        LD.Symbols.MATERIALS.map(m => `<option value="${m.id}" ${m.id === item.material ? 'selected' : ''}>${m.name}</option>`).join('') + `</select>`;
      html += `<label>Label</label><input id="pr-label" value="${item.label || ''}" placeholder="(material name)">`;
      html += `<div class="stat">Area: ${LD.geom.fmtArea(LD.geom.polygonArea(item.pts))}</div>`;
    } else if (collection === 'beds') {
      html += `<label>Label</label><input id="pr-label" value="${item.label || ''}">`;
      html += `<div class="stat">Area: ${LD.geom.fmtArea(LD.geom.polygonArea(item.pts))}</div>`;
    } else if (collection === 'plants') {
      const p = M().plant(item.plantId);
      html += `<div class="pc" style="font-size:14px">${p ? p.common : item.plantId}</div>
               <div class="pb">${p ? p.botanical : ''}</div>`;
      html += `<label>Drawn spread (ft) — mature: ${p ? p.spreadFt : '?'}′</label>
               <input type="number" id="pr-spread" value="${item.spreadFt}" min="0.5" step="0.5">`;
      if (p) html += `<div class="stat">${p.sun} sun · ${p.water} water · zones ${p.zones[0]}–${p.zones[1]}${p.native ? ' · native' : ''}<br>${p.notes || ''}</div>`;
    } else if (collection === 'groundcovers') {
      const p = M().plant(item.plantId);
      html += `<div class="pc" style="font-size:14px">${p ? p.common : ''} (area fill)</div>`;
      html += `<label>Spacing (in, o.c.)</label><input type="number" id="pr-spacing" value="${item.spacingIn}" min="3">`;
      html += `<div class="stat">Area: ${LD.geom.fmtArea(LD.geom.polygonArea(item.pts))} · ≈${LD.Schedule.groundcoverQty(item)} plants</div>`;
    } else if (collection === 'labels') {
      html += `<label>Text</label><input id="pr-text" value="${item.text}">`;
      html += `<label class="chk"><input type="checkbox" id="pr-leader" ${item.hasLeader ? 'checked' : ''}> Leader line</label>`;
    }
    html += `<button class="btn danger" id="pr-delete">Delete</button></div>`;
    el.innerHTML = html;

    const commit = fn => { M().begin(); fn(); M().commit('edit'); V().render(); UI.refresh(); };
    const bind = (id, fn) => { const n = $(id); if (n) n.onchange = () => commit(() => fn(n)); };
    bind('#pr-kind', n => { item.kind = n.value; item.closed = n.value !== 'fence' && n.value !== 'property'; });
    bind('#pr-label', n => { item.label = n.value || null; });
    bind('#pr-radius', n => { item.radiusFt = Math.max(1, +n.value / 2); });
    bind('#pr-material', n => { item.material = n.value; });
    bind('#pr-spread', n => { item.spreadFt = Math.max(0.5, +n.value); });
    bind('#pr-spacing', n => { item.spacingIn = Math.max(3, +n.value); });
    bind('#pr-text', n => { item.text = n.value; });
    bind('#pr-leader', n => { item.hasLeader = n.checked; });
    const ortho = $('#pr-ortho');
    if (ortho) ortho.onclick = () => commit(() => { item.pts = LD.geom.orthogonalize(item.pts); });
    $('#pr-delete').onclick = () => {
      M().begin(); M().removeById(item.id); M().select(null); M().commit('delete');
      V().clearHandles(); V().render(); UI.refresh();
    };
  }

  UI.editEntity = function (type, entity) {
    // double-click → focus props pane
    $$('#side-tabs button').forEach(x => x.classList.remove('on'));
    $('#side-tabs button[data-pane="props"]').classList.add('on');
    $$('.side-pane').forEach(p => p.style.display = 'none');
    $('#pane-props').style.display = 'block';
    renderProps();
  };

  // ---------------------------------------------------------------- header
  function wireHeader() {
    $('#project-name').onchange = e => { M().project.name = e.target.value; M().autosaveNow(); };
    $('#btn-undo').onclick = () => { M().undo(); V().render(); UI.refresh(); };
    $('#btn-redo').onclick = () => { M().redo(); V().render(); UI.refresh(); };
    $('#btn-fit').onclick = () => V().zoomToFit();
    $('#view-rot').onchange = e => {
      let d = parseFloat(e.target.value);
      if (isNaN(d)) d = 0;
      V().setRotation(d);
      UI.refresh();
    };
    $('#btn-align').onclick = () => T().startAlign();
    $('#btn-rot-reset').onclick = () => { V().setRotation(0); UI.refresh(); };
    $('#btn-new').onclick = () => {
      if (confirm('Start a new plan? Current work is autosaved and can be exported first.')) {
        M().reset(); showStart(true); UI.refresh();
      }
    };
    $('#btn-save').onclick = () => LD.Exporter.exportJSON();
    $('#btn-open').onclick = () => $('#file-open').click();
    $('#file-open').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then(txt => {
        try {
          M().loadProject(JSON.parse(txt));
          showStart(false);
          V().render(); V().zoomToFit(); UI.refresh();
        } catch (err) { UI.toast('Could not read that project file.'); }
      });
      e.target.value = '';
    };
    $('#btn-png').onclick = () => LD.Exporter.exportPNG();
    $('#btn-pdf').onclick = () => openExportDialog();
    $('#btn-help').onclick = () => UI.showWelcome(true);
    $('#welcome-ok').onclick = () => $('#dlg-welcome').close();
    $('#btn-footprints').onclick = fetchFootprintsFlow;
    $('#btn-expand').onclick = expandMapFlow;
    $('#btn-crop').onclick = () => T().startCrop();
  }

  async function expandMapFlow() {
    const img = M().project.image;
    if (!img || !img.originGlobalPx) { UI.toast('Expanding needs an address-fetched map.'); return; }
    UI.toast('Expanding map — fetching surrounding imagery…');
    try {
      const nm = await LD.Imagery.expandImagery(img, (d, t) => {
        $('#toast').textContent = `Expanding map… ${d}/${t} tiles`;
      });
      M().begin(true); // image travels with the undo snapshot
      const dxFt = (img.originGlobalPx.x - nm.originGlobalPx.x) * img.ftPerPx;
      const dyFt = (img.originGlobalPx.y - nm.originGlobalPx.y) * img.ftPerPx;
      M().translateAll(dxFt, dyFt);
      Object.assign(img, {
        dataURL: nm.dataURL, widthPx: nm.widthPx, heightPx: nm.heightPx,
        originGlobalPx: nm.originGlobalPx, bbox: nm.bbox
      });
      M().commit('expand map');
      LD.Tools.invalidateWand();
      V().render(); V().zoomToFit(); UI.refresh();
      const sideFt = Math.round(LD.Model.imageWidthFt());
      UI.toast(`Map expanded — now ≈${sideFt}′ × ${sideFt}′. Click again for more; drawings stayed put.`, 5000);
    } catch (err) {
      UI.toast(err.message || 'Expand failed.', 5000);
    }
  }

  function openExportDialog() {
    const dlg = $('#dlg-export');
    const paperSel = $('#exp-paper'), scaleSel = $('#exp-scale');
    paperSel.innerHTML = Object.entries(LD.Exporter.PAPERS).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');
    const refresh = () => {
      const fit = LD.Exporter.fitScale(paperSel.value);
      scaleSel.innerHTML = LD.Exporter.SCALES.map(s =>
        `<option value="${s}" ${s === fit ? 'selected' : ''}>1″ = ${s}′ ${LD.Exporter.fits(paperSel.value, s) ? '' : '(won\'t fit)'}</option>`).join('');
    };
    paperSel.onchange = refresh;
    refresh();
    dlg.showModal();
    $('#exp-go').onclick = () => {
      dlg.close();
      LD.Exporter.exportPDF({ paper: paperSel.value, scale: +scaleSel.value });
    };
    $('#exp-cancel').onclick = () => dlg.close();
  }

  // ------------------------------------------------------------ start flow
  function showStart(show) {
    $('#start-screen').style.display = show ? 'flex' : 'none';
  }
  UI.showStart = showStart;

  function wireStartScreen() {
    $('#addr-go').onclick = doAddressSearch;
    $('#addr-input').addEventListener('keydown', e => { if (e.key === 'Enter') doAddressSearch(); });
    $('#start-drop').onclick = () => $('#file-image').click();
    $('#file-image').onchange = e => {
      const f = e.target.files[0];
      if (f) loadDroppedImage(f);
      e.target.value = '';
    };
    $('#start-open').onclick = () => $('#file-open').click();
  }

  async function doAddressSearch() {
    const q = $('#addr-input').value.trim();
    if (!q) return;
    const status = $('#addr-status');
    status.textContent = 'Searching…';
    try {
      const results = await LD.Imagery.geocode(q);
      if (!results.length) { status.textContent = 'No matches — try adding city/state.'; return; }
      status.innerHTML = '';
      results.forEach(r => {
        const b = document.createElement('button');
        b.className = 'addr-result';
        b.textContent = r.label;
        b.onclick = () => fetchImageryFlow(r);
        status.appendChild(b);
      });
    } catch (err) {
      status.textContent = 'Search failed — check your connection. You can drop a screenshot instead.';
    }
  }

  async function fetchImageryFlow(r) {
    const status = $('#addr-status');
    status.textContent = 'Fetching imagery…';
    try {
      const img = await LD.Imagery.fetchImagery(r.lat, r.lon, (d, t) => {
        status.textContent = `Fetching imagery… ${d}/${t} tiles`;
      });
      M().begin();
      M().project.image = {
        dataURL: img.dataURL, widthPx: img.widthPx, heightPx: img.heightPx,
        ftPerPx: img.ftPerPx, calibrated: true,
        source: 'esri', attribution: img.attribution,
        centerLat: img.centerLat, centerLon: img.centerLon, zoom: img.zoom,
        originGlobalPx: img.originGlobalPx, bbox: img.bbox
      };
      if (!$('#project-name').value || $('#project-name').value === 'Untitled plan') {
        M().project.name = r.label.split(',').slice(0, 2).join(',');
        $('#project-name').value = M().project.name;
      }
      M().commit('imagery');
      T().invalidateWand();
      showStart(false);
      V().render(); V().zoomToFit(); UI.refresh();
      UI.toast(`Imagery at zoom ${img.zoom} — scale is set automatically (${img.ftPerPx.toFixed(3)} ft/px). Try “Fetch building footprints”.`, 6000);
    } catch (err) {
      console.warn(err);
      status.textContent = 'Imagery fetch failed at this location. Drop a screenshot instead.';
    }
  }

  async function fetchFootprintsFlow() {
    const img = M().project.image;
    if (!img || !img.bbox) { UI.toast('Footprints need an address-fetched base image.'); return; }
    UI.toast('Fetching OSM building footprints…');
    try {
      const fps = await LD.Imagery.fetchFootprints(img);
      if (!fps.length) { UI.toast('No mapped buildings here — trace or wand them instead.'); return; }
      M().begin();
      fps.forEach(fp => {
        M().project.features.push({
          id: M().newId('f'), kind: 'building', pts: fp.pts, closed: true,
          label: null, source: 'osm'
        });
      });
      M().commit('osm footprints');
      V().render(); UI.refresh();
      UI.toast(`Added ${fps.length} building footprint${fps.length > 1 ? 's' : ''} from OpenStreetMap — verify against the photo and adjust.`, 6000);
    } catch (err) {
      UI.toast('Overpass query failed — you can trace buildings manually.');
    }
  }

  // ------------------------------------------------------- drop, paste, dnd
  function loadDroppedImage(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const el = new Image();
      el.onload = () => {
        M().begin();
        M().project.image = {
          dataURL: reader.result, widthPx: el.naturalWidth, heightPx: el.naturalHeight,
          ftPerPx: 0.15,          // provisional — forces calibration
          calibrated: false,
          source: 'upload', attribution: null
        };
        M().commit('image');
        T().invalidateWand();
        showStart(false);
        V().render(); V().zoomToFit(); UI.refresh();
        T().set('calibrate');
        UI.toast('Now calibrate: click two ends of a known dimension (e.g., driveway width) and enter its length.', 8000);
      };
      el.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function wireDropAndPaste() {
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
      e.preventDefault();
      const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
      const j = [...e.dataTransfer.files].find(f => f.name.endsWith('.json'));
      if (f) loadDroppedImage(f);
      else if (j) j.text().then(t => { M().loadProject(JSON.parse(t)); showStart(false); V().render(); V().zoomToFit(); UI.refresh(); });
    });
    window.addEventListener('paste', e => {
      const item = [...(e.clipboardData || {}).items || []].find(i => i.type.startsWith('image/'));
      if (item) loadDroppedImage(item.getAsFile());
    });
  }

  // ---------------------------------------------------------------- dialogs
  UI.promptDistance = function (px) {
    return new Promise(resolve => {
      const dlg = $('#dlg-distance');
      $('#dist-px').textContent = Math.round(px);
      const input = $('#dist-input');
      input.value = '';
      dlg.showModal();
      setTimeout(() => input.focus(), 50);
      $('#dist-ok').onclick = () => { dlg.close(); resolve(parseFloat(input.value)); };
      $('#dist-cancel').onclick = () => { dlg.close(); resolve(null); };
    });
  };

  UI.promptText = function (label) {
    return new Promise(resolve => {
      const dlg = $('#dlg-text');
      $('#text-label').textContent = label;
      const input = $('#text-input');
      input.value = '';
      dlg.showModal();
      setTimeout(() => input.focus(), 50);
      $('#text-ok').onclick = () => { dlg.close(); resolve(input.value.trim()); };
      $('#text-cancel').onclick = () => { dlg.close(); resolve(null); };
    });
  };

  // ------------------------------------------------------------ status bar
  UI.updateStatus = function (w) {
    const img = M().project.image;
    let s = '';
    if (w) s += `x ${w.x.toFixed(1)}′  y ${w.y.toFixed(1)}′`;
    if (img && !img.calibrated) s += '   ·   ⚠ NOT CALIBRATED — scale unknown';
    $('#status-coords').textContent = s;
    // dynamic scale bar: pick a nice round length ≈120px
    const z = V().zoom();
    const targetFt = 120 / z;
    const nice = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(n => n >= targetFt) || 500;
    $('#scalebar-label').textContent = `${nice}′`;
    $('#scalebar-bar').style.width = `${nice * z}px`;
  };

  /* Welcome/orientation dialog: auto-shows on the first two visits, then only
     via the ? button. `force` = user asked for it. */
  UI.showWelcome = function (force) {
    if (!force) {
      const visits = parseInt(localStorage.getItem('ld.visits') || '0', 10) + 1;
      localStorage.setItem('ld.visits', String(visits));
      if (visits > 2) return;
    }
    $('#dlg-welcome').showModal();
  };

  UI.samStatus = function (msg) {
    const el = $('#sam-status');
    if (el) el.textContent = msg || '';
  };

  UI.toast = function (msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), ms || 3500);
  };

  // ---------------------------------------------------------------- refresh
  UI.refresh = function () {
    $$('#toolbar .tool-btn').forEach(b => b.classList.toggle('on', b.dataset.tool === T().current));
    $('#btn-undo').disabled = !M().undoStack.length;
    $('#btn-redo').disabled = !M().redoStack.length;
    const img = M().project.image;
    $('#calib-badge').style.display = (img && !img.calibrated) ? 'inline-block' : 'none';
    const rotInput = $('#view-rot');
    if (rotInput && document.activeElement !== rotInput) {
      rotInput.value = Math.round((M().project.viewRotationDeg || 0) * 10) / 10;
    }
    $('#btn-footprints').style.display = (img && img.bbox) ? 'inline-block' : 'none';
    $('#btn-expand').style.display = (img && img.originGlobalPx) ? 'inline-block' : 'none';
    $('#btn-crop').style.display = img ? 'inline-block' : 'none';
    $('#attribution').textContent = img && img.attribution ? img.attribution : '';
    renderLayers();
    renderSchedule();
    renderProps();
    UI.updateStatus(null);
  };

  return UI;
})();
