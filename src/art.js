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
  };
}
