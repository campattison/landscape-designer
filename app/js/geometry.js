/* Landscape Designer — geometry helpers. All coordinates are world-units (feet) unless noted. */
window.LD = window.LD || {};

LD.geom = (function () {
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // Shoelace area (abs), points: [{x,y},...]
  function polygonArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s / 2);
  }

  function polylineLength(pts, closed) {
    let s = 0;
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
    return s;
  }

  function centroid(pts) {
    let x = 0, y = 0;
    pts.forEach(p => { x += p.x; y += p.y; });
    return { x: x / pts.length, y: y / pts.length };
  }

  function bounds(pts) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    });
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }

  function pointInPolygon(pt, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if (((yi > pt.y) !== (yj > pt.y)) &&
          (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }

  // simplify-js wrapper (global `simplify`), tolerance in world units
  function simplifyPts(pts, tolerance) {
    if (typeof simplify === 'function' && pts.length > 3) {
      return simplify(pts, tolerance, true);
    }
    return pts;
  }

  // Squaring for traced buildings: rotate to dominant axis, snap segment
  // angles to 0/90, rebuild, rotate back.
  function orthogonalize(pts) {
    if (pts.length < 4) return pts;
    // dominant angle: length-weighted mean of segment angles mod 90deg
    let sx = 0, sy = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = dist(a, b);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const m = ((ang % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2); // 0..90deg
      sx += Math.cos(4 * m) * len; sy += Math.sin(4 * m) * len;       // 4x wraps 90deg period
    }
    const theta = Math.atan2(sy, sx) / 4;
    const c = centroid(pts);
    const rot = (p, ang) => {
      const dx = p.x - c.x, dy = p.y - c.y;
      return { x: c.x + dx * Math.cos(ang) - dy * Math.sin(ang),
               y: c.y + dx * Math.sin(ang) + dy * Math.cos(ang) };
    };
    let r = pts.map(p => rot(p, -theta));
    // snap each segment to horizontal or vertical by adjusting the endpoint
    const out = [ { x: r[0].x, y: r[0].y } ];
    for (let i = 1; i < r.length; i++) {
      const prev = out[i - 1], cur = r[i];
      if (Math.abs(cur.x - prev.x) > Math.abs(cur.y - prev.y)) {
        out.push({ x: cur.x, y: prev.y });   // horizontal segment
      } else {
        out.push({ x: prev.x, y: cur.y });   // vertical segment
      }
    }
    // close the loop cleanly: force last→first to be axis-aligned
    const first = out[0], last = out[out.length - 1];
    if (Math.abs(last.x - first.x) < Math.abs(last.y - first.y)) last.x = first.x;
    else last.y = first.y;
    // drop collinear/duplicate points
    const clean = out.filter((p, i) => {
      const q = out[(i + 1) % out.length];
      return dist(p, q) > 0.05;
    });
    return clean.map(p => rot(p, theta));
  }

  // Deterministic per-object randomness (never Math.random at render)
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 12.54 -> `12'-6"`
  function fmtFeet(ft) {
    const sign = ft < 0 ? '-' : '';
    ft = Math.abs(ft);
    let whole = Math.floor(ft);
    let inches = Math.round((ft - whole) * 12);
    if (inches === 12) { whole += 1; inches = 0; }
    return inches ? `${sign}${whole}'-${inches}"` : `${sign}${whole}'`;
  }

  function fmtArea(sqft) {
    return sqft >= 10 ? `${Math.round(sqft).toLocaleString()} sq ft` : `${sqft.toFixed(1)} sq ft`;
  }

  // Snap an angle (radians) to nearest multiple of `step` (radians)
  function snapAngle(ang, step) { return Math.round(ang / step) * step; }

  // flatten [{x,y}] -> [x,y,x,y,...] for Konva
  function flat(pts) { const a = []; pts.forEach(p => { a.push(p.x, p.y); }); return a; }
  function unflat(arr) { const p = []; for (let i = 0; i < arr.length; i += 2) p.push({ x: arr[i], y: arr[i + 1] }); return p; }

  return { dist, mid, polygonArea, polylineLength, centroid, bounds, pointInPolygon,
           simplifyPts, orthogonalize, hashSeed, mulberry32, fmtFeet, fmtArea,
           snapAngle, flat, unflat };
})();
