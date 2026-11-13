import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { GROUND_Y, GROUP_PROP, GROUP_RAG, GROUP_STATIC } from './util.js';

const GAP = 0.045;

export function createRagdoll(world, scene, art, ragMat, feather = 0xffd84a) {
  const skin = art.plastic(0xffc2a1, { roughness: 0.55 });
  const shirtMat = art.plastic(0xff3b5c);
  const shortsMat = art.plastic(0x3d7eff);
  const shoeMat = art.plastic(0xffd23f, { roughness: 0.42 });
  const hairMat = art.plastic(0x7c4dff);
  const glowMats = [skin, shirtMat, shortsMat, shoeMat, hairMat];
  for (const m of glowMats) {
    m.emissive = new THREE.Color(0xff4a1a);
    m.emissiveIntensity = 0;
  }
  const white = new THREE.MeshBasicMaterial({ color: 0xfffdfb });
  const black = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
  const blush = new THREE.MeshBasicMaterial({ color: 0xff8aa8 });
  const starMat = new THREE.MeshBasicMaterial({
    map: art.star,
    transparent: true,
    depthWrite: false,
  });

  const parts = [];
  const limbs = [];
  const targets = [];

  const footH = 0.12;
  const footW = 0.18;
  const footD = 0.28;
  const shinH = 0.36;
  const shinR = 0.085;
  const thighH = 0.38;
  const thighR = 0.105;
  const torsoH = 0.68;
  const torsoW = 0.52;
  const torsoD = 0.3;
  const headR = 0.26;
  const uArmH = 0.32;
  const uArmR = 0.078;
  const lArmH = 0.3;
  const lArmR = 0.068;
  const handR = 0.09;

  const footY = GROUND_Y + footH / 2 + 0.02;
  const ankle = footY + footH / 2 + GAP / 2;
  const shinY = ankle + GAP / 2 + shinH / 2;
  const knee = shinY + shinH / 2 + GAP / 2;
  const thighY = knee + GAP / 2 + thighH / 2;
  const hip = thighY + thighH / 2 + GAP / 2;
  const torsoY = hip + torsoH / 2 - 0.08;
  const shoulderY = torsoY + 0.2;
  const shoulderX = torsoW / 2 + 0.04;
  const neck = torsoY + torsoH / 2 + GAP / 2;
  const headY = neck + GAP / 2 + headR * 0.78;
  const uArmY = shoulderY - uArmH / 2;
  const elbow = uArmY - uArmH / 2 - GAP / 2;
  const lArmY = elbow - GAP / 2 - lArmH / 2;
  const wrist = lArmY - lArmH / 2 - GAP / 2;
  const handY = wrist - GAP / 2 - handR;
  const hipX = 0.12;

  const capsuleGeo = (radius, total) =>
    new THREE.CapsuleGeometry(radius, Math.max(0.05, total - radius * 2), 4, 8);

  function addPart(name, { x, y, z, mass, shape, mesh, halfH, limb, shapeOffset }) {
    const body = new CANNON.Body({
      mass,
      position: new CANNON.Vec3(x, y, z),
      material: ragMat,
      linearDamping: 0.22,
      angularDamping: 0.38,
      allowSleep: false,
      collisionFilterGroup: GROUP_RAG,
      collisionFilterMask: GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(shape, shapeOffset);
    body.gameRole = 'ragdoll';
    body.partName = name;
    world.addBody(body);

    mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    mesh.userData.body = body;
    scene.add(mesh);
    targets.push(mesh);

    const part = {
      name,
      body,
      mesh,
      halfH,
      spawn: { x, y, z },
      phase: Math.random() * 10,
    };
    parts.push(part);
    if (limb) limbs.push(part);
    return part;
  }

  function jointSphere(parent, x, y, z, r) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), skin);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
  }

  const torso = new THREE.Group();
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH * 0.62, torsoD), shirtMat);
  shirt.position.y = torsoH * 0.16;
  const shorts = new THREE.Mesh(
    new THREE.BoxGeometry(torsoW * 1.02, torsoH * 0.4, torsoD * 1.04),
    shortsMat,
  );
  shorts.position.y = -torsoH * 0.28;
  const star = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), starMat);
  star.position.set(0, torsoH * 0.14, torsoD / 2 + 0.012);
  torso.add(shirt, shorts, star);
  jointSphere(torso, -shoulderX + 0.04, shoulderY - torsoY, 0, 0.11);
  jointSphere(torso, shoulderX - 0.04, shoulderY - torsoY, 0, 0.11);
  jointSphere(torso, -hipX, hip - torsoY, 0, 0.12);
  jointSphere(torso, hipX, hip - torsoY, 0, 0.12);

  const torsoPart = addPart('torso', {
    x: 0,
    y: torsoY,
    z: 0,
    mass: 6,
    shape: new CANNON.Box(new CANNON.Vec3(torsoW / 2, torsoH / 2, torsoD / 2)),
    mesh: torso,
    halfH: torsoH / 2,
  });

  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(headR, 20, 16), skin);
  head.add(skull);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), white);
    eye.position.set(side * 0.09, 0.045, headR * 0.86);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), black);
    pupil.position.set(0, 0, 0.038);
    eye.add(pupil);
    eye.castShadow = false;
    head.add(eye);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), blush);
    cheek.position.set(side * 0.15, -0.03, headR * 0.78);
    cheek.scale.set(1, 0.7, 0.45);
    head.add(cheek);
  }
  for (let i = -1; i <= 1; i++) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.03 : 0.022, 8, 8), black);
    bead.position.set(i * 0.065, -0.085 - Math.abs(i) * 0.018, headR * 0.9);
    head.add(bead);
  }
  for (let i = -1; i <= 1; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), hairMat);
    tuft.position.set(i * 0.08, headR * 0.92, 0.02);
    tuft.rotation.z = i * -0.25;
    tuft.rotation.x = -0.2;
    head.add(tuft);
  }

  const headPart = addPart('head', {
    x: 0,
    y: headY,
    z: 0,
    mass: 1.35,
    shape: new CANNON.Sphere(headR),
    mesh: head,
    halfH: headR,
    limb: true,
  });

  function makeLimb(name, x, y, z, mass, radius, length, material, halfH) {
    const mesh = new THREE.Mesh(capsuleGeo(radius, length), material);
    return addPart(name, {
      x,
      y,
      z,
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(radius, length / 2, radius)),
      mesh,
      halfH: halfH ?? length / 2,
      limb: true,
    });
  }

  const upperL = makeLimb('uArmL', -shoulderX, uArmY, 0, 0.55, uArmR, uArmH, skin);
  const upperR = makeLimb('uArmR', shoulderX, uArmY, 0, 0.55, uArmR, uArmH, skin);
  const lowerL = makeLimb('lArmL', -shoulderX, lArmY, 0, 0.4, lArmR, lArmH, skin);
  const lowerR = makeLimb('lArmR', shoulderX, lArmY, 0, 0.4, lArmR, lArmH, skin);
  jointSphere(upperL.mesh, 0, -uArmH / 2, 0, 0.09);
  jointSphere(upperR.mesh, 0, -uArmH / 2, 0, 0.09);

  const handLeft = addPart('handL', {
    x: -shoulderX,
    y: handY,
    z: 0,
    mass: 0.22,
    shape: new CANNON.Sphere(handR),
    mesh: new THREE.Mesh(new THREE.SphereGeometry(handR, 12, 10), skin),
    halfH: handR,
    limb: true,
  });
  const handRight = addPart('handR', {
    x: shoulderX,
    y: handY,
    z: 0,
    mass: 0.22,
    shape: new CANNON.Sphere(handR),
    mesh: new THREE.Mesh(new THREE.SphereGeometry(handR, 12, 10), skin),
    halfH: handR,
    limb: true,
  });

  const thighLeft = makeLimb('thighL', -hipX, thighY, 0, 0.9, thighR, thighH, shortsMat);
  const thighRight = makeLimb('thighR', hipX, thighY, 0, 0.9, thighR, thighH, shortsMat);
  const shinLeft = makeLimb('shinL', -hipX, shinY, 0, 0.55, shinR, shinH, skin);
  const shinRight = makeLimb('shinR', hipX, shinY, 0, 0.55, shinR, shinH, skin);
  jointSphere(thighLeft.mesh, 0, -thighH / 2, 0, 0.1);
  jointSphere(thighRight.mesh, 0, -thighH / 2, 0, 0.1);

  function makeFoot(name, x) {
    const pivot = new THREE.Group();
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(footW, footH, footD), shoeMat);
    shoe.position.z = 0.05;
    pivot.add(shoe);
    return addPart(name, {
      x,
      y: footY,
      z: 0,
      mass: 0.32,
      shape: new CANNON.Box(new CANNON.Vec3(footW / 2, footH / 2, footD / 2)),
      shapeOffset: new CANNON.Vec3(0, 0, 0.05),
      mesh: pivot,
      halfH: footH / 2,
      limb: true,
    });
  }
  const footL = makeFoot('footL', -hipX);
  const footR = makeFoot('footR', hipX);

  const constraints = [];

  function link(a, b, x, y, z) {
    const worldPoint = new CANNON.Vec3(x, y, z);
    const pivotA = a.body.pointToLocalFrame(worldPoint);
    const pivotB = b.body.pointToLocalFrame(worldPoint);
    const c = new CANNON.PointToPointConstraint(a.body, pivotA, b.body, pivotB);
    c.collideConnected = false;
    world.addConstraint(c);
    constraints.push(c);

    const wa = new CANNON.Vec3();
    const wb = new CANNON.Vec3();
    a.body.quaternion.vmult(pivotA, wa);
    wa.vadd(a.body.position, wa);
    b.body.quaternion.vmult(pivotB, wb);
    wb.vadd(b.body.position, wb);
    const gap = wa.distanceTo(wb);
    if (gap > 0.03) console.warn(`Loose joint ${a.name}-${b.name}: ${gap.toFixed(3)}m`);
  }

  link(torsoPart, headPart, 0, neck, 0);
  link(torsoPart, upperL, -shoulderX, shoulderY, 0);
  link(torsoPart, upperR, shoulderX, shoulderY, 0);
  link(upperL, lowerL, -shoulderX, elbow, 0);
  link(upperR, lowerR, shoulderX, elbow, 0);
  link(lowerL, handLeft, -shoulderX, wrist, 0);
  link(lowerR, handRight, shoulderX, wrist, 0);
  link(torsoPart, thighLeft, -hipX, hip, 0);
  link(torsoPart, thighRight, hipX, hip, 0);
  link(thighLeft, shinLeft, -hipX, knee, 0);
  link(thighRight, shinRight, hipX, knee, 0);
  link(shinLeft, footL, -hipX, ankle, 0);
  link(shinRight, footR, hipX, ankle, 0);

  const rayFrom = new CANNON.Vec3();
  const rayTo = new CANNON.Vec3();
  const rayResult = new CANNON.RaycastResult();
  const rayOpts = {
    collisionFilterMask: GROUP_STATIC | GROUP_PROP,
    skipBackfaces: true,
  };
  const supportParts = [footL, footR, shinLeft, shinRight, handLeft, handRight, torsoPart];

  const _imp = new CANNON.Vec3();
  const _off = new CANNON.Vec3();

  function spread() {
    let max = 0;
    const t = torsoPart.body.position;
    for (const p of parts) max = Math.max(max, t.distanceTo(p.body.position));
    return max;
  }

  let costume = 'doll';
  let chickenReady = false;
  let featherColor = feather;
  let featherMat = null;
  let api = null;
  const ghost = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });

  function tagStock(root) {
    root.traverse((obj) => {
      if (obj !== root && obj.isMesh) obj.userData.stock = true;
    });
  }

  function setStockShown(root, showDoll) {
    root.traverse((obj) => {
      if (obj.userData.costume === 'chicken') obj.visible = !showDoll;
      else if (obj.userData.stock) obj.visible = showDoll;
    });
  }

  function maskLimb(mesh, on) {
    if (!mesh.isMesh) return;
    if (on) {
      if (!mesh.userData.stockMaterial) mesh.userData.stockMaterial = mesh.material;
      mesh.material = ghost;
      mesh.castShadow = false;
      mesh.userData.masked = true;
    } else if (mesh.userData.masked) {
      mesh.material = mesh.userData.stockMaterial;
      mesh.castShadow = true;
      mesh.userData.masked = false;
    }
  }

  function addBit(parent, geometry, material, x, y, z, rot) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.costume = 'chicken';
    parent.add(mesh);
    return mesh;
  }

  function buildChicken() {
    if (chickenReady) return;
    chickenReady = true;
    const yellow = featherMat = art.plastic(featherColor, { roughness: 0.42 });
    const cream = art.plastic(0xfff6d2, { roughness: 0.46 });
    const orange = art.plastic(0xff7a1a, { roughness: 0.4 });
    const red = art.plastic(0xff2a2a, { roughness: 0.42 });
    const white = new THREE.MeshBasicMaterial({ color: 0xfffdfb });
    const black = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    for (const material of [yellow, cream, orange, red]) {
      material.emissive = new THREE.Color(0xff4a1a);
      material.emissiveIntensity = 0;
      glowMats.push(material);
    }
    for (const part of parts) tagStock(part.mesh);

    const body = addBit(torso, new THREE.SphereGeometry(0.4, 16, 12), yellow, 0, 0.02, 0.02);
    body.scale.set(1.15, 1.32, 1);
    const belly = addBit(torso, new THREE.SphereGeometry(0.24, 12, 10), cream, 0, -0.08, 0.22);
    belly.scale.set(1, 0.85, 0.7);
    for (const side of [-1, 1]) {
      addBit(torso, new THREE.BoxGeometry(0.38, 0.07, 0.24), yellow, side * 0.46, 0.02, 0.04, [0, 0, side * -0.55]);
    }
    for (let i = -1; i <= 1; i++) {
      addBit(torso, new THREE.ConeGeometry(0.1, 0.32, 6), yellow, i * 0.1, 0.05, -0.34, [-0.7, 0, i * -0.35]);
    }

    addBit(head, new THREE.SphereGeometry(headR * 1.12, 16, 12), yellow, 0, 0.02, 0);
    for (const side of [-1, 1]) {
      const eye = addBit(head, new THREE.SphereGeometry(0.075, 12, 10), white, side * 0.11, 0.05, headR * 0.95);
      addBit(eye, new THREE.SphereGeometry(0.038, 8, 8), black, 0, 0, 0.05);
    }
    addBit(head, new THREE.ConeGeometry(0.1, 0.3, 7), orange, 0, -0.02, headR + 0.12, [Math.PI / 2, 0, 0]);
    addBit(head, new THREE.SphereGeometry(0.07, 8, 8), red, 0, -0.12, headR * 0.85).scale.set(0.8, 1.4, 0.7);
    for (let i = -1; i <= 1; i++) {
      addBit(head, new THREE.ConeGeometry(0.055, 0.2, 6), red, i * 0.07, headR * 1.05, 0.02, [0.15, 0, i * -0.2]);
    }

    const wingGeo = new THREE.BoxGeometry(0.08, 1, 0.42);
    const tipGeo = new THREE.BoxGeometry(0.06, 0.7, 0.3);
    const drumGeo = new THREE.CapsuleGeometry(0.09, 0.2, 3, 6);
    const shinGeo = new THREE.CapsuleGeometry(0.06, 0.24, 3, 6);
    for (const part of parts) {
      const side = Math.sign(part.spawn.x) || 1;
      if (part.name.startsWith('uArm')) {
        const wing = addBit(part.mesh, wingGeo, yellow, side * 0.02, -0.02, 0);
        wing.scale.set(1, uArmH * 0.95, 1);
      } else if (part.name.startsWith('lArm')) {
        const tip = addBit(part.mesh, tipGeo, yellow, side * 0.02, 0, 0);
        tip.scale.set(1, lArmH, 1);
      } else if (part.name.startsWith('thigh')) {
        addBit(part.mesh, drumGeo, orange, 0, 0, 0);
      } else if (part.name.startsWith('shin')) {
        addBit(part.mesh, shinGeo, orange, 0, 0, 0);
      } else if (part.name.startsWith('foot')) {
        for (const toe of [-1, 0, 1]) {
          addBit(part.mesh, new THREE.ConeGeometry(0.035, 0.16, 5), orange, toe * 0.05, -0.02, 0.16, [Math.PI / 2, 0, 0]);
        }
      }
    }
  }

  function setCostume(next) {
    costume = next === 'chicken' ? 'chicken' : 'doll';
    if (costume === 'chicken') buildChicken();
    else if (!chickenReady) return;
    const doll = costume === 'doll';
    for (const part of parts) {
      setStockShown(part.mesh, doll);
      maskLimb(part.mesh, !doll);
    }
  }

  const AXIS_X = new CANNON.Vec3(1, 0, 0);
  const AXIS_Y = new CANNON.Vec3(0, 1, 0);
  const AXIS_Z = new CANNON.Vec3(0, 0, 1);
  const _qYaw = new CANNON.Quaternion();
  const _qPitch = new CANNON.Quaternion();
  const _qRoll = new CANNON.Quaternion();
  const _q = new CANNON.Quaternion();
  const _local = new CANNON.Vec3();
  const WALKER_HALF = 0.95;
  const byName = Object.fromEntries(parts.map((part) => [part.name, part]));
  for (const part of parts) {
    part.local = {
      x: part.spawn.x - torsoPart.spawn.x,
      y: part.spawn.y - torsoPart.spawn.y,
      z: part.spawn.z - torsoPart.spawn.z,
    };
    part.filterMask = part.body.collisionFilterMask;
  }

  function rel(x, y, z) {
    return { x, y: y - torsoY, z };
  }
  const hipL = rel(-hipX, hip, 0);
  const hipR = rel(hipX, hip, 0);
  const kneeL = rel(-hipX, knee, 0);
  const kneeR = rel(hipX, knee, 0);
  const ankleL = rel(-hipX, ankle, 0);
  const ankleR = rel(hipX, ankle, 0);
  const shoulderL = rel(-shoulderX, shoulderY, 0);
  const shoulderR = rel(shoulderX, shoulderY, 0);
  const elbowL = rel(-shoulderX, elbow, 0);
  const elbowR = rel(shoulderX, elbow, 0);
  const wristL = rel(-shoulderX, wrist, 0);
  const wristR = rel(shoulderX, wrist, 0);
  const neckRel = rel(0, neck, 0);

  let walker = null;
  let walking = false;
  let flap = 0;
  let flapPhase = 0;

  function xform(idle, pivotIdle, pivotNow, pitch) {
    const dx = idle.x - pivotIdle.x;
    const dy = idle.y - pivotIdle.y;
    const dz = idle.z - pivotIdle.z;
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    return {
      x: pivotNow.x + dx,
      y: pivotNow.y + c * dy - s * dz,
      z: pivotNow.z + s * dy + c * dz,
    };
  }

  function putPart(part, local, pitch, roll) {
    _qYaw.setFromAxisAngle(AXIS_Y, faceYaw);
    _local.set(local.x, local.y, local.z);
    _qYaw.vmult(_local, _local);
    const body = part.body;
    body.position.set(rootX + _local.x, rootY + _local.y, rootZ + _local.z);
    body.previousPosition.copy(body.position);
    _qPitch.setFromAxisAngle(AXIS_X, pitch);
    _qRoll.setFromAxisAngle(AXIS_Z, roll);
    _qYaw.mult(_qPitch, _q);
    _q.mult(_qRoll, body.quaternion);
    body.previousQuaternion.copy(body.quaternion);
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.force.set(0, 0, 0);
    body.torque.set(0, 0, 0);
  }

  let faceYaw = 0;
  let rootX = 0;
  let rootY = 0;
  let rootZ = 0;

  function limbChain(side, swing, armExtra, hipP, kneeP, ankleP, shoulderP, elbowP, wristP) {
    const thighPitch = swing * 0.7;
    const kneeNow = xform(kneeP, hipP, hipP, thighPitch);
    const shinPitch = thighPitch + Math.max(0, swing) * 0.5;
    const ankleNow = xform(ankleP, kneeP, kneeNow, shinPitch);
    const footPitch = -shinPitch * 0.62;
    const tag = side < 0 ? 'L' : 'R';
    posed[`thigh${tag}`] = { local: xform(byName[`thigh${tag}`].local, hipP, hipP, thighPitch), pitch: thighPitch };
    posed[`shin${tag}`] = { local: xform(byName[`shin${tag}`].local, kneeP, kneeNow, shinPitch), pitch: shinPitch };
    posed[`foot${tag}`] = { local: xform(byName[`foot${tag}`].local, ankleP, ankleNow, footPitch), pitch: footPitch };

    const armSwing = -swing * 0.28 + armExtra * 0.65;
    const upperPitch = armSwing * 0.45;
    const elbowNow = xform(elbowP, shoulderP, shoulderP, upperPitch);
    const lowerPitch = upperPitch + Math.max(0, armSwing) * 0.2;
    const wristNow = xform(wristP, elbowP, elbowNow, lowerPitch);
    const handPitch = lowerPitch * 0.25;
    const wing = side < 0 ? 0.42 : -0.42;
    posed[`uArm${tag}`] = { local: xform(byName[`uArm${tag}`].local, shoulderP, shoulderP, upperPitch), pitch: upperPitch, roll: wing };
    posed[`lArm${tag}`] = { local: xform(byName[`lArm${tag}`].local, elbowP, elbowNow, lowerPitch), pitch: lowerPitch, roll: wing * 0.45 };
    posed[`hand${tag}`] = { local: xform(byName[`hand${tag}`].local, wristP, wristNow, handPitch), pitch: handPitch };
  }

  const posed = {};

  function snapWalker(x, y, z) {
    if (!walker) return;
    const stand = GROUND_Y + WALKER_HALF;
    walker.position.set(x, stand + (y - torsoPart.spawn.y), z);
    walker.previousPosition.copy(walker.position);
    walker.velocity.set(0, 0, 0);
    walker.angularVelocity.set(0, 0, 0);
    walker.force.set(0, 0, 0);
    walker.torque.set(0, 0, 0);
    walker.quaternion.set(0, 0, 0, 1);
    walker.previousQuaternion.copy(walker.quaternion);
    walker.wakeUp();
  }

  function setWalking(on) {
    if (on === walking) return;
    walking = on;
    if (on) {
      for (const c of constraints) world.removeConstraint(c);
      for (const part of parts) {
        part.body.collisionResponse = false;
        part.body.collisionFilterMask = 0;
        part.body.type = CANNON.Body.KINEMATIC;
        part.body.velocity.set(0, 0, 0);
        part.body.angularVelocity.set(0, 0, 0);
      }
      walker = new CANNON.Body({
        mass: 8,
        material: ragMat,
        fixedRotation: true,
        linearDamping: 0.04,
        angularDamping: 1,
        allowSleep: false,
        collisionFilterGroup: GROUP_RAG,
        collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
      });
      walker.addShape(new CANNON.Box(new CANNON.Vec3(0.42, WALKER_HALF, 0.42)));
      walker.angularFactor.set(0, 0, 0);
      walker.gameRole = 'ragdoll';
      walker.partName = 'walker';
      walker.doll = api;
      world.addBody(walker);
      const t = torsoPart.body.position;
      snapWalker(t.x, t.y, t.z);
    } else {
      if (walker) {
        if (walker.world) world.removeBody(walker);
        walker = null;
      }
      for (const part of parts) {
        part.body.type = CANNON.Body.DYNAMIC;
        part.body.collisionResponse = true;
        part.body.collisionFilterMask = part.filterMask;
        part.body.wakeUp();
      }
      for (const c of constraints) world.addConstraint(c);
    }
  }

  function slide() {
    let mx = 0;
    let mz = 0;
    let mass = 0;
    let ang = 0;
    for (const part of parts) {
      const m = part.body.mass;
      mx += part.body.velocity.x * m;
      mz += part.body.velocity.z * m;
      mass += m;
      ang = Math.max(ang, part.body.angularVelocity.length());
    }
    return {
      x: mass ? mx / mass : 0,
      z: mass ? mz / mass : 0,
      ang,
    };
  }

  function knock(style = {}) {
    let vx = torsoPart.body.velocity.x;
    let vy = torsoPart.body.velocity.y;
    let vz = torsoPart.body.velocity.z;
    if (walking && walker) {
      vx = walker.velocity.x;
      vy = walker.velocity.y;
      vz = walker.velocity.z;
      setWalking(false);
    }
    const horiz = Math.hypot(vx, vz);
    const dirX = horiz > 0.25 ? vx / horiz : 0;
    const dirZ = horiz > 0.25 ? vz / horiz : 1;
    const spin = Math.min(style.maxSpin ?? 18, (style.spin ?? 3.5) + horiz * (style.spinScale ?? 0.62));
    const rollX = -dirZ * spin;
    const rollZ = dirX * spin;
    const pop = Math.max(vy, style.minUp ?? 2.4);
    const spread = style.spread ?? 1.6;
    const yJitter = style.yJitter ?? 1.4;
    const wobble = style.wobble ?? 5;
    for (const part of parts) {
      part.body.position.y += 0.08;
      part.body.previousPosition.copy(part.body.position);
      part.body.linearDamping = 0.02;
      part.body.angularDamping = 0.045;
      part.body.velocity.set(
        vx + (Math.random() - 0.5) * spread,
        pop + (Math.random() - 0.5) * yJitter,
        vz + (Math.random() - 0.5) * spread,
      );
      part.body.angularVelocity.set(
        rollX + (Math.random() - 0.5) * wobble,
        (Math.random() - 0.5) * wobble,
        rollZ + (Math.random() - 0.5) * wobble,
      );
      part.body.wakeUp();
    }
  }

  function carry(prev) {
    if (walking || !prev) return { x: 0, z: 0, ang: 0 };
    let now = slide();
    const before = Math.hypot(prev.x, prev.z);
    const after = Math.hypot(now.x, now.z);
    if (before > 1.8 && after < before * 0.55) {
      const addX = prev.x * 0.9 - now.x;
      const addZ = prev.z * 0.9 - now.z;
      const kick = Math.min(11, before * 0.55);
      const ax = (-prev.z / before) * kick;
      const az = (prev.x / before) * kick;
      for (const part of parts) {
        part.body.velocity.x += addX;
        part.body.velocity.z += addZ;
        part.body.angularVelocity.x += ax * 0.45;
        part.body.angularVelocity.z += az * 0.45;
        part.body.wakeUp();
      }
      now = slide();
    }
    const speed = Math.hypot(now.x, now.z);
    if (speed > 1.2) {
      const want = Math.min(14, speed * 0.85);
      const torso = torsoPart.body;
      torso.angularVelocity.x += ((-now.z / speed) * want - torso.angularVelocity.x) * 0.08;
      torso.angularVelocity.z += ((now.x / speed) * want - torso.angularVelocity.z) * 0.08;
      now = slide();
    }
    return now;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }

  api = {
    parts,
    limbs,
    targets,
    torso: torsoPart,
    glowMats,
    spread,
    isSupported(physicsWorld) {
      if (walking && walker) return walker.position.y <= GROUND_Y + WALKER_HALF + 0.16 && walker.velocity.y <= 1.4;
      let lowest = Infinity;
      let lx = 0;
      let lz = 0;
      for (const p of parts) {
        const bottom = p.body.position.y - p.halfH;
        if (bottom < lowest) {
          lowest = bottom;
          lx = p.body.position.x;
          lz = p.body.position.z;
        }
      }
      if (lowest <= GROUND_Y + 0.2) return true;
      rayFrom.set(lx, lowest + 0.06, lz);
      rayTo.set(lx, lowest - 0.34, lz);
      return physicsWorld.raycastClosest(rayFrom, rayTo, rayOpts, rayResult) && rayResult.hasHit;
    },
    flail(specificBody, spinSign) {
      let part = limbs[(Math.random() * limbs.length) | 0];
      if (specificBody) {
        const found = parts.find((p) => p.body === specificBody);
        if (found && found !== torsoPart) part = found;
      }
      _off.set((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
      _imp.set((Math.random() - 0.5) * 2.6, Math.random() * 1.8, (Math.random() - 0.5) * 2.6);
      part.body.applyImpulse(_imp, _off);
      part.body.angularVelocity.x += (Math.random() - 0.5) * 12;
      part.body.angularVelocity.y += spinSign * 5;
      part.body.angularVelocity.z += (Math.random() - 0.5) * 12;

      const torsoBody = torsoPart.body;
      torsoBody.velocity.y += 0.95;
      torsoBody.velocity.x += (Math.random() - 0.5) * 0.45;
      torsoBody.velocity.z += (Math.random() - 0.5) * 0.45;
      torsoBody.angularVelocity.y += spinSign * 2.7;
      torsoBody.wakeUp();
      part.body.wakeUp();
      return part;
    },
    launch(dir, spinSign) {
      const b = torsoPart.body;
      b.velocity.x += dir.x * 16;
      b.velocity.y += 14;
      b.velocity.z += dir.z * 16;
      b.angularVelocity.y += spinSign * 10;
      for (const limb of limbs) {
        limb.body.velocity.x += dir.x * 8;
        limb.body.velocity.y += 6;
        limb.body.velocity.z += dir.z * 8;
        limb.body.angularVelocity.x += (Math.random() - 0.5) * 14;
        limb.body.angularVelocity.y += spinSign * 8;
        limb.body.angularVelocity.z += (Math.random() - 0.5) * 14;
        limb.body.wakeUp();
      }
    },
    clampSpeeds(maxLin, maxAng) {
      const bodies = walking && walker ? [walker] : parts.map((p) => p.body);
      for (const body of bodies) {
        const v = body.velocity;
        const s = v.length();
        if (s > maxLin) v.scale(maxLin / s, v);
        const w = body.angularVelocity;
        const a = w.length();
        if (a > maxAng) w.scale(maxAng / a, w);
      }
    },
    reset() {
      for (const p of parts) {
        p.body.position.set(p.spawn.x, p.spawn.y, p.spawn.z);
        p.body.quaternion.set(0, 0, 0, 1);
        p.body.velocity.set(0, 0, 0);
        p.body.angularVelocity.set(0, 0, 0);
        p.body.force.set(0, 0, 0);
        p.body.torque.set(0, 0, 0);
        p.body.wakeUp();
      }
      const t = torsoPart.body.position;
      snapWalker(t.x, t.y, t.z);
    },
    place(x, y, z) {
      const ox = torsoPart.spawn.x;
      const oy = torsoPart.spawn.y;
      const oz = torsoPart.spawn.z;
      for (const p of parts) {
        p.body.position.set(x + (p.spawn.x - ox), y + (p.spawn.y - oy), z + (p.spawn.z - oz));
        p.body.previousPosition.copy(p.body.position);
        p.body.quaternion.set(0, 0, 0, 1);
        p.body.velocity.set(0, 0, 0);
        p.body.angularVelocity.set(0, 0, 0);
        p.body.force.set(0, 0, 0);
        p.body.torque.set(0, 0, 0);
        p.body.wakeUp();
      }
      snapWalker(x, y, z);
    },
    walking: () => walking,
    mover() {
      return walking && walker ? walker : torsoPart.body;
    },
    noteFlap() {
      flap = 1;
    },
    lockWalker() {
      if (!walking || !walker) return;
      walker.quaternion.set(0, 0, 0, 1);
      walker.angularVelocity.set(0, 0, 0);
      walker.torque.set(0, 0, 0);
    },
    setWalker(on) {
      setWalking(on);
    },
    knock,
    slide,
    carry,
    facing: () => faceYaw,
    poseWalker(yaw, phase, gait, dt, chop = 0) {
      if (!walking || !walker) return;
      faceYaw = yaw;
      flapPhase += dt * 26;
      flap *= Math.exp(-dt * 5.5);
      const lift = walker.position.y - (GROUND_Y + WALKER_HALF);
      rootX = walker.position.x;
      rootY = torsoPart.spawn.y + lift + Math.sin(phase * 2) * 0.045 * gait;
      rootZ = walker.position.z;
      const swingL = Math.sin(phase) * gait;
      const swingR = Math.sin(phase + Math.PI) * gait;
      const flapL = Math.sin(flapPhase) * flap;
      const flapR = Math.sin(flapPhase + 0.6) * flap;
      limbChain(-1, swingL, flapL * 1.2, hipL, kneeL, ankleL, shoulderL, elbowL, wristL);
      limbChain(1, swingR, flapR * 1.2, hipR, kneeR, ankleR, shoulderR, elbowR, wristR);
      const chopSwing = Math.sin(Math.min(1, Math.max(0, chop)) * Math.PI);
      if (chopSwing > 0.08) {
        const upperPitch = -1.4 * chopSwing;
        const elbowNow = xform(elbowR, shoulderR, shoulderR, upperPitch);
        const lowerPitch = upperPitch - 0.6 * chopSwing;
        const wristNow = xform(wristR, elbowR, elbowNow, lowerPitch);
        posed.uArmR = { local: xform(byName.uArmR.local, shoulderR, shoulderR, upperPitch), pitch: upperPitch, roll: -0.25 };
        posed.lArmR = { local: xform(byName.lArmR.local, elbowR, elbowNow, lowerPitch), pitch: lowerPitch, roll: -0.08 };
        posed.handR = { local: xform(byName.handR.local, wristR, wristNow, lowerPitch * 0.2), pitch: -0.45 * chopSwing, roll: 0 };
      }
      const chest = 0.04 * gait;
      const roll = Math.sin(phase) * 0.05 * gait;
      posed.torso = { local: { x: 0, y: 0, z: 0 }, pitch: chest, roll };
      posed.head = {
        local: xform(byName.head.local, neckRel, neckRel, Math.sin(phase * 2) * 0.08 * gait),
        pitch: chest + Math.sin(phase * 2) * 0.1 * gait,
        roll: -roll,
      };
      for (const part of parts) {
        const pose = posed[part.name];
        if (!pose) continue;
        putPart(part, pose.local, pose.pitch || 0, pose.roll || 0);
      }
    },
    shiftWalker(dx, dz) {
      if (!walking || !walker) return;
      walker.position.x += dx;
      walker.position.z += dz;
      walker.previousPosition.copy(walker.position);
    },
    sync(time, charge, maxChaos) {
      const glow = maxChaos ? 1 : charge;
      const pulse = maxChaos ? 1.15 + Math.sin(time * 28) * 0.35 : glow * 0.85;
      for (const m of glowMats) {
        m.emissive.setHex(maxChaos ? 0xfff1a8 : 0xff4d1c);
        m.emissiveIntensity = pulse;
      }
      const amp = maxChaos ? 0.04 : charge * 0.02;
      for (const p of parts) {
        const b = p.body;
        p.mesh.position.set(b.position.x, b.position.y, b.position.z);
        p.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
        if (amp > 0.001) {
          p.mesh.position.x += Math.sin(time * 72 + p.phase) * amp;
          p.mesh.position.y += Math.cos(time * 64 + p.phase) * amp * 0.6;
        }
      }
    },
    supportParts,
    setCostume,
    costume: () => costume,
    recolor(hex) {
      featherColor = hex;
      if (featherMat) featherMat.color.setHex(hex);
    },
    plant(x, y, z) {
      if (!walking || !walker) setWalking(true);
      walker.position.set(x, y, z);
      walker.previousPosition.copy(walker.position);
    },
    applyParts(packed) {
      if (walking) setWalking(false);
      for (let i = 0; i < parts.length; i++) {
        const row = packed[i];
        if (!row) continue;
        const body = parts[i].body;
        body.position.set(row[0], row[1], row[2]);
        body.previousPosition.copy(body.position);
        body.quaternion.set(row[3], row[4], row[5], row[6]);
        body.previousQuaternion.copy(body.quaternion);
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
      }
    },
    capturePose() {
      if (walking && walker) {
        return {
          w: 1,
          x: round2(walker.position.x),
          y: round2(walker.position.y),
          z: round2(walker.position.z),
          yaw: round3(faceYaw),
        };
      }
      return {
        w: 0,
        parts: parts.map((part) => {
          const body = part.body;
          return [
            round2(body.position.x),
            round2(body.position.y),
            round2(body.position.z),
            round3(body.quaternion.x),
            round3(body.quaternion.y),
            round3(body.quaternion.z),
            round3(body.quaternion.w),
          ];
        }),
      };
    },
    dispose() {
      if (walking) setWalking(false);
      for (const constraint of constraints) world.removeConstraint(constraint);
      constraints.length = 0;
      for (const part of parts) {
        if (part.body.world) world.removeBody(part.body);
        part.mesh.removeFromParent();
      }
    },
  };
  for (const part of parts) part.body.doll = api;
  return api;
}
