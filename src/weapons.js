import * as THREE from 'three';
import { GROUND_Y } from './util.js';

const KINDS = [
  { id: 'sword', label: 'SWORD!', blurb: 'wide slice', callout: 'SLICE!', reach: 2.7, swing: 0.26, arc: 0.78, knock: 1.15, lift: 1.05, spin: 1.15, cracks: 1, blast: 0, quake: false, chain: 0, chainRange: 0, car: 'boom', shake: 1, score: 1, chunks: 6, burst: 'boom', ring: 0xe7eef6 },
  { id: 'bat', label: 'BAT!', blurb: 'launches cars', callout: 'YEET!', reach: 2.15, swing: 0.32, arc: 0.42, knock: 2.6, lift: 1.25, spin: 1.7, cracks: 1, blast: 0, quake: false, chain: 0, chainRange: 0, car: 'launch', shake: 0.85, score: 1, chunks: 4, burst: 'launch', ring: 0xe08a3c },
  { id: 'hammer', label: 'HAMMER!', blurb: 'ground quake', callout: 'QUAKE!', reach: 1.72, swing: 0.5, arc: 0.16, knock: 1.35, lift: 0.7, spin: 0.8, cracks: 2, blast: 4.4, quake: true, chain: 0, chainRange: 0, car: 'boom', shake: 1.7, score: 1.3, chunks: 8, burst: 'chip', ring: 0xb7c0cc },
  { id: 'axe', label: 'AXE!', blurb: 'wrecks buildings', callout: 'CLEAVE!', reach: 2.15, swing: 0.42, arc: 0.28, knock: 1.45, lift: 1.1, spin: 2.3, cracks: 3, blast: 0, quake: false, chain: 0, chainRange: 0, car: 'boom', shake: 1.25, score: 1.2, chunks: 9, burst: 'chip', ring: 0xff4d4d },
  { id: 'spear', label: 'SPEAR!', blurb: 'long pierce', callout: 'SKEWER!', reach: 4.15, swing: 0.24, arc: 0, knock: 0.72, lift: 0.55, spin: 0.45, cracks: 1, blast: 0, quake: false, chain: 0, chainRange: 0, car: 'boom', shake: 0.7, score: 0.9, chunks: 4, burst: 'boom', ring: 0x3ec6ff },
  { id: 'scythe', label: 'SCYTHE!', blurb: 'huge sweep', callout: 'REAP!', reach: 2.45, swing: 0.4, arc: 1.12, knock: 1.25, lift: 1.15, spin: 1.8, cracks: 1, blast: 0, quake: false, chain: 0, chainRange: 0, car: 'boom', shake: 1.05, score: 0.95, chunks: 6, burst: 'boom', ring: 0xc77dff },
  { id: 'wand', label: 'WAND!', blurb: 'lightning chain', callout: 'ZAP!', reach: 1.9, swing: 0.3, arc: 0.12, knock: 0.8, lift: 1.35, spin: 0.9, cracks: 1, blast: 0, quake: false, chain: 4, chainRange: 7.5, car: 'boom', shake: 0.65, score: 0.8, chunks: 4, burst: 'zap', ring: 0xffe14a },
  { id: 'mallet', label: 'MALLET!', blurb: 'pops straight up', callout: 'LAUNCH!', reach: 1.85, swing: 0.52, arc: 0.2, knock: 0.55, lift: 3.6, spin: 1.4, cracks: 1, blast: 2.2, quake: false, chain: 0, chainRange: 0, car: 'launch', shake: 1.15, score: 1.1, chunks: 5, burst: 'launch', ring: 0xff5d9a },
];

const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);
const yawQ = new THREE.Quaternion();
const pitchQ = new THREE.Quaternion();
const handQ = new THREE.Quaternion();
const gripQ = new THREE.Quaternion().setFromAxisAngle(RIGHT, 0.55);

function paintMesh(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeSword(mats) {
  const group = new THREE.Group();
  const handle = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.34, 8), mats.grip));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.17;
  const guard = paintMesh(new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.09, 0.09), mats.gold));
  guard.position.z = 0.36;
  const blade = paintMesh(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 1.85), mats.steel));
  blade.position.z = 1.32;
  const tip = paintMesh(new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.26, 4), mats.steel));
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 2.34;
  group.add(handle, guard, blade, tip);
  return group;
}

function makeBat(mats) {
  const group = new THREE.Group();
  const handle = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.46, 8), mats.tape));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.23;
  const barrel = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.055, 1.45, 10), mats.wood));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 1.15;
  group.add(handle, barrel);
  return group;
}

function makeHammer(mats) {
  const group = new THREE.Group();
  const handle = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 1.15, 8), mats.handle));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.58;
  const head = paintMesh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.46), mats.iron));
  head.position.z = 1.28;
  group.add(handle, head);
  return group;
}

function makeAxe(mats) {
  const group = new THREE.Group();
  const handle = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.25, 8), mats.handle));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.62;
  const cheek = paintMesh(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.22), mats.iron));
  cheek.position.set(0.02, 0, 1.28);
  const blade = paintMesh(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.07), mats.steel));
  blade.position.set(0.36, 0, 1.28);
  const edge = paintMesh(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.05), mats.red));
  edge.position.set(0.68, 0, 1.28);
  group.add(handle, cheek, blade, edge);
  return group;
}

function makeSpear(mats) {
  const group = new THREE.Group();
  const shaft = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 3.15, 8), mats.shaft));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 1.58;
  const band = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 8), mats.gold));
  band.rotation.x = Math.PI / 2;
  band.position.z = 2.85;
  const tip = paintMesh(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.48, 5), mats.cyan));
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 3.38;
  group.add(shaft, band, tip);
  return group;
}

function makeScythe(mats) {
  const group = new THREE.Group();
  const shaft = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 2.35, 8), mats.dark));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 1.18;
  const collar = paintMesh(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.16), mats.violet));
  collar.position.z = 2.28;
  const blade = paintMesh(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 16, Math.PI * 0.85), mats.violet));
  blade.rotation.y = Math.PI / 2;
  blade.position.set(0.28, 0, 2.15);
  group.add(shaft, collar, blade);
  return group;
}

function makeWand(mats) {
  const group = new THREE.Group();
  const shaft = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.048, 1.25, 8), mats.violet));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 0.62;
  const cap = paintMesh(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mats.gold));
  cap.position.z = 1.22;
  const orb = paintMesh(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mats.glow));
  orb.position.z = 1.46;
  const spark = paintMesh(new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), mats.cyan));
  spark.position.z = 1.46;
  group.add(shaft, cap, orb, spark);
  return group;
}

function makeMallet(mats) {
  const group = new THREE.Group();
  const handle = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.95, 8), mats.grip));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.48;
  const head = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.78, 12), mats.pink));
  head.rotation.z = Math.PI / 2;
  head.position.z = 1.08;
  const band = paintMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 12), mats.gold));
  band.rotation.z = Math.PI / 2;
  band.position.z = 1.08;
  group.add(handle, head, band);
  return group;
}

const BUILDERS = {
  sword: makeSword,
  bat: makeBat,
  hammer: makeHammer,
  axe: makeAxe,
  spear: makeSpear,
  scythe: makeScythe,
  wand: makeWand,
  mallet: makeMallet,
};

export function createWeapons(scene, art) {
  const root = new THREE.Group();
  scene.add(root);
  const LOCAL = 'local';
  const drops = [];
  const slots = new Map();
  const ghosts = new Map();
  let shownKey = '';
  const mats = {
    grip: art.plastic(0x6b3a1f, { roughness: 0.72 }),
    gold: art.plastic(0xffd23f, { roughness: 0.3, metalness: 0.42 }),
    steel: art.plastic(0xdfe6ee, { roughness: 0.18, metalness: 0.78 }),
    tape: art.plastic(0xf4f1ea, { roughness: 0.5 }),
    wood: art.plastic(0xc4843a, { roughness: 0.62 }),
    handle: art.plastic(0x8d5a32, { roughness: 0.7 }),
    iron: art.plastic(0x8e939c, { roughness: 0.34, metalness: 0.62 }),
    red: art.plastic(0xff3344, { roughness: 0.32, metalness: 0.2 }),
    shaft: art.plastic(0x6a4a32, { roughness: 0.66 }),
    cyan: art.plastic(0x7af0ff, { roughness: 0.22, metalness: 0.45, emissive: 0x1a6a88 }),
    dark: art.plastic(0x2a2433, { roughness: 0.55 }),
    violet: art.plastic(0xb388ff, { roughness: 0.35, metalness: 0.2, emissive: 0x3a2066 }),
    glow: art.plastic(0xfff3a0, { roughness: 0.18, emissive: 0xffe14a }),
    pink: art.plastic(0xff5d9a, { roughness: 0.4 }),
  };
  const ringMats = new Map();
  const beamMats = new Map();

  function ringMatFor(color) {
    let mat = ringMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.88,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      ringMats.set(color, mat);
    }
    return mat;
  }

  function beamMatFor(color) {
    let mat = beamMats.get(color);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      beamMats.set(color, mat);
    }
    return mat;
  }

  function build(index) {
    const kind = KINDS[index % KINDS.length];
    const mesh = BUILDERS[kind.id](mats);
    return { kind, mesh };
  }

  function discard(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
    });
    group.removeFromParent();
  }

  function marker(color) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.82, 24), ringMatFor(color));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.18, 3.1, 7, 1, true), beamMatFor(color));
    beam.position.y = 1.62;
    return { ring, beam };
  }

  function spawn(x, z, index) {
    const made = build(index);
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y + 0.12, z);
    const { ring, beam } = marker(made.kind.ring);
    made.mesh.rotation.x = -Math.PI / 2;
    made.mesh.position.y = 0.55;
    group.add(ring, beam, made.mesh);
    root.add(group);
    const drop = {
      kind: made.kind,
      mesh: made.mesh,
      group,
      beam,
      x,
      z,
      spin: Math.random() * Math.PI * 2,
      wait: 0,
    };
    drops.push(drop);
    return drop;
  }

  function plant(mesh, kind, x, z) {
    mesh.position.set(0, 0.55, 0);
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y + 0.12, z);
    const { ring, beam } = marker(kind.ring);
    group.add(ring, beam, mesh);
    root.add(group);
    const drop = {
      kind,
      mesh,
      group,
      beam,
      x,
      z,
      spin: Math.random() * Math.PI * 2,
      wait: 0.7,
    };
    drops.push(drop);
    return drop;
  }

  function slotOf(key = LOCAL) {
    return slots.get(key) || null;
  }

  function take(drop, key) {
    drop.group.remove(drop.mesh);
    discard(drop.group);
    root.add(drop.mesh);
    slots.set(key, { kind: drop.kind, mesh: drop.mesh, chop: 0, hitIds: new Set() });
    const index = drops.indexOf(drop);
    if (index >= 0) drops.splice(index, 1);
  }

  function gripFrame(chopValue, hand, yaw, walking) {
    if (!hand) return null;
    const swing = Math.sin(Math.min(1, chopValue) * Math.PI);
    if (!walking) {
      handQ.set(hand.quaternion.x, hand.quaternion.y, hand.quaternion.z, hand.quaternion.w);
      handQ.multiply(gripQ);
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(handQ);
      return {
        x: hand.position.x,
        y: hand.position.y,
        z: hand.position.z,
        dx: dir.x,
        dy: dir.y,
        dz: dir.z,
        hot: chopValue > 0.12 && chopValue < 0.94,
        quat: handQ.clone(),
      };
    }
    const aim = yaw + (1 - swing) * 1.15;
    const pitch = 0.12 - swing * 0.28;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    yawQ.setFromAxisAngle(UP, aim);
    pitchQ.setFromAxisAngle(RIGHT, pitch);
    return {
      x: hand.position.x,
      y: hand.position.y,
      z: hand.position.z,
      dx: Math.sin(aim) * cp,
      dy: -sp,
      dz: Math.cos(aim) * cp,
      hot: swing > 0.4,
      quat: yawQ.clone().multiply(pitchQ),
    };
  }

  function frame(hand, yaw, walking, key = LOCAL) {
    const slot = slotOf(key);
    if (!slot) return null;
    return gripFrame(slot.chop, hand, yaw, walking);
  }

  return {
    layout() {
      return drops.map((drop) => [
        KINDS.indexOf(drop.kind),
        Math.round(drop.x * 100) / 100,
        Math.round(drop.z * 100) / 100,
      ]);
    },
    show(list) {
      const key = list.map((drop) => drop.join(',')).join('|');
      if (key === shownKey) return;
      shownKey = key;
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.group.removeFromParent();
        discard(drop.group);
        drops.splice(i, 1);
      }
      for (const [index, x, z] of list) spawn(x, z, index);
    },
    clear() {
      for (const drop of drops) discard(drop.group);
      drops.length = 0;
      for (const slot of slots.values()) discard(slot.mesh);
      slots.clear();
      for (const ghost of ghosts.values()) discard(ghost.mesh);
      ghosts.clear();
    },
    spawn,
    variety: () => KINDS.length,
    count: () => drops.length,
    near(x, z, radius) {
      const r2 = radius * radius;
      for (const drop of drops) {
        const dx = drop.x - x;
        const dz = drop.z - z;
        if (dx * dx + dz * dz < r2) return true;
      }
      return false;
    },
    shift(dx, dz) {
      for (const drop of drops) {
        drop.x += dx;
        drop.z += dz;
        drop.group.position.x = drop.x;
        drop.group.position.z = drop.z;
      }
    },
    cull(x, z, radius) {
      const r2 = radius * radius;
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        const dx = drop.x - x;
        const dz = drop.z - z;
        if (dx * dx + dz * dz <= r2) continue;
        drop.group.removeFromParent();
        discard(drop.group);
        drops.splice(i, 1);
      }
    },
    tryPickup(x, z, key = LOCAL) {
      if (slots.has(key)) return null;
      let best = null;
      let bestD = 1.7 * 1.7;
      for (const drop of drops) {
        if (drop.wait > 0) continue;
        const dx = drop.x - x;
        const dz = drop.z - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          best = drop;
          bestD = d;
        }
      }
      if (!best) return null;
      const kind = best.kind;
      take(best, key);
      return kind;
    },
    release(x, z, yaw, key = LOCAL) {
      const slot = slotOf(key);
      if (!slot) return null;
      const { kind, mesh } = slot;
      slots.delete(key);
      const ahead = 1.15;
      plant(mesh, kind, x + Math.sin(yaw) * ahead, z + Math.cos(yaw) * ahead);
      return kind;
    },
    holding: (key = LOCAL) => slotOf(key),
    label: () => {
      const slot = slotOf(LOCAL);
      return slot ? slot.kind.label.replace('!', '') : '';
    },
    labelAt: (index) => {
      const kind = KINDS[index];
      return kind ? kind.label.replace('!', '') : '';
    },
    blurb: () => {
      const slot = slotOf(LOCAL);
      return slot ? slot.kind.blurb : '';
    },
    stats: (key = LOCAL) => {
      const slot = slotOf(key);
      return slot ? slot.kind : null;
    },
    kindIndex: (key = LOCAL) => {
      const slot = slotOf(key);
      return slot ? KINDS.indexOf(slot.kind) : -1;
    },
    reach: () => {
      const slot = slotOf(LOCAL);
      return slot ? slot.kind.reach : 0;
    },
    tick(dt) {
      for (const slot of slots.values()) {
        slot.chop = Math.max(0, slot.chop - dt / slot.kind.swing);
      }
      for (const drop of drops) {
        if (drop.wait > 0) drop.wait = Math.max(0, drop.wait - dt);
        drop.spin += dt * 1.7;
        drop.group.rotation.y = drop.spin;
        drop.group.position.y = GROUND_Y + 0.1 + Math.sin(drop.spin * 2.2) * 0.1;
        const pulse = 0.84 + Math.sin(drop.spin * 3.1) * 0.16;
        drop.beam.scale.set(1, pulse, 1);
      }
    },
    startSwing(key = LOCAL) {
      const slot = slotOf(key);
      if (!slot || slot.chop > 0.08) return false;
      slot.chop = 1;
      slot.hitIds.clear();
      return true;
    },
    chopping: () => {
      const slot = slotOf(LOCAL);
      return !!slot && slot.chop > 0.08;
    },
    chop: (key = LOCAL) => {
      const slot = slotOf(key);
      return slot ? slot.chop : 0;
    },
    seen(id, key = LOCAL) {
      const slot = slotOf(key);
      return !!slot && slot.hitIds.has(id);
    },
    mark(id, key = LOCAL) {
      const slot = slotOf(key);
      if (slot) slot.hitIds.add(id);
    },
    frame,
    wear(list) {
      const live = new Set();
      for (const item of list) {
        if (!item || item.index < 0 || !item.hand) continue;
        live.add(item.id);
        let ghost = ghosts.get(item.id);
        if (!ghost || ghost.index !== item.index) {
          if (ghost) discard(ghost.mesh);
          const made = build(item.index);
          root.add(made.mesh);
          ghost = { index: item.index, mesh: made.mesh };
          ghosts.set(item.id, ghost);
        }
        const grip = gripFrame(item.chop || 0, item.hand, item.yaw || 0, !!item.walking);
        if (!grip) {
          ghost.mesh.visible = false;
          continue;
        }
        ghost.mesh.visible = true;
        ghost.mesh.position.set(grip.x, grip.y, grip.z);
        ghost.mesh.quaternion.copy(grip.quat);
      }
      for (const [id, ghost] of ghosts) {
        if (live.has(id)) continue;
        discard(ghost.mesh);
        ghosts.delete(id);
      }
    },
    shown(on) {
      for (const drop of drops) drop.group.visible = on;
      for (const slot of slots.values()) slot.mesh.visible = on;
      for (const ghost of ghosts.values()) ghost.mesh.visible = on;
    },
    pose(hand, yaw, walking, key = LOCAL) {
      const slot = slotOf(key);
      if (!slot) return;
      const grip = frame(hand, yaw, walking, key);
      if (!grip) return;
      slot.mesh.position.set(grip.x, grip.y, grip.z);
      slot.mesh.quaternion.copy(grip.quat);
    },
  };
}
