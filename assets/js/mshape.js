/* The M, drawn from dots.
   Left stroke = operations (mono glyphs on hover), right stroke = design (colour on hover), V = AI in the accent.
   Strokes grow downward when the figure enters the viewport: depth is the point. */
(function () {
  // design stroke uses the site gradient only: rose, violet, blue, teal
  const PAL = [[255, 45, 111], [162, 60, 255], [47, 107, 255], [0, 180, 155]];
  const pal = x => { const s = x * 3, i = Math.min(2, Math.floor(s)), k = s - i, A = PAL[i], B = PAL[i + 1]; return `rgb(${(A[0] + (B[0] - A[0]) * k) | 0},${(A[1] + (B[1] - A[1]) * k) | 0},${(A[2] + (B[2] - A[2]) * k) | 0})`; };
  const cv = document.querySelector('[data-mdots]');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, S, pts = [], start = 0, hover = 0, tHover = 0, raf = 0, shown = false;

  function band(px, py, ax, ay, bx, by, w) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = ((px - ax) * dx + (py - ay) * dy) / L; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < w / 2;
  }
  function build() {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = Math.max(7, W / 64);
    pts = [];
    for (let y = S / 2; y < H; y += S) for (let x = S / 2; x < W; x += S) {
      const u = x / W, v = y / H;
      let k = null;
      if (u > 0.15 && u < 0.27 && v > 0.08 && v < 0.94) k = 'o';
      else if (u > 0.73 && u < 0.85 && v > 0.08 && v < 0.94) k = 'd';
      else if (band(u, v * 0.75, 0.255, 0.14 * 0.75, 0.5, 0.6 * 0.75, 0.085) || band(u, v * 0.75, 0.745, 0.14 * 0.75, 0.5, 0.6 * 0.75, 0.085)) k = 'a';
      if (!k) continue;
      pts.push({ x, y, k, v, ch: '0123456789'[(Math.random() * 10) | 0], hue: Math.min(1, Math.max(0, (u - 0.73) / 0.12 * 0.35 + v * 0.65)), j: Math.random() });
    }
    draw(performance.now());
  }
  let lastH = 0;
  function draw(now) {
    const p = shown ? (reduce ? 1 : Math.min(1, (now - start) / 1600)) : 0;
    const dt = lastH ? Math.min(0.05, (now - lastH) / 1000) : 1 / 60; lastH = now;
    hover += (tHover - hover) * (1 - Math.pow(1 - 0.12, dt * 60));   // same feel at 60 and 120 Hz
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.round(S * 1.25)}px "IBM Plex Mono", ui-monospace, monospace`;
    for (const d of pts) {
      const appear = Math.max(0, Math.min(1, (p * 1.35 - d.v * 0.9 - d.j * 0.12) * 4));
      if (appear <= 0) continue;
      const r = S * 0.26 * appear;
      if (d.k === 'a') { ctx.fillStyle = '#1f3dff'; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill(); continue; }
      if (d.k === 'o' && hover > 0.05) {
        ctx.globalAlpha = 1 - hover; ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
        ctx.globalAlpha = hover * appear; ctx.fillText(d.ch, d.x, d.y + 0.5); ctx.globalAlpha = 1; continue;
      }
      ctx.fillStyle = d.k === 'd' && hover > 0.02 ? pal(d.hue) : '#0b0b0b';
      if (d.k === 'd' && hover > 0.02) { ctx.globalAlpha = 1; }
      ctx.beginPath(); ctx.arc(d.x, d.y, d.k === 'd' ? r * (1 + hover * 0.25) : r, 0, 7); ctx.fill();
      if (d.k === 'd' && hover < 0.98 && hover > 0.02) { ctx.globalAlpha = 1 - hover; ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    }
    if ((shown && p < 1) || Math.abs(tHover - hover) > 0.01) raf = requestAnimationFrame(draw); else raf = 0;
  }
  const loop = () => { if (!raf) raf = requestAnimationFrame(draw); };
  new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !shown) { shown = true; start = performance.now(); loop(); } }), { threshold: 0.35 }).observe(cv);
  const fig = cv.closest('figure');
  fig.addEventListener('pointerenter', () => { tHover = 1; loop(); });
  fig.addEventListener('pointerleave', () => { tHover = 0; loop(); });
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(build, 150); });
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(build);
})();
