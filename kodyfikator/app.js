'use strict';
const C = window.CODEX;
const ITEM = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--item-h'));

/* ─── розряди коду ────────────────────────────────────────── */
const SPEC = [
  {k:'d1', n:4,   pad:1, dot:'підрозділ'},
  {sep:'.'},
  {k:'d2', n:10,  pad:1, dot:'проєкт'},
  {sep:'.'},
  {k:'d3', n:10,  pad:1, dot:'об’єкт'},
  {sep:'·', gap:1},
  {k:'u',  n:100, pad:2, dot:'облік'},
  {sep:'·', gap:1},
  {k:'dv', n:3,   pad:1, dot:'д/в'},
  {sep:'.'},
  {k:'v',  n:10,  pad:1, dot:'вид'},
  {sep:'.'},
  {k:'p',  n:10,  pad:1, dot:'підвид'},
  {sep:'.'},
  {k:'s',  n:100, pad:2, dot:'стаття'},
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
    case 'dv': return val === 1 ? (s.d1 === 1 || s.d1 === 2) : val === 2;
    case 'v':  return !!C.vyd[s.dv + '.' + val];
    case 'p':  return !!C.items[s.dv + '.' + s.v + '.' + val];
    case 's':  { const L = C.items[s.dv + '.' + s.v + '.' + s.p];
                 return !!(L && L.some(x => x.n === val)); }
  }
  return false;
}

/* ─── барабан ─────────────────────────────────────────────── */
const POOL = 7;
class Col {
  constructor(spec, host){
    this.k = spec.k; this.n = spec.n; this.pad = spec.pad;
    this.pos = 0; this.vel = 0; this.tw = null; this.drag = false;
    const el = document.createElement('div');
    el.className = 'col' + (spec.pad === 2 ? ' wide' : '');
    this.layers = [];
    for (let L = 0; L < 3; L++){
      const lay = document.createElement('div');
      lay.className = L === 0 ? 'stack' : 'echo';
      lay.cells = [];
      for (let i = 0; i < POOL; i++){
        const c = document.createElement('div'); c.className = 'cell';
        lay.appendChild(c); lay.cells.push(c);
      }
      el.appendChild(lay); this.layers.push(lay);
    }
    const dot = document.createElement('div'); dot.className = 'dot'; dot.textContent = spec.dot;
    el.appendChild(dot); this.dotEl = dot;
    host.appendChild(el); this.el = el;

    el.addEventListener('wheel', e => {
      e.preventDefault(); setActive(this);
      const d = Math.abs(e.deltaY) > 40 ? e.deltaY * 0.0016 : e.deltaY * 0.0042;
      this.tw = null; this.vel = clamp(this.vel + d, -1.1, 1.1);
    }, {passive:false});

    let py = 0, lt = 0;
    el.addEventListener('pointerdown', e => {
      setActive(this); this.drag = true; this.tw = null; this.vel = 0;
      py = e.clientY; lt = performance.now(); el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const dy = e.clientY - py, dt = Math.max(performance.now() - lt, 8);
      this.pos -= dy / ITEM(); this.vel = -(dy / ITEM()) / dt * 16;
      py = e.clientY; lt = performance.now();
    });
    const up = () => { this.drag = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  get val(){ return clamp(Math.round(this.pos), 0, this.n - 1); }
  goto(v, soft){ this.tw = clamp(v, 0, this.n - 1); this.vel = 0; if (!soft) this.pos = this.tw; }
  step(d){ this.tw = clamp(Math.round(this.pos) + d, 0, this.n - 1); this.vel = 0; }

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
  paint(st){
    const sp = Math.abs(this.vel);
    this.layers[0].style.filter = sp > 0.02 ? `blur(${Math.min(sp * 3.2, 4.2)}px)` : '';
    const ih = ITEM();
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
        if (L === 0) cell.classList.toggle('off', !exists(this.k, i, st));
      }
    }
  }
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* ─── збірка ──────────────────────────────────────────────── */
const picker = document.getElementById('picker');
const cols = [], byKey = {};
SPEC.forEach(sp => {
  if (sp.sep){
    const d = document.createElement('div');
    d.className = 'sep' + (sp.gap ? ' gap' : ''); d.textContent = sp.sep;
    picker.appendChild(d); return;
  }
  const c = new Col(sp, picker); cols.push(c); byKey[sp.k] = c;
});
cols.forEach(c => c.goto(S[c.k]));
let active = cols[0];
function setActive(c){
  active = c; cols.forEach(x => x.el.classList.toggle('active', x === c));
}
setActive(cols[0]);

/* ─── читалка ─────────────────────────────────────────────── */
let SPEED = 0;                      // поточна швидкість барабанів — керує «розмазуванням»
function morph(wrapId, html, cls){
  const wrap = document.getElementById(wrapId);
  const cur = wrap.querySelector('.cur');
  if (cur.innerHTML === html && (cls === undefined || wrap.className.includes(cls))) return;
  if (cur.innerHTML !== html && cur.innerHTML.trim()){
    const k = Math.min(SPEED * 2.2, 1);          // 0 — крок, 1 — швидке прокручування
    const g = cur.cloneNode(true);
    g.className = 'gh'; g.classList.remove('enter');
    const dur = Math.round(440 - k * 200);
    g.style.setProperty('--gy', (-(5 + k * 16)).toFixed(1) + 'px');
    g.style.setProperty('--gb', (7 + k * 8).toFixed(1) + 'px');
    g.style.setProperty('--gs', (1.012 + k * 0.03).toFixed(3));
    g.style.setProperty('--go', (0.38 - k * 0.1).toFixed(2));
    g.style.setProperty('--gd', dur + 'ms');
    wrap.appendChild(g);
    setTimeout(() => g.remove(), dur + 40);
    const gs = wrap.querySelectorAll('.gh');
    if (gs.length > 3) gs[0].remove();
  }
  cur.innerHTML = html;
  if (cls !== undefined) wrap.className = cls;
}

/* коли всі барабани стали — рядки «проявляються» з розмиття, каскадом */
const SETTLE = [   // id, затримка, тривалість, розмиття, зсув
  ['vKind',   0, 400, 3.5, 4],
  ['vTitle',  55, 580, 10,  8],
  ['vCrumbs',145, 500, 4.5, 6],
  ['vMeta',   215, 440, 3,   5],
  ['code',    285, 420, 2.5, 4]];
function settle(){
  SETTLE.forEach(([id, delay, dur, blur, dy]) => {
    const el = document.getElementById(id);
    if (!el || !el.textContent.trim()) return;
    el.classList.remove('enter'); void el.offsetWidth;
    el.style.setProperty('--edl', delay + 'ms');
    el.style.setProperty('--ed',  dur + 'ms');
    el.style.setProperty('--eb',  blur + 'px');
    el.style.setProperty('--ey',  dy + 'px');
    el.classList.add('enter');
  });
}
const esc = s => String(s).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));

function read(st){
  const pk = st.d1 + '.' + st.d2 + '.' + st.d3;
  const proj = C.projects[pk];
  const div  = C.divisions[st.d1];
  const vg   = C.vyd[st.dv + '.' + st.v];
  const pgN  = C.pid[st.dv + '.' + st.v + '.' + st.p];
  const list = C.items[st.dv + '.' + st.v + '.' + st.p];
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
  if (proj) cr.push('<b style="font-weight:500">' + esc(proj.name) + '</b>');
  else if (st.d2 || st.d3) cr.push('<span style="color:var(--fg-4)">проєкт не заведено</span>');
  if (uL && st.u !== 0) cr.push(esc(uL));
  if (vg)  cr.push(esc(vg.name));
  if (pgN) cr.push(esc(pgN));
  morph('mCrumbs', cr.join('<i>·</i>'));

  const mt = [];
  if (item && item.old) mt.push('1С ' + esc(item.old));
  if (proj && proj.owner) mt.push(esc(proj.owner));
  const rst = C.stats[pk];
  if (rst) mt.push(rst.n + ' од. у реєстрі — ' + esc(rst.t));
  if (proj && proj.note) mt.push(esc(proj.note));
  let meta = mt.join('&nbsp; · &nbsp;');
  if (item && item.new)   meta += ' <span class="badge">НОВА</span>';
  if (proj && proj.new)   meta += ' <span class="badge">НОВИЙ ПРОЄКТ</span>';
  if (vg && vg.new)       meta += ' <span class="badge">НОВА ГРУПА</span>';
  if (item && item.renum) meta += ' <span class="badge">ПЕРЕНУМЕРОВАНО</span>';
  morph('mMeta', meta);

  const codeEl = document.getElementById('code');
  codeEl.textContent =
    `${st.d1}.${st.d2}.${st.d3} · ${String(st.u).padStart(2,'0')} · ` +
    `${st.dv}.${st.v}.${st.p}.${String(st.s).padStart(2,'0')}`;
  cols.forEach(c => { if (c.k === 'u') c.dotEl.textContent = unitTitle(pk).toLowerCase(); });
}

/* ─── цикл ────────────────────────────────────────────────── */
let last = '', moving = false, settleAt = 0;
function loop(){
  cols.forEach(c => c.tick());
  cols.forEach(c => S[c.k] = c.val);
  SPEED = cols.reduce((m, c) => Math.max(m, Math.abs(c.vel)), 0);
  cols.forEach(c => c.paint(S));

  const sig = cols.map(c => c.val).join('|');
  if (sig !== last){ last = sig; read(S); }

  const busy = cols.some(c => c.drag || c.tw !== null || Math.abs(c.vel) > 0.004);
  if (busy){ moving = true; settleAt = 0; }
  else if (moving){ moving = false; settleAt = performance.now() + 90; }
  if (settleAt && performance.now() >= settleAt){ settleAt = 0; settle(); }

  requestAnimationFrame(loop);
}
loop();
settle();

/* ─── клавіатура ──────────────────────────────────────────── */
addEventListener('keydown', e => {
  const se = document.getElementById('search');
  if (se.classList.contains('on')) return;
  const i = cols.indexOf(active);
  if (e.key === 'ArrowLeft'){  setActive(cols[(i - 1 + cols.length) % cols.length]); e.preventDefault(); }
  else if (e.key === 'ArrowRight'){ setActive(cols[(i + 1) % cols.length]); e.preventDefault(); }
  else if (e.key === 'ArrowUp'){   active.step(-1); e.preventDefault(); }
  else if (e.key === 'ArrowDown'){ active.step(1);  e.preventDefault(); }
  else if (e.code === 'Slash' || e.key === '/' ||
           ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')){ openSearch(); e.preventDefault(); }
});

/* ─── копіювання ──────────────────────────────────────────── */
const toast = document.getElementById('toast');
document.getElementById('code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(document.getElementById('code').textContent.replace(/ /g,'')); }
  catch(_){}
  toast.classList.add('on'); setTimeout(() => toast.classList.remove('on'), 1400);
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
let hits = [], sel = 0;
function openSearch(){ se.classList.add('on'); qi.value = ''; qi.focus(); render(''); }
function closeSearch(){ se.classList.remove('on'); }
se.addEventListener('click', e => { if (e.target === se) closeSearch(); });
qi.addEventListener('input', () => render(qi.value));
qi.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSearch();
  else if (e.key === 'ArrowDown'){ sel = Math.min(sel + 1, hits.length - 1); paintRes(); e.preventDefault(); }
  else if (e.key === 'ArrowUp'){   sel = Math.max(sel - 1, 0); paintRes(); e.preventDefault(); }
  else if (e.key === 'Enter' && hits[sel]) pick(hits[sel]);
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
  res.innerHTML = hits.map((h, i) =>
    `<div class="${i === sel ? 'sel' : ''}" data-i="${i}"><span class="nm">${esc(h.t)}` +
    `<span style="color:var(--fg-4);font-size:11px"> &nbsp;${esc(h.sub)}</span></span>` +
    `<span class="cd">${h.c}</span></div>`).join('');
  [...res.children].forEach(d => d.onclick = () => pick(hits[+d.dataset.i]));
  const s = res.querySelector('.sel'); if (s) s.scrollIntoView({block:'nearest'});
}
function pick(h){
  moving = true;
  Object.entries(h.s).forEach(([k, v]) => byKey[k] && byKey[k].goto(v, true));
  closeSearch();
}

document.getElementById('mTitle').addEventListener('click', openSearch);
document.getElementById('mTitle').style.cursor = 'pointer';
document.getElementById('mTitle').title = 'Пошук по кодифікатору';
