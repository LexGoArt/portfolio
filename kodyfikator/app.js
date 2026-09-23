'use strict';
const C = window.CODEX;

/* висота клітинки читається раз і на resize — не getComputedStyle щокадру */
let IH = 52;
const readIH = () => { IH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--item-h')) || 52; };
readIH(); addEventListener('resize', readIH);
const ITEM = () => IH;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;   // без розмазування

/* ─── розряди коду ────────────────────────────────────────── */
const SPEC = [
  {k:'d1', n:4,   pad:1, dot:'підрозділ', label:'Підрозділ'},
  {sep:'.'},
  {k:'d2', n:10,  pad:1, dot:'проєкт',    label:'Проєкт'},
  {sep:'.'},
  {k:'d3', n:10,  pad:1, dot:'об’єкт',    label:'Об’єкт'},
  {sep:'·', gap:1},
  {k:'u',  n:100, pad:2, dot:'облік',     label:'Об’єкт обліку'},
  {sep:'·', gap:1},
  {k:'dv', n:3,   pad:1, dot:'д/в',       label:'Дохід чи витрата'},
  {sep:'.'},
  {k:'v',  n:10,  pad:1, dot:'вид',       label:'Вид'},
  {sep:'.'},
  {k:'p',  n:10,  pad:1, dot:'підвид',    label:'Підвид'},
  {sep:'.'},
  {k:'s',  n:100, pad:2, dot:'стаття',    label:'Стаття'},
];

const S = {d1:1, d2:1, d3:0, u:0, dv:2, v:3, p:1, s:15};

/* ─── довідники ───────────────────────────────────────────── */
const projKeys = Object.keys(C.projects);
const unitOf = pk => (C.projects[pk] || {}).unit || null;

function unitLabel(pk, n){
  const real = C.umap[pk];                       // реальні об'єкти з реєстру активів
  if (real && real[n] !== undefined) return real[n];
  const u = C.units[unitOf(pk) || 'null'];
  if (!u) return null;
  if (n === 0) return 'проєкт у цілому';
  if (real) return null;                         // реєстр є — вигадувати номери не можна
  if (u.free && n > 0) return u.free.replace('%d', n);
  return null;
}
function unitTitle(pk){
  const u = C.units[unitOf(pk) || 'null'];
  return (u && u.label) || 'Об’єкт обліку';
}

function exists(key, val, st){
  const s = Object.assign({}, st); s[key] = val;
  switch (key){
    case 'd1': return !!C.divisions[val];
    case 'd2': return projKeys.some(k => k.startsWith(s.d1 + '.' + val + '.'));
    case 'd3': return !!C.projects[s.d1 + '.' + s.d2 + '.' + val];
    case 'u':  return unitLabel(s.d1 + '.' + s.d2 + '.' + s.d3, val) !== null;
    /* дохід: будівельні, комерційні та активи (продаж землі йде від активу);
       адміністративні — лише витрата */
    case 'dv': return val === 1 ? (s.d1 >= 1 && s.d1 <= 3) : val === 2;
    case 'v':  return !!C.vyd[s.dv + '.' + val];
    case 'p':  return !!C.items[s.dv + '.' + s.v + '.' + val];
    case 's':  { const L = C.items[s.dv + '.' + s.v + '.' + s.p];
                 return !!(L && L.some(x => x.n === val)); }
  }
  return false;
}

/* exists() для розряду залежить лише від «старших» розрядів — рахуємо весь
   стовпчик разом і кешуємо, поки ця частина стану не зміниться. */
const EXDEP = {d1:[], d2:['d1'], d3:['d1','d2'], u:['d1','d2','d3'], dv:['d1'], v:['dv'], p:['dv','v'], s:['dv','v','p']};
const existsCache = {};
function existsArr(key, n, st){
  const deps = EXDEP[key];
  const sig = deps.length ? deps.map(d => st[d]).join(',') : '';
  let c = existsCache[key];
  if (!c || c.sig !== sig){
    const arr = new Array(n);
    for (let i = 0; i < n; i++) arr[i] = exists(key, i, st);
    c = {sig, arr}; existsCache[key] = c;
  }
  return c.arr;
}

/* ─── барабан ─────────────────────────────────────────────── */
const POOL = 7;
class Col {
  constructor(spec, host){
    this.k = spec.k; this.n = spec.n; this.pad = spec.pad; this.label = spec.label;
    this.pos = 0; this.vel = 0; this.tw = null; this.drag = false;
    const el = document.createElement('div');
    el.className = 'col' + (spec.pad === 2 ? ' wide' : '');
    el.setAttribute('role', 'spinbutton');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', spec.label);
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', String(spec.n - 1));
    this.layers = [];
    for (let L = 0; L < 3; L++){
      const lay = document.createElement('div');
      lay.className = L === 0 ? 'stack' : 'echo';
      lay.setAttribute('aria-hidden', 'true');     // цифри озвучує aria-valuetext, а не 21 клітинка
      lay.cells = [];
      for (let i = 0; i < POOL; i++){
        const c = document.createElement('div'); c.className = 'cell';
        lay.appendChild(c); lay.cells.push(c);
      }
      el.appendChild(lay); this.layers.push(lay);
    }
    const dot = document.createElement('div'); dot.className = 'dot'; dot.textContent = spec.dot;
    dot.setAttribute('aria-hidden', 'true');
    el.appendChild(dot); this.dotEl = dot;
    host.appendChild(el); this.el = el;

    el.addEventListener('wheel', e => {
      e.preventDefault(); setActive(this);
      let raw = e.deltaY || e.deltaX;             // shift+коліщатко/трекпад шле горизонталь
      if (e.deltaMode === 1) raw *= 16;            // DOM_DELTA_LINE (Firefox тощо) → приблизно px
      else if (e.deltaMode === 2) raw *= ITEM();   // DOM_DELTA_PAGE — рідкість, теж переводимо у px
      const d = Math.abs(raw) > 40 ? raw * 0.0016 : raw * 0.0042;
      this.tw = null; this.vel = clamp(this.vel + d, -1.1, 1.1);
      wake();
    }, {passive:false});

    let py = 0, lt = 0;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;                 // лише основна кнопка миші / дотик, не правий клік
      setActive(this); this.drag = true; this.tw = null; this.vel = 0;
      py = e.clientY; lt = performance.now(); el.setPointerCapture(e.pointerId);
      wake();
    });
    el.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const dy = e.clientY - py, dt = Math.max(performance.now() - lt, 8);
      this.pos -= dy / ITEM(); this.vel = -(dy / ITEM()) / dt * 16;
      py = e.clientY; lt = performance.now();
    });
    const up = () => { this.drag = false; wake(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);

    el.addEventListener('focus', () => setActive(this));
    el.addEventListener('keydown', e => {
      const i = cols.indexOf(this);
      switch (e.key){
        case 'ArrowUp':   this.step(-1); break;
        case 'ArrowDown': this.step(1); break;
        case 'PageUp':    this.step(-10); break;
        case 'PageDown':  this.step(10); break;
        case 'Home':      this.goto(0, true); break;
        case 'End':       this.goto(this.n - 1, true); break;
        case 'ArrowLeft':  cols[(i - 1 + cols.length) % cols.length].el.focus(); break;
        case 'ArrowRight': cols[(i + 1) % cols.length].el.focus(); break;
        default: return;
      }
      e.preventDefault(); e.stopPropagation();
    });
  }
  get val(){ return clamp(Math.round(this.pos), 0, this.n - 1); }
  goto(v, soft){
    this.drag = false;                              // програмний перехід скасовує активний drag
    this.tw = clamp(v, 0, this.n - 1); this.vel = 0;
    if (!soft) this.pos = this.tw;
    wake();
  }
  step(d){
    this.drag = false;
    const base = this.tw !== null ? this.tw : Math.round(this.pos);   // швидкі повтори накопичуються
    this.tw = clamp(base + d, 0, this.n - 1); this.vel = 0;
    wake();
  }

  tick(){
    if (this.tw !== null){
      this.pos += (this.tw - this.pos) * 0.24;
      if (Math.abs(this.tw - this.pos) < 0.002){ this.pos = this.tw; this.tw = null; }
    } else if (!this.drag){
      this.pos += this.vel; this.vel *= 0.905;
      const max = this.n - 1;
      if (this.pos < 0){ this.pos -= this.pos * 0.35; this.vel *= 0.4; }
      if (this.pos > max){ this.pos -= (this.pos - max) * 0.35; this.vel *= 0.4; }
      if (Math.abs(this.vel) < 0.016){
        this.vel = 0;
        const t = clamp(Math.round(this.pos), 0, max);
        this.pos += (t - this.pos) * 0.2;
        if (Math.abs(t - this.pos) < 0.002) this.pos = t;
      }
    }
  }
  get resting(){ return this.tw === null && !this.drag && this.vel === 0 && this.pos === Math.round(this.pos); }
  paint(st){
    const sp = REDUCED ? 0 : Math.abs(this.vel);
    this.layers[0].style.filter = sp > 0.02 ? `blur(${Math.min(sp * 3.2, 4.2)}px)` : '';
    const ih = ITEM();
    const exArr = existsArr(this.k, this.n, st);
    for (let L = 0; L < 3; L++){
      const lay = this.layers[L];
      const p = this.pos - this.vel * (L === 1 ? 1.0 : L === 2 ? 2.0 : 0);
      if (L > 0){
        const o = Math.min(sp * 1.7, 1) * (L === 1 ? 0.34 : 0.16);
        lay.style.opacity = o.toFixed(3);
        lay.style.filter = `blur(${Math.min(sp * 5 + 1, 7)}px)`;
        if (o < 0.006){ lay.style.visibility = 'hidden'; continue; }
        lay.style.visibility = '';
      }
      const base = Math.round(p), half = (POOL - 1) / 2;
      for (let j = 0; j < POOL; j++){
        const i = base - half + j, cell = lay.cells[j];
        if (i < 0 || i >= this.n){ cell.style.opacity = 0; continue; }
        const dd = i - p, ad = Math.abs(dd);
        cell.textContent = String(i).padStart(this.pad, '0');
        cell.style.transform =
          `translateY(${(dd * ih).toFixed(2)}px) rotateX(${(-dd * 19).toFixed(2)}deg) scale(${(1 - ad * 0.055).toFixed(3)})`;
        cell.style.opacity = Math.max(0, 1 - ad * 0.42).toFixed(3);
        if (L === 0) cell.classList.toggle('off', !exArr[i]);
      }
    }
  }
}
const clamp = (v, a, b) => Number.isFinite(v) ? (v < a ? a : v > b ? b : v) : a;
let last = '', moving = false, settleAt = 0, rafOn = false;   // стан циклу — до першого goto()

/* ─── збірка ──────────────────────────────────────────────── */
const picker = document.getElementById('picker');
picker.setAttribute('role', 'group');
picker.setAttribute('aria-label', 'Розряди коду');
picker.querySelectorAll('.fade, .lens').forEach(x => x.setAttribute('aria-hidden', 'true'));
const cols = [], byKey = {};
SPEC.forEach(sp => {
  if (sp.sep){
    const d = document.createElement('div');
    d.className = 'sep' + (sp.gap ? ' gap' : ''); d.textContent = sp.sep;
    d.setAttribute('aria-hidden', 'true');
    picker.appendChild(d); return;
  }
  const c = new Col(sp, picker); cols.push(c); byKey[sp.k] = c;
});

/* permalink: #1.1.0-02-2.3.1.15 */
const HASH = /^#?(\d)\.(\d)\.(\d)-(\d\d)-(\d)\.(\d)\.(\d)\.(\d\d)$/;
function fromHash(h){
  const m = HASH.exec(h || '');
  if (!m) return null;
  return {d1:+m[1], d2:+m[2], d3:+m[3], u:+m[4], dv:+m[5], v:+m[6], p:+m[7], s:+m[8]};
}
function toHash(st){
  return `#${st.d1}.${st.d2}.${st.d3}-${String(st.u).padStart(2,'0')}-${st.dv}.${st.v}.${st.p}.${String(st.s).padStart(2,'0')}`;
}
const initial = fromHash(location.hash);
if (initial) Object.assign(S, initial);
cols.forEach(c => c.goto(S[c.k]));
addEventListener('hashchange', () => {
  const h = fromHash(location.hash);
  if (h && toHash(S) !== location.hash){ fullSettle = true; Object.entries(h).forEach(([k, v]) => byKey[k].goto(v, true)); }
});

let active = cols[0];
function setActive(c){
  active = c; cols.forEach(x => x.el.classList.toggle('active', x === c));
}
setActive(cols[0]);

/* ─── допоміжні елементи (створюються тут, щоб розмітка лишалась чистою) ── */
const codeEl = document.getElementById('code');
codeEl.setAttribute('aria-live', 'off');

const mirror = document.createElement('button');
mirror.className = 'mirror'; mirror.id = 'mirror'; mirror.type = 'button';
mirror.textContent = '⇄ дзеркало';
mirror.title = 'Той самий код з іншого боку: дохід ↔ витрата';
mirror.setAttribute('aria-label', 'Показати дзеркальний код: дохід або витрата');
const codesRow = document.createElement('div'); codesRow.className = 'codes';
codeEl.parentNode.insertBefore(codesRow, codeEl); codesRow.appendChild(codeEl); codesRow.appendChild(mirror);
mirror.addEventListener('click', () => {
  const to = S.dv === 1 ? 2 : 1;
  if (!exists('dv', to, S)) return;
  fullSettle = true; byKey.dv.goto(to, true);
});

const mReg = document.createElement('div');
mReg.className = 'morph reg'; mReg.id = 'mReg';
mReg.innerHTML = '<span class="cur" id="vReg"></span>';
document.getElementById('mMeta').insertAdjacentElement('afterend', mReg);

const sr = document.createElement('div');                 // озвучка для скрінрідера — лише коли барабани стали
sr.id = 'sr'; sr.setAttribute('aria-live', 'polite'); sr.setAttribute('aria-atomic', 'true');
sr.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
document.body.appendChild(sr);

const toast = document.getElementById('toast');
toast.setAttribute('role', 'status');

/* ─── читалка ─────────────────────────────────────────────── */
let SPEED = 0;                      // поточна швидкість барабанів — керує «розмазуванням»
function morph(wrapId, html, cls){
  const wrap = document.getElementById(wrapId);
  const cur = wrap.querySelector('.cur');
  if (cur.innerHTML === html && (cls === undefined || wrap.className.includes(cls))) return;
  if (cur.innerHTML !== html && cur.innerHTML.trim()){
    const k = Math.min(SPEED * 2.2, 1);          // 0 — крок, 1 — швидке прокручування
    wrap.style.minHeight = wrap.offsetHeight + 'px';   // висота не стрибає, поки йде призрак
    const g = cur.cloneNode(true);
    g.className = 'gh'; g.classList.remove('enter');
    g.setAttribute('aria-hidden', 'true'); g.removeAttribute('id');
    g.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    const dur = Math.round(440 - k * 200);
    g.style.setProperty('--gy', (-(5 + k * 16)).toFixed(1) + 'px');
    g.style.setProperty('--gb', (7 + k * 8).toFixed(1) + 'px');
    g.style.setProperty('--gs', (1.012 + k * 0.03).toFixed(3));
    g.style.setProperty('--go', (0.38 - k * 0.1).toFixed(2));
    g.style.setProperty('--gd', dur + 'ms');
    wrap.appendChild(g);
    setTimeout(() => { g.remove(); if (!wrap.querySelector('.gh')) wrap.style.minHeight = ''; }, dur + 40);
    const gs = wrap.querySelectorAll('.gh');
    if (gs.length > 3) gs[0].remove();
  }
  cur.innerHTML = html;
  if (cls !== undefined) wrap.className = cls;
}

/* коли всі барабани стали — рядки «проявляються» з розмиття, каскадом.
   Повний каскад — після пошуку, дзеркала, посилання чи довгого прокручування;
   після одного кроку — коротка, майже непомітна версія, щоб не втомлювати. */
const SETTLE = [   // id, затримка, тривалість, розмиття, зсув
  ['vKind',   0, 400, 3.5, 4],
  ['vTitle',  55, 580, 10,  8],
  ['vCrumbs',145, 500, 4.5, 6],
  ['vMeta',   215, 440, 3,   5],
  ['vReg',    250, 420, 2.5, 4],
  ['code',    285, 420, 2.5, 4]];
let fullSettle = true, peak = 0;
function settle(){
  const full = fullSettle || peak > 0.09;
  fullSettle = false; peak = 0;
  const f = full ? 1 : 0.5;
  SETTLE.forEach(([id, delay, dur, blur, dy]) => {
    const el = document.getElementById(id);
    if (!el || !el.textContent.trim()) return;
    el.classList.remove('enter'); void el.offsetWidth;
    el.style.setProperty('--edl', Math.round(delay * (full ? 1 : 0.25)) + 'ms');
    el.style.setProperty('--ed',  Math.round(dur * f) + 'ms');
    el.style.setProperty('--eb',  (blur * f).toFixed(1) + 'px');
    el.style.setProperty('--ey',  (dy * f).toFixed(1) + 'px');
    el.classList.add('enter');
  });
  const h = toHash(S);
  if (location.hash !== h) history.replaceState(null, '', h);   // лише на зупинці: Safari лімітує replaceState
  const kind = document.getElementById('vKind').textContent.trim();
  const title = document.getElementById('vTitle').textContent.trim();
  const crumbs = document.getElementById('vCrumbs').textContent.trim().replace(/·/g, ',');
  sr.textContent = `${kind}. ${title}. ${crumbs}. Код ${codeEl.textContent}`;
}
const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

function nearest(list, n){
  let best = null;
  for (const x of list) if (best === null || Math.abs(x.n - n) < Math.abs(best.n - n)) best = x;
  return best;
}

function read(st){
  const pk = st.d1 + '.' + st.d2 + '.' + st.d3;
  const proj = C.projects[pk];
  const div  = C.divisions[st.d1];
  const vg   = C.vyd[st.dv + '.' + st.v];
  const gkey = st.dv + '.' + st.v + '.' + st.p;
  const pgN  = C.pid[gkey];
  const list = C.items[gkey];
  const item = list && list.find(x => x.n === st.s);
  const uL   = unitLabel(pk, st.u);

  const inc = st.dv === 1;
  morph('mKind', vg || item
      ? `<span class="dot"></span>${inc ? 'дохід' : 'витрата'}`
      : `<span class="dot"></span>вільний код`,
    'morph kind ' + (vg || item ? (inc ? 'inc' : 'exp') : ''));

  morph('mTitle', item ? esc(item.name) : '—',
    'morph title' + (item ? '' : ' void'));

  const cr = [];
  if (div)  cr.push(esc(div.name));
  if (proj) cr.push('<b>' + esc(proj.name) + '</b>');
  else if (st.d2 || st.d3) cr.push('<span class="void">проєкт не заведено</span>');
  if (uL && st.u !== 0) cr.push(esc(uL));
  if (vg)  cr.push(esc(vg.name));
  if (pgN) cr.push(esc(pgN));
  if (!item){                                   // порожній код — підказати найближчий існуючий
    if (list && list.length){
      const nb = nearest(list, st.s);
      cr.push(`<a href="#" class="near" data-s="${nb.n}">→ найближче ${st.dv}.${st.v}.${st.p}.${String(nb.n).padStart(2,'0')} · ${esc(nb.name)}</a>`);
    } else if (vg){
      const ps = Object.keys(C.items).filter(k => k.startsWith(st.dv + '.' + st.v + '.')).map(k => +k.split('.')[2]);
      if (ps.length){
        const np = ps.reduce((a, b) => Math.abs(b - st.p) < Math.abs(a - st.p) ? b : a);
        cr.push(`<a href="#" class="near" data-p="${np}">→ найближчий підвид ${st.dv}.${st.v}.${np}</a>`);
      }
    }
  }
  morph('mCrumbs', cr.join('<i>·</i>'));

  const mt = [];
  if (item && item.old) mt.push('1С ' + esc(item.old));
  if (proj && proj.owner) mt.push(esc(proj.owner));
  if (item && item.new)   mt.push('<span class="flag">нове</span>');
  if (proj && proj.new)   mt.push('<span class="flag">новий проєкт</span>');
  if (vg && vg.new)       mt.push('<span class="flag">нова група</span>');
  if (item && item.renum) mt.push('<span class="flag">перенумеровано</span>');
  if (item && item.was)   mt.push('<span class="flag" title="' + esc(item.was) + '">перейменовано</span>');
  morph('mMeta', mt.join('<i>·</i>'));

  const rg = [];
  const rst = C.stats[pk];
  if (rst) rg.push(rst.n + ' од. у реєстрі — ' + esc(rst.t));
  if (proj && proj.note) rg.push(esc(proj.note));
  if (vg && vg.note && !item) rg.push(esc(vg.note));
  morph('mReg', rg.join('<i>·</i>'));

  const code = `${st.d1}.${st.d2}.${st.d3} · ${String(st.u).padStart(2,'0')} · ` +
               `${st.dv}.${st.v}.${st.p}.${String(st.s).padStart(2,'0')}`;
  codeEl.textContent = code;
  codeEl.setAttribute('aria-label', 'Скопіювати код ' + code);
  mirror.disabled = !exists('dv', inc ? 2 : 1, st);

  cols.forEach(c => { if (c.k === 'u') c.dotEl.textContent = unitTitle(pk).toLowerCase(); });

  /* aria: значення кожного барабана словами */
  const vt = {
    d1: div ? div.name : 'вільно',
    d2: (() => { const k = projKeys.find(k => k.startsWith(st.d1 + '.' + st.d2 + '.')); return k ? C.projects[st.d1 + '.' + st.d2 + '.0'] ? C.projects[st.d1 + '.' + st.d2 + '.0'].name : C.projects[k].name : 'вільно'; })(),
    d3: proj ? proj.name : 'вільно',
    u:  uL || 'вільно',
    dv: exists('dv', st.dv, st) ? (inc ? 'дохід' : 'витрата') : 'вільно',
    v:  vg ? vg.name : 'вільно',
    p:  pgN || (list ? 'без підвиду' : 'вільно'),
    s:  item ? item.name : 'вільно',
  };
  cols.forEach(c => {
    c.el.setAttribute('aria-valuenow', String(st[c.k]));
    c.el.setAttribute('aria-valuetext', `${String(st[c.k]).padStart(c.pad, '0')} — ${vt[c.k]}`);
  });
}
document.getElementById('mCrumbs').addEventListener('click', e => {
  const a = e.target.closest('a.near'); if (!a) return;
  e.preventDefault(); fullSettle = true;
  if (a.dataset.s !== undefined) byKey.s.goto(+a.dataset.s, true);
  if (a.dataset.p !== undefined) byKey.p.goto(+a.dataset.p, true);
});

/* ─── цикл: спить, коли нічого не рухається ───────────────── */
function wake(){ if (!rafOn){ rafOn = true; requestAnimationFrame(loop); } }
function loop(){
  cols.forEach(c => c.tick());
  cols.forEach(c => S[c.k] = c.val);
  SPEED = cols.reduce((m, c) => Math.max(m, Math.abs(c.vel)), 0);
  cols.forEach(c => c.paint(S));

  const sig = cols.map(c => c.val).join('|');
  if (sig !== last){ last = sig; read(S); }

  const busy = cols.some(c => c.drag || c.tw !== null || Math.abs(c.vel) > 0.004);
  if (busy){ moving = true; settleAt = 0; peak = Math.max(peak, SPEED); }
  else if (moving){ moving = false; settleAt = performance.now() + 90; }
  if (settleAt && performance.now() >= settleAt){ settleAt = 0; settle(); }

  const need = busy || settleAt || !cols.every(c => c.resting);
  if (need) requestAnimationFrame(loop); else rafOn = false;
}
wake();
settle();

/* ─── клавіатура (глобально — лише те, що не належить барабану) ── */
addEventListener('keydown', e => {
  if (se.classList.contains('on')) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  if (e.code === 'Slash' || e.key === '/' ||
      ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')){ openSearch(); e.preventDefault(); return; }
  if (e.target.closest && e.target.closest('.col')) return;      // барабан обробляє сам
  const i = cols.indexOf(active);
  if (e.key === 'ArrowLeft'){  cols[(i - 1 + cols.length) % cols.length].el.focus(); e.preventDefault(); }
  else if (e.key === 'ArrowRight'){ cols[(i + 1) % cols.length].el.focus(); e.preventDefault(); }
  else if (e.key === 'ArrowUp'){   active.step(-1); e.preventDefault(); }
  else if (e.key === 'ArrowDown'){ active.step(1);  e.preventDefault(); }
});

/* ─── копіювання ──────────────────────────────────────────── */
let toastT = 0;
function say(msg){
  toast.textContent = msg; toast.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 1600);
}
codeEl.addEventListener('click', async () => {
  const txt = codeEl.textContent.replace(/ /g, '');
  let ok = false;
  if (navigator.clipboard && window.isSecureContext){
    try { await navigator.clipboard.writeText(txt); ok = true; } catch(_){}
  }
  if (!ok){                                     // file:// та http без TLS
    try {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy'); ta.remove();
    } catch(_){}
  }
  say(ok ? 'код скопійовано' : 'не вдалося скопіювати — виділіть код вручну');
});

/* ─── пошук ───────────────────────────────────────────────── */
const IDX = [];
Object.entries(C.items).forEach(([g, L]) => {
  const [dv, v, p] = g.split('.').map(Number);
  L.forEach(it => IDX.push({t: it.name, s:{dv, v, p, s: it.n},
    c: `${dv}.${v}.${p}.${String(it.n).padStart(2,'0')}`,
    sub: (C.vyd[dv + '.' + v] || {}).name || ''}));
});
Object.entries(C.projects).forEach(([k, pr]) => {
  const [d1, d2, d3] = k.split('.').map(Number);
  IDX.push({t: pr.name, s:{d1, d2, d3}, c: k, sub: (C.divisions[d1] || {}).name || '', proj:1});
});

const se = document.getElementById('search'), qi = document.getElementById('q'), res = document.getElementById('res');
se.setAttribute('role', 'dialog'); se.setAttribute('aria-modal', 'true');
se.setAttribute('aria-label', 'Пошук по кодифікатору'); se.hidden = true;
qi.setAttribute('role', 'combobox'); qi.setAttribute('aria-expanded', 'true');
qi.setAttribute('aria-controls', 'res'); qi.setAttribute('aria-autocomplete', 'list');
res.setAttribute('role', 'listbox'); res.setAttribute('aria-label', 'Результати');
let hits = [], sel = 0, lastFocus = null;
function openSearch(){
  lastFocus = document.activeElement;
  se.hidden = false; se.classList.add('on'); qi.value = ''; render(''); qi.focus();
}
function closeSearch(){
  se.classList.remove('on'); se.hidden = true;
  const back = (lastFocus && lastFocus !== document.body && lastFocus !== qi && lastFocus.focus) ? lastFocus : active.el;
  back.focus({preventScroll:true});
}
se.addEventListener('click', e => { if (e.target === se) closeSearch(); });
qi.addEventListener('input', () => render(qi.value));
qi.addEventListener('keydown', e => {
  if (e.key === 'Escape'){ closeSearch(); e.preventDefault(); }
  else if (e.key === 'Tab'){ e.preventDefault(); }             // фокус лишається в діалозі
  else if (e.key === 'ArrowDown'){ sel = Math.min(sel + 1, hits.length - 1); paintRes(); e.preventDefault(); }
  else if (e.key === 'ArrowUp'){   sel = Math.max(sel - 1, 0); paintRes(); e.preventDefault(); }
  else if (e.key === 'Enter' && hits[sel]){ pick(hits[sel]); e.preventDefault(); }
});
function stems(q){                       // м'яка морфологія: «комірк» ↔ «комірок»
  return q.split(/\s+/).filter(Boolean).map(w =>
    w.length >= 5 ? w.slice(0, w.length - 2) : w);
}
function render(q){
  q = q.trim().toLowerCase();
  if (!q){ hits = IDX.filter(x => x.proj).slice(0, 60); sel = 0; return paintRes(); }
  const st = stems(q);
  hits = IDX.map(x => {
    const t = x.t.toLowerCase();
    let r = -1;
    if (x.c.startsWith(q)) r = 0;
    else if (t.startsWith(q)) r = 1;
    else if (t.includes(q)) r = 2;
    else if (st.every(w => t.includes(w))) r = 3;
    return r < 0 ? null : {x, r};
  }).filter(Boolean).sort((a, b) => a.r - b.r || a.x.t.length - b.x.t.length)
    .map(o => o.x).slice(0, 60);
  sel = 0; paintRes();
}
function paintRes(){
  if (!hits.length){
    res.innerHTML = '<div class="none" role="status">нічого не знайдено</div>';
    qi.removeAttribute('aria-activedescendant'); return;
  }
  res.innerHTML = hits.map((h, i) =>
    `<div role="option" id="opt-${i}" aria-selected="${i === sel}" class="${i === sel ? 'sel' : ''}" data-i="${i}">` +
    `<span class="nm">${esc(h.t)}<span class="sub"> &nbsp;${esc(h.sub)}</span></span>` +
    `<span class="cd">${esc(h.c)}</span></div>`).join('');
  [...res.children].forEach(d => d.onclick = () => pick(hits[+d.dataset.i]));
  qi.setAttribute('aria-activedescendant', 'opt-' + sel);
  const s = res.querySelector('.sel'); if (s) s.scrollIntoView({block:'nearest'});
}
function pick(h){
  fullSettle = true;
  Object.entries(h.s).forEach(([k, v]) => byKey[k] && byKey[k].goto(v, true));
  closeSearch();
}

const mTitle = document.getElementById('mTitle');
mTitle.setAttribute('role', 'button'); mTitle.setAttribute('tabindex', '0');
mTitle.title = 'Пошук по кодифікатору';
mTitle.setAttribute('aria-label', 'Пошук по кодифікатору');
mTitle.addEventListener('click', openSearch);
mTitle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ openSearch(); e.preventDefault(); } });
