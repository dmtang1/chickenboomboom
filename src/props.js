import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ARENA_R, GROUND_Y, GROUP_PROP, GROUP_RAG, GROUP_STATIC, pick, rand } from './util.js';

const KNOCK_TYPES = new Set(['foam', 'jenga', 'crate', 'pin', 'plank']);

export function createProps({ world, scene, art, toyMat, rubberMat, targets, onImpact }) {
  const items = [];
  const queue = [];
  const pt = new CANNON.Vec3();
  let rainIn = 2.2;

  const foamGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const crateGeo = new THREE.BoxGeometry(0.78, 0.78, 0.78);
  const jengaGeo = new THREE.BoxGeometry(0.96, 0.15, 0.31);
  const plankGeo = new THREE.BoxGeometry(0.48, 0.08, 0.26);
  const candyGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const pinGeo = new THREE.CylinderGeometry(0.05, 0.12, 0.5, 10);
  const pinBandGeo = new THREE.TorusGeometry(0.09, 0.022, 6, 12);

  function track(mesh, body) {
    mesh.userData.body = body;
    mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    scene.add(mesh);
    targets.push(mesh);
  }

  function untrack(mesh) {
    scene.remove(mesh);
    const i = targets.indexOf(mesh);
    if (i >= 0) targets.splice(i, 1);
  }

  function makeBody({ mass, x, y, z, material, shape, offset, rotY = 0, damping = 0.06 }) {
    const body = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(x, y, z),
      material,
      linearDamping: damping,
      angularDamping: damping,
      allowSleep: true,
      sleepSpeedLimit: 0.18,
      sleepTimeLimit: 0.45,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(shape, offset);
    if (rotY) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY);
    body.gameRole = 'prop';
    world.addBody(body);
    return body;
  }

  function bind(body, item) {
    body.item = item;
    body.addEventListener('collide', (e) => {
      const other = e.body;
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (!Number.isFinite(impact) || impact < 2.2) return;
      const now = performance.now();
      if (now - (body.lastHit || 0) < 70) return;

      const direct = other.gameRole === 'ragdoll' || other.gameRole === 'hammer';
      const otherHot = !!(other.item && other.item.hotUntil > now);
      const selfHot = item.hotUntil > now;
      if (!direct && !otherHot && !selfHot) return;
      if (!direct && other.gameRole === 'prop' && body.id > other.id) return;

      body.lastHit = now;
      item.hotUntil = now + 1300;
      if (other.item) other.item.hotUntil = Math.max(other.item.hotUntil || 0, now + 900);

      e.contact.bi.position.vadd(e.contact.ri, pt);
      const pos = { x: pt.x, y: pt.y + 0.15, z: pt.z };
      onImpact({ impact, pos, item, direct });

      if (!item.dead && item.type === 'pinata' && direct && impact > 6) {
        item.dead = true;
        queue.push({ kind: 'pinata', item, pos });
      } else if (!item.dead && item.type === 'crate' && direct && impact > 10.5) {
        item.dead = true;
        queue.push({ kind: 'crate', item, pos });
      }
    });
  }

  function pushItem(type, body, mesh, extra = {}) {
    const item = { type, body, mesh, hotUntil: 0, dead: false, orbited: false, born: performance.now(), ...extra };
    items.push(item);
    bind(body, item);
    track(mesh, body);
    mesh.position.set(body.position.x, body.position.y, body.position.z);
    mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    if (extra.sleep) body.sleep();
    return item;
  }

  function spawn(type, x, y, z, extra = {}) {
    if (type === 'foam') {
      const mat = pick(art.foamMats);
      const mesh = new THREE.Mesh(foamGeo, mat);
      const body = makeBody({
        mass: 0.26,
        x, y, z,
        material: toyMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.25, 0.25, 0.25)),
      });
      return pushItem('foam', body, mesh, extra);
    }
    if (type === 'crate') {
      const mesh = new THREE.Mesh(crateGeo, art.crateMat);
      const body = makeBody({
        mass: 2.1,
        x, y, z,
        material: toyMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.39, 0.39, 0.39)),
      });
      return pushItem('crate', body, mesh, extra);
    }
    if (type === 'jenga') {
      const mesh = new THREE.Mesh(jengaGeo, art.woodMat);
      const body = makeBody({
        mass: 0.38,
        x, y, z,
        material: toyMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.48, 0.075, 0.155)),
        rotY: extra.rotY || 0,
      });
      return pushItem('jenga', body, mesh, extra);
    }
    if (type === 'plank') {
      const mesh = new THREE.Mesh(plankGeo, art.woodMat);
      const body = makeBody({
        mass: 0.18,
        x, y, z,
        material: toyMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.24, 0.04, 0.13)),
      });
      body.quaternion.setFromEuler(rand(0, 3), rand(0, 3), rand(0, 3));
      return pushItem('plank', body, mesh, extra);
    }
    if (type === 'candy') {
      const mesh = new THREE.Mesh(candyGeo, pick(art.foamMats));
      const body = makeBody({
        mass: 0.08,
        x, y, z,
        material: toyMat,
        shape: new CANNON.Box(new CANNON.Vec3(0.08, 0.08, 0.08)),
      });
      return pushItem('candy', body, mesh, extra);
    }
    if (type === 'pin') {
      const mesh = new THREE.Group();
      const bodyMesh = new THREE.Mesh(pinGeo, art.pinMat);
      const band = new THREE.Mesh(pinBandGeo, art.pinBand);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.06;
      mesh.add(bodyMesh, band);
      const body = makeBody({
        mass: 0.32,
        x, y, z,
        material: toyMat,
        shape: new CANNON.Cylinder(0.05, 0.12, 0.5, 8),
      });
      return pushItem('pin', body, mesh, extra);
    }
    if (type === 'duck') {
      const s = extra.scale || 1;
      const group = new THREE.Group();
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), art.duckMat);
      belly.scale.set(1.15, 0.82, 1.05);
      belly.position.y = 0.18;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), art.duckMat);
      head.position.set(0, 0.55, 0.36);
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.28), art.beakMat);
      beak.position.set(0, 0.52, 0.68);
      const eyeMatW = new THREE.MeshBasicMaterial({ color: 0xfffdfb });
      const eyeMatB = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMatW);
        eye.position.set(side * 0.1, 0.6, 0.54);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyeMatB);
        pupil.position.z = 0.03;
        eye.add(pupil);
        group.add(eye);
      }
      const wingGeo = new THREE.SphereGeometry(0.22, 10, 8);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(wingGeo, art.duckMat);
        wing.position.set(side * 0.42, 0.2, 0);
        wing.scale.set(0.35, 0.7, 1);
        group.add(wing);
      }
      group.add(belly, head, beak);
      group.scale.setScalar(s);

      const body = new CANNON.Body({
        mass: 1.15 * s,
        position: new CANNON.Vec3(x, y, z),
        material: rubberMat,
        linearDamping: 0.08,
        angularDamping: 0.12,
        allowSleep: true,
        collisionFilterGroup: GROUP_PROP,
        collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
      });
      body.addShape(new CANNON.Sphere(0.48 * s), new CANNON.Vec3(0, 0.18 * s, 0));
      body.addShape(new CANNON.Sphere(0.28 * s), new CANNON.Vec3(0, 0.55 * s, 0.36 * s));
      body.addShape(
        new CANNON.Box(new CANNON.Vec3(0.07 * s, 0.045 * s, 0.14 * s)),
        new CANNON.Vec3(0, 0.52 * s, 0.68 * s),
      );
      body.gameRole = 'prop';
      world.addBody(body);
      return pushItem('duck', body, group, { ...extra, scale: s });
    }
    if (type === 'pinata') {
      const mesh = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 14), art.pinataMat);
      const hat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 8), art.pinBand);
      hat.position.y = 0.5;
      mesh.add(ball, hat);
      const body = makeBody({
        mass: 0.65,
        x, y, z,
        material: toyMat,
        shape: new CANNON.Sphere(0.48),
        damping: 0.08,
      });
      return pushItem('pinata', body, mesh, extra);
    }
    if (type === 'float') {
      const mesh = art.floatMesh();
      const body = new CANNON.Body({
        mass: 6.4,
        position: new CANNON.Vec3(x, y, z),
        material: toyMat,
        linearDamping: 0.1,
        angularDamping: 0.16,
        allowSleep: true,
        collisionFilterGroup: GROUP_PROP,
        collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
      });
      body.addShape(new CANNON.Box(new CANNON.Vec3(1.7, 0.16, 0.85)), new CANNON.Vec3(0, 0.28, 0));
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.36, 0.35, 0.58)), new CANNON.Vec3(-1.15, 0.82, 0));
      body.addShape(new CANNON.Sphere(0.48), new CANNON.Vec3(0.15, 1.2, 0));
      body.gameRole = 'prop';
      world.addBody(body);
      return pushItem('float', body, mesh, extra);
    }
    return null;
  }

  function remove(item) {
    const idx = items.indexOf(item);
    if (idx < 0) return;
    items.splice(idx, 1);
    world.removeBody(item.body);
    untrack(item.mesh);
  }

  function burstPieces(origin, kind) {
    if (kind === 'pinata') {
      for (let i = 0; i < 8; i++) {
        const candy = spawn('candy', origin.x + rand(-0.2, 0.2), origin.y + rand(0, 0.3), origin.z + rand(-0.2, 0.2));
        candy.body.velocity.set(rand(-7, 7), rand(4, 10), rand(-7, 7));
        candy.body.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const piece = spawn('plank', origin.x, origin.y + 0.2, origin.z);
        piece.body.velocity.set(rand(-5, 5), rand(2, 7), rand(-5, 5));
        piece.body.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      }
    }
  }

  function flush() {
    const batch = queue.splice(0, queue.length);
    for (const job of batch) {
      const origin = {
        x: job.item.body.position.x,
        y: job.item.body.position.y,
        z: job.item.body.position.z,
      };
      remove(job.item);
      burstPieces(origin, job.kind);
    }
  }

  function spawnJenga(x, z) {
    for (let layer = 0; layer < 6; layer++) {
      const horizontal = layer % 2 === 0;
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * 0.32;
        spawn(
          'jenga',
          x + (horizontal ? 0 : offset),
          GROUND_Y + 0.09 + layer * 0.17,
          z + (horizontal ? offset : 0),
          { rotY: horizontal ? 0 : Math.PI / 2, sleep: true },
        );
      }
    }
  }

  function spawnPins(x, z) {
    const rows = 4;
    for (let row = 0; row < rows; row++) {
      for (let c = 0; c <= row; c++) {
        spawn(
          'pin',
          x + (c - row / 2) * 0.45,
          GROUND_Y + 0.27,
          z + row * 0.46,
          { sleep: true },
        );
      }
    }
  }

  function spawnPyramid(x, z) {
    const step = 0.52;
    for (let layer = 0; layer < 4; layer++) {
      const n = 4 - layer;
      const y = GROUND_Y + 0.26 + layer * step;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          spawn(
            'foam',
            x + (i - (n - 1) / 2) * step,
            y,
            z + (j - (n - 1) / 2) * step,
            { sleep: true },
          );
        }
      }
    }
  }

  const WAVE_THEMES = ['ducks', 'pins', 'float'];
  const WAVE_LABEL = { ducks: 'DUCKS!', pins: 'PINS!', float: 'PARADE!' };
  let waveCursor = 0;

  function nudgeWave(item, cx, cz) {
    const p = item.body.position;
    item.body.velocity.set((cx - p.x) * 0.35 + rand(-0.4, 0.4), rand(-0.3, 1.1), (cz - p.z) * 0.35 + rand(-0.4, 0.4));
    item.body.angularVelocity.set(rand(-2.5, 2.5), rand(-2.5, 2.5), rand(-2.5, 2.5));
    item.body.wakeUp();
  }

  function spawnWave(x = 0, z = 0) {
    const theme = WAVE_THEMES[waveCursor % WAVE_THEMES.length];
    waveCursor += 1;
    const sky = 15 + Math.random() * 4;
    if (theme === 'ducks') {
      for (let i = 0; i < 7; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 2.3;
        const scale = i === 0 ? 1.75 : 0.85 + Math.random() * 0.45;
        const item = spawn('duck', x + Math.cos(angle) * radius, sky + i * 0.55, z + Math.sin(angle) * radius, { scale });
        nudgeWave(item, x, z);
      }
    } else if (theme === 'pins') {
      for (let row = 0; row < 4; row++) {
        for (let c = 0; c <= row; c++) {
          const item = spawn(
            'pin',
            x + (c - row / 2) * 0.48,
            sky + 0.4,
            z - 0.7 + row * 0.48,
          );
          nudgeWave(item, x, z);
        }
      }
      const bowler = spawn('duck', x, sky + 3.4, z - 2.2, { scale: 1.15 });
      bowler.body.velocity.set(0, -0.2, 3.4);
      bowler.body.wakeUp();
    } else {
      const item = spawn('float', x, sky + 2, z);
      item.body.angularVelocity.set(rand(-1.2, 1.2), rand(-0.8, 0.8), rand(-1.2, 1.2));
      item.body.wakeUp();
    }
    return WAVE_LABEL[theme];
  }

  function spawnPile(x = 0, z = 0) {
    const kinds = ['foam', 'foam', 'foam', 'crate', 'pin', 'duck', 'pinata', 'foam'];
    for (let i = 0; i < 16; i++) {
      const type = pick(kinds);
      const y = GROUND_Y + 5 + i * 0.42;
      if (type === 'duck') spawn('duck', x + rand(-2, 2), y, z + rand(-2, 2), { scale: Math.random() < 0.25 ? 1.3 : 1 });
      else spawn(type, x + rand(-2.2, 2.2), y, z + rand(-2.2, 2.2));
    }
  }

  function populate() {
    spawnJenga(-5.6, 3.1);
    spawnPins(5.3, 2.4);
    spawnPyramid(0.4, -6.3);
    for (let i = 0; i < 3; i++) {
      spawn('crate', -4.4, GROUND_Y + 0.42 + i * 0.82, 5.4, { sleep: true });
    }
    for (let i = 0; i < 2; i++) {
      spawn('crate', 7.4, GROUND_Y + 0.42 + i * 0.82, -3.4, { sleep: true });
    }
    spawn('duck', 3.4, GROUND_Y + 0.85, 4.4, { scale: 1.35, sleep: true });
    spawn('duck', -2.6, GROUND_Y + 0.7, 6.2, { scale: 1, sleep: true });
    spawn('duck', 6.6, GROUND_Y + 0.7, -6.4, { scale: 1, sleep: true });
    spawn('pinata', -6.6, GROUND_Y + 0.55, -1.4, { sleep: true });
    spawn('pinata', 2.4, GROUND_Y + 0.55, -2.6, { sleep: true });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      spawn('foam', Math.cos(a) * 3.3, GROUND_Y + 0.3, Math.sin(a) * 3.3, { sleep: true });
    }
  }

  let enabled = true;
  function setActive(on) {
    if (enabled === on) return;
    enabled = on;
    for (const item of items) {
      item.mesh.visible = on;
      if (on) {
        if (!item.body.world) world.addBody(item.body);
      } else if (item.body.world) {
        world.removeBody(item.body);
      }
    }
  }

  function update(dt, torsoPos) {
    if (!enabled) return;
    flush();
    rainIn -= dt;
    if (rainIn <= 0) {
      rainIn = 3.6 + Math.random() * 1.4;
      if (items.length < 78) {
        const n = 2 + ((Math.random() * 3) | 0);
        const weights = [
          ['foam', 5],
          ['crate', 2],
          ['pin', 3],
          ['duck', 2],
          ['pinata', 1],
        ];
        for (let i = 0; i < n; i++) {
          let roll = Math.random() * 13;
          let type = 'foam';
          for (const [name, w] of weights) {
            roll -= w;
            if (roll <= 0) {
              type = name;
              break;
            }
          }
          const a = Math.random() * Math.PI * 2;
          const r = 2.5 + Math.random() * (ARENA_R - 5);
          let x = Math.cos(a) * r;
          let z = Math.sin(a) * r;
          if (torsoPos && (x - torsoPos.x) ** 2 + (z - torsoPos.z) ** 2 < 10) {
            x += 4.5;
          }
          const y = 13 + Math.random() * 6;
          if (type === 'duck') spawn(type, x, y, z, { scale: Math.random() < 0.2 ? 1.3 : 1 });
          else spawn(type, x, y, z);
        }
      }
    }

    const now = performance.now();
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const p = item.body.position;
      if (item.type === 'duck' && !item.orbited) {
        const v = item.body.velocity;
        const rising = p.y > 15 && v.y > 4;
        const yeet = p.y > 8 && v.y > 8 && v.length() > 16;
        if (rising || yeet) {
          item.orbited = true;
          onImpact({ impact: 18, pos: { x: p.x, y: p.y, z: p.z }, item, direct: true, duckOrbit: true });
        }
      }
      if (p.y < -8 || Math.abs(p.x) > 36 || Math.abs(p.z) > 36) remove(item);
    }

    if (items.length > 100) {
      const victim = items.find((item) => item.body.sleepState === CANNON.Body.SLEEPING || item.born < now - 20000);
      if (victim) remove(victim);
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const b = item.body;
      item.mesh.position.set(b.position.x, b.position.y, b.position.z);
      item.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    }
  }

  return {
    items,
    spawn,
    spawnPile,
    spawnWave,
    populate,
    update,
    setActive,
    count: () => items.length,
    knockTypes: KNOCK_TYPES,
  };
}
