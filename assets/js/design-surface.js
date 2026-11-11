/* Design door surface: a field of dots that wakes up under the cursor, in the spirit of the first brain.

   A fine hexagonal field of dots exists only around the pointer. Dots near it take the palette colour of
   where they sit (rose, violet, blue, teal, drifting slowly), swell, and part a little like light under
   a lens. When the hand moves, lit dots release flourishes: mirrored pairs of tapered strokes that leave
   along the direction of motion and curl into ornaments, each with its own speed, curvature and growth.
   When the hand rests, the flourishes finish curling and the dots breathe. Leaving fades everything.

   Classic script. Defines window.initDesignSurface(panelEl) -> destroy().
   Canvas 2D, no libraries, no network. DPR capped at 2. rAF only while something is visible.
   Hover + fine pointer only. Reduced motion: dots light up, no flourishes, no drift. */
(function () {
  'use strict';

  var PAL = [[255, 45, 111], [162, 60, 255], [47, 107, 255], [0, 180, 155]];   // rose, violet, blue, teal
  var TAU = Math.PI * 2;

  /* value noise for the colour map */
  var P = new Uint8Array(512);
  (function () { var s = 20261111, p = [], i, j, t; for (i = 0; i < 256; i++) p[i] = i;
    for (i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; j = s % (i + 1); t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) P[i] = p[i & 255]; })();
  function vn(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var h = function (a, b) { return P[(P[a & 255] + b) & 255] / 255; };
    var a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) { return vn(x, y) * 0.65 + vn(x * 2.03 + 7.1, y * 2.03 - 3.3) * 0.35; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  // palette as a ping-pong ramp, so rose never sits next to teal
  function pal(t) {
    t = Math.abs((t * 0.5) % 1); t = Math.abs(t * 2 - 1) * 3;
    var i = Math.min(2, t | 0), f = t - i; f = f * f * (3 - 2 * f);
    var a = PAL[i], b = PAL[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')'; }

  function initDesignSurface(panel) {
    var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine) return function () {};

    var wrap = document.createElement('div');
    wrap.className = 'ds-surface'; wrap.setAttribute('aria-hidden', 'true');
    Object.assign(wrap.style, { position: 'absolute', inset: '0', zIndex: '-1', pointerEvents: 'none', overflow: 'hidden' });
    var cv = document.createElement('canvas');
    Object.assign(cv.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    wrap.appendChild(cv);
    if (getComputedStyle(panel).position === 'static') panel.style.position = 'relative';
    panel.prepend(wrap);
    var g = cv.getContext('2d');

    var W = 0, H = 0, dpr = 1, S = 10, R = 150, dots = [], avoid = [0, 1e9, 0, 1e9];
    function size() {
      var r = panel.getBoundingClientRect(); if (!r.width) return;
      W = r.width; H = r.height; dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = clamp(W / 46, 8, 11); R = clamp(W * 0.34, 120, 175);
      var word = panel.querySelector('.d3-word');
      if (word) { var wr = word.getBoundingClientRect(); avoid = [wr.left - r.left - 14, wr.top - r.top - 18, wr.right - r.left + 14, wr.bottom - r.top + 8]; }
      else avoid = [0, H - 150, W * 0.7, H];
      // hexagonal field: every other row shifted by half a step
      dots = [];
      var rh = S * 0.866;
      for (var j = 0, y = rh / 2; y < H; j++, y += rh) {
        for (var x = (j % 2 ? S : S / 2); x < W; x += S) {
          var inWord = x > avoid[0] && x < avoid[2] && y > avoid[1] && y < avoid[3];
          dots.push({ x: x, y: y, h: 0, c: fbm(x / 210 + 3.7, y / 210), j: Math.random(), mute: inWord ? 0.25 : 1 });
        }
      }
    }

    var ptr = { x: 0, y: 0, sx: 0, sy: 0, inside: false, act: 0, vx: 0, vy: 0, travel: 0 };
    var curls = [], raf = 0, last = 0, clock = Math.random() * 20, rest = 0;

    /* a flourish: a tapered stroke that leaves a dot and curls tighter and tighter */
    function flourish(d, dir, mirror, base) {
      var t0 = d.c * 1.7 + clock * 0.03 + d.h * 0.18, c0 = pal(t0), c1 = pal(t0 + (mirror > 0 ? 0.9 : -0.9));   // the pair splits into two neighbouring colours
      // the two roots sit side by side, not on one point, so a pair reads as a scroll and never as a V
      var x = d.x - Math.sin(dir) * base.w * mirror, y = d.y + Math.cos(dir) * base.w * mirror;
      var life = base.life * (0.85 + Math.random() * 0.3);
      return {
        x: x, y: y, a: dir, sp: base.sp * (0.85 + Math.random() * 0.3), k: base.k * mirror, grow: base.grow, w: base.w,
        life: life, life0: life, cut: -1, age: 0, pts: [x, y], c0: c0, c1: c1, done: false
      };
    }
    var side = 1, gap = 30;
    function release() {
      if (reduce || curls.length >= 13) return;
      // pick a lit dot close to the pointer, a little behind it
      var best = null, bd = 1e9, bx = ptr.sx - ptr.vx * 4, by = ptr.sy - ptr.vy * 4;
      for (var t = 0; t < 30; t++) {
        var d = dots[(Math.random() * dots.length) | 0];
        if (d.h < 0.5 || d.mute < 1) continue;
        var dd = Math.hypot(d.x - bx, d.y - by) + Math.random() * 30;
        if (dd < bd) { bd = dd; best = d; }
      }
      if (!best) return;
      var dir = Math.atan2(ptr.vy, ptr.vx), spread = 0.35 + Math.random() * 0.9;
      var base = {
        sp: 95 + Math.random() * 110,               // px per second
        k: 0.004 + Math.random() * 0.012,           // curvature per px at birth
        grow: 1.6 + Math.random() * 2.4,            // how fast it tightens into a curl
        w: 4 + Math.random() * 3,                   // width at the root
        life: 1.3 + Math.random() * 0.8
      };
      side = -side;
      curls.push(flourish(best, dir + spread * 0.3 * side, side, base));
    }

    function frame(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      if (!reduce) clock += dt;
      var k = 1 - Math.exp(-dt * 14);
      var dx = (ptr.x - ptr.sx) * k, dy = (ptr.y - ptr.sy) * k;
      ptr.sx += dx; ptr.sy += dy;
      var kv = Math.pow(0.8, dt * 60), kU = 1 - Math.pow(0.76, dt * 60), kD = 1 - Math.pow(0.92, dt * 60);   // frame-rate independent
      ptr.vx = ptr.vx * kv + (1 - kv) * dx / (dt * 60); ptr.vy = ptr.vy * kv + (1 - kv) * dy / (dt * 60);
      ptr.act += ((ptr.inside ? 1 : 0) - ptr.act) * (1 - Math.exp(-dt * (ptr.inside ? 6 : 3.2)));

      // flourishes come from movement; a resting hand only lets the last ones finish
      var spd = Math.hypot(ptr.vx, ptr.vy);
      if (ptr.inside && spd > 0.8) { ptr.travel += spd * dt * 60; rest = 0; } else rest += dt;
      if (ptr.travel > gap) { ptr.travel = 0; gap = 22 + Math.random() * 26; release(); }

      g.clearRect(0, 0, W, H);
      var alive = ptr.act > 0.003;

      // dots
      var breathe = reduce ? 0 : Math.min(1, rest / 0.6);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i], ddx = d.x - ptr.sx, ddy = d.y - ptr.sy;
        var tgt = 0;
        if (Math.abs(ddx) < R && Math.abs(ddy) < R) tgt = smooth(R, R * 0.12, Math.hypot(ddx, ddy)) * ptr.act;
        d.h += (tgt - d.h) * (tgt > d.h ? kU : kD);
        if (d.h < 0.004) { d.h = 0; continue; }
        alive = true;
        var dist = Math.hypot(ddx, ddy) || 1, push = reduce ? 0 : 7 * d.h * (1 - d.h * 0.6);     // a soft lens
        var px = d.x + ddx / dist * push, py = d.y + ddy / dist * push;
        var pulse = 1 + breathe * 0.12 * Math.sin(clock * 2.4 + d.j * TAU);
        var r = (0.5 + S * 0.2 * d.h) * pulse;
        var col = pal(d.c * 1.7 + clock * 0.03 + d.h * 0.18);
        // far dots stay grey, colour arrives as the light gets close
        var cmix = smooth(0.15, 0.7, d.h);
        var c = [168 + (col[0] - 168) * cmix, 168 + (col[1] - 168) * cmix, 170 + (col[2] - 170) * cmix];
        g.fillStyle = rgba(c, Math.min(1, d.h * 1.6) * d.mute);
        g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
      }

      // flourishes
      for (var n = curls.length - 1; n >= 0; n--) {
        var f = curls[n];
        f.age += dt;
        var lf = f.age / f.life0;
        if (lf >= 1 || f.age >= f.life) { curls.splice(n, 1); continue; }
        alive = true;
        if (!f.done) {
          var step = f.sp * dt, sub = Math.max(1, Math.ceil(step / 2.5));
          for (var s = 0; s < sub; s++) {
            var ds = step / sub;
            f.k *= 1 + f.grow * ds / 100;               // tighter and tighter: a spiral ending
            f.a += f.k * ds; f.x += Math.cos(f.a) * ds; f.y += Math.sin(f.a) * ds;
            f.pts.push(f.x, f.y);
            // a stroke that reaches the word stops there and lets go, so the word stays clear
            if (f.x > avoid[0] - 12 && f.x < avoid[2] + 12 && f.y > avoid[1] - 12 && f.y < avoid[3] + 12) { f.done = true; endAt(f, 0.3); break; }
          }
          f.sp *= Math.exp(-dt * 0.9);
          if (Math.abs(f.k) > 0.28 || f.pts.length > 360) f.done = true;
        }
        drawFlourish(f, lf);
      }

      if (alive) raf = requestAnimationFrame(frame);
      else { last = 0; curls = []; }
    }

    // a filled ribbon of decreasing width, coloured along its length; it fades from the root first
    function drawFlourish(f, lf) {
      var p = f.pts, n = p.length / 2;
      if (n < 3) return;
      var fadeIn = smooth(0, 0.08, lf), fadeOut = 1 - smooth(0.68, 1, lf);
      var A = fadeIn * fadeOut * (f.cut < 0 ? 1 : 1 - smooth(f.cut, f.life, f.age));
      if (A < 0.01) return;
      var L = [], Rr = [];
      for (var i = 0; i < n; i++) {
        var a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        var tx = p[b * 2] - p[a * 2], ty = p[b * 2 + 1] - p[a * 2 + 1], tl = Math.hypot(tx, ty) || 1;
        var u = i / (n - 1);
        // thick near the root, a hairline at the curl; the root also eats away as it fades
        var w = f.w * Math.pow(1 - u, 0.7) * smooth(0, 0.06, u + 0.02) * (0.25 + 0.75 * smooth(lf * 0.9, lf * 0.9 + 0.25, u + 0.25));
        w = Math.max(0.35, w);
        var nx = -ty / tl * w / 2, ny = tx / tl * w / 2;
        L.push(p[i * 2] + nx, p[i * 2 + 1] + ny); Rr.push(p[i * 2] - nx, p[i * 2 + 1] - ny);
      }
      var gr = g.createLinearGradient(p[0], p[1], p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
      gr.addColorStop(0, rgba(f.c0, A)); gr.addColorStop(1, rgba(f.c1, A));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(L[0], L[1]);
      for (i = 1; i < n; i++) g.lineTo(L[i * 2], L[i * 2 + 1]);
      for (i = n - 1; i >= 0; i--) g.lineTo(Rr[i * 2], Rr[i * 2 + 1]);
      g.closePath(); g.fill();
    }

    // ending early: the stroke fades out over `t` seconds from now
    function endAt(f, t) { if (f.cut >= 0 && f.life <= f.age + t) return; f.cut = f.age; f.life = Math.min(f.life, f.age + t); }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function local(e) { var r = panel.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    function onEnter(e) {
      if (e.pointerType === 'touch') return;
      if (!W) size();
      var p = local(e);
      if (!ptr.inside && ptr.act < 0.05) { ptr.sx = p[0]; ptr.sy = p[1]; ptr.vx = ptr.vy = 0; }
      ptr.x = p[0]; ptr.y = p[1]; ptr.inside = true; kick();
    }
    function onMove(e) {
      if (e.pointerType === 'touch') return;
      if (!ptr.inside) { onEnter(e); return; }
      var p = local(e); ptr.x = p[0]; ptr.y = p[1]; kick();
    }
    function onLeave(e) { if (e.pointerType === 'touch') return; ptr.inside = false; curls.forEach(function (f) { endAt(f, 0.5); }); kick(); }

    size();
    var rz; function onResize() { clearTimeout(rz); rz = setTimeout(size, 120); }
    panel.addEventListener('pointerenter', onEnter);
    panel.addEventListener('pointermove', onMove);
    panel.addEventListener('pointerleave', onLeave);
    addEventListener('resize', onResize);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);

    return function destroy() {
      if (raf) cancelAnimationFrame(raf);
      panel.removeEventListener('pointerenter', onEnter);
      panel.removeEventListener('pointermove', onMove);
      panel.removeEventListener('pointerleave', onLeave);
      removeEventListener('resize', onResize);
      wrap.remove();
    };
  }
  window.initDesignSurface = initDesignSurface;
})();
