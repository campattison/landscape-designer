/* Landscape Designer — export: print-scale PDF (plan sheet + plant schedule),
   high-res PNG, CSV schedule, JSON project file.
   PDF strategy (research/05): render the plan as a high-DPI raster at EXACT
   pixels-per-foot for the chosen engineer's scale, embed via jsPDF, and draw
   title block / scale bar / north arrow in PDF space. At 1"=10' and 300 DPI,
   30 px = 1 ft, so the printed sheet measures true. */
window.LD = window.LD || {};

LD.Exporter = (function () {
  const M = () => LD.Model;
  const V = () => LD.View;
  const G = LD.geom;

  const PAPers = {
    digital: { name: 'Digital — sized to plan (no paper limit)' },
    letter:  { w: 11,  h: 8.5,  name: 'Letter (11×8.5")' },
    tabloid: { w: 17,  h: 11,   name: 'Tabloid (17×11")' },
    arch_d:  { w: 36,  h: 24,   name: 'Arch D (36×24")' }
  };
  const MAX_PAGE_IN = 195; // PDF hard limit is 200×200 in — stay under it
  const SCALES = [8, 10, 16, 20, 30, 40]; // 1" = X ft
  const MARGIN = 0.5;        // in
  const TITLE_H = 1.15;      // in

  function extentFt() {
    const proj = M().project;
    if (proj.image) {
      return { minX: 0, minY: 0, maxX: LD.Model.imageWidthFt(), maxY: LD.Model.imageHeightFt() };
    }
    const all = [];
    proj.features.forEach(f => all.push(...f.pts));
    proj.hardscape.forEach(h => all.push(...h.pts));
    proj.beds.forEach(b => all.push(...b.pts));
    proj.plants.forEach(p => all.push({ x: p.x, y: p.y }));
    if (!all.length) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const b = G.bounds(all);
    return { minX: b.minX - 10, minY: b.minY - 10, maxX: b.maxX + 10, maxY: b.maxY + 10 };
  }

  /* Resolve page dimensions. 'digital' sizes the page to the plan at the
     given scale — sharing-friendly, never crops. */
  function paperFor(paperId, scale) {
    if (paperId !== 'digital') return PAPers[paperId];
    const d = sheetDimsFt();
    return {
      w: d.wFt / scale + MARGIN * 2,
      h: d.hFt / scale + MARGIN * 2 + TITLE_H,
      name: PAPers.digital.name
    };
  }

  function planArea(paper) {
    return { w: paper.w - MARGIN * 2, h: paper.h - MARGIN * 2 - TITLE_H };
  }

  /* Sheet dimensions in feet, honoring the view rotation (the plan prints in
     the rotated orientation the user set up on screen). */
  function sheetDimsFt() {
    const e = extentFt();
    const rot = (M().project.viewRotationDeg || 0) * Math.PI / 180;
    const corners = [
      { x: e.minX, y: e.minY }, { x: e.maxX, y: e.minY },
      { x: e.maxX, y: e.maxY }, { x: e.minX, y: e.maxY }
    ];
    const rx = corners.map(c => c.x * Math.cos(rot) - c.y * Math.sin(rot));
    const ry = corners.map(c => c.x * Math.sin(rot) + c.y * Math.cos(rot));
    return { wFt: Math.max(...rx) - Math.min(...rx), hFt: Math.max(...ry) - Math.min(...ry) };
  }

  function fits(paperId, scale) {
    const p = paperFor(paperId, scale);
    if (paperId === 'digital') return p.w <= MAX_PAGE_IN && p.h <= MAX_PAGE_IN;
    const d = sheetDimsFt();
    const a = planArea(p);
    return d.wFt / scale <= a.w && d.hFt / scale <= a.h;
  }

  /* Smallest scale (most detail) that fits the extent on the paper. */
  function fitScale(paperId) {
    for (const s of SCALES) if (fits(paperId, s)) return s;
    return SCALES[SCALES.length - 1];
  }

  /* Render the plan region to a dataURL at pxPerFt, in the view's rotated
     orientation. The view transform lives on the layers, so we override the
     content layer's transform, size the stage to the rotated bounding box,
     rasterize, and restore. */
  function renderRaster(pxPerFt) {
    const st = V().stage;
    const layer = V().contentLayer;
    const rot = M().project.viewRotationDeg || 0;
    const e = extentFt();
    const corners = [
      { x: e.minX, y: e.minY }, { x: e.maxX, y: e.minY },
      { x: e.maxX, y: e.maxY }, { x: e.minX, y: e.maxY }
    ];

    const prev = {
      scale: layer.scaleX(), x: layer.x(), y: layer.y(), rotation: layer.rotation(),
      stX: st.x(), stY: st.y(), w: st.width(), h: st.height()
    };
    const uiVisible = V().uiLayer.visible();
    V().uiLayer.visible(false);
    st.position({ x: 0, y: 0 });

    layer.rotation(rot);
    layer.scale({ x: pxPerFt, y: pxPerFt });
    layer.position({ x: 0, y: 0 });
    const t = layer.getAbsoluteTransform();
    const pts = corners.map(c => t.point(c));
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    layer.position({ x: -minX, y: -minY });
    st.width(Math.ceil(maxX - minX));
    st.height(Math.ceil(maxY - minY));
    st.batchDraw();
    const dataURL = st.toDataURL({ pixelRatio: 1, mimeType: 'image/jpeg', quality: 0.92 });

    st.width(prev.w); st.height(prev.h);
    st.position({ x: prev.stX, y: prev.stY });
    layer.rotation(prev.rotation);
    layer.scale({ x: prev.scale, y: prev.scale });
    layer.position({ x: prev.x, y: prev.y });
    V().uiLayer.visible(uiVisible);
    st.batchDraw();

    return { dataURL, wFt: (maxX - minX) / pxPerFt, hFt: (maxY - minY) / pxPerFt };
  }

  function drawNorthArrowPDF(pdf, cx, cy, r, deg) {
    const rad = deg * Math.PI / 180;
    const rot = (x, y) => ({
      x: cx + x * Math.cos(rad) - y * Math.sin(rad),
      y: cy + x * Math.sin(rad) + y * Math.cos(rad)
    });
    pdf.setDrawColor(40); pdf.setLineWidth(0.012);
    pdf.circle(cx, cy, r, 'S');
    const tip = rot(0, -r * 0.72), tailL = rot(-r * 0.3, r * 0.35), tailR = rot(r * 0.3, r * 0.35);
    pdf.setFillColor(40);
    pdf.triangle(tip.x, tip.y, tailL.x, tailL.y, tailR.x, tailR.y, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    const nPos = rot(0, -r - 0.12);
    pdf.text('N', nPos.x, nPos.y + 0.04, { align: 'center' });
  }

  function drawScaleBarPDF(pdf, x, y, scaleFtPerIn) {
    // 4 segments; pick the largest nice increment that keeps the bar ≤ 2.2 in
    const nice = [50, 25, 20, 10, 5, 2, 1];
    const seg = nice.find(n => (n * 4) / scaleFtPerIn <= 2.2) || 1;
    const segIn = seg / scaleFtPerIn;
    pdf.setDrawColor(40); pdf.setLineWidth(0.012);
    for (let i = 0; i < 4; i++) {
      if (i % 2 === 0) { pdf.setFillColor(40); pdf.rect(x + i * segIn, y, segIn, 0.07, 'F'); }
      else { pdf.rect(x + i * segIn, y, segIn, 0.07, 'S'); }
    }
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
    for (let i = 0; i <= 4; i++) {
      pdf.text(String(i * seg), x + i * segIn, y - 0.04, { align: 'center' });
    }
    pdf.text('FEET', x + 4 * segIn + 0.12, y + 0.06);
  }

  const DISCLAIMER = 'Scale derived from aerial imagery; not survey-grade. Verify at least one dimension on site. ' +
    'Do not use for property lines, permits, or excavation. Call 811 before digging.';

  function exportPDF(opts) {
    const proj = M().project;
    const paperId = opts.paper || 'letter';
    const scaleFtPerIn = opts.scale || fitScale(paperId);
    const paper = paperFor(paperId, scaleFtPerIn);
    // digital pages can be large — drop DPI as area grows so the raster stays sane
    const dpi = paperId === 'digital' && Math.max(paper.w, paper.h) > 40 ? 150 : 300;
    const pxPerFt = dpi / scaleFtPerIn;

    const { dataURL, wFt, hFt } = renderRaster(pxPerFt);
    const wIn = wFt / scaleFtPerIn, hIn = hFt / scaleFtPerIn;
    const area = planArea(paper);

    const pdf = new jspdf.jsPDF({
      unit: 'in', format: [paper.w, paper.h],
      orientation: paper.w >= paper.h ? 'landscape' : 'portrait', // digital pages can be tall
      compress: true
    });

    // clip note if plan exceeds printable area (draw anyway, centered)
    const drawW = Math.min(wIn, area.w), drawH = Math.min(hIn, area.h);
    const ox = MARGIN + (area.w - drawW) / 2;
    const oy = MARGIN + (area.h - drawH) / 2;
    pdf.addImage(dataURL, 'JPEG', ox, oy, wIn, hIn, undefined, 'FAST');

    // frame
    pdf.setDrawColor(40); pdf.setLineWidth(0.02);
    pdf.rect(MARGIN, MARGIN, area.w, area.h, 'S');

    // ---- title block ----
    const ty = paper.h - MARGIN - TITLE_H;
    pdf.rect(MARGIN, ty, area.w, TITLE_H, 'S');
    // dividers
    const col1 = MARGIN + area.w * 0.45, col2 = MARGIN + area.w * 0.68, col3 = MARGIN + area.w * 0.86;
    pdf.line(col1, ty, col1, ty + TITLE_H);
    pdf.line(col2, ty, col2, ty + TITLE_H);
    pdf.line(col3, ty, col3, ty + TITLE_H);

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14);
    pdf.text(proj.name.toUpperCase(), MARGIN + 0.15, ty + 0.35);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    pdf.text('LANDSCAPE PLAN', MARGIN + 0.15, ty + 0.55);
    pdf.setFontSize(6);
    const attr = (proj.image && proj.image.attribution) ? proj.image.attribution + '. ' : '';
    pdf.text(pdf.splitTextToSize(attr + DISCLAIMER, area.w * 0.45 - 0.3), MARGIN + 0.15, ty + 0.72);

    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
    pdf.text(`SCALE: 1" = ${scaleFtPerIn}'-0"`, col1 + 0.15, ty + 0.3);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`DATE: ${new Date().toISOString().slice(0, 10)}`, col1 + 0.15, ty + 0.5);
    drawScaleBarPDF(pdf, col1 + 0.15, ty + 0.75, scaleFtPerIn);

    pdf.setFont('helvetica', 'bold');
    pdf.text('SHEET', col3 + 0.15, ty + 0.3);
    pdf.setFontSize(16);
    pdf.text('L-1', col3 + 0.15, ty + 0.62);

    // sheet is rotated with the view, so true north = base north + view rotation
    drawNorthArrowPDF(pdf, col2 + (col3 - col2) / 2, ty + TITLE_H / 2 - 0.05, 0.3,
      (proj.northDeg || 0) + (proj.viewRotationDeg || 0));

    // ---- page 2: plant schedule ----
    // schedule sheet stays letter-landscape — its column layout assumes ~11in width
    const SCHED_W = Math.max(11, Math.min(paper.w, 17)), SCHED_H = 8.5;
    const rows = LD.Schedule.rows();
    if (rows.length) {
      pdf.addPage([SCHED_W, SCHED_H], 'landscape');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
      pdf.text('PLANT SCHEDULE', MARGIN, MARGIN + 0.25);
      pdf.setFontSize(8);
      const cols = [
        { h: 'KEY', x: MARGIN, w: 0.7 },
        { h: 'QTY', x: MARGIN + 0.7, w: 0.6 },
        { h: 'BOTANICAL NAME', x: MARGIN + 1.3, w: 2.7 },
        { h: 'COMMON NAME', x: MARGIN + 4.0, w: 2.6 },
        { h: 'MATURE SPREAD', x: MARGIN + 6.6, w: 1.3 },
        { h: 'SPACING', x: MARGIN + 7.9, w: 1.0 },
        { h: 'NOTES', x: MARGIN + 8.9, w: SCHED_W - MARGIN * 2 - 8.9 }
      ];
      let y = MARGIN + 0.6;
      pdf.setFillColor(235);
      pdf.rect(MARGIN, y - 0.18, SCHED_W - MARGIN * 2, 0.28, 'F');
      cols.forEach(c => pdf.text(c.h, c.x + 0.05, y));
      y += 0.32;
      pdf.setFont('helvetica', 'normal');
      rows.forEach(r => {
        if (y > SCHED_H - MARGIN - 0.3) {
          pdf.addPage([SCHED_W, SCHED_H], 'landscape');
          y = MARGIN + 0.4;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(r.key || ''), cols[0].x + 0.05, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(r.qty), cols[1].x + 0.05, y);
        pdf.setFont('helvetica', 'italic');
        pdf.text(r.botanical, cols[2].x + 0.05, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(pdf.splitTextToSize(r.common, cols[3].w - 0.1)[0] || '', cols[3].x + 0.05, y);
        pdf.text(r.spreadFt != null ? `${r.spreadFt}'` : '—', cols[4].x + 0.05, y);
        pdf.text(r.spacing || '—', cols[5].x + 0.05, y);
        pdf.setFontSize(7);
        pdf.text(pdf.splitTextToSize(r.note || '', cols[6].w - 0.1)[0] || '', cols[6].x + 0.05, y);
        pdf.setFontSize(8);
        pdf.setDrawColor(200); pdf.setLineWidth(0.005);
        pdf.line(MARGIN, y + 0.08, SCHED_W - MARGIN, y + 0.08);
        y += 0.26;
      });
    }

    pdf.save(sanitize(proj.name) + '_plan.pdf');
  }

  function exportPNG() {
    const e = extentFt();
    const wFt = e.maxX - e.minX;
    const pxPerFt = Math.min(40, 4000 / wFt); // long side ≈ ≤4000 px
    const { dataURL } = renderRaster(pxPerFt);
    download(dataURL, sanitize(M().project.name) + '_plan.jpg');
  }

  function exportCSV() {
    const blob = new Blob([LD.Schedule.toCSV()], { type: 'text/csv' });
    download(URL.createObjectURL(blob), sanitize(M().project.name) + '_schedule.csv');
  }

  function exportJSON() {
    const blob = new Blob([M().toJSONFile()], { type: 'application/json' });
    download(URL.createObjectURL(blob), sanitize(M().project.name) + '.landscape.json');
  }

  function sanitize(s) { return (s || 'plan').replace(/[^\w\-]+/g, '_').slice(0, 60); }

  function download(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return { exportPDF, exportPNG, exportCSV, exportJSON, fitScale, fits, SCALES, PAPERS: PAPers };
})();
