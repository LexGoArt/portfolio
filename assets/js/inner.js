/* Inner pages: typed heading (operations), cursor preview for the index, videos that play only in view. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // operations: the title types itself in like a cell being filled
  const ty = document.querySelector('[data-type]');
  // arriving through a view transition the word is already there: no retyping
  if (ty && !reduce && !document.documentElement.classList.contains('vt')) {
    const full = ty.textContent; ty.textContent = '';
    let i = 0; const step = () => { ty.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(step, 55 + Math.random() * 45); };
    setTimeout(step, 250);
  }

  // index preview that trails the cursor on a spring
  const list = document.querySelector('[data-preview]');
  const peek = document.querySelector('.peek');
  // It sits on the right of the list, level with the hovered row, so it never covers a title or description.
  // A new picture wipes in from the direction the pointer came from.
  if (list && peek && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let front = peek.querySelector('img');
    let back = front.cloneNode(); peek.appendChild(back);
    const PW = peek.offsetWidth || 220, PH = PW * 10 / 16;
    let x = 0, y = 0, tx = 0, ty2 = 0, s = 0.96, raf = 0, on = false, last = 0, row = null;
    const target = (a, cx) => {
      const L = list.getBoundingClientRect(), r = a.getBoundingClientRect();
      tx = L.right - PW;   // parked in the empty right end of the row, never over a description
      ty2 = r.top + r.height / 2 - PH / 2;
    };
    const place = () => { peek.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${Math.max(-3, Math.min(3, (tx - x) * 0.03))}deg) scale(${s})`; };
    const loop = now => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      const k = 1 - Math.pow(1 - 0.16, dt * 60);
      x += (tx - x) * k; y += (ty2 - y) * k; s += ((on ? 1 : 0.96) - s) * k;
      place();
      if (Math.abs(tx - x) > 0.5 || Math.abs(ty2 - y) > 0.5 || Math.abs((on ? 1 : 0.96) - s) > 0.002) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; }
    };
    const swap = (src, down) => {
      if (front.getAttribute('src') === src) return;
      back.src = src;
      peek.appendChild(back);   // on top
      if (!reduce) back.animate([{ clipPath: down ? 'inset(100% 0 0 0)' : 'inset(0 0 100% 0)' }, { clipPath: 'inset(0)' }], { duration: 220, easing: 'cubic-bezier(.23,1,.32,1)' });
      [front, back] = [back, front];
    };
    list.querySelectorAll('a[data-img]').forEach(a => {
      a.addEventListener('mouseenter', e => {
        const down = !row || row.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING;
        row = a; swap(a.dataset.img, down); target(a, e.clientX);
        if (!on && !peek.classList.contains('on')) { x = tx; y = ty2; s = 0.96; }
        on = true; peek.classList.add('on');
        if (reduce) { x = tx; y = ty2; s = 1; place(); return; }
        if (!raf) raf = requestAnimationFrame(loop);
      });
      a.addEventListener('mousemove', e => { target(a, e.clientX); if (!reduce && !raf) raf = requestAnimationFrame(loop); });
      a.addEventListener('mouseleave', () => { on = false; peek.classList.remove('on'); if (!reduce && !raf) raf = requestAnimationFrame(loop); });
    });
    list.addEventListener('mouseleave', () => { row = null; });
  }

  // videos: play in view, pause out of view
  const vids = document.querySelectorAll('video[data-auto]');
  if (vids.length) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting && !reduce) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause();
    }), { threshold: 0.35 });
    vids.forEach(v => io.observe(v));
  }
})();
