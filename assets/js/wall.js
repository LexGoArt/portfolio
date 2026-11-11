/* Wall of work: hover video, live demos in the tile, before/after, fullscreen viewer.
   3D models live in wall3d.js (module, loads three.js only when a model scrolls near). */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const t = (k, d) => (window.I18N && I18N.t(k)) || d;
  const ICON = {
    play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
    touch: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V3.2a1.2 1.2 0 0 1 2.4 0V7.5m0-.6a1.2 1.2 0 0 1 2.4 0v1m0-.4a1.2 1.2 0 0 1 2.2.7V11a4 4 0 0 1-4 4H8.4a4 4 0 0 1-3.3-1.7L3 10.2a1.2 1.2 0 0 1 1.9-1.4L6 10"/></svg>',
    full: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg>',
    shrink: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/></svg>',
    out: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v4H2.5V4h4"/></svg>',
    x: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>',
    l: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg>',
    r: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l5 5-5 5"/></svg>',
    lr: '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5 2 10l5 5M13 5l5 5-5 5"/></svg>',
    rot: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8A5.5 5.5 0 1 1 11 3.4M13.5 2v3.5H10"/></svg>',
    zoom: '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 14 14M7 5v4M5 7h4"/></svg>'
  };
  window.WALL_ICON = ICON;

  function chip(el, icon, key, dflt) {
    if (el.querySelector('.chip')) return;
    const c = document.createElement('span');
    c.className = 'chip'; c.innerHTML = ICON[icon] + '<span data-i="' + key + '"></span>';
    c.lastChild.textContent = t(key, dflt);
    el.appendChild(c);
  }
  function relabel() { document.querySelectorAll('.chip [data-i], .go [data-i]').forEach(s => { s.textContent = t(s.dataset.i, s.textContent); }); }
  document.addEventListener('langchange', relabel);

  /* ---------- fullscreen viewer: images and videos, grouped by data-group ---------- */
  const dlg = document.createElement('dialog');
  dlg.className = 'viewer';
  dlg.innerHTML = '<div class="vw-stage"></div><p class="vw-c" aria-live="polite"></p>' +
    '<button class="ib vw-x" type="button" aria-label="Close">' + ICON.x + '</button>' +
    '<button class="ib vw-p" type="button" aria-label="Previous">' + ICON.l + '</button>' +
    '<button class="ib vw-n" type="button" aria-label="Next">' + ICON.r + '</button>';
  document.body.appendChild(dlg);
  const stage = dlg.querySelector('.vw-stage'), cap = dlg.querySelector('.vw-c');
  let list = [], cur = 0;
  function itemOf(el) {
    const v = el.dataset.video, img = el.querySelector('img');
    const title = el.closest('.t') && el.closest('.t').querySelector('.tc h3');
    return { video: v, src: el.dataset.full || (img && (img.currentSrc || img.src)), alt: img ? img.alt : '', cap: el.dataset.cap ? t(el.dataset.cap, '') : (title ? title.textContent : (img ? img.alt : '')) };
  }
  function show(i) {
    cur = (i + list.length) % list.length;
    const it = itemOf(list[cur]);
    stage.querySelectorAll('video').forEach(v => v.pause());
    stage.textContent = '';
    if (it.video) {
      const v = document.createElement('video');
      v.src = it.video; v.controls = true; v.playsInline = true; v.autoplay = true;
      if (list[cur].dataset.poster) v.poster = list[cur].dataset.poster;
      stage.appendChild(v); v.play().catch(() => {});
    } else {
      const im = new Image(); im.alt = it.alt; im.decoding = 'async'; im.src = it.src; stage.appendChild(im);
    }
    cap.textContent = it.cap + (list.length > 1 ? '   ' + (cur + 1) + ' / ' + list.length : '');
  }
  function open(el) {
    const g = el.dataset.group;
    list = g ? [...document.querySelectorAll('[data-view][data-group="' + g + '"]')] : [el];
    dlg.classList.toggle('single', list.length < 2);
    show(list.indexOf(el)); dlg.showModal();
  }
  function close() {
    const done = () => { stage.querySelectorAll('video').forEach(v => v.pause()); dlg.close(); stage.textContent = ''; };
    if (reduce || !dlg.animate) return done();
    dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' }).finished.then(done);
  }
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.querySelector('.vw-x').addEventListener('click', close);
  dlg.querySelector('.vw-p').addEventListener('click', () => show(cur - 1));
  dlg.querySelector('.vw-n').addEventListener('click', () => show(cur + 1));
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target === stage) close(); });
  dlg.addEventListener('keydown', e => { if (list.length > 1 && e.key === 'ArrowRight') show(cur + 1); if (list.length > 1 && e.key === 'ArrowLeft') show(cur - 1); });
  let sx = 0;
  dlg.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (list.length > 1 && Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1)); });

  // hover videos open full screen too
  document.querySelectorAll('.hv').forEach(el => { el.setAttribute('data-view', ''); const v = el.querySelector('video'); if (!el.dataset.video) el.dataset.video = v.getAttribute('src'); if (!el.dataset.poster) { const p = el.querySelector('.poster'); if (p) el.dataset.poster = p.getAttribute('src'); } });
  // per-language alt text (the studies)
  function alts() { const l = window.I18N ? I18N.lang : 'en'; document.querySelectorAll('[data-alt-en]').forEach(el => { const im = el.querySelector('img'); if (im) im.alt = (el.dataset['alt' + l[0].toUpperCase() + l.slice(1)] || el.dataset.altEn) + ', Midjourney'; }); }
  alts(); document.addEventListener('langchange', alts);
  document.querySelectorAll('[data-view]').forEach(el => {
    if (el.tagName !== 'BUTTON' && el.tagName !== 'A') { el.setAttribute('role', 'button'); el.tabIndex = 0; }
    el.addEventListener('click', e => { e.preventDefault(); open(el); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } });
    if (!el.classList.contains('hv') && !el.closest('.studies')) chip(el, 'zoom', 'chipZoom', 'Open');
  });

  /* ---------- hover video: plays under the pointer; on touch it plays while on screen ---------- */
  const hv = [...document.querySelectorAll('.hv')];
  hv.forEach(el => {
    const v = el.querySelector('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
    chip(el, 'play', fine ? 'chipHover' : 'chipTap', fine ? 'Plays on hover' : 'Tap to open');
    const play = () => { if (reduce) return; v.play().then(() => el.classList.add('on')).catch(() => {}); };
    const stop = () => { v.pause(); el.classList.remove('on'); };
    if (fine) { el.addEventListener('pointerenter', play); el.addEventListener('pointerleave', stop); el.addEventListener('focus', play); el.addEventListener('blur', stop); }
    el._play = play; el._stop = stop;
  });
  if (!fine && hv.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { e.isIntersecting && e.intersectionRatio > .6 ? e.target._play() : e.target._stop(); }), { threshold: [0, .6] });
    hv.forEach(el => io.observe(el));
  }

  /* ---------- live demo: poster first, the real page loads only on request ---------- */
  document.querySelectorAll('.demo').forEach(el => {
    const L = () => (window.I18N ? I18N.lang : 'en'); const url0 = el.dataset.demo; let url = url0.replace('{lang}', L()); const title = el.dataset.title || 'Live demo';
    const go = document.createElement('button');
    go.type = 'button'; go.className = 'go';
    go.innerHTML = ICON.touch + '<span data-i="tryLive">' + t('tryLive', 'Try it live') + '</span>';
    const bar = document.createElement('div'); bar.className = 'bar';
    bar.innerHTML = '<button class="ib" type="button" data-a="full" aria-label="Full screen">' + ICON.full + '</button>' +
      '<a class="ib" target="_blank" rel="noopener" aria-label="Open in a new tab" href="' + url + '">' + ICON.out + '</a>';
    el.append(go, bar);
    let fr = null;
    go.addEventListener('click', () => {
      if (el.dataset.ls) { try { el.dataset.ls.split(';').forEach(p => { const [k, v] = p.split('='); localStorage.setItem(k, v === '$lang' ? (window.I18N ? I18N.lang : 'en') : v); }); } catch (e) {} }
      url = url0.replace('{lang}', L()); bar.querySelector('a').href = url;
      fr = document.createElement('iframe');
      fr.src = url; fr.title = title; fr.loading = 'eager';
      fr.setAttribute('allow', 'fullscreen; clipboard-write');
      fr.addEventListener('load', () => el.classList.add('live'), { once: true });
      setTimeout(() => el.classList.add('live'), 2500);
      el.insertBefore(fr, go);
      go.disabled = true;
      // on a phone a live page in a small tile is unusable: open it full screen straight away
      if (!fine) setFull(true);
    });
    const fb = bar.querySelector('[data-a=full]');
    const setFull = on => {
      el.classList.toggle('full', on); document.documentElement.classList.toggle('demo-open', on);
      fb.innerHTML = on ? ICON.shrink : ICON.full; fb.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    };
    fb.addEventListener('click', () => setFull(!el.classList.contains('full')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('full')) setFull(false); });
  });

  document.querySelectorAll('.m3d').forEach(el => chip(el, 'rot', 'chip3d', fine ? 'Drag to turn' : 'Swipe sideways to turn'));

  /* ---------- before / after ---------- */
  document.querySelectorAll('.ba').forEach(el => {
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = 100; r.value = 50; r.step = 1;
    r.setAttribute('aria-label', el.dataset.label || 'Before and after');
    el.insertAdjacentHTML('beforeend', '<span class="rule"></span><span class="knob">' + ICON.lr + '</span>');
    el.prepend(r);
    const set = p => { el.style.setProperty('--x', p + '%'); r.value = p; };
    r.addEventListener('input', () => set(+r.value));
    let drag = false;
    const at = x => { const b = el.getBoundingClientRect(); set(Math.max(0, Math.min(100, (x - b.left) / b.width * 100))); };
    el.addEventListener('pointerdown', e => { drag = true; el.classList.add('drag'); el.setPointerCapture(e.pointerId); at(e.clientX); });
    el.addEventListener('pointermove', e => { if (drag) at(e.clientX); else if (fine && e.pointerType === 'mouse' && el.dataset.follow != null) at(e.clientX); });
    const end = () => { drag = false; el.classList.remove('drag'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    // a short nudge the first time it scrolls into view, so it reads as a slider
    if (!reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return; io.disconnect();
        const t0 = performance.now();
        const step = now => { const k = Math.min(1, (now - t0) / 1400); set(50 + Math.sin(k * Math.PI * 2) * 14 * (1 - k)); if (k < 1 && !drag) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }), { threshold: .6 });
      io.observe(el);
    }
  });
})();
