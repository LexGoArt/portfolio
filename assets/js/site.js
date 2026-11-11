/* Shared behaviour: bar background on scroll, reveal on scroll, language switch. */
(function () {
  document.documentElement.classList.add('js');
  // arriving from a door on the home page: the word is carried over by a view transition, so nothing replays
  try {
    const t = +sessionStorage.getItem('m-door-t'); sessionStorage.removeItem('m-door-t');
    if (t && Date.now() - t < 4000 && 'CSSViewTransitionRule' in window) document.documentElement.classList.add('vt');
  } catch (e) {}
  const bar = document.getElementById('bar');
  if (bar) {
    const on = () => bar.classList.toggle('on-scroll', scrollY > 24);
    addEventListener('scroll', on, { passive: true }); on();
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.rv').forEach((el, i) => {
    // siblings in the same row stagger by 60ms
    const sib = [...el.parentElement.children].filter(c => c.classList.contains('rv'));
    el.style.transitionDelay = Math.min(sib.indexOf(el), 3) * 50 + 'ms';
    io.observe(el);
  });

  const langs = document.querySelector('.langs');
  if (langs && window.I18N) {
    ['en', 'pl', 'ru'].forEach(l => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = l.toUpperCase(); b.dataset.l = l;
      b.setAttribute('aria-label', { en: 'English', pl: 'Polski', ru: 'Русский' }[l]);
      b.addEventListener('click', () => I18N.set(l));
      langs.appendChild(b);
    });
    I18N.init();
  }
})();
