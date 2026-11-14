import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

function canvasTex(size, draw, { srgb = true, wrap = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  tex.needsUpdate = true;
  if (wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  g.fill();
}

export function createArt(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const aniso = renderer.capabilities.getMaxAnisotropy();

  const star = canvasTex(128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.translate(64, 64);
    g.fillStyle = '#ffe566';
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const b = a + Math.PI / 5;
      g.lineTo(Math.cos(a) * 56, Math.sin(a) * 56);
      g.lineTo(Math.cos(b) * 24, Math.sin(b) * 24);
    }
    g.closePath();
    g.fill();
  });

  const playMat = canvasTex(1024, (g, s) => {
    g.fillStyle = '#fffdf8';
    g.fillRect(0, 0, s, s);
    const colors = ['#ff5d73', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b', '#c77dff', '#4ecdc4', '#fff3bf'];
    const n = 8;
    const cell = s / n;
    const gap = 18;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = colors[(x + y * 3) % colors.length];
        roundRect(g, x * cell + gap / 2, y * cell + gap / 2, cell - gap, cell - gap, 36);
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.arc(Math.random() * s, Math.random() * s, 6 + Math.random() * 10, 0, Math.PI * 2);
      g.fill();
    }
  });

  const stripes = canvasTex(256, (g, s) => {
    const colors = ['#ff5d73', '#ffd93d', '#4d96ff', '#6bcb77', '#c77dff', '#ff922b'];
    const w = s / colors.length;
    colors.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(i * w, 0, w + 1, s);
    });
  }, { wrap: true });

  const crate = canvasTex(256, (g, s) => {
    g.fillStyle = '#d5924e';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#e0a66a';
    g.fillRect(18, 18, s - 36, s - 36);
    g.strokeStyle = '#8a5528';
    g.lineWidth = 16;
    g.strokeRect(14, 14, s - 28, s - 28);
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(24, s / 2);
    g.lineTo(s - 24, s / 2);
    g.moveTo(s / 2, 24);
    g.lineTo(s / 2, s - 24);
    g.stroke();
    g.fillStyle = '#5c3a1c';
    for (const [x, y] of [[48, 48], [208, 48], [48, 208], [208, 208]]) {
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
  });

  const pinata = canvasTex(256, (g, s) => {
    const cols = ['#ff4d6d', '#ffe66d', '#4dabf7', '#51cf66', '#ff922b', '#cc5de8', '#fff', '#ff4d6d'];
    const w = s / cols.length;
    cols.forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(i * w, 0, w + 1, s);
    });
    g.fillStyle = 'rgba(80, 40, 0, 0.18)';
    for (let i = 0; i < 28; i++) g.fillRect(i * 10, s - 48, 4, 48);
  });

  const soft = canvasTex(64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2 - 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }, { srgb: false });

  for (const tex of [star, playMat, stripes, crate, pinata, soft]) {
    tex.anisotropy = aniso;
  }

  function plastic(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.38,
      metalness: opts.metalness ?? 0.04,
      map: opts.map ?? null,
      emissive: new THREE.Color(opts.emissive ?? 0x000000),
      emissiveIntensity: opts.emissive ? 0.35 : 0,
      envMapIntensity: 0.5,
    });
  }

  const foamColors = [0xff5d73, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff922b, 0xc77dff, 0x4ecdc4, 0xfff3bf];
  const foamMats = foamColors.map((c) => plastic(c, { roughness: 0.48 }));
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const duckBellyGeo = new THREE.SphereGeometry(0.46, 14, 10);
  const duckHeadGeo = new THREE.SphereGeometry(0.26, 12, 10);
  const beakGeo = new THREE.BoxGeometry(0.13, 0.08, 0.26);
  const eyeGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const pupilGeo = new THREE.SphereGeometry(0.02, 8, 8);
  const pinGeo = new THREE.CylinderGeometry(0.1, 0.16, 0.78, 10);
  const pinBandGeo = new THREE.TorusGeometry(0.115, 0.03, 6, 12);
  const balloonGeo = new THREE.SphereGeometry(0.48, 14, 12);
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10);
  const ballGeo = new THREE.SphereGeometry(0.34, 14, 12);
  const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.95, 6);
  const yellow = plastic(0xffe14a, { roughness: 0.34 });
  const orange = plastic(0xff922b, { roughness: 0.42 });
  const pinWhite = plastic(0xfff6ea, { roughness: 0.36 });
  const pinRed = plastic(0xff3355, { roughness: 0.4 });
  const deckMat = plastic(0xfff3bf, { roughness: 0.42 });
  const skirtMat = plastic(0xff5d73, { roughness: 0.4 });
  const cabMat = plastic(0x4d96ff, { roughness: 0.4 });
  const wheelMat = plastic(0x2b2f38, { roughness: 0.62 });
  const ballMat = plastic(0x1c1f27, { roughness: 0.34 });
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xfffdfb });
  const eyeBlack = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });

  function shade(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function duckMesh() {
    const mesh = new THREE.Group();
    const belly = shade(new THREE.Mesh(duckBellyGeo, yellow));
    belly.scale.set(1.12, 0.78, 1.02);
    belly.position.y = 0.16;
    const head = shade(new THREE.Mesh(duckHeadGeo, yellow));
    head.position.set(0, 0.48, 0.3);
    const beak = shade(new THREE.Mesh(beakGeo, orange));
    beak.position.set(0, 0.46, 0.54);
    for (const side of [-1, 1]) {
      const eye = shade(new THREE.Mesh(eyeGeo, eyeWhite));
      eye.position.set(side * 0.1, 0.54, 0.46);
      const pupil = new THREE.Mesh(pupilGeo, eyeBlack);
      pupil.position.z = 0.03;
      eye.add(pupil);
      mesh.add(eye);
    }
    mesh.add(belly, head, beak);
    return mesh;
  }

  function pinMesh() {
    const mesh = new THREE.Group();
    const body = shade(new THREE.Mesh(pinGeo, pinWhite));
    body.position.y = 0.39;
    const band = shade(new THREE.Mesh(pinBandGeo, pinRed));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.52;
    mesh.add(body, band);
    return mesh;
  }

  function ballMesh() {
    return shade(new THREE.Mesh(ballGeo, ballMat));
  }

  function floatMesh() {
    const mesh = new THREE.Group();
    const skirt = shade(new THREE.Mesh(unitBox, skirtMat));
    skirt.scale.set(3.55, 0.22, 1.86);
    skirt.position.y = 0.12;
    const deck = shade(new THREE.Mesh(unitBox, deckMat));
    deck.scale.set(3.35, 0.28, 1.68);
    deck.position.y = 0.32;
    const stripe = shade(new THREE.Mesh(unitBox, cabMat));
    stripe.scale.set(3.35, 0.08, 1.68);
    stripe.position.y = 0.48;
    const cab = shade(new THREE.Mesh(unitBox, cabMat));
    cab.scale.set(0.72, 0.7, 1.15);
    cab.position.set(-1.15, 0.82, 0);
    const balloon = shade(new THREE.Mesh(balloonGeo, yellow));
    balloon.position.set(0.15, 1.2, 0);
    const rider = duckMesh();
    rider.scale.setScalar(0.72);
    rider.position.set(0.95, 0.5, 0);
    const pole = shade(new THREE.Mesh(poleGeo, wheelMat));
    pole.position.set(1.45, 1.05, 0);
    const flag = shade(new THREE.Mesh(unitBox, skirtMat));
    flag.scale.set(0.02, 0.32, 0.55);
    flag.position.set(1.45, 1.42, 0.22);
    for (const [x, z] of [[-1.2, 0.78], [-1.2, -0.78], [1.15, 0.78], [1.15, -0.78]]) {
      const wheel = shade(new THREE.Mesh(wheelGeo, wheelMat));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.24, z);
      mesh.add(wheel);
    }
    mesh.add(skirt, deck, stripe, cab, balloon, rider, pole, flag);
    return mesh;
  }

  return {
    envMap,
    star,
    playMat,
    stripes,
    soft,
    plastic,
    foamMats,
    crateMat: plastic(0xffffff, { map: crate, roughness: 0.62, metalness: 0 }),
    pinataMat: plastic(0xffffff, { map: pinata, roughness: 0.55, metalness: 0 }),
    woodMat: plastic(0xe0a15a, { roughness: 0.7, metalness: 0 }),
    duckMat: plastic(0xffd000, { roughness: 0.32 }),
    beakMat: plastic(0xff7a18, { roughness: 0.4 }),
    pinMat: plastic(0xfffaf2, { roughness: 0.32 }),
    pinBand: plastic(0xff3355, { roughness: 0.35 }),
    duckMesh,
    pinMesh,
    ballMesh,
    floatMesh,
  };
}
