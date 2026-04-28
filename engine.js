/* engine.js — 3D scenes for hero / FYP twin / research timeline / project gallery
   Three.js r128. Three independent renderers; one shared accent color.
*/
(() => {
  'use strict';

  const PALETTE = {
    bg:        0x001D47,
    deep:      0x0a2856,
    accent:    0x21FFB5,   // CERN green — primary accent
    accent2:   0xE5F95B,   // vibrant yellow
    blue:      0x4d8cff,
    green:     0x21FFB5,
    line:      0x86A4D6,
    lineSoft:  0x3a5a8e,
    white:     0xE8EDF5
  };

  // shared mutable state — Tweaks can mutate these
  const ST = (window.__ABState = {
    mode: 'turbofan',          // 'turbofan' | 'robot'
    rpm: 12450,
    accent: PALETTE.accent,
    accent2: PALETTE.accent2,
    intensity: 1.0,
    telemetry: true,
    sensorOverlay: true,
    paused: false,
    grid: true
  });

  // ============================================================
  // SHARED HELPERS
  // ============================================================
  const TAU = Math.PI * 2;

  function disposeNode(node) {
    if (!node) return;
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
      else node.material.dispose();
    }
  }
  function emptyGroup(g) {
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      c.traverse(disposeNode);
    }
  }

  // a tiny easing
  const ease = {
    inOut: (t) => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2,
    out:   (t) => 1 - Math.pow(1-t, 3)
  };

  // Color lerp into a single THREE.Color obj
  const _c1 = new THREE.Color(), _c2 = new THREE.Color();
  function setLerp(target, hexA, hexB, t) {
    _c1.setHex(hexA); _c2.setHex(hexB);
    target.copy(_c1).lerp(_c2, t);
  }

  // Map scroll progress over an element [0..1] (top-of-viewport entry → bottom-of-viewport exit)
  function elementScrollProgress(el) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = r.height + vh;
    const passed = vh - r.top;
    return Math.max(0, Math.min(1, passed / total));
  }

  // Sticky-section progress 0..1 across full sticky travel
  function stickyProgress(section) {
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.top >= 0) return 0;
    const travel = section.offsetHeight - vh;
    if (travel <= 0) return 0;
    return Math.max(0, Math.min(1, -r.top / travel));
  }

  // ============================================================
  // 1) HERO SCENE — TURBOFAN / ROBOT (mode-switchable)
  // ============================================================
  (function HeroScene() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = null; // transparent for layering with CSS
    scene.fog = new THREE.Fog(PALETTE.bg, 8, 24);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.6, 8.6);

    // lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(5, 6, 8); scene.add(key);
    const rim = new THREE.PointLight(PALETTE.accent, 1.4, 16);
    rim.position.set(-3, 2, 2); scene.add(rim);
    const fill = new THREE.PointLight(PALETTE.blue, 0.9, 18);
    fill.position.set(4, -2, -3); scene.add(fill);

    // root group
    const root = new THREE.Group(); scene.add(root);

    // ---------- TURBINE ASSEMBLY ----------
    const turbine = new THREE.Group(); root.add(turbine);

    // shaft
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x6e7a92, metalness: 0.85, roughness: 0.35 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6.4, 24), shaftMat);
    shaft.rotation.z = Math.PI/2; shaft.userData.partKind = 'shaft';
    turbine.add(shaft);

    // helper: a stage (disc + blades)
    function makeStage({ x, hubR, hubL, bladeCount, bladeLen, bladeW, color, twist=0.18 }) {
      const g = new THREE.Group();
      g.position.x = x;
      g.userData.basePos = new THREE.Vector3(x, 0, 0);
      g.userData.partKind = 'stage';

      const hubMat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.4 });
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR*0.92, hubL, 36), hubMat);
      hub.rotation.z = Math.PI/2;
      g.add(hub);

      // edge ring (accent line)
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(hubR + bladeLen + 0.02, 0.012, 6, 64),
        new THREE.MeshBasicMaterial({ color: PALETTE.line, transparent: true, opacity: 0.55 })
      );
      ring.rotation.y = Math.PI/2;
      g.add(ring);

      const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc9d3e8, metalness: 0.78, roughness: 0.3 });
      for (let i = 0; i < bladeCount; i++) {
        const a = (i / bladeCount) * TAU;
        const b = new THREE.Mesh(new THREE.BoxGeometry(bladeW, bladeLen, hubL*0.78), bladeMat);
        b.position.set(0, Math.cos(a)*(hubR + bladeLen/2), Math.sin(a)*(hubR + bladeLen/2));
        b.lookAt(0, 0, 0);
        b.rotateX(twist);
        g.add(b);
      }
      return g;
    }

    // 5 stages along x axis
    const stages = [
      makeStage({ x: -2.4, hubR: 0.42, hubL: 0.32, bladeCount: 22, bladeLen: 0.62, bladeW: 0.06, color: 0x9aa6bd, twist: 0.16 }), // fan (large)
      makeStage({ x: -1.2, hubR: 0.38, hubL: 0.28, bladeCount: 20, bladeLen: 0.42, bladeW: 0.05, color: 0x8693af, twist: 0.22 }),
      makeStage({ x:  0.0, hubR: 0.34, hubL: 0.46, bladeCount: 18, bladeLen: 0.30, bladeW: 0.05, color: 0xb5904a, twist: 0.0  }), // combustor (warmer)
      makeStage({ x:  1.2, hubR: 0.40, hubL: 0.30, bladeCount: 22, bladeLen: 0.36, bladeW: 0.05, color: 0xa59cb6, twist:-0.22 }),
      makeStage({ x:  2.4, hubR: 0.46, hubL: 0.34, bladeCount: 26, bladeLen: 0.50, bladeW: 0.06, color: 0x9aa6bd, twist:-0.16 })  // exhaust (large)
    ];
    stages.forEach(s => turbine.add(s));

    // outer casing — a wireframe cylinder, segmented
    const casingMat = new THREE.MeshBasicMaterial({ color: PALETTE.line, transparent: true, opacity: 0.18, wireframe: true });
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 6.0, 36, 8, true), casingMat);
    casing.rotation.z = Math.PI/2;
    casing.userData.partKind = 'casing';
    turbine.add(casing);

    // sensor overlay — 6 little blinkers attached around casing
    const sensorGroup = new THREE.Group(); turbine.add(sensorGroup);
    const sensorDots = [];
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*TAU + 0.2;
      const x = THREE.MathUtils.lerp(-2.4, 2.4, (i+0.5)/8);
      const y = Math.cos(a)*1.18;
      const z = Math.sin(a)*1.18;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10),
        new THREE.MeshBasicMaterial({ color: i%3 === 0 ? PALETTE.accent : (i%3 === 1 ? PALETTE.green : PALETTE.blue) }));
      dot.position.set(x, y, z);
      dot.userData.phase = Math.random()*TAU;
      sensorGroup.add(dot);
      sensorDots.push(dot);
    }

    // ---------- ROBOT ASSEMBLY (alt mode) ----------
    const robot = new THREE.Group(); robot.visible = false; root.add(robot);

    // body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x47557a, metalness: 0.65, roughness: 0.42 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.4), bodyMat);
    body.position.y = 0.55;
    robot.add(body);

    // top plate
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x2d3a5a, metalness: 0.7, roughness: 0.4 }));
    top.position.y = 0.92; robot.add(top);

    // LiDAR puck
    const lidar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24),
      new THREE.MeshStandardMaterial({ color: 0x111927, metalness: 0.4, roughness: 0.4 }));
    lidar.position.y = 1.08; robot.add(lidar);
    const lidarRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.015, 6, 48),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent }));
    lidarRing.position.y = 1.08; lidarRing.rotation.x = Math.PI/2; robot.add(lidarRing);

    // wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111927, metalness: 0.3, roughness: 0.7 });
    const wheels = [];
    [[-0.85, -0.65], [0.85, -0.65], [-0.85, 0.65], [0.85, 0.65]].forEach(([x,z]) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 22), wheelMat);
      w.rotation.z = Math.PI/2;
      w.position.set(x, 0.34, z);
      robot.add(w); wheels.push(w);
    });

    // LiDAR scan rays — 64 dotted points spinning in a ring around robot
    const rayGeom = new THREE.BufferGeometry();
    const rayPositions = new Float32Array(64*3);
    rayGeom.setAttribute('position', new THREE.BufferAttribute(rayPositions, 3));
    const rays = new THREE.Points(rayGeom, new THREE.PointsMaterial({ color: PALETTE.accent, size: 0.045, transparent: true, opacity: 0.85 }));
    rays.position.y = 1.08;
    robot.add(rays);

    // ---------- AMBIENT GRID (a subtle scientific-graph grid below) ----------
    const gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({ color: PALETTE.lineSoft, transparent: true, opacity: 0.35 });
    const gridSize = 10, gridDivs = 20;
    const gridGeom = new THREE.BufferGeometry();
    const gpts = [];
    for (let i = 0; i <= gridDivs; i++) {
      const t = (i/gridDivs - 0.5) * gridSize;
      gpts.push(-gridSize/2, -2.0, t,  gridSize/2, -2.0, t);
      gpts.push(t, -2.0, -gridSize/2,  t, -2.0, gridSize/2);
    }
    gridGeom.setAttribute('position', new THREE.Float32BufferAttribute(gpts, 3));
    const gridLines = new THREE.LineSegments(gridGeom, gridMat);
    gridGroup.add(gridLines);
    scene.add(gridGroup);

    // ---------- PARTICLE FIELD ----------
    const partGeom = new THREE.BufferGeometry();
    const partCount = 360;
    const partPos = new Float32Array(partCount*3);
    for (let i = 0; i < partCount; i++) {
      partPos[i*3]   = (Math.random()-0.5)*16;
      partPos[i*3+1] = (Math.random()-0.5)*9;
      partPos[i*3+2] = (Math.random()-0.5)*8 - 2;
    }
    partGeom.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const particles = new THREE.Points(partGeom,
      new THREE.PointsMaterial({ color: PALETTE.line, size: 0.026, transparent: true, opacity: 0.5 }));
    scene.add(particles);

    // ---------- DATA-FLOW LINES (curve from sensors into a small core to the right) ----------
    const flowGroup = new THREE.Group(); turbine.add(flowGroup);
    function buildFlow() {
      emptyGroup(flowGroup);
      sensorDots.forEach((d, i) => {
        const start = d.position.clone();
        const end   = new THREE.Vector3(3.4, 0.0, 0.0);
        const mid   = new THREE.Vector3((start.x+end.x)/2 + 0.4, start.y*0.4 + 0.6, start.z*0.4);
        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const pts = curve.getPoints(24);
        const lg = new THREE.BufferGeometry().setFromPoints(pts);
        const lm = new THREE.LineBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.0 });
        const line = new THREE.Line(lg, lm);
        line.userData.delay = i * 0.07;
        flowGroup.add(line);
      });
      // glowing core
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1),
        new THREE.MeshBasicMaterial({ color: PALETTE.accent }));
      core.position.set(3.4, 0, 0);
      core.userData.kind = 'core';
      flowGroup.add(core);
    }
    buildFlow();

    // mouse parallax
    const mouse = new THREE.Vector2(0,0), targetMouse = new THREE.Vector2(0,0);
    window.addEventListener('mousemove', (e) => {
      targetMouse.x = (e.clientX / window.innerWidth)*2 - 1;
      targetMouse.y = -((e.clientY / window.innerHeight)*2 - 1);
    });

    // resize
    function size() {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(size).observe(canvas); size();

    // mode switch (Tweaks)
    function applyMode() {
      turbine.visible = (ST.mode !== 'robot');
      robot.visible   = (ST.mode === 'robot');
    }

    // animate
    let lastT = performance.now();
    function tick() {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.04, (now - lastT)/1000);
      lastT = now;

      const t = now * 0.001;
      mouse.x += (targetMouse.x - mouse.x) * 0.06;
      mouse.y += (targetMouse.y - mouse.y) * 0.06;

      const heroEl = document.getElementById('hero');
      const hp = heroEl ? Math.max(0, Math.min(1, -heroEl.getBoundingClientRect().top / window.innerHeight)) : 0;

      applyMode();

      // global root tilt
      root.rotation.y = mouse.x * 0.35;
      root.rotation.x = -mouse.y * 0.18;

      gridGroup.visible = ST.grid;
      gridGroup.position.z = -hp * 2.2;
      gridGroup.material && (gridGroup.material.opacity = (1 - hp*0.7) * 0.4);

      particles.material.opacity = (1 - hp*0.6) * 0.5 * ST.intensity;
      particles.rotation.y = t * 0.02;

      if (ST.mode !== 'robot') {
        // turbine spin
        const speed = ST.paused ? 0 : (ST.rpm / 12450);
        turbine.rotation.y = mouse.x * 0.05;

        stages.forEach((s, i) => {
          // disassemble outwards on scroll
          const dirSign = (i - 2);                         // -2..2
          const explode = ease.inOut(hp) * 1.7;
          s.position.x = s.userData.basePos.x + dirSign * explode * 0.42;
          s.position.y = Math.sin(i*1.3) * explode * 0.35;
          // spin
          s.rotation.x += dt * speed * (1.4 - i*0.05) * (i%2?1:-1);
        });

        // shaft fades when exploded
        shaft.material.opacity = 1 - hp*0.7;
        shaft.material.transparent = true;
        shaft.scale.x = 1 - hp*0.2;

        casing.material.opacity = (0.18 + (1-hp)*0.12) * ST.intensity;
        casing.scale.set(1, 1 + hp*0.15, 1 + hp*0.15);

        // sensor blink
        sensorGroup.visible = ST.telemetry;
        sensorDots.forEach(d => {
          const k = 0.5 + 0.5 * Math.sin(t*3 + d.userData.phase);
          d.scale.setScalar(0.7 + k*0.7);
          d.material.opacity = 0.6 + k*0.4;
          d.material.transparent = true;
        });

        // data flow lines pulse + core glow
        flowGroup.visible = ST.telemetry && hp < 0.9;
        flowGroup.children.forEach((c, i) => {
          if (c.userData.kind === 'core') {
            c.scale.setScalar(1 + 0.18 * Math.sin(t*4));
            c.material.color.setHex(ST.accent);
            return;
          }
          const phase = (t*0.7 + c.userData.delay) % 1;
          c.material.opacity = (1 - hp) * (0.6 - Math.abs(phase-0.5));
          c.material.color.setHex(ST.accent);
        });

        rim.color.setHex(ST.accent);
      } else {
        // robot
        robot.position.y = -0.4;
        robot.rotation.y = mouse.x * 0.25 + Math.sin(t*0.3)*0.1;
        wheels.forEach(w => w.rotation.x += dt * 4.0);
        lidarRing.material.color.setHex(ST.accent);
        // scan rays
        for (let i = 0; i < 64; i++) {
          const a = (i/64)*TAU + t*1.5;
          const r = 0.6 + Math.sin(a*3 + t)*0.2 + Math.random()*0.05;
          rayPositions[i*3]   = Math.cos(a)*r;
          rayPositions[i*3+1] = (Math.random()-0.5)*0.05;
          rayPositions[i*3+2] = Math.sin(a)*r;
        }
        rayGeom.attributes.position.needsUpdate = true;
        rays.material.color.setHex(ST.accent);
      }

      // camera dolly with scroll — slight push-in
      camera.position.z = 8.6 - hp*1.6;
      camera.position.y = 0.6 + hp*0.4;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    requestAnimationFrame(tick);
  })();

  // ============================================================
  // 2) FYP TWIN — slowly rotating compact turbine inside the card
  // ============================================================
  (function TwinScene() {
    const canvas = document.getElementById('twin-canvas');
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PALETTE.bg, 5, 12);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(2.0, 1.5, 4.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    const k = new THREE.DirectionalLight(0xffffff, 0.7); k.position.set(3,4,5); scene.add(k);
    const a = new THREE.PointLight(PALETTE.accent, 1.2, 10); a.position.set(-2,1,2); scene.add(a);

    const root = new THREE.Group(); scene.add(root);

    // simplified turbine — 4 stages
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.2, 18),
      new THREE.MeshStandardMaterial({ color: 0x6e7a92, metalness: 0.85, roughness: 0.3 }));
    shaft.rotation.z = Math.PI/2; root.add(shaft);

    const stages = [];
    [-1.4, -0.5, 0.5, 1.4].forEach((x, i) => {
      const g = new THREE.Group(); g.position.x = x;
      const r = 0.28 + Math.sin(i)*0.05;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r, r*0.92, 0.22, 24),
        new THREE.MeshStandardMaterial({ color: i===2?0xb5904a:0x9aa6bd, metalness: 0.7, roughness: 0.35 }));
      hub.rotation.z = Math.PI/2;
      g.add(hub);
      const bm = new THREE.MeshStandardMaterial({ color: 0xc9d3e8, metalness: 0.78, roughness: 0.3 });
      for (let b = 0; b < 16; b++) {
        const ang = (b/16)*TAU;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.18), bm);
        blade.position.set(0, Math.cos(ang)*(r+0.16), Math.sin(ang)*(r+0.16));
        blade.lookAt(0,0,0); blade.rotateX(0.18*(i%2?1:-1));
        g.add(blade);
      }
      root.add(g); stages.push(g);
    });

    // dotted casing
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 4.0, 28, 4, true),
      new THREE.MeshBasicMaterial({ color: PALETTE.line, wireframe: true, transparent: true, opacity: 0.18 }));
    casing.rotation.z = Math.PI/2; root.add(casing);

    // 3 sensor blinkers
    const sensors = [];
    [-1.2, 0, 1.2].forEach((x, i) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshBasicMaterial({ color: i%3===0 ? PALETTE.accent : (i%3===1 ? PALETTE.green : PALETTE.blue) }));
      d.position.set(x, 0.78, 0.25);
      d.userData.phase = Math.random()*TAU;
      root.add(d); sensors.push(d);
    });

    function size() {
      const w = canvas.clientWidth || 400, h = canvas.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(size).observe(canvas); size();

    let last = performance.now();
    function tick() {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = (now - last)/1000; last = now;
      const t = now * 0.001;

      root.rotation.y = t * 0.18;
      stages.forEach((s, i) => s.rotation.x += dt * (1.6 - i*0.12) * (i%2?1:-1));
      sensors.forEach(d => {
        const k = 0.5 + 0.5*Math.sin(t*3 + d.userData.phase);
        d.scale.setScalar(0.8 + k*0.7);
        d.material.opacity = 0.6 + k*0.4;
        d.material.transparent = true;
      });

      a.color.setHex(ST.accent);
      renderer.render(scene, camera);
    }
    tick();
  })();

  // ============================================================
  // 3) RESEARCH TIMELINE — scroll-driven 3D rail
  // ============================================================
  (function TimelineScene() {
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas) return;
    const section = document.getElementById('research-exp');
    const cards = Array.from(document.querySelectorAll('.tl-card'));
    const dots  = Array.from(document.querySelectorAll('.tl-progress > div'));
    if (!section) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PALETTE.bg, 6, 22);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 1.6, 6);

    scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    const dl = new THREE.DirectionalLight(0xffffff, 0.85); dl.position.set(4,5,4); scene.add(dl);
    const al = new THREE.PointLight(PALETTE.accent, 1.4, 16); al.position.set(-3, 2, 3); scene.add(al);

    // rail — long curve
    const N_NODES = 3;
    const railLength = 18;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-railLength/2, -1.2,  2.0),
      new THREE.Vector3(-railLength/4,  0.6, -1.0),
      new THREE.Vector3(0,              1.2,  1.0),
      new THREE.Vector3( railLength/4,  0.0, -1.5),
      new THREE.Vector3( railLength/2,  1.4,  1.5)
    ]);
    const tubeGeom = new THREE.TubeGeometry(curve, 200, 0.012, 8, false);
    const tubeMat  = new THREE.MeshBasicMaterial({ color: PALETTE.line, transparent: true, opacity: 0.5 });
    const tube = new THREE.Mesh(tubeGeom, tubeMat);
    scene.add(tube);

    // a parallel "trail" of dots along the rail
    const trailCount = 80;
    const trailGeom = new THREE.BufferGeometry();
    const trailPos = new Float32Array(trailCount*3);
    for (let i = 0; i < trailCount; i++) {
      const p = curve.getPoint(i/(trailCount-1));
      trailPos[i*3] = p.x; trailPos[i*3+1] = p.y; trailPos[i*3+2] = p.z;
    }
    trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Points(trailGeom,
      new THREE.PointsMaterial({ color: PALETTE.lineSoft, size: 0.06, transparent: true, opacity: 0.6 }));
    scene.add(trail);

    // 3 nodes
    const nodes = [];
    const nodeColors = [PALETTE.accent, PALETTE.blue, PALETTE.green];
    for (let i = 0; i < N_NODES; i++) {
      const u = (i+0.5)/N_NODES;        // 0.166, 0.5, 0.833
      const p = curve.getPoint(u);
      const g = new THREE.Group();
      g.position.copy(p);

      // halo
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.46, 36),
        new THREE.MeshBasicMaterial({ color: nodeColors[i], side: THREE.DoubleSide, transparent: true, opacity: 0.22 }));
      halo.rotation.x = -Math.PI/2;
      g.add(halo);

      // core
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1),
        new THREE.MeshStandardMaterial({ color: nodeColors[i], emissive: nodeColors[i], emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4 }));
      g.add(core);

      // outer wireframe
      const wf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1),
        new THREE.MeshBasicMaterial({ color: PALETTE.line, wireframe: true, transparent: true, opacity: 0.4 }));
      g.add(wf);

      g.userData = { u, core, halo, wf, baseColor: nodeColors[i] };
      scene.add(g);
      nodes.push(g);
    }

    // moving probe — travels along the curve as user scrolls
    const probe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent2 }));
    scene.add(probe);
    // probe glow
    const probeHalo = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.28, 28),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent2, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    scene.add(probeHalo);

    // ambient particle dust
    const dustCount = 200;
    const dustG = new THREE.BufferGeometry();
    const dustP = new Float32Array(dustCount*3);
    for (let i = 0; i < dustCount; i++) {
      dustP[i*3]   = (Math.random()-0.5)*22;
      dustP[i*3+1] = (Math.random()-0.5)*8;
      dustP[i*3+2] = (Math.random()-0.5)*8;
    }
    dustG.setAttribute('position', new THREE.BufferAttribute(dustP, 3));
    const dust = new THREE.Points(dustG, new THREE.PointsMaterial({ color: PALETTE.line, size: 0.024, transparent: true, opacity: 0.35 }));
    scene.add(dust);

    function size() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(size).observe(canvas); size();

    let last = performance.now();
    function tick() {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = (now - last)/1000; last = now;
      const t = now * 0.001;

      const sp = stickyProgress(section);

      // probe along curve
      const u = Math.max(0.02, Math.min(0.98, sp*0.96 + 0.02));
      const pp = curve.getPoint(u);
      probe.position.copy(pp);
      probe.scale.setScalar(1 + Math.sin(t*4)*0.15);
      probeHalo.position.copy(pp);
      probeHalo.lookAt(camera.position);
      probeHalo.scale.setScalar(1 + Math.sin(t*3)*0.2);

      // active node = nearest
      let activeIdx = 0, minDx = Infinity;
      nodes.forEach((n, i) => {
        const dx = Math.abs(n.userData.u - u);
        if (dx < minDx) { minDx = dx; activeIdx = i; }
      });

      nodes.forEach((n, i) => {
        const isActive = (i === activeIdx);
        n.userData.core.material.emissiveIntensity = isActive ? 1.1 : 0.4;
        n.userData.halo.material.opacity = isActive ? 0.55 : 0.18;
        n.userData.wf.rotation.y += dt * (isActive ? 0.7 : 0.2);
        n.userData.wf.rotation.x += dt * (isActive ? 0.4 : 0.1);
        n.scale.setScalar(isActive ? 1.15 + Math.sin(t*3)*0.05 : 1.0);
      });

      // sync DOM cards / dots
      cards.forEach((c, i) => c.classList.toggle('active', i === activeIdx));
      dots.forEach((d, i)  => d.classList.toggle('active', i === activeIdx));

      // camera — follow probe along x with subtle parallax
      camera.position.x = pp.x * 0.85;
      camera.position.y = 1.6 + pp.y*0.3;
      camera.position.z = 6.0;
      camera.lookAt(pp.x*0.4, pp.y*0.5, 0);

      // colors
      al.color.setHex(ST.accent);
      probe.material.color.setHex(ST.accent2 ? ST.accent2 : PALETTE.accent2);

      // dust drift
      dust.rotation.y = t * 0.02;

      renderer.render(scene, camera);
    }
    tick();

    // click on a card scrolls so its node is centered
    cards.forEach((c, i) => {
      c.addEventListener('click', () => {
        const s = section;
        const travel = s.offsetHeight - window.innerHeight;
        const target = s.offsetTop + travel * ((i + 0.5) / N_NODES);
        window.scrollTo({ top: target, behavior: 'smooth' });
      });
    });
  })();

  // ============================================================
  // 4) PROJECT GALLERY — floating 3D cards, drag to orbit, click to focus
  // ============================================================
  (function ProjectGallery() {
    const canvas = document.getElementById('proj-canvas');
    if (!canvas) return;
    const projects = window.__PROJECTS || [];
    if (!projects.length) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(PALETTE.bg, 8, 28);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(0, 0.5, 10);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dl = new THREE.DirectionalLight(0xffffff, 0.7); dl.position.set(4,5,6); scene.add(dl);
    const al = new THREE.PointLight(PALETTE.accent, 1.0, 14); al.position.set(-2,2,4); scene.add(al);

    // build cards arranged in a sphere
    const cardGroup = new THREE.Group(); scene.add(cardGroup);
    const cards = [];
    const N = projects.length;

    // canvas-rendered card texture
    function makeCardTexture(p, idx) {
      const W = 512, H = 320;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d');

      // bg
      const grad = x.createLinearGradient(0,0,0,H);
      grad.addColorStop(0, '#0c2a5a');
      grad.addColorStop(1, '#001D47');
      x.fillStyle = grad; x.fillRect(0,0,W,H);

      // border
      x.strokeStyle = 'rgba(134,164,214,0.35)'; x.lineWidth = 2;
      x.strokeRect(8, 8, W-16, H-16);

      // top bar
      x.fillStyle = '#FF6F1A';
      x.fillRect(8,8,W-16,3);

      // header strip
      x.fillStyle = 'rgba(255,255,255,0.55)';
      x.font = '600 18px "JetBrains Mono", monospace';
      const id = String(idx+1).padStart(2,'0');
      x.fillText(`P.${id}`, 26, 44);
      x.textAlign = 'right';
      x.fillStyle = '#FFC857';
      x.fillText(p.cat.toUpperCase(), W-26, 44);
      x.textAlign = 'left';

      // icon glyph in middle
      drawIcon(x, p.icon, W/2, 130, 50);

      // title
      x.fillStyle = '#E8EDF5';
      x.font = '700 26px "Space Grotesk", sans-serif';
      wrapText(x, stripHTML(p.title), 26, 220, W-52, 30);

      // bottom strip
      x.fillStyle = 'rgba(232,237,245,0.5)';
      x.font = '500 14px "JetBrains Mono", monospace';
      x.fillText('VIEW →', 26, H-22);
      x.textAlign = 'right';
      x.fillText('● ACTIVE', W-26, H-22);

      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 4;
      return tex;
    }

    function stripHTML(s){ return s.replace(/<[^>]+>/g,''); }
    function wrapText(ctx, text, x, y, maxW, lh) {
      const words = text.split(' '); let line = '', yy = y;
      for (const w of words) {
        const test = line + w + ' ';
        const m = ctx.measureText(test);
        if (m.width > maxW && line) { ctx.fillText(line, x, yy); line = w + ' '; yy += lh; }
        else line = test;
      }
      if (line) ctx.fillText(line, x, yy);
    }
    function drawIcon(x, kind, cx, cy, sz) {
      x.save();
      x.translate(cx, cy);
      x.strokeStyle = '#FF6F1A'; x.lineWidth = 3; x.lineCap = 'round';
      x.fillStyle = '#FF6F1A';
      switch (kind) {
        case 'motor': // gear
          for (let i = 0; i < 10; i++) {
            const a = (i/10)*TAU;
            x.beginPath(); x.moveTo(Math.cos(a)*sz*0.7, Math.sin(a)*sz*0.7);
            x.lineTo(Math.cos(a)*sz, Math.sin(a)*sz); x.stroke();
          }
          x.beginPath(); x.arc(0,0,sz*0.55,0,TAU); x.stroke();
          x.beginPath(); x.arc(0,0,sz*0.18,0,TAU); x.fill();
          break;
        case 'power':
          x.beginPath(); x.moveTo(-sz*0.3, -sz*0.7); x.lineTo(sz*0.3, -sz*0.1); x.lineTo(0, 0); x.lineTo(sz*0.3, sz*0.7); x.stroke();
          break;
        case 'sensor':
          x.beginPath(); x.arc(0,0,sz*0.3,0,TAU); x.fill();
          x.beginPath(); x.arc(0,0,sz*0.55,-Math.PI*0.25,Math.PI*0.25); x.stroke();
          x.beginPath(); x.arc(0,0,sz*0.85,-Math.PI*0.25,Math.PI*0.25); x.stroke();
          break;
        case 'chart':
          x.beginPath();
          x.moveTo(-sz, sz*0.5); x.lineTo(-sz*0.4, -sz*0.1); x.lineTo(sz*0.1, sz*0.2); x.lineTo(sz*0.6, -sz*0.5); x.lineTo(sz, sz*0.4);
          x.stroke();
          break;
        case 'tree':
          x.beginPath(); x.moveTo(0, sz); x.lineTo(0, -sz*0.4); x.stroke();
          x.beginPath(); x.moveTo(0, -sz*0.4); x.lineTo(-sz*0.5, -sz*0.9); x.stroke();
          x.beginPath(); x.moveTo(0, -sz*0.4); x.lineTo(sz*0.5, -sz*0.9); x.stroke();
          x.beginPath(); x.arc(0,-sz*0.2,sz*0.2,0,TAU); x.fill();
          break;
        case 'peak':
          x.beginPath();
          for (let i = -sz; i <= sz; i += 4) {
            const yv = i === 0 ? -sz*0.8 : -Math.exp(-(i*i)/(sz*sz*0.05))*sz*0.8 + (Math.random()-0.5)*4;
            i === -sz ? x.moveTo(i, yv) : x.lineTo(i, yv);
          }
          x.stroke();
          break;
        case 'rfid':
          x.strokeRect(-sz*0.7, -sz*0.4, sz*1.4, sz*0.8);
          x.beginPath(); x.arc(-sz*0.4, 0, sz*0.18, 0, TAU); x.stroke();
          x.beginPath(); x.moveTo(sz*0.0, -sz*0.2); x.lineTo(sz*0.4, -sz*0.2); x.stroke();
          x.beginPath(); x.moveTo(sz*0.0, sz*0.0); x.lineTo(sz*0.5, sz*0.0); x.stroke();
          break;
        case 'data':
          for (let i = 0; i < 4; i++) {
            x.fillRect(-sz + i*sz*0.55, sz*0.6 - i*sz*0.3, sz*0.4, sz*0.4 + i*sz*0.3);
          }
          break;
        case 'solar':
          x.beginPath(); x.arc(0,0,sz*0.35,0,TAU); x.fill();
          for (let i = 0; i < 8; i++) {
            const a = (i/8)*TAU;
            x.beginPath(); x.moveTo(Math.cos(a)*sz*0.5, Math.sin(a)*sz*0.5); x.lineTo(Math.cos(a)*sz*0.9, Math.sin(a)*sz*0.9); x.stroke();
          }
          break;
        default:
          x.beginPath(); x.arc(0,0,sz*0.5,0,TAU); x.stroke();
      }
      x.restore();
    }

    // place each card on a sphere using fibonacci
    function fibSphere(i, n, R) {
      const phi = Math.acos(1 - 2*(i+0.5)/n);
      const theta = Math.PI*(1+Math.sqrt(5))*i;
      return new THREE.Vector3(R*Math.sin(phi)*Math.cos(theta), R*Math.sin(phi)*Math.sin(theta), R*Math.cos(phi));
    }

    const R = 4.4;
    projects.forEach((p, i) => {
      const tex = makeCardTexture(p, i);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
      const geom = new THREE.PlaneGeometry(1.7, 1.06);
      const m = new THREE.Mesh(geom, mat);
      const pos = fibSphere(i, N, R);
      m.position.copy(pos);
      m.userData = { idx: i, basePos: pos.clone(), data: p };
      cardGroup.add(m); cards.push(m);
    });

    // central core
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent, wireframe: true }));
    cardGroup.add(core);
    const coreSolid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: PALETTE.accent, transparent: true, opacity: 0.25 }));
    cardGroup.add(coreSolid);

    // drag-to-rotate
    let isDown = false, lastX = 0, lastY = 0, autoRotate = true;
    let rotY = 0, rotX = 0, vY = 0.004, vX = 0;

    canvas.addEventListener('pointerdown', (e) => {
      isDown = true; lastX = e.clientX; lastY = e.clientY; autoRotate = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      vY = dx * 0.005; vX = dy * 0.003;
      rotY += vY; rotX += vX;
      rotX = Math.max(-1.0, Math.min(1.0, rotX));
      lastX = e.clientX; lastY = e.clientY;
    });
    function stop() { isDown = false; setTimeout(() => { autoRotate = true; }, 2000); }
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointerleave', stop);
    canvas.addEventListener('pointercancel', stop);

    // click → focus card
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pressMoved = false, pressX = 0, pressY = 0;
    canvas.addEventListener('pointerdown', (e) => { pressMoved = false; pressX = e.clientX; pressY = e.clientY; });
    canvas.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX-pressX, e.clientY-pressY) > 6) pressMoved = true;
    });
    canvas.addEventListener('click', (e) => {
      if (pressMoved) return;
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left)/rect.width)*2 - 1;
      ndc.y = -((e.clientY - rect.top)/rect.height)*2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(cards, false);
      if (hits.length) focusCard(hits[0].object.userData.idx);
    });

    // detail panel
    const panel = document.querySelector('.proj-detail');
    const pdNum = panel.querySelector('.pd-num');
    const pdTitle = panel.querySelector('.pd-title');
    const pdDesc = panel.querySelector('.pd-desc');
    const pdTags = panel.querySelector('.pd-tags');
    const pdLink = panel.querySelector('.pd-link');
    const pdClose = panel.querySelector('.pd-close');

    let focused = -1;
    function focusCard(i) {
      focused = i;
      const p = projects[i];
      pdNum.textContent = `PROJECT.${String(i+1).padStart(2,'0')} · ${p.cat.toUpperCase()}`;
      pdTitle.innerHTML = p.title;
      pdDesc.innerHTML  = p.desc;
      pdTags.innerHTML  = p.tags.map(t => `<span class="chip">${t}</span>`).join('');
      pdLink.href = p.url;
      panel.classList.add('open');
    }
    pdClose.addEventListener('click', () => { focused = -1; panel.classList.remove('open'); });

    function size() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w/h; camera.updateProjectionMatrix();
    }
    new ResizeObserver(size).observe(canvas); size();

    let last = performance.now();
    function tick() {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt = (now - last)/1000; last = now;
      const t = now*0.001;

      if (autoRotate) { rotY += dt * 0.18; rotX += Math.sin(t*0.4)*0.0006; }
      cardGroup.rotation.y = rotY;
      cardGroup.rotation.x = rotX;

      // each card always faces the camera (billboard) but keeps its base offset
      cards.forEach((m, i) => {
        // gentle floating bob
        const bob = Math.sin(t*0.8 + i*0.7)*0.05;
        m.position.copy(m.userData.basePos.clone().multiplyScalar(1 + bob*0.04));
        // counter-rotate to face out
        m.lookAt(cardGroup.position.clone().applyMatrix4(cardGroup.matrixWorld));
        // simple billboard: face the camera in world space
        const wp = new THREE.Vector3(); m.getWorldPosition(wp);
        m.lookAt(camera.position);
        // counter parent rotation for a stable face
        m.rotation.x -= 0; // already correct via lookAt
        // highlight focused
        const isF = (i === focused);
        const targetScale = isF ? 1.6 : 1.0;
        m.scale.x += (targetScale - m.scale.x) * 0.1;
        m.scale.y += (targetScale - m.scale.y) * 0.1;
        m.material.opacity = focused === -1 ? 1 : (isF ? 1 : 0.35);
        m.material.transparent = true;
      });

      core.rotation.y += dt * 0.25;
      core.rotation.x += dt * 0.13;
      core.material.color.setHex(ST.accent);
      coreSolid.material.color.setHex(ST.accent);
      al.color.setHex(ST.accent);

      renderer.render(scene, camera);
    }
    tick();
  })();

})();
