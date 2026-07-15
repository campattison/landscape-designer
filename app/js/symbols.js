/* Landscape Designer — parametric plant symbols & hardscape hatch patterns.
   Convention (research/02): plants are circles at MATURE spread with a center
   dot; deciduous = scalloped outline, evergreen = spiky, shrubs = smaller,
   groundcover = area fill. All generated parametrically (no symbol library
   with a clean license exists — research/05). Deterministic seeding, no
   Math.random at render time. */
window.LD = window.LD || {};

LD.Symbols = (function () {
  const { hashSeed, mulberry32 } = LD.geom;

  // Map a plant record to a symbol style
  function styleFor(plant) {
    if (!plant) return 'plain';
    switch (plant.category) {
      case 'canopy':          return 'scallop';
      case 'ornamental':      return 'scallop-fine';
      case 'evergreen-tree':  return 'spike';
      case 'shrub-deciduous': return 'wobble';
      case 'shrub-evergreen': return 'spike-fine';
      case 'perennial':       return 'plain';
      case 'grass':           return 'tuft';
      case 'groundcover':     return 'plain-small';
      default:                return 'plain';
    }
  }

  /* Draw a plant symbol outline into a 2D context, centered at (0,0), radius r
     (world units — the Konva node provides the transform). */
  function drawOutline(ctx, r, style, seed) {
    const rnd = mulberry32(seed);
    ctx.beginPath();
    if (style === 'scallop' || style === 'scallop-fine') {
      // scalloped (deciduous) — outward arc bumps
      const n = Math.max(8, Math.round(style === 'scallop' ? r * 1.2 : r * 2.2));
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        const amid = (a0 + a1) / 2;
        const jitter = 0.94 + rnd() * 0.1;
        const rb = r * (1.04 + 0.06 * rnd());
        const p0 = { x: Math.cos(a0) * r * jitter, y: Math.sin(a0) * r * jitter };
        const pm = { x: Math.cos(amid) * rb, y: Math.sin(amid) * rb };
        const p1 = { x: Math.cos(a1) * r, y: Math.sin(a1) * r };
        if (i === 0) ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(pm.x, pm.y, p1.x, p1.y);
      }
    } else if (style === 'spike' || style === 'spike-fine') {
      // spiky (evergreen) — zigzag between r and inner radius
      const n = Math.max(10, Math.round(style === 'spike' ? r * 1.6 : r * 2.6));
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = (i % 2 === 0) ? r : r * (0.8 + 0.06 * rnd());
        const p = { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
    } else if (style === 'wobble') {
      // loose irregular circle (deciduous shrub)
      const n = 24;
      let first = null;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = i === n ? first.rr : r * (0.92 + rnd() * 0.16);
        const p = { x: Math.cos(a) * rr, y: Math.sin(a) * rr };
        if (i === 0) { first = { rr }; ctx.moveTo(p.x, p.y); } else ctx.lineTo(p.x, p.y);
      }
    } else if (style === 'tuft') {
      // ornamental grass — circle with small V tufts
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.closePath();
  }

  /* Konva sceneFunc factory for a plant node.
     attrs: radiusFt, symbolStyle, seedStr, existing (bool) */
  function plantSceneFunc(ctx, shape) {
    const r = shape.getAttr('radiusFt');
    const style = shape.getAttr('symbolStyle');
    const seed = hashSeed(shape.getAttr('seedStr') || 'x');
    const c = ctx._context;

    drawOutline(c, r, style, seed);
    ctx.fillStrokeShape(shape); // uses node fill/stroke settings

    // interior detail
    c.save();
    c.strokeStyle = shape.stroke();
    c.fillStyle = shape.stroke();
    c.lineWidth = shape.strokeWidth() * 0.75;
    if (style === 'tuft') {
      // radial ticks
      const rnd = mulberry32(seed);
      const n = 7 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.3;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
        c.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
        c.stroke();
      }
    }
    // center dot — the trunk/insertion point (the defining convention)
    c.beginPath();
    c.arc(0, 0, Math.max(0.28, r * 0.045), 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // ---- hardscape hatch patterns ------------------------------------------
  /* Each pattern is a small canvas tile with a stated real-world size so the
     hatch stays scale-true: fillPatternScale = worldSize / canvasPx. */
  const PATTERNS = {}; // material -> { canvas, worldFt }

  function tile(px, worldFt, draw) {
    const c = document.createElement('canvas');
    c.width = px; c.height = px;
    const g = c.getContext('2d');
    g.clearRect(0, 0, px, px);
    draw(g, px);
    return { canvas: c, worldFt };
  }

  function buildPatterns() {
    const line = '#8a857c';

    PATTERNS.concrete = tile(64, 4, (g, s) => {
      g.fillStyle = '#e7e4de'; g.fillRect(0, 0, s, s);
      g.fillStyle = line;
      const rnd = mulberry32(7);
      for (let i = 0; i < 14; i++) g.fillRect(rnd() * s, rnd() * s, 1.4, 1.4);
    });

    PATTERNS.pavers = tile(64, 4, (g, s) => {
      g.fillStyle = '#e3ddd2'; g.fillRect(0, 0, s, s);
      g.strokeStyle = line; g.lineWidth = 1;
      for (let i = 0; i <= 2; i++) {
        g.beginPath(); g.moveTo(0, i * s / 2); g.lineTo(s, i * s / 2); g.stroke();
        g.beginPath(); g.moveTo(i * s / 2, 0); g.lineTo(i * s / 2, s); g.stroke();
      }
    });

    PATTERNS.brick = tile(64, 2.67, (g, s) => {
      // running bond: 4 courses, 16px course height
      g.fillStyle = '#e8d9cd'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#a08876'; g.lineWidth = 1;
      const course = s / 4;
      for (let r = 0; r < 4; r++) {
        g.beginPath(); g.moveTo(0, r * course); g.lineTo(s, r * course); g.stroke();
        const off = (r % 2) * s / 4;
        for (let x = -1; x < 3; x++) {
          g.beginPath();
          g.moveTo(off + x * s / 2, r * course);
          g.lineTo(off + x * s / 2, (r + 1) * course);
          g.stroke();
        }
      }
    });

    PATTERNS.flagstone = tile(96, 6, (g, s) => {
      g.fillStyle = '#e0ddd6'; g.fillRect(0, 0, s, s);
      g.strokeStyle = line; g.lineWidth = 1.2;
      // irregular polygon joints (seeded)
      const rnd = mulberry32(21);
      const cells = 3, cs = s / cells;
      const jitter = () => (rnd() - 0.5) * cs * 0.55;
      const pts = [];
      for (let j = 0; j <= cells; j++) {
        pts[j] = [];
        for (let i = 0; i <= cells; i++) {
          const edgeX = (i === 0 || i === cells), edgeY = (j === 0 || j === cells);
          pts[j][i] = { x: i * cs + (edgeX ? 0 : jitter()), y: j * cs + (edgeY ? 0 : jitter()) };
        }
      }
      for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
        const q = [pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i]];
        g.beginPath();
        g.moveTo(q[0].x, q[0].y);
        q.slice(1).forEach(p => g.lineTo(p.x, p.y));
        g.closePath(); g.stroke();
      }
    });

    PATTERNS.gravel = tile(64, 3, (g, s) => {
      g.fillStyle = '#e9e6df'; g.fillRect(0, 0, s, s);
      g.fillStyle = '#9d968a';
      const rnd = mulberry32(33);
      for (let i = 0; i < 42; i++) {
        g.beginPath();
        g.arc(rnd() * s, rnd() * s, 0.8 + rnd() * 1.2, 0, Math.PI * 2);
        g.fill();
      }
    });

    PATTERNS.mulch = tile(64, 3, (g, s) => {
      g.fillStyle = '#eadfce'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#b39b78'; g.lineWidth = 1;
      const rnd = mulberry32(45);
      for (let i = 0; i < 26; i++) {
        const x = rnd() * s, y = rnd() * s, a = rnd() * Math.PI, l = 3 + rnd() * 4;
        g.beginPath();
        g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
        g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
        g.stroke();
      }
    });

    PATTERNS.deck = tile(64, 4, (g, s) => {
      g.fillStyle = '#e6d9c4'; g.fillRect(0, 0, s, s);
      g.strokeStyle = '#a98f6d'; g.lineWidth = 1;
      for (let i = 0; i <= 8; i++) {
        g.beginPath(); g.moveTo(0, i * s / 8); g.lineTo(s, i * s / 8); g.stroke();
      }
    });

    // groundcover area fill
    PATTERNS.groundcover = tile(48, 3, (g, s) => {
      g.strokeStyle = '#5f7d54'; g.lineWidth = 1;
      const rnd = mulberry32(57);
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const x = (i + 0.5) * s / 3 + (rnd() - 0.5) * 4;
        const y = (j + 0.5) * s / 3 + (rnd() - 0.5) * 4;
        // small "v" sprig
        g.beginPath();
        g.moveTo(x - 2.4, y + 2.4); g.lineTo(x, y - 2); g.lineTo(x + 2.4, y + 2.4);
        g.stroke();
      }
    });
  }

  const MATERIALS = [
    { id: 'pavers',    name: 'Pavers' },
    { id: 'concrete',  name: 'Concrete' },
    { id: 'brick',     name: 'Brick' },
    { id: 'flagstone', name: 'Flagstone' },
    { id: 'gravel',    name: 'Gravel' },
    { id: 'mulch',     name: 'Mulch' },
    { id: 'deck',      name: 'Wood deck' }
  ];

  function pattern(material) {
    if (!PATTERNS[material]) material = 'concrete';
    return PATTERNS[material];
  }

  buildPatterns();

  return { styleFor, plantSceneFunc, pattern, MATERIALS, drawOutline };
})();
