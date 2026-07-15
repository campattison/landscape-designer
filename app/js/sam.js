/* Landscape Designer — browser-side Segment Anything (SlimSAM via
   transformers.js). Click a feature on the aerial → mask → polygon.
   Research/04's recommended auto-detection path: SlimSAM-77 is small enough
   for CPU/WASM inference; loaded lazily from CDN on first use (~30 MB of
   model weights, cached by the browser afterward). Everything else in the
   app keeps working if this fails — the magic wand and manual tracing are
   the fallbacks. */
window.LD = window.LD || {};

LD.Sam = (function () {
  const MODEL_ID = 'Xenova/slimsam-77-uniform';
  const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
  const MAX_DIM = 1024; // SAM's native input — larger images are downscaled

  let bundleP = null;    // { tf, model, processor }
  let running = false;
  // cache the prepared (possibly downscaled) image per dataURL
  let imgCache = { src: null, rawImage: null, factor: 1 };

  function busy() { return running; }

  async function load(onStatus) {
    if (!bundleP) {
      bundleP = (async () => {
        onStatus('Loading AI library…');
        const tf = await import(CDN);
        onStatus('Downloading SlimSAM model (first use only, ~30 MB)…');
        const model = await tf.SamModel.from_pretrained(MODEL_ID, {
          progress_callback: p => {
            if (p.status === 'progress' && p.file && p.file.endsWith('.onnx')) {
              onStatus(`Downloading model… ${Math.round(p.progress || 0)}%`);
            }
          }
        });
        const processor = await tf.AutoProcessor.from_pretrained(MODEL_ID);
        return { tf, model, processor };
      })();
      bundleP.catch(() => { bundleP = null; }); // allow retry after failure
    }
    return bundleP;
  }

  async function prepareImage(img, tf) {
    if (imgCache.src === img.dataURL && imgCache.rawImage) return imgCache;
    const factor = Math.min(1, MAX_DIM / Math.max(img.widthPx, img.heightPx));
    let url = img.dataURL;
    if (factor < 1) {
      const el = new Image();
      el.src = img.dataURL;
      if (!el.complete) await new Promise((res, rej) => { el.onload = res; el.onerror = rej; });
      const c = document.createElement('canvas');
      c.width = Math.round(img.widthPx * factor);
      c.height = Math.round(img.heightPx * factor);
      c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
      url = c.toDataURL('image/jpeg', 0.92);
    }
    const rawImage = await tf.RawImage.read(url);
    imgCache = { src: img.dataURL, rawImage, factor };
    return imgCache;
  }

  /* Convert the best SAM mask (boolean tensor [1, numMasks, H, W]) into a
     MagicWand-compatible mask object so we reuse its contour tracer. */
  function bestMaskToObj(maskTensor, scoresTensor) {
    const [, numMasks, H, W] = maskTensor.dims;
    const scores = Array.from(scoresTensor.data);
    let bi = 0;
    for (let i = 1; i < numMasks; i++) if (scores[i] > scores[bi]) bi = i;
    const src = maskTensor.data; // Uint8/bool, [1*numMasks*H*W]
    const off = bi * H * W;
    const data = new Uint8Array(W * H);
    let minX = W, minY = H, maxX = 0, maxY = 0, count = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (src[off + y * W + x]) {
          data[y * W + x] = 1;
          count++;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (!count) return null;
    return { data, width: W, height: H, bounds: { minX, minY, maxX, maxY } };
  }

  /* Segment at image-pixel coords (px, py). Returns polygon points in image
     pixels (original resolution) or null. */
  async function segmentAt(img, px, py, onStatus) {
    running = true;
    try {
      const { tf, model, processor } = await load(onStatus);
      const { rawImage, factor } = await prepareImage(img, tf);
      onStatus('Segmenting…');
      const input_points = [[[px * factor, py * factor]]];
      const inputs = await processor(rawImage, { input_points });
      const outputs = await model(inputs);
      const masks = await processor.post_process_masks(
        outputs.pred_masks, inputs.original_sizes, inputs.reshaped_input_sizes);
      const maskObj = bestMaskToObj(masks[0], outputs.iou_scores);
      if (!maskObj) return null;

      let contours = MagicWand.traceContours(maskObj);
      contours = MagicWand.simplifyContours(contours, 1.5, 24);
      const outer = contours.filter(c => !c.inner);
      if (!outer.length) return null;
      // the contour containing the click, else the largest
      let best = null, bestArea = 0;
      outer.forEach(c => {
        const pts = c.points.map(p => ({ x: p.x, y: p.y }));
        const area = LD.geom.polygonArea(pts);
        const contains = LD.geom.pointInPolygon({ x: px * factor, y: py * factor }, pts);
        if (contains && area > bestArea * 0.2) { best = pts; bestArea = Math.max(area, bestArea); }
        else if (!best && area > bestArea) { best = pts; bestArea = area; }
      });
      if (!best) return null;
      return best.map(p => ({ x: p.x / factor, y: p.y / factor }));
    } finally {
      running = false;
      onStatus('');
    }
  }

  return { segmentAt, busy, preload: load };
})();
