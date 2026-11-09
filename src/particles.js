import * as THREE from 'three';

export function createParticles(scene, sprite) {
  const MAX = 900;
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setDrawRange(0, 0);

  const mat = new THREE.PointsMaterial({
    size: 0.38,
    map: sprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
    alphaTest: 0.15,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const pool = [];
  for (let i = 0; i < MAX; i++) {
    pool.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, g: 9, r: 1, gch: 1, b: 1 });
  }
  let cursor = 0;
  const color = new THREE.Color();

  function burst(x, y, z, opts = {}) {
    const count = opts.count ?? 10;
    const colorsIn = opts.colors ?? [0xfff1a8];
    const speed = opts.speed ?? 4;
    const life = opts.life ?? 0.6;
    const gravity = opts.gravity ?? 10;
    const up = opts.up ?? 1.5;
    for (let i = 0; i < count; i++) {
      const p = pool[cursor];
      cursor = (cursor + 1) % MAX;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.35 + Math.random() * 0.65);
      p.on = true;
      p.x = x + (Math.random() - 0.5) * 0.2;
      p.y = y + (Math.random() - 0.5) * 0.2;
      p.z = z + (Math.random() - 0.5) * 0.2;
      p.vx = Math.sin(phi) * Math.cos(theta) * sp;
      p.vy = Math.cos(phi) * sp * 0.65 + up * Math.random();
      p.vz = Math.sin(phi) * Math.sin(theta) * sp;
      p.life = life * (0.65 + Math.random() * 0.5);
      p.max = p.life;
      p.g = gravity;
      color.setHex(colorsIn[(Math.random() * colorsIn.length) | 0]);
      p.r = color.r;
      p.gch = color.g;
      p.b = color.b;
    }
  }

  function update(dt) {
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.on = false;
        continue;
      }
      p.vy -= p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const fade = Math.min(1, p.life / (p.max * 0.4));
      positions[n * 3] = p.x;
      positions[n * 3 + 1] = p.y;
      positions[n * 3 + 2] = p.z;
      colors[n * 3] = p.r * fade;
      colors[n * 3 + 1] = p.gch * fade;
      colors[n * 3 + 2] = p.b * fade;
      n++;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function shift(dx, dy, dz) {
    if (!dx && !dy && !dz) return;
    for (let i = 0; i < MAX; i++) {
      const p = pool[i];
      if (!p.on) continue;
      p.x += dx;
      p.y += dy;
      p.z += dz;
    }
  }

  return { burst, update, shift };
}
