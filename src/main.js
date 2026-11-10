import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createArena } from './arena.js';
import { createArt } from './art.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createProps } from './props.js';
import { createRagdoll } from './ragdoll.js';
import { createStairs } from './stairs.js';
import { createStreets } from './streets.js';
import { ARENA_R, clamp, GROUND_Y, rand } from './util.js';

const SAVE_KEY = 'ragdoll-playground';
const PLAY_KEY = 'ragdoll-playground-playing';
const LEVEL_KEY = 'ragdoll-playground-level';
const BADGES = [
  { id: 'wrecking', icon: '🎳', name: 'Wrecking Ball', desc: 'Knock over 50 blocks in 10 seconds' },
  { id: 'masher', icon: '🔥', name: 'Button Masher', desc: 'Hit MAX CHAOS 3 times' },
  { id: 'air', icon: '🕊️', name: 'Airborne Menace', desc: 'Stay off the ground for 5 seconds' },
  { id: 'duck', icon: '🦆', name: 'Duck Hunter', desc: 'Launch a giant rubber duck into orbit' },
  { id: 'heli', icon: '🚁', name: 'Human Helicopter', desc: 'Spin at max speed while flailing' },
  { id: 'drop', icon: '🌀', name: 'Down the Spiral', desc: 'Fall 200 meters on Sky Stairs' },
];

const canvas = document.querySelector('#view');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc5e8ff, 24, 78);
const toyFog = scene.fog;
const stairsFog = new THREE.Fog(0xffc9a0, 16, 76);
const cityFog = new THREE.Fog(0xf6c59a, 14, 64);
const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 260);

const art = createArt(renderer);
scene.environment = art.envMap;
if ('environmentIntensity' in scene) scene.environmentIntensity = 0.55;

const hemi = new THREE.HemisphereLight(0xfff6df, 0x8fd0ff, 0.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfffaf0, 2.6);
sun.position.set(12, 22, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 48;
sun.shadow.camera.left = -ARENA_R - 2;
sun.shadow.camera.right = ARENA_R + 2;
sun.shadow.camera.top = ARENA_R + 2;
sun.shadow.camera.bottom = -ARENA_R - 2;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.045;
scene.add(sun);
scene.add(sun.target);
const chaosLight = new THREE.PointLight(0xff7722, 0, 8, 2);
scene.add(chaosLight);

const sunSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: art.soft,
    color: 0xfff1b8,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
sunSprite.position.set(40, 34, -28);
sunSprite.scale.set(28, 28, 1);
scene.add(sunSprite);

const { world, groundMat, ragMat, toyMat, bouncyMat, rubberMat, ragGround } = createWorld();
const sfx = createAudio();
const particles = createParticles(scene, art.soft);
const ragdoll = createRagdoll(world, scene, art, ragMat);

const save = loadSave();
const unlocked = new Set(save.badges.filter((id) => BADGES.some((b) => b.id === id)));
let score = 0;
let best = save.best || 0;
let bestDrop = save.bestDrop || 0;
let levelId = 'chicken';
let menuOpen = true;
let nextMark = 50;
let streak = 0;
let combo = 0;
let lastScoreAt = 0;
let charge = 0;
let maxChaosTimer = 0;
let chaosCooldown = 0;
let chaosBursts = 0;
let airTime = 0;
let heliTime = 0;
let trapped = false;
let trapCharge = 0;
let trapImmunity = 0;
let gravityOn = true;
let started = false;
let launchLock = 0;
let streetBounce = 0;
let bounceVX = 0;
let bounceVZ = 0;
let faceYaw = 0;
let walkPhase = 0;
let ragdollHit = false;
let hitStyle = null;
let fallLock = 0;
let lastFlailAt = 0;
let flails = 0;
let frameCount = 0;
let physicsAccum = 0;
let lastLand = 0;
let spinSign = 1;
let spinSignUntil = 0;
let popupsThisFrame = 0;
let shakeMag = 0;
let yaw = 0.55;
let pitch = 0.46;
let distance = 8.4;
let panX = 0;
let panY = 0;
let panZ = 0;
let simTime = 0;
let flailHeld = false;
let swingHeld = false;
let jumpHeld = false;
let gpJumpWas = false;
let lastJumpAt = 0;
let lastSupportAt = 0;
let chickenAirJumps = 2;
let fps = 60;
const stickVec = { x: 0, y: 0 };
const keys = new Set();
const knocks = [];
const look = new THREE.Vector3(0, 2, 0);
const desiredLook = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const launchDir = { x: 0, y: 0, z: 1 };

const arena = createArena({
  world,
  scene,
  art,
  groundMat,
  bouncyMat,
  toyMat,
  onBounce: (pos) => {
    sfx.boing();
    particles.burst(pos.x, pos.y, pos.z, {
      colors: [0xfff6b0, 0xffffff, 0xb8f5ff],
      count: 14,
      speed: 3,
      life: 0.4,
      gravity: 6,
      up: 2,
    });
    shake(0.08);
  },
  onHammer: (impact, pos, dir, headHit) => {
    handleImpact({
      impact: impact + (headHit ? 6 : 2),
      pos,
      item: { type: 'hammer', body: { id: -1 } },
      direct: true,
      flair: headHit ? 'WHAM!' : 'BONK!',
    });
    const power = headHit ? 36 : 16;
    const pop = headHit ? 8 : 4;
    const body = ragdoll.torso.body;
    body.velocity.x = dir.x * power;
    body.velocity.y = pop;
    body.velocity.z = dir.z * power;
    body.angularVelocity.x += dir.z * 10;
    body.angularVelocity.y += (Math.random() - 0.5) * 8;
    body.angularVelocity.z -= dir.x * 10;
    for (const limb of ragdoll.limbs) {
      limb.body.velocity.x = dir.x * power;
      limb.body.velocity.y = pop * 0.85;
      limb.body.velocity.z = dir.z * power;
      limb.body.angularVelocity.x += (Math.random() - 0.5) * 14;
      limb.body.angularVelocity.y += (Math.random() - 0.5) * 10;
      limb.body.angularVelocity.z += (Math.random() - 0.5) * 14;
      limb.body.wakeUp();
    }
    body.wakeUp();
    launchLock = headHit ? 0.7 : 0.35;
    shake(headHit ? 0.46 : 0.16);
    if (headHit) callout('WHAM!');
  },
  onLaunch: (dir, pos) => {
    const body = ragdoll.torso.body;
    body.velocity.x = dir.x * 22;
    body.velocity.y = dir.y * 16 + 8;
    body.velocity.z = dir.z * 22;
    for (const limb of ragdoll.limbs) {
      limb.body.velocity.x += dir.x * 10;
      limb.body.velocity.y += 5;
      limb.body.velocity.z += dir.z * 10;
      limb.body.wakeUp();
    }
    launchLock = 0.55;
    sfx.launch();
    shake(0.35);
    callout('BLAST OFF!');
    particles.burst(pos.x, pos.y, pos.z, {
      colors: [0xfff1a8, 0xff8a3d, 0xffffff],
      count: 28,
      speed: 7,
      life: 0.5,
      gravity: 4,
      up: 2,
    });
  },
});

const props = createProps({
  world,
  scene,
  art,
  toyMat,
  rubberMat,
  targets: ragdoll.targets,
  onImpact: handleImpact,
});
props.populate();

const stairs = createStairs({
  world,
  scene,
  art,
  ragdoll,
  toyMat,
  rubberMat,
  bouncyMat,
  ragMat,
  onEvent: onStairEvent,
});
const streets = createStreets({
  world,
  scene,
  art,
  ragdoll,
  groundMat,
  ragMat,
  toyMat,
  onEvent: onStreetEvent,
});
const sunHome = sunSprite.position.clone();
const logoSub = document.querySelector('#logo span');

for (const hammer of arena.hammers) {
  hammer.mesh.userData.body = hammer.body;
  ragdoll.targets.push(hammer.mesh);
}

const blob = new THREE.Mesh(
  new THREE.CircleGeometry(0.95, 24),
  new THREE.MeshBasicMaterial({
    map: art.soft,
    transparent: true,
    depthWrite: false,
    color: 0x102033,
    opacity: 0.28,
  }),
);
blob.rotation.x = -Math.PI / 2;
blob.position.y = GROUND_Y + 0.035;
scene.add(blob);

const dropEl = document.querySelector('#drop');
const scoreEl = document.querySelector('#score');
const comboEl = document.querySelector('#combo');
const bestEl = document.querySelector('#best');
const chaosFill = document.querySelector('#chaos-fill');
const chaosWrap = document.querySelector('#chaos-wrap');
const badgeTray = document.querySelector('#badges');
const toastHost = document.querySelector('#toasts');
const popupHost = document.querySelector('#popups');
const trapBanner = document.querySelector('#trap-banner');
const trapFill = document.querySelector('#trap-fill');
const maxBanner = document.querySelector('#max-banner');
const calloutEl = document.querySelector('#callout');
const splash = document.querySelector('#splash');
const hintEl = document.querySelector('#hint');
const hintStatus = document.querySelector('#hint-status');
const hintToggle = document.querySelector('#hint-toggle');
const HINT_MIN_KEY = 'ragdoll-controls-min';

function setHint(line) {
  const text = line || '';
  hintStatus.textContent = text;
  hintStatus.hidden = !text;
}

function hintIsMin() {
  if (hintEl.classList.contains('is-min')) return true;
  if (hintEl.classList.contains('is-open')) return false;
  return window.matchMedia('(max-width: 860px)').matches;
}

function applyHintMin(min, persist) {
  hintEl.classList.toggle('is-min', min);
  hintEl.classList.toggle('is-open', !min);
  hintToggle.setAttribute('aria-expanded', min ? 'false' : 'true');
  if (!persist) return;
  try { sessionStorage.setItem(HINT_MIN_KEY, min ? '1' : '0'); } catch { /* private mode */ }
}

try {
  const saved = sessionStorage.getItem(HINT_MIN_KEY);
  const narrow = window.matchMedia('(max-width: 860px)').matches;
  applyHintMin(saved === '1' || (saved !== '0' && narrow), false);
} catch {
  applyHintMin(window.matchMedia('(max-width: 860px)').matches, false);
}
hintToggle.addEventListener('click', () => applyHintMin(!hintIsMin(), true));
const gravBtn = document.querySelector('#btn-grav');
const muteBtn = document.querySelector('#btn-mute');

const popups = createPopups(popupHost, camera);
renderBadges();
updateScoreHud(false);

world.addEventListener('beginContact', (e) => {
  const a = e.bodyA;
  const b = e.bodyB;
  const rag = a.gameRole === 'ragdoll' ? a : b.gameRole === 'ragdoll' ? b : null;
  const other = rag === a ? b : rag ? a : null;
  if (!rag || !other) return;
  if (other.gameRole !== 'static' && other.gameRole !== 'tramp') return;
  const speed = Math.abs(rag.velocity.y);
  const now = performance.now();
  if (speed > 5 && now - lastLand > 180) {
    lastLand = now;
    sfx.land(speed);
    particles.burst(rag.position.x, rag.position.y, rag.position.z, {
      colors: [0xfff8ef, 0xf0d0a0, 0xffffff],
      count: 10,
      speed: 2.2,
      life: 0.35,
      gravity: 7,
      up: 0.6,
    });
    shake(Math.min(0.2, speed * 0.01));
  }
});

const playBtn = document.querySelector('#btn-play');
playBtn.addEventListener('click', () => {
  if (started) {
    closeMenu();
    sfx.ui();
    return;
  }
  launchLevel();
  sfx.ui();
});
document.querySelector('#btn-toys').addEventListener('click', () => {
  if (!started || menuOpen) return;
  const p = ragdoll.torso.body.position;
  if (fallLevel()) stairs.dumpToys(p);
  else if (streetLevel()) streets.dumpToys(p);
  else {
    props.spawnPile(p.x, p.z);
    callout('TOY DROP!');
  }
  sfx.ui();
});
document.querySelector('#btn-reset').addEventListener('click', () => {
  if (!started) return;
  resetRagdoll();
  sfx.ui();
});
gravBtn.addEventListener('click', () => {
  if (!started) return;
  toggleGravity();
});
muteBtn.addEventListener('click', () => {
  const muted = sfx.toggleMute();
  muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  if (!muted) sfx.start();
});

const jumpBtn = document.querySelector('#btn-jump');
jumpBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  jumpBtn.setPointerCapture(e.pointerId);
  jumpHeld = true;
  jumpBtn.classList.add('held');
  tryJump();
});
function releaseJump() {
  jumpHeld = false;
  jumpBtn.classList.remove('held');
}
jumpBtn.addEventListener('pointerup', releaseJump);
jumpBtn.addEventListener('pointercancel', releaseJump);

const flailBtn = document.querySelector('#btn-flail');
flailBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  flailBtn.setPointerCapture(e.pointerId);
  flailBtn.classList.add('held');
  if (streetLevel()) {
    swingHeld = true;
    trySwing(true);
  } else {
    flailHeld = true;
    tryFlail(null, true);
  }
});
flailBtn.addEventListener('pointerup', releaseFlail);
flailBtn.addEventListener('pointercancel', releaseFlail);

const stick = document.querySelector('#stick');
const knob = document.querySelector('#knob');
let stickId = null;
stick.addEventListener('pointerdown', (e) => {
  stick.setPointerCapture(e.pointerId);
  stickId = e.pointerId;
  moveStick(e);
});
stick.addEventListener('pointermove', (e) => {
  if (e.pointerId !== stickId) return;
  moveStick(e);
});
stick.addEventListener('pointerup', endStick);
stick.addEventListener('pointercancel', endStick);

const pointers = new Map();
let pinchPrev = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (!started) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, button: e.button, moved: false });
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const prevPinch = pinchDistance();
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (Math.hypot(p.x - p.ox, p.y - p.oy) > 7) p.moved = true;
  if (pointers.size >= 2) {
    const next = pinchDistance();
    if (prevPinch > 0 && next > 0) distance = clamp(distance * (prevPinch / next), 3.4, 30);
    pinchPrev = next;
    return;
  }
  if (p.button === 2 || e.shiftKey) {
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const scale = distance * 0.0022;
    panX += -dx * scale * rx + dy * scale * fx * 0.15;
    panZ += -dx * scale * rz + dy * scale * fz * 0.15;
    panY += dy * scale * 0.35;
    const plen = Math.hypot(panX, panY, panZ);
    if (plen > 6) {
      const s = 6 / plen;
      panX *= s;
      panY *= s;
      panZ *= s;
    }
  } else if (p.button === 0 || e.pointerType === 'touch') {
    yaw -= dx * 0.007;
    pitch = clamp(pitch + dy * 0.005, 0.2, 1.25);
  }
});
canvas.addEventListener('pointerup', (e) => {
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchPrev = 0;
  if (!pointers.size) canvas.classList.remove('dragging');
  if (p && !p.moved && p.button === 0 && started) poke(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  if (!pointers.size) canvas.classList.remove('dragging');
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  if (!started) return;
  e.preventDefault();
  distance = clamp(distance + e.deltaY * 0.008, 3.4, 30);
}, { passive: false });
canvas.addEventListener('dblclick', () => {
  yaw = 0.55;
  pitch = 0.46;
  distance = 8.4;
  panX = panY = panZ = 0;
});

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (menuOpen) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      playBtn.click();
    }
    if (e.code === 'Escape' && started) closeMenu();
    return;
  }
  if (!started) return;
  if (e.code === 'Escape') {
    openMenu();
    return;
  }
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyF' || e.code === 'KeyJ' || e.code === 'KeyK') tryFlail(null, true);
  if (e.code === 'KeyE' || e.code === 'Slash' || e.key === '?') trySwing(true);
  if (e.code === 'KeyY' && streetLevel()) {
    const dropped = streets.putDown();
    if (dropped) {
      callout('DOWN');
      sfx.drop();
      streetHint();
    }
  }
  if (e.code === 'Space') tryJump();
  if (e.code === 'KeyR') resetRagdoll();
  if (e.code === 'KeyG') toggleGravity();
  if (e.code === 'KeyT') {
    const p = ragdoll.torso.body.position;
    if (fallLevel()) stairs.dumpToys(p);
    else if (streetLevel()) streets.dumpToys(p);
    else {
      props.spawnPile(p.x, p.z);
      callout('TOY DROP!');
    }
  }
  if (e.code === 'KeyM') muteBtn.click();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  flailHeld = false;
  swingHeld = false;
  releaseJump();
  endStick();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let last = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fpsAccum += dt;
  fpsFrames += 1;
  if (fpsAccum >= 0.5) {
    fps = fpsFrames / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
  }
  step(dt);
  renderer.render(scene, camera);
});

function step(dt) {
  frameCount += 1;
  popupsThisFrame = 0;
  if (menuOpen && started) {
    const torso = ragdoll.torso.body;
    ragdoll.sync(simTime, charge, maxChaosTimer > 0);
    if (fallLevel()) stairs.sync(dt, torso);
    else if (streetLevel()) streets.sync();
    else arena.sync(dt, simTime);
    updateCamera(dt, torso);
    popups.update(dt);
    return;
  }
  simTime += dt;
  launchLock = Math.max(0, launchLock - dt);
  streetBounce = Math.max(0, streetBounce - dt);
  fallLock = Math.max(0, fallLock - dt);
  trapImmunity = Math.max(0, trapImmunity - dt);

  const torso = ragdoll.torso.body;
  const gp = pollGamepad();
  if (!started) yaw += dt * 0.16;
  else {
    const cuffed = streetLevel() && streets.locked();
    if (!trapped && !cuffed) steer(dt, gp);
    if (!cuffed && (gp.flail || flailHeld || keys.has('KeyF') || keys.has('KeyJ') || keys.has('KeyK'))) {
      tryFlail(null, false);
    }
    if (!cuffed && (swingHeld || keys.has('KeyE') || keys.has('Slash'))) trySwing(false);
    if (!cuffed && gp.jump && !gpJumpWas) tryJump();
    gpJumpWas = !!gp.jump;
    if (ragdoll.isSupported(world)) {
      lastSupportAt = performance.now();
      if (streetLevel()) chickenAirJumps = 2;
    }
    let lookX = gp.lookX;
    let lookY = gp.lookY;
    if (keys.has('ArrowLeft')) lookX -= 1;
    if (keys.has('ArrowRight')) lookX += 1;
    if (keys.has('ArrowUp')) lookY -= 1;
    if (keys.has('ArrowDown')) lookY += 1;
    lookX = clamp(lookX, -1, 1);
    lookY = clamp(lookY, -1, 1);
    yaw -= lookX * dt * 2.4;
    pitch = clamp(pitch + lookY * dt * 1.6, 0.2, 1.25);
  }

  const inMud = (levelId === 'straight' && stairs.snagged())
    || arena.mudAt(torso.position.x, torso.position.y, torso.position.z);
  if (trapImmunity > 0) trapped = false;
  else if (trapped && !inMud) {
    trapped = false;
    trapCharge = 0;
  } else if (!trapped && inMud) {
    trapped = true;
    trapCharge = 0;
    sfx.stuck();
    callout('STUCK!');
  }
  if (trapped) {
    trapCharge = Math.max(0, trapCharge - dt * 3.2);
    for (const part of ragdoll.parts) {
      part.body.velocity.x *= 0.84;
      part.body.velocity.z *= 0.84;
      part.body.velocity.y *= 0.7;
      part.body.angularVelocity.scale(0.86, part.body.angularVelocity);
    }
  }

  if (maxChaosTimer > 0) {
    maxChaosTimer -= dt;
    charge = 1;
    if (maxChaosTimer <= 0) {
      charge = 0.16;
      chaosCooldown = 0.45;
    }
  } else if (performance.now() - lastFlailAt > 140) {
    charge = Math.max(0, charge - dt * 0.34);
  }
  chaosCooldown = Math.max(0, chaosCooldown - dt);
  if (!gravityOn) world.gravity.set(0, 0, 0);
  else if (levelId === 'straight') {
    world.gravity.set(0, maxChaosTimer > 0 ? -8 : -13, 0);
  } else if (levelId === 'stairs') {
    const g = -14 - Math.min(8, stairs.meters() / 90);
    world.gravity.set(0, maxChaosTimer > 0 ? g * 0.62 : g, 0);
  } else {
    world.gravity.set(0, maxChaosTimer > 0 ? -6.5 : -12, 0);
  }

  const fixed = 1 / 60;
  physicsAccum = Math.min(0.05, physicsAccum + dt);
  let steps = 0;
  const carried = streetLevel() && !ragdoll.walking() ? ragdoll.slide() : null;
  while (physicsAccum >= fixed && steps < 3) {
    if (fallLevel()) stairs.prePhysics(fixed, started ? torso : null);
      if (streetLevel()) streets.prePhysics(fixed);
    arena.prePhysics(fixed, simTime, started ? torso : null, launchLock);
    ragdoll.lockWalker();
    if (streetBounce > 0 && ragdoll.walking()) {
      const mover = ragdoll.mover();
      mover.velocity.x = 0;
      mover.velocity.z = 0;
    }
    assistBalance();
    world.step(fixed);
    physicsAccum -= fixed;
    steps += 1;
  }
  if (carried) ragdoll.carry(carried);
  arena.applyBounces();
  const fastFall = fallLevel();
  const linCap = maxChaosTimer > 0 ? 40 : launchLock > 0 && levelId === 'toybox' ? 42 : levelId === 'chicken' ? 36 : levelId === 'straight' ? 16 : levelId === 'stairs' ? 24 : 26;
  const angCap = maxChaosTimer > 0 ? 26 : levelId === 'chicken' ? 24 : fastFall ? 22 : 18;
  ragdoll.clampSpeeds(linCap, angCap);

  if (streetLevel()) streets.tick(dt);
  if (streetLevel() && ragdoll.walking()) {
    const mover = ragdoll.mover();
    if (streets.locked()) {
      const face = streets.rideYaw();
      if (face != null) faceYaw = face;
      ragdoll.poseWalker(faceYaw, walkPhase, 0, dt, 0);
    } else {
    const freshBounce = streetBounce <= 0;
    if (streets.bounce(mover)) {
      if (freshBounce) {
        bounceVX = mover.velocity.x;
        bounceVZ = mover.velocity.z;
      }
      streetBounce = 0.36;
    }
    if (streetBounce > 0) {
      mover.position.x += bounceVX * dt;
      mover.position.z += bounceVZ * dt;
      mover.previousPosition.copy(mover.position);
      mover.velocity.x = bounceVX;
      mover.velocity.z = bounceVZ;
    }
    const speed = Math.hypot(mover.velocity.x, mover.velocity.z);
    const grounded = ragdoll.isSupported(world);
    const gait = !grounded ? 0.12 : speed < 0.35 ? 0 : Math.min(1, 0.55 + speed / 10);
    walkPhase += Math.max(speed * 0.85, gait > 0 ? 3.1 : 0) * dt;
    if (speed > 0.45 && streetBounce <= 0 && launchLock <= 0) {
      const target = Math.atan2(mover.velocity.x, mover.velocity.z);
      let turn = target - faceYaw;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      faceYaw += turn * (1 - Math.exp(-12 * dt));
    }
    ragdoll.poseWalker(faceYaw, walkPhase, gait, dt, streets.chop());
    }
  }

  if (streetLevel() && ragdollHit && !streets.locked()) {
    ragdoll.knock(hitStyle || undefined);
    ragdollHit = false;
    hitStyle = null;
    tumbleGrip(true);
  }

  const blown = ragdoll.spread() > (streetLevel() ? 9 : 4.5);
  if (!Number.isFinite(torso.position.x) || blown) {
    if ((fastFall || streetLevel()) && Number.isFinite(torso.position.x)) rescueDoll();
    else resetRagdoll();
  } else if (!fastFall && torso.position.y < -6 && fallLock <= 0) {
    if (streetLevel()) rescueDoll();
    else resetRagdoll();
    fallLock = 1;
    if (!streetLevel()) callout('Back in the toy box!');
  } else if (!fastFall && torso.position.y > 48) {
    torso.velocity.y = Math.min(torso.velocity.y, 8);
  }

  if (streetLevel()) {
    const moved = streets.post(dt, torso);
    if (moved) {
      particles.shift(moved.dx, 0, moved.dz);
      popups.shift(moved.dx, 0, moved.dz);
      look.x += moved.dx;
      look.z += moved.dz;
    }
    const gate = streets.consumeGate();
    if (gate) arrive(gate);
  }

  if (fastFall) {
    const moved = stairs.post(dt, torso);
    if (moved) {
      particles.shift(moved.dx, moved.dy, moved.dz);
      popups.shift(moved.dx, moved.dy, moved.dz);
    }
    const meters = Math.floor(stairs.meters());
    if (meters >= nextMark) {
      const mark = Math.floor(meters / 50) * 50;
      callout(`${mark} METERS`);
      nextMark = mark + 50;
    }
    if (meters >= 200) unlock('drop');
    if (meters > bestDrop) {
      bestDrop = meters;
      persist();
    }
    if (torso.velocity.y < -12) {
      streak += dt;
      if (streak > 0.09) {
        streak = 0;
        particles.burst(torso.position.x, torso.position.y + 0.4, torso.position.z, {
          colors: [0xffffff, 0xfff1c2, 0xffd0ea],
          count: 3,
          speed: 0.5,
          life: 0.22,
          gravity: 0,
          up: 0,
        });
      }
    }
  }

  props.update(dt, torso.position);

  const supported = ragdoll.isSupported(world);
  if (!started || supported) airTime = 0;
  else airTime += dt;
  if (airTime >= 5) unlock('air');

  const spin = torso.angularVelocity.length();
  const flailing = started && flails > 0 && performance.now() - lastFlailAt < 380;
  if (spin > 14 && flailing) heliTime += dt;
  else heliTime = Math.max(0, heliTime - dt * 1.4);
  if (heliTime > 0.5) unlock('heli');

  if (performance.now() - lastScoreAt > comboWindow() && combo !== 0) {
    combo = 0;
    updateComboHud();
  }

  ragdoll.sync(simTime, charge, maxChaosTimer > 0);
  arena.sync(dt, simTime);
  if (fallLevel()) stairs.sync(dt, torso);
  if (streetLevel()) streets.sync();
  if (charge > 0.4 || maxChaosTimer > 0) {
    particles.burst(torso.position.x, torso.position.y + 0.2, torso.position.z, {
      colors: [0xfff1a8, 0xff7a18, 0xff3355],
      count: maxChaosTimer > 0 ? 7 : 2,
      speed: maxChaosTimer > 0 ? 4 : 2,
      life: 0.35,
      gravity: 2,
      up: 1.4,
    });
  }
  particles.update(dt);

  const height = torso.position.y - GROUND_Y;
  const shade = clamp(1 - (height - 0.7) / 5.5, 0, 1);
  blob.position.x = torso.position.x;
  blob.position.z = torso.position.z;
  blob.scale.setScalar(0.75 + (1 - shade) * 1.1);
  blob.material.opacity = 0.3 * shade;

  chaosLight.position.set(torso.position.x, torso.position.y + 0.4, torso.position.z);
  chaosLight.intensity = maxChaosTimer > 0 ? 36 : charge * 22;
  chaosLight.color.setHex(maxChaosTimer > 0 ? 0xfff1c2 : 0xff6a22);

  updateCamera(dt, torso);
  updateHud();
  popups.update(dt);
}

const balanceUp = new CANNON.Vec3();
const balanceTorque = new CANNON.Vec3();

const HOLD = {
  torso: 180,
  head: 36,
  thighL: 90,
  thighR: 90,
  shinL: 70,
  shinR: 70,
  footL: 34,
  footR: 34,
  uArmL: 12,
  uArmR: 12,
  lArmL: 8,
  lArmR: 8,
  handL: 4,
  handR: 4,
};

function assistBalance() {
  if (ragdoll.walking() || streetLevel() || fallLevel() || trapped || maxChaosTimer > 0 || launchLock > 0 || (lastFlailAt > 0 && performance.now() - lastFlailAt < 700)) return;
  for (const part of ragdoll.parts) {
    const strength = HOLD[part.name];
    if (!strength) continue;
    const body = part.body;
    balanceUp.set(0, 1, 0);
    body.quaternion.vmult(balanceUp, balanceUp);
    balanceTorque.set(-balanceUp.z * strength, 0, balanceUp.x * strength);
    body.applyTorque(balanceTorque);
    body.angularVelocity.x *= 0.8;
    body.angularVelocity.z *= 0.8;
  }
  const torso = ragdoll.torso.body;
  const sink = ragdoll.torso.spawn.y - torso.position.y;
  if (sink > 0.12) {
    torso.force.y += sink * 160;
    if (torso.velocity.y > 1.6) torso.velocity.y = 1.6;
  }
}

function steer(dt, gp) {
  if (streetBounce > 0) return;
  if (launchLock > 0 && (levelId === 'toybox' || levelId === 'chicken')) return;
  let ix = 0;
  let iy = 0;
  if (keys.has('KeyA')) ix -= 1;
  if (keys.has('KeyD')) ix += 1;
  if (keys.has('KeyW')) iy -= 1;
  if (keys.has('KeyS')) iy += 1;
  ix = clamp(ix + stickVec.x + gp.x, -1, 1);
  iy = clamp(iy + stickVec.y + gp.y, -1, 1);
  const mag = Math.hypot(ix, iy);
  if (mag < 0.12) return;
  const scale = Math.min(1, mag) / mag;
  const sx = ix * scale;
  const sy = iy * scale;
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const wishX = rightX * sx + forwardX * -sy;
  const wishZ = rightZ * sx + forwardZ * -sy;
  const supported = ragdoll.isSupported(world);
  const stair = levelId === 'stairs';
  const wide = levelId === 'straight';
  const street = levelId === 'chicken';
  const speed = trapped ? 1.3 : supported ? (street ? 11 : wide ? 5.2 : stair ? 6 : 7.4) : (street ? 3.6 : wide ? 3.4 : stair ? 10.5 : 4.4);
  const k = 1 - Math.exp(-(supported ? 7 : 3) * dt);
  const body = ragdoll.mover();
  if (street && ragdoll.walking()) {
    body.velocity.x = wishX * speed;
    body.velocity.z = wishZ * speed;
  } else {
    body.velocity.x += (wishX * speed - body.velocity.x) * k;
    body.velocity.z += (wishZ * speed - body.velocity.z) * k;
  }
  body.wakeUp();
}

function hopBody(torso, hop) {
  if (torso.velocity.y < hop) torso.velocity.y = hop;
  if (ragdoll.walking()) ragdoll.noteFlap();
  else {
    for (const limb of ragdoll.limbs) {
      if (limb.body.velocity.y < hop * 0.55) limb.body.velocity.y = hop * 0.55;
      limb.body.wakeUp();
    }
  }
  torso.wakeUp();
}

function tryJump() {
  if (!started || menuOpen) return;
  if (streetLevel() && streets.locked()) return;
  const now = performance.now();
  if (now - lastJumpAt < 280) return;
  if (streetLevel() && !ragdoll.walking()) {
    standChicken();
    lastJumpAt = now;
    sfx.bawk();
    const p = ragdoll.mover().position;
    particles.burst(p.x, p.y, p.z, {
      colors: [0xffd84a, 0xfff6d0, 0xffffff],
      count: 12,
      speed: 3.2,
      life: 0.32,
      gravity: 6,
      up: 2.2,
    });
    return;
  }
  const torso = ragdoll.mover();
  let tier = 0;
  if (fallLevel()) {
    if (!stairs.hop(torso)) return;
  } else if (ragdoll.isSupported(world) || now - lastSupportAt < 140) {
    hopBody(torso, levelId === 'chicken' ? 7.4 : 8);
  } else if (streetLevel() && chickenAirJumps > 0) {
    chickenAirJumps -= 1;
    tier = chickenAirJumps === 1 ? 1 : 2;
    hopBody(torso, tier === 1 ? 10.2 : 13.2);
    callout(tier === 1 ? 'DOUBLE!' : 'TRIPLE!');
  } else return;
  lastJumpAt = now;
  lastSupportAt = 0;
  sfx.boing();
  if (levelId === 'chicken') sfx.bawk();
  const p = torso.position;
  const bursts = [
    { colors: [0xffe14a, 0xffffff, 0xc9e4ff], count: 10, speed: 3, up: 2 },
    { colors: [0xffd84a, 0xfff6d0, 0xffffff], count: 16, speed: 4.2, up: 3.2 },
    { colors: [0xfff6b0, 0xffffff, 0xffd0ea], count: 24, speed: 5.4, up: 4.4 },
  ];
  const burst = bursts[tier];
  particles.burst(p.x, p.y, p.z, {
    colors: burst.colors,
    count: burst.count,
    speed: burst.speed,
    life: 0.28 + tier * 0.06,
    gravity: 6,
    up: burst.up,
  });
}

function trySwing(tapped) {
  if (!started || !streetLevel() || streets.locked()) return;
  if (streets.startSwing()) {
    sfx.flail();
    return;
  }
  if (tapped && !streets.weaponLabel()) sfx.bawk();
}

function tryFlail(body, tapped) {
  if (!started) return;
  if (streetLevel() && streets.locked()) return;
  const now = performance.now();
  if (now - lastFlailAt < (tapped ? 32 : 72)) return;
  lastFlailAt = now;
  flails += 1;
  if (now > spinSignUntil) {
    spinSign = Math.random() < 0.5 ? -1 : 1;
    spinSignUntil = now + 700;
  }
  const limb = ragdoll.walking() ? ragdoll.torso : ragdoll.flail(body, spinSign);
  if (ragdoll.walking()) {
    ragdoll.noteFlap();
    const hop = ragdoll.mover();
    if (hop.velocity.y < 2.4) hop.velocity.y += 1.5;
  }
  if (trapped) {
    const v = ragdoll.torso.body.velocity;
    v.y *= 0.28;
    trapCharge += 1;
    if (trapCharge >= 8) breakFree();
  }
  if (streetLevel() && streets.heat() === 'cell') streets.batter();
  if (maxChaosTimer <= 0) {
    charge = Math.min(1, charge + (tapped ? 0.07 : 0.055));
    if (charge >= 1 && chaosCooldown <= 0) triggerMaxChaos();
  }
  if (levelId === 'stairs') {
    const body = ragdoll.torso.body;
    body.angularVelocity.x += (Math.random() - 0.5) * 7;
    body.angularVelocity.z += (Math.random() - 0.5) * 7;
    body.velocity.x += (Math.random() - 0.5) * 1.6;
    body.velocity.z += (Math.random() - 0.5) * 1.6;
  } else if (levelId === 'straight') {
    const body = ragdoll.torso.body;
    body.angularVelocity.x += (Math.random() - 0.5) * 4;
    body.angularVelocity.z += (Math.random() - 0.5) * 4;
  }
  if (levelId === 'chicken' && tapped) sfx.bawk();
  sfx.flail();
  shake(maxChaosTimer > 0 ? 0.07 : 0.02);
  const p = limb.body.position;
  particles.burst(p.x, p.y, p.z, {
    colors: [0xfff6d8, 0xffd0ea, 0xc9e4ff],
    count: 8,
    speed: 2.4,
    life: 0.32,
    gravity: 4,
    up: 1,
  });
}

function triggerMaxChaos() {
  if (trapped) breakFree();
  maxChaosTimer = 2.8;
  chaosBursts += 1;
  charge = 1;
  const len = Math.hypot(-Math.sin(yaw), -Math.cos(yaw)) || 1;
  launchDir.x = -Math.sin(yaw) / len;
  launchDir.y = 0;
  launchDir.z = -Math.cos(yaw) / len;
  if (ragdoll.walking()) {
    const b = ragdoll.mover();
    b.velocity.x += launchDir.x * 18;
    b.velocity.z += launchDir.z * 18;
    b.velocity.y = Math.max(b.velocity.y, 12);
    b.wakeUp();
  } else ragdoll.launch(launchDir, spinSign);
  sfx.chaos();
  shake(0.55);
  showMaxBanner();
  const p = ragdoll.torso.body.position;
  particles.burst(p.x, p.y, p.z, {
    colors: [0xfff6b0, 0xff5d73, 0xfff, 0x7ad0ff],
    count: 48,
    speed: 8,
    life: 0.8,
    gravity: 6,
    up: 4,
  });
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && pads[0];
  gp?.vibrationActuator?.playEffect?.('dual-rumble', {
    duration: 260,
    strongMagnitude: 0.85,
    weakMagnitude: 1,
  })?.catch?.(() => {});
  if (chaosBursts >= 3) unlock('masher');
}

function breakFree() {
  trapped = false;
  trapCharge = 0;
  trapImmunity = 1.45;
  const body = ragdoll.torso.body;
  body.velocity.y += 8;
  body.velocity.x += (Math.random() - 0.5) * 4;
  body.velocity.z += (Math.random() - 0.5) * 4;
  sfx.pop();
  shake(0.28);
  callout('FREEDOM!');
  particles.burst(body.position.x, body.position.y, body.position.z, {
    colors: [0x9dffc9, 0xfff6b0, 0xffffff],
    count: 24,
    speed: 5,
    life: 0.5,
    gravity: 6,
    up: 3,
  });
}

function handleImpact({ impact, pos, item, direct, flair, duckOrbit }) {
  if (duckOrbit) {
    unlock('duck');
    addScore(220, pos, impact, 'ORBIT!');
    sfx.launch();
    particles.burst(pos.x, pos.y, pos.z, {
      colors: [0xffd000, 0xfff6b0, 0xffffff, 0xff7a18],
      count: 30,
      speed: 6,
      life: 0.7,
      gravity: 5,
      up: 2,
    });
    return;
  }
  const base = (direct ? 12 : 7) + impact * (direct ? 6.5 : 3.5);
  addScore(base, pos, impact, flair);
  sfx.impact(impact);
  particles.burst(pos.x, pos.y, pos.z, {
    colors: impact > 10 ? [0xfff3a0, 0xff5d73, 0xffffff] : [0xfff3a0, 0xffffff],
    count: impact > 8 ? 14 : 6,
    speed: 2 + impact * 0.12,
    life: 0.4,
    gravity: 8,
    up: 1,
  });
  if (impact > 8) shake(Math.min(0.28, impact * 0.012));
  if (item && props.knockTypes.has(item.type) && impact > 2.8) registerKnock(item);
}

function addScore(base, pos, impact, flair) {
  const now = performance.now();
  if (now - lastScoreAt > comboWindow()) combo = 0;
  combo += 1;
  lastScoreAt = now;
  const mult = currentMult();
  const pts = Math.max(1, Math.round(base * mult));
  score += pts;
  if (score > best) {
    best = score;
    persist();
  }
  if (popupsThisFrame < 12) {
    popups.spawn(pos, flair ? `${flair} +${pts}` : `+${pts}`, flair ? 'smash' : 'plus');
    popupsThisFrame += 1;
    if (!flair && impact > 10 && popupsThisFrame < 12) {
      popups.spawn({ x: pos.x, y: pos.y + 0.45, z: pos.z }, impact > 14 ? 'SMASH!' : 'POW!', impact > 14 ? 'smash' : 'pow');
      popupsThisFrame += 1;
    }
    if (combo > 1 && combo % 6 === 0 && popupsThisFrame < 12) {
      popups.spawn({ x: pos.x, y: pos.y + 0.75, z: pos.z }, `x${mult} COMBO`, 'combo');
      popupsThisFrame += 1;
    }
  }
  updateScoreHud(true);
}

function currentMult() {
  const fromCombo = Math.min(15, 1 + Math.floor(Math.max(0, combo - 1) / 2));
  return fromCombo * (maxChaosTimer > 0 ? 3 : 1);
}

function registerKnock(item) {
  const now = performance.now();
  knocks.push({ id: item.body.id, t: now });
  while (knocks.length && now - knocks[0].t > 10000) knocks.shift();
  const ids = new Set();
  for (const knock of knocks) {
    if (now - knock.t <= 10000) ids.add(knock.id);
  }
  if (ids.size >= 50) unlock('wrecking');
}

function unlock(id) {
  if (!started || streetLevel() || unlocked.has(id)) return;
  const badge = BADGES.find((b) => b.id === id);
  if (!badge) return;
  unlocked.add(id);
  persist();
  renderBadges();
  sfx.badge();
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = document.createElement('span');
  icon.className = 'ticon';
  icon.textContent = badge.icon;
  const copy = document.createElement('div');
  const title = document.createElement('b');
  title.textContent = badge.name;
  const detail = document.createElement('small');
  detail.textContent = badge.desc;
  copy.append(title, detail);
  toast.append(icon, copy);
  toastHost.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add('out');
    window.setTimeout(() => toast.remove(), 260);
  }, 2600);
}

function tumbleGrip(loose) {
  ragGround.friction = loose ? 0.14 : 0.6;
  ragGround.restitution = loose ? 0.16 : 0.02;
}

function standChicken() {
  if (!streetLevel() || ragdoll.walking()) {
    tumbleGrip(false);
    return;
  }
  const torso = ragdoll.torso.body;
  const vx = torso.velocity.x;
  const vz = torso.velocity.z;
  ragdoll.place(torso.position.x, ragdoll.torso.spawn.y, torso.position.z);
  ragdoll.setWalker(true);
  const mover = ragdoll.mover();
  mover.material = streets.walkerMaterial();
  for (let i = 0; i < 4; i++) {
    if (!streets.bounce(mover)) break;
  }
  mover.velocity.set(vx, 0, vz);
  for (const part of ragdoll.parts) {
    part.body.linearDamping = 0.14;
    part.body.angularDamping = 0.24;
  }
  ragdoll.poseWalker(faceYaw, walkPhase, 0, 0);
  launchLock = 0;
  tumbleGrip(false);
}

function resetRagdoll() {
  if (fallLevel()) {
    restartStairs();
    return;
  }
  if (streetLevel()) {
    if (streets.indoor()) {
      const pose = streets.indoorSpawn();
      ragdoll.place(pose.x, ragdoll.torso.spawn.y, pose.z);
      standChicken();
      faceYaw = pose.yaw;
      trapped = false;
      trapCharge = 0;
      trapImmunity = 0.4;
      launchLock = 0.3;
      return;
    }
    if (!streets.interrupt()) return;
    const pose = streets.respawn(ragdoll.torso.body.position);
    ragdoll.place(pose.x, ragdoll.torso.spawn.y, pose.z);
    standChicken();
    trapped = false;
    trapCharge = 0;
    trapImmunity = 0.4;
    launchLock = 0.3;
    return;
  }
  ragdoll.reset();
  trapped = false;
  trapCharge = 0;
  trapImmunity = 0.4;
  launchLock = 0.3;
}

function rescueDoll() {
  if (streetLevel()) {
    if (streets.indoor()) {
      const pose = streets.indoorSpawn();
      ragdoll.place(pose.x, ragdoll.torso.spawn.y, pose.z);
      standChicken();
      faceYaw = pose.yaw;
      trapped = false;
      trapCharge = 0;
      trapImmunity = 0.35;
      launchLock = 0.25;
      return;
    }
    const pose = streets.respawn(ragdoll.torso.body.position);
    ragdoll.place(pose.x, ragdoll.torso.spawn.y, pose.z);
    standChicken();
  } else {
    const pose = stairs.rescue(ragdoll.torso.body.position);
    ragdoll.place(pose.x, pose.y, pose.z);
    ragdoll.torso.body.velocity.set(pose.vx, pose.vy, pose.vz);
  }
  trapped = false;
  trapCharge = 0;
  trapImmunity = 0.35;
  launchLock = 0.25;
}

function toggleGravity() {
  gravityOn = !gravityOn;
  gravBtn.textContent = gravityOn ? 'GRAVITY ON' : 'GRAVITY OFF';
  for (const body of world.bodies) body.wakeUp();
  sfx.ui();
  callout(gravityOn ? 'GRAVITY ON' : 'ZERO GRAVITY');
}

function fallLevel() {
  return levelId === 'stairs' || levelId === 'straight';
}

function streetLevel() {
  return levelId === 'chicken';
}

function comboWindow() {
  return fallLevel() ? 3400 : 2200;
}

function freshRun() {
  score = 0;
  combo = 0;
  charge = 0;
  maxChaosTimer = 0;
  trapped = false;
  trapCharge = 0;
  airTime = 0;
  heliTime = 0;
  streak = 0;
  knocks.length = 0;
  updateScoreHud(false);
}

function setFloppy(on) {
  for (const part of ragdoll.parts) {
    part.body.linearDamping = on ? 0.05 : 0.22;
    part.body.angularDamping = on ? 0.16 : 0.38;
  }
}

function applyLook(mode) {
  if (mode === 'stairs') {
    scene.fog = stairsFog;
    camera.far = 340;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    blob.visible = false;
  } else if (mode === 'chicken') {
    scene.fog = cityFog;
    camera.far = 180;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    blob.visible = true;
  } else {
    scene.fog = toyFog;
    camera.far = 260;
    sun.position.set(12, 22, 8);
    sun.target.position.set(0, 0, 0);
    sunSprite.position.copy(sunHome);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 48;
    sun.shadow.camera.left = -ARENA_R - 2;
    sun.shadow.camera.right = ARENA_R + 2;
    sun.shadow.camera.top = ARENA_R + 2;
    sun.shadow.camera.bottom = -ARENA_R - 2;
    blob.visible = true;
  }
  sun.shadow.camera.updateProjectionMatrix();
  camera.updateProjectionMatrix();
}

function restartStairs() {
  const pose = stairs.begin();
  ragdoll.place(pose.x, pose.y, pose.z);
  ragdoll.torso.body.velocity.set(pose.vx, pose.vy, pose.vz);
  trapped = false;
  trapCharge = 0;
  trapImmunity = 0.4;
  launchLock = 0.35;
  nextMark = 50;
  freshRun();
}

function launchLevel() {
  levelId = 'chicken';
  started = true;
  menuOpen = false;
  splash.hidden = true;
  try {
    sessionStorage.setItem(PLAY_KEY, '1');
    sessionStorage.setItem(LEVEL_KEY, levelId);
  } catch { /* private mode */ }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  freshRun();
  tumbleGrip(false);
  sfx.start();
  if (fallLevel()) {
    streets.clear();
    ragdoll.setWalker(false);
    ragdoll.setCostume('doll');
    arena.setActive(false);
    props.setActive(false);
    setFloppy(true);
    const pose = stairs.begin(levelId === 'straight' ? 'straight' : 'spiral');
    ragdoll.place(pose.x, pose.y, pose.z);
    ragdoll.torso.body.velocity.set(pose.vx, pose.vy, pose.vz);
    applyLook('stairs');
    panX = panY = panZ = 0;
    nextMark = 50;
    dropEl.hidden = false;
    if (levelId === 'straight') {
      yaw = -1.25;
      pitch = 0.62;
      distance = 18;
      logoSub.textContent = 'STAIR FALL';
      setHint('');
      flailBtn.textContent = 'FLAIL';
      callout('DOWN!');
    } else {
      yaw = 0.35;
      pitch = 0.82;
      distance = 13;
      logoSub.textContent = 'SKY STAIRS';
      setHint('');
      flailBtn.textContent = 'FLAIL';
      callout('FALL!');
    }
  } else if (streetLevel()) {
    stairs.clear();
    arena.setActive(false);
    props.setActive(false);
    setFloppy(false);
    for (const part of ragdoll.parts) {
      part.body.linearDamping = 0.14;
      part.body.angularDamping = 0.24;
    }
    ragdoll.setCostume('chicken');
    ragdoll.setWalker(true);
    ragdoll.mover().material = streets.walkerMaterial();
    faceYaw = Math.PI;
    walkPhase = 0;
    streetBounce = 0;
    chickenAirJumps = 2;
    ragdollHit = false;
    hitStyle = null;
    tumbleGrip(false);
    const pose = streets.begin();
    ragdoll.place(pose.x, ragdoll.torso.spawn.y, pose.z);
    applyLook('chicken');
    yaw = 0.15;
    pitch = 0.78;
    distance = 12;
    panX = panY = panZ = 0;
    dropEl.hidden = false;
    logoSub.textContent = 'BOOM BOOM';
    flailBtn.textContent = 'SWING';
    streetHint();
    callout('BUKAWK!');
  } else {
    stairs.clear();
    streets.clear();
    ragdoll.setWalker(false);
    ragdoll.setCostume('doll');
    arena.setActive(true);
    props.setActive(true);
    setFloppy(false);
    ragdoll.reset();
    applyLook('toybox');
    yaw = 0.55;
    pitch = 0.46;
    distance = 8.4;
    panX = panY = panZ = 0;
    logoSub.textContent = 'PLAYGROUND';
    setHint('Drag the scene to orbit');
    flailBtn.textContent = 'FLAIL';
    dropEl.hidden = true;
    callout('GO!');
  }
  const p = ragdoll.torso.body.position;
  particles.burst(p.x, p.y + 0.6, p.z, {
    colors: [0xff5d73, 0xffe14a, 0x4d96ff, 0x6bcb77, 0xffffff],
    count: 36,
    speed: 6,
    life: 0.8,
    gravity: 7,
    up: 3,
  });
  badgeTray.hidden = streetLevel();
  updateScoreHud(false);
}

function openMenu() {
  menuOpen = true;
  keys.clear();
  flailHeld = false;
  swingHeld = false;
  releaseJump();
  endStick();
  document.documentElement.removeAttribute('data-resume');
  playBtn.textContent = started ? 'BACK TO THE STREET' : 'PLAY';
  splash.hidden = false;
}

function closeMenu() {
  if (!started) return;
  menuOpen = false;
  splash.hidden = true;
}

function arrive(gate) {
  ragdoll.place(gate.x, ragdoll.torso.spawn.y, gate.z);
  standChicken();
  faceYaw = gate.yaw;
  ragdoll.poseWalker(faceYaw, walkPhase, 0, 0);
  const here = ragdoll.torso.body.position;
  look.set(here.x + panX, here.y + 0.9 + panY, here.z + panZ);
  streetBounce = 0;
  launchLock = 0.2;
  trapped = false;
  trapCharge = 0;
  callout(gate.kind === 'enter' ? 'INSIDE!' : 'OUT!');
  streetHint();
  sfx.bawk();
  const p = ragdoll.mover().position;
  particles.burst(p.x, p.y + 0.4, p.z, {
    colors: gate.kind === 'enter'
      ? [0xff5d73, 0xffe14a, 0x4d96ff, 0x6bcb77]
      : [0x6bcb77, 0xffe14a, 0xffffff],
    count: 22,
    speed: 4.5,
    life: 0.45,
    gravity: 6,
    up: 2.2,
  });
}

function streetHint() {
  let line = 'Bright doors open · green EXIT lets you out';
  if (streets.indoor()) {
    line = 'Inside · green EXIT lets you out';
  } else {
    const heat = streets.heat();
    if (heat === 'ride') line = 'Busted · police are driving you in';
    else if (heat === 'cell') line = 'Cell · swing at the bars to get out';
    else if (heat === 'wanted') line = 'Wanted · police are coming';
    else {
      const weapon = streets.weaponLabel();
      const blurb = streets.weaponBlurb();
      if (weapon) line = `${weapon} · ${blurb} · Y drops it`;
    }
  }
  setHint(line);
}

function onStreetEvent(e) {
  if (e.honk) sfx.honk();
  if (e.bawk) sfx.bawk();
  if (e.launch) launchLock = Math.max(launchLock, e.launch);
  if (e.callout) callout(e.callout);
  if (e.shake) shake(e.shake);
  if (e.score && e.pos) addScore(e.score, e.pos, e.impact || 6, e.flair || null);
  if (e.burst && e.pos) {
    const colors = e.burst === 'boom'
      ? [0xfff1a8, 0xff7a18, 0xff3355, 0x2b2f38, 0xffffff]
      : e.burst === 'chip'
      ? [0xfff1c2, 0xd7dbe3, 0x8d6e63, 0xffe14a, 0xffffff]
      : e.burst === 'feather'
      ? [0xffd84a, 0xfff6d0, 0xff7a1a, 0xffffff]
      : e.burst === 'zap'
      ? [0xd0b3ff, 0xfff6a8, 0xffffff, 0x7af0ff]
      : e.burst === 'launch'
      ? [0xffd0ea, 0xfff3a0, 0xffffff, 0xff8ad4]
      : [0xff5d73, 0xffe14a, 0x4d96ff, 0x6bcb77];
    particles.burst(e.pos.x, e.pos.y, e.pos.z, {
      colors,
      count: e.burst === 'boom' ? 56 : e.burst === 'zap' ? 24 : e.burst === 'launch' ? 20 : e.burst === 'chip' ? 18 : e.burst === 'feather' ? 18 : 16,
      speed: e.burst === 'boom' ? 9 : e.burst === 'zap' ? 8 : e.burst === 'launch' ? 7 : e.burst === 'chip' ? 6 : 4.5,
      life: e.burst === 'boom' ? 0.7 : e.burst === 'zap' ? 0.45 : 0.45,
      gravity: e.burst === 'boom' ? 8 : e.burst === 'launch' ? 4 : 6,
      up: e.burst === 'boom' ? 6 : e.burst === 'launch' ? 8 : e.burst === 'zap' ? 4 : 2.4,
    });
  }
  if (e.boom) sfx.boom();
  else if (e.score || e.crunch) sfx.impact(e.impact || 6);
  if (e.pickup || e.hint) {
    if (e.pickup) sfx.pickup();
    streetHint();
  }
  if (e.hit) {
    ragdollHit = true;
    hitStyle = e.style || null;
  }
}

function onStairEvent(e) {
  if (e.callout) callout(e.callout);
  if (e.shake) shake(e.shake);
  if (e.score && e.pos) addScore(e.score, e.pos, e.impact || 4, e.flair || null);
  if (e.burst && e.pos) {
    const palettes = {
      bounce: [0xfff6b0, 0xffffff, 0xb8f5ff],
      crumble: [0xffb15a, 0xfff1c2, 0xffffff],
      spike: [0xff3355, 0xffd0d6, 0xffffff],
      ring: [0xfff36b, 0xffffff, 0x9dffc9],
      wind: [0xe8f7ff, 0xffffff],
      toys: [0xff5d73, 0xffe14a, 0x4d96ff, 0x6bcb77],
      hit: [0xfff3a0, 0xffffff],
    };
    particles.burst(e.pos.x, e.pos.y, e.pos.z, {
      colors: palettes[e.burst] || palettes.hit,
      count: e.burst === 'ring' || e.burst === 'toys' ? 22 : 12,
      speed: e.burst === 'bounce' ? 5 : 3.2,
      life: 0.45,
      gravity: e.burst === 'wind' ? 1 : 6,
      up: 2,
    });
  }
  if (e.flair === 'BOING!' || e.burst === 'bounce') sfx.boing();
  else if (e.flair === 'CRACK!' || e.burst === 'crumble') sfx.pop();
  else if (e.callout === 'WHOOSH') sfx.launch();
  else if (e.score) sfx.impact(e.impact || 4);
}

function poke(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(ragdoll.targets, true);
  let body = null;
  if (hits.length) {
    let obj = hits[0].object;
    while (obj && !body) {
      body = obj.userData && obj.userData.body;
      obj = obj.parent;
    }
  }
  if (body && body.gameRole !== 'ragdoll') {
    const dir = raycaster.ray.direction;
    const impulse = new CANNON.Vec3(dir.x * 8, 2.2 + Math.abs(dir.y) * 4, dir.z * 8);
    body.applyImpulse(impulse, new CANNON.Vec3());
    body.wakeUp();
    sfx.boing();
    const point = hits[0].point;
    particles.burst(point.x, point.y, point.z, {
      colors: [0xfff6b0, 0xffffff],
      count: 8,
      speed: 3,
      life: 0.3,
      gravity: 6,
      up: 1,
    });
  }
  tryFlail(body && body.gameRole === 'ragdoll' ? body : null, true);
}

function updateCamera(dt, torso) {
  const stair = fallLevel();
  const indoor = streetLevel() && streets.indoor();
  const room = indoor ? streets.roomView() : null;
  if (streetLevel() && scene.fog) {
    const fogNear = indoor ? 26 : 14;
    const fogFar = indoor ? 72 : 64;
    if (scene.fog.near !== fogNear || scene.fog.far !== fogFar) {
      scene.fog.near = fogNear;
      scene.fog.far = fogFar;
    }
  }
  if (stair) {
    const hub = stairs.focus();
    desiredLook.set(
      torso.position.x * 0.42 + hub.x * 0.58 + panX,
      torso.position.y + panY - 2.3,
      torso.position.z * 0.42 + hub.z * 0.58 + panZ,
    );
    sun.position.set(torso.position.x + 14, torso.position.y + 28, torso.position.z + 8);
    sun.target.position.set(torso.position.x, torso.position.y, torso.position.z);
    sunSprite.position.set(torso.position.x + 34, torso.position.y + 22, torso.position.z - 26);
  } else if (streetLevel()) {
    const cell = streets.cellFrame();
    if (cell) {
      desiredLook.set(cell.x, cell.y, cell.z);
    } else {
      desiredLook.set(torso.position.x + panX, torso.position.y + 0.9 + panY, torso.position.z + panZ);
    }
    sun.position.set(torso.position.x + 18, 30, torso.position.z + 12);
    sun.target.position.set(torso.position.x, torso.position.y, torso.position.z);
    sunSprite.position.set(torso.position.x + 26, 34, torso.position.z - 18);
  } else {
    desiredLook.set(torso.position.x + panX, torso.position.y + 0.75 + panY, torso.position.z + panZ);
  }
  look.lerp(desiredLook, 1 - Math.exp((room ? -10 : -4.5) * dt));
  const cell = streetLevel() ? streets.cellFrame() : null;
  const dist = room ? Math.min(distance, room.dist) : distance;
  const camPitch = room ? Math.min(pitch, 0.62) : pitch;
  const cp = Math.cos(camPitch);
  if (cell) {
    const cellDist = 4.4;
    camera.position.set(
      clamp(look.x + Math.sin(yaw) * cp * cellDist, cell.minX, cell.maxX),
      cell.camY,
      clamp(look.z + Math.cos(yaw) * cp * cellDist, cell.minZ, cell.maxZ),
    );
  } else {
    camera.position.set(
      look.x + Math.sin(yaw) * cp * dist,
      look.y + Math.sin(camPitch) * dist,
      look.z + Math.cos(yaw) * cp * dist,
    );
    if (room) {
      camera.position.x = clamp(camera.position.x, room.minX, room.maxX);
      camera.position.y = clamp(camera.position.y, room.minY, room.maxY);
      camera.position.z = clamp(camera.position.z, room.minZ, room.maxZ);
    }
  }
  camera.lookAt(look);
  if (shakeMag > 0) {
    camera.position.x += (Math.random() - 0.5) * shakeMag;
    camera.position.y += (Math.random() - 0.5) * shakeMag * 0.65;
    camera.position.z += (Math.random() - 0.5) * shakeMag;
    shakeMag *= Math.exp(-3.4 * dt);
    if (shakeMag < 0.002) shakeMag = 0;
  }
  const fallZoom = fallLevel() ? clamp((-torso.velocity.y - 8) / 22, 0, 1) : 0;
  const targetFov = 52 + charge * 12 + (maxChaosTimer > 0 ? 8 : 0) + fallZoom * 16;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 5);
    camera.updateProjectionMatrix();
  }
}

function updateHud() {
  chaosFill.style.height = `${Math.round(charge * 100)}%`;
  chaosWrap.classList.toggle('hot', charge > 0.72);
  chaosWrap.classList.toggle('max', maxChaosTimer > 0);
  if (fallLevel()) dropEl.textContent = `${Math.floor(stairs.meters())} m`;
  else if (streetLevel()) dropEl.textContent = `${streets.hits()} hits`;
  trapBanner.hidden = !trapped;
  trapFill.style.width = `${clamp(trapCharge / 8, 0, 1) * 100}%`;
  updateComboHud();
}

function updateScoreHud(punch) {
  scoreEl.textContent = String(score);
  bestEl.textContent = fallLevel() ? `BEST ${bestDrop} m` : `BEST ${best}`;
  if (punch) {
    scoreEl.classList.remove('pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pop');
  }
  updateComboHud();
}

function updateComboHud() {
  const mult = currentMult();
  comboEl.textContent = combo > 1 ? `x${mult} COMBO` : 'COMBO';
  comboEl.style.opacity = combo > 1 ? '1' : '0.55';
}

function renderBadges() {
  badgeTray.replaceChildren();
  for (const badge of BADGES) {
    const el = document.createElement('div');
    el.className = `badge${unlocked.has(badge.id) ? ' got' : ''}`;
    el.textContent = badge.icon;
    el.title = `${badge.name} — ${badge.desc}`;
    badgeTray.appendChild(el);
  }
}

let calloutTimer = 0;
function callout(text) {
  calloutEl.hidden = false;
  calloutEl.textContent = text;
  calloutEl.style.animation = 'none';
  void calloutEl.offsetWidth;
  calloutEl.style.animation = '';
  window.clearTimeout(calloutTimer);
  calloutTimer = window.setTimeout(() => {
    calloutEl.hidden = true;
  }, 1100);
}

function showMaxBanner() {
  maxBanner.hidden = false;
  maxBanner.classList.remove('slam');
  void maxBanner.offsetWidth;
  maxBanner.classList.add('slam');
  window.setTimeout(() => {
    maxBanner.hidden = true;
  }, 1500);
}

function shake(amount) {
  shakeMag = Math.max(shakeMag, amount);
}

function releaseFlail() {
  flailHeld = false;
  swingHeld = false;
  flailBtn.classList.remove('held');
}

function moveStick(e) {
  const rect = stick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let x = e.clientX - cx;
  let y = e.clientY - cy;
  const max = rect.width * 0.34;
  const len = Math.hypot(x, y) || 1;
  const clamped = Math.min(len, max);
  x = (x / len) * clamped;
  y = (y / len) * clamped;
  knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  stickVec.x = x / max;
  stickVec.y = y / max;
}

function endStick() {
  stickId = null;
  stickVec.x = 0;
  stickVec.y = 0;
  knob.style.transform = 'translate(-50%, -50%)';
}

function pinchDistance() {
  const pts = [...pointers.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

function pollGamepad() {
  const out = { x: 0, y: 0, lookX: 0, lookY: 0, flail: false, jump: false };
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && pads[0];
  if (!gp) return out;
  const dead = 0.18;
  if (Math.abs(gp.axes[0] || 0) > dead) out.x = gp.axes[0];
  if (Math.abs(gp.axes[1] || 0) > dead) out.y = gp.axes[1];
  if (Math.abs(gp.axes[2] || 0) > dead) out.lookX = gp.axes[2];
  if (Math.abs(gp.axes[3] || 0) > dead) out.lookY = gp.axes[3];
  out.jump = !!gp.buttons[0]?.pressed;
  for (let i = 0; i < gp.buttons.length; i++) {
    if (i === 0 || i === 8 || i === 9 || (i >= 12 && i <= 15)) continue;
    if (gp.buttons[i].pressed) out.flail = true;
  }
  if (gp.buttons[14]?.pressed) out.x -= 1;
  if (gp.buttons[15]?.pressed) out.x += 1;
  if (gp.buttons[12]?.pressed) out.y -= 1;
  if (gp.buttons[13]?.pressed) out.y += 1;
  return out;
}

function createPopups(host, cam) {
  const items = [];
  const v = new THREE.Vector3();
  return {
    spawn(pos, text, kind) {
      const el = document.createElement('div');
      el.className = `pop ${kind || 'plus'}`;
      el.textContent = text;
      host.appendChild(el);
      items.push({
        el,
        x: pos.x + rand(-0.25, 0.25),
        y: pos.y,
        z: pos.z,
        life: 0.85,
        vy: 1.3,
      });
      if (items.length > 24) {
        const old = items.shift();
        old.el.remove();
      }
    },
    shift(dx, dy, dz) {
      for (const p of items) {
        p.x += dx;
        p.y += dy;
        p.z += dz;
      }
    },
    update(dt) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        p.life -= dt;
        p.y += p.vy * dt;
        if (p.life <= 0) {
          p.el.remove();
          items.splice(i, 1);
          continue;
        }
        v.set(p.x, p.y, p.z).project(cam);
        if (v.z > 1) {
          p.el.style.opacity = '0';
          continue;
        }
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        p.el.style.opacity = String(Math.min(1, p.life * 2.2));
      }
    },
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { badges: [], best: 0, bestDrop: 0 };
    const data = JSON.parse(raw);
    return {
      badges: Array.isArray(data.badges) ? data.badges : [],
      best: Number(data.best) || 0,
      bestDrop: Number(data.bestDrop) || 0,
    };
  } catch {
    return { badges: [], best: 0, bestDrop: 0 };
  }
}

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ badges: [...unlocked], best, bestDrop }));
  } catch {
    /* private mode */
  }
}

function createWorld() {
  const physics = new CANNON.World();
  physics.gravity.set(0, -12, 0);
  physics.broadphase = new CANNON.SAPBroadphase(physics);
  physics.allowSleep = true;
  physics.solver.iterations = 10;
  physics.defaultContactMaterial.friction = 0.36;
  physics.defaultContactMaterial.restitution = 0.12;

  const ground = new CANNON.Material('ground');
  const rag = new CANNON.Material('rag');
  const toy = new CANNON.Material('toy');
  const bouncy = new CANNON.Material('bouncy');
  const rubber = new CANNON.Material('rubber');
  const pair = (a, b, friction, restitution) => {
    physics.addContactMaterial(new CANNON.ContactMaterial(a, b, { friction, restitution }));
  };
  const ragGround = new CANNON.ContactMaterial(ground, rag, { friction: 0.6, restitution: 0.02 });
  physics.addContactMaterial(ragGround);
  pair(ground, toy, 0.5, 0.16);
  pair(ground, rubber, 0.62, 0.42);
  pair(rag, toy, 0.32, 0.1);
  pair(rag, rubber, 0.34, 0.35);
  pair(toy, toy, 0.42, 0.18);
  pair(toy, rubber, 0.36, 0.3);
  pair(bouncy, rag, 0.22, 0.02);
  pair(bouncy, toy, 0.25, 0.9);
  pair(bouncy, rubber, 0.28, 0.95);
  return { world: physics, groundMat: ground, ragMat: rag, toyMat: toy, bouncyMat: bouncy, rubberMat: rubber, ragGround };
}

window.__GAME__ = {
  begin: () => launchLevel(),
  pick: () => launchLevel(),
  flail: () => tryFlail(null, true),
  jump: () => tryJump(),
  reset: resetRagdoll,
  spawnToys: () => props.spawnPile(0, 0),
  toggleGravity,
  state: () => {
    const p = ragdoll.torso.body.position;
    return {
      started,
      level: levelId,
      meters: fallLevel() ? stairs.meters() : 0,
      score,
      best,
      combo,
      multiplier: currentMult(),
      charge,
      maxChaos: maxChaosTimer > 0,
      chaosBursts,
      airTime,
      heliTime,
      spin: ragdoll.torso.body.angularVelocity.length(),
      flails,
      frameCount,
      mass: ragdoll.torso.body.mass,
      vy: ragdoll.torso.body.velocity.y,
      vx: ragdoll.torso.body.velocity.x,
      trapped,
      gravity: world.gravity.y,
      props: props.count(),
      spread: ragdoll.spread(),
      fps,
      torso: { x: p.x, y: p.y, z: p.z },
      badges: [...unlocked],
      finite: Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z),
    };
  },
};

arena.setActive(false);
props.setActive(false);
ragdoll.setCostume('chicken');
ragdoll.setWalker(true);
{
  const pose = streets.begin();
  ragdoll.place(pose.x, ragdoll.torso.spawn.y, pose.z);
  ragdoll.mover().material = streets.walkerMaterial();
}
applyLook('chicken');
yaw = 0.15;
pitch = 0.78;
distance = 12;
logoSub.textContent = 'BOOM BOOM';

try {
  if (sessionStorage.getItem(PLAY_KEY) === '1') {
    launchLevel();
    const kick = () => sfx.start();
    window.addEventListener('pointerdown', kick, { once: true });
    window.addEventListener('keydown', kick, { once: true });
  }
} catch { /* private mode */ }

