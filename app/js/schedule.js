/* Landscape Designer — plant schedule (the auto-generated table that separates
   a professional tool from a drawing toy — research/02).
   Keys come from botanical-name initials (AR = Acer rubrum), deduped with
   numeric suffixes. Groundcover quantities derive from area / o.c. spacing. */
window.LD = window.LD || {};

LD.Schedule = (function () {
  const M = () => LD.Model;
  const G = LD.geom;

  function usedPlantIds() {
    const ids = new Set();
    M().project.plants.forEach(p => ids.add(p.plantId));
    M().project.groundcovers.forEach(g => ids.add(g.plantId));
    return [...ids];
  }

  /* plantId -> key map, stable across renders (sorted by botanical name). */
  function keys() {
    const ids = usedPlantIds();
    const entries = ids.map(id => {
      const p = M().plant(id);
      const botanical = p ? p.botanical : id;
      const initials = botanical.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
      return { id, botanical, initials };
    }).sort((a, b) => a.botanical.localeCompare(b.botanical));
    const seen = {};
    const map = {};
    entries.forEach(e => {
      let k = e.initials;
      if (seen[k]) { seen[k] += 1; k = `${e.initials}${seen[e.initials]}`; }
      else seen[k] = 1;
      map[e.id] = k;
    });
    return map;
  }

  function groundcoverQty(gc) {
    const p = M().plant(gc.plantId);
    const spacingIn = gc.spacingIn || (p && p.spacingInches) || 12;
    const spacingFt = spacingIn / 12;
    const area = G.polygonArea(gc.pts);
    return Math.max(1, Math.ceil(area / (spacingFt * spacingFt)));
  }

  /* Returns rows: { key, qty, botanical, common, spreadFt, spacing, category, note } */
  function rows() {
    const proj = M().project;
    const keyMap = keys();
    const byId = {};

    proj.plants.forEach(pl => {
      const p = M().plant(pl.plantId);
      if (!byId[pl.plantId]) {
        byId[pl.plantId] = {
          key: keyMap[pl.plantId], qty: 0,
          botanical: p ? p.botanical : pl.plantId,
          common: p ? p.common : '(unknown)',
          spreadFt: pl.spreadFt || (p ? p.spreadFt : null),
          spacing: p && p.spacingInches ? `${p.spacingInches}" o.c.` : (p ? `${p.spreadFt}' o.c.` : '—'),
          category: p ? p.category : 'other',
          note: p ? (p.notes || '') : ''
        };
      }
      byId[pl.plantId].qty += 1;
    });

    proj.groundcovers.forEach(gc => {
      const p = M().plant(gc.plantId);
      const qty = groundcoverQty(gc);
      const gid = gc.plantId + '::gc';
      if (!byId[gid]) {
        const spacingIn = gc.spacingIn || (p && p.spacingInches) || 12;
        byId[gid] = {
          key: keyMap[gc.plantId], qty: 0,
          botanical: p ? p.botanical : gc.plantId,
          common: (p ? p.common : '(unknown)') + ' (groundcover fill)',
          spreadFt: p ? p.spreadFt : null,
          spacing: `${spacingIn}" o.c.`,
          category: 'groundcover',
          note: `${Math.round(G.polygonArea(gc.pts))} sq ft area`
        };
      }
      byId[gid].qty += qty;
    });

    const order = ['canopy', 'ornamental', 'evergreen-tree', 'shrub-deciduous',
                   'shrub-evergreen', 'perennial', 'grass', 'groundcover', 'other'];
    return Object.values(byId).sort((a, b) => {
      const c = order.indexOf(a.category) - order.indexOf(b.category);
      return c !== 0 ? c : a.botanical.localeCompare(b.botanical);
    });
  }

  function toCSV() {
    const r = rows();
    const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['KEY', 'QTY', 'BOTANICAL NAME', 'COMMON NAME', 'MATURE SPREAD (FT)', 'SPACING', 'NOTES'];
    const lines = [head.join(',')];
    r.forEach(row => lines.push([row.key, row.qty, row.botanical, row.common,
      row.spreadFt != null ? row.spreadFt : '', row.spacing, row.note].map(esc).join(',')));
    return lines.join('\n');
  }

  return { keys, rows, toCSV, groundcoverQty };
})();
