/* Rotatable 3D models for the wall. three.js is imported only when a [data-stl] tile comes near the screen.
   Drag turns the model; the page keeps scrolling (no wheel zoom). */
const tiles = [...document.querySelectorAll('[data-stl]')];
if (tiles.length) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lib = null;
  const load = () => lib || (lib = Promise.all([import('three'), import('three/addons/controls/OrbitControls.js')]));

  function parseSTL(THREE, buf) {
    const dv = new DataView(buf);
    const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
    const geo = new THREE.BufferGeometry();
    if (84 + n * 50 === buf.byteLength) {
      const pos = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        for (let j = 0; j < 9; j++) pos[i * 9 + j] = dv.getFloat32(o + j * 4, true);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    } else {
      const txt = new TextDecoder().decode(buf), v = [];
      const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g; let m;
      while ((m = re.exec(txt))) v.push(+m[1], +m[2], +m[3]);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    }
    geo.computeVertexNormals();
    return geo;
  }

  // tiny GLB reader: positions, vertex colours, indices (enough for print models exported without materials)
  function parseGLB(THREE, buf) {
    const dv = new DataView(buf), jl = dv.getUint32(12, true);
    const j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    const binOff = 20 + jl + 8;
    const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const N = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    const acc = i => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView];
      return { arr: new CT[a.componentType](buf, binOff + (bv.byteOffset || 0) + (a.byteOffset || 0), a.count * N[a.type]), n: N[a.type], norm: a.normalized, min: a.min }; };
    return j.meshes.map(m => {
      const p = m.primitives[0], g = new THREE.BufferGeometry();
      const pos = acc(p.attributes.POSITION);
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos.arr), 3));
      if (p.attributes.COLOR_0 != null) { const c = acc(p.attributes.COLOR_0); g.setAttribute('color', new THREE.BufferAttribute(c.arr.slice(), c.n, !!c.norm)); }
      if (p.indices != null) g.setIndex(new THREE.BufferAttribute(acc(p.indices).arr.slice(), 1));
      g.computeVertexNormals();
      return { name: m.name, geo: g, zmin: pos.min ? pos.min[2] : 0 };
    });
  }

  async function boot(el) {
    const [THREE, { OrbitControls }] = await load();
    const urls = el.dataset.stl.split(',');
    const bufs = await Promise.all(urls.map(u => fetch(u).then(r => r.arrayBuffer())));
    const W = () => el.clientWidth, H = () => el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    renderer.setSize(W(), H());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', el.dataset.label || '3D model, drag to rotate');
    renderer.domElement.setAttribute('role', 'img');
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, W() / H(), 0.1, 5000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b8b8, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1, 1.6, 1.2); scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, .8); rim.position.set(-1.4, .4, -1); scene.add(rim);

    const tone = (el.dataset.tones || '').split(',');
    const group = new THREE.Group();
    const layers = [];
    bufs.forEach((b, i) => {
      if (/\.glb$/i.test(urls[i])) {
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, metalness: 0 });
        parseGLB(THREE, b).forEach(p => {
          const mesh = new THREE.Mesh(p.geo, mat);
          // storeys of the model: ground (z < 40), upper floor (40–80), roof (80+); used for the exploded view
          mesh.userData.layer = p.zmin < 39.5 ? 0 : p.zmin < 79.5 ? 1 : 2;
          layers.push(mesh); group.add(mesh);
        });
        return;
      }
      const g = parseSTL(THREE, b);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(tone[i] || '#2a2a2a'), roughness: .62, metalness: .05, flatShading: false });
      const mesh = new THREE.Mesh(g, mat); mesh.userData.layer = i; layers.push(mesh);
      group.add(mesh);
    });
    // most print files are Z-up; turn them to three's Y-up
    if (el.dataset.up !== 'y') group.rotation.x = -Math.PI / 2;
    const box = new THREE.Box3().setFromObject(group), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    group.position.sub(c);
    const pivot = new THREE.Group(); pivot.add(group); scene.add(pivot);
    const r = s.length() / 2 * (el.dataset.explode ? 1.25 : 1);
    const dist = r / Math.sin((cam.fov * Math.PI / 180) / 2) * (+el.dataset.fit || 1.05);
    cam.position.set(dist * .62, dist * .42, dist * .66); cam.lookAt(0, 0, 0);

    const ctl = new OrbitControls(cam, renderer.domElement);
    ctl.enableZoom = false; ctl.enablePan = false; ctl.enableDamping = true; ctl.dampingFactor = .08;
    ctl.rotateSpeed = .8;
    ctl.autoRotate = !reduce; ctl.autoRotateSpeed = 1.4;
    // let vertical swipes on phones scroll the page; only horizontal drags turn the model
    ctl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    renderer.domElement.style.touchAction = 'pan-y';
    let idle;
    ctl.addEventListener('start', () => { el.classList.add('drag'); ctl.autoRotate = false; clearTimeout(idle); });
    ctl.addEventListener('end', () => { el.classList.remove('drag'); if (!reduce) idle = setTimeout(() => { ctl.autoRotate = true; }, 2500); });

    // exploded view: the storeys lift apart (in model units along the print's Z axis) while the pointer is over the tile
    const gap = +el.dataset.explode || 0; let ex = 0, exT = 0;
    if (gap) {
      const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (fine) { el.addEventListener('pointerenter', () => { exT = 1; }); el.addEventListener('pointerleave', () => { exT = 0; }); }
      else { let downAt = 0; renderer.domElement.addEventListener('pointerdown', () => { downAt = performance.now(); });
        renderer.domElement.addEventListener('pointerup', () => { if (performance.now() - downAt < 220) exT = exT ? 0 : 1; }); }
    }
    let vis = true, raf = 0;
    const tick = () => { raf = 0; if (!vis) return;
      if (gap && Math.abs(exT - ex) > .001) { ex += (exT - ex) * (reduce ? 1 : .12); layers.forEach(m => { m.position.z = m.userData.layer * gap * ex; }); }
      ctl.update(); renderer.render(scene, cam); raf = requestAnimationFrame(tick); };
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !raf) raf = requestAnimationFrame(tick); }).observe(el);
    new ResizeObserver(() => { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }).observe(el);
    renderer.render(scene, cam);
    el.classList.add('ready');
    tick();
  }

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    boot(e.target).catch(err => { console.warn('3D', err); });
  }), { rootMargin: '300px 0px' });
  tiles.forEach(el => io.observe(el));
}
