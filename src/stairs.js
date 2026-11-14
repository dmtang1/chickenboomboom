import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GROUP_PROP, GROUP_RAG, GROUP_STATIC, rand } from './util.js';

const ANCHOR_Y = 52;
const MOODS = [
  { id: 'flight', name: 'STAIRS', dAngle: 0.34, drop: 0.52, radius: 4.15 },
  { id: 'bounce', name: 'BOUNCE', dAngle: 0.36, drop: 0.64, radius: 4.45 },
  { id: 'spin', name: 'SPINNERS', dAngle: 0.32, drop: 0.5, radius: 4.3 },
  { id: 'ice', name: 'ICE SLIDE', dAngle: 0.2, drop: 0.86, radius: 5.2, ramp: true },
  { id: 'wind', name: 'CROSSWIND', dAngle: 0.3, drop: 0.56, radius: 4.7 },
  { id: 'crumble', name: 'CRUMBLE', dAngle: 0.34, drop: 0.5, radius: 4.25 },
  { id: 'rings', name: 'RINGS', dAngle: 0.5, drop: 1.2, radius: 3.45 },
];

const AXIS_Y = new CANNON.Vec3(0, 1, 0);
const AXIS_X = new CANNON.Vec3(1, 0, 0);
const AXIS_Z = new CANNON.Vec3(0, 0, 1);
const STAIR_W = 15;
const _yaw = new CANNON.Quaternion();
const _pitch = new CANNON.Quaternion();
const _q = new CANNON.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

export function createStairs({ world, scene, art, ragdoll, toyMat, rubberMat, bouncyMat, ragMat, onEvent }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const stepMat = new CANNON.Material('step');
  const iceMat = new CANNON.Material('ice');
  const spikePhys = new CANNON.Material('spike');
  world.addContactMaterial(new CANNON.ContactMaterial(stepMat, ragMat, { friction: 0.14, restitution: 0.46 }));
  world.addContactMaterial(new CANNON.ContactMaterial(spikePhys, ragMat, { friction: 0.05, restitution: 0.34 }));
  world.addContactMaterial(new CANNON.ContactMaterial(stepMat, toyMat, { friction: 0.4, restitution: 0.22 }));
  world.addContactMaterial(new CANNON.ContactMaterial(iceMat, ragMat, { friction: 0.03, restitution: 0.06 }));
  world.addContactMaterial(new CANNON.ContactMaterial(iceMat, toyMat, { friction: 0.04, restitution: 0.12 }));

  const colors = [0xff5d73, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff922b, 0xc77dff, 0x4ecdc4, 0xfff3bf];
  const mats = colors.map((color) => art.plastic(color, { roughness: 0.42 }));
  const noseMat = art.plastic(0xfffdf8, { roughness: 0.32 });
  const bounceMat = art.plastic(0x67f5a0, { roughness: 0.2, emissive: 0x1c8a48 });
  const iceLook = art.plastic(0xd9f6ff, { roughness: 0.06, metalness: 0.18, emissive: 0x8ecfff });
  const crumbleLook = art.plastic(0xff9a3c, { roughness: 0.74 });
  const spinLook = art.plastic(0xff3355, { roughness: 0.3 });
  const spikeLook = art.plastic(0xd51f3a, { roughness: 0.32, emissive: 0x6a1020 });
  const coneGeo = new THREE.ConeGeometry(0.18, 0.7, 6);
  const spinBand = art.plastic(0xffe14a);
  const bellLook = art.plastic(0xffd23f, { roughness: 0.22, metalness: 0.42 });
  const hoopLook = art.plastic(0xfff36b, { roughness: 0.28, emissive: 0xffc107 });
  const hoopGot = art.plastic(0xb8ffcf, { roughness: 0.28, emissive: 0x3dcc6e });
  const ropeLook = art.plastic(0xfff6e8, { roughness: 0.5 });
  const cloudLook = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
  const windLook = new THREE.MeshBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const treadGeo = new THREE.BoxGeometry(2.8, 0.22, 1.45);
  const noseGeo = new THREE.BoxGeometry(2.8, 0.07, 0.16);
  const rampGeo = new THREE.BoxGeometry(2.7, 0.2, 3.05);
  const spinGeo = new THREE.BoxGeometry(2.55, 0.2, 0.26);
  const bandGeo = new THREE.BoxGeometry(2.55, 0.08, 0.3);
  const crateGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const ballGeo = new THREE.SphereGeometry(0.42, 14, 12);
  const bellGeo = new THREE.SphereGeometry(0.64, 16, 12);
  const hoopGeo = new THREE.TorusGeometry(1.35, 0.09, 8, 22);
  const debrisGeo = new THREE.BoxGeometry(0.32, 0.16, 0.42);
  const ropeGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);

  const skyGeo = new THREE.SphereGeometry(210, 28, 16);
  const skyPos = skyGeo.attributes.position;
  const skyColors = [];
  const topCol = new THREE.Color('#6aa7ff');
  const midCol = new THREE.Color('#ffd0ea');
  const botCol = new THREE.Color('#ffe0b0');
  const tmp = new THREE.Color();
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 210;
    tmp.copy(botCol).lerp(midCol, THREE.MathUtils.smoothstep(y, -0.35, 0.15));
    tmp.lerp(topCol, THREE.MathUtils.smoothstep(y, 0.05, 0.7));
    skyColors.push(tmp.r, tmp.g, tmp.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  root.add(sky);

  const deck = new THREE.Mesh(
    new THREE.CircleGeometry(96, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff2e4, side: THREE.DoubleSide }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.frustumCulled = false;
  root.add(deck);

  const cloudLayer = new THREE.Group();
  root.add(cloudLayer);
  for (let i = 0; i < 14; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudLook);
    const blob = new THREE.Group();
    puff.scale.set(2.4 + Math.random() * 2.2, 1.1, 1.6 + Math.random());
    blob.add(puff);
    blob.position.set(rand(-42, 42), rand(-48, 26), rand(-42, 42));
    blob.userData.speed = 7 + Math.random() * 8;
    cloudLayer.add(blob);
  }

  const ents = [];
  const pending = new Map();
  let running = false;
  let cx = 0;
  let cz = 0;
  let angle = 0;
  let cursorY = ANCHOR_Y;
  let stepIndex = 0;
  let fallen = 0;
  let shownMood = 'STAIRS';
  let simTime = 0;
  let openingPose = null;
  let stuckTime = 0;
  let layout = 'spiral';
  const WAVE_THEMES = ['ducks', 'pins', 'float'];
  const WAVE_LABEL = { ducks: 'DUCKS!', pins: 'PINS!', float: 'PARADE!' };
  let waveCursor = 0;
  let runX = 0;
  let snagUntil = 0;
  let stall = 0;
  let stallMark = 0;
  let hopUntil = 0;
  let hopGrace = 0;

  function moodOf(i) {
    return MOODS[Math.floor(i / 14) % MOODS.length];
  }

  function orient(body, yaw, pitch = 0) {
    _yaw.setFromAxisAngle(AXIS_Y, yaw);
    if (pitch) {
      _pitch.setFromAxisAngle(AXIS_X, pitch);
      _yaw.mult(_pitch, _q);
      body.quaternion.set(_q.x, _q.y, _q.z, _q.w);
    } else {
      body.quaternion.set(_yaw.x, _yaw.y, _yaw.z, _yaw.w);
    }
  }

  function pose(ent) {
    const b = ent.body;
    ent.mesh.position.set(b.position.x, b.position.y, b.position.z);
    ent.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  }

  function decorate(mesh) {
    mesh.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    root.add(mesh);
  }

  function listen(body, ent) {
    body.addEventListener('collide', (e) => {
      if (!ent.scoreHits || e.body.gameRole !== 'ragdoll') return;
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (!Number.isFinite(impact) || impact < (ent.minImpact || 1.7)) return;
      const p = e.body.position;
      const prev = pending.get(ent);
      if (!prev || impact > prev.impact) {
        pending.set(ent, { impact, pos: { x: p.x, y: p.y + 0.3, z: p.z } });
      }
    });
  }

  function staticBody(x, y, z, shape, material) {
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y, z),
      material,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(shape);
    body.gameRole = 'static';
    world.addBody(body);
    return body;
  }

  function track(ent) {
    ents.push(ent);
    if (ent.mesh) decorate(ent.mesh);
    if (ent.body) {
      listen(ent.body, ent);
      if (ent.mesh) pose(ent);
    }
    return ent;
  }

  function removeEnt(ent) {
    if (ent.body && ent.body.world) world.removeBody(ent.body);
    if (ent.mesh) root.remove(ent.mesh);
    if (ent.rope) root.remove(ent.rope);
    const index = ents.indexOf(ent);
    if (index >= 0) ents.splice(index, 1);
    pending.delete(ent);
  }

  function addStep(x, y, z, yaw, mood, opts) {
    const span = opts.span || 2.8 * (opts.narrow ? 0.72 : opts.wide ? 1.35 : 1.12);
    const scaleX = span / 2.8;
    const look = opts.crumble ? crumbleLook : opts.bounce ? bounceMat : mats[opts.color % mats.length];
    const mesh = new THREE.Group();
    const tread = new THREE.Mesh(treadGeo, look);
    tread.scale.x = scaleX;
    const depth = opts.depth || 1.45;
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.scale.x = scaleX;
    nose.position.set(0, 0.1, depth / 2 - 0.08);
    mesh.add(tread, nose);
    const body = staticBody(
      x, y, z,
      new CANNON.Box(new CANNON.Vec3(span / 2, 0.11, depth / 2)),
      opts.slick ? iceMat : stepMat,
    );
    tread.scale.z = depth / 1.45;
    if (opts.rails) {
      const hx = span / 2 - 0.28;
      const railH = opts.slick ? 0.28 : 0.55;
      const railZ = depth * 0.42;
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.18, railH, railZ)), new CANNON.Vec3(hx, railH * 0.85, 0));
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.18, railH, railZ)), new CANNON.Vec3(-hx, railH * 0.85, 0));
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.36, railH * 2, depth * 0.92), noseMat);
        rail.position.set(side * hx, railH * 0.85, 0);
        mesh.add(rail);
      }
    }
    orient(body, yaw, opts.pitch ?? 0.42);
    return track({
      kind: 'step',
      moodName: mood.name,
      body,
      mesh,
      solid: true,
      top: 0.14,
      baseScaleX: 1,
      scoreHits: true,
      breakable: !!opts.crumble,
      boost: opts.bounce ? 12 : 0,
      minImpact: 1.7,
    });
  }

  function addRamp(x, y, z, yaw, mood) {
    const mesh = new THREE.Mesh(rampGeo, iceLook);
    const body = staticBody(x, y, z, new CANNON.Box(new CANNON.Vec3(1.35, 0.1, 1.52)), iceMat);
    orient(body, yaw, 0.48);
    return track({
      kind: 'ramp',
      moodName: mood.name,
      body,
      mesh,
      solid: true,
      top: 0.45,
      baseScaleX: 1,
      scoreHits: true,
      minImpact: 1.5,
    });
  }

  function addPlatform(x, y, z, radius, opening) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.04, 0.4, 28),
      opening ? mats[4] : mats[2],
    );
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.1, 8, 28),
      noseMat,
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.16;
    mesh.add(lip);
    const body = staticBody(x, y, z, new CANNON.Cylinder(radius, radius, 0.4, 10), stepMat);
    const ent = track({
      kind: 'step',
      moodName: 'STAIRS',
      body,
      mesh,
      solid: true,
      top: 0.22,
      baseScaleX: 1,
      scoreHits: !opening,
      opening: !!opening,
      minImpact: 2,
    });
    if (opening) ent.crumble = 2.5;
    return ent;
  }

  function addSpinner(x, y, z) {
    const mesh = new THREE.Group();
    const bar = new THREE.Mesh(spinGeo, spinLook);
    const band = new THREE.Mesh(bandGeo, spinBand);
    mesh.add(bar, band);
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      position: new CANNON.Vec3(x, y + 1.65, z),
      material: toyMat,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(1.27, 0.1, 0.13)));
    body.gameRole = 'prop';
    world.addBody(body);
    return track({
      kind: 'spinner',
      body,
      mesh,
      angle: Math.random() * Math.PI,
      spin: rand(2.4, 4.2) * (Math.random() < 0.5 ? -1 : 1),
      scoreHits: true,
      minImpact: 2.2,
      flair: 'BONK!',
    });
  }

  function addBeater(x, y, z, span) {
    const mesh = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, span * 0.78), spinLook);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, span * 0.78), spinBand);
    mesh.add(bar, band);
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      position: new CANNON.Vec3(x, y + 1.05, z),
      material: toyMat,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.21, 0.21, span * 0.39)));
    body.gameRole = 'prop';
    world.addBody(body);
    return track({
      kind: 'beater',
      body,
      mesh,
      angle: Math.random() * Math.PI,
      spin: rand(1.6, 2.6) * (Math.random() < 0.5 ? -1 : 1),
      scoreHits: true,
      minImpact: 2,
      flair: 'BONK!',
    });
  }

  function addSpikes(x, y, z, yaw, { count = 16, span = 10, side = 0 } = {}) {
    const mesh = new THREE.Group();
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y + 0.12, z),
      material: spikePhys,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    const gap = span / Math.max(1, count - 1);
    for (let i = 0; i < count; i++) {
      const lx = side + (i - (count - 1) / 2) * gap;
      const cone = new THREE.Mesh(coneGeo, spikeLook);
      cone.scale.set(0.72, 0.55, 0.72);
      cone.position.set(lx, 0.22, 0.05);
      mesh.add(cone);
      body.addShape(new CANNON.Cylinder(0.02, 0.09, 0.34, 5), new CANNON.Vec3(lx, 0.16, 0.05));
    }
    body.gameRole = 'static';
    world.addBody(body);
    orient(body, yaw, 0.18);
    return track({
      kind: 'spike',
      body,
      mesh,
      scoreHits: true,
      minImpact: 2.4,
      flair: 'POKE!',
    });
  }

  function addPendulum(y, x = cx, z = cz, plane = 'x') {
    const pivot = { x, y: y + (plane === 'z' ? 3.4 : 2.5), z };
    const len = plane === 'z' ? 4.2 : 2.35;
    const mesh = new THREE.Mesh(bellGeo, bellLook);
    const rope = new THREE.Mesh(ropeGeo, ropeLook);
    rope.castShadow = true;
    root.add(rope);
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      position: new CANNON.Vec3(pivot.x, pivot.y - len, pivot.z),
      material: toyMat,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Sphere(0.64));
    body.gameRole = 'prop';
    world.addBody(body);
    return track({
      kind: 'pendulum',
      body,
      mesh,
      rope,
      pivot,
      len,
      plane,
      speed: rand(1.15, 1.7),
      phase: Math.random() * Math.PI * 2,
      scoreHits: true,
      minImpact: 2.4,
      flair: 'WHAM!',
    });
  }

  function addHoop(y) {
    const mesh = new THREE.Mesh(hoopGeo, hoopLook);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(cx, y - 0.2, cz);
    root.add(mesh);
    return track({
      kind: 'hoop',
      mesh,
      x: cx,
      y: y - 0.2,
      z: cz,
      got: false,
    });
  }

  function addWind(x, y, z, heading, index) {
    const side = index % 2 === 0 ? 1 : -1;
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 8), windLook);
    mesh.position.set(x, y + 0.9, z);
    mesh.rotation.z = -Math.PI / 2 * side;
    mesh.rotation.y = heading;
    root.add(mesh);
    return track({
      kind: 'wind',
      mesh,
      x,
      y: y + 0.7,
      z,
      fx: Math.cos(heading) * side,
      fz: Math.sin(heading) * side,
      blew: false,
    });
  }

  function addCrate(x, y, z) {
    const mesh = new THREE.Mesh(crateGeo, mats[(Math.random() * mats.length) | 0]);
    const body = new CANNON.Body({
      mass: 1.15,
      position: new CANNON.Vec3(x, y, z),
      material: toyMat,
      linearDamping: 0.08,
      angularDamping: 0.08,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.35, 0.35, 0.35)));
    body.gameRole = 'prop';
    world.addBody(body);
    return track({
      kind: 'crate',
      body,
      mesh,
      scoreHits: true,
      minImpact: 2.4,
      ttl: 14,
    });
  }

  function addBall(x, y, z) {
    const mesh = new THREE.Mesh(ballGeo, mats[(Math.random() * mats.length) | 0]);
    const body = new CANNON.Body({
      mass: 0.42,
      position: new CANNON.Vec3(x, y, z),
      material: rubberMat,
      linearDamping: 0.04,
      angularDamping: 0.04,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(new CANNON.Sphere(0.42));
    body.gameRole = 'prop';
    world.addBody(body);
    return track({
      kind: 'ball',
      body,
      mesh,
      scoreHits: true,
      boost: 7,
      minImpact: 2,
      ttl: 14,
    });
  }

  function addDebris(x, y, z) {
    const mesh = new THREE.Mesh(debrisGeo, mats[(Math.random() * mats.length) | 0]);
    const body = new CANNON.Body({
      mass: 0.16,
      position: new CANNON.Vec3(x, y + 0.2, z),
      material: toyMat,
      linearDamping: 0.06,
      angularDamping: 0.06,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.16, 0.08, 0.21)));
    body.velocity.set(rand(-5, 5), rand(2, 7), rand(-5, 5));
    body.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    body.gameRole = 'prop';
    world.addBody(body);
    return track({ kind: 'debris', body, mesh, ttl: 2.6 });
  }

  function addCloud(heading, y, radius) {
    const dist = radius + 3.5;
    const x = cx + Math.cos(heading) * dist;
    const z = cz + Math.sin(heading) * dist;
    const mesh = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), cloudLook);
      puff.position.set((i - 1) * 0.7, Math.random() * 0.2, 0);
      puff.scale.setScalar(0.9 + Math.random() * 0.5);
      mesh.add(puff);
    }
    const body = new CANNON.Body({
      mass: 0,
      position: new CANNON.Vec3(x, y, z),
      material: bouncyMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(1.5, 0.28, 1.5)));
    body.gameRole = 'tramp';
    world.addBody(body);
    return track({
      kind: 'cloud',
      body,
      mesh,
      solid: true,
      top: 0.4,
      scoreHits: true,
      boost: 16,
      minImpact: 1.4,
    });
  }

  function debrisCount() {
    let n = 0;
    for (const ent of ents) if (ent.kind === 'debris' || ent.kind === 'crate' || ent.kind === 'ball') n += 1;
    return n;
  }

  function shatter(ent) {
    const p = ent.body.position;
    const pos = { x: p.x, y: p.y + 0.3, z: p.z };
    if (!ent.opening) {
      onEvent({
        pos,
        score: 16,
        flair: 'CRACK!',
        impact: 6,
        shake: 0.14,
        burst: 'crumble',
      });
    } else {
      onEvent({ pos, shake: 0.22, burst: 'crumble', callout: 'FLOOR IS OUT!' });
    }
    if (debrisCount() < 22) {
      for (let i = 0; i < 4; i++) addDebris(p.x + rand(-0.4, 0.4), p.y, p.z + rand(-0.4, 0.4));
    }
    removeEnt(ent);
  }

  function spawnStraight() {
    const i = stepIndex;
    stepIndex += 1;
    const drop = 0.78;
    const run = 1.02;
    cursorY -= drop;
    const x = runX;
    runX += run;
    addStep(x, cursorY, 0, Math.PI / 2, { name: 'STAIRS' }, {
      span: STAIR_W,
      depth: run + 0.18,
      pitch: Math.atan2(drop, run),
      slick: true,
      rails: true,
      color: Math.floor(i / 2),
      bounce: i % 22 === 16,
    });
    if (i === 0) {
      openingPose = { x, y: cursorY + 0.28 + 1.36, z: 0, vx: 1.8, vy: -0.3, vz: 0 };
    }
    if (i < 8) return;
    const slot = i % 18;
    if (slot === 4) {
      const toy = addCrate(x, cursorY + 0.55, rand(-3.2, 3.2));
      toy.body.velocity.set(0.35, 0, 0);
      toy.ttl = 12;
    } else if (slot === 9) {
      addSpikes(x, cursorY, 0, Math.PI / 2, { count: 4, span: 1.7, side: rand(-3.4, 3.4) });
    } else if (slot === 14) {
      addBeater(x, cursorY, rand(-2.6, 2.6), 3.1);
    } else if (slot === 0) {
      const ball = addBall(x, cursorY + 1.1, rand(-3.2, 3.2));
      ball.body.velocity.set(0.3, 0, 0);
      ball.ttl = 12;
    }
  }

  function spawnOne() {
    if (layout === 'straight') {
      spawnStraight();
      return;
    }
    const i = stepIndex;
    stepIndex += 1;
    if (i < 12) {
      cursorY -= 0.72;
      const x = cx + 1.6 + i * 1.7;
      const z = cz;
      const mood = MOODS[0];
      addStep(x, cursorY, z, Math.PI / 2, mood, {
        wide: true,
        color: i,
        bounce: i % 5 === 4,
      });
      if (i === 1) {
        openingPose = { x, y: cursorY + 0.2 + 1.36, z, vx: 3.4, vy: -2.2, vz: 0 };
      }
      if (i === 7) {
        const toy = addCrate(x, cursorY + 0.7, z + 0.4);
        toy.body.velocity.set(0, 0, 0);
      }
      if (i === 11) {
        cx = x - 4.1;
        cz = z;
        angle = 0;
      }
      return;
    }
    const mood = moodOf(i);
    angle += mood.dAngle;
    cursorY -= mood.drop;
    const radius = mood.radius + Math.sin(i * 0.37) * 0.35;
    const x = cx + Math.cos(angle) * radius;
    const z = cz + Math.sin(angle) * radius;
    const yaw = -angle;
    const gap = (mood.id === 'flight' && i % 9 === 8) || (mood.id === 'rings' && i % 2 === 1);
    if (!gap) {
      if (mood.ramp) addRamp(x, cursorY, z, yaw, mood);
      else {
        addStep(x, cursorY, z, yaw, mood, {
          bounce: mood.id === 'bounce' && i % 2 === 0,
          crumble: mood.id === 'crumble' && i % 4 !== 3,
          narrow: mood.id === 'rings',
          wide: i % 14 === 0,
          color: i,
        });
      }
    }
    if (mood.id === 'spin' && i % 2 === 0) addSpinner(x, cursorY, z);
    if (mood.id === 'spin' && i % 14 === 4) addPendulum(cursorY);
    if (mood.id === 'rings') addHoop(cursorY);
    if (mood.id === 'wind' && i % 3 === 0) addWind(x, cursorY, z, angle, i);
    if (i % 7 === 3 && debrisCount() < 16) {
      const toy = i % 2 === 0
        ? addCrate(cx + rand(-0.4, 0.4), cursorY + 0.8, cz + rand(-0.4, 0.4))
        : addBall(cx + rand(-0.5, 0.5), cursorY + 1.1, cz + rand(-0.5, 0.5));
      toy.body.velocity.set(rand(-1.5, 1.5), rand(-1, 1), rand(-1.5, 1.5));
    }
    if ((mood.id === 'flight' || mood.id === 'bounce') && i % 10 === 6) addCloud(angle, cursorY, radius);
  }

  function fillBelow(limit) {
    let guard = 0;
    while (cursorY > limit && ents.length < 210 && guard < 80) {
      spawnOne();
      guard += 1;
    }
  }

  function shiftBy(dx, dy, dz) {
    if (!dx && !dy && !dz) return;
    for (const ent of ents) {
      if (ent.body) {
        ent.body.position.x += dx;
        ent.body.position.y += dy;
        ent.body.position.z += dz;
        ent.body.previousPosition.copy(ent.body.position);
      }
      if (ent.kind === 'hoop' || ent.kind === 'wind') {
        ent.x += dx;
        ent.y += dy;
        ent.z += dz;
        if (ent.mesh) ent.mesh.position.set(ent.x, ent.kind === 'wind' ? ent.y + 0.2 : ent.y, ent.z);
      }
      if (ent.pivot) {
        ent.pivot.x += dx;
        ent.pivot.y += dy;
        ent.pivot.z += dz;
      }
    }
    for (const part of ragdoll.parts) {
      part.body.position.x += dx;
      part.body.position.y += dy;
      part.body.position.z += dz;
      part.body.previousPosition.copy(part.body.position);
    }
    cx += dx;
    cz += dz;
    cursorY += dy;
    runX += dx;
  }

  function flushHits() {
    const now = performance.now();
    for (const [ent, hit] of pending) {
      if (now - (ent.scoredAt || 0) < 420) continue;
      ent.scoredAt = now;
      if (ent.breakable && ent.crumble == null) ent.crumble = 0.42;
      const falling = ragdoll.torso.body.velocity.y;
      let flair = ent.flair || null;
      let score = 8 + hit.impact * 3.4;
      if (ent.boost) {
        const boost = ent.boost + Math.min(5, hit.impact * 0.25);
        const torso = ragdoll.torso.body;
        if (torso.velocity.y < boost) torso.velocity.y = boost;
        for (const limb of ragdoll.limbs) {
          if (limb.body.velocity.y < boost * 0.45) limb.body.velocity.y = boost * 0.45;
          limb.body.wakeUp();
        }
        flair = 'BOING!';
        score += 16;
      } else if (falling < -15) {
        flair = flair || 'TUMBLE!';
        score += 14;
      } else if (!flair && hit.impact > 8) {
        flair = 'BONK!';
      }
      onEvent({
        pos: hit.pos,
        score,
        flair,
        impact: hit.impact,
        shake: Math.min(0.28, hit.impact * 0.012),
        burst: ent.snag ? 'spike' : ent.boost ? 'bounce' : 'hit',
      });
    }
    pending.clear();
  }

  function tickCrumble(dt) {
    const doomed = [];
    for (const ent of ents) {
      if (ent.crumble == null) continue;
      ent.crumble -= dt;
      if (ent.mesh && ent.crumble < 0.7) {
        const wobble = 1 + Math.sin(ent.crumble * 46) * 0.06;
        ent.mesh.scale.x = (ent.baseScaleX || 1) * wobble;
      }
      if (ent.crumble <= 0) doomed.push(ent);
    }
    for (const ent of doomed) {
      if (ents.includes(ent)) shatter(ent);
    }
  }

  function animate(dt, torso) {
    for (const ent of ents) {
      if (ent.kind === 'spinner') {
        ent.angle += dt * ent.spin;
        ent.body.quaternion.setFromAxisAngle(AXIS_Y, ent.angle);
        ent.body.angularVelocity.set(0, ent.spin, 0);
      } else if (ent.kind === 'beater') {
        ent.angle += dt * ent.spin;
        ent.body.quaternion.setFromAxisAngle(AXIS_Z, ent.angle);
        ent.body.angularVelocity.set(0, 0, ent.spin);
      } else if (ent.kind === 'pendulum') {
        const swing = Math.sin(simTime * ent.speed + ent.phase) * (ent.plane === 'z' ? 0.85 : 1.05);
        const along = Math.sin(swing) * ent.len;
        const px = ent.plane === 'z' ? ent.pivot.x : ent.pivot.x + along;
        const py = ent.plane === 'z' ? ent.pivot.y - 2.15 : ent.pivot.y - Math.cos(swing) * ent.len;
        const pz = ent.plane === 'z' ? ent.pivot.z + along : ent.pivot.z;
        const step = Math.max(dt, 1 / 120);
        ent.body.velocity.set(
          (px - ent.body.position.x) / step,
          (py - ent.body.position.y) / step,
          (pz - ent.body.position.z) / step,
        );
        ent.body.position.set(px, py, pz);
      } else if (ent.kind === 'wind') {
        const dx = torso.position.x - ent.x;
        const dy = torso.position.y - ent.y;
        const dz = torso.position.z - ent.z;
        if (dx * dx + dy * dy + dz * dz < 8.5) {
          torso.velocity.x += ent.fx * dt * 24;
          torso.velocity.z += ent.fz * dt * 24;
          for (const limb of ragdoll.limbs) {
            limb.body.velocity.x += ent.fx * dt * 16;
            limb.body.velocity.z += ent.fz * dt * 16;
          }
          if (!ent.blew) {
            ent.blew = true;
            onEvent({ callout: 'WHOOSH', pos: { x: ent.x, y: ent.y, z: ent.z }, burst: 'wind' });
          }
        }
      }
    }
    let near = null;
    let nearD = Infinity;
    for (const ent of ents) {
      if (!ent.solid || !ent.body) continue;
      const b = ent.body.position;
      if (Math.abs(torso.position.y - b.y) > 5) continue;
      const d = (b.x - torso.position.x) ** 2 + (b.z - torso.position.z) ** 2;
      if (d < nearD) {
        nearD = d;
        near = b;
      }
    }
    const nearDist = Math.sqrt(nearD);
    if (layout === 'straight') {
      if (performance.now() > hopUntil && torso.velocity.y > -8 && torso.velocity.y < 3) {
        torso.velocity.y -= dt * 28;
      }
    } else if (near && nearDist > 2.8) {
      const want = Math.min(6.5, (nearDist - 2.2) * 2.2);
      const tx = ((near.x - torso.position.x) / nearDist) * want;
      const tz = ((near.z - torso.position.z) / nearDist) * want;
      const follow = nearDist > 6 ? 4.5 : 1.8;
      const k = 1 - Math.exp(-follow * dt);
      torso.velocity.x += (tx - torso.velocity.x) * k;
      torso.velocity.z += (tz - torso.velocity.z) * k;
    }
  }

  function announce(torso) {
    let best = null;
    let bestDy = Infinity;
    for (const ent of ents) {
      if (!ent.moodName || !ent.body || ent.opening) continue;
      const dy = torso.position.y - ent.body.position.y;
      if (dy < -0.3 || dy > 2.2) continue;
      const dx = torso.position.x - ent.body.position.x;
      const dz = torso.position.z - ent.body.position.z;
      if (dx * dx + dz * dz > (layout === 'straight' ? 140 : 8)) continue;
      if (dy < bestDy) {
        bestDy = dy;
        best = ent;
      }
    }
    if (best && best.moodName !== shownMood) {
      shownMood = best.moodName;
      onEvent({ callout: best.moodName });
    }
  }

  function checkHoops(torso) {
    for (const ent of ents) {
      if (ent.kind !== 'hoop' || ent.got) continue;
      if (Math.abs(torso.position.y - ent.y) > 0.9) continue;
      const dx = torso.position.x - ent.x;
      const dz = torso.position.z - ent.z;
      if (dx * dx + dz * dz > 1.2 * 1.2) continue;
      ent.got = true;
      ent.mesh.material = hoopGot;
      onEvent({
        pos: { x: ent.x, y: ent.y, z: ent.z },
        score: 60,
        flair: 'RING!',
        impact: 7,
        shake: 0.08,
        burst: 'ring',
      });
    }
  }

  function shiftDoll(dx, dy, dz) {
    if (!dx && !dy && !dz) return;
    for (const part of ragdoll.parts) {
      const b = part.body;
      b.position.x += dx;
      b.position.y += dy;
      b.position.z += dz;
      b.previousPosition.x += dx;
      b.previousPosition.y += dy;
      b.previousPosition.z += dz;
      if (dz > 0 && b.velocity.z < 0) b.velocity.z = 0;
      if (dz < 0 && b.velocity.z > 0) b.velocity.z = 0;
      if (dy > 0 && b.velocity.y < -6) b.velocity.y = -6;
    }
  }

  function straightDeck(x) {
    let prev = null;
    let next = null;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const ent of ents) {
      if (ent.kind !== 'step' || !ent.body) continue;
      const sx = ent.body.position.x;
      if (sx < minX) minX = sx;
      if (sx > maxX) maxX = sx;
      if (sx <= x && (!prev || sx > prev.body.position.x)) prev = ent;
      if (sx >= x && (!next || sx < next.body.position.x)) next = ent;
    }
    if (!prev && !next) return null;
    const deckY = (ent) => ent.body.position.y + (ent.top || 0.14);
    let y;
    if (prev && next && prev !== next) {
      const span = next.body.position.x - prev.body.position.x || 1;
      const t = (x - prev.body.position.x) / span;
      y = deckY(prev) + (deckY(next) - deckY(prev)) * t;
    } else {
      y = deckY(prev || next);
    }
    return { y, minX, maxX };
  }

  function contain(torso) {
    if (layout === 'straight') {
      const deck = straightDeck(torso.position.x);
      if (!deck) return;
      const limit = STAIR_W * 0.5 - 1.15;
      let x = torso.position.x;
      let dx = 0;
      if (x < deck.minX) dx = deck.minX - x;
      else if (x > deck.maxX) dx = deck.maxX - x;
      x += dx;
      const here = dx ? straightDeck(x) : deck;
      const floorY = here ? here.y : deck.y;
      let dy = 0;
      if (torso.position.y < floorY - 1.4) dy = floorY + 1.05 - torso.position.y;
      let dz = 0;
      if (torso.position.z > limit) dz = limit - torso.position.z;
      else if (torso.position.z < -limit) dz = -limit - torso.position.z;
      shiftDoll(dx, dy, dz);
      for (const part of ragdoll.parts) {
        const b = part.body;
        const edge = STAIR_W * 0.5 - 0.35;
        if (b.position.z > edge) {
          b.position.z = edge;
          b.previousPosition.z = edge;
          if (b.velocity.z > 0) b.velocity.z = 0;
        } else if (b.position.z < -edge) {
          b.position.z = -edge;
          b.previousPosition.z = -edge;
          if (b.velocity.z < 0) b.velocity.z = 0;
        }
      }
      return;
    }
    let best = null;
    let bestD = Infinity;
    for (const ent of ents) {
      if (!ent.solid || !ent.body) continue;
      const b = ent.body.position;
      const d = (b.x - torso.position.x) ** 2 + (b.z - torso.position.z) ** 2;
      const dy = torso.position.y - b.y;
      if (dy < -6) continue;
      if (d < bestD) {
        bestD = d;
        best = ent;
      }
    }
    if (!best) return;
    const b = best.body.position;
    const dist = Math.sqrt(bestD);
    let dx = 0;
    let dz = 0;
    if (dist > 4.8) {
      const pull = dist - 2.4;
      dx = ((b.x - torso.position.x) / dist) * pull;
      dz = ((b.z - torso.position.z) / dist) * pull;
    }
    let dy = 0;
    const floorY = b.y + (best.top || 0.14);
    if (torso.position.y < floorY - 2.4) dy = floorY + 1.15 - torso.position.y;
    shiftDoll(dx, dy, dz);
  }

  function onDeck(torso) {
    for (const ent of ents) {
      if (!ent.solid || !ent.body) continue;
      const dy = torso.position.y - ent.body.position.y;
      if (dy < 0.05 || dy > 2.5) continue;
      const dx = torso.position.x - ent.body.position.x;
      const dz = torso.position.z - ent.body.position.z;
      const reach = layout === 'straight' ? 10 : 3.2;
      if (dx * dx + dz * dz <= reach * reach) return true;
    }
    return false;
  }

  function recenter(torso) {
    let dx = 0;
    let dy = 0;
    let dz = 0;
    if (torso.position.x > 16 || torso.position.x < -16) dx = -torso.position.x;
    if (torso.position.z > 16 || torso.position.z < -16) dz = -torso.position.z;
    if (torso.position.y < ANCHOR_Y - 5) dy = ANCHOR_Y - torso.position.y;
    if (!dx && !dy && !dz) return null;
    shiftBy(dx, dy, dz);
    return { dx, dy, dz };
  }

  function focus() {
    const t = ragdoll.torso.body.position;
    if (layout === 'straight') return { x: t.x + 8, z: t.z };
    let best = null;
    let bestD = Infinity;
    for (const ent of ents) {
      if (!ent.solid || !ent.body) continue;
      const b = ent.body.position;
      const dy = t.y - b.y;
      if (dy < -1.2 || dy > 7) continue;
      const d = (b.x - t.x) ** 2 + (b.z - t.z) ** 2 + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best ? { x: best.x, z: best.z } : { x: cx, z: cz };
  }

  function clear() {
    running = false;
    while (ents.length) removeEnt(ents[ents.length - 1]);
    pending.clear();
    root.visible = false;
  }

  function begin(mode) {
    clear();
    if (mode === 'straight' || mode === 'spiral') layout = mode;
    running = true;
    root.visible = true;
    fallen = 0;
    shownMood = 'STAIRS';
    openingPose = null;
    stuckTime = 0;
    stall = 0;
    stallMark = 0;
    snagUntil = 0;
    hopUntil = 0;
    hopGrace = 0;
    cx = 0;
    cz = 0;
    angle = 0;
    stepIndex = 0;
    runX = 0;
    cursorY = ANCHOR_Y + 8;
    if (layout === 'straight') {
      fillBelow(cursorY - 42);
      return openingPose || { x: 0, y: cursorY + 1.5, z: 0, vx: 1.6, vy: -0.3, vz: 0 };
    }
    const top = cursorY;
    addPlatform(-2.6, top + 0.55, 0, 2.3, false);
    fillBelow(top - 38);
    return openingPose || {
      x: 2.6,
      y: top + 1.2,
      z: 0,
      vx: 2.2,
      vy: -0.4,
      vz: 0,
    };
  }

  function rescue(pos) {
    let best = null;
    let bestD = Infinity;
    for (const ent of ents) {
      if (!ent.solid || !ent.body) continue;
      const b = ent.body.position;
      const dy = b.y - pos.y;
      if (dy < -2.5 || dy > 7) continue;
      const d = (b.x - pos.x) ** 2 + (b.z - pos.z) ** 2 + dy * dy * 0.3;
      if (d < bestD) {
        bestD = d;
        best = ent;
      }
    }
    if (!best) {
      const y = pos.y + 1.2;
      addPlatform(pos.x, y, pos.z, 2.6, false);
      return { x: pos.x, y: y + 0.22 + 1.36, z: pos.z, vx: 0, vy: 0, vz: 0 };
    }
    const b = best.body.position;
    return { x: b.x, y: b.y + best.top + 1.36, z: b.z, vx: 0, vy: 0.4, vz: 0 };
  }

  function addPrize(kind, x, y, z, extra = {}) {
    const scale = extra.scale || 1;
    const mesh = kind === 'duck'
      ? art.duckMesh()
      : kind === 'pin'
        ? art.pinMesh()
        : kind === 'ball'
          ? art.ballMesh()
          : art.floatMesh();
    mesh.scale.setScalar(scale);
    const body = new CANNON.Body({
      mass: extra.mass,
      position: new CANNON.Vec3(x, y, z),
      material: kind === 'duck' || kind === 'ball' ? rubberMat : toyMat,
      linearDamping: 0.06,
      angularDamping: 0.1,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    if (kind === 'duck') {
      body.addShape(new CANNON.Sphere(0.42 * scale), new CANNON.Vec3(0, 0.16 * scale, 0));
      body.addShape(new CANNON.Sphere(0.22 * scale), new CANNON.Vec3(0, 0.48 * scale, 0.28 * scale));
    } else if (kind === 'pin') {
      body.addShape(new CANNON.Cylinder(0.1 * scale, 0.16 * scale, 0.78 * scale, 8), new CANNON.Vec3(0, 0.39 * scale, 0));
    } else if (kind === 'ball') {
      body.addShape(new CANNON.Sphere(0.34 * scale));
    } else {
      body.addShape(new CANNON.Box(new CANNON.Vec3(1.7 * scale, 0.16 * scale, 0.85 * scale)), new CANNON.Vec3(0, 0.28 * scale, 0));
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.36 * scale, 0.35 * scale, 0.58 * scale)), new CANNON.Vec3(-1.15 * scale, 0.82 * scale, 0));
      body.addShape(new CANNON.Sphere(0.48 * scale), new CANNON.Vec3(0.15 * scale, 1.2 * scale, 0));
    }
    body.velocity.set(extra.vx || rand(-0.6, 0.6), extra.vy == null ? rand(-0.4, 0.8) : extra.vy, extra.vz || rand(-0.6, 0.6));
    body.angularVelocity.set(rand(-2, 2), rand(-2, 2), rand(-2, 2));
    body.gameRole = 'prop';
    world.addBody(body);
    return track({
      kind,
      body,
      mesh,
      prize: true,
      scoreHits: true,
      minImpact: 2.2,
      flair: extra.flair,
      ttl: 16,
    });
  }

  function dropWave(pos) {
    if (!running) return '';
    let prizes = 0;
    for (const ent of ents) if (ent.prize) prizes += 1;
    if (prizes > 22) return '';
    const theme = WAVE_THEMES[waveCursor % WAVE_THEMES.length];
    waveCursor += 1;
    const sky = pos.y + 8 + Math.random() * 3;
    const span = layout === 'straight' ? 1 : 0.55;
    if (theme === 'ducks') {
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * span;
        addPrize('duck', pos.x + Math.cos(angle) * radius, sky + i * 0.4, pos.z + Math.sin(angle) * radius, {
          scale: i === 0 ? 1.15 : 0.75,
          mass: i === 0 ? 1.3 : 0.8,
          flair: 'QUACK!',
        });
      }
    } else if (theme === 'pins') {
      for (let row = 0; row < 4; row++) {
        for (let c = 0; c <= row; c++) {
          addPrize('pin', pos.x + (c - row / 2) * 0.36, sky, pos.z + row * 0.34, {
            scale: 0.85,
            mass: 0.4,
            flair: 'CLACK!',
          });
        }
      }
      addPrize('ball', pos.x, sky + 2.4, pos.z - 1.2, {
        mass: 2.2,
        flair: 'BOWL!',
        vz: 2.4,
        vy: -0.2,
      });
    } else {
      addPrize('float', pos.x, sky + 1.2, pos.z, {
        scale: layout === 'straight' ? 0.62 : 0.42,
        mass: layout === 'straight' ? 4.2 : 2.6,
        flair: 'PARADE!',
        vy: 0.2,
      });
    }
    onEvent({
      callout: WAVE_LABEL[theme],
      pos: { x: pos.x, y: pos.y + 2, z: pos.z },
      burst: 'toys',
    });
    return WAVE_LABEL[theme];
  }

  function dumpToys(pos) {
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const toy = i % 2
        ? addBall(pos.x + Math.cos(a) * 0.7, pos.y + 0.8 + i * 0.15, pos.z + Math.sin(a) * 0.7)
        : addCrate(pos.x + Math.cos(a) * 0.8, pos.y + 1 + i * 0.1, pos.z + Math.sin(a) * 0.8);
      toy.body.velocity.set(Math.cos(a) * 4, rand(1, 4), Math.sin(a) * 4);
      toy.body.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    }
    onEvent({ callout: 'TOY DROP!', pos: { x: pos.x, y: pos.y + 1, z: pos.z }, burst: 'toys' });
  }

  return {
    active: () => running,
    snagged: () => performance.now() < snagUntil,
    meters: () => fallen,
    focus,
    begin,
    clear,
    rescue,
    dumpToys,
    dropWave,
    hop(torso) {
      if (!running || !torso) return false;
      const now = performance.now();
      if (now > hopGrace && !onDeck(torso)) return false;
      hopUntil = now + 420;
      hopGrace = 0;
      const boost = layout === 'straight' ? 8.5 : 10;
      if (torso.velocity.y < boost) torso.velocity.y = boost;
      for (const limb of ragdoll.limbs) {
        if (limb.body.velocity.y < boost * 0.55) limb.body.velocity.y = boost * 0.55;
        limb.body.wakeUp();
      }
      torso.wakeUp();
      return true;
    },
    prePhysics(dt, torso) {
      if (!running || !torso) return;
      simTime += dt;
      animate(dt, torso);
    },
    post(dt, torso) {
      if (!running || !torso) return null;
      contain(torso);
      if (onDeck(torso)) hopGrace = performance.now() + 140;
      if (torso.velocity.y < 0) fallen += -torso.velocity.y * dt;
      const speed = torso.velocity.length();
      if (speed < 1.15 && torso.velocity.y > -1) stuckTime += dt;
      else stuckTime = 0;
      if (fallen < stallMark + 1) stall += dt;
      else {
        stall = 0;
        stallMark = fallen;
      }
      if (stuckTime > 0.28 || stall > 0.85) {
        stuckTime = 0;
        stall = 0;
        stallMark = fallen;
        if (layout === 'straight') {
          torso.velocity.y = -5;
          torso.velocity.x += 2.4;
          torso.velocity.z *= 0.35;
        } else {
          torso.velocity.y = -7;
          torso.velocity.x += rand(-2, 2);
          torso.velocity.z += rand(-2, 2);
        }
        for (const limb of ragdoll.limbs) {
          limb.body.velocity.y = -5;
          limb.body.wakeUp();
        }
        torso.wakeUp();
      }
      flushHits();
      tickCrumble(dt);
      const moved = recenter(torso);
      const snapshot = [...ents];
      for (const ent of snapshot) {
        if (!ents.includes(ent)) continue;
        if (ent.ttl != null) {
          ent.ttl -= dt;
          if (ent.ttl <= 0) {
            removeEnt(ent);
            continue;
          }
        }
        const ey = ent.body ? ent.body.position.y : ent.y;
        if (ey > torso.position.y + 18 || ey < torso.position.y - 46) removeEnt(ent);
      }
      fillBelow(torso.position.y - 32);
      announce(torso);
      checkHoops(torso);
      return moved;
    },
    sync(dt, torso) {
      if (!running || !torso) return;
      sky.position.set(torso.position.x, torso.position.y, torso.position.z);
      deck.position.set(torso.position.x, torso.position.y - 42, torso.position.z);
      cloudLayer.position.set(torso.position.x, torso.position.y, torso.position.z);
      for (const blob of cloudLayer.children) {
        blob.position.y += dt * blob.userData.speed;
        if (blob.position.y > 30) blob.position.y = -50;
      }
      bounceMat.emissiveIntensity = 0.28 + Math.sin(simTime * 6) * 0.18;
      for (const ent of ents) {
        if (ent.kind === 'pendulum' && ent.rope && ent.body) {
          const b = ent.body.position;
          ent.rope.position.set(
            (ent.pivot.x + b.x) * 0.5,
            (ent.pivot.y + b.y) * 0.5,
            (ent.pivot.z + b.z) * 0.5,
          );
          _dir.set(b.x - ent.pivot.x, b.y - ent.pivot.y, b.z - ent.pivot.z);
          const len = _dir.length() || 1;
          _dir.multiplyScalar(1 / len);
          ent.rope.quaternion.setFromUnitVectors(_up, _dir);
          ent.rope.scale.set(1, len, 1);
        }
        if (!ent.body || !ent.mesh || ent.kind === 'hoop' || ent.kind === 'wind') continue;
        ent.mesh.position.set(ent.body.position.x, ent.body.position.y, ent.body.position.z);
        ent.mesh.quaternion.set(ent.body.quaternion.x, ent.body.quaternion.y, ent.body.quaternion.z, ent.body.quaternion.w);
      }
    },
  };
}
