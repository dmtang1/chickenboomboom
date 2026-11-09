import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { ARENA_R, GROUND_Y, GROUP_PROP, GROUP_RAG, GROUP_STATIC, rand } from './util.js';

export function createArena({ world, scene, art, groundMat, bouncyMat, toyMat, onBounce, onHammer, onLaunch }) {
  const visual = new THREE.Group();
  scene.add(visual);
  const bodies = [];
  const constraints = [];
  const addBody = world.addBody.bind(world);
  const addConstraint = world.addConstraint.bind(world);
  world.addBody = (body) => {
    bodies.push(body);
    return addBody(body);
  };
  world.addConstraint = (constraint) => {
    constraints.push(constraint);
    return addConstraint(constraint);
  };

  const floorBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, GROUND_Y - 0.5, 0),
    material: groundMat,
    collisionFilterGroup: GROUP_STATIC,
    collisionFilterMask: GROUP_RAG | GROUP_PROP,
  });
  floorBody.addShape(new CANNON.Cylinder(ARENA_R, ARENA_R, 1, 16));
  floorBody.gameRole = 'static';
  world.addBody(floorBody);

  const top = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_R, 64),
    new THREE.MeshStandardMaterial({ map: art.playMat, roughness: 0.86, metalness: 0 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = GROUND_Y + 0.01;
  top.receiveShadow = true;
  visual.add(top);

  const side = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_R, ARENA_R * 1.02, 1, 48, 1, true),
    art.plastic(0xffffff, { map: art.stripes, roughness: 0.45 }),
  );
  side.position.y = GROUND_Y - 0.5;
  visual.add(side);

  const wallH = 4.2;
  const wallThick = 0.95;
  const wallR = ARENA_R - wallThick * 0.35;
  const wallColors = [0xff5d73, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff922b, 0xc77dff, 0x4ecdc4, 0xfff3bf];
  const wallSegments = 24;
  const wallAxis = new CANNON.Vec3(0, 1, 0);
  for (let i = 0; i < wallSegments; i++) {
    const a = (i / wallSegments) * Math.PI * 2;
    const chord = 2 * wallR * Math.sin(Math.PI / wallSegments) * 1.08;
    const x = Math.cos(a) * wallR;
    const z = Math.sin(a) * wallR;
    const wall = new CANNON.Body({
      mass: 0,
      material: groundMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    wall.addShape(new CANNON.Box(new CANNON.Vec3(chord / 2, wallH / 2, wallThick / 2)));
    wall.position.set(x, GROUND_Y + wallH / 2, z);
    wall.quaternion.setFromAxisAngle(wallAxis, Math.PI / 2 - a);
    wall.gameRole = 'static';
    world.addBody(wall);

    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(chord, wallH, wallThick),
      art.plastic(wallColors[i % wallColors.length], { roughness: 0.42 }),
    );
    panel.position.set(x, GROUND_Y + wallH / 2, z);
    panel.quaternion.set(wall.quaternion.x, wall.quaternion.y, wall.quaternion.z, wall.quaternion.w);
    panel.castShadow = true;
    panel.receiveShadow = true;
    visual.add(panel);
  }

  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(wallR, 0.22, 8, 48),
    art.plastic(0xfff6e8, { roughness: 0.34 }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = GROUND_Y + wallH;
  lip.castShadow = true;
  lip.receiveShadow = true;
  visual.add(lip);

  const skyGeo = new THREE.SphereGeometry(180, 28, 16);
  const pos = skyGeo.attributes.position;
  const colors = [];
  const topCol = new THREE.Color('#6ec6ff');
  const midCol = new THREE.Color('#c5e8ff');
  const botCol = new THREE.Color('#ffe7a8');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 180;
    tmp.copy(botCol).lerp(midCol, THREE.MathUtils.smoothstep(y, -0.15, 0.25));
    tmp.lerp(topCol, THREE.MathUtils.smoothstep(y, 0.05, 0.65));
    colors.push(tmp.r, tmp.g, tmp.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }),
  );
  visual.add(sky);

  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
      puff.position.set(k * 1.5, Math.random() * 0.4, Math.random() * 0.4);
      puff.scale.setScalar(1.1 + Math.random() * 0.8);
      g.add(puff);
    }
    g.position.set(rand(-40, 40), 16 + Math.random() * 8, rand(-40, 40));
    g.userData.speed = 0.6 + Math.random() * 0.8;
    visual.add(g);
    clouds.push(g);
  }

  const pads = [];
  const bounceQueue = new Map();
  const padColors = [0x6bff8a, 0xff7ad9, 0x7ad0ff];
  const padSpots = [
    { x: 0, z: 7.1 },
    { x: -7.4, z: 2.2 },
    { x: 5.6, z: -6.6 },
  ];
  padSpots.forEach((spot, i) => {
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(spot.x, GROUND_Y + 0.18, spot.z),
      material: bouncyMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(1.45, 0.12, 1.45)));
    body.gameRole = 'tramp';
    world.addBody(body);

    const mesh = new THREE.Group();
    const bed = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 0.22, 24),
      art.plastic(padColors[i], { roughness: 0.28 }),
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.1, 8, 24),
      art.plastic(0xfff4c2, { roughness: 0.35 }),
    );
    ring.rotation.x = Math.PI / 2;
    mesh.add(bed, ring);
    mesh.position.set(spot.x, GROUND_Y + 0.2, spot.z);
    visual.add(mesh);
    const pad = { body, mesh, squash: 1 };
    body.pad = pad;
    pads.push(pad);

    body.addEventListener('collide', (e) => {
      const other = e.body;
      if (other.gameRole !== 'ragdoll' && other.gameRole !== 'prop') return;
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (impact < 1.3 && other.velocity.y > -0.5) return;
      const prev = bounceQueue.get(other);
      if (!prev || impact > prev.impact) {
        bounceQueue.set(other, {
          body: other,
          impact,
          pad,
          pos: { x: other.position.x, y: body.position.y + 0.5, z: other.position.z },
        });
      }
    });
  });

  const hammers = [];
  const torque = new CANNON.Vec3();
  const headLocal = new CANNON.Vec3(0, -4.55, 0);
  const headWorld = new CANNON.Vec3();
  const swing = new CANNON.Vec3();
  let pendingHammer = null;
  let lastBonk = 0;
  function addHammer({ x, y, z, axis, speed, phase }) {
    const anchor = new CANNON.Body({ mass: 0 });
    anchor.addShape(new CANNON.Sphere(0.15));
    anchor.position.set(x, y, z);
    anchor.collisionFilterGroup = GROUP_STATIC;
    anchor.collisionFilterMask = 0;
    world.addBody(anchor);

    const body = new CANNON.Body({
      mass: 11,
      position: new CANNON.Vec3(x, y, z),
      material: toyMat,
      linearDamping: 0.2,
      angularDamping: 0.22,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.12, 2.15, 0.12)), new CANNON.Vec3(0, -2.15, 0));
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.8, 0.5, 0.8)), new CANNON.Vec3(0, -4.55, 0));
    body.gameRole = 'hammer';
    body.angularVelocity.set(axis.x * 0.8, axis.y * 0.8, axis.z * 0.8);
    world.addBody(body);

    const hinge = new CANNON.HingeConstraint(anchor, body, {
      pivotA: new CANNON.Vec3(0, 0, 0),
      pivotB: new CANNON.Vec3(0, 0, 0),
      axisA: new CANNON.Vec3(axis.x, axis.y, axis.z),
      axisB: new CANNON.Vec3(axis.x, axis.y, axis.z),
      collideConnected: false,
    });
    world.addConstraint(hinge);

    const mesh = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 4.3, 0.24), art.plastic(0xfff6e8, { roughness: 0.5 }));
    handle.position.y = -2.15;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), art.plastic(0xff3b3b, { roughness: 0.32 }));
    head.position.y = -4.55;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.18, 1.66), art.plastic(0xffd23f));
    band.position.y = -4.55;
    mesh.add(handle, head, band);
    mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    visual.add(mesh);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 3.2, 10),
      art.plastic(0xffffff, { map: art.stripes, roughness: 0.4 }),
    );
    pole.position.set(x, y + 1.6, z);
    visual.add(pole);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), art.plastic(0xffd23f));
    cap.position.set(x, y, z);
    visual.add(cap);

    body.addEventListener('collide', (e) => {
      if (e.body.gameRole !== 'ragdoll') return;
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (!Number.isFinite(impact) || impact < 0.9) return;
      if (performance.now() - lastBonk < 460) return;
      body.quaternion.vmult(headLocal, headWorld);
      body.angularVelocity.cross(headWorld, swing);
      swing.vadd(body.velocity, swing);
      let dx = swing.x;
      let dz = swing.z;
      let horiz = Math.hypot(dx, dz);
      const speedNow = swing.length();
      if (horiz < Math.max(0.45, speedNow * 0.35)) {
        dx = e.body.position.x - body.position.x;
        dz = e.body.position.z - body.position.z;
        horiz = Math.hypot(dx, dz) || 1;
      }
      const p = e.body.position;
      const rel = e.contact.bi === body ? e.contact.ri : e.contact.rj;
      const headHit = rel.length() > 3.3;
      const hit = {
        impact,
        pos: { x: p.x, y: p.y, z: p.z },
        dir: { x: dx / horiz, y: 0, z: dz / horiz },
        headHit,
      };
      if (!pendingHammer || (hit.headHit && !pendingHammer.headHit) || (hit.headHit === pendingHammer.headHit && hit.impact > pendingHammer.impact)) {
        pendingHammer = hit;
      }
    });

    hammers.push({ body, mesh, axis, speed, phase });
  }

  addHammer({ x: 7.2, y: 6.7, z: 1.6, axis: { x: 0, y: 0, z: 1 }, speed: 1.55, phase: 0 });
  addHammer({ x: -1.2, y: 6.7, z: -7.2, axis: { x: 1, y: 0, z: 0 }, speed: 1.4, phase: 1.2 });

  const cannons = [];
  function addCannon(x, y, z, dir) {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const d = { x: dir.x / len, y: dir.y / len, z: dir.z / len };
    const group = new THREE.Group();
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.78, 2.2, 16),
      art.plastic(0xff3344, { roughness: 0.35 }),
    );
    barrel.rotation.x = Math.PI / 2;
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 0.28, 16),
      art.plastic(0xffd23f),
    );
    stripe.rotation.x = Math.PI / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 1.4), art.plastic(0x3d7eff));
    base.position.set(0, -0.7, -0.2);
    group.add(barrel, stripe, base);

    const yaw = Math.atan2(d.x, d.z);
    group.position.set(x, y, z);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(d.x, d.y, d.z));
    group.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    visual.add(group);

    const body = new CANNON.Body({
      mass: 0,
      material: groundMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.55, 0.35, 0.7)));
    body.position.set(x, y - 0.15, z);
    body.quaternion.setFromEuler(0, yaw, 0);
    body.gameRole = 'static';
    world.addBody(body);

    const muzzle = {
      x: x + d.x * 1.7,
      y: y + d.y * 1.7,
      z: z + d.z * 1.7,
    };
    cannons.push({ dir: d, muzzle, cool: 0, mesh: group });
  }

  addCannon(-12.2, GROUND_Y + 0.85, -4.2, { x: 0.78, y: 0.48, z: 0.32 });
  addCannon(12.2, GROUND_Y + 0.85, 4.6, { x: -0.72, y: 0.5, z: -0.28 });

  const muds = [
    { x: 6.4, z: 5.2, r: 2.35 },
    { x: -6.2, z: -4.6, r: 2.25 },
  ];
  const mudMeshes = muds.map((m) => {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(m.r, 28),
      new THREE.MeshStandardMaterial({
        color: 0x3dcc6e,
        roughness: 0.18,
        metalness: 0.02,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(m.x, GROUND_Y + 0.04, m.z);
    visual.add(mesh);
    const blobMat = art.plastic(0x7dffb0, { roughness: 0.15 });
    for (let i = 0; i < 4; i++) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.18 + Math.random() * 0.12, 8, 6), blobMat);
      blob.position.set(rand(-m.r * 0.6, m.r * 0.6), 0.08, rand(-m.r * 0.6, m.r * 0.6));
      blob.scale.y = 0.45;
      mesh.add(blob);
    }
    m.mesh = mesh;
    return mesh;
  });

  const ramp = new CANNON.Body({
    mass: 0,
    material: groundMat,
    collisionFilterGroup: GROUP_STATIC,
    collisionFilterMask: GROUP_RAG | GROUP_PROP,
  });
  ramp.addShape(new CANNON.Box(new CANNON.Vec3(1.3, 0.12, 2.1)));
  ramp.position.set(8.2, GROUND_Y + 0.55, -5.4);
  ramp.quaternion.setFromEuler(-0.38, 0.4, 0);
  ramp.gameRole = 'static';
  world.addBody(ramp);
  const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 4.2), art.plastic(0xff8a3d, { roughness: 0.4 }));
  rampMesh.position.set(ramp.position.x, ramp.position.y, ramp.position.z);
  rampMesh.quaternion.set(ramp.quaternion.x, ramp.quaternion.y, ramp.quaternion.z, ramp.quaternion.w);
  rampMesh.castShadow = true;
  rampMesh.receiveShadow = true;
  visual.add(rampMesh);

  world.addBody = addBody;
  world.addConstraint = addConstraint;

  let live = true;
  function setActive(on) {
    if (live === on) return;
    live = on;
    visual.visible = on;
    if (on) {
      for (const body of bodies) if (!body.world) world.addBody(body);
      for (const constraint of constraints) world.addConstraint(constraint);
    } else {
      for (const constraint of constraints) world.removeConstraint(constraint);
      for (const body of bodies) if (body.world) world.removeBody(body);
    }
  }

  function mudAt(x, y, z) {
    if (!live) return false;
    if (y > GROUND_Y + 1.9) return false;
    for (const m of muds) {
      const dx = x - m.x;
      const dz = z - m.z;
      if (dx * dx + dz * dz < m.r * m.r) return true;
    }
    return false;
  }

  return {
    hammers,
    cannons,
    muds,
    mudAt,
    setActive,
    prePhysics(dt, time, torsoBody, launchLock) {
      if (!live) return;
      for (const h of hammers) {
        const push = Math.cos(time * h.speed + h.phase) * 220;
        torque.set(h.axis.x * push, h.axis.y * push, h.axis.z * push);
        h.body.applyTorque(torque);
      }
      for (const c of cannons) c.cool = Math.max(0, c.cool - dt);
      if (!torsoBody || launchLock > 0) return;
      const p = torsoBody.position;
      for (const c of cannons) {
        if (c.cool > 0) continue;
        const dx = p.x - c.muzzle.x;
        const dy = p.y - c.muzzle.y;
        const dz = p.z - c.muzzle.z;
        if (dx * dx + dy * dy + dz * dz < 1.7 * 1.7) {
          c.cool = 1.6;
          onLaunch(c.dir, { x: c.muzzle.x, y: c.muzzle.y, z: c.muzzle.z });
          break;
        }
      }
    },
    applyBounces() {
      if (pendingHammer) {
        const hit = pendingHammer;
        pendingHammer = null;
        lastBonk = performance.now();
        onHammer(hit.impact, hit.pos, hit.dir, hit.headHit);
      }
      for (const bounce of bounceQueue.values()) {
        const body = bounce.body;
        if (!body.world) continue;
        const boost = 12 + Math.min(bounce.impact, 10) * 0.4;
        if (body.velocity.y < boost) body.velocity.y = boost;
        body.wakeUp();
        bounce.pad.squash = 0.4;
        onBounce(bounce.pos, bounce.impact);
      }
      bounceQueue.clear();
    },
    sync(dt, time) {
      if (!live) return;
      for (const h of hammers) {
        h.mesh.position.set(h.body.position.x, h.body.position.y, h.body.position.z);
        h.mesh.quaternion.set(h.body.quaternion.x, h.body.quaternion.y, h.body.quaternion.z, h.body.quaternion.w);
      }
      for (const pad of pads) {
        pad.squash += (1 - pad.squash) * Math.min(1, dt * 8);
        pad.mesh.scale.y = 0.72 + pad.squash * 0.28;
      }
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 55) cloud.position.x = -55;
      }
      mudMeshes.forEach((mesh, i) => {
        mesh.position.y = GROUND_Y + 0.035 + Math.sin(time * 2 + i) * 0.02;
        mesh.rotation.z = Math.sin(time * 0.4 + i) * 0.04;
      });
    },
  };
}
