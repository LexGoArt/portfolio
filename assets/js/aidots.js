/* "AI" drawn from whole dots on a canvas (no clipped half-dots).
   Glyphs are hand-set on a grid. Dots are born left to right; near the cursor they light up in the accent and swell, like light under glass.
   Used on the home door and as the AI page title. Hover area = closest [data-aihost], else the canvas parent. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ACCENT = [31, 61, 255];
  // A and I, 11 rows. Drawn by hand so the A is even and mirror-symmetric (font sampling made it ragged).
  // the I carries serifs so it never reads as a lowercase l next to the A
  const GLYPH = [
    '..###...####',
    '.##.##...##.',
    '.##.##...##.',
    '.##.##...##.',
    '##...##..##.',
    '##...##..##.',
    '#######..##.',
    '##...##..##.',
    '##...##..##.',
    '##...##..##.',
    '##...##.####'
  ];
  document.querySelectorAll('canvas[data-aidots]').forEach(cv => dotWord(cv, cv.closest('[data-aihost]') || cv.parentElement));
  function dotWord(cv, door) {
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, S = 6, base = 0.3, dots = [], t0 = 0, raf = 0, last = 0;
  const html = document.documentElement;
  // already seen this session, or carried over from the home door: no second birth
  const instant = reduce || html.classList.contains('vt') || html.classList.contains('seen');
  const onHome = !!door.closest('.d3');
  const ptr = { x: -999, y: -999, sx: -999, sy: -999, a: 0, ta: 0 };

  function build() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // hand-set glyphs on a dot grid: symmetric, every stroke exactly two dots wide
    const rows = GLYPH.length;
    S = H / rows; base = 0.36;
    dots = [];
    GLYPH.forEach((line, r) => [...line].forEach((ch, c) => {
      if (ch !== '#') return;
      const x = (c + 0.5) * S, y = (r + 0.5) * S;
      dots.push({ x, y, d: Math.random() * 0.4 + (c / line.length) * 0.6, h: 0 });
    }));
    if (!t0) t0 = performance.now();   // a resize must not replay the birth
    kick();
  }

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    const t = (now - t0) / 1000;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    const f = c => 1 - Math.pow(1 - c, dt * 60);   // frame-rate independent smoothing
    ptr.sx += (ptr.x - ptr.sx) * f(0.22); ptr.sy += (ptr.y - ptr.sy) * f(0.22);
    ptr.a += (ptr.ta - ptr.a) * f(0.12);
    ctx.clearRect(0, 0, W, H);
    const R = onHome ? 230 : Math.max(150, H * 2.2);   // on the home door the same reach as the code field around it
    const wash = 0.5 * ptr.a;   // entering the door warms the whole word a little
    let busy = Math.abs(ptr.ta - ptr.a) > 0.004 || Math.abs(ptr.x - ptr.sx) > 0.3 || Math.abs(ptr.y - ptr.sy) > 0.3;   // a resting pointer costs nothing
    for (const p of dots) {
      const born = instant ? 1 : Math.min(1, Math.max(0, (t - 0.15 - p.d * 0.5) / 0.35));
      if (born < 1) busy = true;
      const dist = Math.hypot(p.x - ptr.sx, p.y - ptr.sy);
      const tgt = ptr.a * Math.max(0, 1 - dist / R);
      p.h += (tgt - p.h) * (tgt > p.h ? f(0.25) : f(0.08));
      if (Math.abs(tgt - p.h) > 0.004) busy = true;
      const e = 1 - Math.pow(1 - born, 3);
      const r = S * (base + 0.14 * p.h) * e;
      if (r < 0.2) continue;
      const k = wash + (1 - wash) * p.h;
      const c = [11 + (ACCENT[0] - 11) * k, 11 + (ACCENT[1] - 11) * k, 11 + (ACCENT[2] - 11) * k];
      ctx.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (busy) kick(); else last = 0;
  }

  door.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
    if (ptr.sx < -900) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
    ptr.ta = 1; kick();
  });
  door.addEventListener('pointerleave', () => { ptr.ta = 0; kick(); });

  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(build, 120); });
  build();
  }
})();
