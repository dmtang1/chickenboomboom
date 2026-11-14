import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GROUND_Y, GROUP_PROP, GROUP_RAG, GROUP_STATIC, clamp, rand } from './util.js';
import { createWeapons } from './weapons.js';

const CELL = 26;
const ROAD = 8;
const WALK = 2.5;
const CITY = 4;
const SPAN = CITY;
const LOOP_VERGE = 3.2;
const LOOP_ROAD = 10;
const LOOP_LANE = 2.15;
const TURN_R = LOOP_ROAD / 2;
const LOOP_SHOULDER = 2.2;
const LOOP_BLUFF = 7.6;
const WATER_DROP = 11;
const AXIS_Y = new CANNON.Vec3(0, 1, 0);
const FLOW_SPEED = 13;
const ENTRY_GAP = 2.5;
const ENTRY_COYOTE = 0.3;
const FLOW_Z = 17;
const FLOW_X = 8;
const STILL_SECONDS = 5;
const CRAZY_SPEED = 30;
const CRAZY_IDS = ['sport', 'police', 'taxi', 'cyber', 'truck'];

const KINDS = [
  { id: 'sedan', colors: [0xf7f7f5, 0xff5d73, 0x3d7eff, 0x2b2f38, 0xfff3bf, 0x6bcb77], w: 1.75, h: 1.2, d: 4.15, vmin: 8, vmax: 14, weight: 3, shove: 13, loft: 7.5, yaw: 1.8, spin: 4.5, spinScale: 0.42, maxSpin: 14, yells: ['BONK!', 'WHAM!'] },
  { id: 'taxi', colors: [0xffd23f], w: 1.75, h: 1.28, d: 4.2, vmin: 9, vmax: 15, weight: 2, taxi: true, shove: 9, loft: 14, yaw: 3.2, spin: 7, spinScale: 0.38, maxSpin: 16, spread: 2, yJitter: 2, yells: ['POP!', 'HAIL!'] },
  { id: 'sport', colors: [0xff3355, 0xff922b, 0x151515], w: 1.85, h: 1.05, d: 4.35, vmin: 13, vmax: 18, weight: 2, shove: 7, loft: 19, yaw: 2.4, spin: 9, spinScale: 0.32, maxSpin: 20, spread: 2.2, yJitter: 2.4, yells: ['AIRTIME!', 'YEET!'] },
  { id: 'police', colors: [0x1c1f27], w: 1.8, h: 1.32, d: 4.4, vmin: 12, vmax: 17, weight: 1, police: true, shove: 17, loft: 6, yaw: 1.5, spin: 5, spinScale: 0.4, maxSpin: 15, yells: ['PURSUIT!', 'WOOP!'] },
  { id: 'van', colors: [0x4d96ff, 0xf4f1ea, 0xc77dff], w: 2.05, h: 2.0, d: 5.2, vmin: 7, vmax: 12, weight: 2, shove: 19, loft: 4.2, yaw: 1.1, spin: 2.6, spinScale: 0.28, maxSpin: 10, spread: 0.9, yells: ['SHOVE!', 'NUDGE!'] },
  { id: 'truck', colors: [0x2f9e44, 0xff8a3d, 0x8d6e63], w: 2.3, h: 2.2, d: 6.6, vmin: 8, vmax: 13, weight: 2, wheel: 0.5, shove: 18, loft: 12, yaw: 1.6, spin: 6, spinScale: 0.36, maxSpin: 16, yells: ['TAILGATE!', 'BUMP!'] },
  { id: 'bus', colors: [0xff8a3d, 0xffd23f, 0xff5d73], w: 2.5, h: 2.55, d: 8.8, vmin: 6, vmax: 10, weight: 1, bus: true, shove: 23, loft: 3.2, yaw: 0.45, spin: 1.6, spinScale: 0.16, maxSpin: 8, spread: 0.55, yJitter: 0.45, yells: ['WALLOP!', 'FLAT!'] },
  { id: 'cyber', colors: [0xd7dee6, 0x1a1c20], w: 2.2, h: 1.62, d: 5.25, vmin: 11, vmax: 16, weight: 3, wheel: 0.44, shove: 24, loft: 13, yaw: 1.3, spin: 7, spinScale: 0.34, maxSpin: 18, yells: ['WEDGE!', 'STAINLESS!'] },
  { id: 'wagon', colors: [0x141414, 0xf4f1ea, 0x3c4634, 0x8a8e93], w: 2.12, h: 1.98, d: 4.7, vmin: 9, vmax: 14, weight: 3, wheel: 0.5, shove: 27, loft: 4.4, yaw: 0.7, spin: 3, spinScale: 0.22, maxSpin: 11, spread: 0.8, yells: ['BOXED!', 'GWAG!'] },
  { id: 'diesel', colors: [0xc0392b, 0x1c3f73, 0xf2efe6, 0x24282e], w: 2.5, h: 2.85, d: 7.5, vmin: 10, vmax: 15, weight: 2, wheel: 0.6, axle: 0.36, shove: 34, loft: 8.5, yaw: 0.4, spin: 3.5, spinScale: 0.18, maxSpin: 12, spread: 0.7, yJitter: 0.8, yells: ['DIESEL!', 'HAUL!'] },
];

const WEIGHT = KINDS.reduce((sum, kind) => sum + kind.weight, 0);
const HITS = ['SPLAT!', 'BUKAWK!', 'BONK!', 'YEET!', 'HONK!', 'WHAM!', 'POULTRY!'];
const BUILDING_COLORS = [0xff5d73, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff922b, 0xc77dff, 0x4ecdc4, 0xfff3bf, 0xf4f1ea, 0x8d6e63];
const WALL_HITS = 3;
const ROOM_W = 11.5;
const ROOM_D = 13.5;
const ROOM_H = 5.2;
const ROOM_SPAWN_Z = 2.35;
const ROOM_OX = 520;
const ROOM_OZ = 520;

function hash(ix, iz) {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function pickKind() {
  let roll = Math.random() * WEIGHT;
  for (const kind of KINDS) {
    roll -= kind.weight;
    if (roll <= 0) return kind;
  }
  return KINDS[0];
}

function laneOffset(axis, slot) {
  // Left of the center line in the direction of travel.
  if (axis === 'z') return slot === 0 ? ROAD * 0.28 : ROAD * 0.72;
  return slot === 0 ? ROAD * 0.72 : ROAD * 0.28;
}

const FLEETS = {
  main: ['sedan', 'taxi', 'bus', 'police'],
  market: ['van', 'wagon', 'taxi'],
  harbor: ['truck', 'diesel', 'van'],
  carnival: ['sport', 'cyber', 'bus'],
};

const DISTRICT_NAME = {
  main: 'MAIN STREET',
  market: 'THE MARKET',
  harbor: 'THE HARBOR',
  carnival: 'NIGHT CARNIVAL',
};

function districtId(gx, gz) {
  const east = gx >= CITY / 2;
  const north = gz >= CITY / 2;
  if (!north && !east) return 'main';
  if (!north && east) return 'market';
  if (north && !east) return 'harbor';
  return 'carnival';
}

function kindById(id) {
  for (const kind of KINDS) if (kind.id === id) return kind;
  return KINDS[0];
}

function fleetKind(district, salt) {
  const ids = FLEETS[district] || FLEETS.main;
  const n = salt < 0 ? -salt : salt;
  return kindById(ids[n % ids.length]);
}

function fleetPaint(district, kind) {
  if (district === 'carnival') {
    if (kind.id === 'bus') return 0xff2bd6;
    if (kind.id === 'sport') return 0xffe14a;
    if (kind.id === 'cyber') return 0x7af0ff;
  }
  if (district === 'harbor' && kind.id === 'truck') return 0x145a78;
  if (district === 'market' && kind.id === 'wagon') return 0xd86b2a;
  return null;
}

export function createStreets({ world, scene, art, ragdoll, groundMat, ragMat, toyMat, onEvent }) {
  let creditDoll = null;
  const reportStreet = onEvent;
  onEvent = (event) => {
    if (event && event.score && !event.by && creditDoll) event.by = creditDoll;
    reportStreet(event);
  };
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);
  const tileRoot = new THREE.Group();
  const carRoot = new THREE.Group();
  const junkRoot = new THREE.Group();
  root.add(tileRoot, carRoot, junkRoot);

  const skyGeo = new THREE.SphereGeometry(190, 28, 16);
  const skyPos = skyGeo.attributes.position;
  const skyColors = [];
  const skyTop = new THREE.Color('#7ec8ff');
  const skyMid = new THREE.Color('#f6d7b0');
  const skyBot = new THREE.Color('#f6c59a');
  const skyTmp = new THREE.Color();
  for (let i = 0; i < skyPos.count; i++) {
    const y = skyPos.getY(i) / 190;
    skyTmp.copy(skyBot).lerp(skyMid, THREE.MathUtils.smoothstep(y, -0.28, 0.02));
    skyTmp.lerp(skyTop, THREE.MathUtils.smoothstep(y, -0.02, 0.22));
    skyColors.push(skyTmp.r, skyTmp.g, skyTmp.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -2;
  root.add(sky);
  const farGround = new THREE.Mesh(
    new THREE.CircleGeometry(280, 64),
    new THREE.MeshBasicMaterial({ color: 0x176aae }),
  );
  farGround.rotation.x = -Math.PI / 2;
  farGround.position.y = GROUND_Y - WATER_DROP;
  farGround.frustumCulled = false;
  farGround.renderOrder = -1;
  root.add(farGround);

  const carMat = new CANNON.Material('car');
  const buildingMat = new CANNON.Material('building');
  const walkMat = new CANNON.Material('walker');
  world.addContactMaterial(new CANNON.ContactMaterial(carMat, ragMat, { friction: 0.04, restitution: 0.06 }));
  world.addContactMaterial(new CANNON.ContactMaterial(carMat, toyMat, { friction: 0.08, restitution: 0.4 }));
  world.addContactMaterial(new CANNON.ContactMaterial(walkMat, groundMat, { friction: 0.04, restitution: 0 }));
  world.addContactMaterial(new CANNON.ContactMaterial(walkMat, buildingMat, {
    friction: 0.02,
    restitution: 0.35,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 2,
  }));
  world.addContactMaterial(new CANNON.ContactMaterial(walkMat, carMat, { friction: 0.02, restitution: 0.05 }));
  world.addContactMaterial(new CANNON.ContactMaterial(walkMat, walkMat, { friction: 0.35, restitution: 0.02 }));
  world.addContactMaterial(new CANNON.ContactMaterial(buildingMat, ragMat, {
    friction: 0.02,
    restitution: 0.2,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 2,
  }));

  const asphalt = art.plastic(0x3c4453, { roughness: 0.94, metalness: 0 });
  const sidewalkMat = art.plastic(0xd7dbe3, { roughness: 0.86 });
  const yellow = art.plastic(0xffd23f, { roughness: 0.45 });
  const white = art.plastic(0xf7f8fb, { roughness: 0.5 });
  const tire = art.plastic(0x1c1e24, { roughness: 0.78 });
  const carGlass = new THREE.MeshBasicMaterial({ color: 0x1a2836 });
  const lampMat = art.plastic(0xfff6d4, { emissive: 0xfff1c2, roughness: 0.22 });
  lampMat.emissiveIntensity = 1.6;
  const tailMat = art.plastic(0xff2a3a, { emissive: 0xff2436, roughness: 0.32 });
  tailMat.emissiveIntensity = 0.85;
  const trim = art.plastic(0x2a2e36, { roughness: 0.48, metalness: 0.28 });
  const chrome = art.plastic(0xd5dce6, { roughness: 0.22, metalness: 0.78 });
  const stainless = art.plastic(0xd7dee6, { roughness: 0.16, metalness: 0.94 });
  const plateMat = art.plastic(0xf6f3ea, { roughness: 0.55 });
  const sirenRed = art.plastic(0xff2244, { emissive: 0xff2244, roughness: 0.35 });
  const sirenBlue = art.plastic(0x3d7eff, { emissive: 0x3d7eff, roughness: 0.35 });
  const signalMat = art.plastic(0x1a1d24, { roughness: 0.42, metalness: 0.18 });
  function makeLens(color) {
    const material = art.plastic(color, { emissive: color, roughness: 0.25 });
    material.emissiveIntensity = 0.05;
    return material;
  }
  const nsLens = { red: makeLens(0xff2436), yellow: makeLens(0xffd23f), green: makeLens(0x2ee56a) };
  const ewLens = { red: makeLens(0xff2436), yellow: makeLens(0xffd23f), green: makeLens(0x2ee56a) };
  const loopLens = { red: makeLens(0xff2436), yellow: makeLens(0xffd23f), green: makeLens(0x2ee56a) };
  const stemLens = { red: makeLens(0xff2436), yellow: makeLens(0xffd23f), green: makeLens(0x2ee56a) };
  const treeMat = art.plastic(0x3dae62, { roughness: 0.7 });
  const trunkMat = art.plastic(0x8d5a32, { roughness: 0.8 });
  const signMat = art.plastic(0xffe14a, { roughness: 0.4, emissive: 0xffb703 });
  const poleMat = art.plastic(0x5c6570, { roughness: 0.45, metalness: 0.35 });
  const windowMat = art.plastic(0x9fd4ff, { roughness: 0.15, emissive: 0x8ecfff });
  windowMat.emissiveIntensity = 0.55;
  const buildingMats = BUILDING_COLORS.map((color) => art.plastic(color, { roughness: 0.48 }));
  const holeMat = art.plastic(0x16110e, { roughness: 0.96 });
  const doorWood = art.plastic(0xc17a3a, { roughness: 0.62 });
  const doorFrame = art.plastic(0xffe14a, { roughness: 0.38, emissive: 0xffc107 });
  doorFrame.emissiveIntensity = 0.55;
  const entryMat = art.plastic(0x6bcb77, { roughness: 0.7, emissive: 0x2f9e44 });
  entryMat.emissiveIntensity = 0.35;
  const roomMat = new CANNON.Material('room');
  world.addContactMaterial(new CANNON.ContactMaterial(roomMat, groundMat, { friction: 0.42, restitution: 0.3 }));
  world.addContactMaterial(new CANNON.ContactMaterial(roomMat, ragMat, { friction: 0.16, restitution: 0.62 }));
  world.addContactMaterial(new CANNON.ContactMaterial(roomMat, walkMat, { friction: 0.06, restitution: 0.42 }));
  world.addContactMaterial(new CANNON.ContactMaterial(roomMat, roomMat, { friction: 0.3, restitution: 0.42 }));
  world.addContactMaterial(new CANNON.ContactMaterial(roomMat, buildingMat, { friction: 0.4, restitution: 0.16 }));
  const grassMat = art.plastic(0x63c76a, { roughness: 0.92 });
  const pathMat = art.plastic(0xe7d3a4, { roughness: 0.9 });
  const sandMat = art.plastic(0xf3d7a1, { roughness: 0.96 });
  const rubberMat = art.plastic(0x3a78f0, { roughness: 0.74 });
  const rubberAlt = art.plastic(0xff5d73, { roughness: 0.74 });
  const stoneMat = art.plastic(0xd5dbe6, { roughness: 0.62 });
  const plazaMat = art.plastic(0xe6dcc8, { roughness: 0.84 });
  const waterMat = art.plastic(0x3ec6ff, { roughness: 0.16, emissive: 0x1498d8 });
  waterMat.emissiveIntensity = 0.55;
  const rockMat = art.plastic(0x8a8178, { roughness: 0.94 });
  const rockWet = art.plastic(0x4f636e, { roughness: 0.97 });
  const foamMat = art.plastic(0xe9f6ff, { roughness: 0.48, emissive: 0xd4eeff });
  foamMat.emissiveIntensity = 0.4;
  const oceanMat = art.plastic(0x1e7ec2, { roughness: 0.2, emissive: 0x0c629e });
  oceanMat.emissiveIntensity = 0.42;
  const fenceMat = art.plastic(0xe6d3b0, { roughness: 0.7 });
  const fencePost = art.plastic(0x8d6a45, { roughness: 0.82 });
  const woodSeat = art.plastic(0xc4844a, { roughness: 0.74 });
  const woodDark = art.plastic(0x7a4e2d, { roughness: 0.8 });
  const metalMat = art.plastic(0xc5ccd6, { roughness: 0.28, metalness: 0.7 });
  const hydrantMat = art.plastic(0xe23b3b, { roughness: 0.42 });
  const leafMat = art.plastic(0x2f9e44, { roughness: 0.78 });
  const flowerMats = [0xff5d73, 0xffd23f, 0xc77dff, 0xff922b].map((color) => art.plastic(color, { roughness: 0.45 }));
  const umbrellaMats = [0xff5d73, 0xffd23f, 0x4d96ff, 0xf4f1ea].map((color) => art.plastic(color, { roughness: 0.55 }));
  const crateMat = art.plastic(0xc4844a, { roughness: 0.78 });
  const dockMat = art.plastic(0xb08968, { roughness: 0.9 });
  const dockLine = art.plastic(0x8d6a45, { roughness: 0.92 });
  const boatHull = art.plastic(0xf4f1ea, { roughness: 0.55 });
  const buoyMat = art.plastic(0xff6a1a, { roughness: 0.4, emissive: 0xff4d00 });
  buoyMat.emissiveIntensity = 0.35;
  const nightMat = art.plastic(0x24143f, { roughness: 0.88 });
  const nightCloth = art.plastic(0x3a215c, { roughness: 0.72 });
  const nightPost = art.plastic(0x1a102c, { roughness: 0.6, metalness: 0.2 });
  function glowPlastic(color) {
    const material = art.plastic(color, { emissive: color, roughness: 0.28 });
    material.emissiveIntensity = 1.35;
    return material;
  }
  const neonPink = glowPlastic(0xff3d8a);
  const neonCyan = glowPlastic(0x3de4ff);
  const neonYellow = glowPlastic(0xffe14a);
  const brickMat = art.plastic(0xd4765a, { roughness: 0.8 });
  const concreteMat = art.plastic(0xb7c0cc, { roughness: 0.78 });
  const barMat = art.plastic(0x1a1e24, { roughness: 0.42, metalness: 0.62 });
  const paint = new Map();
  const labels = new Map();

  const plane = new THREE.PlaneGeometry(1, 1);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.07, 14);
  const capGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10);
  const crownGeo = new THREE.SphereGeometry(0.72, 8, 6);
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.13, 1.15, 6);
  const junkGeo = new THREE.BoxGeometry(0.52, 0.52, 0.52);
  const roundGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  const coneGeo = new THREE.ConeGeometry(1, 1, 12);
  const hoopGeo = new THREE.TorusGeometry(0.34, 0.035, 6, 14);
  const ferrisGeo = new THREE.TorusGeometry(2.6, 0.1, 6, 22);
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.3, 6);
  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 1.12, 6);
  const signalHousingGeo = new THREE.BoxGeometry(0.42, 1.05, 0.42);
  const signalLensGeo = new THREE.SphereGeometry(0.12, 12, 8);
  const shapes = new Map();

  const tiles = [];
  const cars = [];
  const junk = [];
  const JUNK_CAP = 64;
  const weapons = createWeapons(scene, art);
  let nextCarId = 1;
  let nextJunkId = 1;
  let nextPrizeId = 1;
  const WAVE_THEMES = ['ducks', 'pins', 'float'];
  const WAVE_LABEL = { ducks: 'DUCKS!', pins: 'PINS!', float: 'PARADE!' };
  let waveCursor = 0;
  let waveReadyAt = 0;
  const waveQueue = [];
  let mirror = false;
  let shared = false;
  let actors = [ragdoll];
  const carGhosts = new Map();
  const junkGhosts = new Map();
  const ghostQA = new THREE.Quaternion();
  const ghostQB = new THREE.Quaternion();
  let hostOffset = null;
  let lastHostStamp = -1;
  const CAR_DELAY = 0.1;
  const CAR_SNAP = 18;
  const ghostRoot = new THREE.Group();
  root.add(ghostRoot);
  let toyMotions = [];
  let buildingKey = '';
  let ground = null;
  let shiftX = 0;
  let shiftZ = 0;
  let district = null;
  const districtBodies = [];
  let hits = 0;
  let seenDistrict = '';
  const tallies = { meter: 0, cart: 0, balloon: 0 };
  let running = false;
  let stillTime = 0;
  let campX = 0;
  let campZ = 0;
  let campSet = false;
  const prey = { x: 0, z: 0, still: false };
  let wanted = false;
  let grace = 0;
  let bashCool = 0;
  let bust = null;
  let hauls = [];
  let suspects = [];
  let viewerHold = '';
  let viewerDrive = null;
  let viewerOffer = false;
  let jail = null;
  let room = null;
  let parked = false;
  const indoors = new Set();
  const roomReturn = new Map();
  const roomGraceDolls = new Map();
  const entryLock = new Map();
  const gateQueue = [];
  let viewerInside = false;
  let bonkAt = 0;

  function addBody(body) {
    if (!body.world) CANNON.World.prototype.addBody.call(world, body);
  }

  function removeBody(body) {
    if (body.world) CANNON.World.prototype.removeBody.call(world, body);
  }

  function paintOf(color) {
    let material = paint.get(color);
    if (!material) {
      material = art.plastic(color, { roughness: 0.34 });
      paint.set(color, material);
    }
    return material;
  }

  function addPlane(tile, material, w, d, lx, lz, y) {
    const mesh = new THREE.Mesh(plane, material);
    mesh.scale.set(w, d, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(lx, y, lz);
    mesh.receiveShadow = true;
    tile.group.add(mesh);
  }

  function addStatic(tile, w, h, d, lx, ly, lz) {
    const body = new CANNON.Body({
      mass: 0,
      material: buildingMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    body.position.set(shiftX + tile.gx * CELL + lx, ly, shiftZ + tile.gz * CELL + lz);
    body.aabbNeedsUpdate = true;
    body.gameRole = 'static';
    addBody(body);
    const entry = { body, lx, ly, lz, hx: w / 2, hy: h / 2, hz: d / 2 };
    tile.bodies.push(entry);
    return entry;
  }

  function syncTile(tile) {
    const x0 = shiftX + tile.gx * CELL;
    const z0 = shiftZ + tile.gz * CELL;
    tile.group.position.set(x0, 0, z0);
    for (const entry of tile.bodies) {
      entry.body.position.set(x0 + entry.lx, entry.ly, z0 + entry.lz);
      entry.body.previousPosition.copy(entry.body.position);
      entry.body.aabbNeedsUpdate = true;
    }
  }

  function placeTile(tile, gx, gz) {
    for (const entry of tile.bodies) removeBody(entry.body);
    tile.bodies.length = 0;
    tile.props = [];
    tile.doors = [];
    tile.group.clear();
    tile.gx = gx;
    tile.gz = gz;
    const h = hash(gx, gz);
    const block = CELL - ROAD;

    addPlane(tile, asphalt, ROAD, block, ROAD / 2, ROAD + block / 2, GROUND_Y + 0.02);
    addPlane(tile, asphalt, CELL, ROAD, CELL / 2, ROAD / 2, GROUND_Y + 0.025);
    addPlane(tile, sidewalkMat, block, block, ROAD + block / 2, ROAD + block / 2, GROUND_Y + 0.045);

    const dashStart = ROAD + 3.35;
    const dashRoom = block - (dashStart - ROAD) - 1.1;
    for (let i = 0; i < 4; i++) {
      const at = dashStart + (i + 0.5) * (dashRoom / 4);
      const dash = new THREE.Mesh(box, yellow);
      dash.scale.set(0.16, 0.03, 1.35);
      dash.position.set(ROAD / 2, GROUND_Y + 0.06, at);
      dash.receiveShadow = true;
      tile.group.add(dash);
      const across = new THREE.Mesh(box, yellow);
      across.scale.set(1.35, 0.03, 0.16);
      across.position.set(at, GROUND_Y + 0.06, ROAD / 2);
      across.receiveShadow = true;
      tile.group.add(across);
    }
    addCrosswalk(tile, 0, true);
    addCrosswalk(tile, ROAD, true);
    addCrosswalk(tile, 0, false);
    addCrosswalk(tile, ROAD, false);

    buildLot(tile, h, block);

    addStreetLight(tile, ROAD + 0.62, ROAD + 5.4, Math.PI, `${gx}-${gz}-a`);
    addStreetLight(tile, ROAD + 6.2, ROAD + 0.62, Math.PI / 2, `${gx}-${gz}-b`);
    addStreetLight(tile, ROAD + block * 0.62, ROAD + 0.62, Math.PI / 2, `${gx}-${gz}-c`);

    addWarningSign(tile, ROAD + 4.6, ROAD + 1.25);
    addStopLines(tile);
    addSignal(tile);

    syncTile(tile);
    if (jail) evictLot(jail.cx, jail.cz, jail.halfX, jail.halfZ);
  }

  function addPaint(tile, w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(box, white);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    tile.group.add(mesh);
    return mesh;
  }

  function addCrosswalk(tile, outer, acrossRoad) {
    const depth = 1.7;
    const lip = 0.16;
    const near = outer + lip;
    const far = near + depth;
    const y = GROUND_Y + 0.05;
    const curb0 = 0.18;
    const curb1 = ROAD - 0.18;
    const lineT = 0.16;
    const mid = (near + far) / 2;
    if (acrossRoad) {
      addPaint(tile, curb1 - curb0, 0.02, lineT, (curb0 + curb1) / 2, y, near + lineT / 2);
      addPaint(tile, curb1 - curb0, 0.02, lineT, (curb0 + curb1) / 2, y, far - lineT / 2);
    } else {
      addPaint(tile, lineT, 0.02, curb1 - curb0, near + lineT / 2, y + 0.004, (curb0 + curb1) / 2);
      addPaint(tile, lineT, 0.02, curb1 - curb0, far - lineT / 2, y + 0.004, (curb0 + curb1) / 2);
    }
    const barW = 0.46;
    const gap = 0.38;
    let from = curb0 + 0.1;
    let to = curb1 - 0.1;
    if (outer < 1) from = Math.max(from, far + 0.14);
    const inner = depth - lineT * 2 - 0.12;
    const count = Math.max(3, Math.floor((to - from + gap) / (barW + gap)));
    const span = count * barW + (count - 1) * gap;
    let cursor = (from + to) / 2 - span / 2 + barW / 2;
    for (let i = 0; i < count; i++) {
      if (acrossRoad) addPaint(tile, barW, 0.02, inner, cursor, y + 0.008, mid);
      else addPaint(tile, inner, 0.02, barW, mid, y + 0.01, cursor);
      cursor += barW + gap;
    }
  }

  function addWarningSign(tile, x, z) {
    const H = 2.3;
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y + H / 2, z);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.castShadow = true;
    const backing = new THREE.Mesh(box, signalMat);
    backing.scale.set(0.82, 0.82, 0.04);
    backing.rotation.z = Math.PI / 4;
    backing.position.set(0, 1.02, 0);
    const diamond = new THREE.Mesh(box, signMat);
    diamond.scale.set(0.64, 0.64, 0.05);
    diamond.rotation.z = Math.PI / 4;
    diamond.position.set(0, 1.02, 0.035);
    const armV = new THREE.Mesh(box, signalMat);
    armV.scale.set(0.07, 0.32, 0.02);
    armV.position.set(0, 1.02, 0.07);
    const armH = new THREE.Mesh(box, signalMat);
    armH.scale.set(0.32, 0.07, 0.02);
    armH.position.set(0, 1.02, 0.07);
    group.add(pole, backing, diamond, armV, armH);
    tile.group.add(group);
    tile.props.push({
      id: `sign-${tile.gx}-${tile.gz}`,
      kind: 'sign',
      group,
      lx: x,
      lz: z,
      h: H,
      radius: 0.85,
      reachH: H + 0.8,
      mass: 9,
      kick: 3.4,
      up: 1.6,
      spin: 4.2,
      yell: 'SIGN DOWN!',
      score: 14,
      pad: 0.9,
      shapes: [
        new CANNON.Box(new CANNON.Vec3(0.08, H / 2, 0.08)),
        offsetShape(new CANNON.Vec3(0.42, 0.42, 0.04), 0, 1.02, 0),
      ],
    });
  }

  function addTree(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y + 0.95, z);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    const crown = new THREE.Mesh(crownGeo, treeMat);
    crown.position.y = 1.15;
    crown.scale.set(1, 0.8, 1);
    crown.castShadow = true;
    group.add(trunk, crown);
    tile.group.add(group);
    tile.props.push({
      id: `tree-${tile.gx}-${tile.gz}-${x.toFixed(1)}`,
      kind: 'tree',
      group,
      lx: x,
      lz: z,
      h: 2.4,
      radius: 0.9,
      reachH: 2.8,
      mass: 14,
      kick: 2.8,
      up: 1.8,
      spin: 2.6,
      yell: 'TIMBER!',
      score: 12,
      pad: 1,
      shapes: [
        new CANNON.Box(new CANNON.Vec3(0.14, 0.58, 0.14)),
        offsetShape(new CANNON.Vec3(0.55, 0.5, 0.55), 0, 1.15, 0),
      ],
    });
  }

  function addStreetLight(tile, x, z, yaw, id) {
    const H = 5.1;
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y + H / 2, z);
    group.rotation.y = yaw;
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.scale.set(1.2, H / 2.3, 1.2);
    pole.castShadow = true;
    const arm = new THREE.Mesh(box, poleMat);
    arm.scale.set(1.25, 0.08, 0.08);
    arm.position.set(0.55, H / 2 - 0.12, 0);
    const head = new THREE.Mesh(box, signalMat);
    head.scale.set(0.72, 0.16, 0.34);
    head.position.set(1.12, H / 2 - 0.28, 0);
    const glow = new THREE.Mesh(box, lampMat);
    glow.scale.set(0.52, 0.05, 0.22);
    glow.position.set(1.12, H / 2 - 0.38, 0);
    group.add(pole, arm, head, glow);
    tile.group.add(group);
    tile.props.push({
      id: `lamp-${id}`,
      kind: 'lamp',
      group,
      lx: x,
      lz: z,
      h: H,
      radius: 1.05,
      reachH: H + 0.5,
      mass: 20,
      kick: 2.6,
      up: 1.3,
      spin: 2.8,
      yell: 'LIGHTS OUT!',
      score: 18,
      pad: 2.8,
      shapes: [
        new CANNON.Box(new CANNON.Vec3(0.09, H / 2, 0.09)),
        offsetShape(new CANNON.Vec3(0.62, 0.05, 0.05), 0.55, H / 2 - 0.12, 0),
        offsetShape(new CANNON.Vec3(0.36, 0.1, 0.17), 1.12, H / 2 - 0.28, 0),
      ],
    });
  }

  function offsetShape(half, x, y, z) {
    const shape = new CANNON.Box(half);
    shape.offset = new CANNON.Vec3(x, y, z);
    return shape;
  }

  function addStopLines(tile) {
    const lane = 3.05;
    const y = GROUND_Y + 0.06;
    const back = ROAD + 2.45;
    const mark = (x, z, acrossX) => {
      addPaint(tile, acrossX ? lane : 0.22, 0.03, acrossX ? 0.22 : lane, x, y, z);
    };
    mark(ROAD * 0.28, CELL - 0.95, true);
    mark(ROAD * 0.72, back, true);
    mark(CELL - 0.95, ROAD * 0.72, false);
    mark(back, ROAD * 0.28, false);
  }

  function addSignalHead(parent, lenses, x, y, z) {
    const housing = new THREE.Mesh(signalHousingGeo, signalMat);
    housing.position.set(x, y, z);
    housing.castShadow = true;
    parent.add(housing);
    const order = ['red', 'yellow', 'green'];
    for (let i = 0; i < 3; i++) {
      const ly = y + 0.32 - i * 0.32;
      for (const side of [-1, 1]) {
        const lens = new THREE.Mesh(signalLensGeo, lenses[order[i]]);
        lens.position.set(x + side * 0.2, ly, z);
        parent.add(lens);
        const lensZ = new THREE.Mesh(signalLensGeo, lenses[order[i]]);
        lensZ.position.set(x, ly, z + side * 0.2);
        parent.add(lensZ);
      }
    }
  }

  function addSignal(tile) {
    const poleH = 2.3 * 1.75;
    const px = ROAD + 0.72;
    const pz = ROAD + 0.72;
    const group = new THREE.Group();
    group.position.set(px, GROUND_Y + poleH / 2, pz);
    const mast = new THREE.Mesh(poleGeo, poleMat);
    mast.scale.set(0.9, 1.75, 0.9);
    mast.castShadow = true;
    group.add(mast);
    const top = poleH / 2 - 0.08;
    const armX = new THREE.Mesh(box, signalMat);
    armX.scale.set(2.5, 0.1, 0.12);
    armX.position.set(-1.25, top, 0);
    group.add(armX);
    const armZ = new THREE.Mesh(box, signalMat);
    armZ.scale.set(0.12, 0.1, 2.5);
    armZ.position.set(0, top, -1.25);
    group.add(armZ);
    addSignalHead(group, nsLens, -2.5, top - 0.62, 0);
    addSignalHead(group, ewLens, 0, top - 0.62, -2.5);
    tile.group.add(group);
    tile.props.push({
      id: `signal-${tile.gx}-${tile.gz}`,
      kind: 'signal',
      group,
      lx: px,
      lz: pz,
      h: poleH,
      radius: 2.7,
      reachH: poleH + 0.7,
      mass: 32,
      kick: 2.2,
      up: 1.1,
      spin: 1.8,
      yell: 'SIGNAL DOWN!',
      score: 24,
      pad: 2.2,
      shapes: [
        new CANNON.Box(new CANNON.Vec3(0.1, poleH / 2, 0.1)),
        offsetShape(new CANNON.Vec3(1.25, 0.06, 0.08), -1.25, top, 0),
        offsetShape(new CANNON.Vec3(0.08, 0.06, 1.25), 0, top, -1.25),
        offsetShape(new CANNON.Vec3(0.24, 0.52, 0.24), -2.5, top - 0.62, 0),
        offsetShape(new CANNON.Vec3(0.24, 0.52, 0.24), 0, top - 0.62, -1.25),
      ],
    });
  }

  function put(parent, geo, mat, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function signTexture(text, bg, fg) {
    const key = `${text}|${bg}|${fg}`;
    let material = labels.get(key);
    if (material) return material;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = fg;
    ctx.font = '700 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 68);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    labels.set(key, material);
    return material;
  }

  function hangSign(tile, text, bg, fg, x, y, z, yaw, w = 1.35, h = 0.58) {
    const mesh = new THREE.Mesh(plane, signTexture(text, bg, fg));
    mesh.scale.set(w, h, 1);
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    tile.group.add(mesh);
    return mesh;
  }

  function knock(tile, group, spec) {
    tile.group.add(group);
    tile.props.push({
      id: spec.id,
      kind: spec.kind,
      group,
      lx: spec.lx,
      lz: spec.lz,
      h: spec.h,
      radius: spec.radius,
      reachH: spec.reachH,
      mass: spec.mass,
      kick: spec.kick,
      up: spec.up,
      spin: spec.spin,
      yell: spec.yell,
      score: spec.score,
      pad: spec.pad,
      shapes: spec.shapes,
      mark: spec.mark || '',
    });
  }

  function tag(tile, kind, x, z) {
    return `${kind}-${tile.gx}-${tile.gz}-${x.toFixed(1)}-${z.toFixed(1)}`;
  }

  function doorway(face, x, z, w, d) {
    const out = 0.82;
    const exit = 2.45;
    if (face === 'east') return { lx: x + w / 2 + out, lz: z, ox: x + w / 2 + exit, oz: z, yaw: -Math.PI / 2 };
    if (face === 'west') return { lx: x - w / 2 - out, lz: z, ox: x - w / 2 - exit, oz: z, yaw: Math.PI / 2 };
    if (face === 'north') return { lx: x, lz: z + d / 2 + out, ox: x, oz: z + d / 2 + exit, yaw: 0 };
    return { lx: x, lz: z - d / 2 - out, ox: x, oz: z - d / 2 - exit, yaw: Math.PI };
  }

  function addEntry(tile, face, x, z, w, d, spot) {
    const alongX = face === 'east' || face === 'west';
    const px = face === 'east' ? x + w / 2 + 0.07 : face === 'west' ? x - w / 2 - 0.07 : x;
    const pz = face === 'north' ? z + d / 2 + 0.07 : z - d / 2 - 0.07;
    const yaw = face === 'east' ? Math.PI / 2 : face === 'west' ? -Math.PI / 2 : face === 'north' ? 0 : Math.PI;
    const meshes = [];
    const post = (offset) => {
      const mesh = new THREE.Mesh(box, doorFrame);
      mesh.scale.set(0.14, 2.2, 0.14);
      mesh.position.set(px + (alongX ? 0 : offset), GROUND_Y + 1.1, pz + (alongX ? offset : 0));
      mesh.castShadow = true;
      tile.group.add(mesh);
      meshes.push(mesh);
    };
    post(-0.68);
    post(0.68);
    const lintel = new THREE.Mesh(box, doorFrame);
    lintel.scale.set(alongX ? 0.14 : 1.52, 0.16, alongX ? 1.52 : 0.14);
    lintel.position.set(px, GROUND_Y + 2.2, pz);
    lintel.castShadow = true;
    tile.group.add(lintel);
    meshes.push(lintel);
    const leaf = new THREE.Mesh(box, doorWood);
    leaf.scale.set(alongX ? 0.1 : 0.42, 1.9, alongX ? 0.42 : 0.1);
    leaf.position.set(
      px + (alongX ? 0.04 : 0.34),
      GROUND_Y + 0.98,
      pz + (alongX ? 0.34 : 0.04),
    );
    leaf.castShadow = true;
    tile.group.add(leaf);
    meshes.push(leaf);
    const mat = new THREE.Mesh(plane, entryMat);
    mat.rotation.x = -Math.PI / 2;
    mat.scale.set(1.55, 1.55, 1);
    mat.position.set(spot.lx, GROUND_Y + 0.09, spot.lz);
    mat.receiveShadow = true;
    tile.group.add(mat);
    meshes.push(mat);
    meshes.push(hangSign(tile, 'IN', '#143d16', '#e9ffb0', px, GROUND_Y + 2.62, pz, yaw, 0.86, 0.4));
    return meshes;
  }

  function addStructure(tile, o) {
    const { x, z, w, d, bh, colorIndex, id } = o;
    const mat = o.brick ? brickMat : buildingMats[colorIndex % buildingMats.length];
    const mesh = new THREE.Mesh(box, mat);
    mesh.scale.set(w, bh, d);
    mesh.position.set(x, GROUND_Y + bh / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    tile.group.add(mesh);
    const solid = addStatic(tile, w, bh, d, x, GROUND_Y + bh / 2, z);
    const shells = [mesh];
    const windows = [];
    const rows = Math.max(1, Math.min(5, Math.floor(bh / 2.3)));
    const cols = w > 8 ? 2 : 1;
    const doorFace = o.door || 'south';
    for (let row = 0; row < rows; row++) {
      const wy = GROUND_Y + 1.55 + row * 2.05;
      if (wy > GROUND_Y + bh - 0.65) continue;
      for (let col = 0; col < cols; col++) {
        const along = cols === 1 ? 0 : -0.22 + col * 0.44;
        const slide = doorFace === 'south' && cols === 1 ? w * 0.26 : along * w;
        const south = new THREE.Mesh(box, windowMat);
        south.scale.set(Math.min(0.85, w * 0.28), 0.78, 0.08);
        south.position.set(x + slide, wy, z - d / 2 - 0.04);
        tile.group.add(south);
        windows.push(south);
        if (d > 5) {
          const west = new THREE.Mesh(box, windowMat);
          west.scale.set(0.08, 0.78, Math.min(0.85, d * 0.18));
          west.position.set(x - w / 2 - 0.04, wy, z + along * d);
          tile.group.add(west);
          windows.push(west);
        }
      }
    }
    const door = new THREE.Mesh(box, holeMat);
    if (doorFace === 'east') {
      door.scale.set(0.08, 1.45, 0.72);
      door.position.set(x + w / 2 + 0.04, GROUND_Y + 0.74, z);
    } else if (doorFace === 'west') {
      door.scale.set(0.08, 1.45, 0.72);
      door.position.set(x - w / 2 - 0.04, GROUND_Y + 0.74, z);
    } else {
      door.scale.set(0.72, 1.45, 0.08);
      door.position.set(x, GROUND_Y + 0.74, z - d / 2 - 0.04);
    }
    tile.group.add(door);
    shells.push(door);
    if (o.enter) {
      const spot = doorway(doorFace, x, z, w, d);
      shells.push(...addEntry(tile, doorFace, x, z, w, d, spot));
      tile.doors.push({ id, lx: spot.lx, lz: spot.lz, ox: spot.ox, oz: spot.oz, yaw: spot.yaw });
    }
    if (o.sign) {
      const yaw = doorFace === 'east' ? Math.PI / 2 : doorFace === 'west' ? -Math.PI / 2 : Math.PI;
      const sx = doorFace === 'east' ? x + w / 2 + 0.08 : doorFace === 'west' ? x - w / 2 - 0.08 : x;
      const sz = doorFace === 'south' ? z - d / 2 - 0.08 : z + (doorFace === 'east' || doorFace === 'west' ? 0 : 0);
      shells.push(hangSign(tile, o.sign.text, o.sign.bg, o.sign.fg, sx, GROUND_Y + Math.min(bh - 0.7, 2.55), sz, yaw, o.sign.w || 1.45, o.sign.h || 0.56));
    }
    if (bh > 7) {
      const roof = new THREE.Mesh(box, buildingMats[(colorIndex + 3) % buildingMats.length]);
      roof.scale.set(w * 0.28, 0.5, d * 0.28);
      roof.position.set(x + w * 0.16, GROUND_Y + bh + 0.25, z - d * 0.1);
      roof.castShadow = true;
      tile.group.add(roof);
      shells.push(roof);
    }
    tile.props.push({
      id,
      enter: !!o.enter,
      kind: 'building',
      hits: 0,
      sides: { east: 0, west: 0, north: 0, south: 0 },
      shells,
      holeMeshes: [],
      solid,
      lx: x,
      ly: GROUND_Y + bh / 2,
      lz: z,
      hx: w / 2,
      hy: bh / 2,
      hz: d / 2,
      color: o.brick ? 0xd4765a : BUILDING_COLORS[colorIndex % BUILDING_COLORS.length],
      windows,
    });
  }

  function addAwning(tile, x, y, z, w, d, mat, id) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    put(group, box, mat, 0, 0, 0, w, 0.1, d);
    put(group, box, white, 0, 0.06, 0, w * 0.92, 0.025, d * 0.22);
    knock(tile, group, {
      id,
      kind: 'awning',
      lx: x,
      lz: z,
      h: 0.4,
      radius: Math.max(w, d) * 0.55,
      reachH: 2.9,
      mass: 5,
      kick: 4.5,
      up: 2.2,
      spin: 5,
      yell: 'RIP!',
      score: 10,
      pad: 0.9,
      shapes: [new CANNON.Box(new CANNON.Vec3(w / 2, 0.06, d / 2))],
    });
  }

  function addBench(tile, x, z, yaw) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    group.rotation.y = yaw;
    put(group, box, woodSeat, 0, 0.46, 0, 1.45, 0.08, 0.42);
    put(group, box, woodSeat, 0, 0.74, -0.17, 1.45, 0.42, 0.06);
    for (const sx of [-0.62, 0.62]) {
      put(group, box, woodDark, sx, 0.24, 0.12, 0.08, 0.48, 0.08);
      put(group, box, woodDark, sx, 0.24, -0.12, 0.08, 0.48, 0.08);
    }
    knock(tile, group, {
      id: tag(tile, 'bench', x, z),
      kind: 'bench',
      lx: x,
      lz: z,
      h: 1,
      radius: 0.9,
      reachH: 1.35,
      mass: 7,
      kick: 3.6,
      up: 1.8,
      spin: 3.4,
      yell: 'BENCH!',
      score: 8,
      pad: 0.85,
      shapes: [
        offsetShape(new CANNON.Vec3(0.72, 0.05, 0.22), 0, 0.46, 0),
        offsetShape(new CANNON.Vec3(0.72, 0.22, 0.04), 0, 0.74, -0.17),
      ],
    });
  }

  function addChair(tile, x, z, yaw) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    group.rotation.y = yaw;
    put(group, box, woodSeat, 0, 0.46, 0, 0.42, 0.06, 0.42);
    put(group, box, woodSeat, 0, 0.74, -0.18, 0.42, 0.42, 0.06);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        put(group, box, woodDark, sx * 0.16, 0.22, sz * 0.16, 0.05, 0.44, 0.05);
      }
    }
    knock(tile, group, {
      id: tag(tile, 'chair', x, z),
      kind: 'chair',
      lx: x,
      lz: z,
      h: 0.95,
      radius: 0.42,
      reachH: 1.25,
      mass: 2.4,
      kick: 5,
      up: 2.4,
      spin: 6,
      yell: 'CHAIR!',
      score: 6,
      pad: 0.55,
      shapes: [
        offsetShape(new CANNON.Vec3(0.22, 0.04, 0.22), 0, 0.46, 0),
        offsetShape(new CANNON.Vec3(0.22, 0.21, 0.04), 0, 0.74, -0.18),
      ],
    });
  }

  function addTable(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, woodSeat, 0, 0.74, 0, 0.46, 0.07, 0.46);
    put(group, roundGeo, woodDark, 0, 0.38, 0, 0.07, 0.68, 0.07);
    knock(tile, group, {
      id: tag(tile, 'table', x, z),
      kind: 'table',
      lx: x,
      lz: z,
      h: 0.8,
      radius: 0.58,
      reachH: 1.15,
      mass: 5.5,
      kick: 3.8,
      up: 1.7,
      spin: 3.2,
      yell: 'TABLE!',
      score: 8,
      pad: 0.7,
      shapes: [
        offsetShape(new CANNON.Vec3(0.46, 0.04, 0.46), 0, 0.74, 0),
        offsetShape(new CANNON.Vec3(0.08, 0.34, 0.08), 0, 0.38, 0),
      ],
    });
  }

  function addUmbrella(tile, x, z, tint) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, woodDark, 0, 1.15, 0, 0.04, 2.3, 0.04);
    put(group, coneGeo, umbrellaMats[tint % umbrellaMats.length], 0, 2.15, 0, 0.85, 0.42, 0.85);
    knock(tile, group, {
      id: tag(tile, 'brolly', x, z),
      kind: 'umbrella',
      lx: x,
      lz: z,
      h: 2.4,
      radius: 0.9,
      reachH: 2.6,
      mass: 3.2,
      kick: 4.2,
      up: 2.6,
      spin: 4,
      yell: 'UMBRELLA!',
      score: 9,
      pad: 0.8,
      shapes: [
        offsetShape(new CANNON.Vec3(0.05, 1.15, 0.05), 0, 1.15, 0),
        offsetShape(new CANNON.Vec3(0.7, 0.12, 0.7), 0, 2.1, 0),
      ],
    });
  }

  function addPicnic(tile, x, z, yaw) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    group.rotation.y = yaw;
    put(group, box, woodSeat, 0, 0.72, 0, 1.35, 0.08, 0.72);
    put(group, box, woodDark, -0.42, 0.36, 0, 0.08, 0.7, 0.08);
    put(group, box, woodDark, 0.42, 0.36, 0, 0.08, 0.7, 0.08);
    put(group, box, woodSeat, 0, 0.46, 0.62, 1.35, 0.07, 0.28);
    put(group, box, woodSeat, 0, 0.46, -0.62, 1.35, 0.07, 0.28);
    knock(tile, group, {
      id: tag(tile, 'picnic', x, z),
      kind: 'picnic',
      lx: x,
      lz: z,
      h: 0.85,
      radius: 1.05,
      reachH: 1.2,
      mass: 11,
      kick: 2.8,
      up: 1.4,
      spin: 2.2,
      yell: 'PICNIC!',
      score: 12,
      pad: 1,
      shapes: [
        offsetShape(new CANNON.Vec3(0.68, 0.05, 0.36), 0, 0.72, 0),
        offsetShape(new CANNON.Vec3(0.68, 0.04, 0.16), 0, 0.46, 0.62),
        offsetShape(new CANNON.Vec3(0.68, 0.04, 0.16), 0, 0.46, -0.62),
      ],
    });
  }

  function addFountain(tile, x, z, id) {
    const group = new THREE.Group();
    group.name = id;
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, stoneMat, 0, 0.22, 0, 1.55, 0.44, 1.55);
    put(group, roundGeo, waterMat, 0, 0.42, 0, 1.22, 0.08, 1.22);
    put(group, roundGeo, stoneMat, 0, 0.95, 0, 0.2, 1.05, 0.2);
    put(group, roundGeo, stoneMat, 0, 1.52, 0, 0.62, 0.16, 0.62);
    put(group, roundGeo, waterMat, 0, 1.6, 0, 0.4, 0.06, 0.4);
    put(group, roundGeo, waterMat, 0, 1.82, 0, 0.06, 0.34, 0.06);
    tile.group.add(group);
    addStatic(tile, 2.9, 1.75, 2.9, x, GROUND_Y + 0.88, z);
  }

  function addHydrant(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, hydrantMat, 0, 0.38, 0, 0.16, 0.72, 0.16);
    put(group, roundGeo, hydrantMat, 0, 0.78, 0, 0.22, 0.2, 0.22);
    const capL = put(group, roundGeo, metalMat, -0.22, 0.5, 0, 0.07, 0.22, 0.07);
    capL.rotation.z = Math.PI / 2;
    const capR = put(group, roundGeo, metalMat, 0.22, 0.5, 0, 0.07, 0.22, 0.07);
    capR.rotation.z = Math.PI / 2;
    put(group, roundGeo, metalMat, 0, 0.92, 0, 0.09, 0.08, 0.09);
    knock(tile, group, {
      id: tag(tile, 'hydrant', x, z),
      kind: 'hydrant',
      lx: x,
      lz: z,
      h: 1,
      radius: 0.4,
      reachH: 1.2,
      mass: 10,
      kick: 2.2,
      up: 1.2,
      spin: 2.4,
      yell: 'HYDRANT!',
      score: 10,
      pad: 0.5,
      shapes: [offsetShape(new CANNON.Vec3(0.2, 0.48, 0.2), 0, 0.48, 0)],
    });
  }

  function addTrash(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, poleMat, 0, 0.48, 0, 0.22, 0.9, 0.22);
    put(group, roundGeo, holeMat, 0, 0.9, 0, 0.16, 0.06, 0.16);
    knock(tile, group, {
      id: tag(tile, 'bin', x, z),
      kind: 'bin',
      lx: x,
      lz: z,
      h: 1,
      radius: 0.35,
      reachH: 1.2,
      mass: 4,
      kick: 4,
      up: 2,
      spin: 5,
      yell: 'CLANG!',
      score: 6,
      pad: 0.45,
      shapes: [offsetShape(new CANNON.Vec3(0.22, 0.45, 0.22), 0, 0.48, 0)],
    });
  }

  function addPlanter(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, woodDark, 0, 0.28, 0, 0.7, 0.5, 0.7);
    put(group, box, sandMat, 0, 0.52, 0, 0.52, 0.08, 0.52);
    const bush = new THREE.Mesh(crownGeo, leafMat);
    bush.scale.setScalar(0.42);
    bush.position.y = 0.85;
    bush.castShadow = true;
    group.add(bush);
    knock(tile, group, {
      id: tag(tile, 'planter', x, z),
      kind: 'planter',
      lx: x,
      lz: z,
      h: 1.2,
      radius: 0.5,
      reachH: 1.5,
      mass: 8,
      kick: 2.6,
      up: 1.3,
      spin: 2.2,
      yell: 'POTTED!',
      score: 7,
      pad: 0.6,
      shapes: [
        offsetShape(new CANNON.Vec3(0.35, 0.26, 0.35), 0, 0.28, 0),
        offsetShape(new CANNON.Vec3(0.32, 0.28, 0.32), 0, 0.85, 0),
      ],
    });
  }

  function addFlowers(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, woodDark, 0, 0.14, 0, 1.15, 0.26, 0.48);
    for (let i = 0; i < 4; i++) {
      const bloom = new THREE.Mesh(crownGeo, flowerMats[(i + tile.gx + tile.gz) % flowerMats.length]);
      bloom.scale.setScalar(0.16);
      bloom.position.set(-0.36 + i * 0.24, 0.36, (i % 2) * 0.08 - 0.04);
      bloom.castShadow = true;
      group.add(bloom);
    }
    knock(tile, group, {
      id: tag(tile, 'flowers', x, z),
      kind: 'flowers',
      lx: x,
      lz: z,
      h: 0.5,
      radius: 0.7,
      reachH: 0.8,
      mass: 2,
      kick: 4,
      up: 2,
      spin: 4,
      yell: 'BLOOM!',
      score: 5,
      pad: 0.5,
      shapes: [offsetShape(new CANNON.Vec3(0.58, 0.16, 0.26), 0, 0.2, 0)],
    });
  }

  function addShelter(tile, x, z, yaw) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    group.rotation.y = yaw;
    put(group, box, metalMat, -0.85, 1.15, -0.35, 0.07, 2.3, 0.07);
    put(group, box, metalMat, 0.85, 1.15, -0.35, 0.07, 2.3, 0.07);
    put(group, box, windowMat, 0, 1.15, -0.35, 1.55, 1.15, 0.05);
    put(group, box, yellow, 0, 2.32, -0.02, 2.05, 0.08, 1.15);
    put(group, box, woodSeat, 0, 0.46, 0.15, 1.3, 0.07, 0.36);
    knock(tile, group, {
      id: tag(tile, 'shelter', x, z),
      kind: 'shelter',
      lx: x,
      lz: z,
      h: 2.4,
      radius: 1.2,
      reachH: 2.7,
      mass: 16,
      kick: 2.4,
      up: 1.2,
      spin: 1.6,
      yell: 'SHELTER!',
      score: 14,
      pad: 1.1,
      shapes: [
        offsetShape(new CANNON.Vec3(1.02, 0.05, 0.58), 0, 2.32, -0.02),
        offsetShape(new CANNON.Vec3(0.08, 1.15, 0.08), -0.85, 1.15, -0.35),
        offsetShape(new CANNON.Vec3(0.08, 1.15, 0.08), 0.85, 1.15, -0.35),
      ],
    });
  }

  function addSlide(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, yellow, 0, 0.85, -0.85, 0.95, 1.7, 0.9);
    put(group, box, metalMat, -0.4, 1.15, -0.85, 0.06, 0.7, 0.06);
    put(group, box, metalMat, 0.4, 1.15, -0.85, 0.06, 0.7, 0.06);
    const ramp = put(group, box, umbrellaMats[0], 0, 0.72, 0.4, 0.72, 0.08, 2.15);
    ramp.rotation.x = -0.45;
    put(group, box, metalMat, -0.34, 0.95, 0.35, 0.05, 0.12, 1.7);
    put(group, box, metalMat, 0.34, 0.95, 0.35, 0.05, 0.12, 1.7);
    put(group, box, metalMat, -0.28, 0.7, -1.4, 0.05, 1.4, 0.05);
    put(group, box, metalMat, 0.28, 0.7, -1.4, 0.05, 1.4, 0.05);
    for (let i = 0; i < 3; i++) {
      put(group, box, metalMat, 0, 0.35 + i * 0.4, -1.4, 0.5, 0.04, 0.04);
    }
    knock(tile, group, {
      id: tag(tile, 'slide', x, z),
      kind: 'slide',
      lx: x,
      lz: z,
      h: 1.8,
      radius: 1.55,
      reachH: 2.2,
      mass: 18,
      kick: 2.2,
      up: 1.3,
      spin: 1.5,
      yell: 'SLIDE!',
      score: 16,
      pad: 1.2,
      shapes: [
        offsetShape(new CANNON.Vec3(0.48, 0.85, 0.45), 0, 0.85, -0.85),
        offsetShape(new CANNON.Vec3(0.36, 0.15, 0.9), 0, 0.55, 0.45),
      ],
    });
  }

  function addSwings(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, metalMat, -1.15, 1.25, 0, 0.07, 2.5, 0.07);
    put(group, box, metalMat, 1.15, 1.25, 0, 0.07, 2.5, 0.07);
    put(group, box, metalMat, 0, 2.48, 0, 2.45, 0.07, 0.07);
    for (const sx of [-0.42, 0.42]) {
      put(group, box, metalMat, sx, 1.7, 0, 0.03, 1.45, 0.03);
      put(group, box, rubberAlt, sx, 0.92, 0, 0.32, 0.06, 0.18);
    }
    knock(tile, group, {
      id: tag(tile, 'swings', x, z),
      kind: 'swings',
      lx: x,
      lz: z,
      h: 2.6,
      radius: 1.35,
      reachH: 2.9,
      mass: 12,
      kick: 2.6,
      up: 1.6,
      spin: 2,
      yell: 'WHEEE!',
      score: 14,
      pad: 1.1,
      shapes: [
        offsetShape(new CANNON.Vec3(1.22, 0.05, 0.06), 0, 2.48, 0),
        offsetShape(new CANNON.Vec3(0.06, 1.25, 0.06), -1.15, 1.25, 0),
        offsetShape(new CANNON.Vec3(0.06, 1.25, 0.06), 1.15, 1.25, 0),
      ],
    });
  }

  function addSandbox(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, sandMat, 0, 0.1, 0, 2.2, 0.14, 1.6);
    put(group, box, woodDark, 0, 0.2, 0.82, 2.4, 0.16, 0.1);
    put(group, box, woodDark, 0, 0.2, -0.82, 2.4, 0.16, 0.1);
    put(group, box, woodDark, -1.15, 0.2, 0, 0.1, 0.16, 1.55);
    put(group, box, woodDark, 1.15, 0.2, 0, 0.1, 0.16, 1.55);
    knock(tile, group, {
      id: tag(tile, 'sand', x, z),
      kind: 'sandbox',
      lx: x,
      lz: z,
      h: 0.35,
      radius: 1.35,
      reachH: 0.7,
      mass: 6,
      kick: 2.4,
      up: 1.1,
      spin: 1.8,
      yell: 'SAND!',
      score: 8,
      pad: 1,
      shapes: [offsetShape(new CANNON.Vec3(1.2, 0.12, 0.9), 0, 0.16, 0)],
    });
  }

  function addSeesaw(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, yellow, 0, 0.22, 0, 0.28, 0.4, 0.28);
    const plank = put(group, box, umbrellaMats[2], 0, 0.48, 0, 0.28, 0.07, 2.15);
    plank.rotation.x = 0.14;
    knock(tile, group, {
      id: tag(tile, 'seesaw', x, z),
      kind: 'seesaw',
      lx: x,
      lz: z,
      h: 0.6,
      radius: 1.15,
      reachH: 0.9,
      mass: 6,
      kick: 3.4,
      up: 1.8,
      spin: 3,
      yell: 'SEESAW!',
      score: 10,
      pad: 0.9,
      shapes: [offsetShape(new CANNON.Vec3(0.16, 0.08, 1.05), 0, 0.45, 0)],
    });
  }

  function addFlag(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, metalMat, 0, 1.55, 0, 0.04, 3.1, 0.04);
    put(group, box, rubberAlt, 0.48, 2.75, 0, 0.9, 0.48, 0.04);
    put(group, roundGeo, yellow, 0, 3.12, 0, 0.09, 0.08, 0.09);
    knock(tile, group, {
      id: tag(tile, 'flag', x, z),
      kind: 'flag',
      lx: x,
      lz: z,
      h: 3.2,
      radius: 0.6,
      reachH: 3.4,
      mass: 4,
      kick: 3.2,
      up: 1.8,
      spin: 3,
      yell: 'FLAG!',
      score: 10,
      pad: 0.5,
      shapes: [
        offsetShape(new CANNON.Vec3(0.05, 1.55, 0.05), 0, 1.55, 0),
        offsetShape(new CANNON.Vec3(0.45, 0.24, 0.04), 0.48, 2.75, 0),
      ],
    });
  }

  function addHoop(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, metalMat, 0, 1.35, 0, 0.05, 2.7, 0.05);
    put(group, box, white, 0, 2.45, 0.06, 0.9, 0.58, 0.06);
    const rim = new THREE.Mesh(hoopGeo, hydrantMat);
    rim.position.set(0, 2.12, 0.28);
    rim.castShadow = true;
    group.add(rim);
    knock(tile, group, {
      id: tag(tile, 'hoop', x, z),
      kind: 'hoop',
      lx: x,
      lz: z,
      h: 2.8,
      radius: 0.7,
      reachH: 3.1,
      mass: 9,
      kick: 2.4,
      up: 1.4,
      spin: 2.2,
      yell: 'SWISH!',
      score: 12,
      pad: 0.6,
      shapes: [
        offsetShape(new CANNON.Vec3(0.06, 1.35, 0.06), 0, 1.35, 0),
        offsetShape(new CANNON.Vec3(0.45, 0.3, 0.05), 0, 2.4, 0.08),
      ],
    });
  }

  function addStatue(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, stoneMat, 0, 0.16, 0, 0.42, 0.32, 0.42);
    put(group, box, stoneMat, 0, 0.78, 0, 0.36, 0.72, 0.24);
    put(group, roundGeo, stoneMat, 0, 1.32, 0, 0.18, 0.2, 0.18);
    knock(tile, group, {
      id: tag(tile, 'statue', x, z),
      kind: 'statue',
      lx: x,
      lz: z,
      h: 1.5,
      radius: 0.55,
      reachH: 1.8,
      mass: 22,
      kick: 1.5,
      up: 0.8,
      spin: 1.2,
      yell: 'STATUE!',
      score: 16,
      pad: 0.6,
      shapes: [offsetShape(new CANNON.Vec3(0.28, 0.75, 0.24), 0, 0.75, 0)],
    });
  }

  function addMenu(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, woodDark, 0, 0.7, 0, 0.08, 1.4, 0.08);
    const board = new THREE.Mesh(plane, signTexture('MENU', '#f6f1e4', '#1c140c'));
    board.scale.set(0.72, 0.62, 1);
    board.position.set(0.05, 1.05, 0);
    board.rotation.y = Math.PI / 2;
    group.add(board);
    knock(tile, group, {
      id: tag(tile, 'menu', x, z),
      kind: 'menu',
      lx: x,
      lz: z,
      h: 1.4,
      radius: 0.45,
      reachH: 1.6,
      mass: 3,
      kick: 4,
      up: 2,
      spin: 4,
      yell: 'MENU!',
      score: 6,
      pad: 0.4,
      shapes: [offsetShape(new CANNON.Vec3(0.08, 0.7, 0.2), 0, 0.7, 0)],
    });
  }

  function yard(tile, mat, inset, lift) {
    const block = CELL - ROAD;
    const size = block - inset * 2;
    addPlane(tile, mat, size, size, ROAD + block / 2, ROAD + block / 2, GROUND_Y + lift);
  }

  function seatSet(tile, x, z, tint) {
    addTable(tile, x, z);
    addChair(tile, x - 0.72, z, -Math.PI / 2);
    addChair(tile, x + 0.72, z, Math.PI / 2);
    addUmbrella(tile, x, z, tint);
  }

  function dressWalk(tile, h) {
    const west = ROAD + 1.55;
    const east = CELL - 1.55;
    const south = ROAD + 1.55;
    const north = CELL - 1.55;
    addBench(tile, east, 14.2, Math.PI / 2);
    addBench(tile, east, 19.8, Math.PI / 2);
    addBench(tile, 21.2, south, 0);
    addHydrant(tile, west, 16.2);
    addTrash(tile, west, 12.4);
    addPlanter(tile, 12.8, north);
    if (h % 3 === 0) seatSet(tile, 16.4, north, h % umbrellaMats.length);
    if (h % 4 === 1) addShelter(tile, east, 16.9, Math.PI / 2);
  }

  function buildTower(tile, h) {
    const block = CELL - ROAD;
    const margin = 3.15;
    const bw = block - margin * 2;
    const bd = block - margin * 2;
    const bh = 4.6 + (h % 9) * 1.15;
    const lx = ROAD + block / 2;
    const lz = ROAD + block / 2;
    addStructure(tile, {
      x: lx,
      z: lz,
      w: bw,
      d: bd,
      bh,
      colorIndex: h % buildingMats.length,
      id: `bldg-${tile.gx}-${tile.gz}`,
      enter: h % 3 === 0,
      sign: h % 5 === 0 ? { text: 'HOTEL', bg: '#1c2430', fg: '#fff6d8', w: 1.7 } : null,
    });
    if (h % 5 === 0) {
      addAwning(
        tile,
        lx - bw / 2 - 0.6,
        GROUND_Y + 2.2,
        lz,
        1.2,
        Math.min(bd * 0.42, 5.2),
        yellow,
        `awning-${tile.gx}-${tile.gz}`,
      );
    }
    if ((h & 3) !== 0) addTree(tile, 18.2, ROAD + 1.55);
    dressWalk(tile, h);
  }

  function buildPark(tile) {
    const cx = 17;
    const cz = 17;
    yard(tile, grassMat, 1.65, 0.055);
    addPlane(tile, pathMat, 2.05, 12.6, cx, cz, GROUND_Y + 0.07);
    addPlane(tile, pathMat, 12.6, 2.05, cx, cz, GROUND_Y + 0.078);
    addFountain(tile, cx, cz, `park-${tile.gx}-${tile.gz}`);
    for (const [x, z] of [[11.3, 11.5], [22.6, 11.5], [11.3, 22.5], [22.6, 22.5]]) {
      addTree(tile, x, z);
    }
    addBench(tile, 14.4, 13.3, Math.PI);
    addBench(tile, 19.6, 20.7, 0);
    addBench(tile, 13.3, 19.4, Math.PI / 2);
    addBench(tile, 20.7, 14.5, -Math.PI / 2);
    addPicnic(tile, 15.5, 22.2, 0.4);
    addFlowers(tile, 12.6, 14.6);
    addFlowers(tile, 21.4, 13.4);
    addFlowers(tile, 13.8, 21.2);
    addBench(tile, 24.55, 15.2, Math.PI / 2);
    addHydrant(tile, 9.15, 18.4);
    hangSign(tile, 'PARK', '#2f9e44', '#f4ffe8', cx, GROUND_Y + 2.35, 9.2, Math.PI, 1.45, 0.58);
  }

  function buildPlay(tile) {
    yard(tile, rubberMat, 1.7, 0.055);
    addPlane(tile, rubberAlt, 6.4, 5.8, 13.3, 20.2, GROUND_Y + 0.066);
    addPlane(tile, sandMat, 3.6, 2.8, 21.4, 12.8, GROUND_Y + 0.066);
    addSlide(tile, 13.3, 19.8);
    addSwings(tile, 20.2, 20.4);
    addSandbox(tile, 21.4, 12.8);
    addSeesaw(tile, 14, 13.2);
    addBench(tile, 11.2, 16.5, Math.PI / 2);
    addBench(tile, 17.2, 23.5, Math.PI);
    addTrash(tile, 9.2, 20.4);
    hangSign(tile, 'PLAY', '#ff922b', '#1c140c', 17, GROUND_Y + 2.3, 9.25, Math.PI, 1.35, 0.58);
  }

  function buildSchool(tile) {
    addPlane(tile, grassMat, 14.4, 8.2, 17, 13.7, GROUND_Y + 0.055);
    addStructure(tile, {
      x: 17,
      z: 21.35,
      w: 11.2,
      d: 6.2,
      bh: 5.4,
      colorIndex: 3,
      brick: true,
      id: `school-${tile.gx}-${tile.gz}`,
      door: 'south',
      enter: true,
      sign: { text: 'SCHOOL', bg: '#c4493a', fg: '#fff4e4', w: 2.15, h: 0.6 },
    });
    addFlag(tile, 12.3, 15.4);
    addHoop(tile, 22.1, 13.2);
    addBench(tile, 13.4, 16.7, 0);
    addBench(tile, 20.2, 16.7, 0);
    for (let i = 0; i < 5; i++) {
      addPaint(tile, 0.52, 0.02, 0.52, 16.5 + (i % 2) * 0.62, GROUND_Y + 0.08, 11.1 + i * 0.72);
    }
    addTrash(tile, 24.4, 18.6);
  }

  function buildCafe(tile, h) {
    addStructure(tile, {
      x: 12.7,
      z: 17.2,
      w: 6.2,
      d: 10.2,
      bh: 4.4,
      colorIndex: (h + 2) % buildingMats.length,
      id: `cafe-${tile.gx}-${tile.gz}`,
      door: 'east',
      enter: true,
      sign: { text: 'EATS', bg: '#e23d3d', fg: '#fff8ea', w: 1.4 },
    });
    addAwning(tile, 16.55, GROUND_Y + 2.25, 17.2, 1.5, 6.2, umbrellaMats[0], `cafe-awn-${tile.gx}-${tile.gz}`);
    seatSet(tile, 18.7, 14.3, 0);
    seatSet(tile, 18.7, 17.6, 1);
    seatSet(tile, 18.7, 20.9, 2);
    seatSet(tile, 21.7, 16.4, 3);
    addPlanter(tile, 22.4, 12.6);
    addPlanter(tile, 22.6, 22.4);
    addMenu(tile, 23.5, 15.4);
    addBench(tile, 24.45, 19.6, Math.PI / 2);
  }

  function buildPlaza(tile) {
    yard(tile, plazaMat, 1.5, 0.055);
    addFountain(tile, 17, 17, `plaza-${tile.gx}-${tile.gz}`);
    addBench(tile, 17, 13.15, Math.PI);
    addBench(tile, 17, 20.85, 0);
    addBench(tile, 13.15, 17, Math.PI / 2);
    addBench(tile, 20.85, 17, -Math.PI / 2);
    addStatue(tile, 21.4, 13.6);
    seatSet(tile, 12.7, 12.9, 2);
    seatSet(tile, 21.6, 21.3, 1);
    addTree(tile, 11.4, 22.3);
    addTree(tile, 23.3, 11.3);
    addFlowers(tile, 14.4, 21.5);
    addFlowers(tile, 20.4, 12.6);
    addHydrant(tile, 9.2, 14.8);
  }

  function buildShops(tile, h) {
    const names = [
      { text: 'PIZZA', bg: '#e23d3d', fg: '#fff6ea' },
      { text: 'CAFE', bg: '#1f6feb', fg: '#f3f8ff' },
      { text: 'BOOKS', bg: '#2f9e44', fg: '#f3fff4' },
    ];
    const width = 4.15;
    const depth = 5.5;
    const gap = 0.4;
    let x = 12.45;
    const z = 14.35;
    for (let i = 0; i < 3; i++) {
      const bh = 3.55 + ((h >> (i * 2)) & 3) * 0.5;
      addStructure(tile, {
        x,
        z,
        w: width,
        d: depth,
        bh,
        colorIndex: (h + i * 3) % buildingMats.length,
        id: `shop-${tile.gx}-${tile.gz}-${i}`,
        door: 'south',
        enter: true,
        sign: names[i],
      });
      addAwning(
        tile,
        x,
        GROUND_Y + 2.15,
        z - depth / 2 - 0.64,
        width * 0.92,
        1.28,
        umbrellaMats[i % umbrellaMats.length],
        `shop-awn-${tile.gx}-${tile.gz}-${i}`,
      );
      x += width + gap;
    }
    addPlane(tile, plazaMat, 13.4, 7.2, 17.2, 21.5, GROUND_Y + 0.055);
    seatSet(tile, 13.3, 20.2, 0);
    seatSet(tile, 17.4, 21.7, 1);
    addTable(tile, 21.3, 19.5);
    addChair(tile, 21.3, 18.75, 0);
    addChair(tile, 22.05, 19.5, Math.PI / 2);
    addBench(tile, 21.5, 23.4, Math.PI);
    addPlanter(tile, 11.5, 23.2);
    addFlowers(tile, 15.4, 18.8);
    addTrash(tile, 9.2, 19.5);
  }

  function addCrate(tile, x, z, scale, mark, yell) {
    const s = scale || 1;
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, crateMat, 0, 0.32 * s, 0, 0.72 * s, 0.58 * s, 0.72 * s);
    put(group, box, woodDark, 0, 0.32 * s, 0, 0.08 * s, 0.6 * s, 0.76 * s);
    put(group, box, woodDark, 0, 0.32 * s, 0, 0.76 * s, 0.6 * s, 0.08 * s);
    knock(tile, group, {
      id: tag(tile, mark || 'crate', x, z),
      kind: 'crate',
      mark,
      lx: x,
      lz: z,
      h: 0.7 * s,
      radius: 0.55 * s,
      reachH: 1.1,
      mass: 5 * s,
      kick: 3.4,
      up: 1.8,
      spin: 3.2,
      yell: yell || 'CRATE!',
      score: 8,
      pad: 0.55,
      shapes: [offsetShape(new CANNON.Vec3(0.36 * s, 0.3 * s, 0.36 * s), 0, 0.32 * s, 0)],
    });
  }

  function addCart(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, crateMat, 0, 0.55, 0, 1.15, 0.55, 1.7);
    for (const [wx, wz] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) {
      const wheel = put(group, roundGeo, tire, wx, 0.22, wz, 0.22, 0.16, 0.22);
      wheel.rotation.z = Math.PI / 2;
    }
    put(group, crownGeo, flowerMats[0], -0.28, 1.05, 0.1, 0.28, 0.28, 0.28);
    put(group, crownGeo, flowerMats[1], 0.22, 1.12, -0.12, 0.32, 0.32, 0.32);
    put(group, crownGeo, flowerMats[3], 0.02, 0.98, 0.32, 0.24, 0.24, 0.24);
    knock(tile, group, {
      id: tag(tile, 'cart', x, z),
      kind: 'cart',
      mark: 'cart',
      lx: x,
      lz: z,
      h: 1.2,
      radius: 1.15,
      reachH: 1.7,
      mass: 8,
      kick: 3.2,
      up: 1.6,
      spin: 2.4,
      yell: 'CART!',
      score: 12,
      pad: 0.85,
      shapes: [offsetShape(new CANNON.Vec3(0.58, 0.4, 0.85), 0, 0.55, 0)],
    });
  }

  function addStall(tile, x, z, label, tint) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, crateMat, 0, 0.5, 0, 2.4, 1.0, 1.15);
    put(group, box, woodDark, 0, 1.02, 0, 2.55, 0.08, 1.28);
    const board = new THREE.Mesh(plane, signTexture(label, '#fff6ea', '#1c140c'));
    board.scale.set(1.35, 0.42, 1);
    board.position.set(0, 1.38, -0.66);
    group.add(board);
    tile.group.add(group);
    addStatic(tile, 2.4, 1.05, 1.2, x, GROUND_Y + 0.52, z);
    addAwning(
      tile,
      x,
      GROUND_Y + 2.15,
      z - 0.95,
      2.55,
      1.15,
      umbrellaMats[tint % umbrellaMats.length],
      tag(tile, 'stall', x, z),
    );
  }

  function addMeter(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, poleGeo, poleMat, 0, 0.55, 0, 0.4, 0.5, 0.4);
    put(group, box, signMat, 0, 1.15, 0, 0.28, 0.42, 0.16);
    put(group, box, holeMat, 0, 1.18, 0.09, 0.16, 0.18, 0.02);
    knock(tile, group, {
      id: tag(tile, 'meter', x, z),
      kind: 'meter',
      mark: 'meter',
      lx: x,
      lz: z,
      h: 1.35,
      radius: 0.4,
      reachH: 1.6,
      mass: 4,
      kick: 3.6,
      up: 1.5,
      spin: 3.4,
      yell: 'TICKET!',
      score: 8,
      pad: 0.45,
      shapes: [offsetShape(new CANNON.Vec3(0.14, 0.62, 0.1), 0, 0.62, 0)],
    });
  }

  function addBollard(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, roundGeo, metalMat, 0, 0.42, 0, 0.14, 0.8, 0.14);
    put(group, roundGeo, hydrantMat, 0, 0.86, 0, 0.18, 0.1, 0.18);
    knock(tile, group, {
      id: tag(tile, 'bollard', x, z),
      kind: 'bollard',
      lx: x,
      lz: z,
      h: 1,
      radius: 0.35,
      reachH: 1.2,
      mass: 7,
      kick: 2.4,
      up: 1.1,
      spin: 2,
      yell: 'BOLLARD!',
      score: 6,
      pad: 0.4,
      shapes: [offsetShape(new CANNON.Vec3(0.16, 0.42, 0.16), 0, 0.42, 0)],
    });
  }

  function addBuoy(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, crownGeo, buoyMat, 0, 0.55, 0, 0.42, 0.62, 0.42);
    put(group, box, white, 0, 0.55, 0, 0.48, 0.12, 0.48);
    knock(tile, group, {
      id: tag(tile, 'buoy', x, z),
      kind: 'buoy',
      lx: x,
      lz: z,
      h: 1.1,
      radius: 0.5,
      reachH: 1.4,
      mass: 3,
      kick: 5,
      up: 2.4,
      spin: 4,
      yell: 'BUOY!',
      score: 8,
      pad: 0.5,
      shapes: [offsetShape(new CANNON.Vec3(0.32, 0.32, 0.32), 0, 0.55, 0)],
    });
  }

  function addBoat(tile, x, z, yaw) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    group.rotation.y = yaw;
    put(group, box, boatHull, 0, 0.38, 0, 1.35, 0.48, 3.1);
    put(group, box, dockLine, 0, 0.68, -0.15, 1.05, 0.22, 1.35);
    put(group, poleGeo, woodDark, 0.15, 1.35, 0.55, 0.45, 1.05, 0.45);
    knock(tile, group, {
      id: tag(tile, 'boat', x, z),
      kind: 'boat',
      lx: x,
      lz: z,
      h: 1.4,
      radius: 1.9,
      reachH: 2.2,
      mass: 16,
      kick: 2.2,
      up: 1.1,
      spin: 1.4,
      yell: 'BOAT!',
      score: 18,
      pad: 1.1,
      shapes: [offsetShape(new CANNON.Vec3(0.68, 0.32, 1.55), 0, 0.4, 0)],
    });
  }

  function addBalloon(tile, x, z, material) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, nightPost, 0, 1.05, 0, 0.035, 2.1, 0.035);
    put(group, crownGeo, material, 0, 2.25, 0, 0.48, 0.62, 0.48);
    knock(tile, group, {
      id: tag(tile, 'balloon', x, z),
      kind: 'balloon',
      mark: 'balloon',
      lx: x,
      lz: z,
      h: 2.5,
      radius: 0.55,
      reachH: 2.9,
      mass: 0.7,
      kick: 6,
      up: 4.2,
      spin: 5,
      yell: 'POP!',
      score: 8,
      pad: 0.45,
      shapes: [offsetShape(new CANNON.Vec3(0.28, 0.36, 0.28), 0, 2.25, 0)],
    });
  }

  function addBulb(tile, x, y, z, material) {
    const mesh = new THREE.Mesh(signalLensGeo, material);
    mesh.position.set(x, y, z);
    tile.group.add(mesh);
  }

  function addStringLights(tile, y) {
    const z0 = ROAD + 2.4;
    const z1 = CELL - 1.7;
    const x0 = ROAD + 2.4;
    const x1 = CELL - 1.7;
    const bulbs = [neonPink, neonCyan, neonYellow];
    let i = 0;
    for (let x = x0; x <= x1; x += 1.65) {
      addBulb(tile, x, y, z0, bulbs[i % 3]);
      i += 1;
      addBulb(tile, x, y, z1, bulbs[i % 3]);
      i += 1;
    }
    for (let z = z0 + 1.65; z < z1; z += 1.65) {
      addBulb(tile, x0, y, z, bulbs[i % 3]);
      i += 1;
      addBulb(tile, x1, y, z, bulbs[i % 3]);
      i += 1;
    }
  }

  function addTent(tile, x, z, material) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, nightCloth, 0, 0.7, 0, 2.5, 1.25, 2.5);
    put(group, coneGeo, material, 0, 1.85, 0, 1.7, 1.5, 1.7);
    tile.group.add(group);
    addStatic(tile, 2.4, 2.2, 2.4, x, GROUND_Y + 1.1, z);
  }

  function addWheel(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    const ring = new THREE.Mesh(ferrisGeo, neonPink);
    ring.position.y = 3.15;
    group.add(ring);
    put(group, box, nightPost, -1.2, 1.55, 0, 0.16, 3.1, 0.16);
    put(group, box, nightPost, 1.2, 1.55, 0, 0.16, 3.1, 0.16);
    const gondolas = [neonYellow, neonCyan, neonPink];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      put(group, box, gondolas[i % 3], Math.cos(angle) * 2.55, 3.15 + Math.sin(angle) * 2.55, 0, 0.42, 0.3, 0.32);
    }
    tile.group.add(group);
    addStatic(tile, 0.35, 3.2, 0.4, x - 1.2, GROUND_Y + 1.6, z);
    addStatic(tile, 0.35, 3.2, 0.4, x + 1.2, GROUND_Y + 1.6, z);
  }

  function addBooth(tile, x, z) {
    const group = new THREE.Group();
    group.position.set(x, GROUND_Y, z);
    put(group, box, nightCloth, 0, 0.7, 0, 3.2, 1.4, 1.35);
    put(group, box, neonPink, 0, 1.5, 0, 3.4, 0.14, 1.55);
    const board = new THREE.Mesh(plane, signTexture('PRIZES', '#ff3d8a', '#fff6fb'));
    board.scale.set(1.6, 0.48, 1);
    board.position.set(0, 1.92, -0.78);
    group.add(board);
    tile.group.add(group);
    addStatic(tile, 3.2, 1.7, 1.4, x, GROUND_Y + 0.85, z);
  }

  function districtSign(tile, text, bg, fg) {
    hangSign(tile, text, bg, fg, 17, GROUND_Y + 4.35, ROAD + 1.75, Math.PI, 2.7, 0.7);
  }

  function buildMain(tile, h) {
    const pick = h % 4;
    if (pick === 0) buildTower(tile, h);
    else if (pick === 1) buildShops(tile, h);
    else if (pick === 2) buildCafe(tile, h);
    else buildSchool(tile);
    for (const x of [11.4, 14.2, 20.2, 23.2]) addMeter(tile, x, ROAD + 1.35);
    districtSign(tile, 'MAIN ST', '#1c2430', '#ffe14a');
  }

  function buildMarket(tile) {
    yard(tile, plazaMat, 1.15, 0.05);
    const names = ['FRUIT', 'FISH', 'BREAD'];
    names.forEach((label, i) => addStall(tile, 12.2 + i * 4.3, 14.4, label, i));
    addCart(tile, 13.4, 20.2);
    addCart(tile, 19.6, 21.2);
    addCrate(tile, 22.8, 16.4, 1, 'cart', 'CRATE!');
    addCrate(tile, 23.5, 17.3, 0.8, 'cart', 'CRATE!');
    addCrate(tile, 12.6, 17.8, 1.05, 'cart', 'CRATE!');
    districtSign(tile, 'MARKET', '#d86b2a', '#fff6ea');
  }

  function buildHarbor(tile) {
    yard(tile, dockMat, 1.1, 0.05);
    for (let i = 0; i < 5; i++) {
      addPlane(tile, dockLine, 14.5, 0.1, 17.2, 12.2 + i * 2.5, GROUND_Y + 0.07);
    }
    addCrate(tile, 20.4, 14.2, 1);
    addCrate(tile, 21.2, 15.1, 0.8);
    addCrate(tile, 20.6, 16, 0.7);
    addCrate(tile, 14.2, 18.6, 1.1);
    addBollard(tile, 12.2, 12.4);
    addBollard(tile, 22.6, 20.4);
    if (tile.gz === CITY - 1) {
      addBoat(tile, 16.2, 21.5, 0.12);
      addBuoy(tile, 11.2, 22.5);
    } else if (tile.gx === 0) {
      addBoat(tile, 12.4, 18.2, Math.PI / 2);
      addBuoy(tile, 10.6, 13.4);
    } else {
      addStructure(tile, {
        x: 15.2,
        z: 15.6,
        w: 6.2,
        d: 4.8,
        bh: 3.5,
        colorIndex: 6,
        id: `wharf-${tile.gx}-${tile.gz}`,
        door: 'south',
        enter: true,
        sign: { text: 'FISH', bg: '#145a78', fg: '#e7fbff', w: 1.35 },
      });
    }
    districtSign(tile, 'HARBOR', '#145a78', '#e7fbff');
  }

  function buildCarnival(tile, h) {
    yard(tile, nightMat, 0.7, 0.06);
    addStringLights(tile, GROUND_Y + 3.35);
    const glow = new THREE.PointLight(0xff4ad4, 2.2, 18, 2);
    glow.position.set(17, GROUND_Y + 4.4, 16);
    tile.group.add(glow);
    const pick = h % 3;
    if (pick === 0) addWheel(tile, 16.6, 17);
    else if (pick === 1) {
      addTent(tile, 14.2, 16.6, neonPink);
      addTent(tile, 20.6, 18.4, neonCyan);
    } else {
      addTent(tile, 14.6, 18.2, neonYellow);
      addBooth(tile, 20.4, 14.8);
    }
    addBalloon(tile, 11.2, 12.2, neonPink);
    addBalloon(tile, 23.2, 12.4, neonYellow);
    addBalloon(tile, 22.2, 22.4, neonCyan);
    districtSign(tile, 'CARNIVAL', '#2a1048', '#ff8ad4');
  }

  function buildLot(tile, h) {
    const district = districtId(tile.gx, tile.gz);
    if (district === 'market') buildMarket(tile);
    else if (district === 'harbor') buildHarbor(tile);
    else if (district === 'carnival') buildCarnival(tile, h);
    else buildMain(tile, h);
  }

  function yawOf(car) {
    if (car.rogue || car.loop || car.turning) return car.yaw;
    const forward = car.dir > 0;
    if (car.axis === 'z') return forward ? 0 : Math.PI;
    return forward ? Math.PI / 2 : -Math.PI / 2;
  }

  function aim(car) {
    car.body.quaternion.setFromAxisAngle(AXIS_Y, yawOf(car));
  }

  function syncCar(car) {
    const off = laneOffset(car.axis, car.slot);
    const x = car.axis === 'z' ? shiftX + car.gx * CELL + off : car.travel;
    const z = car.axis === 'x' ? shiftZ + car.gz * CELL + off : car.travel;
    car.body.position.set(x, car.ride, z);
    car.body.previousPosition.copy(car.body.position);
    car.body.aabbNeedsUpdate = true;
    aim(car);
  }

  function rounded(w, h, d, radius) {
    const r = Math.max(0.012, Math.min(radius, w * 0.48, h * 0.48, d * 0.48));
    const key = [w, h, d, r].map((n) => n.toFixed(3)).join('x');
    let geo = shapes.get(key);
    if (!geo) {
      geo = new RoundedBoxGeometry(w, h, d, 1, r);
      shapes.set(key, geo);
    }
    return geo;
  }

  function buildCar(kind, colorOverride) {
    const color = colorOverride == null ? kind.colors[(Math.random() * kind.colors.length) | 0] : colorOverride;
    const paint = kind.id === 'cyber' && color !== 0x1a1c20 ? stainless : paintOf(color);
    const group = new THREE.Group();
    const W = kind.w;
    const H = kind.h;
    const D = kind.d;
    const wr = Math.min(kind.wheel ?? 0.46, H * 0.38);
    const axleZ = D * (kind.axle ?? (kind.bus ? 0.36 : 0.33));

    function add(w, h, d, material, x, y, z, opt = {}) {
      const mesh = new THREE.Mesh(opt.sharp ? box : rounded(w, h, d, opt.radius ?? Math.min(w, h, d) * 0.18), material);
      if (opt.sharp) mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      if (opt.rx) mesh.rotation.x = opt.rx;
      mesh.castShadow = !!opt.shadow;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    }

    function lamps(bodyW, top, y) {
      add(bodyW * 1.04, H * 0.12, 0.16, trim, 0, y - H * 0.08, D * 0.46, { radius: 0.04 });
      add(bodyW * 1.04, H * 0.11, 0.14, trim, 0, y - H * 0.08, -D * 0.46, { radius: 0.04 });
      add(bodyW * 0.32, 0.05, 0.16, trim, 0, top + 0.02, D * 0.38, { radius: 0.02 });
      for (const sx of [-1, 1]) {
        add(bodyW * 0.26, 0.08, 0.26, lampMat, sx * bodyW * 0.3, top + 0.035, D * 0.34, { radius: 0.03 });
        add(bodyW * 0.28, 0.07, 0.2, tailMat, sx * bodyW * 0.3, top + 0.03, -D * 0.36, { radius: 0.025 });
      }
      add(0.32, 0.1, 0.03, plateMat, 0, y - H * 0.02, -D * 0.5, { sharp: true });
    }

    function mirrors(x, y, z) {
      for (const sx of [-1, 1]) {
        add(0.16, 0.07, 0.22, chrome, sx * x, y, z, { radius: 0.03 });
      }
    }

    const bodyW = W * (kind.bus ? 0.9 : 0.8);

    if (kind.bus) {
      const bodyH = H * 0.88;
      const bodyY = -H * 0.05;
      const top = bodyY + bodyH / 2;
      add(bodyW, bodyH, D * 0.94, paint, 0, bodyY, 0, { radius: 0.16, shadow: true });
      add(bodyW * 0.96, H * 0.16, D * 0.9, trim, 0, -H * 0.32, 0, { radius: 0.05 });
      for (const sx of [-1, 1]) {
        add(bodyW * 0.16, H * 0.24, D * 0.62, carGlass, sx * bodyW * 0.4, H * 0.1, -D * 0.04, { radius: 0.04 });
      }
      for (let i = -3; i <= 3; i++) {
        add(0.06, H * 0.26, 0.08, paint, bodyW * 0.46, H * 0.1, i * D * 0.08, { sharp: true });
        add(0.06, H * 0.26, 0.08, paint, -bodyW * 0.46, H * 0.1, i * D * 0.08, { sharp: true });
      }
      add(bodyW * 0.82, H * 0.22, D * 0.1, carGlass, 0, top - H * 0.08, D * 0.4, { radius: 0.04, rx: 0.35 });
      add(bodyW * 0.55, 0.08, 0.16, lampMat, 0, top - 0.02, D * 0.42, { radius: 0.03 });
      add(0.08, H * 0.36, D * 0.1, carGlass, bodyW * 0.42, -H * 0.06, D * 0.28, { radius: 0.03 });
      add(0.04, 0.06, D * 0.7, white, bodyW * 0.46, -H * 0.14, -D * 0.04, { sharp: true });
      add(0.04, 0.06, D * 0.7, white, -bodyW * 0.46, -H * 0.14, -D * 0.04, { sharp: true });
      lamps(bodyW, -H * 0.12, -H * 0.22);
    } else if (kind.id === 'truck') {
      const hoodH = H * 0.38;
      const hoodY = -H * 0.22;
      const hoodTop = hoodY + hoodH / 2;
      add(bodyW, hoodH, D * 0.28, paint, 0, hoodY, D * 0.32, { radius: 0.1, shadow: true });
      const cabH = H * 0.62;
      const cabY = -H * 0.04;
      const cabZ = D * 0.05;
      add(bodyW * 0.98, cabH, D * 0.24, paint, 0, cabY, cabZ, { radius: 0.1, shadow: true });
      add(bodyW * 0.82, cabH * 0.42, D * 0.14, carGlass, 0, cabY + cabH * 0.16, cabZ + D * 0.04, { radius: 0.05, rx: 0.28 });
      add(bodyW * 0.7, 0.06, D * 0.1, paint, 0, cabY + cabH / 2 - 0.02, cabZ - D * 0.01, { radius: 0.03 });
      mirrors(bodyW * 0.62, cabY, D * 0.14);
      const bedY = -H * 0.28;
      const bedZ = -D * 0.27;
      add(bodyW * 0.96, H * 0.14, D * 0.4, trim, 0, bedY, bedZ, { radius: 0.04, shadow: true });
      add(0.1, H * 0.26, D * 0.4, paint, -bodyW * 0.46, bedY + H * 0.16, bedZ, { radius: 0.04 });
      add(0.1, H * 0.26, D * 0.4, paint, bodyW * 0.46, bedY + H * 0.16, bedZ, { radius: 0.04 });
      add(bodyW * 0.96, H * 0.26, 0.1, paint, 0, bedY + H * 0.16, bedZ - D * 0.19, { radius: 0.04 });
      lamps(bodyW, hoodTop, hoodY);
    } else if (kind.id === 'cyber') {
      const slabH = H * 0.4;
      const slabY = -H * 0.18;
      add(bodyW, slabH, D * 0.94, paint, 0, slabY, 0, { sharp: true, shadow: true });
      add(bodyW * 0.9, H * 0.14, D * 0.32, paint, 0, -H * 0.3, D * 0.3, { sharp: true, rx: -0.28, shadow: true });
      add(bodyW * 0.86, H * 0.32, D * 0.4, carGlass, 0, H * 0.02, -D * 0.04, { sharp: true, rx: 0.22 });
      add(bodyW * 0.9, 0.05, D * 0.34, paint, 0, H * 0.2, -D * 0.1, { sharp: true, rx: 0.42 });
      add(bodyW * 0.72, 0.055, 0.07, lampMat, 0, -H * 0.1, D * 0.48, { sharp: true });
      add(bodyW * 0.5, 0.045, 0.05, tailMat, 0, -H * 0.02, -D * 0.48, { sharp: true });
      add(bodyW * 0.55, 0.04, D * 0.22, trim, 0, slabY + slabH * 0.42, -D * 0.28, { sharp: true });
      for (const sx of [-1, 1]) {
        add(0.08, H * 0.16, D * 0.16, trim, sx * bodyW * 0.5, -H * 0.22, D * 0.3, { sharp: true });
        add(0.08, H * 0.16, D * 0.16, trim, sx * bodyW * 0.5, -H * 0.22, -D * 0.3, { sharp: true });
      }
      mirrors(bodyW * 0.56, H * 0.02, D * 0.16);
    } else if (kind.id === 'wagon') {
      const bodyH = H * 0.8;
      const bodyY = -H * 0.02;
      add(bodyW, bodyH, D * 0.92, paint, 0, bodyY, 0, { sharp: true, shadow: true });
      add(bodyW * 0.9, H * 0.26, D * 0.52, carGlass, 0, bodyY + bodyH * 0.3, D * 0.02, { sharp: true });
      add(bodyW * 0.96, 0.05, D * 0.72, trim, 0, bodyY + bodyH * 0.5, -D * 0.02, { sharp: true });
      add(bodyW * 0.5, H * 0.32, 0.07, chrome, 0, -H * 0.02, D * 0.47, { sharp: true });
      for (let i = -2; i <= 2; i++) {
        add(bodyW * 0.42, 0.028, 0.04, trim, 0, -H * 0.02 + i * 0.075, D * 0.5, { sharp: true });
      }
      for (const sx of [-1, 1]) {
        add(0.2, 0.14, 0.06, lampMat, sx * bodyW * 0.36, H * 0.04, D * 0.47, { sharp: true });
        add(0.16, 0.1, 0.05, tailMat, sx * bodyW * 0.34, H * 0.02, -D * 0.47, { sharp: true });
        add(0.12, H * 0.2, D * 0.2, trim, sx * bodyW * 0.5, -H * 0.24, D * 0.28, { sharp: true });
        add(0.12, H * 0.2, D * 0.2, trim, sx * bodyW * 0.5, -H * 0.24, -D * 0.28, { sharp: true });
        add(0.08, 0.05, D * 0.55, chrome, sx * bodyW * 0.52, -H * 0.34, 0, { sharp: true });
      }
      const spare = new THREE.Mesh(wheelGeo, tire);
      spare.rotation.x = Math.PI / 2;
      spare.scale.setScalar(0.9);
      spare.position.set(0, -H * 0.02, -D * 0.5);
      spare.castShadow = true;
      group.add(spare);
      mirrors(bodyW * 0.58, H * 0.12, D * 0.22);
    } else if (kind.id === 'diesel') {
      add(bodyW * 0.72, 0.16, D * 0.92, trim, 0, -H * 0.4, 0, { sharp: true });
      add(bodyW * 0.78, H * 0.26, D * 0.34, paint, 0, -H * 0.16, D * 0.26, { sharp: true, shadow: true });
      add(bodyW * 0.58, H * 0.38, 0.08, chrome, 0, -H * 0.06, D * 0.44, { sharp: true });
      for (let i = -3; i <= 3; i++) {
        add(bodyW * 0.46, 0.03, 0.045, trim, 0, -H * 0.06 + i * 0.065, D * 0.48, { sharp: true });
      }
      add(bodyW * 0.92, H * 0.1, 0.18, chrome, 0, -H * 0.32, D * 0.44, { sharp: true });
      add(bodyW * 0.96, H * 0.42, D * 0.26, paint, 0, H * 0.02, -D * 0.02, { sharp: true, shadow: true });
      add(bodyW * 0.72, H * 0.2, 0.06, carGlass, 0, H * 0.08, D * 0.12, { sharp: true });
      add(bodyW * 0.96, H * 0.36, D * 0.2, paint, 0, -H * 0.02, -D * 0.24, { sharp: true, shadow: true });
      for (const sx of [-1, 1]) {
        add(0.1, H * 0.48, 0.1, chrome, sx * bodyW * 0.38, H * 0.12, -D * 0.14, { radius: 0.04 });
        add(0.22, 0.2, D * 0.26, chrome, sx * bodyW * 0.46, -H * 0.28, -D * 0.02, { radius: 0.08 });
        add(0.18, 0.1, 0.08, lampMat, sx * bodyW * 0.22, -H * 0.02, D * 0.48, { sharp: true });
        add(0.16, 0.08, 0.06, tailMat, sx * bodyW * 0.28, -H * 0.08, -D * 0.36, { sharp: true });
      }
      mirrors(bodyW * 0.62, H * 0.08, D * 0.1);
    } else if (kind.id === 'van') {
      const bodyH = H * 0.78;
      const bodyY = -H * 0.08;
      const top = bodyY + bodyH / 2;
      add(bodyW, bodyH, D * 0.72, paint, 0, bodyY, -D * 0.08, { radius: 0.12, shadow: true });
      add(bodyW * 0.96, H * 0.36, D * 0.22, paint, 0, -H * 0.2, D * 0.34, { radius: 0.08, shadow: true });
      add(bodyW * 0.78, H * 0.32, D * 0.18, carGlass, 0, H * 0.02, D * 0.28, { radius: 0.05, rx: 0.42 });
      for (const sx of [-1, 1]) {
        add(bodyW * 0.12, H * 0.18, D * 0.4, carGlass, sx * bodyW * 0.44, H * 0.1, -D * 0.1, { radius: 0.03 });
      }
      add(bodyW * 0.7, H * 0.16, 0.06, carGlass, 0, H * 0.06, -D * 0.44, { radius: 0.03 });
      mirrors(bodyW * 0.58, 0, D * 0.3);
      add(0.04, 0.06, D * 0.5, white, bodyW * 0.48, -H * 0.06, -D * 0.06, { sharp: true });
      add(0.04, 0.06, D * 0.5, white, -bodyW * 0.48, -H * 0.06, -D * 0.06, { sharp: true });
      lamps(bodyW, top * 0.15, -H * 0.22);
    } else {
      const sport = kind.id === 'sport';
      const bodyH = H * (sport ? 0.36 : 0.42);
      const bodyY = -H * 0.2;
      const bodyTop = bodyY + bodyH / 2;
      add(bodyW, bodyH, D * 0.9, paint, 0, bodyY, 0, { radius: 0.11, shadow: true });
      const cabH = H * (sport ? 0.3 : 0.36);
      const cabD = D * (sport ? 0.34 : 0.4);
      const cabZ = sport ? -D * 0.1 : -D * 0.04;
      const cabY = bodyTop + cabH / 2 - 0.05;
      const cabW = bodyW * 0.92;
      add(cabW, cabH, cabD, carGlass, 0, cabY, cabZ, { radius: 0.08, shadow: true });
      add(cabW * 0.82, 0.07, cabD * 0.46, paint, 0, cabY + cabH / 2 - 0.02, cabZ - cabD * 0.04, { radius: 0.03 });
      mirrors(bodyW * 0.58, cabY - cabH * 0.15, cabZ + cabD * 0.42);
      lamps(bodyW, bodyTop, bodyY);
      if (sport) {
        add(0.05, H * 0.14, 0.08, paint, -bodyW * 0.32, bodyTop + H * 0.1, -D * 0.36, { sharp: true });
        add(0.05, H * 0.14, 0.08, paint, bodyW * 0.32, bodyTop + H * 0.1, -D * 0.36, { sharp: true });
        add(bodyW * 0.9, 0.045, 0.26, paint, 0, bodyTop + H * 0.17, -D * 0.36, { radius: 0.02 });
      }
      if (kind.taxi) {
        add(0.62, 0.14, 0.28, yellow, 0, cabY + cabH / 2 + 0.1, cabZ, { radius: 0.04, shadow: true });
      }
      if (kind.police) {
        const barY = cabY + cabH / 2 + 0.06;
        add(0.7, 0.06, 0.26, trim, 0, barY, cabZ, { radius: 0.03 });
        const red = add(0.26, 0.11, 0.2, sirenRed, -0.18, barY + 0.07, cabZ, { radius: 0.04 });
        red.userData.siren = 'red';
        const blue = add(0.26, 0.11, 0.2, sirenBlue, 0.18, barY + 0.07, cabZ, { radius: 0.04 });
        blue.userData.siren = 'blue';
      }
    }

    const scale = wr / 0.34;
    const wheelY = -H / 2 + wr * 0.78;
    const track = bodyW * 0.5 + wr * 0.22;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(wr * 0.7, wr * 0.42, wr * 1.45, paint, sx * (bodyW * 0.46), wheelY + wr * 0.62, sz * axleZ, { radius: wr * 0.18 });
        const axle = new THREE.Group();
        axle.rotation.z = Math.PI / 2;
        axle.position.set(sx * track, wheelY, sz * axleZ);
        const wheel = new THREE.Mesh(wheelGeo, tire);
        wheel.scale.setScalar(scale);
        wheel.userData.wheel = true;
        wheel.castShadow = true;
        const outward = sx > 0 ? -1 : 1;
        const rim = new THREE.Mesh(rimGeo, chrome);
        rim.position.y = outward * 0.12;
        const cap = new THREE.Mesh(capGeo, paint);
        cap.position.y = outward * 0.16;
        wheel.add(rim, cap);
        axle.add(wheel);
        group.add(axle);
      }
    }
    group.userData.kind = kind.id;
    group.userData.color = color;
    return group;
  }

  function smack(car, hitBody) {
    if (car.driven) return;
    if (car.pursuit) {
      tryGrab(car);
      return;
    }
    const now = performance.now();
    if (now < car.cool) return;
    car.cool = now + 460;
    const kind = car.kind;
    const sign = car.dir;
    const rush = Math.max(Math.abs(car.speed), car.cruise * 0.4);
    const scale = 0.78 + Math.min(0.45, rush / 40);
    const loft = kind.loft * scale * (0.86 + Math.random() * 0.28);
    const forward = kind.shove * scale * (car.rogue ? 1.25 : 1);
    const slip = (Math.random() - 0.5) * kind.yaw * 2;
    const who = hitBody.doll || ragdoll;
    const torso = who.mover();
    if (car.rogue || car.loop || car.turning) {
      torso.velocity.x = Math.sin(car.yaw) * forward;
      torso.velocity.z = Math.cos(car.yaw) * forward;
    } else {
      torso.velocity.x = (car.axis === 'x' ? sign * forward : slip);
      torso.velocity.z = (car.axis === 'z' ? sign * forward : slip);
    }
    torso.angularVelocity.set(0, 0, 0);
    torso.wakeUp();
    hits += 1;
    const yells = car.rogue ? ['GOTCHA!', 'CAMPING!', 'CRAZY!'] : (kind.yells || HITS);
    const word = hitBody.partName === 'head' ? 'BEAK!' : yells[(Math.random() * yells.length) | 0];
    const power = Math.hypot(forward, loft);
    onEvent({
      callout: word,
      flair: word,
      shake: Math.min(0.72, 0.12 + power * 0.014),
      score: 12 + power,
      impact: power * 0.35,
      pos: { x: torso.position.x, y: torso.position.y + 0.7, z: torso.position.z },
      burst: 'feather',
      launch: 0.42 + Math.min(0.85, power / 48),
      honk: true,
      bawk: true,
      hit: true,
      by: who,
      who,
      style: {
        spin: kind.spin,
        spinScale: kind.spinScale,
        maxSpin: kind.maxSpin,
        spread: kind.spread,
        yJitter: kind.yJitter,
        wobble: kind.loft > kind.shove ? 6.5 : 3.2,
      },
    });
  }

  function centerOf(car) {
    const off = laneOffset(car.axis, car.slot);
    if (car.axis === 'z') return { x: shiftX + car.gx * CELL + off, z: car.travel };
    return { x: car.travel, z: shiftZ + car.gz * CELL + off };
  }

  function boundsOf(car, frontPad) {
    const c = centerOf(car);
    const along = car.kind.d / 2;
    const across = car.kind.w / 2 + 0.15;
    const pad = Math.max(0, frontPad);
    if (car.axis === 'z') {
      return {
        minX: c.x - across,
        maxX: c.x + across,
        minZ: car.dir > 0 ? c.z - along : c.z - along - pad,
        maxZ: car.dir > 0 ? c.z + along + pad : c.z + along,
      };
    }
    return {
      minX: car.dir > 0 ? c.x - along : c.x - along - pad,
      maxX: car.dir > 0 ? c.x + along + pad : c.x + along,
      minZ: c.z - across,
      maxZ: c.z + across,
    };
  }

  function boxesOverlap(a, b) {
    return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
  }

  function sameLane(a, b) {
    if (a.axis !== b.axis || a.slot !== b.slot) return false;
    return a.axis === 'z' ? a.gx === b.gx : a.gz === b.gz;
  }

  function inCrossRoad(car) {
    const half = car.kind.d / 2;
    const min = car.travel - half;
    const max = car.travel + half;
    const origin = car.axis === 'z' ? shiftZ : shiftX;
    const k0 = Math.floor((min - origin) / CELL) - 1;
    for (let k = k0; k <= k0 + 3; k++) {
      const road0 = origin + k * CELL;
      if (max > road0 && min < road0 + ROAD) return true;
    }
    return false;
  }

  function overlapAlong(car, other) {
    const a = boundsOf(car, 0);
    const b = boundsOf(other, 0);
    if (car.axis === 'z') return Math.max(0, Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ));
    return Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  }

  function separatePair(a, b) {
    if (a.axis !== b.axis) return;
    const shove = (car, forward, other) => {
      car.travel += (forward ? car.dir : -car.dir) * (overlapAlong(car, other) + 0.35);
    };
    const aBehind = (b.travel - a.travel) * a.dir > 0;
    const yielder = aBehind ? a : b;
    shove(yielder, false, yielder === a ? b : a);
  }

  function untangle() {
    for (let pass = 0; pass < 6; pass++) {
      let hit = false;
      for (let i = 0; i < cars.length; i++) {
        const a = cars[i];
        for (let j = i + 1; j < cars.length; j++) {
          const b = cars[j];
          if (a.rogue || b.rogue || a.loop || b.loop || a.turning || b.turning) continue;
          if (!boxesOverlap(boundsOf(a, 0), boundsOf(b, 0))) continue;
          hit = true;
          separatePair(a, b);
        }
      }
      if (!hit) break;
    }
  }

  function phaseOf() {
    return { z: 'green', x: 'green' };
  }

  function junctionPhase() {
    const t = (performance.now() / 1000) % 18;
    if (t < 8) return { loop: 'green', stem: 'red' };
    if (t < 10) return { loop: 'yellow', stem: 'red' };
    if (t < 16) return { loop: 'red', stem: 'green' };
    return { loop: 'red', stem: 'yellow' };
  }

  function paintSignal(set, color) {
    const dim = 0x2c3138;
    for (const key of ['red', 'yellow', 'green']) {
      const on = key === color;
      const lens = set[key];
      lens.emissiveIntensity = on ? 3.6 : 0;
      lens.color.set(on ? lens.emissive : dim);
    }
  }

  function leadGap(car) {
    let bumper = Infinity;
    for (const other of cars) {
      if (other.rogue || other.loop || other.turning || !sameLane(car, other)) continue;
      const ahead = (other.travel - car.travel) * car.dir;
      if (ahead <= 0) continue;
      bumper = Math.min(bumper, ahead - (car.kind.d + other.kind.d) / 2);
    }
    return bumper;
  }

  function holdLanes() {
    const groups = new Map();
    for (const car of cars) {
      if (car.rogue || car.loop || car.turning) continue;
      const key = `${car.axis}:${car.slot}:${car.axis === 'z' ? car.gx : car.gz}`;
      let list = groups.get(key);
      if (!list) {
        list = [];
        groups.set(key, list);
      }
      list.push(car);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.travel * a.dir - b.travel * b.dir);
      for (let i = 0; i < list.length - 1; i++) {
        const behind = list[i];
        const ahead = list[i + 1];
        const minGap = (behind.kind.d + ahead.kind.d) / 2 + 0.75;
        const bumper = (ahead.travel - behind.travel) * behind.dir;
        if (bumper < minGap) behind.travel = ahead.travel - behind.dir * minGap;
      }
    }
  }

  function followFactor(car) {
    const follow = 5.5;
    const gap = leadGap(car);
    let factor = 1;
    if (gap < follow) factor = Math.max(0.86, gap / follow);
    if (inCrossRoad(car)) factor = Math.max(factor, 0.92);
    return factor;
  }

  function clearanceAt(car, travel) {
    const saved = car.travel;
    car.travel = travel;
    const inside = inCrossRoad(car);
    car.travel = saved;
    if (inside) return -Infinity;
    let gap = Infinity;
    const half = car.kind.d / 2;
    for (const other of cars) {
      if (other === car || other.rogue || other.loop || !sameLane(car, other)) continue;
      gap = Math.min(gap, Math.abs(other.travel - travel) - other.kind.d / 2 - half);
    }
    return gap;
  }

  function placeWrapped(car) {
    const box = bounds();
    const min = (car.axis === 'z' ? box.minZ : box.minX) + 1;
    const max = (car.axis === 'z' ? box.maxZ : box.maxX) - 1;
    const dir = car.travel > max ? -1 : 1;
    for (let n = 1; n <= SPAN + 2; n++) {
      const at = car.travel + dir * n * CELL;
      if (at < min || at > max) continue;
      if (clearanceAt(car, at) > 6) {
        car.travel = at;
        return;
      }
    }
    car.travel += dir * SPAN * CELL;
  }

  function districtAt(x, z) {
    const gx = clamp(Math.floor((x - shiftX) / CELL), 0, CITY - 1);
    const gz = clamp(Math.floor((z - shiftZ) / CELL), 0, CITY - 1);
    return districtId(gx, gz);
  }

  function noteDistrict(x, z) {
    const id = districtAt(x, z);
    if (!id || id === seenDistrict) return;
    seenDistrict = id;
    onEvent({ callout: DISTRICT_NAME[id] || id });
  }

  function spawnCar(axis, slot, gx, gz, travel, home) {
    const kind = home ? fleetKind(home, (Math.abs(travel) * 10 + nextCarId) | 0) : pickKind();
    const sign = slot === 0 ? 1 : -1;
    const cruise = FLOW_SPEED;
    const speed = sign * cruise;
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: carMat,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
      allowSleep: false,
      fixedRotation: true,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(kind.w / 2, kind.h / 2, kind.d / 2)));
    body.angularFactor.set(0, 0, 0);
    body.gameRole = 'car';
    const mesh = buildCar(kind, home ? fleetPaint(home, kind) : null);
    carRoot.add(mesh);
    const car = {
      id: nextCarId++,
      axis,
      slot,
      gx,
      gz,
      travel,
      home: home || '',
      dir: sign,
      cruise,
      speed,
      kind,
      ride: GROUND_Y + kind.h / 2 + 0.05,
      body,
      mesh,
      cool: 0,
      honkAt: 0,
      spin: Math.random() * 6,
    };
    body.addEventListener('collide', (event) => {
      const other = event.body;
      if (!running || !other || other.gameRole !== 'ragdoll') return;
      if (weapons.chopping()) return;
      smack(car, other);
    });
    addBody(body);
    aim(car);
    syncCar(car);
    cars.push(car);
    return car;
  }

  function crazyKind() {
    const id = CRAZY_IDS[(Math.random() * CRAZY_IDS.length) | 0];
    for (const kind of KINDS) if (kind.id === id) return kind;
    return pickKind();
  }

  function rogueAlive() {
    for (const car of cars) if (car.rogue) return true;
    return false;
  }

  function removeCar(car) {
    const riding = bust && bust.phase === 'ride' && bust.car === car;
    const extra = hauls.find((haul) => haul.phase === 'ride' && haul.car === car);
    const driver = car.pilot;
    removeBody(car.body);
    car.mesh.removeFromParent();
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
    if (driver) {
      car.pilot = null;
      car.driven = false;
      if (ride === car) {
        ride = null;
        gas = 0;
        wheel = 0;
      }
      if (driver.walking()) unpinDoll(driver);
    }
    if (riding) spill('BAIL!');
    else if (extra) {
      unpinDoll(extra.doll);
      hauls = hauls.filter((haul) => haul !== extra);
    }
  }

  function summonCrazy(x, z) {
    const kind = crazyKind();
    const angle = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 8;
    const px = x + Math.sin(angle) * dist;
    const pz = z + Math.cos(angle) * dist;
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: carMat,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
      allowSleep: false,
      fixedRotation: true,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(kind.w / 2, kind.h / 2, kind.d / 2)));
    body.angularFactor.set(0, 0, 0);
    body.gameRole = 'car';
    const mesh = buildCar(kind);
    carRoot.add(mesh);
    const car = {
      id: nextCarId++,
      axis: 'z',
      slot: 0,
      gx: 0,
      gz: 0,
      travel: pz,
      dir: 1,
      cruise: CRAZY_SPEED,
      speed: CRAZY_SPEED,
      kind,
      ride: GROUND_Y + kind.h / 2 + 0.05,
      body,
      mesh,
      cool: 0,
      honkAt: performance.now() + 900,
      spin: Math.random() * 6,
      rogue: true,
      yaw: Math.atan2(x - px, z - pz),
      px,
      pz,
      aimX: x,
      aimZ: z,
      passed: false,
      life: 0,
    };
    body.addEventListener('collide', (event) => {
      const other = event.body;
      if (!running || !other || other.gameRole !== 'ragdoll') return;
      if (weapons.chopping()) return;
      smack(car, other);
    });
    addBody(body);
    driveRogue(car, 0);
    cars.push(car);
    onEvent({
      callout: 'LOOK OUT!',
      honk: true,
      shake: 0.16,
      pos: { x, y: GROUND_Y + 1.6, z },
    });
  }

  function driveRogue(car, dt) {
    car.life += dt;
    if (!car.passed && prey.still) {
      car.aimX = prey.x;
      car.aimZ = prey.z;
    }
    const dx = car.aimX - car.px;
    const dz = car.aimZ - car.pz;
    if (!car.passed) {
      const ahead = dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw);
      if (ahead < 0.35) car.passed = true;
      else if (dx * dx + dz * dz > 0.04) car.yaw = Math.atan2(dx, dz);
    }
    car.px += Math.sin(car.yaw) * CRAZY_SPEED * dt;
    car.pz += Math.cos(car.yaw) * CRAZY_SPEED * dt;
    car.speed = CRAZY_SPEED;
    car.body.position.set(car.px, car.ride, car.pz);
    car.body.previousPosition.copy(car.body.position);
    car.body.aabbNeedsUpdate = true;
    car.body.quaternion.setFromAxisAngle(AXIS_Y, car.yaw);
    car.body.velocity.set(Math.sin(car.yaw) * CRAZY_SPEED, 0, Math.cos(car.yaw) * CRAZY_SPEED);
    car.body.angularVelocity.set(0, 0, 0);
    car.body.wakeUp();
  }

  let ride = null;
  let gas = 0;
  let wheel = 0;
  let offer = false;
  const entryMemory = new Map();

  function tune(kind) {
    const bulk = kind.w * kind.h * kind.d;
    const heft = Math.min(1, Math.max(0, (bulk - 8.5) / 48));
    const sport = kind.id === 'sport' ? 1 : kind.id === 'police' ? 0.35 : kind.id === 'taxi' ? 0.2 : 0;
    return {
      top: 27 - heft * 14 + sport * 9,
      reverse: 10 - heft * 4.5,
      accel: 24 - heft * 12 + sport * 10,
      turn: 1.9 - heft * 0.85 + sport * 0.55,
      ram: 0.7 + heft * 1.65 - sport * 0.22,
    };
  }

  function carPose(car) {
    if (car.rogue || car.driven || car.loose || car.loop || car.turning) return { x: car.px, z: car.pz, yaw: car.yaw };
    const spot = centerOf(car);
    return { x: spot.x, z: spot.z, yaw: yawOf(car) };
  }

  function carLocal(px, pz, car) {
    const pose = carPose(car);
    const dx = px - pose.x;
    const dz = pz - pose.z;
    return {
      x: dx * Math.cos(pose.yaw) - dz * Math.sin(pose.yaw),
      z: dx * Math.sin(pose.yaw) + dz * Math.cos(pose.yaw),
      pose,
    };
  }

  function gapToCar(px, pz, car) {
    const local = carLocal(px, pz, car);
    const ox = Math.max(Math.abs(local.x) - car.kind.w / 2, 0);
    const oz = Math.max(Math.abs(local.z) - car.kind.d / 2, 0);
    return Math.hypot(ox, oz);
  }

  function closestCar(maxGap, doll) {
    const who = doll || ragdoll;
    if (!who.walking()) return null;
    const spot = who.mover().position;
    let best = null;
    let bestGap = maxGap;
    for (const car of cars) {
      if (car.driven || car.pursuit) continue;
      if (Math.abs(spot.y - car.ride) > 2.3) continue;
      const gap = gapToCar(spot.x, spot.z, car);
      if (gap < bestGap) {
        bestGap = gap;
        best = car;
      }
    }
    return best;
  }

  function freshEntry(doll) {
    const mem = entryMemory.get(doll);
    if (!mem) return null;
    if (performance.now() > mem.until || !cars.includes(mem.car) || mem.car.driven || mem.car.pursuit) {
      entryMemory.delete(doll);
      return null;
    }
    return mem.car;
  }

  function trackEntry(doll) {
    if (!doll || !doll.walking() || pilotOf(doll) || haulOf(doll) || (doll === ragdoll && bust && bust.phase)) {
      entryMemory.delete(doll);
      return null;
    }
    const live = closestCar(ENTRY_GAP, doll);
    if (live) {
      entryMemory.set(doll, { car: live, until: performance.now() + ENTRY_COYOTE * 1000 });
      return live;
    }
    return freshEntry(doll);
  }

  function pilotOf(doll) {
    for (const car of cars) if (car.pilot === doll) return car;
    return null;
  }

  function roofCar(doll) {
    const who = doll || ragdoll;
    if (!who.walking() || pilotOf(who)) return null;
    const spot = who.mover();
    if (spot.velocity.y > 0.35) return null;
    for (const car of cars) {
      if (car.driven || car.pursuit) continue;
      const local = carLocal(spot.position.x, spot.position.z, car);
      if (Math.abs(local.x) > car.kind.w * 0.46) continue;
      if (Math.abs(local.z) > car.kind.d * 0.46) continue;
      const roof = car.ride + car.kind.h * 0.5;
      if (spot.position.y < roof + 0.05 || spot.position.y > roof + 1.35) continue;
      return car;
    }
    return null;
  }

  function solidBoxes() {
    const boxes = [];
    for (const tile of tiles) {
      if (!tile.props) continue;
      const ox = shiftX + tile.gx * CELL;
      const oz = shiftZ + tile.gz * CELL;
      for (const prop of tile.props) {
        if (prop.kind !== 'building') continue;
        boxes.push({
          minX: ox + prop.lx - prop.hx,
          maxX: ox + prop.lx + prop.hx,
          minZ: oz + prop.lz - prop.hz,
          maxZ: oz + prop.lz + prop.hz,
        });
      }
    }
    if (jail && !jail.open) {
      boxes.push({
        minX: jail.cx - jail.halfX,
        maxX: jail.cx + jail.halfX,
        minZ: jail.cz - jail.halfZ,
        maxZ: jail.cz + jail.halfZ,
      });
    }
    return boxes;
  }

  function pointBlocked(x, z, pad, boxes) {
    for (const box of boxes) {
      if (x > box.minX - pad && x < box.maxX + pad && z > box.minZ - pad && z < box.maxZ + pad) return true;
    }
    return false;
  }

  function buildingNudge(x, z, yaw, kind) {
    const boxes = solidBoxes();
    const hw = kind.w * 0.46;
    const hd = kind.d * 0.48;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let px = 0;
    let pz = 0;
    const corners = [[hd, hw], [hd, -hw], [-hd, hw], [-hd, -hw], [hd * 0.15, 0]];
    for (const [lz, lx] of corners) {
      const sx = x + fx * lz + rx * lx;
      const sz = z + fz * lz + rz * lx;
      for (const box of boxes) {
        if (sx <= box.minX || sx >= box.maxX || sz <= box.minZ || sz >= box.maxZ) continue;
        const left = sx - box.minX;
        const right = box.maxX - sx;
        const front = sz - box.minZ;
        const back = box.maxZ - sz;
        const m = Math.min(left, right, front, back);
        if (m === left) px = Math.min(px, -(left + 0.08));
        else if (m === right) px = Math.max(px, right + 0.08);
        else if (m === front) pz = Math.min(pz, -(front + 0.08));
        else pz = Math.max(pz, back + 0.08);
      }
    }
    return { x: px, z: pz };
  }

  function carAABB(car) {
    const pose = carPose(car);
    const fx = Math.abs(Math.sin(pose.yaw));
    const fz = Math.abs(Math.cos(pose.yaw));
    const hx = car.kind.d / 2 * fx + car.kind.w / 2 * fz;
    const hz = car.kind.d / 2 * fz + car.kind.w / 2 * fx;
    return {
      minX: pose.x - hx,
      maxX: pose.x + hx,
      minZ: pose.z - hz,
      maxZ: pose.z + hz,
      x: pose.x,
      z: pose.z,
    };
  }

  function shoveTraffic(car) {
    const mine = carAABB(car);
    const now = performance.now();
    for (const other of cars) {
      if (other === car || other.driven) continue;
      const box = carAABB(other);
      const overlapX = Math.min(mine.maxX, box.maxX) - Math.max(mine.minX, box.minX);
      const overlapZ = Math.min(mine.maxZ, box.maxZ) - Math.max(mine.minZ, box.minZ);
      if (overlapX <= 0 || overlapZ <= 0) continue;
      const dx = mine.x - box.x;
      const dz = mine.z - box.z;
      const len = Math.hypot(dx, dz) || 1;
      const push = Math.min(overlapX, overlapZ) * 0.65 + 0.12;
      const nx = dx / len;
      const nz = dz / len;
      car.px += nx * push;
      car.pz += nz * push;
      if (other.rogue) {
        other.px -= nx * push * 0.65;
        other.pz -= nz * push * 0.65;
        other.body.position.set(other.px, other.ride, other.pz);
      } else if (other.loop || other.turning) {
        // Beltway cars stay on their line.
      } else if (other.axis === 'z') {
        other.travel -= nz * push;
        syncCar(other);
      } else {
        other.travel -= nx * push;
        syncCar(other);
      }
      if (Math.abs(car.speed) > 5 && now > (car.bumpAt || 0)) {
        car.bumpAt = now + 380;
        car.speed *= 0.62;
        car.hop = Math.max(car.hop || 0, 0.22);
        const words = ['CRUNCH!', 'FENDER!', 'BAM!', 'HONK!'];
        onEvent({
          callout: words[(Math.random() * words.length) | 0],
          honk: true,
          shake: 0.18,
          crunch: true,
          impact: 8,
          score: car.pilot ? 18 : 0,
          by: car.pilot || undefined,
      pos: { x: (mine.x + box.x) / 2, y: car.ride + 0.5, z: (mine.z + box.z) / 2 },
          burst: 'chip',
        });
      }
      mine.x = car.px;
      mine.z = car.pz;
      mine.minX += nx * push;
      mine.maxX += nx * push;
      mine.minZ += nz * push;
      mine.maxZ += nz * push;
    }
  }

  function overlapsCar(car, wx, wz, radius) {
    const local = carLocal(wx, wz, car);
    const ox = Math.max(Math.abs(local.x) - car.kind.w * 0.5, 0);
    const oz = Math.max(Math.abs(local.z) - car.kind.d * 0.5, 0);
    return ox * ox + oz * oz <= radius * radius;
  }

  function noseInside(car, box) {
    const yaw = car.yaw;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const nose = Math.sign(car.speed || 1) * car.kind.d * 0.5;
    const hw = car.kind.w * 0.46;
    for (const lx of [hw, 0, -hw]) {
      const sx = car.px + fx * nose + rx * lx;
      const sz = car.pz + fz * nose + rz * lx;
      if (sx > box.minX && sx < box.maxX && sz > box.minZ && sz < box.maxZ) return { x: sx, z: sz };
    }
    return null;
  }

  function ram(car) {
    const speed = Math.abs(car.speed);
    if (speed < 3.4) return;
    const spec = car.spec || (car.spec = tune(car.kind));
    const punch = spec.ram * (0.4 + speed / 16);
    const dir = Math.sign(car.speed || 1);
    const grip = {
      dx: Math.sin(car.yaw) * dir,
      dy: 0.12,
      dz: Math.cos(car.yaw) * dir,
    };
    const power = {
      knock: 0.8 + punch * 0.9,
      lift: 0.5 + punch * 0.42,
      spin: 0.75 + punch * 0.32,
      cracks: punch > 2.35 ? 2 : 1,
      shake: 0.8 + Math.min(0.7, punch * 0.16),
      score: 0.85 + spec.ram * 0.2,
      callout: punch > 2.2 ? 'CRASH!' : 'WHAM!',
      burst: 'chip',
    };
    const now = performance.now();
    const reach = CELL * 1.15;
    let drag = 0;
    for (const tile of tiles) {
      if (!tile.props || !tile.props.length) continue;
      const ox = shiftX + tile.gx * CELL;
      const oz = shiftZ + tile.gz * CELL;
      if (Math.abs(ox + CELL * 0.5 - car.px) > reach) continue;
      if (Math.abs(oz + CELL * 0.5 - car.pz) > reach) continue;
      for (let i = tile.props.length - 1; i >= 0; i--) {
        const prop = tile.props[i];
        if (prop.kind === 'building') {
          if (punch < 1.05) continue;
          if (now < (car.wallAt?.[prop.id] || 0)) continue;
          const box = {
            minX: ox + prop.lx - prop.hx,
            maxX: ox + prop.lx + prop.hx,
            minZ: oz + prop.lz - prop.hz,
            maxZ: oz + prop.lz + prop.hz,
          };
          const nose = noseInside(car, box);
          if (!nose) continue;
          car.wallAt = car.wallAt || {};
          car.wallAt[prop.id] = now + 420;
          crackBuilding(tile, prop, { x: nose.x, y: car.ride, z: nose.z }, power, car.pilot || null);
          car.scrapeAt = now + 460;
          car.hop = Math.max(car.hop || 0, 0.22);
          continue;
        }
        const wx = ox + prop.lx;
        const wz = oz + prop.lz;
        const radius = Math.max(0.32, (prop.radius || 0.55) * 0.8);
        if (!overlapsCar(car, wx, wz, radius)) continue;
        const y = Math.min(GROUND_Y + (prop.reachH || 2) - 0.05, car.ride);
        if (!propTouches(tile, prop, wx, y, wz)) continue;
        const mass = prop.mass || 8;
        topple(tile, prop, grip, power);
        drag += mass / (55 + spec.ram * 110);
        car.hop = Math.max(car.hop || 0, 0.16);
      }
    }
    if (drag > 0) car.speed *= 1 - Math.min(0.58, drag);
  }

  function plantCar(car) {
    car.ride = GROUND_Y + car.kind.h / 2 + 0.05;
    car.body.position.set(car.px, car.ride, car.pz);
    car.body.previousPosition.copy(car.body.position);
    car.body.aabbNeedsUpdate = true;
    car.body.quaternion.setFromAxisAngle(AXIS_Y, car.yaw);
    car.body.velocity.set(Math.sin(car.yaw) * car.speed, 0, Math.cos(car.yaw) * car.speed);
    car.body.angularVelocity.set(0, 0, 0);
    car.body.wakeUp();
  }

  function roll(car, dt, throttle, turn, loose) {
    const spec = car.spec || (car.spec = tune(car.kind));
    const boost = loose ? 0 : Math.min(0.85, car.boost || 0);
    if (!loose) car.boost = Math.max(0, (car.boost || 0) - dt * 0.7);
    if (throttle > 0.05 && car.speed < -0.8) car.speed += throttle * spec.accel * 1.7 * dt;
    else if (throttle < -0.05 && car.speed > 0.8) car.speed += throttle * spec.accel * 1.9 * dt;
    else if (Math.abs(throttle) > 0.05) car.speed += throttle * spec.accel * (1 + boost) * dt;
    else car.speed += (0 - car.speed) * (1 - Math.exp(-(loose ? 2.4 : 1.35) * dt));
    const cap = spec.top * (1 + boost * 0.4);
    if (car.speed > cap) car.speed = cap;
    if (car.speed < -spec.reverse) car.speed = -spec.reverse;
    if (Math.abs(car.speed) < 0.12 && Math.abs(throttle) < 0.05) car.speed = 0;
    if (!loose && boost > 0.15) car.speed += boost * 14 * dt;
    if (Math.abs(car.speed) > 0.35 && turn) {
      const grip = 0.42 + 0.58 * Math.min(1, Math.abs(car.speed) / 9);
      car.yaw += turn * spec.turn * grip * Math.sign(car.speed) * dt;
    }
    car.px += Math.sin(car.yaw) * car.speed * dt;
    car.pz += Math.cos(car.yaw) * car.speed * dt;
    if (car.driven || car.loose) ram(car);
    const nudge = buildingNudge(car.px, car.pz, car.yaw, car.kind);
    const push = Math.hypot(nudge.x, nudge.z);
    car.px += Math.max(-1.5, Math.min(1.5, nudge.x));
    car.pz += Math.max(-1.5, Math.min(1.5, nudge.z));
    if (car.driven || car.loose) {
      const held = islandClamp(car.px, car.pz, 1.4);
      if (held.out) {
        car.px = held.x;
        car.pz = held.z;
        car.speed *= 0.25;
      }
    }
    if (push > 0.08) {
      const into = (nudge.x * Math.sin(car.yaw) + nudge.z * Math.cos(car.yaw)) * Math.sign(car.speed || 1);
      if (into < -0.02) {
        const keep = 0.38 + Math.min(0.46, (spec.ram || 0.7) * 0.2);
        car.speed *= keep;
      }
      if (push > 0.18 && Math.abs(car.speed) > 7 && performance.now() > (car.scrapeAt || 0)) {
        car.scrapeAt = performance.now() + 460;
        car.hop = Math.max(car.hop || 0, 0.14);
        onEvent({
          callout: 'SCRAPE!',
          honk: true,
          shake: 0.14,
          crunch: true,
          impact: 6,
          pos: { x: car.px, y: car.ride + 0.4, z: car.pz },
          burst: 'chip',
        });
      }
    }
    shoveTraffic(car);
    plantCar(car);
  }

  function holdPilot(doll, car) {
    const x = car.px + Math.sin(car.yaw) * car.kind.d * 0.06;
    const z = car.pz + Math.cos(car.yaw) * car.kind.d * 0.06;
    const mover = doll.mover();
    mover.position.set(x, GROUND_Y + 0.72, z);
    mover.previousPosition.copy(mover.position);
    mover.velocity.set(0, 0, 0);
    mover.angularVelocity.set(0, 0, 0);
    mover.quaternion.set(0, 0, 0, 1);
  }

  function holdDriver() {
    for (const car of cars) {
      if (car.driven && car.pilot) holdPilot(car.pilot, car);
    }
  }

  function buckle() {
    return pinDoll(ragdoll);
  }

  function claimFor(doll, car) {
    if (!doll || !car || car.driven || car.pursuit) return false;
    const pose = carPose(car);
    const vx = car.body.velocity.x;
    const vz = car.body.velocity.z;
    car.rogue = true;
    car.loose = false;
    car.driven = true;
    car.pursuit = false;
    car.pilot = doll;
    car.px = pose.x;
    car.pz = pose.z;
    car.yaw = pose.yaw;
    car.speed = vx * Math.sin(pose.yaw) + vz * Math.cos(pose.yaw);
    car.boost = 0;
    car.gas = 0;
    car.wheel = 0;
    car.aimX = pose.x;
    car.aimZ = pose.z;
    car.passed = true;
    car.life = 0;
    if (doll === ragdoll) {
      ride = car;
      gas = 0;
      wheel = 0;
      offer = false;
    }
    if (!doll.walking()) doll.setWalker(true);
    pinDoll(doll);
    holdPilot(doll, car);
    onEvent({
      callout: 'VROOM!',
      honk: true,
      bawk: true,
      shake: 0.1,
      hint: true,
      who: doll === ragdoll ? undefined : doll,
      pos: { x: car.px, y: car.ride + car.kind.h * 0.4, z: car.pz },
    });
    return true;
  }

  function claim(car) {
    return claimFor(ragdoll, car);
  }

  function releaseFor(doll) {
    const car = pilotOf(doll);
    if (!car) return null;
    car.driven = false;
    car.loose = true;
    car.rogue = true;
    car.pilot = null;
    car.gas = 0;
    car.wheel = 0;
    if (ride === car) {
      ride = null;
      gas = 0;
      wheel = 0;
    }
    return car;
  }

  function releaseWheel() {
    return releaseFor(ragdoll);
  }

  function hopInDoll(doll) {
    if (!running || room || !doll) return false;
    if (pilotOf(doll)) return false;
    if (haulOf(doll)) return false;
    if (doll === ragdoll && bust && bust.phase) return false;
    if (!doll.walking()) return false;
    const car = closestCar(ENTRY_GAP, doll) || freshEntry(doll);
    if (!car) return false;
    return claimFor(doll, car);
  }

  function hopIn() {
    if (ride || (bust && bust.phase)) return false;
    return hopInDoll(ragdoll);
  }

  function hopOutDoll(doll) {
    const car = releaseFor(doll);
    if (!car || !doll) return null;
    const boxes = solidBoxes();
    const door = car.kind.w / 2 + 0.9;
    let side = 1;
    let x = car.px - Math.cos(car.yaw) * door * side;
    let z = car.pz + Math.sin(car.yaw) * door * side;
    if (pointBlocked(x, z, 0.35, boxes)) {
      side = -1;
      x = car.px - Math.cos(car.yaw) * door * side;
      z = car.pz + Math.sin(car.yaw) * door * side;
    }
    if (pointBlocked(x, z, 0.35, boxes)) {
      x = car.px + Math.sin(car.yaw) * (car.kind.d / 2 + 0.9);
      z = car.pz + Math.cos(car.yaw) * (car.kind.d / 2 + 0.9);
    }
    if (!doll.walking()) doll.setWalker(true);
    doll.place(x, doll.torso.spawn.y, z);
    const mover = unpinDoll(doll);
    const out = side === 1 ? 1 : -1;
    mover.velocity.set(-Math.cos(car.yaw) * 3.4 * out, 5.4, Math.sin(car.yaw) * 3.4 * out);
    onEvent({
      callout: 'BAIL!',
      bawk: true,
      hint: true,
      burst: 'feather',
      who: doll === ragdoll ? undefined : doll,
      pos: { x, y: mover.position.y + 0.6, z },
    });
    return { yaw: car.yaw, x, z };
  }

  function hopOut() {
    return hopOutDoll(ragdoll);
  }

  const CHASE_SPEED = 18;
  const RIDE_SPEED = 13;

  function policeKind() {
    for (const kind of KINDS) if (kind.id === 'police') return kind;
    return KINDS[0];
  }

  function destroyJail() {
    if (!jail) return;
    for (const body of jail.bodies) removeBody(body);
    for (const item of jail.loose) item.mesh.removeFromParent();
    jail.group.removeFromParent();
    jail = null;
  }

  function evictLot(cx, cz, halfX, halfZ) {
    for (const tile of tiles) {
      if (!tile.props) continue;
      const originX = shiftX + tile.gx * CELL;
      const originZ = shiftZ + tile.gz * CELL;
      for (let i = tile.props.length - 1; i >= 0; i--) {
        const prop = tile.props[i];
        const hx = prop.hx || prop.radius || 1.2;
        const hz = prop.hz || prop.radius || 1.2;
        const x = originX + prop.lx;
        const z = originZ + prop.lz;
        if (Math.abs(x - cx) > hx + halfX || Math.abs(z - cz) > hz + halfZ) continue;
        if (prop.kind === 'building') {
          dropDoor(tile, prop.id);
          for (const mesh of prop.shells) mesh.removeFromParent();
          for (const win of prop.windows) win.removeFromParent();
          for (const hole of prop.holeMeshes || []) hole.removeFromParent();
          const bodyIndex = tile.bodies.indexOf(prop.solid);
          if (bodyIndex >= 0) tile.bodies.splice(bodyIndex, 1);
          removeBody(prop.solid.body);
        } else if (prop.group) prop.group.removeFromParent();
        tile.props.splice(i, 1);
      }
    }
  }

  function jailAnchor() {
    const block = CELL - ROAD;
    return {
      cx: shiftX + (CITY - 1) * CELL + ROAD + block * 0.5,
      cz: shiftZ + ROAD + block * 0.5,
    };
  }

  function parkJail() {
    if (!jail) return;
    const spot = jailAnchor();
    shiftJail(spot.cx - jail.cx, spot.cz - jail.cz);
  }

  function haulOf(doll) {
    if (doll === ragdoll && bust) return bust;
    return hauls.find((haul) => haul.doll === doll) || null;
  }

  function cellMates() {
    const mates = [];
    if (bust && bust.phase === 'cell') mates.push(ragdoll);
    for (const haul of hauls) if (haul.phase === 'cell') mates.push(haul.doll);
    return mates;
  }

  function freeSuspects() {
    return suspects.filter((doll) => !haulOf(doll));
  }

  function inmatesPresent() {
    if (bust && (bust.phase === 'ride' || bust.phase === 'cell')) return true;
    return hauls.some((haul) => haul.phase === 'ride' || haul.phase === 'cell');
  }

  function stillChasing() {
    return suspects.some((doll) => {
      const haul = haulOf(doll);
      return !haul || haul.phase === 'ride';
    });
  }

  function pinDoll(doll) {
    if (!doll.walking()) doll.setWalker(true);
    const mover = doll.mover();
    mover.type = CANNON.Body.KINEMATIC;
    mover.collisionResponse = false;
    mover.collisionFilterMask = 0;
    mover.mass = 0;
    mover.updateMassProperties();
    mover.velocity.set(0, 0, 0);
    mover.angularVelocity.set(0, 0, 0);
    return mover;
  }

  function unpinDoll(doll) {
    const mover = doll.mover();
    mover.type = CANNON.Body.DYNAMIC;
    mover.collisionResponse = true;
    mover.collisionFilterMask = GROUP_RAG | GROUP_PROP | GROUP_STATIC;
    mover.mass = 8;
    mover.updateMassProperties();
    mover.wakeUp();
    return mover;
  }

  function jailNeedsFix() {
    if (!jail) return true;
    if (jail.breached || jail.open) return true;
    return jail.bars.some((bar) => bar.gone || bar.hits > 0);
  }

  function leaveCell() {
    if (!(bust && bust.phase === 'cell')) return;
    bust = null;
    grace = 1.2;
  }

  function buildJail(cx, cz) {
    destroyJail();
    const roomX = 4.8;
    const roomZ = 5.6;
    const roomH = 4.2;
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);
    root.add(group);
    const bodies = [];
    const bars = [];
    const loose = [];
    const wallMat = art.plastic(0x7f96a3, { roughness: 0.84 });
    const floorMat = art.plastic(0xd5dbe4, { roughness: 0.9 });
    const slab = (mat, w, h, d, x, y, z) => {
      const mesh = new THREE.Mesh(box, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      return mesh;
    };
    const block = (w, h, d, x, y, z) => {
      const body = new CANNON.Body({
        mass: 0,
        material: buildingMat,
        collisionFilterGroup: GROUP_STATIC,
        collisionFilterMask: GROUP_RAG | GROUP_PROP,
      });
      body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
      body.position.set(cx + x, y, cz + z);
      body.gameRole = 'cell';
      addBody(body);
      bodies.push(body);
      return body;
    };
    slab(floorMat, roomX * 2 + 0.4, 0.06, roomZ * 2 + 0.4, 0, GROUND_Y + 0.08, 0);
    slab(concreteMat, roomX * 2 + 1.2, 0.18, roomZ * 2 + 1.2, 0, GROUND_Y + roomH + 0.2, 0);
    block(roomX * 2 + 0.4, 0.18, roomZ * 2 + 0.4, 0, GROUND_Y + roomH + 0.16, 0);
    slab(wallMat, roomX * 2 + 0.5, roomH, 0.36, 0, GROUND_Y + roomH / 2, roomZ + 0.12);
    block(roomX * 2 + 0.5, roomH, 0.36, 0, GROUND_Y + roomH / 2, roomZ + 0.12);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        slab(concreteMat, 0.28, roomH + 0.2, 0.28, sx * roomX, GROUND_Y + roomH / 2, sz * roomZ);
      }
    }
    const panels = {
      south: block(roomX * 2 - 0.3, roomH, 0.34, 0, GROUND_Y + roomH / 2, -roomZ + 0.22),
      east: block(0.34, roomH, roomZ * 2 - 0.3, roomX - 0.22, GROUND_Y + roomH / 2, 0),
      west: block(0.34, roomH, roomZ * 2 - 0.3, -roomX + 0.22, GROUND_Y + roomH / 2, 0),
    };
    const barGeo = new THREE.CylinderGeometry(0.045, 0.045, 1, 6);
    const barH = roomH - 0.12;
    const addBar = (side, index, lx, lz) => {
      const mesh = new THREE.Mesh(barGeo, barMat);
      mesh.scale.y = barH;
      mesh.position.set(lx, GROUND_Y + barH / 2 + 0.06, lz);
      mesh.castShadow = true;
      group.add(mesh);
      const body = new CANNON.Body({
        mass: 0,
        material: buildingMat,
        collisionFilterGroup: GROUP_STATIC,
        collisionFilterMask: GROUP_RAG | GROUP_PROP,
      });
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.09, barH / 2, 0.09)));
      body.position.set(cx + lx, GROUND_Y + barH / 2 + 0.06, cz + lz);
      body.gameRole = 'static';
      addBody(body);
      bodies.push(body);
      bars.push({
        side,
        index,
        gone: false,
        hits: 0,
        need: 2,
        mesh,
        body,
        lx,
        lz,
        hx: 0.12,
        hy: barH / 2,
        hz: 0.12,
        y: GROUND_Y + barH / 2 + 0.06,
      });
    };
    let southN = 0;
    for (let x = -roomX + 0.28; x <= roomX - 0.2; x += 0.42) addBar('south', southN++, x, -roomZ);
    let sideN = 0;
    for (let z = -roomZ + 0.28; z <= roomZ - 0.36; z += 0.42) {
      addBar('east', sideN, roomX, z);
      addBar('west', sideN, -roomX, z);
      sideN += 1;
    }
    const rail = (w, d, x, y, z) => slab(barMat, w, 0.06, d, x, y, z);
    rail(roomX * 2 - 0.2, 0.08, 0, GROUND_Y + 0.2, -roomZ);
    rail(roomX * 2 - 0.2, 0.08, 0, GROUND_Y + roomH - 0.12, -roomZ);
    rail(0.08, roomZ * 2 - 0.3, roomX, GROUND_Y + 0.2, 0);
    rail(0.08, roomZ * 2 - 0.3, roomX, GROUND_Y + roomH - 0.12, 0);
    rail(0.08, roomZ * 2 - 0.3, -roomX, GROUND_Y + 0.2, 0);
    rail(0.08, roomZ * 2 - 0.3, -roomX, GROUND_Y + roomH - 0.12, 0);
    const bowl = new THREE.Mesh(roundGeo, concreteMat);
    bowl.scale.set(0.34, 0.4, 0.34);
    bowl.position.set(roomX - 1.1, GROUND_Y + 0.24, roomZ - 1.15);
    bowl.castShadow = true;
    const tank = new THREE.Mesh(box, concreteMat);
    tank.scale.set(0.38, 0.42, 0.18);
    tank.position.set(roomX - 1.1, GROUND_Y + 0.62, roomZ - 0.82);
    tank.castShadow = true;
    group.add(bowl, tank);
    const sign = new THREE.Mesh(plane, signTexture('JAIL', '#1c1f27', '#ffd23f'));
    sign.scale.set(2.4, 0.7, 1);
    sign.position.set(0, GROUND_Y + roomH + 0.55, -roomZ - 0.2);
    group.add(sign);
    const glow = new THREE.PointLight(0xfff1c2, 2.4, 18, 1.6);
    glow.position.set(0, GROUND_Y + 3.3, 0);
    group.add(glow);
    const lamp = new THREE.Mesh(box, lampMat);
    lamp.scale.set(0.7, 0.08, 0.7);
    lamp.position.copy(glow.position);
    group.add(lamp);
    jail = {
      group,
      bars,
      loose,
      bodies,
      open: false,
      breached: false,
      panels,
      cx,
      cz,
      inX: roomX - 0.45,
      inZ: roomZ - 0.45,
      viewX: roomX - 1.7,
      viewZ: roomZ - 1.7,
      halfX: roomX + 1.1,
      halfZ: roomZ + 1.1,
      exitX: roomX + 0.85,
      exitZ: roomZ + 0.85,
      gateX: cx,
      gateZ: cz - roomZ - 1.7,
    };
    const sheet = art.plastic(0xd5dbe3, { roughness: 0.72 });
    const bunk = new THREE.Group();
    const frame = new THREE.Mesh(box, barMat);
    frame.scale.set(2.1, 0.12, 0.9);
    const mattress = new THREE.Mesh(box, sheet);
    mattress.scale.set(1.95, 0.16, 0.74);
    mattress.position.y = 0.14;
    bunk.add(frame, mattress);
    addLoose('bunk', bunk, new CANNON.Box(new CANNON.Vec3(1.05, 0.16, 0.45)), 9, -roomX + 1.6, GROUND_Y + 0.32, roomZ - 1.5);
    const stool = new THREE.Group();
    const seat = new THREE.Mesh(box, woodSeat);
    seat.scale.set(0.5, 0.08, 0.5);
    seat.position.y = 0.36;
    const leg = new THREE.Mesh(box, woodDark);
    leg.scale.set(0.12, 0.36, 0.12);
    stool.add(seat, leg);
    addLoose('stool', stool, new CANNON.Box(new CANNON.Vec3(0.26, 0.24, 0.26)), 4, roomX - 1.5, GROUND_Y + 0.28, -0.4);
    const pipe = new THREE.Mesh(box, chrome);
    pipe.scale.set(1.35, 0.12, 0.12);
    addLoose('pipe', pipe, new CANNON.Box(new CANNON.Vec3(0.68, 0.06, 0.06)), 5, 0.6, GROUND_Y + 0.16, -roomZ + 1.8);
    evictLot(cx, cz, jail.halfX, jail.halfZ);
  }

  function addLoose(id, mesh, shape, mass, lx, ly, lz) {
    mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    junkRoot.add(mesh);
    const body = new CANNON.Body({
      mass,
      material: toyMat,
      linearDamping: 0.18,
      angularDamping: 0.28,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(shape);
    body.position.set(jail.cx + lx, ly, jail.cz + lz);
    body.gameRole = 'cell';
    addBody(body);
    jail.bodies.push(body);
    jail.loose.push({ id, body, mesh, cool: 0 });
  }

  function prepareJail() {
    if (jail && !jailNeedsFix()) {
      parkJail();
      return;
    }
    const spot = jailAnchor();
    buildJail(spot.cx, spot.cz);
  }

  function cellPoint(index, count) {
    const n = Math.max(1, count);
    const angle = (index / n) * Math.PI * 2 - Math.PI / 2;
    const rad = Math.min(1.25, jail.inX * 0.42);
    return {
      x: jail.cx + Math.cos(angle) * rad,
      z: jail.cz + Math.sin(angle) * rad * 0.85,
    };
  }

  function barAt(bar) {
    const at = { x: jail.cx + bar.lx, y: bar.y, z: jail.cz + bar.lz };
    const inset = 0.36;
    if (bar.side === 'south') at.z += inset;
    else if (bar.side === 'east') at.x -= inset;
    else at.x += inset;
    return at;
  }

  function nearestBar(x, y, z, pad) {
    let best = null;
    let bestD = Infinity;
    for (const bar of jail.bars) {
      if (bar.gone) continue;
      const at = barAt(bar);
      const dx = Math.abs(x - at.x);
      const dy = Math.abs(y - at.y);
      const dz = Math.abs(z - at.z);
      if (dy > bar.hy + 0.45) continue;
      if (dx > bar.hx + pad || dz > bar.hz + pad) continue;
      const d = dx + dz;
      if (d < bestD) {
        bestD = d;
        best = bar;
      }
    }
    return best;
  }

  function dropBar(bar) {
    bar.gone = true;
    bar.mesh.removeFromParent();
    const index = jail.bodies.indexOf(bar.body);
    if (index >= 0) jail.bodies.splice(index, 1);
    removeBody(bar.body);
  }

  function gapOpen(side) {
    const line = jail.bars.filter((item) => item.side === side).sort((a, b) => a.index - b.index);
    let run = 0;
    for (const bar of line) {
      run = bar.gone ? run + 1 : 0;
      if (run >= 5) return true;
    }
    return false;
  }

  function openPanel(side) {
    const body = jail.panels[side];
    if (!body) return;
    const index = jail.bodies.indexOf(body);
    if (index >= 0) jail.bodies.splice(index, 1);
    removeBody(body);
    jail.panels[side] = null;
  }

  function outsideCell(doll) {
    const spot = doll.mover().position;
    return Math.abs(spot.x - jail.cx) >= jail.exitX || Math.abs(spot.z - jail.cz) >= jail.exitZ;
  }

  function freeHaul(doll) {
    if (doll === ragdoll) bust = null;
    else hauls = hauls.filter((haul) => haul.doll !== doll);
  }

  function watchExit() {
    if (!jail || !jail.breached || jail.open) return;
    for (const doll of cellMates()) {
      if (!outsideCell(doll)) continue;
      const spot = doll.mover().position;
      freeHaul(doll);
      onEvent({
        callout: 'OUT!',
        hint: true,
        who: doll,
        pos: { x: spot.x, y: spot.y + 0.8, z: spot.z },
      });
    }
  }

  function hitBar(bar, pos, hitter) {
    if (!jail || jail.breached || bar.gone) return;
    bar.hits += 1;
    bar.mesh.rotation.z += 0.08;
    spawnChunk(pos.x, pos.y, pos.z, 0x9aa3b2, 0.08, 0.16, 0.08, rand(-2, 2), rand(2, 4), rand(-2, 2));
    if (bar.hits < bar.need) {
      onEvent({
        callout: `${bar.hits}/${bar.need}`,
        shake: 0.08,
        impact: 4,
        pos,
        burst: 'chip',
      });
      return;
    }
    dropBar(bar);
    if (!gapOpen(bar.side)) {
      onEvent({
        callout: 'BARS!',
        shake: 0.16,
        score: 6,
        by: hitter || undefined,
        impact: 7,
        pos,
        burst: 'chip',
      });
      return;
    }
    openPanel(bar.side);
    jail.breached = true;
    onEvent({
      callout: 'BREAK OUT!',
      flair: 'BREAK OUT!',
      shake: 0.42,
      score: 50,
      by: hitter || undefined,
      impact: 12,
      pos: { x: pos.x, y: pos.y + 0.4, z: pos.z },
      burst: 'chip',
      hint: true,
    });
  }

  function containLoose(item) {
    const p = item.body.position;
    const dx = p.x - jail.cx;
    const dz = p.z - jail.cz;
    const limX = jail.inX;
    const limZ = jail.inZ;
    if (Math.abs(dx) <= limX && Math.abs(dz) <= limZ && p.y >= GROUND_Y && p.y <= GROUND_Y + 3.4) return;
    p.x = jail.cx + Math.max(-limX + 0.15, Math.min(limX - 0.15, dx));
    p.z = jail.cz + Math.max(-limZ + 0.15, Math.min(limZ - 0.15, dz));
    p.y = Math.max(GROUND_Y + 0.25, Math.min(GROUND_Y + 1.6, p.y));
    item.body.velocity.scale(0.25, item.body.velocity);
  }

  function rattleBars(dt) {
    if (!jail || jail.open) return;
    const mates = cellMates();
    for (const item of jail.loose) {
      item.cool = Math.max(0, item.cool - dt);
      const p = item.body.position;
      if (mates.length && item.cool <= 0 && !jail.breached) {
        const speed = Math.hypot(item.body.velocity.x, item.body.velocity.y, item.body.velocity.z);
        if (speed >= 3.2) {
          const bar = nearestBar(p.x, p.y, p.z, 1.25);
          if (bar) {
            item.cool = 0.28;
            let hitter = mates[0];
            let bestD = Infinity;
            for (const doll of mates) {
              const spot = doll.mover().position;
              const dx = spot.x - p.x;
              const dz = spot.z - p.z;
              const d = dx * dx + dz * dz;
              if (d < bestD) {
                bestD = d;
                hitter = doll;
              }
            }
            hitBar(bar, { x: p.x, y: p.y, z: p.z }, hitter);
          }
        }
      }
      containLoose(item);
    }
    jail.bash = Math.max(0, (jail.bash || 0) - dt);
    if (jail.bash > 0 || jail.breached || !mates.length) return;
    for (const doll of mates) {
      const mover = doll.mover();
      const bar = nearestBar(mover.position.x, mover.position.y, mover.position.z, 0.62);
      if (!bar) continue;
      jail.bash = 0.42;
      hitBar(bar, { x: mover.position.x, y: mover.position.y, z: mover.position.z }, doll);
      break;
    }
  }

  function batter() {
    if (!running || !jail || jail.open || !bust || bust.phase !== 'cell') return false;
    const mover = ragdoll.mover();
    const yaw = ragdoll.facing();
    const dir = { x: Math.sin(yaw), z: Math.cos(yaw) };
    const r2 = 2.2 * 2.2;
    for (const item of jail.loose) {
      if (item.cool > 0) continue;
      const p = item.body.position;
      const ox = p.x - mover.position.x;
      const oy = p.y - mover.position.y;
      const oz = p.z - mover.position.z;
      if (ox * ox + oy * oy + oz * oz > r2) continue;
      item.cool = 0.16;
      item.body.velocity.set(dir.x * 14, 3.4, dir.z * 14);
      item.body.angularVelocity.set(rand(-6, 6), rand(-3, 3), rand(-6, 6));
      item.body.wakeUp();
    }
    if (jail.breached || (jail.bash || 0) > 0) return true;
    const bar = nearestBar(mover.position.x, mover.position.y, mover.position.z, 1.35);
    if (!bar) return true;
    jail.bash = 0.3;
    hitBar(bar, { x: mover.position.x, y: mover.position.y, z: mover.position.z }, ragdoll);
    return true;
  }

  function shoveLoose(x, y, z, dir, power, radius = 1.25, key = 'local') {
    if (!jail || jail.open) return;
    const r2 = radius * radius;
    for (const item of jail.loose) {
      if (weapons.seen(item.id, key)) continue;
      const p = item.body.position;
      const ox = p.x - x;
      const oy = p.y - y;
      const oz = p.z - z;
      if (ox * ox + oy * oy + oz * oz > r2) continue;
      weapons.mark(item.id, key);
      const len = Math.hypot(ox, oz) || 1;
      const dx = dir ? dir.x : ox / len;
      const dz = dir ? dir.z : oz / len;
      const kick = 12 * (power.knock || 1);
      item.body.velocity.set(dx * kick, 3.2, dz * kick);
      item.body.angularVelocity.set(rand(-6, 6), rand(-3, 3), rand(-6, 6));
      item.body.wakeUp();
    }
  }

  function shiftJail(dx, dz) {
    if (!jail) return;
    jail.cx += dx;
    jail.cz += dz;
    jail.gateX += dx;
    jail.gateZ += dz;
    jail.group.position.x += dx;
    jail.group.position.z += dz;
    for (const body of jail.bodies) {
      body.position.x += dx;
      body.position.z += dz;
      body.previousPosition.copy(body.position);
      body.aabbNeedsUpdate = true;
    }
  }

  function hookCar(car) {
    car.body.addEventListener('collide', (event) => {
      const other = event.body;
      if (!running || !other || other.gameRole !== 'ragdoll') return;
      if (weapons.chopping()) return;
      smack(car, other);
    });
  }

  function makePursuit(px, pz, yaw) {
    const kind = policeKind();
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: carMat,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
      allowSleep: false,
      fixedRotation: true,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(kind.w / 2, kind.h / 2, kind.d / 2)));
    body.angularFactor.set(0, 0, 0);
    body.gameRole = 'car';
    const mesh = buildCar(kind);
    carRoot.add(mesh);
    const car = {
      id: nextCarId++,
      axis: 'z',
      slot: 0,
      gx: 0,
      gz: 0,
      travel: pz,
      dir: 1,
      cruise: CHASE_SPEED,
      speed: CHASE_SPEED,
      kind,
      ride: GROUND_Y + kind.h / 2 + 0.05,
      body,
      mesh,
      cool: 0,
      honkAt: performance.now() + 400,
      spin: Math.random() * 6,
      rogue: true,
      pursuit: true,
      yaw,
      px,
      pz,
      aimX: px,
      aimZ: pz,
    };
    hookCar(car);
    addBody(body);
    cars.push(car);
    drivePursuit(car, 0);
    return car;
  }

  function enlist(car) {
    if (car.driven) return;
    const p = car.body.position;
    const yaw = yawOf(car);
    car.pursuit = true;
    car.rogue = true;
    car.px = p.x;
    car.pz = p.z;
    car.yaw = yaw;
    car.aimX = p.x;
    car.aimZ = p.z;
    car.passed = false;
    car.life = 0;
  }

  function siren(x, z, crew) {
    if (!running || inmatesPresent() || wanted) return;
    const list = [];
    for (const doll of crew || []) {
      if (doll && actors.includes(doll) && !list.includes(doll)) list.push(doll);
    }
    if (!list.length) return;
    suspects = list;
    wanted = true;
    grace = 0;
    prepareJail();
    const carsNeeded = Math.max(4, list.length);
    let n = 0;
    for (const car of cars) {
      if (!car.kind.police || car.pursuit) continue;
      enlist(car);
      n += 1;
    }
    while (n < carsNeeded) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 10;
      makePursuit(x + Math.sin(angle) * dist, z + Math.cos(angle) * dist, angle + Math.PI);
      n += 1;
    }
    onEvent({
      callout: 'POLICE!',
      honk: true,
      shake: 0.24,
      hint: true,
      pos: { x, y: GROUND_Y + 2.2, z },
    });
  }

  function freeMover() {
    const mover = ragdoll.mover();
    mover.type = CANNON.Body.DYNAMIC;
    mover.collisionResponse = true;
    mover.collisionFilterMask = GROUP_RAG | GROUP_PROP | GROUP_STATIC;
    mover.mass = 8;
    mover.updateMassProperties();
    mover.wakeUp();
    return mover;
  }

  function spill(word) {
    const spot = ragdoll.mover();
    const x = spot.position.x;
    const z = spot.position.z;
    if (!ragdoll.walking()) ragdoll.setWalker(true);
    ragdoll.place(x, ragdoll.torso.spawn.y, z);
    const mover = freeMover();
    bust = null;
    grace = 2.4;
    onEvent({
      callout: word,
      shake: 0.2,
      honk: true,
      hint: true,
      pos: { x: mover.position.x, y: mover.position.y + 1, z: mover.position.z },
    });
  }

  function arrest(car, doll) {
    if (!car.pursuit || !doll || haulOf(doll)) return;
    if (doll === ragdoll && grace > 0) return;
    if (doll === ragdoll) releaseWheel();
    const mover = pinDoll(doll);
    mover.position.set(car.px, GROUND_Y + 0.95, car.pz);
    mover.previousPosition.copy(mover.position);
    const haul = { doll, car, phase: 'ride' };
    if (doll === ragdoll) bust = haul;
    else hauls.push(haul);
    car.haul = doll;
    onEvent({
      callout: 'BUSTED!',
      honk: true,
      bawk: true,
      shake: 0.32,
      hint: true,
      who: doll,
      pos: { x: car.px, y: GROUND_Y + 1.6, z: car.pz },
    });
  }

  function tryGrab(car) {
    if (!wanted || !car.pursuit || car.haul) return;
    let best = null;
    let bestD = 2.35 * 2.35;
    for (const doll of freeSuspects()) {
      if (doll === ragdoll && grace > 0) continue;
      const mover = doll.mover();
      const dx = mover.position.x - car.px;
      const dz = mover.position.z - car.pz;
      const dy = mover.position.y - car.ride;
      const d = dx * dx + dz * dz;
      if (d > bestD || Math.abs(dy) > 2.5) continue;
      bestD = d;
      best = doll;
    }
    if (best) arrest(car, best);
  }

  function standDown() {
    wanted = false;
    const leaving = cars.filter((car) => car.pursuit);
    for (const car of leaving) removeCar(car);
  }

  function lockup(car) {
    const doll = car && car.haul;
    const haul = doll && haulOf(doll);
    if (!haul || haul.phase !== 'ride' || !jail) return;
    haul.phase = 'cell';
    haul.car = null;
    car.haul = null;
    const index = Math.max(0, suspects.indexOf(doll));
    const spot = cellPoint(index, suspects.length);
    const mover = unpinDoll(doll);
    doll.place(spot.x, doll.torso.spawn.y, spot.z);
    mover.velocity.set(0, 0, 0);
    if (!stillChasing()) standDown();
    onEvent({
      callout: 'JAIL!',
      shake: 0.28,
      honk: true,
      hint: true,
      who: doll,
      pos: { x: spot.x, y: GROUND_Y + 1.4, z: spot.z },
    });
  }

  function holdOne(doll, car) {
    const x = car.px - Math.sin(car.yaw) * 0.15;
    const z = car.pz - Math.cos(car.yaw) * 0.15;
    const mover = doll.mover();
    mover.position.set(x, GROUND_Y + 0.95, z);
    mover.previousPosition.copy(mover.position);
    mover.velocity.set(0, 0, 0);
    mover.angularVelocity.set(0, 0, 0);
    mover.quaternion.set(0, 0, 0, 1);
  }

  function holdInmate() {
    if (bust && bust.phase === 'ride' && bust.car) holdOne(ragdoll, bust.car);
    for (const haul of hauls) {
      if (haul.phase === 'ride' && haul.car) holdOne(haul.doll, haul.car);
    }
  }

  function nearestFree(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const doll of freeSuspects()) {
      const p = doll.mover().position;
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function pursuitGoal(car) {
    if (jail && car.haul) return { x: jail.gateX, z: jail.gateZ };
    const free = nearestFree(car.px, car.pz);
    if (free) return { x: free.x, z: free.z };
    if (jail && (bust || hauls.length)) {
      const i = Math.max(0, cars.indexOf(car));
      const angle = i * 1.47 + 0.6;
      return { x: jail.cx + Math.sin(angle) * 8.5, z: jail.cz + Math.cos(angle) * 8.5 };
    }
    return { x: prey.x, z: prey.z };
  }

  function drivePursuit(car, dt) {
    const goal = pursuitGoal(car);
    const dx = goal.x - car.px;
    const dz = goal.z - car.pz;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.35) {
      const target = Math.atan2(dx, dz);
      let turn = target - car.yaw;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      const step = 3.2 * dt;
      car.yaw += Math.max(-step, Math.min(step, turn));
    }
    const riding = !!(car.haul && haulOf(car.haul) && haulOf(car.haul).phase === 'ride');
    const cruise = riding ? RIDE_SPEED : CHASE_SPEED;
    const arrive = riding ? 2.5 : 1.4;
    const speed = dist < arrive ? cruise * (dist / arrive) : cruise;
    car.px += Math.sin(car.yaw) * speed * dt;
    car.pz += Math.cos(car.yaw) * speed * dt;
    car.speed = speed;
    car.ride = GROUND_Y + car.kind.h / 2 + 0.05;
    car.body.position.set(car.px, car.ride, car.pz);
    car.body.previousPosition.copy(car.body.position);
    car.body.aabbNeedsUpdate = true;
    car.body.quaternion.setFromAxisAngle(AXIS_Y, car.yaw);
    car.body.velocity.set(Math.sin(car.yaw) * speed, 0, Math.cos(car.yaw) * speed);
    car.body.angularVelocity.set(0, 0, 0);
    car.body.wakeUp();
    if (riding && dist < 2.7) lockup(car);
  }

  function blockTravel(axis, origin, index) {
    return origin + index * CELL + (axis === 'z' ? FLOW_Z : FLOW_X);
  }

  function coastLayout() {
    const span = CITY * CELL;
    const reach = LOOP_VERGE + LOOP_ROAD + LOOP_SHOULDER + LOOP_BLUFF;
    return { span, reach, fence: LOOP_VERGE + LOOP_ROAD + LOOP_SHOULDER };
  }

  function islandClamp(x, z, margin) {
    const { span, reach } = coastLayout();
    const inset = Math.max(0, margin || 0);
    const minX = shiftX - reach + inset;
    const maxX = shiftX + span + reach - inset;
    const minZ = shiftZ - reach + inset;
    const maxZ = shiftZ + span + reach - inset;
    const cx = Math.max(minX, Math.min(maxX, x));
    const cz = Math.max(minZ, Math.min(maxZ, z));
    return { x: cx, z: cz, out: cx !== x || cz !== z };
  }

  function loopMetrics() {
    const span = CITY * CELL;
    const radius = LOOP_ROAD / 2;
    const straight = span + LOOP_VERGE * 2;
    const arc = Math.PI * radius / 2;
    const side = straight + arc;
    return { span, radius, straight, arc, side, perim: side * 4 };
  }

  function loopPoint(distance, offset) {
    const { span, radius, straight, side, perim } = loopMetrics();
    const verge = LOOP_VERGE;
    let u = distance % perim;
    if (u < 0) u += perim;
    const seg = Math.min(3, Math.floor(u / side));
    const t = u - seg * side;
    const off = offset || 0;
    if (t < straight) {
      if (seg === 0) return { x: -verge + t, z: -verge - radius - off, yaw: Math.PI / 2 };
      if (seg === 1) return { x: span + verge + radius + off, z: -verge + t, yaw: 0 };
      if (seg === 2) return { x: span + verge - t, z: span + verge + radius + off, yaw: -Math.PI / 2 };
      return { x: -verge - radius - off, z: span + verge - t, yaw: Math.PI };
    }
    const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][seg] + (t - straight) / radius;
    const rad = radius + off;
    const cx = seg === 0 || seg === 1 ? span + verge : -verge;
    const cz = seg === 0 || seg === 3 ? -verge : span + verge;
    return {
      x: cx + rad * Math.cos(ang),
      z: cz + rad * Math.sin(ang),
      yaw: Math.atan2(-Math.sin(ang), Math.cos(ang)),
    };
  }

  function loopPose(distance, slot) {
    const local = loopPoint(distance, slot === 0 ? LOOP_LANE : -LOOP_LANE);
    return { x: shiftX + local.x, z: shiftZ + local.z, yaw: local.yaw };
  }

  function ringLine() {
    const span = CITY * CELL;
    const inset = LOOP_VERGE - LOOP_LANE;
    return { span, inset, mid: inset + TURN_R };
  }

  function placeKinematic(car, pose, speed) {
    car.px = pose.x;
    car.pz = pose.z;
    car.yaw = pose.yaw;
    car.speed = speed;
    car.body.position.set(pose.x, car.ride, pose.z);
    car.body.previousPosition.copy(car.body.position);
    car.body.aabbNeedsUpdate = true;
    car.body.quaternion.setFromAxisAngle(AXIS_Y, pose.yaw);
    car.body.velocity.set(Math.sin(pose.yaw) * speed, 0, Math.cos(pose.yaw) * speed);
    car.body.angularVelocity.set(0, 0, 0);
    car.body.wakeUp();
  }

  function placeLoop(car, speed) {
    placeKinematic(car, loopPose(car.s, car.slot), speed);
    car.dir = 1;
  }

  function leftPose(origin, radius, u) {
    const yaw = origin.yaw - u * Math.PI / 2;
    const lx = -Math.cos(origin.yaw);
    const lz = Math.sin(origin.yaw);
    const cx = origin.x + lx * radius;
    const cz = origin.z + lz * radius;
    const nlx = -Math.cos(yaw);
    const nlz = Math.sin(yaw);
    return { x: cx - nlx * radius, z: cz - nlz * radius, yaw };
  }

  function wrapS(distance) {
    const { perim } = loopMetrics();
    let s = distance % perim;
    if (s < 0) s += perim;
    return s;
  }

  function loopAhead(from, to) {
    return wrapS(to - from);
  }

  function loopSFromPose(pose) {
    const { side } = loopMetrics();
    const span = CITY * CELL;
    const x = pose.x - shiftX;
    const z = pose.z - shiftZ;
    const yaw = Math.atan2(Math.sin(pose.yaw), Math.cos(pose.yaw));
    if (yaw > Math.PI / 4 && yaw < (3 * Math.PI) / 4) return x + LOOP_VERGE;
    if (Math.abs(yaw) < Math.PI / 4) return side + (z + LOOP_VERGE);
    if (yaw < -Math.PI / 4 && yaw > (-3 * Math.PI) / 4) return 2 * side + (span + LOOP_VERGE - x);
    return 3 * side + (span + LOOP_VERGE - z);
  }

  function stemGate(car) {
    const { span, inset } = ringLine();
    if (car.axis === 'z') return { travel: car.dir > 0 ? shiftZ + span + inset : shiftZ - inset };
    return { travel: car.dir > 0 ? shiftX + span + inset : shiftX - inset };
  }

  function gateOrigin(car) {
    const gate = stemGate(car);
    const off = laneOffset(car.axis, car.slot);
    return {
      x: car.axis === 'z' ? shiftX + car.gx * CELL + off : gate.travel,
      z: car.axis === 'z' ? gate.travel : shiftZ + car.gz * CELL + off,
      yaw: yawOf(car),
      travel: gate.travel,
    };
  }

  function spotClear(x, z, self, radius) {
    const reach = radius * radius;
    for (const other of cars) {
      if (other === self || other.driven || other.loose) continue;
      const dx = other.body.position.x - x;
      const dz = other.body.position.z - z;
      if (dx * dx + dz * dz < reach) return false;
    }
    return true;
  }

  function beginJoin(car) {
    const start = gateOrigin(car);
    car.turning = true;
    car.travel = start.travel;
    car.turn = { x: start.x, z: start.z, yaw: start.yaw, radius: TURN_R, u: 0, join: true };
    car.px = start.x;
    car.pz = start.z;
    car.yaw = start.yaw;
  }

  function joinDistance(car) {
    const origin = car.turning && car.turn && car.turn.join ? car.turn : gateOrigin(car);
    return wrapS(loopSFromPose(leftPose(origin, TURN_R, 1)));
  }

  function loopLeadGap(car) {
    const { perim } = loopMetrics();
    let best = perim;
    let lead = null;
    for (const other of cars) {
      if (other === car || other.rogue || other.turning || !other.loop || other.slot !== car.slot) continue;
      let ahead = loopAhead(car.s, other.s);
      if (ahead < 0.001) {
        if (other.id > car.id) continue;
        ahead = 0;
      }
      if (ahead < best) {
        best = ahead;
        lead = other;
      }
    }
    if (!lead) return perim;
    return best - (car.kind.d + lead.kind.d) / 2;
  }

  function loosenLoop(car, dt) {
    const gap = loopLeadGap(car);
    if (gap >= 0.4) return;
    car.s = wrapS(car.s - Math.min(dt * 5, 0.5 - gap));
  }

  function loopSpeed(car) {
    const gap = loopLeadGap(car);
    const follow = 4.4;
    if (gap >= follow) return car.cruise;
    if (gap <= 0.55) return 0;
    return car.cruise * (gap - 0.55) / (follow - 0.55);
  }

  function canJoinLoop(car) {
    const s = joinDistance(car);
    const turnTime = (TURN_R * Math.PI / 2) / FLOW_SPEED;
    const close = FLOW_SPEED * turnTime + 3.4;
    for (const other of cars) {
      if (other === car || other.rogue) continue;
      if (other.turning && other.turn && other.turn.join) {
        const os = joinDistance(other);
        const need = (car.kind.d + other.kind.d) / 2 + 4.2;
        if (loopAhead(s, os) < need || loopAhead(os, s) < need) return false;
        continue;
      }
      if (!other.loop || other.turning || other.slot !== 1) continue;
      const half = (car.kind.d + other.kind.d) / 2;
      if (loopAhead(s, other.s) < half + 4.4) return false;
      if (loopAhead(other.s, s) < half + close) return false;
    }
    return true;
  }

  function holdAtGate(car) {
    const gate = stemGate(car).travel;
    const hold = gate - car.dir * 1.2;
    if ((car.travel - hold) * car.dir > 0) car.travel = hold;
    car.speed = 0;
    syncCar(car);
    car.body.velocity.set(0, 0, 0);
    car.body.angularVelocity.set(0, 0, 0);
  }

  function approachLoop(car) {
    const remain = (stemGate(car).travel - car.travel) * car.dir;
    if (remain > 1.05) return false;
    if (!canJoinLoop(car)) {
      holdAtGate(car);
      return true;
    }
    beginJoin(car);
    return true;
  }

  function loopMouths() {
    const { side } = loopMetrics();
    const { span, inset, mid } = ringLine();
    const mouths = [];
    for (let i = 0; i < CITY; i++) {
      const at = i * CELL;
      const northX = at + laneOffset('z', 0);
      const southX = at + laneOffset('z', 1);
      const eastZ = at + laneOffset('x', 0);
      const westZ = at + laneOffset('x', 1);
      mouths.push({
        s: wrapS((northX - TURN_R) + LOOP_VERGE),
        x: shiftX + northX - TURN_R,
        z: shiftZ - mid,
        yaw: Math.PI / 2,
        axis: 'z',
        slot: 0,
        gx: i,
        gz: 0,
        dir: 1,
        travel: shiftZ - inset,
      });
      mouths.push({
        s: wrapS(2 * side + (span + LOOP_VERGE - (southX + TURN_R))),
        x: shiftX + southX + TURN_R,
        z: shiftZ + span + mid,
        yaw: -Math.PI / 2,
        axis: 'z',
        slot: 1,
        gx: i,
        gz: 0,
        dir: -1,
        travel: shiftZ + span + inset,
      });
      mouths.push({
        s: wrapS(side + (westZ - TURN_R + LOOP_VERGE)),
        x: shiftX + span + mid,
        z: shiftZ + westZ - TURN_R,
        yaw: 0,
        axis: 'x',
        slot: 1,
        gx: 0,
        gz: i,
        dir: -1,
        travel: shiftX + span + inset,
      });
      mouths.push({
        s: wrapS(3 * side + (span + LOOP_VERGE - (eastZ + TURN_R))),
        x: shiftX - mid,
        z: shiftZ + eastZ + TURN_R,
        yaw: Math.PI,
        axis: 'x',
        slot: 0,
        gx: 0,
        gz: i,
        dir: 1,
        travel: shiftX - inset,
      });
    }
    return mouths;
  }

  function mouthBetween(prev, next) {
    const span = loopAhead(prev, next);
    if (span <= 0.0001) return null;
    let best = null;
    let bestD = Infinity;
    for (const mouth of loopMouths()) {
      const d = loopAhead(prev, mouth.s);
      if (d <= span && d < bestD) {
        best = mouth;
        bestD = d;
      }
    }
    return best;
  }

  function laneClear(mouth, self) {
    for (const other of cars) {
      if (other === self || other.loop || other.rogue || other.turning) continue;
      if (other.axis !== mouth.axis || other.slot !== mouth.slot) continue;
      if (mouth.axis === 'z' ? other.gx !== mouth.gx : other.gz !== mouth.gz) continue;
      const gap = Math.abs(other.travel - mouth.travel) - other.kind.d / 2 - 3.4;
      if (gap < 5) return false;
    }
    return true;
  }

  function canLeave(car, mouth) {
    if (!laneClear(mouth, car)) return false;
    const end = leftPose(mouth, TURN_R, 1);
    const mid = leftPose(mouth, TURN_R, 0.5);
    if (!spotClear(end.x, end.z, car, 3.6)) return false;
    return spotClear(mid.x, mid.z, car, 3.2);
  }

  function beginLeave(car, mouth) {
    car.turning = true;
    car.loop = false;
    car.turn = {
      x: mouth.x,
      z: mouth.z,
      yaw: mouth.yaw,
      radius: TURN_R,
      u: 0,
      join: false,
      axis: mouth.axis,
      slot: mouth.slot,
      gx: mouth.gx,
      gz: mouth.gz,
      dir: mouth.dir,
      travel: mouth.travel,
    };
  }

  function finishJoin(car, pose) {
    car.turning = false;
    car.turn = null;
    car.loop = true;
    car.roam = true;
    car.slot = 1;
    car.dir = 1;
    car.cruise = FLOW_SPEED;
    car.looped = 0;
    car.leaveAfter = 46 + Math.random() * 70;
    car.s = wrapS(loopSFromPose(pose));
    placeLoop(car, car.cruise);
  }

  function finishLeave(car) {
    const turn = car.turn;
    car.turning = false;
    car.loop = false;
    car.roam = false;
    car.axis = turn.axis;
    car.slot = turn.slot;
    car.gx = turn.gx;
    car.gz = turn.gz;
    car.dir = turn.dir;
    car.travel = turn.travel;
    car.cruise = FLOW_SPEED;
    car.speed = turn.dir * FLOW_SPEED;
    car.turn = null;
    syncCar(car);
    car.px = car.body.position.x;
    car.pz = car.body.position.z;
    car.yaw = yawOf(car);
  }

  function driveTurn(car, dt) {
    const speed = car.cruise;
    const arc = car.turn.radius * Math.PI / 2;
    car.turn.u = Math.min(1, car.turn.u + (speed * dt) / arc);
    const pose = leftPose(car.turn, car.turn.radius, car.turn.u);
    placeKinematic(car, pose, speed);
    if (car.turn.u < 1) return;
    if (car.turn.join) finishJoin(car, pose);
    else finishLeave(car);
  }

  function driveLoop(car, dt) {
    loosenLoop(car, dt);
    const speed = loopSpeed(car);
    const step = speed * dt;
    let next = car.s + step;
    const { perim } = loopMetrics();
    if (next >= perim) next -= perim;
    if (car.roam && (car.looped || 0) >= (car.leaveAfter || 0)) {
      const mouth = mouthBetween(car.s, next);
      if (mouth && canLeave(car, mouth)) {
        beginLeave(car, mouth);
        return;
      }
    }
    car.s = next;
    if (car.roam) car.looped = (car.looped || 0) + step;
    placeLoop(car, speed);
  }

  function respawnTravel(axis, slot, travel) {
    const dir = slot === 0 ? 1 : -1;
    const gate = stemGate({ axis, dir }).travel;
    const remain = (gate - travel) * dir;
    if (remain > 8) return travel;
    return gate - dir * (14 + Math.random() * 12);
  }

  function spawnLoopCar(slot, distance) {
    const pose = loopPose(distance, slot);
    const home = districtAt(pose.x, pose.z);
    const kind = fleetKind(home, (distance * 10) | 0);
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      material: carMat,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
      allowSleep: false,
      fixedRotation: true,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(kind.w / 2, kind.h / 2, kind.d / 2)));
    body.angularFactor.set(0, 0, 0);
    body.gameRole = 'car';
    const mesh = buildCar(kind, fleetPaint(home, kind));
    carRoot.add(mesh);
    const car = {
      id: nextCarId++,
      axis: 'loop',
      home,
      slot,
      gx: 0,
      gz: 0,
      travel: 0,
      s: distance,
      dir: 1,
      cruise: FLOW_SPEED,
      speed: FLOW_SPEED,
      kind,
      ride: GROUND_Y + kind.h / 2 + 0.05,
      body,
      mesh,
      cool: 0,
      honkAt: 0,
      spin: Math.random() * 6,
      loop: true,
      px: pose.x,
      pz: pose.z,
      yaw: pose.yaw,
    };
    body.addEventListener('collide', (event) => {
      const other = event.body;
      if (!running || !other || other.gameRole !== 'ragdoll') return;
      if (weapons.chopping()) return;
      smack(car, other);
    });
    addBody(body);
    driveLoop(car, 0);
    cars.push(car);
    return car;
  }

  function reviveLoop(slot, along, roam) {
    const born = spawnLoopCar(slot, (along || 0) + 52);
    if (!roam) return born;
    born.roam = true;
    born.looped = 0;
    born.leaveAfter = 36 + Math.random() * 90;
    return born;
  }

  function spawnLoop() {
    const { perim } = loopMetrics();
    const count = 2;
    const gap = perim / count;
    for (const slot of [0, 1]) {
      for (let i = 0; i < count; i++) spawnLoopCar(slot, i * gap + slot * gap * 0.5);
    }
  }

  function spawnTraffic() {
    for (let i = 0; i < CITY; i++) {
      for (let n = 0; n < CITY - 1; n++) {
        const zSouth = (i + n) % CITY;
        const zNorth = (i + n + 2) % CITY;
        const xEast = (i + n + 1) % CITY;
        const xFar = (i + n + 3) % CITY;
        spawnCar('z', 0, i, 0, blockTravel('z', shiftZ, zSouth), districtId(i, zSouth));
        spawnCar('z', 1, i, 0, blockTravel('z', shiftZ, zNorth), districtId(i, zNorth));
        spawnCar('x', 0, 0, i, blockTravel('x', shiftX, xEast), districtId(xEast, i));
        spawnCar('x', 1, 0, i, blockTravel('x', shiftX, xFar), districtId(xFar, i));
      }
    }
    holdLanes();
    untangle();
    spawnLoop();
    for (const car of cars) if (!car.loop) syncCar(car);
  }

  function bounds() {
    let minGx = Infinity;
    let maxGx = -Infinity;
    let minGz = Infinity;
    let maxGz = -Infinity;
    for (const tile of tiles) {
      minGx = Math.min(minGx, tile.gx);
      maxGx = Math.max(maxGx, tile.gx);
      minGz = Math.min(minGz, tile.gz);
      maxGz = Math.max(maxGz, tile.gz);
    }
    const lip = 5;
    return {
      minX: shiftX + minGx * CELL + lip,
      maxX: shiftX + (maxGx + 1) * CELL - lip,
      minZ: shiftZ + minGz * CELL + lip,
      maxZ: shiftZ + (maxGz + 1) * CELL - lip,
    };
  }

  function actorPoints() {
    const points = [];
    for (const doll of actors) {
      if (indoors.has(doll)) continue;
      const body = doll.walking() ? doll.mover() : doll.torso.body;
      if (body) points.push(body.position);
    }
    return points;
  }

  function recenter() {
    const points = actorPoints();
    if (!points.length) return null;
    let ax = 0;
    let az = 0;
    for (const point of points) {
      ax += point.x;
      az += point.z;
    }
    ax /= points.length;
    az /= points.length;
    let dx = 0;
    let dz = 0;
    if (ax > 40 || ax < -40) dx = -ax;
    if (az > 40 || az < -40) dz = -az;
    if (!dx && !dz) return null;
    shiftX += dx;
    shiftZ += dz;
    for (const doll of actors) {
      if (indoors.has(doll)) continue;
      for (const part of doll.parts) {
        part.body.position.x += dx;
        part.body.position.z += dz;
        part.body.previousPosition.copy(part.body.position);
      }
      doll.shiftWalker(dx, dz);
    }
    for (const car of cars) {
      if (car.turning) {
        car.turn.x += dx;
        car.turn.z += dz;
        if (car.turn.travel != null) car.turn.travel += car.turn.axis === 'x' ? dx : dz;
        car.px += dx;
        car.pz += dz;
        car.body.position.x += dx;
        car.body.position.z += dz;
        car.body.previousPosition.copy(car.body.position);
        if (car.axis === 'x') car.travel += dx;
        else if (car.axis !== 'loop') car.travel += dz;
      } else if (car.loop && !car.rogue) {
        const pose = loopPose(car.s, car.slot);
        car.px = pose.x;
        car.pz = pose.z;
        car.yaw = pose.yaw;
        car.body.position.set(pose.x, car.ride, pose.z);
        car.body.previousPosition.copy(car.body.position);
        car.body.quaternion.setFromAxisAngle(AXIS_Y, pose.yaw);
      } else if (car.rogue) {
        car.px += dx;
        car.pz += dz;
        car.aimX += dx;
        car.aimZ += dz;
        car.body.position.x += dx;
        car.body.position.z += dz;
        car.body.previousPosition.copy(car.body.position);
      } else if (car.axis === 'x') car.travel += dx;
      else car.travel += dz;
    }
    for (const item of junk) {
      item.body.position.x += dx;
      item.body.position.z += dz;
      item.body.previousPosition.copy(item.body.position);
    }
    weapons.shift(dx, dz);
    shiftJail(dx, dz);
    campX += dx;
    campZ += dz;
    prey.x += dx;
    prey.z += dz;
    for (const tile of tiles) syncTile(tile);
    syncDistrict();
    return { dx, dz };
  }

  function syncDistrict() {
    if (ground && ground.lx != null) {
      ground.position.set(shiftX + ground.lx, ground.ly, shiftZ + ground.lz);
      ground.previousPosition.copy(ground.position);
      ground.aabbNeedsUpdate = true;
    }
    if (!district) return;
    district.position.set(shiftX, 0, shiftZ);
    for (const entry of districtBodies) {
      entry.body.position.set(shiftX + entry.lx, entry.ly, shiftZ + entry.lz);
      entry.body.previousPosition.copy(entry.body.position);
      entry.body.aabbNeedsUpdate = true;
    }
  }

  function addDistrictWall(w, h, d, lx, ly, lz, material = concreteMat) {
    const mesh = new THREE.Mesh(box, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(lx, ly, lz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    district.add(mesh);
    const body = new CANNON.Body({
      mass: 0,
      material: buildingMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    body.position.set(shiftX + lx, ly, shiftZ + lz);
    body.gameRole = 'static';
    addBody(body);
    districtBodies.push({ body, lx, ly, lz });
  }

  function deck(x, z, w, d, material = asphalt, y = GROUND_Y + 0.03) {
    const mesh = new THREE.Mesh(plane, material);
    mesh.scale.set(w, d, 1);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    district.add(mesh);
  }

  function frameDeck(material, inner, outer, y) {
    const span = CITY * CELL;
    const depth = outer - inner;
    const mid = (inner + outer) / 2;
    deck(span / 2, -mid, span + outer * 2, depth, material, y);
    deck(span / 2, span + mid, span + outer * 2, depth, material, y);
    deck(-mid, span / 2, depth, span + inner * 2, material, y);
    deck(span + mid, span / 2, depth, span + inner * 2, material, y);
  }

  function addStrip(w, h, d, x, y, z, material, shadow = false) {
    const mesh = new THREE.Mesh(box, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    district.add(mesh);
  }

  function addDash(x, z, yaw, len, wid, material) {
    const mesh = new THREE.Mesh(box, material);
    mesh.scale.set(wid, 0.028, len);
    mesh.position.set(x, GROUND_Y + 0.08, z);
    mesh.rotation.y = yaw;
    mesh.receiveShadow = true;
    district.add(mesh);
  }

  function coastTree(x, z, scale) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, GROUND_Y + 0.55 * scale, z);
    trunk.scale.setScalar(scale);
    const crown = new THREE.Mesh(crownGeo, treeMat);
    crown.position.set(x, GROUND_Y + 1.28 * scale, z);
    crown.scale.setScalar(scale * 1.2);
    district.add(trunk, crown);
  }

  function addLamp(x, z) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, GROUND_Y + 1.15, z);
    pole.castShadow = true;
    const head = new THREE.Mesh(box, lampMat);
    head.scale.set(0.62, 0.12, 0.32);
    head.position.set(x, GROUND_Y + 2.38, z);
    district.add(pole, head);
  }

  function walkRim(dist, step, visit) {
    const span = CITY * CELL;
    const sides = [
      [-dist, -dist, span + dist, -dist],
      [span + dist, -dist, span + dist, span + dist],
      [span + dist, span + dist, -dist, span + dist],
      [-dist, span + dist, -dist, -dist],
    ];
    for (const [ax, az, bx, bz] of sides) {
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz) || 1;
      for (let t = step * 0.45; t < len - 0.3; t += step) {
        visit(ax + dx * (t / len), az + dz * (t / len), ax, az, bx, bz);
      }
    }
  }

  function addFenceSide(x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz) || 1;
    const ux = dx / length;
    const uz = dz / length;
    const rail = 7.2;
    const gap = 2.6;
    const alongX = Math.abs(dx) >= Math.abs(dz);
    for (let at = 0.35; at + rail < length - 0.15; at += rail + gap) {
      const mid = at + rail / 2;
      const x = x0 + ux * mid;
      const z = z0 + uz * mid;
      if (alongX) addDistrictWall(rail, 0.11, 0.14, x, GROUND_Y + 0.98, z, fenceMat);
      else addDistrictWall(0.14, 0.11, rail, x, GROUND_Y + 0.98, z, fenceMat);
      if (alongX) addStrip(rail, 0.09, 0.11, x, GROUND_Y + 0.46, z, fenceMat, true);
      else addStrip(0.11, 0.09, rail, x, GROUND_Y + 0.46, z, fenceMat, true);
    }
    for (let at = 0.15; at < length - 0.05; at += 2.4) {
      const post = new THREE.Mesh(postGeo, fencePost);
      post.position.set(x0 + ux * at, GROUND_Y + 0.56, z0 + uz * at);
      district.add(post);
    }
  }

  function streetAt(index) {
    return index * CELL;
  }

  function inStem(x, z) {
    const span = CITY * CELL;
    const pad = 1.15;
    const verge = LOOP_VERGE + 0.7;
    for (let i = 0; i < CITY; i++) {
      const a = streetAt(i) - pad;
      const b = streetAt(i) + ROAD + pad;
      if (x > a && x < b && ((z < 0.5 && z > -verge) || (z > span - 0.5 && z < span + verge))) return true;
      if (z > a && z < b && ((x < 0.5 && x > -verge) || (x > span - 0.5 && x < span + verge))) return true;
    }
    return false;
  }

  function mouthOpening(x, z) {
    const span = CITY * CELL;
    const near = LOOP_VERGE + LOOP_ROAD * 0.58;
    for (let i = 0; i < CITY; i++) {
      const a = streetAt(i) - 0.35;
      const b = streetAt(i) + ROAD + 0.35;
      if (x > a && x < b && z < 0.2 && z > -near) return true;
      if (x > a && x < b && z > span - 0.2 && z < span + near) return true;
      if (z > a && z < b && x < 0.2 && x > -near) return true;
      if (z > a && z < b && x > span - 0.2 && x < span + near) return true;
    }
    return false;
  }

  function addTeeSignal(px, pz, stem, loop) {
    const poleH = 2.3 * 1.75;
    const group = new THREE.Group();
    group.position.set(px, GROUND_Y + poleH / 2, pz);
    const mast = new THREE.Mesh(poleGeo, poleMat);
    mast.scale.set(0.9, 1.75, 0.9);
    mast.castShadow = true;
    group.add(mast);
    const top = poleH / 2 - 0.08;
    const arm = (dx, dz, lenses) => {
      const len = Math.hypot(dx, dz);
      const bar = new THREE.Mesh(box, signalMat);
      if (Math.abs(dx) >= Math.abs(dz)) bar.scale.set(len, 0.1, 0.12);
      else bar.scale.set(0.12, 0.1, len);
      bar.position.set(dx / 2, top, dz / 2);
      group.add(bar);
      addSignalHead(group, lenses, dx, top - 0.62, dz);
    };
    arm(stem.x, stem.z, stemLens);
    arm(loop.x, loop.z, loopLens);
    district.add(group);
    addStrip(1.05, 0.07, 1.05, px, GROUND_Y + 0.05, pz, sidewalkMat);
  }

  function addStopBar(x, z, alongZ) {
    addDash(x, z, alongZ ? 0 : Math.PI / 2, ROAD - 1.15, 0.34, white);
  }

  function addMouthCrosswalk(x, z, alongZ) {
    const count = 5;
    const bar = 0.4;
    const gap = 0.34;
    const span = count * bar + (count - 1) * gap;
    let cursor = -span / 2 + bar / 2;
    for (let i = 0; i < count; i++) {
      if (alongZ) addDash(x + cursor, z, 0, 1.25, bar, white);
      else addDash(x, z + cursor, Math.PI / 2, 1.25, bar, white);
      cursor += bar + gap;
    }
  }

  function paveMouth(cx, cz, w, d) {
    addStrip(w, 0.05, d, cx, GROUND_Y + 0.045, cz, asphalt);
  }

  function buildMouths() {
    const span = CITY * CELL;
    const lip = 0.55;
    const depth = LOOP_VERGE + lip + 0.12;
    const stem = 2.45;
    const loopArm = 2.35;
    for (let i = 0; i < CITY; i++) {
      const x0 = streetAt(i);
      const z0 = streetAt(i);
      const cx = x0 + ROAD / 2;
      const cz = z0 + ROAD / 2;
      const southZ = (-LOOP_VERGE - lip + 0.12) / 2;
      const northZ = span + (LOOP_VERGE + lip - 0.12) / 2;
      const westX = (-LOOP_VERGE - lip + 0.12) / 2;
      const eastX = span + (LOOP_VERGE + lip - 0.12) / 2;
      paveMouth(cx, southZ, ROAD, depth);
      paveMouth(cx, northZ, ROAD, depth);
      paveMouth(westX, cz, depth, ROAD);
      paveMouth(eastX, cz, depth, ROAD);

      const stop = LOOP_VERGE - LOOP_LANE;
      const walk = LOOP_VERGE - 1.2;
      addStopBar(cx, -stop, false);
      addMouthCrosswalk(cx, -walk, true);
      addStopBar(cx, span + stop, false);
      addMouthCrosswalk(cx, span + walk, true);
      addStopBar(-stop, cz, true);
      addMouthCrosswalk(-walk, cz, false);
      addStopBar(span + stop, cz, true);
      addMouthCrosswalk(span + walk, cz, false);

      addTeeSignal(x0 - 0.62, -LOOP_VERGE + 0.55, { x: stem, z: 0 }, { x: 0, z: -loopArm });
      addTeeSignal(x0 + ROAD + 0.62, span + LOOP_VERGE - 0.55, { x: -stem, z: 0 }, { x: 0, z: loopArm });
      addTeeSignal(-LOOP_VERGE + 0.55, z0 + ROAD + 0.62, { x: 0, z: -stem }, { x: -loopArm, z: 0 });
      addTeeSignal(span + LOOP_VERGE - 0.55, z0 - 0.62, { x: 0, z: stem }, { x: loopArm, z: 0 });
    }
  }

  function buildDistrict() {
    destroyDistrict();
    district = new THREE.Group();
    root.add(district);
    const { span, reach, fence } = coastLayout();
    const waterY = GROUND_Y - WATER_DROP;
    const roadOuter = LOOP_VERGE + LOOP_ROAD;

    frameDeck(grassMat, 0, LOOP_VERGE, GROUND_Y + 0.02);
    frameDeck(asphalt, LOOP_VERGE, roadOuter, GROUND_Y + 0.045);
    frameDeck(sidewalkMat, roadOuter, fence, GROUND_Y + 0.03);
    frameDeck(grassMat, fence, reach - 1.45, GROUND_Y + 0.02);
    frameDeck(sandMat, reach - 1.45, reach, GROUND_Y + 0.028);

    buildMouths();

    const { perim } = loopMetrics();
    for (let s = 0; s < perim; s += 5.4) {
      const mid = loopPoint(s, 0);
      if (mouthOpening(mid.x, mid.z)) continue;
      addDash(mid.x, mid.z, mid.yaw, 1.7, 0.16, white);
    }
    for (let s = 0; s < perim; s += 2.35) {
      for (const off of [LOOP_ROAD / 2 - 0.38, -(LOOP_ROAD / 2 - 0.38)]) {
        const edge = loopPoint(s, off);
        if (mouthOpening(edge.x, edge.z)) continue;
        addDash(edge.x, edge.z, edge.yaw, 2.2, 0.14, white);
      }
    }

    addFenceSide(-fence, -fence, span + fence, -fence);
    addFenceSide(span + fence, -fence, span + fence, span + fence);
    addFenceSide(span + fence, span + fence, -fence, span + fence);
    addFenceSide(-fence, span + fence, -fence, -fence);

    walkRim(LOOP_VERGE * 0.55, 14, (x, z) => {
      if (inStem(x, z)) return;
      coastTree(x + rand(-0.4, 0.4), z + rand(-0.4, 0.4), rand(0.85, 1.25));
    });
    walkRim(fence + 3.5, 9.5, (x, z, ax, az, bx, bz) => {
      const jx = Math.abs(bx - ax) > 1 ? 0 : rand(-0.8, 0.8);
      const jz = Math.abs(bz - az) > 1 ? 0 : rand(-0.8, 0.8);
      coastTree(x + jx, z + jz, rand(0.95, 1.45));
    });
    walkRim(fence - 1.05, 26, (x, z) => addLamp(x, z));
    walkRim(reach - 0.85, 7.5, (x, z) => {
      if (Math.random() < 0.45) return;
      const rock = new THREE.Mesh(crownGeo, rockMat);
      rock.scale.set(rand(0.35, 0.7), rand(0.16, 0.32), rand(0.3, 0.6));
      rock.position.set(x + rand(-0.4, 0.4), GROUND_Y + 0.08, z + rand(-0.4, 0.4));
      district.add(rock);
    });

    const sea = new THREE.Mesh(new THREE.CircleGeometry(260, 72), oceanMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(span / 2, waterY + 0.05, span / 2);
    district.add(sea);
    const foamW = span + reach * 2 + 8;
    deck(span / 2, -reach - 1.7, foamW, 2.8, foamMat, waterY + 0.1);
    deck(span / 2, span + reach + 1.7, foamW, 2.8, foamMat, waterY + 0.1);
    deck(-reach - 1.7, span / 2, 2.8, span + reach * 2, foamMat, waterY + 0.1);
    deck(span + reach + 1.7, span / 2, 2.8, span + reach * 2, foamMat, waterY + 0.1);

    const cliffH = WATER_DROP;
    const cliffT = 3.6;
    const cliffY = waterY + cliffH / 2;
    const face = span + reach * 2;
    const wetH = cliffH * 0.38;
    const wetY = waterY + wetH / 2;
    addStrip(face + cliffT * 2, cliffH, cliffT, span / 2, cliffY, -reach - cliffT / 2, rockMat);
    addStrip(face + cliffT * 2, cliffH, cliffT, span / 2, cliffY, span + reach + cliffT / 2, rockMat);
    addStrip(cliffT, cliffH, face, -reach - cliffT / 2, cliffY, span / 2, rockMat);
    addStrip(cliffT, cliffH, face, span + reach + cliffT / 2, cliffY, span / 2, rockMat);
    addStrip(face + cliffT * 2, wetH, cliffT + 0.35, span / 2, wetY, -reach - cliffT / 2 - 0.12, rockWet);
    addStrip(face + cliffT * 2, wetH, cliffT + 0.35, span / 2, wetY, span + reach + cliffT / 2 + 0.12, rockWet);
    addStrip(cliffT + 0.35, wetH, face, -reach - cliffT / 2 - 0.12, wetY, span / 2, rockWet);
    addStrip(cliffT + 0.35, wetH, face, span + reach + cliffT / 2 + 0.12, wetY, span / 2, rockWet);

    const nestX = ROAD + WALK * 0.5;
    const nestZ = (CELL + ROAD) * 0.5;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1.7, 20), signMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(nestX, GROUND_Y + 0.08, nestZ);
    pad.receiveShadow = true;
    district.add(pad);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(nestX + 1.55, GROUND_Y + 1.15, nestZ);
    pole.castShadow = true;
    district.add(pole);
    const stamp = document.createElement('canvas');
    stamp.width = 256;
    stamp.height = 96;
    const draw = stamp.getContext('2d');
    draw.fillStyle = '#ffe14a';
    draw.fillRect(0, 0, 256, 96);
    draw.strokeStyle = '#1b1b1b';
    draw.lineWidth = 10;
    draw.strokeRect(6, 6, 244, 84);
    draw.fillStyle = '#1b1b1b';
    draw.font = '700 54px Fredoka, sans-serif';
    draw.textAlign = 'center';
    draw.textBaseline = 'middle';
    draw.fillText('NEST', 128, 52);
    const map = new THREE.CanvasTexture(stamp);
    map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
    sign.position.set(nestX + 1.55, GROUND_Y + 2.45, nestZ);
    sign.scale.set(1.8, 0.68, 1);
    district.add(sign);
    syncDistrict();
  }

  function destroyDistrict() {
    for (const entry of districtBodies) removeBody(entry.body);
    districtBodies.length = 0;
    if (!district) return;
    district.traverse((obj) => {
      const shared = obj.geometry === box || obj.geometry === plane || obj.geometry === poleGeo
        || obj.geometry === postGeo || obj.geometry === crownGeo || obj.geometry === trunkGeo;
      if (obj.geometry && !shared) obj.geometry.dispose();
      const material = obj.material;
      const kept = material === concreteMat || material === asphalt || material === yellow || material === white
        || material === signMat || material === poleMat || material === grassMat || material === sidewalkMat
        || material === sandMat || material === rockMat || material === rockWet || material === foamMat
        || material === oceanMat || material === fenceMat || material === fencePost || material === treeMat
        || material === trunkMat || material === lampMat;
      if (!material || kept) return;
      if (material.map) material.map.dispose();
      material.dispose();
    });
    district.removeFromParent();
    district = null;
  }

  function containActors() {
    if (mirror) return;
    const water = GROUND_Y - WATER_DROP + 1.1;
    for (const doll of actors) {
      if (indoors.has(doll) || pilotOf(doll)) continue;
      const body = doll.walking() ? doll.mover() : doll.torso.body;
      if (!body || body.position.y > water) continue;
      const wetDistrict = districtAt(body.position.x, body.position.z);
      const spot = islandClamp(body.position.x, body.position.z, 2.4);
      if (doll.walking()) {
        const walker = doll.mover();
        walker.position.set(spot.x, GROUND_Y + 1.35, spot.z);
        walker.previousPosition.copy(walker.position);
        walker.velocity.set(walker.velocity.x * 0.15, 5.2, walker.velocity.z * 0.15);
        walker.wakeUp();
      } else {
        const dx = spot.x - body.position.x;
        const dy = (GROUND_Y + 1.5) - body.position.y;
        const dz = spot.z - body.position.z;
        for (const part of doll.parts) {
          part.body.position.x += dx;
          part.body.position.y += dy;
          part.body.position.z += dz;
          part.body.previousPosition.copy(part.body.position);
          part.body.velocity.x *= 0.15;
          part.body.velocity.y = 5.2;
          part.body.velocity.z *= 0.15;
          part.body.wakeUp();
        }
      }
      onEvent({
        callout: 'SPLASH!',
        shake: 0.16,
        pos: { x: spot.x, y: GROUND_Y + 1.2, z: spot.z },
        burst: 'chip',
        who: doll,
        unlock: wetDistrict === 'harbor' && doll === ragdoll ? 'overboard' : '',
      });
    }
  }

  function corner() {
    return {
      x: shiftX + ROAD + WALK * 0.5,
      z: shiftZ + (CELL + ROAD) * 0.5,
    };
  }

  function clear() {
    running = false;
    for (const car of cars) {
      if (!car.pilot) continue;
      const doll = car.pilot;
      car.pilot = null;
      car.driven = false;
      if (doll.walking()) unpinDoll(doll);
    }
    ride = null;
    if (ragdoll.walking()) freeMover();
    gas = 0;
    wheel = 0;
    offer = false;
    entryMemory.clear();
    destroyRoom();
    if (parked) resumeCity();
    bust = null;
    hauls = [];
    suspects = [];
    wanted = false;
    grace = 0;
    bashCool = 0;
    destroyJail();
    root.visible = false;
    for (const tile of tiles) {
      for (const entry of tile.bodies) removeBody(entry.body);
      tile.group.clear();
    }
    tiles.length = 0;
    tileRoot.clear();
    for (const car of cars) removeBody(car.body);
    cars.length = 0;
    carRoot.clear();
    for (const item of junk) {
      removeBody(item.body);
      item.mesh.removeFromParent();
    }
    junk.length = 0;
    junkRoot.clear();
    waveQueue.length = 0;
    waveReadyAt = 0;
    weapons.clear();
    destroyDistrict();
    if (ground) removeBody(ground);
    ground = null;
    shiftX = 0;
    shiftZ = 0;
    hits = 0;
    seenDistrict = '';
    tallies.meter = 0;
    tallies.cart = 0;
    tallies.balloon = 0;
    stillTime = 0;
    campSet = false;
    prey.still = false;
    indoors.clear();
    roomReturn.clear();
    roomGraceDolls.clear();
    entryLock.clear();
    gateQueue.length = 0;
    viewerInside = false;
    parked = false;
  }

  function begin() {
    clear();
    running = true;
    root.visible = true;
    ground = new CANNON.Body({
      mass: 0,
      material: groundMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    const coast = coastLayout();
    const half = coast.span / 2 + coast.reach;
    ground.addShape(new CANNON.Box(new CANNON.Vec3(half, 0.5, half)));
    ground.lx = coast.span / 2;
    ground.ly = GROUND_Y - 0.5;
    ground.lz = coast.span / 2;
    ground.position.set(ground.lx, ground.ly, ground.lz);
    ground.gameRole = 'static';
    addBody(ground);

    for (let gx = 0; gx < CITY; gx++) {
      for (let gz = 0; gz < CITY; gz++) {
        const tile = { gx, gz, group: new THREE.Group(), bodies: [] };
        tileRoot.add(tile.group);
        tiles.push(tile);
        placeTile(tile, gx, gz);
      }
    }
    buildDistrict();
    spawnTraffic();
    seenDistrict = 'main';
    prepareJail();
    const spawn = {
      x: ROAD + WALK * 0.5,
      z: (CELL + ROAD) * 0.5,
    };
    seedWeapons(spawn);
    return spawn;
  }

  function respawn(pos) {
    const gx = clamp(Math.floor((pos.x - shiftX) / CELL), 0, CITY - 1);
    const gz = clamp(Math.floor((pos.z - shiftZ) / CELL), 0, CITY - 1);
    return {
      x: shiftX + gx * CELL + ROAD + WALK * 0.5,
      z: shiftZ + gz * CELL + (CELL + ROAD) * 0.5,
    };
  }

  function armKey(doll) {
    return doll === ragdoll ? 'local' : doll;
  }

  function handOf(doll) {
    for (const part of doll.parts) {
      if (part.name === 'handR') return part.body;
    }
    return null;
  }

  function birdTag(doll) {
    return `bird:${doll.torso.body.id}`;
  }

  function birdSpots(doll) {
    if (doll.walking()) {
      const p = doll.mover().position;
      return [
        { x: p.x, y: p.y + 0.15, z: p.z, r: 0.62, part: 'body' },
        { x: p.x, y: p.y + 0.95, z: p.z, r: 0.4, part: 'head' },
      ];
    }
    const spots = [];
    for (const part of doll.parts) {
      if (part.name !== 'torso' && part.name !== 'head') continue;
      const p = part.body.position;
      spots.push({
        x: p.x,
        y: p.y,
        z: p.z,
        r: part.name === 'head' ? 0.38 : 0.58,
        part: part.name,
      });
    }
    return spots;
  }

  function birdTouch(doll, x, y, z) {
    let found = '';
    for (const spot of birdSpots(doll)) {
      const dx = spot.x - x;
      const dy = spot.y - y;
      const dz = spot.z - z;
      if (dx * dx + dy * dy + dz * dz > spot.r * spot.r) continue;
      if (spot.part === 'head') return 'head';
      found = spot.part;
    }
    return found;
  }

  function birdCenter(doll) {
    const p = doll.walking() ? doll.mover().position : doll.torso.body.position;
    return { x: p.x, y: p.y + 0.4, z: p.z };
  }

  function launchBird(doll, grip, power, part) {
    if (pilotOf(doll)) hopOutDoll(doll);
    const at = birdCenter(doll);
    const word = part === 'head' ? 'BEAK!' : power.callout;
    hits += 1;
    onEvent({
      hit: true,
      who: doll,
      style: {
        dirX: grip.dx,
        dirZ: grip.dz,
        shove: Math.min(16, 5.5 + (power.knock || 1) * 4.2),
        spin: 2.8 + (power.spin || 1) * 3.2,
        spinScale: 0.12,
        maxSpin: 20,
        minUp: 1.4 + (power.lift || 1) * 2.2,
        spread: 0.8 + (power.knock || 1) * 0.35,
        yJitter: 1.3,
        wobble: 3.5 + (power.spin || 1) * 1.6,
      },
      callout: word,
      flair: word,
      score: Math.round(32 * (power.score || 1) * (part === 'head' ? 1.35 : 1)),
      impact: part === 'head' ? 11 : 7,
      pos: { x: at.x, y: at.y + 0.45, z: at.z },
      burst: 'feather',
      shake: 0.18 * (power.shake || 1),
      bawk: true,
    });
  }

  function dropSpot(gx, gz) {
    const h = hash(gx, gz);
    const x0 = shiftX + gx * CELL;
    const z0 = shiftZ + gz * CELL;
    if ((h & 1) === 0) return { x: x0 + 9.4, z: z0 + 13 + (h % 8) };
    return { x: x0 + 15 + (h % 7), z: z0 + 9.4 };
  }

  function seedWeapons(origin) {
    const n = weapons.variety();
    const welcome = [
      { x: origin.x, z: origin.z - 3.4, index: 0 },
      { x: origin.x, z: origin.z + 4.2, index: 1 },
      { x: origin.x + 7.4, z: origin.z - 7.6, index: 2 },
      { x: origin.x + 13, z: origin.z - 7.6, index: 3 },
    ];
    for (const spot of welcome) weapons.spawn(spot.x, spot.z, spot.index % n);
    for (let gx = 0; gx < CITY; gx++) {
      for (let gz = 0; gz < CITY; gz++) {
        if (gx === 0 && gz === 0) continue;
        const spot = dropSpot(gx, gz);
        weapons.spawn(spot.x, spot.z, hash(gx, gz) % n);
      }
    }
  }

  function refillWeapons(px, pz) {
    weapons.cull(px, pz, CITY * CELL * 2);
    const n = weapons.variety();
    let guard = 0;
    while (weapons.count() < 16 && guard < 28) {
      guard += 1;
      const gx = clamp(Math.floor((px - shiftX) / CELL) + ((Math.random() * 5) | 0) - 2, 0, CITY - 1);
      const gz = clamp(Math.floor((pz - shiftZ) / CELL) + ((Math.random() * 5) | 0) - 2, 0, CITY - 1);
      const spot = dropSpot(gx, gz);
      const dx = spot.x - px;
      const dz = spot.z - pz;
      const d2 = dx * dx + dz * dz;
      if (d2 < 7 * 7 || d2 > 48 * 48) continue;
      if (weapons.near(spot.x, spot.z, 4.2)) continue;
      weapons.spawn(spot.x, spot.z, (hash(gx, gz) + guard) % n);
    }
  }

  function trimJunk() {
    const fresh = performance.now() - 8000;
    while (junk.length > JUNK_CAP) {
      let index = junk.findIndex((item) => !item.roadkill && !item.prize);
      if (index < 0) index = junk.findIndex((item) => item.prize && item.born < fresh);
      if (index < 0) index = junk.findIndex((item) => !item.roadkill);
      if (index < 0) index = 0;
      const old = junk.splice(index, 1)[0];
      removeBody(old.body);
      old.mesh.removeFromParent();
    }
  }

  function spawnDebris(x, y, z, color) {
    const body = new CANNON.Body({
      mass: 0.7,
      material: toyMat,
      linearDamping: 0.08,
      angularDamping: 0.14,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.18, 0.12, 0.28)));
    body.position.set(x, y, z);
    body.velocity.set(rand(-8, 8), rand(7, 13), rand(-8, 8));
    body.angularVelocity.set(rand(-10, 10), rand(-10, 10), rand(-10, 10));
    addBody(body);
    const mesh = new THREE.Mesh(box, paintOf(color));
    mesh.scale.set(0.36, 0.24, 0.56);
    mesh.castShadow = true;
    junkRoot.add(mesh);
    junk.push({ body, mesh, rubble: true, pad: 0.4 });
    trimJunk();
  }

  function bladeHits(car, x, y, z) {
    const dx = x - car.body.position.x;
    const dy = y - car.body.position.y;
    const dz = z - car.body.position.z;
    const yaw = yawOf(car);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const lx = c * dx - s * dz;
    const lz = s * dx + c * dz;
    const pad = 0.5;
    return Math.abs(lx) < car.kind.w / 2 + pad
      && Math.abs(lz) < car.kind.d / 2 + pad
      && Math.abs(dy) < car.kind.h / 2 + 0.6;
  }

  function explodeCar(car, power = {}) {
    const p = car.body.position;
    const color = car.kind.colors[0];
    const word = power.callout || 'BOOM!';
    onEvent({
      callout: word,
      flair: word,
      shake: 0.66 * (power.shake || 1),
      score: 55 * (power.score || 1),
      impact: 18,
      pos: { x: p.x, y: p.y + 0.5, z: p.z },
      burst: power.burst || 'boom',
      boom: power.burst !== 'zap',
    });
    const chunks = power.chunks || 6;
    for (let i = 0; i < chunks; i++) {
      spawnDebris(p.x + rand(-0.5, 0.5), p.y + rand(-0.2, 0.4), p.z + rand(-0.5, 0.5), color);
    }
    const axis = car.axis;
    const slot = car.slot;
    const gx = car.gx;
    const gz = car.gz;
    const travel = (axis === 'z' ? p.z : p.x) + car.dir * CELL * 2.4;
    const loop = car.loop;
    const along = car.s;
    const roam = car.roam;
    const home = car.home;
    removeCar(car);
    if (car.rogue) return;
    if (loop) {
      reviveLoop(slot, along, roam);
      return;
    }
    spawnCar(axis, slot, gx, gz, respawnTravel(axis, slot, travel), home);
  }

  const WRECK = GROUP_PROP | 8;

  function wreckMask() {
    return GROUP_RAG | GROUP_STATIC | 8;
  }

  function flingCar(car, grip, power) {
    const p = car.body.position;
    const kind = car.kind;
    const mesh = car.mesh;
    const axis = car.axis;
    const slot = car.slot;
    const gx = car.gx;
    const gz = car.gz;
    const rogue = car.rogue;
    const loop = car.loop;
    const along = car.s;
    const roam = car.roam;
    const travel = (axis === 'z' ? p.z : p.x) + car.dir * CELL * 2.4;
    const home = car.home;
    const quat = car.body.quaternion;
    removeBody(car.body);
    const index = cars.indexOf(car);
    if (index >= 0) cars.splice(index, 1);
    mesh.removeFromParent();
    junkRoot.add(mesh);
    const body = new CANNON.Body({
      mass: 14,
      material: toyMat,
      linearDamping: 0.06,
      angularDamping: 0.12,
      collisionFilterGroup: WRECK,
      collisionFilterMask: wreckMask(),
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(kind.w / 2, kind.h / 2, kind.d / 2)));
    body.position.set(p.x, p.y, p.z);
    body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    const kick = 14 * power.knock;
    const lift = 7 * power.lift;
    body.velocity.set(grip.dx * kick, Math.max(5, lift), grip.dz * kick);
    body.angularVelocity.set(grip.dz * 4 * power.spin, rand(-2, 2), -grip.dx * 4 * power.spin);
    body.wakeUp();
    addBody(body);
    junk.push({ body, mesh, roadkill: true, yeet: true, car: true, pad: Math.max(kind.w, kind.d) * 0.5 });
    trimJunk();
    onEvent({
      callout: power.callout,
      flair: power.callout,
      shake: 0.3 * power.shake,
      score: 48 * power.score,
      impact: 12,
      pos: { x: p.x, y: p.y + 0.8, z: p.z },
      burst: power.burst || 'launch',
    });
    if (!rogue && loop) reviveLoop(slot, along, roam);
    else if (!rogue) spawnCar(axis, slot, gx, gz, respawnTravel(axis, slot, travel), home);
  }

  function spawnChunk(x, y, z, color, sx, sy, sz, vx, vy, vz) {
    const body = new CANNON.Body({
      mass: 0.45 + sx * sy * sz * 4,
      material: toyMat,
      linearDamping: 0.14,
      angularDamping: 0.2,
      collisionFilterGroup: WRECK,
      collisionFilterMask: wreckMask(),
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
    body.position.set(x, y, z);
    body.velocity.set(vx + rand(-1, 1), vy, vz + rand(-1, 1));
    body.angularVelocity.set(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    addBody(body);
    const mesh = new THREE.Mesh(box, paintOf(color));
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    junkRoot.add(mesh);
    junk.push({ body, mesh, rubble: true, pad: Math.max(sx, sz) * 0.6 });
    trimJunk();
  }

  function faceFrame(dx, dy, dz, hx, hy, hz) {
    const ax = hx - Math.abs(dx);
    const ay = hy - Math.abs(dy);
    const az = hz - Math.abs(dz);
    if (ax <= ay && ax <= az) {
      const n = Math.sign(dx) || 1;
      return { nx: n, ny: 0, nz: 0 };
    }
    if (az <= ay) {
      const n = Math.sign(dz) || 1;
      return { nx: 0, ny: 0, nz: n };
    }
    const n = Math.sign(dy) || 1;
    return { nx: 0, ny: n, nz: 0 };
  }

  function dropSlab(wx, wy, wz, face, color) {
    const body = new CANNON.Body({
      mass: 7,
      material: toyMat,
      linearDamping: 0.1,
      angularDamping: 0.16,
      collisionFilterGroup: WRECK,
      collisionFilterMask: wreckMask(),
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.72, 0.86, 0.1)));
    if (face.nx) body.quaternion.setFromAxisAngle(AXIS_Y, Math.PI / 2);
    else if (face.ny) body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    body.position.set(wx + face.nx * 0.62, wy + face.ny * 0.4, wz + face.nz * 0.62);
    body.velocity.set(face.nx * 3.2, 1.4, face.nz * 3.2);
    body.angularVelocity.set(face.nz * 2.4, rand(-1.5, 1.5), -face.nx * 2.4);
    addBody(body);
    const mesh = new THREE.Mesh(box, paintOf(color));
    mesh.scale.set(1.44, 1.72, 0.2);
    mesh.castShadow = true;
    junkRoot.add(mesh);
    junk.push({ body, mesh, roadkill: true, pad: 1.2 });
    trimJunk();
  }

  function stampHoles(tile, prop, face, fx, fy, fz) {
    prop.holes = prop.holes || 0;
    if (prop.holes >= 18) return;
    const alongY = face.nx || face.nz;
    const count = prop.hits === 1 ? 2 : 3;
    for (let i = 0; i < count && prop.holes < 18; i++) {
      const w = rand(0.7, 1.25);
      const h = rand(0.7, 1.25);
      const jx = face.nx ? 0 : rand(-0.7, 0.7);
      const jy = alongY ? rand(-0.55, 0.55) : 0;
      const jz = face.nz ? 0 : rand(-0.7, 0.7);
      const x = face.nx
        ? prop.lx + face.nx * (prop.hx + 0.05)
        : Math.min(prop.lx + prop.hx - w / 2, Math.max(prop.lx - prop.hx + w / 2, fx + jx));
      const y = alongY
        ? Math.min(prop.ly + prop.hy - h / 2, Math.max(prop.ly - prop.hy + h / 2, fy + jy))
        : prop.ly + face.ny * (prop.hy + 0.05);
      const z = face.nz
        ? prop.lz + face.nz * (prop.hz + 0.05)
        : Math.min(prop.lz + prop.hz - w / 2, Math.max(prop.lz - prop.hz + w / 2, fz + jz));
      const hole = new THREE.Mesh(box, holeMat);
      hole.scale.set(face.nx ? 0.06 : w, alongY ? h : 0.06, face.nz ? 0.06 : (face.ny ? h : w));
      hole.position.set(x, y, z);
      tile.group.add(hole);
      prop.holeMeshes.push(hole);
      prop.holes += 1;
    }
  }

  function sideOf(face) {
    if (face.nx > 0) return 'east';
    if (face.nx < 0) return 'west';
    if (face.nz > 0) return 'north';
    if (face.nz < 0) return 'south';
    return null;
  }

  function wallsBreached(prop) {
    const sides = prop.sides;
    let count = 0;
    if (sides.east >= WALL_HITS) count += 1;
    if (sides.west >= WALL_HITS) count += 1;
    if (sides.north >= WALL_HITS) count += 1;
    if (sides.south >= WALL_HITS) count += 1;
    return count;
  }

  function dropDoor(tile, id) {
    if (!tile.doors) return;
    tile.doors = tile.doors.filter((door) => door.id !== id);
  }

  function collapseBuilding(tile, prop, hit, power = {}, attacker = null) {
    const index = tile.props.indexOf(prop);
    if (index >= 0) tile.props.splice(index, 1);
    dropDoor(tile, prop.id);
    for (const mesh of prop.shells) mesh.removeFromParent();
    for (const win of prop.windows) win.removeFromParent();
    for (const hole of prop.holeMeshes) hole.removeFromParent();
    const bodyIndex = tile.bodies.indexOf(prop.solid);
    if (bodyIndex >= 0) tile.bodies.splice(bodyIndex, 1);
    removeBody(prop.solid.body);

    const originX = shiftX + tile.gx * CELL;
    const originZ = shiftZ + tile.gz * CELL;
    const cx = originX + prop.lx;
    const cz = originZ + prop.lz;
    const floors = 3;
    for (let floor = 0; floor < floors; floor++) {
      const y = (prop.ly - prop.hy) + (prop.hy * 2) * ((floor + 0.5) / floors);
      for (const side of [-1, 1]) {
        spawnChunk(
          cx + side * prop.hx * 0.28,
          y,
          cz + (floor - 1) * prop.hz * 0.22,
          prop.color,
          Math.min(prop.hx * 0.85, 2.4),
          Math.min(prop.hy * 0.55, 1.8),
          Math.min(prop.hz * 0.7, 2.2),
          side * rand(1.6, 3.6),
          rand(0.2, 1.8) + floor * 0.4,
          rand(-1.8, 1.8),
        );
      }
    }
    onEvent({
      callout: 'COLLAPSE!',
      flair: 'COLLAPSE!',
      shake: 0.62 * (power.shake || 1),
      score: 90 * (power.score || 1),
      impact: 18,
      pos: { x: hit.x, y: prop.ly + prop.hy, z: hit.z },
      burst: 'chip',
    });
    queueToyWave(hit.x, hit.z);
    const crew = [];
    if (prop.crew) {
      for (const doll of prop.crew) {
        if (actors.includes(doll) && !crew.includes(doll)) crew.push(doll);
      }
    }
    if (attacker && !crew.includes(attacker)) crew.push(attacker);
    siren(hit.x, hit.z, crew);
  }

  function noteCrew(prop, doll) {
    if (!prop || !doll) return;
    if (!prop.crew) prop.crew = new Set();
    prop.crew.add(doll);
  }

  function crackBuilding(tile, prop, hit, power = {}, attacker = null) {
    noteCrew(prop, attacker);
    const blows = Math.max(1, power.cracks || 1);
    const originX = shiftX + tile.gx * CELL;
    const originZ = shiftZ + tile.gz * CELL;
    const localX = hit.x - originX;
    const localZ = hit.z - originZ;
    const dx = localX - prop.lx;
    const dy = hit.y - prop.ly;
    const dz = localZ - prop.lz;
    const face = faceFrame(dx, dy, dz, prop.hx, prop.hy, prop.hz);
    const wall = sideOf(face);
    const fx = face.nx ? prop.lx + face.nx * prop.hx : localX;
    const fy = Math.min(prop.ly + prop.hy - 0.35, Math.max(prop.ly - prop.hy + 0.4, hit.y));
    const fz = face.nz ? prop.lz + face.nz * prop.hz : localZ;
    let breached = false;
    for (let n = 0; n < blows; n++) {
      prop.hits += 1;
      if (wall) {
        prop.sides[wall] += 1;
        if (prop.sides[wall] === WALL_HITS) breached = true;
      }
      stampHoles(tile, prop, face, fx, fy, fz);
      const keep = [];
      let broke = 0;
      for (const win of prop.windows) {
        const wdx = win.position.x - localX;
        const wdy = win.position.y - hit.y;
        const wdz = win.position.z - localZ;
        if (broke < 4 && wdx * wdx + wdy * wdy + wdz * wdz < 3.4 * 3.4) {
          win.removeFromParent();
          spawnChunk(
            originX + win.position.x + face.nx * 0.2,
            win.position.y,
            originZ + win.position.z + face.nz * 0.2,
            0xc5ecff,
            0.34,
            0.22,
            0.06,
            face.nx * 4,
            rand(1.5, 3.5),
            face.nz * 4,
          );
          broke += 1;
        } else keep.push(win);
      }
      prop.windows = keep;
      for (let i = 0; i < 3; i++) {
        spawnChunk(
          originX + fx + face.nx * 0.55,
          fy + rand(-0.2, 0.3),
          originZ + fz + face.nz * 0.55,
          prop.color,
          rand(0.28, 0.62),
          rand(0.2, 0.45),
          rand(0.18, 0.4),
          face.nx * rand(2.5, 6),
          rand(2, 5.5),
          face.nz * rand(2.5, 6),
        );
      }
      if (prop.hits % 2 === 0) {
        dropSlab(originX + fx, fy, originZ + fz, face, prop.color);
      }
      if (wallsBreached(prop) === 4) {
        collapseBuilding(tile, prop, hit, power, attacker);
        return;
      }
    }
    const open = wallsBreached(prop);
    const word = breached ? `${open}/4 WALLS` : (power.callout || 'SMASH!');
    const shakeScale = power.shake || 1;
    const scoreScale = power.score || 1;
    onEvent({
      callout: word,
      flair: word,
      shake: (0.14 + Math.min(0.28, prop.hits * 0.045)) * shakeScale,
      score: (8 + prop.hits * 3) * scoreScale,
      impact: 7 + prop.hits,
      pos: { x: hit.x, y: hit.y + 0.5, z: hit.z },
      burst: power.burst === 'zap' ? 'zap' : 'chip',
    });
  }

  function topple(tile, prop, grip, power = {}) {
    const index = tile.props.indexOf(prop);
    if (index >= 0) tile.props.splice(index, 1);
    const group = prop.group;
    const worldPos = new THREE.Vector3();
    group.getWorldPosition(worldPos);
    const worldQuat = new THREE.Quaternion();
    group.getWorldQuaternion(worldQuat);
    group.removeFromParent();
    junkRoot.add(group);
    const body = new CANNON.Body({
      mass: prop.mass,
      material: toyMat,
      linearDamping: 0.08,
      angularDamping: 0.18,
      collisionFilterGroup: WRECK,
      collisionFilterMask: wreckMask(),
    });
    for (const shape of prop.shapes) body.addShape(shape, shape.offset);
    body.position.set(worldPos.x, worldPos.y, worldPos.z);
    body.quaternion.set(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w);
    const knock = power.knock || 1;
    const lift = power.lift || 1;
    const spin = power.spin || 1;
    const fx = grip.dx;
    const fz = grip.dz;
    body.velocity.set(fx * prop.kick * knock, prop.up * lift, fz * prop.kick * knock);
    body.angularVelocity.set(fz * prop.spin * spin, rand(-0.6, 0.6), -fx * prop.spin * spin);
    body.wakeUp();
    addBody(body);
    junk.push({ body, mesh: group, roadkill: true, yeet: lift > 2 || knock > 2, pad: prop.pad || 1.2 });
    trimJunk();
    let unlockId = '';
    if (prop.mark) {
      tallies[prop.mark] = (tallies[prop.mark] || 0) + 1;
      const goals = { meter: 4, cart: 6, balloon: 5 };
      if (tallies[prop.mark] === goals[prop.mark]) unlockId = prop.mark;
    }
    onEvent({
      callout: prop.yell,
      flair: prop.yell,
      shake: 0.22 * (power.shake || 1),
      score: prop.score * (power.score || 1),
      impact: 9,
      pos: { x: worldPos.x, y: worldPos.y + 0.8, z: worldPos.z },
      burst: power.burst === 'zap' ? 'zap' : power.burst === 'launch' ? 'launch' : 'chip',
      unlock: unlockId,
    });
  }

  function propTouches(tile, prop, x, y, z) {
    const originX = shiftX + tile.gx * CELL;
    const originZ = shiftZ + tile.gz * CELL;
    if (prop.kind === 'building') {
      const minX = originX + prop.lx - prop.hx - 0.45;
      const maxX = originX + prop.lx + prop.hx + 0.45;
      const minZ = originZ + prop.lz - prop.hz - 0.45;
      const maxZ = originZ + prop.lz + prop.hz + 0.45;
      const minY = prop.ly - prop.hy - 0.2;
      const maxY = prop.ly + prop.hy + 0.3;
      return x > minX && x < maxX && z > minZ && z < maxZ && y > minY && y < maxY;
    }
    const dx = x - (originX + prop.lx);
    const dz = z - (originZ + prop.lz);
    return dx * dx + dz * dz < prop.radius * prop.radius
      && y > GROUND_Y - 0.2
      && y < GROUND_Y + prop.reachH;
  }

  function carBox(car) {
    if (car.rogue || car.loop || car.turning) {
      const r = Math.max(car.kind.d, car.kind.w) * 0.55;
      const p = car.body.position;
      return { minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r };
    }
    return boundsOf(car, 0.55);
  }

  function capVelocity(body, max) {
    const v = body.velocity;
    const speed = Math.hypot(v.x, v.y, v.z);
    if (speed > max) {
      const k = max / speed;
      v.x *= k;
      v.y *= k;
      v.z *= k;
    }
  }

  function plow() {
    const now = performance.now();
    for (const item of junk) {
      if (!item.roadkill && !item.rubble) continue;
      if (now < (item.shoveAt || 0)) continue;
      const p = item.body.position;
      if (p.y > GROUND_Y + 3.2) continue;
      const pad = item.pad || 0.4;
      for (const car of cars) {
        const box = carBox(car);
        if (p.x < box.minX - pad || p.x > box.maxX + pad) continue;
        if (p.z < box.minZ - pad || p.z > box.maxZ + pad) continue;
        const yaw = yawOf(car);
        const fx = Math.sin(yaw);
        const fz = Math.cos(yaw);
        const spd = Math.max(9, Math.abs(car.speed));
        const boost = item.roadkill ? 0.95 : 0.55;
        item.body.velocity.set(
          fx * spd * boost + rand(-1.4, 1.4),
          item.roadkill ? rand(0.4, 2.4) : rand(1.4, 3.6),
          fz * spd * boost + rand(-1.4, 1.4),
        );
        item.body.angularVelocity.set(rand(-9, 9), rand(-4, 4), rand(-9, 9));
        item.body.wakeUp();
        item.shoveAt = now + (item.roadkill ? 160 : 220);
        if (item.roadkill) {
          car.hop = Math.max(car.hop || 0, 0.28);
          if (!car.rogue && !car.loop) car.travel -= car.dir * 0.42;
        }
        if (item.roadkill && !item.crunched) {
          item.crunched = true;
          onEvent({
            callout: 'RUN OVER!',
            shake: 0.2,
            honk: true,
            crunch: true,
            impact: 8,
            pos: { x: p.x, y: p.y + 0.4, z: p.z },
            burst: 'chip',
          });
        } else if (item.roadkill && now > (item.crunchAt || 0)) {
          item.crunchAt = now + 700;
          onEvent({ crunch: true, impact: 5, shake: 0.08 });
        }
        break;
      }
    }
  }

  function fanRays(grip, arc) {
    const rays = [grip];
    if (arc < 0.08) return rays;
    const base = Math.atan2(grip.dx, grip.dz);
    const horiz = Math.hypot(grip.dx, grip.dz) || 0.001;
    const steps = arc > 0.85 ? [-1, -0.5, 0.5, 1] : [-1, 1];
    for (const step of steps) {
      const aim = base + step * arc;
      rays.push({
        x: grip.x,
        y: grip.y,
        z: grip.z,
        dx: Math.sin(aim) * horiz,
        dy: grip.dy,
        dz: Math.cos(aim) * horiz,
      });
    }
    return rays;
  }

  function propAnchor(tile, prop) {
    return {
      x: shiftX + tile.gx * CELL + prop.lx,
      y: prop.kind === 'building' ? prop.ly : GROUND_Y + 1.1,
      z: shiftZ + tile.gz * CELL + prop.lz,
    };
  }

  function slash() {
    for (const doll of actors) {
      if (haulOf(doll)?.phase === 'ride') continue;
      swingAt(doll);
    }
  }

  function swingAt(attacker) {
    const previousCredit = creditDoll;
    creditDoll = attacker;
    try {
    const key = armKey(attacker);
    const power = weapons.stats(key);
    const hand = handOf(attacker);
    const grip = weapons.frame(hand, attacker.facing(), attacker.walking(), key);
    if (!power || !grip || !grip.hot) return;
    const rays = fanRays(grip, power.arc);
    const doomed = [];
    const struck = [];
    const bruised = [];
    const tossed = [];

    for (const car of cars) {
      if (weapons.seen(car.id, key)) continue;
      let hit = false;
      for (const ray of rays) {
        for (let t = 0.15; t <= 1; t += 0.14) {
          const dist = power.reach * t;
          if (bladeHits(car, ray.x + ray.dx * dist, ray.y + ray.dy * dist, ray.z + ray.dz * dist)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (!hit) continue;
      weapons.mark(car.id, key);
      doomed.push(car);
    }
    for (const doll of actors) {
      if (doll === attacker || weapons.seen(birdTag(doll), key)) continue;
      let part = '';
      let at = null;
      for (const ray of rays) {
        for (let t = 0.12; t <= 1; t += 0.12) {
          const dist = power.reach * t;
          const x = ray.x + ray.dx * dist;
          const y = ray.y + ray.dy * dist;
          const z = ray.z + ray.dz * dist;
          part = birdTouch(doll, x, y, z);
          if (part) {
            at = { x, y, z };
            break;
          }
        }
        if (part) break;
      }
      if (!part) continue;
      weapons.mark(birdTag(doll), key);
      bruised.push({ doll, part, ...at });
    }
    for (const tile of tiles) {
      if (!tile.props) continue;
      for (const prop of tile.props) {
        if (weapons.seen(prop.id, key)) continue;
        let hit = null;
        for (const ray of rays) {
          for (let t = 0.12; t <= 1; t += 0.12) {
            const dist = power.reach * t;
            const x = ray.x + ray.dx * dist;
            const y = ray.y + ray.dy * dist;
            const z = ray.z + ray.dz * dist;
            if (propTouches(tile, prop, x, y, z)) {
              hit = { x, y, z };
              break;
            }
          }
          if (hit) break;
        }
        if (!hit) continue;
        weapons.mark(prop.id, key);
        struck.push({ tile, prop, ...hit });
      }
    }
    for (const item of junk) {
      if (!item.prize || weapons.seen(item.id, key)) continue;
      let hit = false;
      for (const ray of rays) {
        for (let t = 0.12; t <= 1; t += 0.12) {
          const dist = power.reach * t;
          if (prizeTouch(item, ray.x + ray.dx * dist, ray.y + ray.dy * dist, ray.z + ray.dz * dist)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (!hit) continue;
      weapons.mark(item.id, key);
      tossed.push(item);
    }
    if (jail && !jail.open && grip && haulOf(attacker)?.phase === 'cell') {
      const aim = { x: grip.dx, y: grip.dy, z: grip.dz };
      for (const ray of rays) {
        for (let t = 0.25; t <= 1; t += 0.25) {
          const dist = power.reach * t;
          shoveLoose(ray.x + ray.dx * dist, ray.y + ray.dy * dist, ray.z + ray.dz * dist, aim, power, 1.25, key);
        }
      }
    }

    if (power.blast > 0 && (power.quake || doomed.length || struck.length || bruised.length)) {
      const origins = [];
      if (power.quake && !weapons.seen('quake', key)) {
        weapons.mark('quake', key);
        const tip = {
          x: grip.x + grip.dx * power.reach * 0.85,
          y: grip.y + grip.dy * power.reach * 0.85,
          z: grip.z + grip.dz * power.reach * 0.85,
        };
        origins.push(tip);
        onEvent({
          callout: power.callout,
          shake: 0.36 * power.shake,
          burst: 'chip',
          pos: tip,
          impact: 8,
        });
      }
      for (const hit of struck) origins.push(hit);
      for (const car of doomed) {
        const p = car.body.position;
        origins.push({ x: p.x, y: p.y, z: p.z });
      }
      for (const blow of bruised) origins.push(blow);
      const r2 = power.blast * power.blast;
      for (const origin of origins) {
        for (const car of cars) {
          if (weapons.seen(car.id, key)) continue;
          const p = car.body.position;
          const dx = p.x - origin.x;
          const dy = p.y - origin.y;
          const dz = p.z - origin.z;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          weapons.mark(car.id, key);
          doomed.push(car);
        }
        for (const doll of actors) {
          if (doll === attacker || weapons.seen(birdTag(doll), key)) continue;
          const at = birdCenter(doll);
          const dx = at.x - origin.x;
          const dy = at.y - origin.y;
          const dz = at.z - origin.z;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          weapons.mark(birdTag(doll), key);
          bruised.push({ doll, part: 'body', x: at.x, y: at.y, z: at.z });
        }
        for (const tile of tiles) {
          if (!tile.props) continue;
          for (const prop of tile.props) {
            if (weapons.seen(prop.id, key)) continue;
            const at = propAnchor(tile, prop);
            const dx = at.x - origin.x;
            const dy = prop.kind === 'building' ? 0 : at.y - origin.y;
            const dz = at.z - origin.z;
            if (dx * dx + dy * dy + dz * dz > r2) continue;
            weapons.mark(prop.id, key);
            struck.push({ tile, prop, x: at.x, y: at.y, z: at.z });
          }
        }
        for (const item of junk) {
          if (!item.prize || weapons.seen(item.id, key)) continue;
          const p = item.body.position;
          const dx = p.x - origin.x;
          const dy = p.y - origin.y;
          const dz = p.z - origin.z;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          weapons.mark(item.id, key);
          tossed.push(item);
        }
        if (jail && !jail.open && haulOf(attacker)?.phase === 'cell') shoveLoose(origin.x, origin.y, origin.z, null, power, power.blast, key);
      }
    }

    if (power.chain > 0) {
      let wave = [];
      for (const car of doomed) {
        const p = car.body.position;
        wave.push({ x: p.x, y: p.y, z: p.z });
      }
      for (const hit of struck) wave.push({ x: hit.x, y: hit.y, z: hit.z });
      for (const blow of bruised) wave.push({ x: blow.x, y: blow.y, z: blow.z });
      const r2 = power.chainRange * power.chainRange;
      for (let hop = 0; hop < power.chain && wave.length; hop++) {
        const next = [];
        for (const from of wave) {
          let best = null;
          let bestD = r2;
          for (const car of cars) {
            if (weapons.seen(car.id, key)) continue;
            const p = car.body.position;
            const d = (p.x - from.x) ** 2 + (p.y - from.y) ** 2 + (p.z - from.z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = { car };
            }
          }
          for (const doll of actors) {
            if (doll === attacker || weapons.seen(birdTag(doll), key)) continue;
            const at = birdCenter(doll);
            const d = (at.x - from.x) ** 2 + (at.y - from.y) ** 2 + (at.z - from.z) ** 2;
            if (d < bestD) {
              bestD = d;
              best = { doll, part: 'body', x: at.x, y: at.y, z: at.z };
            }
          }
          for (const tile of tiles) {
            if (!tile.props) continue;
            for (const prop of tile.props) {
              if (weapons.seen(prop.id, key)) continue;
              const at = propAnchor(tile, prop);
              const d = (at.x - from.x) ** 2 + (at.y - from.y) ** 2 + (at.z - from.z) ** 2;
              if (d < bestD) {
                bestD = d;
                best = { tile, prop, x: at.x, y: at.y, z: at.z };
              }
            }
          }
          if (!best) continue;
          if (best.car) {
            weapons.mark(best.car.id, key);
            doomed.push(best.car);
            const p = best.car.body.position;
            next.push({ x: p.x, y: p.y, z: p.z });
          } else if (best.doll) {
            weapons.mark(birdTag(best.doll), key);
            bruised.push(best);
            next.push({ x: best.x, y: best.y, z: best.z });
          } else {
            weapons.mark(best.prop.id, key);
            struck.push(best);
            next.push({ x: best.x, y: best.y, z: best.z });
          }
          const spot = next[next.length - 1];
          onEvent({
            callout: 'ZAP!',
            pos: { x: spot.x, y: spot.y + 0.45, z: spot.z },
            burst: 'zap',
            shake: 0.05,
            impact: 4,
          });
        }
        wave = next;
      }
    }

    for (const car of doomed) {
      if (power.car === 'launch') flingCar(car, grip, power);
      else explodeCar(car, power);
    }
    for (const blow of struck) {
      if (blow.prop.kind === 'building') crackBuilding(blow.tile, blow.prop, blow, power, attacker);
      else topple(blow.tile, blow.prop, grip, power);
    }
    for (const blow of bruised) launchBird(blow.doll, grip, power, blow.part);
    for (const item of tossed) yeetPrize(item, grip, power);
    } finally {
      creditDoll = previousCredit;
    }
  }

  function prizeTouch(item, x, y, z) {
    const p = item.body.position;
    const pad = item.pad || 0.6;
    const dx = x - p.x;
    const dy = y - (p.y + (item.mid || 0.35));
    const dz = z - p.z;
    return dx * dx + dy * dy + dz * dz < pad * pad;
  }

  function yeetPrize(item, grip, power) {
    const knock = power.knock || 1;
    const lift = power.lift || 1;
    const spin = power.spin || 1;
    item.yeet = true;
    item.body.velocity.set(grip.dx * 12 * knock, 4.2 * lift + 1.5, grip.dz * 12 * knock);
    item.body.angularVelocity.set(grip.dz * 4.5 * spin, rand(-2, 2), -grip.dx * 4.5 * spin);
    item.body.wakeUp();
    item.bonkAt = performance.now() + 500;
    const p = item.body.position;
    onEvent({
      callout: item.yell,
      flair: item.yell,
      shake: (item.toy === 'float' ? 0.32 : 0.1) * (power.shake || 1),
      score: item.score * (power.score || 1),
      impact: item.toy === 'float' ? 12 : 6,
      pos: { x: p.x, y: p.y + (item.mid || 0.6), z: p.z },
      burst: item.toy === 'float' ? 'launch' : 'toys',
    });
  }

  function spawnPrize(kind, x, y, z, extra = {}) {
    const scale = extra.scale || 1;
    const body = new CANNON.Body({
      mass: extra.mass,
      material: toyMat,
      linearDamping: kind === 'float' ? 0.12 : 0.08,
      angularDamping: kind === 'float' ? 0.18 : 0.12,
      allowSleep: true,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    let mesh;
    if (kind === 'duck') {
      mesh = art.duckMesh();
      mesh.scale.setScalar(scale);
      body.addShape(new CANNON.Sphere(0.42 * scale), new CANNON.Vec3(0, 0.16 * scale, 0));
      body.addShape(new CANNON.Sphere(0.22 * scale), new CANNON.Vec3(0, 0.48 * scale, 0.28 * scale));
    } else if (kind === 'pin') {
      mesh = art.pinMesh();
      body.addShape(new CANNON.Cylinder(0.1, 0.16, 0.78, 8), new CANNON.Vec3(0, 0.39, 0));
    } else if (kind === 'ball') {
      mesh = art.ballMesh();
      body.addShape(new CANNON.Sphere(0.34));
    } else {
      mesh = art.floatMesh();
      mesh.scale.setScalar(scale);
      body.addShape(new CANNON.Box(new CANNON.Vec3(1.7 * scale, 0.16 * scale, 0.85 * scale)), new CANNON.Vec3(0, 0.28 * scale, 0));
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.36 * scale, 0.35 * scale, 0.58 * scale)), new CANNON.Vec3(-1.15 * scale, 0.82 * scale, 0));
      body.addShape(new CANNON.Sphere(0.48 * scale), new CANNON.Vec3(0.15 * scale, 1.2 * scale, 0));
    }
    body.position.set(x, y, z);
    if (extra.yaw) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), extra.yaw);
    body.velocity.set(extra.vx || 0, extra.vy == null ? rand(-0.4, 1.2) : extra.vy, extra.vz || 0);
    body.angularVelocity.set(rand(-2.4, 2.4), rand(-2, 2), rand(-2.4, 2.4));
    body.gameRole = 'prop';
    addBody(body);
    junkRoot.add(mesh);
    const item = {
      id: `prize-${nextPrizeId++}`,
      body,
      mesh,
      rubble: true,
      prize: true,
      toy: kind,
      yell: extra.yell,
      score: extra.score,
      pad: extra.pad,
      mid: extra.mid,
      born: performance.now(),
    };
    junk.push(item);
    body.addEventListener('collide', (e) => {
      const other = e.body;
      if (!other || other.gameRole !== 'ragdoll') return;
      const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (!Number.isFinite(impact) || impact < 3.4) return;
      const now = performance.now();
      if (now < (item.bonkAt || 0)) return;
      item.bonkAt = now + 460;
      const at = body.position;
      onEvent({
        callout: item.yell,
        flair: item.yell,
        shake: item.toy === 'float' ? 0.18 : 0.06,
        score: Math.round(item.score * 0.6),
        impact: Math.min(14, impact),
        pos: { x: at.x, y: at.y + (item.mid || 0.5), z: at.z },
        burst: 'toys',
      });
    });
    trimJunk();
    return item;
  }

  function cluster(body, cx, cz) {
    const p = body.position;
    body.velocity.x += (cx - p.x) * 0.35;
    body.velocity.z += (cz - p.z) * 0.35;
  }

  function inRoomAt(x, z) {
    return !!(room && Math.abs(x - ROOM_OX) < ROOM_W / 2 - 0.6 && Math.abs(z - ROOM_OZ) < ROOM_D / 2 - 0.6);
  }

  function dropRoomWave(x, z, theme) {
    const lx = x - ROOM_OX;
    const lz = z - ROOM_OZ;
    const y0 = GROUND_Y + 3.35;
    if (theme === 'ducks') {
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.35 + Math.random() * 1.5;
        spawnRoomToy('duck', lx + Math.cos(angle) * radius, y0 + i * 0.28, lz + Math.sin(angle) * radius, 'QUACK!');
      }
    } else if (theme === 'pins') {
      for (let row = 0; row < 4; row++) {
        for (let c = 0; c <= row; c++) {
          spawnRoomToy('pin', lx + (c - row / 2) * 0.4, y0 + 0.2, lz - 0.4 + row * 0.38, 'CLACK!');
        }
      }
    } else {
      spawnRoomToy('float', lx, y0, lz, 'PARADE!');
    }
    onEvent({
      callout: WAVE_LABEL[theme],
      pos: { x, y: y0, z },
      burst: 'toys',
      shake: 0.16,
    });
  }

  function releaseToyWave(x, z) {
    const theme = WAVE_THEMES[waveCursor % WAVE_THEMES.length];
    waveCursor += 1;
    if (inRoomAt(x, z)) {
      dropRoomWave(x, z, theme);
      return;
    }
    const sky = GROUND_Y + 18 + Math.random() * 6;
    if (theme === 'ducks') {
      for (let i = 0; i < 7; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.4 + Math.random() * 2.2;
        const scale = i === 0 ? 1.7 : 0.9 + Math.random() * 0.4;
        const item = spawnPrize('duck', x + Math.cos(angle) * radius, sky + i * 0.45, z + Math.sin(angle) * radius, {
          scale,
          mass: 1.2 * scale,
          yell: 'QUACK!',
          score: 8,
          pad: 0.7 * scale,
          mid: 0.4 * scale,
          yaw: Math.random() * Math.PI * 2,
        });
        cluster(item.body, x, z);
      }
    } else if (theme === 'pins') {
      for (let row = 0; row < 4; row++) {
        for (let c = 0; c <= row; c++) {
          const item = spawnPrize('pin', x + (c - row / 2) * 0.46, sky + 0.6, z - 0.6 + row * 0.46, {
            mass: 0.45,
            yell: 'CLACK!',
            score: 4,
            pad: 0.42,
            mid: 0.4,
          });
          cluster(item.body, x, z);
        }
      }
      spawnPrize('ball', x, sky + 3.6, z - 2.3, {
        mass: 3.1,
        yell: 'BOWL!',
        score: 8,
        pad: 0.5,
        mid: 0.34,
        vy: -0.2,
        vz: 3.2,
      });
    } else {
      spawnPrize('float', x, sky + 1.5, z, {
        mass: 7.2,
        yell: 'PARADE!',
        score: 28,
        pad: 2.15,
        mid: 0.7,
        yaw: Math.random() * Math.PI * 2,
        vy: 0.4,
      });
    }
    onEvent({
      callout: WAVE_LABEL[theme],
      pos: { x, y: sky, z },
      burst: 'toys',
      shake: theme === 'float' ? 0.2 : 0.12,
    });
  }

  function queueToyWave(x, z) {
    if (!running || mirror) return;
    const now = performance.now();
    if (now < waveReadyAt) return;
    waveReadyAt = now + 1600;
    waveQueue.push({ x, z, t: 0.65 });
  }

  function pumpWaves(dt) {
    for (let i = waveQueue.length - 1; i >= 0; i--) {
      waveQueue[i].t -= dt;
      if (waveQueue[i].t > 0) continue;
      const job = waveQueue.splice(i, 1)[0];
      releaseToyWave(job.x, job.z);
    }
  }

  function spawnJunk(x, z) {
    const color = BUILDING_COLORS[(Math.random() * BUILDING_COLORS.length) | 0];
    const body = new CANNON.Body({
      mass: 2.4,
      material: toyMat,
      linearDamping: 0.12,
      angularDamping: 0.2,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.26, 0.26, 0.26)));
    body.position.set(x, GROUND_Y + 1.3 + Math.random(), z);
    body.velocity.set(rand(-3, 3), rand(3, 7), rand(-3, 3));
    body.angularVelocity.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    addBody(body);
    const mesh = new THREE.Mesh(junkGeo, paintOf(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    junkRoot.add(mesh);
    junk.push({ body, mesh, rubble: true, pad: 0.45 });
    trimJunk();
  }

  function bounce(body) {
    if (!running || !body || room) return false;
    const radius = 0.46;
    const halfH = 0.95;
    const skin = 0.12;
    const kick = 6.4;
    let hit = false;
    for (let pass = 0; pass < 3; pass++) {
      let pushed = false;
      for (const tile of tiles) {
        const x0 = shiftX + tile.gx * CELL;
        const z0 = shiftZ + tile.gz * CELL;
        for (const solid of tile.bodies) {
          const minX = x0 + solid.lx - solid.hx - radius;
          const maxX = x0 + solid.lx + solid.hx + radius;
          const minZ = z0 + solid.lz - solid.hz - radius;
          const maxZ = z0 + solid.lz + solid.hz + radius;
          const minY = solid.ly - solid.hy;
          const maxY = solid.ly + solid.hy;
          const x = body.position.x;
          const y = body.position.y;
          const z = body.position.z;
          if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) continue;
          if (y + halfH < minY || y - halfH > maxY) continue;
          const penL = x - minX;
          const penR = maxX - x;
          const penN = z - minZ;
          const penF = maxZ - z;
          const useX = Math.abs(body.velocity.x) >= Math.abs(body.velocity.z)
            ? true
            : penL < penN && penL < penF || penR < penN && penR < penF;
          if (useX) {
            const nx = penL < penR ? -1 : 1;
            body.position.x = nx < 0 ? minX - skin : maxX + skin;
            body.velocity.x = nx * Math.max(kick, Math.abs(body.velocity.x));
          } else {
            const nz = penN < penF ? -1 : 1;
            body.position.z = nz < 0 ? minZ - skin : maxZ + skin;
            body.velocity.z = nz * Math.max(kick, Math.abs(body.velocity.z));
          }
          hit = true;
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    body.previousPosition.copy(body.position);
    return hit;
  }

  const TOY_COLORS = [0xff5d73, 0xffd93d, 0x6bcb77, 0x4d96ff, 0xff922b, 0xc77dff, 0x4ecdc4, 0xfff3bf];

  function suspendCity() {
    if (parked) return;
    parked = true;
    root.visible = false;
    weapons.shown(false);
    if (ground && ground.world) removeBody(ground);
    for (const tile of tiles) {
      for (const entry of tile.bodies) removeBody(entry.body);
    }
    for (const car of cars) removeBody(car.body);
    for (const item of junk) removeBody(item.body);
    if (jail) {
      for (const body of jail.bodies) removeBody(body);
      for (const item of jail.loose) removeBody(item.body);
    }
    for (const entry of districtBodies) removeBody(entry.body);
  }

  function resumeCity() {
    if (!parked) return;
    parked = false;
    root.visible = running;
    weapons.shown(true);
    if (ground && !ground.world) addBody(ground);
    for (const tile of tiles) {
      for (const entry of tile.bodies) if (!entry.body.world) addBody(entry.body);
    }
    for (const car of cars) if (!car.body.world) addBody(car.body);
    for (const item of junk) if (!item.body.world) addBody(item.body);
    if (jail) {
      for (const body of jail.bodies) if (!body.world) addBody(body);
      for (const item of jail.loose) if (!item.body.world) addBody(item.body);
    }
    for (const entry of districtBodies) if (!entry.body.world) addBody(entry.body);
  }

  function destroyRoom() {
    if (!room) return;
    for (const body of room.bodies) removeBody(body);
    for (const toy of room.toys) {
      removeBody(toy.body);
      toy.mesh.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
      });
    }
    room.root.removeFromParent();
    room = null;
    toyMotions = [];
  }

  function roomSolid(w, h, d, x, y, z, meshMat, physMat) {
    const body = new CANNON.Body({
      mass: 0,
      material: physMat,
      collisionFilterGroup: GROUP_STATIC,
      collisionFilterMask: GROUP_RAG | GROUP_PROP,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    body.position.set(ROOM_OX + x, y, ROOM_OZ + z);
    body.gameRole = 'static';
    addBody(body);
    room.bodies.push(body);
    const mesh = new THREE.Mesh(box, meshMat);
    mesh.scale.set(w, h, d);
    mesh.position.set(ROOM_OX + x, y, ROOM_OZ + z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    room.root.add(mesh);
  }

  function dollOfBody(body) {
    if (!body) return null;
    for (const doll of actors) {
      if (doll.mover() === body) return doll;
      for (const part of doll.parts) {
        if (part.body === body) return doll;
      }
    }
    return null;
  }

  function onToyHit(body, toy, e) {
    if (!room) return;
    const other = e.body;
    const doll = dollOfBody(other);
    if (!doll || !indoors.has(doll)) return;
    const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (!Number.isFinite(impact) || impact < 2.4) return;
    const now = performance.now();
    if (now - bonkAt < 260) return;
    bonkAt = now;
    const ox = other.position.x - body.position.x;
    const oz = other.position.z - body.position.z;
    const len = Math.hypot(ox, oz) || 1;
    const kick = 4.2 + impact * 0.9;
    const kx = (ox / len) * kick;
    const kz = (oz / len) * kick;
    const ky = 2.4 + Math.min(5.5, impact * 0.32);
    const pos = { x: other.position.x, y: other.position.y + 0.5, z: other.position.z };
    const mine = doll === ragdoll;
    if (doll.walking()) {
      const mover = doll.mover();
      mover.velocity.x = kx;
      mover.velocity.z = kz;
      mover.velocity.y = ky;
      onEvent({
        hit: mine,
        who: mine ? undefined : doll,
        style: {
          spin: 4.5 + impact * 0.28,
          spinScale: 0.18,
          maxSpin: 16,
          minUp: ky,
          spread: 1.7 + impact * 0.06,
          yJitter: 1.5,
          wobble: 6,
        },
        launch: mine ? 0.34 : 0,
        callout: toy.yell,
        shake: mine ? Math.min(0.34, 0.08 + impact * 0.02) : 0,
        score: mine ? 5 : 0,
        impact,
        pos,
        burst: 'toys',
        bawk: mine,
      });
      return;
    }
    for (const part of doll.parts) {
      part.body.velocity.x += kx * 0.42;
      part.body.velocity.z += kz * 0.42;
      part.body.velocity.y += Math.min(3.4, ky * 0.35);
      part.body.wakeUp();
    }
    onEvent({
      who: mine ? undefined : doll,
      callout: toy.yell,
      shake: mine ? Math.min(0.24, impact * 0.02) : 0,
      score: mine ? 3 : 0,
      impact,
      pos,
      burst: 'toys',
      bawk: mine && impact > 5,
    });
  }

  function spawnRoomToy(kind, x, y, z, yell) {
    if (!room) return null;
    let shape;
    let mesh;
    let mass = 1;
    const color = TOY_COLORS[room.toys.length % TOY_COLORS.length];
    if (kind === 'crate') {
      mass = 2.7;
      shape = new CANNON.Box(new CANNON.Vec3(0.42, 0.42, 0.42));
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.84, 0.84), art.plastic(0xc4844a, { roughness: 0.7 }));
    } else if (kind === 'pin') {
      mass = 0.55;
      shape = new CANNON.Cylinder(0.12, 0.16, 0.72, 8);
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.72, 10), art.plastic(0xfff6ea, { roughness: 0.4 }));
    } else if (kind === 'ball') {
      mass = 1.5;
      shape = new CANNON.Sphere(0.58);
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 18, 14), art.plastic(color, { roughness: 0.32 }));
    } else if (kind === 'duck') {
      mass = 1.7;
      shape = new CANNON.Sphere(0.46);
      mesh = new THREE.Group();
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), art.plastic(0xffe14a, { roughness: 0.38 }));
      belly.scale.set(1.05, 0.82, 1);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), art.plastic(0xffe14a, { roughness: 0.38 }));
      head.position.set(0, 0.36, 0.28);
      const beak = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), art.plastic(0xff922b, { roughness: 0.45 }));
      beak.position.set(0, 0.32, 0.52);
      mesh.add(belly, head, beak);
    } else if (kind === 'float') {
      mass = 4.6;
      mesh = art.floatMesh();
      mesh.scale.setScalar(0.62);
    } else {
      mass = 1.05;
      shape = new CANNON.Box(new CANNON.Vec3(0.34, 0.34, 0.34));
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.68, 0.68), art.plastic(color, { roughness: 0.42 }));
    }
    const body = new CANNON.Body({
      mass,
      material: roomMat,
      linearDamping: 0.08,
      angularDamping: 0.12,
      allowSleep: true,
      sleepSpeedLimit: 0.2,
      sleepTimeLimit: 0.4,
      collisionFilterGroup: GROUP_PROP,
      collisionFilterMask: GROUP_RAG | GROUP_PROP | GROUP_STATIC,
    });
    if (kind === 'float') {
      const s = 0.62;
      body.addShape(new CANNON.Box(new CANNON.Vec3(1.7 * s, 0.16 * s, 0.85 * s)), new CANNON.Vec3(0, 0.28 * s, 0));
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.36 * s, 0.35 * s, 0.58 * s)), new CANNON.Vec3(-1.15 * s, 0.82 * s, 0));
      body.addShape(new CANNON.Sphere(0.42 * s), new CANNON.Vec3(0.15 * s, 1.2 * s, 0));
    } else body.addShape(shape);
    body.position.set(ROOM_OX + x, y, ROOM_OZ + z);
    body.gameRole = 'prop';
    addBody(body);
    mesh.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    room.root.add(mesh);
    const toy = { body, mesh, yell: yell || 'BONK!', kind };
    room.toys.push(toy);
    body.addEventListener('collide', (e) => onToyHit(body, toy, e));
    return toy;
  }

  function stockRoom() {
    const step = 0.72;
    for (let layer = 0; layer < 4; layer++) {
      const n = 4 - layer;
      const y = GROUND_Y + 0.38 + layer * step;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          spawnRoomToy(
            'block',
            -2.55 + (i - (n - 1) / 2) * step,
            y,
            4.55 + (j - (n - 1) / 2) * step,
            'BONK!',
          );
        }
      }
    }
    for (let i = 0; i < 3; i++) spawnRoomToy('crate', 3.55, GROUND_Y + 0.46 + i * 0.88, 3.4, 'WHAM!');
    for (let row = 0; row < 4; row++) {
      for (let c = 0; c <= row; c++) {
        spawnRoomToy('pin', -3.7 + (c - row / 2) * 0.42, GROUND_Y + 0.4, 3.35 + row * 0.42, 'CLACK!');
      }
    }
    spawnRoomToy('duck', -3.5, GROUND_Y + 0.7, 0.7, 'QUACK!');
    spawnRoomToy('duck', 3.25, GROUND_Y + 0.7, 1.05, 'QUACK!');
    spawnRoomToy('ball', 2.15, GROUND_Y + 0.72, -0.15, 'BOING!');
    spawnRoomToy('ball', -2.15, GROUND_Y + 1.6, 2.05, 'BOING!');
    for (let i = 0; i < 6; i++) {
      spawnRoomToy('block', -4.35, GROUND_Y + 0.4 + (i % 3) * 0.72, -1.1 + i * 0.82, 'YEET!');
      spawnRoomToy('block', 4.35, GROUND_Y + 0.4 + ((i + 1) % 3) * 0.72, -0.35 + i * 0.68, 'YEET!');
    }
  }

  function buildRoom(back) {
    destroyRoom();
    const group = new THREE.Group();
    scene.add(group);
    room = { root: group, bodies: [], toys: [], back };
    const floorMat = art.plastic(0xfff1c2, { roughness: 0.8 });
    const wallMats = [
      art.plastic(0xff5d73, { roughness: 0.48 }),
      art.plastic(0x4d96ff, { roughness: 0.48 }),
      art.plastic(0xffd93d, { roughness: 0.48 }),
      art.plastic(0xc77dff, { roughness: 0.48 }),
    ];
    roomSolid(ROOM_W, 0.5, ROOM_D, 0, GROUND_Y - 0.25, 0, floorMat, groundMat);
    const wallY = GROUND_Y + ROOM_H / 2;
    const thick = 0.42;
    roomSolid(ROOM_W + thick, ROOM_H, thick, 0, wallY, ROOM_D / 2, wallMats[0], buildingMat);
    roomSolid(thick, ROOM_H, ROOM_D + thick, ROOM_W / 2, wallY, 0, wallMats[1], buildingMat);
    roomSolid(thick, ROOM_H, ROOM_D + thick, -ROOM_W / 2, wallY, 0, wallMats[2], buildingMat);
    const gap = 2.9;
    const side = (ROOM_W - gap) / 2;
    const south = -ROOM_D / 2;
    roomSolid(side, ROOM_H, thick, -ROOM_W / 2 + side / 2, wallY, south, wallMats[3], buildingMat);
    roomSolid(side, ROOM_H, thick, ROOM_W / 2 - side / 2, wallY, south, wallMats[3], buildingMat);
    const z = south + 0.28;
    for (const x of [-1.55, 1.55]) {
      const post = new THREE.Mesh(box, entryMat);
      post.scale.set(0.18, 2.5, 0.18);
      post.position.set(ROOM_OX + x, GROUND_Y + 1.25, ROOM_OZ + z);
      post.castShadow = true;
      room.root.add(post);
    }
    const lintel = new THREE.Mesh(box, entryMat);
    lintel.scale.set(3.3, 0.18, 0.18);
    lintel.position.set(ROOM_OX, GROUND_Y + 2.5, ROOM_OZ + z);
    lintel.castShadow = true;
    room.root.add(lintel);
    const sign = new THREE.Mesh(plane, signTexture('EXIT', '#143d16', '#d8ff9a'));
    sign.scale.set(1.7, 0.62, 1);
    sign.position.set(ROOM_OX, GROUND_Y + 3.05, ROOM_OZ + z + 0.1);
    room.root.add(sign);
    const runner = new THREE.Mesh(plane, entryMat);
    runner.rotation.x = -Math.PI / 2;
    runner.scale.set(1.7, 6.6, 1);
    runner.position.set(ROOM_OX, GROUND_Y + 0.04, ROOM_OZ - 1.2);
    runner.receiveShadow = true;
    room.root.add(runner);
    stockRoom();
  }

  function findDoor(x, z) {
    for (const tile of tiles) {
      if (!tile.doors || !tile.doors.length) continue;
      const x0 = shiftX + tile.gx * CELL;
      const z0 = shiftZ + tile.gz * CELL;
      for (const door of tile.doors) {
        const dx = x - (x0 + door.lx);
        const dz = z - (z0 + door.lz);
        if (dx * dx + dz * dz < 1.15 * 1.15) {
          return { x: x0 + door.ox, z: z0 + door.oz, yaw: door.yaw };
        }
      }
    }
    return null;
  }

  function veilCity(hide) {
    if (!running) return;
    root.visible = !hide;
    weapons.shown(!hide);
  }

  function viewerInRoom() {
    return mirror ? viewerInside : indoors.has(ragdoll);
  }

  function evict(doll) {
    if (!doll || !indoors.has(doll)) return;
    indoors.delete(doll);
    roomReturn.delete(doll);
    roomGraceDolls.delete(doll);
    entryLock.set(doll, 1);
    if (room && indoors.size === 0) destroyRoom();
    if (doll === ragdoll) veilCity(false);
  }

  function queueExit(doll) {
    const back = roomReturn.get(doll) || (room && room.back) || { x: shiftX + 8, z: shiftZ + 8, yaw: Math.PI };
    indoors.delete(doll);
    roomReturn.delete(doll);
    roomGraceDolls.delete(doll);
    entryLock.set(doll, 1.1);
    gateQueue.push({ kind: 'exit', doll, x: back.x, z: back.z, yaw: back.yaw });
    if (room && indoors.size === 0) destroyRoom();
    if (doll === ragdoll) veilCity(false);
  }

  function enterRoom(doll, door) {
    if (!room) buildRoom({ x: door.x, z: door.z, yaw: door.yaw });
    roomReturn.set(doll, { x: door.x, z: door.z, yaw: door.yaw });
    indoors.add(doll);
    roomGraceDolls.set(doll, 0.65);
    const spread = (indoors.size - 1) * 0.65;
    gateQueue.push({
      kind: 'enter',
      doll,
      x: ROOM_OX + spread,
      z: ROOM_OZ + ROOM_SPAWN_Z,
      yaw: Math.PI,
    });
    if (doll === ragdoll) veilCity(true);
  }

  function watchEntry(dt) {
    if (mirror) return;
    for (const [doll, time] of entryLock) {
      const next = time - dt;
      if (next <= 0) entryLock.delete(doll);
      else entryLock.set(doll, next);
    }
    for (const doll of actors) {
      if (indoors.has(doll) || entryLock.has(doll)) continue;
      if (pilotOf(doll) || haulOf(doll)) continue;
      if (doll === ragdoll && (bust || ride)) continue;
      const actor = doll.walking() ? doll.mover() : doll.torso.body;
      if (actor.position.y > GROUND_Y + 2.4) continue;
      const door = findDoor(actor.position.x, actor.position.z);
      if (door) enterRoom(doll, door);
    }
  }

  function partLeftRoom(p) {
    const x = p.x - ROOM_OX;
    const z = p.z - ROOM_OZ;
    if (p.y > GROUND_Y + ROOM_H + 0.4) return true;
    if (Math.abs(x) > ROOM_W / 2 + 0.5 || Math.abs(z) > ROOM_D / 2 + 0.5) return true;
    const mouth = -ROOM_D / 2 + 1.05;
    const lip = -ROOM_D / 2 - 0.7;
    return Math.abs(x) < 1.55 && z < mouth && z > lip && p.y < GROUND_Y + ROOM_H;
  }

  function dollLeftRoom(doll) {
    if (doll.walking()) return partLeftRoom(doll.mover().position);
    return doll.parts.some((part) => partLeftRoom(part.body.position));
  }

  function stepRoom(dt) {
    if (!room) return;
    for (const doll of [...indoors]) {
      const grace = (roomGraceDolls.get(doll) || 0) - dt;
      if (grace > 0) {
        roomGraceDolls.set(doll, grace);
        continue;
      }
      roomGraceDolls.delete(doll);
      if (dollLeftRoom(doll)) queueExit(doll);
    }
    if (!room) return;
    for (const toy of room.toys) {
      const p = toy.body.position;
      const lx = p.x - ROOM_OX;
      const lz = p.z - ROOM_OZ;
      capVelocity(toy.body, 22);
      if (p.y < -3 || Math.abs(lx) > ROOM_W || Math.abs(lz) > ROOM_D + 1.2) {
        toy.body.position.set(
          ROOM_OX + rand(-1.2, 1.2) + (Math.random() < 0.5 ? -2.4 : 2.4),
          GROUND_Y + 2.2,
          ROOM_OZ + rand(2.4, 4.4),
        );
        toy.body.velocity.set(rand(-2, 2), 3, rand(-2, 2));
        toy.body.angularVelocity.set(rand(-4, 4), rand(-4, 4), rand(-4, 4));
        toy.body.wakeUp();
      }
    }
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }
  function round3(n) {
    return Math.round(n * 1000) / 1000;
  }
  function meshColor(mesh) {
    let color = 0xffd84a;
    mesh.traverse((obj) => {
      if (obj.isMesh && obj.material && obj.material.color) color = obj.material.color.getHex();
    });
    return color;
  }
  function freshGhost(mesh) {
    const ghost = {
      mesh,
      spin: 0,
      samples: [],
      vel: new THREE.Vector3(),
      spinRate: 0,
    };
    ghostRoot.add(mesh);
    return ghost;
  }
  function noteCarClock(stamp) {
    const local = performance.now() * 0.001;
    const time = typeof stamp === 'number' && Number.isFinite(stamp) ? stamp : local;
    if (hostOffset == null || time < lastHostStamp - 0.25) {
      hostOffset = time - local;
      for (const ghost of carGhosts.values()) ghost.samples.length = 0;
      for (const ghost of junkGhosts.values()) ghost.samples.length = 0;
      for (const motion of toyMotions) motion.samples.length = 0;
    } else {
      const delta = time - local - hostOffset;
      hostOffset += delta * (delta > 0 ? 0.35 : 0.05);
    }
    lastHostStamp = time;
    return time;
  }
  function pushCarSample(ghost, time, x, y, z, qx, qy, qz, qw, spin) {
    const samples = ghost.samples;
    const prev = samples.length ? samples[samples.length - 1] : null;
    if (prev && time <= prev.t) return;
    let px = qx;
    let py = qy;
    let pz = qz;
    let pw = qw;
    const wheel = spin || 0;
    if (prev) {
      const dot = prev.qx * qx + prev.qy * qy + prev.qz * qz + prev.qw * qw;
      if (dot < 0) {
        px = -qx;
        py = -qy;
        pz = -qz;
        pw = -qw;
      }
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dz = z - prev.z;
      if (dx * dx + dy * dy + dz * dz > CAR_SNAP * CAR_SNAP) {
        samples.length = 0;
        ghost.vel.set(0, 0, 0);
        ghost.spinRate = 0;
        ghost.mesh.position.set(x, y, z);
        ghost.mesh.quaternion.set(qx, qy, qz, qw);
        ghost.spin = wheel;
      } else {
        const span = Math.max(0.001, time - prev.t);
        ghost.vel.set(dx / span, dy / span, dz / span);
        ghost.spinRate = (wheel - prev.spin) / span;
      }
    }
    samples.push({ t: time, x, y, z, qx: px, qy: py, qz: pz, qw: pw, spin: wheel });
    if (samples.length > 8) samples.shift();
    if (samples.length === 1) {
      ghost.mesh.position.set(x, y, z);
      ghost.mesh.quaternion.set(qx, qy, qz, qw);
      ghost.spin = wheel;
    }
  }
  function poseCarGhost(ghost, now) {
    const samples = ghost.samples;
    if (!samples.length || hostOffset == null) return;
    const renderT = now + hostOffset - CAR_DELAY;
    while (samples.length >= 2 && samples[1].t <= renderT) samples.shift();
    const a = samples[0];
    if (samples.length < 2 || renderT <= a.t) {
      const extra = samples.length < 2 ? Math.max(0, Math.min(0.08, renderT - a.t)) : 0;
      ghost.mesh.position.set(
        a.x + ghost.vel.x * extra,
        a.y + ghost.vel.y * extra,
        a.z + ghost.vel.z * extra,
      );
      ghost.mesh.quaternion.set(a.qx, a.qy, a.qz, a.qw);
      ghost.spin = a.spin + ghost.spinRate * extra;
    } else {
      const b = samples[1];
      const span = Math.max(0.001, b.t - a.t);
      const u = Math.min(1, (renderT - a.t) / span);
      ghost.mesh.position.set(
        a.x + (b.x - a.x) * u,
        a.y + (b.y - a.y) * u,
        a.z + (b.z - a.z) * u,
      );
      ghostQA.set(a.qx, a.qy, a.qz, a.qw);
      ghostQB.set(b.qx, b.qy, b.qz, b.qw);
      ghost.mesh.quaternion.copy(ghostQA).slerp(ghostQB, u);
      ghost.spin = a.spin + (b.spin - a.spin) * u;
    }
    ghost.mesh.traverse((obj) => {
      if (obj.userData.wheel) obj.rotation.y = ghost.spin;
    });
  }
  function applyLayout(sx, sz, coords) {
    if (!coords || coords.length !== tiles.length) return false;
    const hard = Math.abs(sx - shiftX) > 0.2 || Math.abs(sz - shiftZ) > 0.2;
    shiftX = sx;
    shiftZ = sz;
    let changed = hard;
    for (let i = 0; i < tiles.length; i++) {
      const gx = coords[i][0];
      const gz = coords[i][1];
      if (tiles[i].gx !== gx || tiles[i].gz !== gz) {
        placeTile(tiles[i], gx, gz);
        changed = true;
      }
    }
    if (changed) {
      for (const tile of tiles) syncTile(tile);
    }
    syncDistrict();
    parkJail();
    return changed;
  }
  function applyCell(cell) {
    if (!jail) {
      const spot = jailAnchor();
      buildJail(spot.cx, spot.cz);
    } else parkJail();
    if (!cell || !jail) return;
    const mask = cell.b || '';
    const fresh = !cell.k && !mask.includes('1');
    const dirty = jail.breached || jail.bars.some((bar) => bar.gone || bar.hits > 0);
    if (fresh && dirty) {
      const spot = jailAnchor();
      buildJail(spot.cx, spot.cz);
      return;
    }
    if (mask.length !== jail.bars.length) return;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === '1' && !jail.bars[i].gone) dropBar(jail.bars[i]);
    }
    if (cell.k) {
      for (const side of ['south', 'east', 'west']) {
        if (gapOpen(side)) openPanel(side);
      }
      jail.breached = true;
    }
  }
  function applyBuildings(ids) {
    if (!ids) return;
    const live = new Set(ids);
    for (const tile of tiles) {
      for (const prop of tile.props || []) {
        if (prop.kind !== 'building' || !prop.id) continue;
        const show = live.has(prop.id);
        for (const mesh of prop.shells || []) mesh.visible = show;
      }
    }
  }
  function applyCars(list, stamp) {
    const seen = new Set();
    for (const row of list || []) {
      const [id, kindId, color, x, y, z, qx, qy, qz, qw, spin] = row;
      seen.add(id);
      let ghost = carGhosts.get(id);
      if (!ghost) {
        const kind = KINDS.find((entry) => entry.id === kindId) || KINDS[0];
        ghost = freshGhost(buildCar(kind, color));
        carGhosts.set(id, ghost);
      }
      pushCarSample(ghost, stamp, x, y, z, qx, qy, qz, qw, spin);
    }
    for (const [id, ghost] of carGhosts) {
      if (seen.has(id)) continue;
      ghost.mesh.removeFromParent();
      carGhosts.delete(id);
    }
  }
  function prizeGhost(kind, color) {
    if (kind === 'duck') return art.duckMesh();
    if (kind === 'pin') return art.pinMesh();
    if (kind === 'ball') return art.ballMesh();
    if (kind === 'float') return art.floatMesh();
    const mesh = new THREE.Mesh(box, paintOf(color || 0xffd84a));
    mesh.castShadow = true;
    return mesh;
  }
  function applyJunk(list, hard, stamp) {
    const seen = new Set();
    for (const row of list || []) {
      const [id, x, y, z, qx, qy, qz, qw, sx, sy, sz, color, kind] = row;
      seen.add(id);
      let ghost = junkGhosts.get(id);
      if (!ghost) {
        const mesh = prizeGhost(kind, color);
        ghost = freshGhost(mesh);
        junkGhosts.set(id, ghost);
      } else if (!kind && ghost.mesh.isMesh && ghost.mesh.material.color.getHex() !== color) {
        ghost.mesh.material = paintOf(color || 0xffd84a);
      }
      if (hard) {
        ghost.samples.length = 0;
        ghost.vel.set(0, 0, 0);
        ghost.spinRate = 0;
      }
      pushCarSample(ghost, stamp, x, y, z, qx, qy, qz, qw, 0);
      ghost.mesh.scale.set(sx || 1, sy || 1, sz || 1);
    }
    for (const [id, ghost] of junkGhosts) {
      if (seen.has(id)) continue;
      ghost.mesh.removeFromParent();
      junkGhosts.delete(id);
    }
  }
  function applyRoom(inside, back, toys, hard, stamp) {
    viewerInside = !!inside;
    if (inside && !room) {
      suspendCity();
      buildRoom(back || { x: 0, z: 0, yaw: 0 });
      hard = true;
    } else if (!inside && room) {
      destroyRoom();
      resumeCity();
      hard = true;
    }
    if (!room) toyMotions = [];
    if (room && toys && toys.length === room.toys.length) {
      if (toyMotions.length !== toys.length) {
        toyMotions = room.toys.map((toy) => ({
          mesh: toy.mesh,
          samples: [],
          vel: new THREE.Vector3(),
          spinRate: 0,
          spin: 0,
        }));
      }
      for (let i = 0; i < toys.length; i++) {
        const row = toys[i];
        const motion = toyMotions[i];
        if (hard) {
          motion.samples.length = 0;
          motion.vel.set(0, 0, 0);
          motion.spinRate = 0;
        }
        pushCarSample(motion, stamp, row[0], row[1], row[2], row[3], row[4], row[5], row[6], 0);
      }
    }
    if (mirror && room) {
      for (const tile of tiles) {
        for (const entry of tile.bodies) removeBody(entry.body);
      }
      if (ground && ground.world) removeBody(ground);
    }
  }

  function roofMeters(doll) {
    if (!doll || !running || indoors.has(doll) || pilotOf(doll)) return 0;
    const body = doll.walking() ? doll.mover() : doll.torso.body;
    if (!body || Math.abs(body.velocity.y) > 3.2) return 0;
    const feet = doll.walking() ? body.position.y - 0.95 : body.position.y - 0.4;
    if (feet < GROUND_Y + 2.4) return 0;
    const x = body.position.x;
    const z = body.position.z;
    let best = 0;
    for (const tile of tiles) {
      const ox = shiftX + tile.gx * CELL;
      const oz = shiftZ + tile.gz * CELL;
      for (const prop of tile.props || []) {
        if (prop.kind !== 'building') continue;
        const top = prop.ly + prop.hy;
        if (feet < top - 0.45 || feet > top + 1.8) continue;
        const minX = ox + prop.lx - prop.hx - 0.35;
        const maxX = ox + prop.lx + prop.hx + 0.35;
        const minZ = oz + prop.lz - prop.hz - 0.35;
        const maxZ = oz + prop.lz + prop.hz + 0.35;
        if (x < minX || x > maxX || z < minZ || z > maxZ) continue;
        const meters = top - GROUND_Y;
        if (meters > best) best = meters;
      }
    }
    return best;
  }

  function carsAloft() {
    let n = 0;
    for (const item of junk) {
      if (!item.car || !item.body) continue;
      const y = item.body.position.y;
      const vy = item.body.velocity.y;
      if (y > GROUND_Y + 4 || (y > GROUND_Y + 2.4 && Math.abs(vy) > 0.45)) n += 1;
    }
    return n;
  }

  return {
    active: () => running,
    hits: () => hits,
    roofMeters,
    carsAloft,
    holding: (doll) => weapons.kindIndex(armKey(doll || ragdoll)) >= 0,
    driveSpeed(doll) {
      const car = pilotOf(doll || ragdoll);
      return car ? Math.abs(car.speed) : 0;
    },
    walkerMaterial: () => walkMat,
    weaponLabel: () => weapons.label(),
    weaponName: (index) => weapons.labelAt(index),
    weaponBlurb: () => weapons.blurb(),
    putDown() {
      if (!running) return null;
      const body = ragdoll.mover();
      return weapons.release(body.position.x, body.position.z, ragdoll.facing(), 'local');
    },
    dropArm(doll) {
      if (!running || !doll) return null;
      const body = doll.mover();
      const kind = weapons.release(body.position.x, body.position.z, doll.facing(), armKey(doll));
      if (kind) onEvent({ callout: 'DOWN', who: doll, hint: true });
      return kind;
    },
    tick: (dt) => { if (running) weapons.tick(dt); },
    chop: () => weapons.chop(),
    chopOf: (doll) => weapons.chop(armKey(doll)),
    armState(doll) {
      const index = weapons.kindIndex(armKey(doll));
      if (index < 0) return null;
      return {
        index,
        chop: Math.round(weapons.chop(armKey(doll)) * 100) / 100,
      };
    },
    startSwing() {
      if (!running || mirror || ride) return false;
      if (bust && bust.phase === 'ride') return false;
      return weapons.startSwing('local');
    },
    swingArm(doll) {
      if (!running || mirror || !doll) return false;
      if (pilotOf(doll)) return false;
      if (bust && bust.phase === 'ride') return false;
      return weapons.startSwing(armKey(doll));
    },
    bounce,
    batter,
    driving: () => !!ride || !!viewerDrive,
    drivingDoll: (doll) => !!pilotOf(doll),
    nearCar: (doll) => {
      if (!doll || !doll.walking() || pilotOf(doll) || haulOf(doll)) return false;
      if (doll === ragdoll && bust && bust.phase) return false;
      return !!(closestCar(ENTRY_GAP, doll) || freshEntry(doll));
    },
    seatOf(doll) {
      const car = pilotOf(doll);
      if (!car) return null;
      return { yaw: car.yaw, speed: car.speed };
    },
    canHopIn: () => offer || viewerOffer,
    hopIn,
    hopOut,
    hopInDoll,
    hopOutDoll,
    pilot(nextGas, nextWheel) {
      gas = Math.max(-1, Math.min(1, nextGas || 0));
      wheel = Math.max(-1, Math.min(1, nextWheel || 0));
      if (ride) {
        ride.gas = gas;
        ride.wheel = wheel;
      }
    },
    pilotDoll(doll, nextGas, nextWheel) {
      const car = pilotOf(doll);
      if (!car || car === ride) return;
      car.gas = Math.max(-1, Math.min(1, nextGas || 0));
      car.wheel = Math.max(-1, Math.min(1, nextWheel || 0));
    },
    honk() {
      return this.honkDoll(ragdoll);
    },
    goose() {
      this.gooseDoll(ragdoll);
    },
    honkDoll(doll) {
      const car = pilotOf(doll);
      if (!car) return false;
      if (performance.now() < car.honkAt) return false;
      car.honkAt = performance.now() + 260;
      onEvent({ honk: true, who: doll === ragdoll ? undefined : doll });
      return true;
    },
    gooseDoll(doll) {
      const car = pilotOf(doll);
      if (!car) return;
      car.boost = Math.min(1.2, (car.boost || 0) + 0.38);
      if (performance.now() >= car.honkAt) {
        car.honkAt = performance.now() + 180;
        onEvent({ honk: true, who: doll === ragdoll ? undefined : doll });
      }
    },
    driveView() {
      if (ride) return { yaw: ride.yaw, speed: ride.speed, x: ride.px, z: ride.pz };
      return viewerDrive;
    },
    setViewerDrive(view) {
      viewerDrive = view && view.yaw != null ? { yaw: view.yaw, speed: view.speed || 0 } : null;
    },
    setViewerOffer(on) {
      viewerOffer = !!on;
    },
    locked: () => !!(bust && bust.phase === 'ride'),
    rideYaw() {
      if (bust && bust.phase === 'ride' && bust.car) return bust.car.yaw;
      return null;
    },
    heat() {
      if (!running) return '';
      if (bust && bust.phase === 'ride') return 'ride';
      if (bust && bust.phase === 'cell') return 'cell';
      if (viewerHold === 'ride' || viewerHold === 'cell') return viewerHold;
      if (wanted && suspects.includes(ragdoll) && !bust) return 'wanted';
      return '';
    },
    custody(doll) {
      const haul = haulOf(doll || ragdoll);
      return haul ? haul.phase : '';
    },
    setViewerHold(phase) {
      viewerHold = phase || '';
    },
    cellFrame() {
      const inside = (bust && bust.phase === 'cell') || viewerHold === 'cell';
      if (!running || !inside || !jail || jail.open) return null;
      const mover = ragdoll.mover();
      return {
        x: mover.position.x,
        y: GROUND_Y + 1.15,
        z: mover.position.z,
        camY: GROUND_Y + 1.75,
        minX: jail.cx - jail.viewX,
        maxX: jail.cx + jail.viewX,
        minZ: jail.cz - jail.viewZ,
        maxZ: jail.cz + jail.viewZ,
      };
    },
    roomView() {
      if (!room || !viewerInRoom()) return null;
      const wall = 0.42;
      const margin = 0.45;
      const innerX = ROOM_W / 2 - wall / 2 - margin;
      const innerZ = ROOM_D / 2 - wall / 2 - margin;
      return {
        minX: ROOM_OX - innerX,
        maxX: ROOM_OX + innerX,
        minZ: ROOM_OZ - innerZ,
        maxZ: ROOM_OZ + innerZ,
        minY: GROUND_Y + 1.2,
        maxY: GROUND_Y + ROOM_H - 0.75,
        dist: 4.4,
      };
    },
    interrupt() {
      if (ride) hopOut();
      if (bust && bust.phase === 'ride') return false;
      if (bust && bust.phase === 'cell') {
        leaveCell();
        grace = 1.2;
      }
      return true;
    },
    stepOut() {
      if (bust && bust.phase === 'ride') return false;
      if (ride) hopOut();
      evict(ragdoll);
      if (bust && bust.phase === 'cell') {
        leaveCell();
        grace = 1.2;
      }
      return true;
    },
    corner,
    begin,
    clear,
    respawn,
    indoor: () => viewerInRoom(),
    inRoom: (doll) => (mirror ? doll === ragdoll && viewerInside : indoors.has(doll || ragdoll)),
    evict,
    indoorSpawn: () => ({ x: ROOM_OX, z: ROOM_OZ + ROOM_SPAWN_Z, yaw: Math.PI }),
    consumeGate() {
      while (gateQueue.length) {
        const gate = gateQueue.shift();
        if (gate.doll && !actors.includes(gate.doll)) continue;
        return gate;
      }
      return null;
    },
    queueToyWave,
    dumpToys(pos) {
      if (!running) return;
      const lx = pos.x - ROOM_OX;
      const lz = pos.z - ROOM_OZ;
      if (room && Math.abs(lx) < ROOM_W / 2 && Math.abs(lz) < ROOM_D / 2) {
        for (let i = 0; i < 8; i++) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 0.4 + Math.random() * 2.2;
          spawnRoomToy(
            'block',
            lx + Math.cos(angle) * radius,
            GROUND_Y + 2.2 + Math.random() * 2,
            lz + Math.sin(angle) * radius,
            'BONK!',
          );
        }
        onEvent({
          callout: 'TOYS!',
          pos: { x: pos.x, y: pos.y + 1, z: pos.z },
          burst: 'toys',
          shake: 0.12,
        });
        return;
      }
      for (let i = 0; i < 7; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.8 + Math.random() * 2.6;
        spawnJunk(pos.x + Math.cos(angle) * radius, pos.z + Math.sin(angle) * radius);
      }
      onEvent({
        callout: 'TRASH!',
        pos: { x: pos.x, y: pos.y + 1, z: pos.z },
        burst: 'toys',
        shake: 0.1,
      });
    },
    prePhysics(dt) {
      if (!running) return;
      pumpWaves(dt);
      for (const car of cars) {
        if (car.driven) {
          roll(car, dt, car.gas || 0, car.wheel || 0, false);
          continue;
        }
        if (car.loose) {
          roll(car, dt, 0, 0, true);
          continue;
        }
        if (car.pursuit) {
          drivePursuit(car, dt);
          continue;
        }
        if (car.rogue) {
          driveRogue(car, dt);
          continue;
        }
        if (car.turning) {
          driveTurn(car, dt);
          continue;
        }
        if (car.loop) {
          driveLoop(car, dt);
          if (car.turning) driveTurn(car, dt);
          continue;
        }
        if (approachLoop(car)) {
          if (car.turning) driveTurn(car, dt);
          continue;
        }
        car.speed = car.dir * car.cruise * followFactor(car);
        syncCar(car);
        car.body.velocity.set(car.axis === 'x' ? car.speed : 0, 0, car.axis === 'z' ? car.speed : 0);
        car.body.angularVelocity.set(0, 0, 0);
        car.body.wakeUp();
      }
      plow();
      holdInmate();
      holdDriver();
    },
    post(dt, torso) {
      if (!running || !torso) return null;
      for (const car of cars) {
        if (car.pilot && !car.pilot.walking()) releaseFor(car.pilot);
      }
      for (const doll of actors) {
        if (indoors.has(doll)) continue;
        if (!doll.walking() || pilotOf(doll) || haulOf(doll)) continue;
        if (doll === ragdoll && bust && bust.phase) continue;
        const landed = roofCar(doll);
        if (landed) claimFor(doll, landed);
      }
      const pickedFor = [];
      for (const doll of actors) {
        if (indoors.has(doll) || !doll.walking() || pilotOf(doll)) continue;
        const body = doll.mover();
        const picked = weapons.tryPickup(body.position.x, body.position.z, armKey(doll));
        if (picked) pickedFor.push({ doll, picked, body });
      }
      for (const grab of pickedFor) {
        onEvent({
          callout: `${grab.picked.label} ${grab.picked.blurb}`,
          who: grab.doll,
          pos: { x: grab.body.position.x, y: grab.body.position.y + 1.1, z: grab.body.position.z },
          burst: 'toys',
          shake: 0.08,
          pickup: true,
        });
      }
      slash();
      if (indoors.has(ragdoll)) refillWeapons(prey.x, prey.z);
      else refillWeapons(torso.position.x, torso.position.z);
      const actor = ragdoll.walking() ? ragdoll.mover() : torso;
      if (!indoors.has(ragdoll)) noteDistrict(actor.position.x, actor.position.z);
      const airborne = !ragdoll.walking() && (Math.abs(torso.velocity.y) > 2.4 || torso.position.y > GROUND_Y + 2.4);
      const hunting = rogueAlive();
      if (indoors.has(ragdoll)) {
        stillTime = 0;
        campSet = false;
        prey.still = false;
      } else if (airborne) {
        prey.x = actor.position.x;
        prey.z = actor.position.z;
        stillTime = 0;
        campSet = false;
        prey.still = false;
      } else {
        prey.x = actor.position.x;
        prey.z = actor.position.z;
        if (!campSet) {
          campX = prey.x;
          campZ = prey.z;
          campSet = true;
        }
        const campDx = prey.x - campX;
        const campDz = prey.z - campZ;
        prey.still = campDx * campDx + campDz * campDz < 1.6 * 1.6;
        if (!hunting && !shared) {
          if (prey.still) stillTime += dt;
          else {
            campX = prey.x;
            campZ = prey.z;
            stillTime = 0;
          }
        }
      }
      if (!shared && !hunting && stillTime >= STILL_SECONDS) {
        stillTime = 0;
        summonCrazy(prey.x, prey.z);
      }
      const gone = [];
      for (const car of cars) {
        if (car.hop) car.hop = Math.max(0, car.hop - dt * 1.6);
        if (car.rogue) {
          car.spin += car.speed * dt * 1.6;
          if (car.pursuit || car.driven || car.loose) continue;
          const dx = car.px - car.aimX;
          const dz = car.pz - car.aimZ;
          if (car.life > 6 || (car.passed && dx * dx + dz * dz > 20 * 20)) gone.push(car);
          continue;
        }
        if (car.loop || car.turning) {
          car.spin += car.speed * dt * 1.6;
          continue;
        }
        if (car.axis === 'z') car.travel = car.body.position.z;
        else car.travel = car.body.position.x;
        car.spin += car.speed * dt * 1.6;
      }
      for (const car of gone) removeCar(car);
      grace = Math.max(0, grace - dt);
      if (wanted) {
        for (const car of cars) tryGrab(car);
      }
      rattleBars(dt);
      watchExit();
      if (wanted && grace <= 0 && freeSuspects().length && !cars.some((car) => car.pursuit)) {
        wanted = false;
        suspects = [];
        onEvent({ callout: 'LOST THEM!', hint: true, pos: { x: torso.position.x, y: torso.position.y + 1.4, z: torso.position.z } });
      }
      untangle();
      watchEntry(dt);
      stepRoom(dt);
      let localEntry = null;
      for (const doll of entryMemory.keys()) {
        if (!actors.includes(doll)) entryMemory.delete(doll);
      }
      for (const doll of actors) {
        if (indoors.has(doll)) {
          entryMemory.delete(doll);
          continue;
        }
        const car = trackEntry(doll);
        if (doll === ragdoll) localEntry = car;
      }
      const nextOffer = !ride && !!localEntry;
      if (nextOffer !== offer) {
        offer = nextOffer;
        onEvent({ hint: true });
      }
      let streetX = torso.position.x;
      let streetZ = torso.position.z;
      if (indoors.has(ragdoll)) {
        let spot = null;
        for (const doll of actors) {
          if (indoors.has(doll)) continue;
          spot = doll.walking() ? doll.mover().position : doll.torso.body.position;
          break;
        }
        streetX = spot ? spot.x : prey.x;
        streetZ = spot ? spot.z : prey.z;
      }
      sky.position.set(streetX, GROUND_Y, streetZ);
      farGround.position.x = streetX;
      farGround.position.z = streetZ;
      const moved = recenter();
      containActors();
      for (const car of cars) {
        if (car.rogue) {
          if (car.driven) continue;
          const dx = car.body.position.x - streetX;
          const dz = car.body.position.z - streetZ;
          if (dx * dx + dz * dz < 64 && performance.now() > car.honkAt) {
            car.honkAt = performance.now() + 700;
            onEvent({ honk: true });
          }
          continue;
        }
        if (car.loop || car.turning) {
          const dx = car.body.position.x - streetX;
          const dz = car.body.position.z - streetZ;
          if (dx * dx + dz * dz < 42 && Math.random() < dt * 0.12 && performance.now() > car.honkAt) {
            car.honkAt = performance.now() + 1400;
            onEvent({ honk: true });
          }
          continue;
        }
        const remain = (stemGate(car).travel - car.travel) * car.dir;
        if (remain < -0.04) car.travel = stemGate(car).travel;
        syncCar(car);
        const dx = car.body.position.x - streetX;
        const dz = car.body.position.z - streetZ;
        if (dx * dx + dz * dz < 42 && Math.random() < dt * 0.18 && performance.now() > car.honkAt) {
          car.honkAt = performance.now() + 1100;
          onEvent({ honk: true });
        }
      }
      for (let i = junk.length - 1; i >= 0; i--) {
        const item = junk[i];
        const p = item.body.position;
        const dx = p.x - streetX;
        const dz = p.z - streetZ;
        capVelocity(item.body, item.yeet ? 40 : item.roadkill ? 22 : 16);
        const limit = item.roadkill ? 78 : 46;
        if (p.y < -4 || dx * dx + dz * dz > limit * limit) {
          removeBody(item.body);
          item.mesh.removeFromParent();
          junk.splice(i, 1);
        }
      }
      return indoors.has(ragdoll) ? null : moved;
    },
    sync() {
      if (!running) return;
      const phase = phaseOf();
      paintSignal(nsLens, phase.z);
      paintSignal(ewLens, phase.x);
      const tee = junctionPhase();
      paintSignal(loopLens, tee.loop);
      paintSignal(stemLens, tee.stem);
      if (mirror) return;
      const blink = Math.sin(performance.now() * 0.02) > 0;
      sirenRed.emissiveIntensity = blink ? 2.8 : 0.15;
      sirenBlue.emissiveIntensity = blink ? 0.15 : 2.8;
      for (const car of cars) {
        if (car.driven || car.loose) plantCar(car);
        car.mesh.position.set(car.body.position.x, car.body.position.y + (car.hop || 0), car.body.position.z);
        car.mesh.quaternion.set(car.body.quaternion.x, car.body.quaternion.y, car.body.quaternion.z, car.body.quaternion.w);
        car.mesh.traverse((obj) => {
          if (obj.userData.wheel) obj.rotation.y = car.spin;
        });
      }
      for (const item of junk) {
        item.mesh.position.set(item.body.position.x, item.body.position.y, item.body.position.z);
        item.mesh.quaternion.set(item.body.quaternion.x, item.body.quaternion.y, item.body.quaternion.z, item.body.quaternion.w);
      }
      if (room) {
        for (const toy of room.toys) {
          toy.mesh.position.set(toy.body.position.x, toy.body.position.y, toy.body.position.z);
          toy.mesh.quaternion.set(toy.body.quaternion.x, toy.body.quaternion.y, toy.body.quaternion.z, toy.body.quaternion.w);
        }
      }
      if (jail) {
        for (const item of jail.loose) {
          item.mesh.position.copy(item.body.position);
          item.mesh.quaternion.set(item.body.quaternion.x, item.body.quaternion.y, item.body.quaternion.z, item.body.quaternion.w);
        }
      }
      for (const doll of actors) {
        weapons.pose(handOf(doll), doll.facing(), doll.walking(), armKey(doll));
      }
    },
    setActors(list) {
      actors = list && list.length ? list : [ragdoll];
      for (const doll of [...indoors]) {
        if (!actors.includes(doll)) evict(doll);
      }
    },
    wearPlayers(players, dollFor) {
      if (!mirror) {
        weapons.wear([]);
        return;
      }
      const specs = [];
      for (const pose of players || []) {
        if (!pose || pose.arm == null || pose.arm < 0) continue;
        const doll = dollFor(pose.id);
        if (!doll) continue;
        specs.push({
          id: pose.id,
          index: pose.arm,
          chop: pose.chop || 0,
          hand: handOf(doll),
          yaw: doll.facing(),
          walking: doll.walking(),
        });
      }
      weapons.wear(specs);
    },
    setShared(on) {
      shared = !!on;
      if (shared) {
        stillTime = 0;
        prey.still = false;
      }
    },
    setMirror(on) {
      const next = !!on;
      if (mirror && !next) {
        hostOffset = null;
        lastHostStamp = -1;
        for (const ghost of carGhosts.values()) ghost.mesh.removeFromParent();
        carGhosts.clear();
        for (const ghost of junkGhosts.values()) ghost.mesh.removeFromParent();
        junkGhosts.clear();
      }
      mirror = next;
      if (!mirror) return;
      for (const car of cars.splice(0, cars.length)) {
        removeBody(car.body);
        car.mesh.removeFromParent();
      }
      ride = null;
      for (const item of junk.splice(0, junk.length)) {
        removeBody(item.body);
        item.mesh.removeFromParent();
      }
    },
    capture() {
      const ids = [];
      for (const tile of tiles) {
        for (const prop of tile.props || []) {
          if (prop.kind === 'building' && prop.id) ids.push(prop.id);
        }
      }
      buildingKey = ids.join('|');
      return {
        sx: round2(shiftX),
        sz: round2(shiftZ),
        tiles: tiles.map((tile) => [tile.gx, tile.gz]),
        buildings: ids,
        cars: cars.map((car) => [
          car.id,
          car.mesh.userData.kind,
          car.mesh.userData.color,
          round2(car.body.position.x),
          round2(car.body.position.y + (car.hop || 0)),
          round2(car.body.position.z),
          round3(car.body.quaternion.x),
          round3(car.body.quaternion.y),
          round3(car.body.quaternion.z),
          round3(car.body.quaternion.w),
          round2(car.spin),
        ]),
        junk: junk.map((item) => {
          if (item.netId == null) item.netId = nextJunkId++;
          return [
            item.netId,
            round2(item.body.position.x),
            round2(item.body.position.y),
            round2(item.body.position.z),
            round3(item.body.quaternion.x),
            round3(item.body.quaternion.y),
            round3(item.body.quaternion.z),
            round3(item.body.quaternion.w),
            round2(item.mesh.scale.x || 1),
            round2(item.mesh.scale.y || 1),
            round2(item.mesh.scale.z || 1),
            meshColor(item.mesh),
            item.toy || '',
          ];
        }),
        drops: weapons.layout(),
        inside: !!room,
        back: room ? room.back : null,
        toys: room ? room.toys.map((toy) => [
          round2(toy.body.position.x),
          round2(toy.body.position.y),
          round2(toy.body.position.z),
          round3(toy.body.quaternion.x),
          round3(toy.body.quaternion.y),
          round3(toy.body.quaternion.z),
          round3(toy.body.quaternion.w),
        ]) : null,
        hits,
        cell: jail ? {
          b: jail.bars.map((bar) => (bar.gone ? '1' : '0')).join(''),
          k: jail.breached ? 1 : 0,
        } : null,
      };
    },
    present(city, viewerInRoom) {
      if (!city || !mirror) return false;
      const stamp = noteCarClock(city.time);
      const hard = applyLayout(city.sx || 0, city.sz || 0, city.tiles);
      applyBuildings(city.buildings);
      applyCars(city.cars, stamp);
      applyJunk(city.junk, hard, stamp);
      weapons.show(city.drops || []);
      applyRoom(!!viewerInRoom, city.back, city.toys, hard, stamp);
      applyCell(city.cell);
      if (typeof city.hits === 'number') hits = city.hits;
      return hard;
    },
    hostStamp: () => lastHostStamp,
    renderTime() {
      if (hostOffset == null) return null;
      return performance.now() * 0.001 + hostOffset - CAR_DELAY;
    },
    glide() {
      if (!mirror) return;
      const now = performance.now() * 0.001;
      for (const ghost of carGhosts.values()) poseCarGhost(ghost, now);
      for (const ghost of junkGhosts.values()) poseCarGhost(ghost, now);
      for (const motion of toyMotions) poseCarGhost(motion, now);
    },
  };
}
