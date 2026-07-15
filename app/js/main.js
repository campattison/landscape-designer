/* Landscape Designer — boot. */
(async function () {
  // vendor sanity
  const missing = [];
  if (typeof Konva === 'undefined') missing.push('Konva');
  if (typeof simplify === 'undefined') missing.push('simplify-js');
  if (typeof MagicWand === 'undefined') missing.push('magic-wand-tool');
  if (typeof jspdf === 'undefined') missing.push('jsPDF');
  if (missing.length) {
    document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif">
      Missing vendored libraries: ${missing.join(', ')}. Check app/vendor/.</div>`;
    return;
  }

  // plant database
  try {
    const res = await fetch('data/plants.json');
    LD.Model.setPlantsDb(await res.json());
  } catch (e) {
    console.error('plants.json failed to load', e);
    LD.Model.setPlantsDb([]);
  }

  LD.View.init('canvas-container');
  LD.Tools.init();
  LD.UI.init();

  LD.Model.onChange(kind => {
    if (kind === 'load') { LD.View.render(); LD.UI.refresh(); }
  });

  LD.View.onViewChanged = () => LD.UI.updateStatus(null);

  // offer to restore autosave
  try {
    const saved = await LD.Model.loadAutosave();
    if (saved && (saved.image || saved.plants.length || saved.features.length)) {
      const when = saved.modified ? new Date(saved.modified).toLocaleString() : 'earlier';
      if (confirm(`Restore your autosaved plan "${saved.name}" (last edited ${when})?`)) {
        LD.Model.loadProject(saved);
        LD.UI.showStart(false);
        LD.View.render();
        LD.View.zoomToFit();
        LD.UI.refresh();
        return;
      }
    }
  } catch (e) { /* no autosave */ }

  LD.UI.showStart(true);
  LD.View.render();
  LD.UI.refresh();
  LD.UI.showWelcome(false);
})();
