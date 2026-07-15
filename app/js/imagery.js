/* Landscape Designer — imagery pipeline.
   Address → geocode (Nominatim) → stitched Esri World Imagery tiles at z19–20
   (license permits tracing w/ attribution; see research/03) → deterministic
   Web-Mercator scale. Also fetches OSM building footprints via Overpass.
   NOTE: Google imagery is deliberately unsupported — its ToS prohibits
   digitizing building outlines. */
window.LD = window.LD || {};

LD.Imagery = (function () {
  const TILE = 256;
  const ESRI_URL = (z, y, x) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  const ESRI_ATTRIBUTION = 'Imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
  const GRID = 4; // 4x4 tiles = 1024x1024 px

  function metersPerPixel(lat, zoom) {
    return 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
  }
  function ftPerPx(lat, zoom) { return metersPerPixel(lat, zoom) * 3.28084; }

  // lat/lon -> global pixel coords at zoom z (Web Mercator)
  function latLonToGlobalPx(lat, lon, z) {
    const worldPx = TILE * Math.pow(2, z);
    const latR = lat * Math.PI / 180;
    const x = (lon + 180) / 360 * worldPx;
    const y = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * worldPx;
    return { x, y };
  }
  function globalPxToLatLon(x, y, z) {
    const worldPx = TILE * Math.pow(2, z);
    const lon = x / worldPx * 360 - 180;
    const n = Math.PI - 2 * Math.PI * y / worldPx;
    const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lon };
  }

  function loadTile(z, y, x) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`tile ${z}/${y}/${x} failed`));
      img.src = ESRI_URL(z, y, x);
    });
  }

  /* Esri returns "Map data not yet available" placeholder tiles with HTTP 200
     at over-zoom, so load success is not enough — check tile content. The
     placeholder is uniform gray except centered text, so near-zero variance in
     the corner blocks means no real imagery. */
  function tileHasImagery(img) {
    const c = document.createElement('canvas');
    c.width = TILE; c.height = TILE;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const corners = [[8, 8], [TILE - 40, 8], [8, TILE - 40], [TILE - 40, TILE - 40]];
    let vals = [];
    for (const [x, y] of corners) {
      const d = ctx.getImageData(x, y, 32, 32).data;
      for (let i = 0; i < d.length; i += 16) {
        vals.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      }
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    return sd > 5;
  }

  // Probe whether real imagery exists at a zoom by inspecting the center tile.
  async function bestZoom(lat, lon) {
    for (const z of [20, 19, 18, 17]) {
      const g = latLonToGlobalPx(lat, lon, z);
      const tx = Math.floor(g.x / TILE), ty = Math.floor(g.y / TILE);
      try {
        const img = await loadTile(z, ty, tx);
        if (tileHasImagery(img)) return z;
      } catch (e) { /* try lower */ }
    }
    throw new Error('No Esri imagery available at this location.');
  }

  /* Fetch a GRIDxGRID stitched image centered on lat/lon.
     Returns { dataURL, widthPx, heightPx, ftPerPx, zoom, originGlobalPx, bbox, attribution } */
  async function fetchImagery(lat, lon, onProgress) {
    const z = await bestZoom(lat, lon);
    const center = latLonToGlobalPx(lat, lon, z);
    const ctx0 = Math.floor(center.x / TILE), cty0 = Math.floor(center.y / TILE);
    const startX = ctx0 - Math.floor(GRID / 2) + 1, startY = cty0 - Math.floor(GRID / 2) + 1;
    // shift so the center point lands near the middle of the stitched canvas
    const originGlobalPx = { x: startX * TILE, y: startY * TILE };

    const canvas = document.createElement('canvas');
    canvas.width = GRID * TILE; canvas.height = GRID * TILE;
    const ctx = canvas.getContext('2d');

    let done = 0;
    const jobs = [];
    for (let dy = 0; dy < GRID; dy++) {
      for (let dx = 0; dx < GRID; dx++) {
        jobs.push(
          loadTile(z, startY + dy, startX + dx)
            .then(img => { ctx.drawImage(img, dx * TILE, dy * TILE); })
            .catch(() => { /* leave gap — edge of coverage */ })
            .finally(() => { done++; if (onProgress) onProgress(done, GRID * GRID); })
        );
      }
    }
    await Promise.all(jobs);

    const nw = globalPxToLatLon(originGlobalPx.x, originGlobalPx.y, z);
    const se = globalPxToLatLon(originGlobalPx.x + GRID * TILE, originGlobalPx.y + GRID * TILE, z);

    return {
      dataURL: canvas.toDataURL('image/jpeg', 0.92),
      widthPx: canvas.width,
      heightPx: canvas.height,
      ftPerPx: ftPerPx(lat, z),
      zoom: z,
      centerLat: lat, centerLon: lon,
      originGlobalPx,
      bbox: { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon },
      attribution: ESRI_ATTRIBUTION
    };
  }

  // ---- geocoding (Nominatim / OSM) --------------------------------------
  async function geocode(query) {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q='
      + encodeURIComponent(query);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
    const data = await res.json();
    return data.map(d => ({ lat: +d.lat, lon: +d.lon, label: d.display_name }));
  }

  // ---- OSM building footprints via Overpass ------------------------------
  /* Returns array of { pts: [{x,y} in FEET rel. to image origin], tags } */
  async function fetchFootprints(imgMeta) {
    const { bbox, originGlobalPx, zoom, ftPerPx: fpp } = imgMeta;
    const q = `[out:json][timeout:25];
      way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      (._;>;); out;`;
    // public Overpass instances throttle aggressively — try mirrors in order
    const MIRRORS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];
    let data = null, lastErr = null;
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(q),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (!res.ok) { lastErr = new Error(`Overpass failed (${res.status})`); continue; }
        data = await res.json();
        break;
      } catch (e) { lastErr = e; }
    }
    if (!data) throw lastErr || new Error('Overpass unavailable');
    const nodes = {};
    data.elements.filter(e => e.type === 'node').forEach(n => { nodes[n.id] = n; });
    const out = [];
    data.elements.filter(e => e.type === 'way' && e.nodes && e.nodes.length > 3).forEach(w => {
      const pts = [];
      w.nodes.forEach(nid => {
        const n = nodes[nid];
        if (!n) return;
        const g = latLonToGlobalPx(n.lat, n.lon, zoom);
        pts.push({ x: (g.x - originGlobalPx.x) * fpp, y: (g.y - originGlobalPx.y) * fpp });
      });
      // drop the duplicated closing node
      if (pts.length > 1 && LD.geom.dist(pts[0], pts[pts.length - 1]) < 0.5) pts.pop();
      if (pts.length >= 3) out.push({ pts, tags: w.tags || {} });
    });
    return out;
  }

  /* Grow the stitched image by one tile ring on every side (user-driven —
     the app should not make cropping decisions). Returns a new image meta
     with the same zoom/ftPerPx and a shifted origin; caller must translate
     existing geometry by the origin shift. */
  const MAX_SIDE_PX = 12 * TILE; // 3072 px — keeps canvas + autosave sane
  async function expandImagery(meta, onProgress) {
    if (!meta.originGlobalPx || !meta.zoom) throw new Error('Only address-fetched imagery can expand.');
    const z = meta.zoom;
    // origin may be non-tile-aligned (e.g., after a crop) — handle arbitrary rects
    const originGlobalPx = { x: meta.originGlobalPx.x - TILE, y: meta.originGlobalPx.y - TILE };
    const w = meta.widthPx + 2 * TILE, h = meta.heightPx + 2 * TILE;
    if (Math.max(w, h) > MAX_SIDE_PX) throw new Error('Map is at its maximum size — crop it first, or start from a screenshot for very large properties.');
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const tx0 = Math.floor(originGlobalPx.x / TILE), tx1 = Math.floor((originGlobalPx.x + w - 1) / TILE);
    const ty0 = Math.floor(originGlobalPx.y / TILE), ty1 = Math.floor((originGlobalPx.y + h - 1) / TILE);
    const total = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
    let done = 0;
    const jobs = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        jobs.push(
          loadTile(z, ty, tx)
            .then(img => { ctx.drawImage(img, tx * TILE - originGlobalPx.x, ty * TILE - originGlobalPx.y); })
            .catch(() => { /* edge of coverage */ })
            .finally(() => { done++; if (onProgress) onProgress(done, total); })
        );
      }
    }
    await Promise.all(jobs);
    const nw = globalPxToLatLon(originGlobalPx.x, originGlobalPx.y, z);
    const se = globalPxToLatLon(originGlobalPx.x + w, originGlobalPx.y + h, z);
    return {
      dataURL: canvas.toDataURL('image/jpeg', 0.92),
      widthPx: w, heightPx: h,
      originGlobalPx,
      bbox: { south: se.lat, west: nw.lon, north: nw.lat, east: se.lon }
    };
  }

  return { metersPerPixel, ftPerPx, latLonToGlobalPx, globalPxToLatLon,
           fetchImagery, expandImagery, geocode, fetchFootprints, ESRI_ATTRIBUTION };
})();
