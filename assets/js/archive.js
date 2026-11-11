/* Midjourney studies, 2023 and 2024, shown as one contact strip of six: square frames, one size, no categories.
   Curated: only frames without generated lettering (models of that time wrote fake words on packs and screens). */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = document.querySelector('[data-archive]');
  if (!box) return;
  const IDS = ['ai-07','packaging-07','print-06','styling-07','styling-13','photography-00'];
  const base = '../assets/img/ai/';
  const label = c => (window.I18N && I18N.t('cat_' + c)) || c;
  IDS.forEach(id => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tile'; b.dataset.cat = id.split('-')[0];
    b.innerHTML = '<img loading="lazy" decoding="async" alt="">';
    const img = b.querySelector('img');
    img.addEventListener('load', () => img.classList.add('ok'));
    img.src = base + id + '.jpg';
    box.appendChild(b);
  });
  const tiles = [...box.children];
  function caps() { tiles.forEach(t => { t.querySelector('img').alt = label(t.dataset.cat) + ', Midjourney'; }); }
  caps(); document.addEventListener('langchange', caps);

  // lightbox
  const dlg = document.querySelector('.lightbox');
  const big = dlg.querySelector('img'), cap = dlg.querySelector('.lb-c');
  let cur = 0;
  const visible = () => tiles;
  // the next picture is decoded before it replaces the current one, so there is never a blank frame
  let want = '';
  function show(i, quiet) {
    const v = visible(); cur = (i + v.length) % v.length; const t = v[cur];
    const src = t.querySelector('img').src, alt = t.querySelector('img').alt; want = src;
    const put = () => {
      if (want !== src) return;
      if (!quiet) { big.style.animation = 'none'; void big.offsetWidth; big.style.animation = ''; }
      big.src = src; big.alt = alt;
    };
    const n = new Image(); n.src = src;
    (n.decode ? n.decode() : Promise.resolve()).then(put, put);
    cap.textContent = String(cur + 1).padStart(2, '0') + ' / ' + String(v.length).padStart(2, '0') + '  ·  Midjourney';
  }
  tiles.forEach(t => t.addEventListener('click', () => { show(visible().indexOf(t)); dlg.showModal(); }));
  // closing fades out instead of vanishing
  const close = () => { if (reduce || !dlg.animate) return dlg.close(); try { dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', pseudoElement: '::backdrop' }); } catch (e) {}
    dlg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out' }).finished.then(() => dlg.close()); };
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  dlg.querySelector('.lb-x').addEventListener('click', close);
  dlg.querySelector('.lb-p').addEventListener('click', e => { e.stopPropagation(); show(cur - 1, true); });
  dlg.querySelector('.lb-n').addEventListener('click', e => { e.stopPropagation(); show(cur + 1, true); });
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') show(cur + 1, true); if (e.key === 'ArrowLeft') show(cur - 1, true); });
  let sx = 0; dlg.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1), true); });
})();
