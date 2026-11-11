/* Home gate: three doors.
   - Each door tracks the cursor into --mx/--my, so its surface (grid / code / colour dots) lights up under the pointer only.
   - Operations: a grid, and a selected cell that steps from cell to cell under the pointer.
   - AI: characters are written where the light passes, hold, and fade when it leaves. The word is aidots.js.
   - Design: design-surface.js.
   - First visit in a session: each word arrives in its own voice (typed, born in dots, swept with ink).
   - Clicking a door: the other two peel away, the word carries into the next page (view transition). */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;
  let seen = false;
  try { seen = !!sessionStorage.getItem('m-seen'); sessionStorage.setItem('m-seen', '1'); } catch (e) {}
  if (seen || reduce) root.classList.add('seen');
  const ease = (c, dt) => 1 - Math.pow(1 - c, dt * 60);   // per-frame constant tuned at 60 Hz, same feel at 120 Hz

  const doors = [...document.querySelectorAll('.d3')];
  doors.forEach(d => {
    const ops = d.classList.contains('d3--ops');
    d.addEventListener('pointermove', e => {
      const r = d.getBoundingClientRect();
      if (!ops) {   // operations trails on its own spring below
        d.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        d.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }
    });
    // touch: the surface flashes under the finger while the page lets go
    d.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      const r = d.getBoundingClientRect();
      d.style.setProperty('--mx', (e.clientX - r.left) + 'px'); d.style.setProperty('--my', (e.clientY - r.top) + 'px');
      d.classList.add('touch-on');
    });
    d.addEventListener('pointercancel', () => d.classList.remove('touch-on'));
    d.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      d.classList.add('chosen');
      // doors after the chosen one leave a beat later, so they peel away from it
      let k = 0; doors.forEach(o => { if (o !== d) o.style.transitionDelay = (doors.indexOf(o) > doors.indexOf(d) ? 40 + 40 * k++ : 0) + 'ms'; });
      root.classList.add('leaving');
      try { sessionStorage.setItem('m-door-t', Date.now()); } catch (er) {}
      setTimeout(() => { location.href = d.href; }, reduce ? 40 : 240);
    });
  });
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    root.classList.remove('leaving');
    doors.forEach(d => { d.classList.remove('chosen', 'touch-on'); d.style.transitionDelay = ''; });
  });

  /* ---------- first arrival: Operations types itself in, Design takes one ink sweep ---------- */
  const opsWord = document.querySelector('.d3--ops .d3-word');
  if (opsWord && !root.classList.contains('seen')) {
    const full = opsWord.textContent, door = opsWord.closest('.d3');
    opsWord.textContent = ''; door.classList.add('typing');
    let i = 0;
    const step = () => {
      opsWord.textContent = full.slice(0, ++i);
      if (i < full.length) setTimeout(step, 28);
      else setTimeout(() => door.classList.remove('typing'), 260);   // the caret leaves with the last letter
    };
    // wait for the mono face (max 300ms) so no letter is drawn in the fallback font
    const go = () => setTimeout(step, 60);
    Promise.race([document.fonts ? document.fonts.load('500 1em "IBM Plex Mono"') : Promise.resolve(), new Promise(r => setTimeout(r, 300))]).then(go, go);
  }
  const desDoorEl = document.querySelector('.d3--des');
  if (desDoorEl && !root.classList.contains('seen')) {
    desDoorEl.classList.add('sweep');
    const w = desDoorEl.querySelector('.d3-word');
    // finished on its own: settle back without a second sweep (no transition from the held end frame)
    desDoorEl.addEventListener('animationend', () => {
      if (!desDoorEl.classList.contains('sweep')) return;
      if (w) w.style.transition = 'none';
      desDoorEl.classList.remove('sweep');
      if (w) { void w.offsetWidth; w.style.transition = ''; }
    }, { once: true });
    // a hover takes over at once and glides from wherever the sweep is
    desDoorEl.addEventListener('pointerenter', () => desDoorEl.classList.remove('sweep'), { once: true });
  }

  /* ---------- Operations: a selected cell that steps across the grid ---------- */
  const opsDoor = document.querySelector('.d3--ops');
  if (opsDoor && fine) {
    const cell = document.createElement('span'); cell.className = 'd3-cell'; cell.setAttribute('aria-hidden', 'true');
    opsDoor.prepend(cell);
    const CW = 96, CH = 32;
    const p = { x: 0, y: 0, sx: 0, sy: 0, inside: false, cx: -1, cy: -1 };
    let raf = 0, last = 0;
    const frame = now => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      const k = 1 - Math.exp(-dt * 14);
      p.sx += (p.x - p.sx) * k; p.sy += (p.y - p.sy) * k;
      opsDoor.style.setProperty('--mx', p.sx.toFixed(1) + 'px');
      opsDoor.style.setProperty('--my', p.sy.toFixed(1) + 'px');
      const cx = Math.floor(p.sx / CW), cy = Math.floor(p.sy / CH);
      if (cx !== p.cx || cy !== p.cy) { p.cx = cx; p.cy = cy; cell.style.transform = `translate(${cx * CW - 1}px, ${cy * CH - 1}px)`; }
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 0.5) raf = requestAnimationFrame(frame); else last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    opsDoor.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      const r = opsDoor.getBoundingClientRect();
      p.x = p.sx = e.clientX - r.left; p.y = p.sy = e.clientY - r.top; p.inside = true;
      p.cx = Math.floor(p.sx / CW); p.cy = Math.floor(p.sy / CH);
      cell.style.transition = 'none';
      cell.style.transform = `translate(${p.cx * CW - 1}px, ${p.cy * CH - 1}px)`;
      void cell.offsetWidth; cell.style.transition = '';
      kick();
    });
    opsDoor.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      const r = opsDoor.getBoundingClientRect(); p.x = e.clientX - r.left; p.y = e.clientY - r.top; kick();
    });
    opsDoor.addEventListener('pointerleave', () => { p.inside = false; kick(); });
  }

  /* ---------- AI door: code written under the pointer ----------
     A character is chosen when the light first reaches a cell, holds while lit, and fades when the light moves on.
     Mostly plus and minus, with a little code punctuation. */
  const aiDoor = document.querySelector('.d3--ai');
  if (aiDoor && fine) {
    const cv = document.createElement('canvas'); cv.className = 'd3-code'; cv.setAttribute('aria-hidden', 'true');
    aiDoor.prepend(cv);
    const ctx = cv.getContext('2d');
    const CH = '++++----++--=<>/{}();01*_'.split('');
    const CELL = 18, R = 230;
    let W = 0, H = 0, cols = 0, rows = 0, cells = [], raf = 0, last = 0, hole = null;
    const ptr = { x: -999, y: -999, sx: -999, sy: -999, a: 0, ta: 0 };
    const pick = () => CH[(Math.random() * CH.length) | 0];
    function size() {
      const r = aiDoor.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
      cells = Array.from({ length: cols * rows }, () => ({ c: pick(), h: 0 }));
      // keep the dotted word clean: no characters behind it
      const w = aiDoor.querySelector('.d3-t--ai');
      if (w) { const q = w.getBoundingClientRect(); hole = { x0: q.left - r.left - 12, y0: q.top - r.top - 12, x1: q.right - r.left + 12, y1: q.bottom - r.top + 12 }; }
    }
    function frame(now) {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      const kp = ease(0.2, dt), ka = ease(0.1, dt), kU = ease(0.2, dt), kD = ease(0.06, dt);
      ptr.sx += (ptr.x - ptr.sx) * kp; ptr.sy += (ptr.y - ptr.sy) * kp; ptr.a += (ptr.ta - ptr.a) * ka;
      ctx.clearRect(0, 0, W, H);
      ctx.font = '500 12px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let busy = Math.abs(ptr.ta - ptr.a) > 0.004 || Math.abs(ptr.x - ptr.sx) > 0.3 || Math.abs(ptr.y - ptr.sy) > 0.3;   // run only while something still converges
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
        if (hole && x > hole.x0 && x < hole.x1 && y > hole.y0 && y < hole.y1) continue;
        const k = cells[j * cols + i];
        const d = Math.hypot(x - ptr.sx, y - ptr.sy), tgt = ptr.a * Math.max(0, 1 - d / R) ** 1.6;
        const was = k.h;
        k.h += (tgt - k.h) * (tgt > k.h ? kU : kD);
        if (was < 0.05 && k.h >= 0.05 && tgt > was) k.c = pick();   // written once, as the light arrives
        if (Math.abs(tgt - k.h) > 0.005) busy = true;
        if (k.h < 0.01) continue;
        ctx.fillStyle = `rgba(31,61,255,${(k.h * 0.75).toFixed(3)})`;
        ctx.fillText(k.c, x, y);
      }
      if (busy) raf = requestAnimationFrame(frame); else last = 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    aiDoor.addEventListener('pointermove', e => {
      if (!W) size();
      const r = aiDoor.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
      if (ptr.sx < -900) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
      ptr.ta = 1; kick();
    });
    aiDoor.addEventListener('pointerleave', () => { ptr.ta = 0; kick(); });
    let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(size, 120); });
    size();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  }

  /* ---------- Design door: dots and flourishes (design-surface.js) ---------- */
  const desDoor = document.querySelector('.d3--des');
  if (desDoor && window.initDesignSurface) window.initDesignSurface(desDoor);
})();
