import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { createArena } from './arena.js';
import { createArt } from './art.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createProps } from './props.js';
import { connectRoom } from './net.js';
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
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc5e8ff, 24, 78);
const toyFog = scene.fog;
const stairsFog = new THREE.Fog(0xffc9a0, 16, 76);
const cityFog = new THREE.Fog(0xf6c59a, 64, 200);
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
const FEATHERS = [0xffd84a, 0xff5d73, 0x7ec8ff, 0x6bcb77, 0xc77dff, 0xff922b, 0xfff3bf, 0x4ecdc4];
let netRole = null;
let session = null;
let selfPeerId = '';
let hostPeerId = '';
let myColor = FEATHERS[0];
let roomCode = '';
const roster = new Map();
const pendingNames = new Map();
const guestDolls = new Map();
const poseViews = new Map();
const dollLabels = new WeakMap();
let pendingSnap = null;
let shownSnap = null;
let guestJump = false;
let guestDrop = false;
let sentSwing = false;
let netAcc = 0;
let netBusy = false;
let netPending = null;
let inputAcc = 0;
let localGait = 0;
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
const mateKnocks = [];
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
  return true;
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
  applyHintMin(saved !== '0', false);
} catch {
  applyHintMin(true, false);
}
hintToggle.addEventListener('click', () => applyHintMin(!hintIsMin(), true));

const settingsEl = document.querySelector('#settings');
const settingsBtn = document.querySelector('#btn-settings');
const settingsPanel = document.querySelector('#settings-panel');

function setSettingsOpen(open) {
  settingsPanel.hidden = !open;
  settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

settingsBtn.addEventListener('click', () => {
  setSettingsOpen(settingsPanel.hidden);
  sfx.ui();
});
document.addEventListener('pointerdown', (e) => {
  if (settingsPanel.hidden || settingsEl.contains(e.target)) return;
  setSettingsOpen(false);
});

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
  if (!rag || !other || (rag.doll && rag.doll !== ragdoll)) return;
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
  void leaveOnline().then(() => {
    launchLevel();
    sfx.ui();
  });
});
document.querySelector('#btn-toys').addEventListener('click', () => {
  if (!started || menuOpen) return;
  if (netRole === 'guest') {
    netSend({ t: 'toys' });
    sfx.ui();
    return;
  }
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
  if (netRole === 'guest') {
    netSend({ t: 'reset' });
    sfx.ui();
    return;
  }
  resetRagdoll();
  sfx.ui();
});
gravBtn.addEventListener('click', () => {
  if (!started) return;
  if (netRole === 'guest') {
    netSend({ t: 'grav' });
    return;
  }
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
const nestBtn = document.querySelector('#btn-nest');
const markerRoot = document.querySelector('#friend-markers');
const markerPool = new Map();
const markerVec = new THREE.Vector3();
const camRight = new THREE.Vector3();
const camUp = new THREE.Vector3();
const camForward = new THREE.Vector3();
let lastNestAt = 0;
let guestNest = false;
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
nestBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  tryNest();
});

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
let lastPointerType = 'mouse';
const touchDevice = (navigator.maxTouchPoints || 0) > 0
  || window.matchMedia('(any-pointer: coarse)').matches;
window.addEventListener('pointerdown', (e) => {
  lastPointerType = e.pointerType || 'mouse';
}, true);
function blockDoubleTapZoom(e) {
  if (!touchDevice && lastPointerType !== 'touch' && lastPointerType !== 'pen') return false;
  e.preventDefault();
  return true;
}
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
canvas.addEventListener('dblclick', (e) => {
  if (blockDoubleTapZoom(e)) return;
  yaw = 0.55;
  pitch = 0.46;
  distance = 8.4;
  panX = panY = panZ = 0;
});
document.addEventListener('dblclick', (e) => {
  blockDoubleTapZoom(e);
}, true);

document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = performance.now();
  if (now - lastTouchEnd < 500) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false, capture: true });

window.addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (menuOpen) {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (netRole === 'host' && !roomPanelHidden()) startTogether();
      else if (netRole !== 'guest') playBtn.click();
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
    if (netRole === 'guest') guestDrop = true;
    else {
      const dropped = streets.putDown();
      if (dropped) {
        callout('DOWN');
        sfx.drop();
        streetHint();
      }
    }
  }
  if (e.code === 'Space') tryJump();
  if (e.code === 'KeyR') resetRagdoll();
  if (e.code === 'KeyH') tryNest();
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
function fitView() {
  canvas.style.width = '';
  canvas.style.height = '';
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  if (w < 2 || h < 2) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
fitView();
window.addEventListener('resize', fitView);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitView);
}

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
  if (netRole === 'guest') {
    stepGuest(dt);
    return;
  }
  if (menuOpen && started && netRole !== 'host') {
    const torso = ragdoll.torso.body;
    syncDolls(simTime);
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
    driveRemotes(dt);
    if (!cuffed && (gp.flail || flailHeld || keys.has('KeyF') || keys.has('KeyJ') || keys.has('KeyK'))) {
      tryFlail(null, false);
    }
    if (!cuffed && (swingHeld || gp.swing || keys.has('KeyE') || keys.has('Slash'))) trySwing(false);
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
    if (streetLevel() && streets.driving() && Math.abs(lookX) < 0.15) {
      const view = streets.driveView();
      if (view) {
        let behind = view.yaw + Math.PI - yaw;
        while (behind > Math.PI) behind -= Math.PI * 2;
        while (behind < -Math.PI) behind += Math.PI * 2;
        yaw += behind * (1 - Math.exp(-2.4 * dt));
      }
    }
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
    for (const peer of roster.values()) peer.doll?.lockWalker();
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
  for (const peer of roster.values()) peer.doll?.clampSpeeds(linCap, angCap);

  if (streetLevel()) streets.tick(dt);
  if (streetLevel() && ragdoll.walking()) {
    const mover = ragdoll.mover();
    if (streets.driving()) {
      const view = streets.driveView();
      if (view) {
        faceYaw = view.yaw;
        walkPhase += Math.abs(view.speed) * 0.65 * dt;
        localGait = Math.min(0.5, Math.abs(view.speed) / 30);
        ragdoll.poseWalker(faceYaw, walkPhase, localGait, dt, 0);
      }
    } else if (streets.locked()) {
      const face = streets.rideYaw();
      if (face != null) faceYaw = face;
      localGait = 0;
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
    localGait = gait;
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

  if (streetLevel()) poseRemotes(dt);

  if (streetLevel()) flushHits();

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

  syncDolls(simTime);
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
  publishNet(dt);
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
  if (streetLevel() && streets.driving()) {
    let gas = 0;
    let turn = 0;
    if (keys.has('KeyW')) gas += 1;
    if (keys.has('KeyS')) gas -= 1;
    if (keys.has('KeyA')) turn += 1;
    if (keys.has('KeyD')) turn -= 1;
    streets.pilot(
      clamp(gas - stickVec.y - gp.y, -1, 1),
      clamp(turn - stickVec.x - gp.x, -1, 1),
    );
    return;
  }
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
  if (netRole === 'guest') {
    guestJump = true;
    return;
  }
  if (streetLevel() && streets.locked()) return;
  const now = performance.now();
  if (now - lastJumpAt < 280) return;
  if (streetLevel() && streets.driving()) {
    const out = streets.hopOut();
    if (!out) return;
    faceYaw = out.yaw;
    lastJumpAt = now;
    streetBounce = 0;
    sfx.boing();
    sfx.bawk();
    streetHint();
    return;
  }
  if (streetLevel() && streets.hopIn()) {
    const view = streets.driveView();
    if (view) faceYaw = view.yaw;
    lastJumpAt = now;
    streetBounce = 0;
    streetHint();
    return;
  }
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
  if (netRole === 'guest') return;
  if (!started || !streetLevel() || streets.locked()) return;
  if (streets.driving()) {
    if (tapped) streets.honk();
    return;
  }
  if (streets.startSwing()) {
    sfx.flail();
    return;
  }
  if (tapped && !streets.weaponLabel()) sfx.bawk();
}

function tryFlail(body, tapped) {
  if (netRole === 'guest') return;
  if (!started) return;
  if (streetLevel() && streets.locked()) return;
  if (streetLevel() && streets.driving()) {
    const now = performance.now();
    if (now - lastFlailAt < (tapped ? 32 : 72)) return;
    lastFlailAt = now;
    streets.goose();
    ragdoll.noteFlap();
    if (tapped) sfx.bawk();
    return;
  }
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
  if (streetLevel() && streets.driving()) streets.hopOut();
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
    camera.far = 260;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 140;
    sun.shadow.camera.left = -78;
    sun.shadow.camera.right = 78;
    sun.shadow.camera.top = 78;
    sun.shadow.camera.bottom = -78;
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
  nestBtn.hidden = !streetLevel();
  updateScoreHud(false);
  if (netRole === 'guest') {
    streets.setMirror(true);
    ragdoll.recolor(myColor);
  }
  if (netRole === 'host') {
    for (const peer of roster.values()) spawnMate(peer);
    syncActors();
  }
  refreshNetBadge();
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
  syncMainMenuButton();
  splash.hidden = false;
}

function closeMenu() {
  if (!started) return;
  menuOpen = false;
  splash.hidden = true;
}

function arrive(gate) {
  const dolls = [ragdoll];
  for (const peer of roster.values()) if (peer.doll) dolls.push(peer.doll);
  dolls.forEach((doll, index) => {
    const side = (index - (dolls.length - 1) / 2) * 0.9;
    const x = gate.x + Math.cos(gate.yaw) * side;
    const z = gate.z - Math.sin(gate.yaw) * side;
    doll.place(x, doll.torso.spawn.y, z);
    doll.setWalker(true);
    if (streetLevel()) doll.mover().material = streets.walkerMaterial();
    if (doll === ragdoll) {
      standChicken();
      faceYaw = gate.yaw;
      ragdoll.poseWalker(faceYaw, walkPhase, 0, 0);
    } else {
      const peer = [...roster.values()].find((entry) => entry.doll === doll);
      if (peer) peer.faceYaw = gate.yaw;
      doll.poseWalker(gate.yaw, 0, 0, 0, 0);
    }
  });
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
  const held = heldWeaponName();
  let line = held
    ? `${held} · E hits · Y drops · jump stands you back up`
    : 'Bright doors open · green EXIT lets you out · Space hops into a car · H nest';
  if (streets.driving()) {
    line = 'Driving · WASD steers · Space hops out · E honks · F boosts';
  } else if (streets.canHopIn()) {
    line = 'Space hops into the car · WASD drives once you are in';
  } else if (streets.indoor()) {
    line = 'Inside · green EXIT lets you out';
  } else {
    const heat = streets.heat();
    if (heat === 'ride') line = 'Busted · police are driving you in';
    else if (heat === 'cell') line = 'Cell · swing at the bars to get out';
    else if (heat === 'wanted') line = 'Wanted · police are coming';
  }
  setHint(line);
}

function heldWeaponName() {
  const mine = streets.weaponLabel();
  if (mine) return mine;
  if (netRole !== 'guest' || !pendingSnap) return '';
  const pose = (pendingSnap.players || []).find((person) => person.id === selfPeerId);
  if (!pose || pose.arm == null || pose.arm < 0) return '';
  return streets.weaponName(pose.arm);
}

function streetVictim(e) {
  if (e.who) return e.who;
  if (e.hit) return ragdoll;
  return null;
}

function dollPeerId(doll) {
  if (!doll || doll === ragdoll) return selfPeerId || 'host';
  for (const peer of roster.values()) if (peer.doll === doll) return peer.id;
  return '';
}

function onStreetEvent(e) {
  const victim = streetVictim(e);
  const hear = !victim || victim === ragdoll;
  if (hear && e.honk) sfx.honk();
  if (hear && e.bawk) sfx.bawk();
  if (e.launch && (!e.who || e.who === ragdoll)) launchLock = Math.max(launchLock, e.launch);
  if (netRole === 'host' && (e.callout || e.burst || e.honk || e.bawk || e.shake)) {
    netSend({
      t: 'fx',
      callout: e.callout || '',
      pos: e.pos || null,
      burst: e.burst || '',
      honk: !!e.honk,
      bawk: !!e.bawk,
      shake: e.shake || 0,
      pickup: !!e.pickup,
      who: victim ? dollPeerId(victim) : '',
      impact: victim ? (e.impact || 0) : 0,
      boom: !!(victim && e.boom),
    });
  }
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
  if (hear && e.boom) sfx.boom();
  else if (hear && (e.score || e.crunch)) sfx.impact(e.impact || 6);
  if (e.pickup || e.hint) {
    if (e.pickup) sfx.pickup();
    streetHint();
  }
  if (e.hit) noteHit(e.who || ragdoll, e.style);
}

function noteHit(doll, style) {
  if (!doll || doll === ragdoll) {
    ragdollHit = true;
    hitStyle = style || null;
    return;
  }
  const pending = mateKnocks.find((hit) => hit.doll === doll);
  if (pending) pending.style = style || null;
  else mateKnocks.push({ doll, style: style || null });
}

function flushHits() {
  if (streets.locked()) return;
  if (ragdollHit) {
    ragdoll.knock(hitStyle || undefined);
    ragdollHit = false;
    hitStyle = null;
    tumbleGrip(true);
  }
  for (const hit of mateKnocks) {
    if (hit.doll.torso.body.world) hit.doll.knock(hit.style || undefined);
  }
  mateKnocks.length = 0;
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
    const fogNear = indoor ? 28 : 64;
    const fogFar = indoor ? 90 : 200;
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
    const drive = streets.driveView();
    if (cell) {
      desiredLook.set(cell.x, cell.y, cell.z);
    } else if (drive) {
      desiredLook.set(
        torso.position.x + Math.sin(drive.yaw) * 2.4 + panX,
        torso.position.y + 0.7 + panY,
        torso.position.z + Math.cos(drive.yaw) * 2.4 + panZ,
      );
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
  const drive = streetLevel() ? streets.driveView() : null;
  let dist = room ? Math.min(distance, room.dist) : distance;
  if (drive) dist = Math.min(18, dist + 3.4 + Math.min(4.5, Math.abs(drive.speed) * 0.14));
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
  try {
    updateFriendMarkers();
  } catch (error) {
    console.error(error);
  }
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
  const out = { x: 0, y: 0, lookX: 0, lookY: 0, flail: false, jump: false, swing: false };
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && pads[0];
  if (!gp) return out;
  const dead = 0.18;
  if (Math.abs(gp.axes[0] || 0) > dead) out.x = gp.axes[0];
  if (Math.abs(gp.axes[1] || 0) > dead) out.y = gp.axes[1];
  if (Math.abs(gp.axes[2] || 0) > dead) out.lookX = gp.axes[2];
  if (Math.abs(gp.axes[3] || 0) > dead) out.lookY = gp.axes[3];
  out.jump = !!gp.buttons[0]?.pressed;
  out.swing = !!gp.buttons[2]?.pressed || !!gp.buttons[5]?.pressed;
  for (let i = 0; i < gp.buttons.length; i++) {
    if (i === 0 || i === 2 || i === 5 || i === 8 || i === 9 || (i >= 12 && i <= 15)) continue;
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

const roomPanel = document.querySelector('#room-panel');
const roomStatus = document.querySelector('#room-status');
const nameInput = document.querySelector('#chick-name');
try {
  const savedName = sessionStorage.getItem('ragdoll-name');
  if (savedName && nameInput) nameInput.value = savedName;
} catch { /* private mode */ }
if (nameInput) {
  nameInput.addEventListener('input', () => {
    try { sessionStorage.setItem('ragdoll-name', nameInput.value); } catch { /* private mode */ }
    if (netRole === 'guest') announceName();
    else if (netRole === 'host') broadcastRoster();
  });
}

function cleanName(value) {
  const text = String(value || '').replace(/[^\w .'-]/g, '').trim().slice(0, 12);
  return text || 'Chicken';
}

function myName() {
  return cleanName(nameInput && nameInput.value);
}

function setRoomStatus(text) {
  if (roomStatus) roomStatus.textContent = text;
}

function roomPanelHidden() {
  return !roomPanel || roomPanel.hidden;
}

function syncMainMenuButton() {
  const button = document.querySelector('#btn-main-menu');
  if (!button) return;
  button.hidden = !started || !menuOpen || !roomPanelHidden();
}

function showRoomPicker() {
  if (!roomPanel) return;
  roomPanel.hidden = false;
  document.querySelector('#room-host-tools').hidden = false;
  document.querySelector('#btn-room-play').hidden = true;
  document.querySelector('#room-code-line').hidden = true;
  document.querySelector('#room-friends').textContent = '';
  playBtn.hidden = true;
  document.querySelector('#btn-friends').hidden = true;
  syncMainMenuButton();
  setRoomStatus('One computer runs the street. Everyone else connects to it. No server to pay for.');
}

function hideRoomPicker() {
  if (roomPanel) roomPanel.hidden = true;
  playBtn.hidden = false;
  document.querySelector('#btn-friends').hidden = false;
  syncMainMenuButton();
}

function returnToMainMenu() {
  void leaveOnline().then(() => {
    started = false;
    menuOpen = true;
    hideRoomPicker();
    playBtn.textContent = 'PLAY';
    splash.hidden = false;
    document.documentElement.removeAttribute('data-resume');
    keys.clear();
    flailHeld = false;
    swingHeld = false;
    releaseJump();
    endStick();
    try {
      sessionStorage.removeItem(PLAY_KEY);
      sessionStorage.removeItem(LEVEL_KEY);
    } catch { /* private mode */ }
  });
}

function refreshNetBadge() {
  const badge = document.querySelector('#net-badge');
  if (!badge) return;
  if (!netRole || !roomCode) {
    badge.hidden = true;
    delete badge.dataset.flash;
    return;
  }
  const chickens = netRole === 'host'
    ? roster.size + 1
    : (pendingSnap && pendingSnap.players ? pendingSnap.players.length : 1);
  badge.hidden = false;
  badge.title = `Copy or share room code ${roomCode}. ${chickens} playing.`;
  if (badge.dataset.flash) return;
  badge.textContent = `CODE ${roomCode}`;
}

function flashNetBadge(label) {
  const badge = document.querySelector('#net-badge');
  if (!badge) return;
  badge.dataset.flash = '1';
  badge.textContent = label;
  window.setTimeout(() => {
    delete badge.dataset.flash;
    refreshNetBadge();
  }, 1400);
}

async function shareRoomCode() {
  if (!roomCode) return;
  const message = `Join my Chicken Boom Boom street. Code: ${roomCode}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Chicken Boom Boom', text: message });
      flashNetBadge('SHARED');
      return;
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(roomCode);
    flashNetBadge('COPIED');
  } catch {
    flashNetBadge(roomCode);
  }
}

function netSend(data, target) {
  if (session) session.send(data, target);
}

function announceName() {
  if (netRole !== 'guest' || !session) return;
  netSend({ t: 'hi', name: myName() });
}

function renderFriends() {
  const box = document.querySelector('#room-friends');
  if (!box) return;
  const names = [myName()];
  for (const peer of roster.values()) names.push(peer.name);
  box.textContent = names.join(' · ');
}

function broadcastRoster() {
  const people = [{ id: selfPeerId, name: myName(), slot: 0, color: FEATHERS[0], host: true }];
  for (const peer of roster.values()) {
    people.push({ id: peer.id, name: peer.name, slot: peer.slot, color: peer.color, host: false });
  }
  netSend({ t: 'roster', people });
  renderFriends();
  refreshNetBadge();
}

function nextSlot() {
  const used = new Set([0]);
  for (const peer of roster.values()) used.add(peer.slot);
  for (let i = 1; i < FEATHERS.length; i++) if (!used.has(i)) return i;
  return 1;
}

function labelDoll(doll, text) {
  if (!doll || !text) return;
  const previous = dollLabels.get(doll);
  if (previous && previous.userData.text === text) return;
  if (previous) previous.removeFromParent();
  const stamp = document.createElement('canvas');
  stamp.width = 256;
  stamp.height = 64;
  const draw = stamp.getContext('2d');
  draw.font = '700 36px Fredoka, sans-serif';
  draw.fillStyle = '#1b1b1b';
  draw.textAlign = 'center';
  draw.textBaseline = 'middle';
  draw.fillText(text, 128, 34);
  const map = new THREE.CanvasTexture(stamp);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false }));
  sprite.position.set(0, 1.25, 0);
  sprite.scale.set(1.6, 0.4, 1);
  sprite.userData.text = text;
  doll.torso.mesh.add(sprite);
  dollLabels.set(doll, sprite);
}

function syncActors() {
  if (!streetLevel()) return;
  const list = [ragdoll];
  for (const peer of roster.values()) if (peer.doll) list.push(peer.doll);
  streets.setActors(list);
}

function spawnMate(peer) {
  if (!peer || peer.doll || !streetLevel()) return;
  const doll = createRagdoll(world, scene, art, ragMat, peer.color);
  doll.setCostume('chicken');
  doll.setWalker(true);
  const here = ragdoll.walking() ? ragdoll.mover().position : ragdoll.torso.body.position;
  const spot = streets.indoor() ? here : streets.respawn(here);
  const aside = streets.indoor() ? peer.slot * 0.8 : peer.slot * 1.1;
  doll.place(spot.x, ragdoll.torso.spawn.y, spot.z + aside);
  doll.mover().material = streets.walkerMaterial();
  for (const part of doll.parts) {
    part.body.linearDamping = 0.14;
    part.body.angularDamping = 0.24;
  }
  peer.doll = doll;
  peer.faceYaw = Math.PI;
  labelDoll(doll, peer.name);
}

function syncDolls(time) {
  ragdoll.sync(time, charge, maxChaosTimer > 0);
  for (const peer of roster.values()) {
    if (peer.doll && peer.doll !== ragdoll) peer.doll.sync(time, 0, false);
  }
  for (const doll of guestDolls.values()) doll.sync(time, 0, false);
}

function wishVector(gp) {
  let ix = 0;
  let iy = 0;
  if (keys.has('KeyA')) ix -= 1;
  if (keys.has('KeyD')) ix += 1;
  if (keys.has('KeyW')) iy -= 1;
  if (keys.has('KeyS')) iy += 1;
  ix = clamp(ix + stickVec.x + (gp ? gp.x : 0), -1, 1);
  iy = clamp(iy + stickVec.y + (gp ? gp.y : 0), -1, 1);
  const mag = Math.hypot(ix, iy);
  if (mag < 0.12) return { x: 0, z: 0 };
  const scale = Math.min(1, mag) / mag;
  const sx = ix * scale;
  const sy = iy * scale;
  return {
    x: Math.cos(yaw) * sx + Math.sin(yaw) * sy,
    z: -Math.sin(yaw) * sx + Math.cos(yaw) * sy,
  };
}

function hopDoll(peer) {
  const doll = peer.doll;
  if (!doll || !streetLevel() || streets.locked()) return;
  if (!doll.walking()) {
    doll.setWalker(true);
    doll.mover().material = streets.walkerMaterial();
    doll.poseWalker(peer.faceYaw || 0, peer.walkPhase || 0, 0, 0, 0);
    return;
  }
  const torso = doll.mover();
  if (doll.isSupported(world)) {
    if (torso.velocity.y < 7.4) torso.velocity.y = 7.4;
    doll.noteFlap();
    peer.air = 2;
  } else if (peer.air > 0) {
    peer.air -= 1;
    const hop = peer.air === 1 ? 10.2 : 13.2;
    if (torso.velocity.y < hop) torso.velocity.y = hop;
    doll.noteFlap();
  } else return;
  torso.wakeUp();
}

function tryNest() {
  if (!started || menuOpen || !streetLevel()) return;
  if (performance.now() - lastNestAt < 600) return;
  if (netRole === 'guest') {
    guestNest = true;
    lastNestAt = performance.now();
    return;
  }
  if (streets.locked() || !streets.stepOut()) {
    callout('BUSTED');
    return;
  }
  lastNestAt = performance.now();
  dropAtNest(ragdoll, 0);
  standChicken();
  faceYaw = Math.PI;
  callout('NEST!');
  sfx.bawk();
  const p = ragdoll.mover().position;
  particles.burst(p.x, p.y + 0.4, p.z, {
    colors: [0xffd84a, 0xfff6d0, 0x6bcb77, 0xffffff],
    count: 16,
    speed: 3.4,
    life: 0.4,
    gravity: 6,
    up: 2,
  });
}

function dropAtNest(doll, slot) {
  if (!doll) return;
  const spot = streets.corner();
  doll.setWalker(true);
  doll.place(spot.x + slot * 1.15, doll.torso.spawn.y, spot.z);
  const mover = doll.mover();
  mover.material = streets.walkerMaterial();
  mover.velocity.set(0, 0, 0);
}

function mateArrow() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mate-arrow');
  svg.setAttribute('viewBox', '0 0 48 28');
  const shaft = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shaft.setAttribute('d', 'M4 14h20');
  const head = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  head.setAttribute('d', 'M18 5.5 40 14 18 22.5');
  svg.append(shaft, head);
  return svg;
}

function updateFriendMarkers() {
  if (!markerRoot) return;
  const active = new Set();
  const playing = started && streetLevel();
  if (playing) {
    camera.updateMatrixWorld();
    const basis = camera.matrixWorld.elements;
    camRight.set(basis[0], basis[1], basis[2]);
    camUp.set(basis[4], basis[5], basis[6]);
    camForward.set(-basis[8], -basis[9], -basis[10]);
    const mine = ragdoll.walking() ? ragdoll.mover().position : ragdoll.torso.body.position;
    const mates = [];
    if (netRole === 'guest') {
      for (const [id, doll] of guestDolls) {
        const body = doll.walking() ? doll.mover() : doll.torso.body;
        const sprite = dollLabels.get(doll);
        mates.push({ id, name: sprite?.userData.text || 'Friend', body });
      }
    } else {
      for (const peer of roster.values()) {
        if (!peer.doll) continue;
        const body = peer.doll.walking() ? peer.doll.mover() : peer.doll.torso.body;
        mates.push({ id: peer.id, name: peer.name || 'Friend', body });
      }
    }
    const w = markerRoot.clientWidth || window.innerWidth;
    const h = markerRoot.clientHeight || window.innerHeight;
    const viewLimit = 0.62;
    for (const mate of mates) {
      if (!mate.body) continue;
      active.add(mate.id);
      const wx = mate.body.position.x;
      const wy = mate.body.position.y + 1.3;
      const wz = mate.body.position.z;
      const dx = wx - camera.position.x;
      const dy = wy - camera.position.y;
      const dz = wz - camera.position.z;
      const depth = dx * camForward.x + dy * camForward.y + dz * camForward.z;
      const behind = depth < 0.8;
      let nx;
      let ny;
      if (behind) {
        const rx = dx * camRight.x + dy * camRight.y + dz * camRight.z;
        const uy = dx * camUp.x + dy * camUp.y + dz * camUp.z;
        const span = Math.max(Math.hypot(rx, uy), 0.001);
        nx = (rx / span) * 1.6;
        ny = (uy / span) * 1.6;
      } else {
        markerVec.set(wx, wy, wz);
        markerVec.project(camera);
        nx = markerVec.x;
        ny = markerVec.y;
      }
      const meters = Math.max(1, Math.round(Math.hypot(wx - mine.x, wz - mine.z)));
      const onScreen = !behind && Math.abs(nx) < viewLimit && Math.abs(ny) < viewLimit;
      let el = markerPool.get(mate.id);
      if (!el || !el.querySelector('svg.mate-arrow')) {
        if (el) el.remove();
        el = document.createElement('div');
        el.className = 'mate';
        const label = document.createElement('b');
        el.append(label, mateArrow());
        markerRoot.appendChild(el);
        markerPool.set(mate.id, el);
      }
      if (onScreen && meters < 18) {
        el.hidden = true;
        continue;
      }
      const offscreen = behind || Math.abs(nx) > 0.9 || Math.abs(ny) > 0.9;
      if (offscreen) {
        const scale = 0.9 / Math.max(Math.abs(nx), Math.abs(ny), 0.001);
        nx *= scale;
        ny *= scale;
      }
      let px = (nx * 0.5 + 0.5) * w;
      let py = (-ny * 0.5 + 0.5) * h;
      const angle = Math.atan2(py - h / 2, px - w / 2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      el.hidden = false;
      el.querySelector('b').textContent = `${mate.name} ${meters}m`;
      if (Math.abs(cos) >= Math.abs(sin)) el.style.flexDirection = cos > 0 ? 'row' : 'row-reverse';
      else el.style.flexDirection = sin > 0 ? 'column' : 'column-reverse';
      el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
      const halfW = el.offsetWidth / 2;
      const halfH = el.offsetHeight / 2;
      const minX = 16 + halfW;
      const maxX = w - 16 - halfW;
      const minY = 168 + halfH;
      const maxY = h - 156 - halfH;
      if (maxX > minX) px = Math.min(maxX, Math.max(minX, px));
      if (maxY > minY) py = Math.min(maxY, Math.max(minY, py));
      el.style.transform = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
      el.querySelector('.mate-arrow').style.transform = `rotate(${angle}rad)`;
    }
  }
  for (const [id, el] of markerPool) {
    if (active.has(id)) continue;
    el.remove();
    markerPool.delete(id);
  }
}

function rescueMate(peer) {
  if (!peer.doll) return;
  const spot = streets.respawn(ragdoll.mover().position);
  peer.doll.setWalker(true);
  peer.doll.place(spot.x + peer.slot * 0.8, peer.doll.torso.spawn.y, spot.z);
  peer.doll.mover().material = streets.walkerMaterial();
}

function driveRemotes() {
  if (netRole !== 'host' || !streetLevel()) return;
  const now = performance.now();
  for (const peer of roster.values()) {
    const doll = peer.doll;
    if (!doll) continue;
    if (peer.swing && doll) streets.swingArm(doll);
    if (doll.isSupported(world)) peer.air = 2;
    if (peer.jump && now - peer.lastJump > 280) {
      peer.lastJump = now;
      hopDoll(peer);
    }
    peer.jump = false;
    if (!doll.walking()) {
      if (peer.flail && now - peer.lastFlail > 70) {
        peer.lastFlail = now;
        peer.spin = -(peer.spin || 1);
        doll.flail(null, peer.spin);
      }
      if (doll.spread() > 9 || doll.torso.body.position.y < -6) rescueMate(peer);
      continue;
    }
    const body = doll.mover();
    const mag = Math.hypot(peer.wishX, peer.wishZ);
    if (mag > 0.12) {
      const scale = Math.min(1, mag) / mag;
      body.velocity.x = peer.wishX * scale * 11;
      body.velocity.z = peer.wishZ * scale * 11;
    }
    body.wakeUp();
    if (peer.flail && now - peer.lastFlail > 70) {
      peer.lastFlail = now;
      doll.noteFlap();
      if (body.velocity.y < 2.4) body.velocity.y += 1.5;
    }
    if (body.position.y < -6) rescueMate(peer);
  }
}

function poseRemotes(dt) {
  if (netRole !== 'host') return;
  for (const peer of roster.values()) {
    const doll = peer.doll;
    if (!doll || !doll.walking()) continue;
    const mover = doll.mover();
    const speed = Math.hypot(mover.velocity.x, mover.velocity.z);
    const grounded = doll.isSupported(world);
    const gait = !grounded ? 0.12 : speed < 0.35 ? 0 : Math.min(1, 0.55 + speed / 10);
    peer.gait = gait;
    peer.walkPhase = (peer.walkPhase || 0) + Math.max(speed * 0.85, gait > 0 ? 3.1 : 0) * dt;
    if (speed > 0.45) {
      const target = Math.atan2(mover.velocity.x, mover.velocity.z);
      let turn = target - (peer.faceYaw || 0);
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      peer.faceYaw = (peer.faceYaw || 0) + turn * (1 - Math.exp(-12 * dt));
    }
    doll.poseWalker(peer.faceYaw || 0, peer.walkPhase || 0, gait, dt, streetLevel() ? streets.chopOf(doll) : 0);
  }
}

function stampArm(pose, doll) {
  if (!streetLevel() || !pose || !doll) return;
  const arm = streets.armState(doll);
  pose.arm = arm ? arm.index : -1;
  pose.chop = arm ? arm.chop : 0;
}

function capturePlayers() {
  const players = [];
  const self = ragdoll.capturePose();
  self.id = selfPeerId || 'host';
  self.name = myName();
  self.slot = 0;
  self.color = FEATHERS[0];
  if (self.w) {
    self.phase = Math.round(walkPhase * 100) / 100;
    self.gait = Math.round(localGait * 100) / 100;
    self.yaw = Math.round(faceYaw * 1000) / 1000;
  }
  stampArm(self, ragdoll);
  players.push(self);
  for (const peer of roster.values()) {
    if (!peer.doll) continue;
    const pose = peer.doll.capturePose();
    pose.id = peer.id;
    pose.name = peer.name;
    pose.slot = peer.slot;
    pose.color = peer.color;
    if (pose.w) {
      pose.phase = Math.round((peer.walkPhase || 0) * 100) / 100;
      pose.gait = Math.round((peer.gait || 0) * 100) / 100;
      pose.yaw = Math.round((peer.faceYaw || pose.yaw || 0) * 1000) / 1000;
    }
    stampArm(pose, peer.doll);
    players.push(pose);
  }
  return players;
}

function publishNet(dt) {
  if (netRole !== 'host' || !started || !session) return;
  netAcc += dt;
  if (netAcc < 1 / 20) return;
  netAcc = 0;
  let packet;
  try {
    const city = streetLevel() ? streets.capture() : null;
    if (city) city.time = Math.round(simTime * 1000) / 1000;
    packet = {
      t: 'snap',
      score,
      players: capturePlayers(),
      city,
    };
  } catch (error) {
    console.error(error);
    return;
  }
  if (netBusy) {
    netPending = packet;
    return;
  }
  flushNet(packet);
}

function flushNet(packet) {
  if (!session) return;
  netBusy = true;
  Promise.resolve(session.send(packet)).then(() => {
    netBusy = false;
    if (!netPending || !session) return;
    const next = netPending;
    netPending = null;
    flushNet(next);
  }, (error) => {
    netBusy = false;
    netPending = null;
    console.error(error);
  });
  refreshNetBadge();
}

function applyPlayers(players, dt, hard) {
  const seen = new Set();
  for (const pose of players || []) {
    if (!pose || !pose.id) continue;
    seen.add(pose.id);
    const mine = pose.id === selfPeerId;
    let doll = mine ? ragdoll : guestDolls.get(pose.id);
    if (!mine && !doll) {
      doll = createRagdoll(world, scene, art, ragMat, pose.color || FEATHERS[1]);
      doll.setCostume('chicken');
      doll.setWalker(true);
      if (streetLevel()) doll.mover().material = streets.walkerMaterial();
      guestDolls.set(pose.id, doll);
    }
    if (!doll) continue;
    if (pose.color) doll.recolor(pose.color);
    if (!mine && pose.name) labelDoll(doll, pose.name);
    if (pose.w) {
      let view = poseViews.get(pose.id);
      if (!view || hard) view = { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw || 0, phase: pose.phase || 0 };
      else {
        const blend = 1 - Math.exp(-14 * dt);
        view.x += (pose.x - view.x) * blend;
        view.y += (pose.y - view.y) * blend;
        view.z += (pose.z - view.z) * blend;
        view.phase += ((pose.phase || 0) - view.phase) * blend;
        let turn = (pose.yaw || 0) - view.yaw;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        view.yaw += turn * blend;
      }
      poseViews.set(pose.id, view);
      if (!doll.walking()) {
        doll.setWalker(true);
        if (streetLevel()) doll.mover().material = streets.walkerMaterial();
      }
      doll.plant(view.x, view.y, view.z);
      doll.poseWalker(view.yaw, view.phase || 0, pose.gait || 0, dt, pose.chop || 0);
    } else if (pose.parts) doll.applyParts(pose.parts);
  }
  for (const [id, doll] of guestDolls) {
    if (seen.has(id)) continue;
    doll.dispose();
    guestDolls.delete(id);
    poseViews.delete(id);
  }
}

function playNetFx(data) {
  const mine = !data.who || data.who === selfPeerId;
  if (mine && data.honk) sfx.honk();
  if (mine && data.bawk) sfx.bawk();
  if (mine && data.pickup) sfx.pickup();
  if (mine && data.boom) sfx.boom();
  else if (mine && data.who && data.impact) sfx.impact(data.impact);
  if (data.callout) callout(data.callout);
  if (data.shake) shake(data.shake);
  if (!data.burst || !data.pos) return;
  const colors = data.burst === 'boom'
    ? [0xfff1a8, 0xff7a18, 0xff3355, 0xffffff]
    : data.burst === 'feather'
    ? [0xffd84a, 0xfff6d0, 0xffffff]
    : [0xff5d73, 0xffe14a, 0x4d96ff, 0x6bcb77];
  particles.burst(data.pos.x, data.pos.y, data.pos.z, {
    colors,
    count: data.burst === 'boom' ? 36 : 16,
    speed: 5,
    life: 0.45,
    gravity: 6,
    up: 2.4,
  });
}

function sendInput(dt, gp) {
  if (netRole !== 'guest' || !session || !started) return;
  inputAcc += dt;
  const jump = guestJump;
  const nest = guestNest;
  const drop = guestDrop;
  const swing = !menuOpen && streetLevel() && (swingHeld || gp.swing || keys.has('KeyE') || keys.has('Slash'));
  if (!jump && !nest && !drop && swing === sentSwing && inputAcc < 1 / 15) return;
  inputAcc = 0;
  guestJump = false;
  guestNest = false;
  guestDrop = false;
  sentSwing = swing;
  const wish = menuOpen ? { x: 0, z: 0 } : wishVector(gp);
  const flail = !menuOpen && (flailHeld || keys.has('KeyF') || keys.has('KeyJ') || keys.has('KeyK') || gp.flail);
  netSend({
    t: 'in',
    x: Math.round(wish.x * 100) / 100,
    z: Math.round(wish.z * 100) / 100,
    f: flail ? 1 : 0,
    j: jump ? 1 : 0,
    n: nest ? 1 : 0,
    s: swing ? 1 : 0,
    y: drop ? 1 : 0,
  });
}

function stepGuest(dt) {
  simTime += dt;
  if (!started) yaw += dt * 0.16;
  const gp = pollGamepad();
  if (!menuOpen && started) {
    let lookX = gp.lookX;
    let lookY = gp.lookY;
    if (keys.has('ArrowLeft')) lookX -= 1;
    if (keys.has('ArrowRight')) lookX += 1;
    if (keys.has('ArrowUp')) lookY -= 1;
    if (keys.has('ArrowDown')) lookY += 1;
    yaw -= clamp(lookX, -1, 1) * dt * 2.4;
    pitch = clamp(pitch + clamp(lookY, -1, 1) * dt * 1.6, 0.2, 1.25);
    if (gp.jump && !gpJumpWas) guestJump = true;
    gpJumpWas = !!gp.jump;
  }
  sendInput(dt, gp);
  let hard = false;
  if (pendingSnap && started && streetLevel()) {
    if (pendingSnap !== shownSnap) {
      hard = !!streets.present(pendingSnap.city);
      shownSnap = pendingSnap;
    }
    applyPlayers(pendingSnap.players, dt, hard);
    streets.wearPlayers(pendingSnap.players, (id) => (id === selfPeerId ? ragdoll : guestDolls.get(id)));
  } else streets.wearPlayers([], () => null);
  if (started && streetLevel()) {
    streets.glide(dt);
    streets.tick(dt);
    streets.sync();
  }
  syncDolls(simTime);
  const torso = ragdoll.torso.body;
  particles.update(dt);
  const height = torso.position.y - GROUND_Y;
  const shade = clamp(1 - (height - 0.7) / 5.5, 0, 1);
  blob.position.x = torso.position.x;
  blob.position.z = torso.position.z;
  blob.scale.setScalar(0.75 + (1 - shade) * 1.1);
  blob.material.opacity = 0.3 * shade;
  updateCamera(dt, torso);
  updateHud();
  popups.update(dt);
}

function onNetMessage(data, peerId) {
  if (!data || typeof data !== 'object') return;
  if (netRole === 'host') {
    const peer = roster.get(peerId);
    if (data.t === 'hi') {
      const name = cleanName(data.name);
      pendingNames.set(peerId, name);
      if (peer) {
        peer.name = name;
        if (peer.doll) labelDoll(peer.doll, peer.name);
        broadcastRoster();
      }
      return;
    }
    if (!peer) return;
    if (data.t === 'in') {
      peer.wishX = Number(data.x) || 0;
      peer.wishZ = Number(data.z) || 0;
      peer.flail = !!data.f;
      peer.swing = !!data.s;
      if (data.j) peer.jump = true;
      if (data.y && peer.doll && streetLevel()) streets.dropArm(peer.doll);
      if (data.n && peer.doll && streetLevel() && !streets.locked()) dropAtNest(peer.doll, peer.slot);
    } else if (data.t === 'toys' && peer.doll && streetLevel()) {
      streets.dumpToys(peer.doll.mover().position);
    } else if (data.t === 'reset' && peer.doll && streetLevel()) {
      rescueMate(peer);
    } else if (data.t === 'grav') toggleGravity();
    return;
  }
  if (data.t === 'roster') {
    const lines = [];
    for (const person of data.people || []) {
      lines.push(person.host ? `${person.name} (host)` : person.name);
      if (person.host) hostPeerId = person.id;
      if (person.id === selfPeerId) {
        myColor = person.color || myColor;
        if (started) ragdoll.recolor(myColor);
      }
    }
    const box = document.querySelector('#room-friends');
    if (box) box.textContent = lines.join(' · ');
    const mine = (data.people || []).find((person) => person.id && person.id === selfPeerId);
    if (mine && mine.name !== myName()) announceName();
    refreshNetBadge();
  } else if (data.t === 'go') {
    hostPeerId = peerId;
    if (!started) launchLevel();
    else {
      if (streetLevel()) streets.setMirror(true);
      ragdoll.recolor(myColor);
      closeMenu();
    }
  } else if (data.t === 'snap') {
    pendingSnap = data;
    if (typeof data.score === 'number') {
      score = data.score;
      if (started) updateScoreHud(false);
    }
    refreshNetBadge();
  } else if (data.t === 'fx' && started) playNetFx(data);
}

function onPeerJoin(peerId) {
  if (netRole === 'guest') {
    announceName();
    return;
  }
  if (netRole !== 'host' || peerId === selfPeerId) return;
  if (roster.has(peerId)) return;
  const slot = nextSlot();
  roster.set(peerId, {
    id: peerId,
    name: pendingNames.get(peerId) || 'Friend',
    slot,
    color: FEATHERS[slot % FEATHERS.length],
    doll: null,
    wishX: 0,
    wishZ: 0,
    jump: false,
    flail: false,
    swing: false,
    lastJump: 0,
    lastFlail: 0,
    air: 2,
    walkPhase: 0,
    faceYaw: Math.PI,
    gait: 0,
    spin: 1,
  });
  if (started && streetLevel()) {
    spawnMate(roster.get(peerId));
    syncActors();
  }
  broadcastRoster();
  if (started) netSend({ t: 'go' }, peerId);
  renderFriends();
}

function onPeerLeave(peerId) {
  if (netRole === 'guest' && peerId === hostPeerId) {
    const note = 'The host left, so this shared street stopped.';
    void leaveOnline().then(() => {
      showRoomPicker();
      setRoomStatus(note);
      openMenu();
      playBtn.textContent = 'PLAY';
    });
    return;
  }
  const peer = roster.get(peerId);
  if (!peer) return;
  if (peer.doll) {
    if (streetLevel()) streets.dropArm(peer.doll);
    peer.doll.dispose();
  }
  roster.delete(peerId);
  syncActors();
  broadcastRoster();
  renderFriends();
}

async function leaveOnline() {
  const role = netRole;
  netRole = null;
  hostPeerId = '';
  pendingSnap = null;
  shownSnap = null;
  netPending = null;
  for (const peer of roster.values()) {
    if (peer.doll) peer.doll.dispose();
  }
  roster.clear();
  for (const doll of guestDolls.values()) doll.dispose();
  guestDolls.clear();
  poseViews.clear();
  const current = session;
  session = null;
  roomCode = '';
  if (current) await current.leave().catch(() => {});
  myColor = FEATHERS[0];
  ragdoll.recolor(myColor);
  streets.setMirror(false);
  streets.setShared(false);
  refreshNetBadge();
  if (role === 'guest') {
    started = false;
    menuOpen = true;
    splash.hidden = false;
  }
}

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += alphabet[(Math.random() * alphabet.length) | 0];
  return code;
}

async function openRoom(code, role) {
  await leaveOnline();
  hideRoomPicker();
  showRoomPicker();
  netRole = role;
  roomCode = code;
  setRoomStatus('Connecting…');
  try {
    session = connectRoom(code, {
      onMessage: onNetMessage,
      onJoin: onPeerJoin,
      onLeave: onPeerLeave,
      onError: (error) => setRoomStatus(error.message || 'Connection problem. Try the room again.'),
    });
    await session.ready;
    selfPeerId = await session.selfId();
    streets.setShared(true);
  } catch (error) {
    netRole = null;
    session = null;
    roomCode = '';
    setRoomStatus(error.message || 'Could not connect. Check your internet and try again.');
    refreshNetBadge();
    return;
  }
  document.querySelector('#room-code-view').textContent = code;
  document.querySelector('#room-code-line').hidden = false;
  document.querySelector('#room-host-tools').hidden = true;
  if (role === 'host') {
    document.querySelector('#btn-room-play').hidden = false;
    setRoomStatus('Share this code. When your friends show up, start the street.');
    broadcastRoster();
  } else {
    document.querySelector('#btn-room-play').hidden = true;
    setRoomStatus('Connected. Waiting for the host to start.');
    announceName();
  }
  refreshNetBadge();
}

function startTogether() {
  if (netRole !== 'host' || !session) return;
  netSend({ t: 'go' });
  if (!started) launchLevel();
  else closeMenu();
  sfx.ui();
}

document.querySelector('#btn-menu').addEventListener('click', () => {
  if (!started) return;
  openMenu();
  sfx.ui();
});
document.querySelector('#btn-main-menu').addEventListener('click', () => {
  returnToMainMenu();
  sfx.ui();
});
document.querySelector('#btn-friends').addEventListener('click', () => {
  showRoomPicker();
  sfx.ui();
});
document.querySelector('#btn-host').addEventListener('click', () => {
  void openRoom(makeCode(), 'host');
  sfx.ui();
});
document.querySelector('#join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = document.querySelector('#join-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length < 4) {
    setRoomStatus('Enter the 4-character code from the host.');
    return;
  }
  void openRoom(code, 'guest');
  sfx.ui();
});
document.querySelector('#btn-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    setRoomStatus(`Copied ${roomCode}. Send it to your friends.`);
  } catch {
    setRoomStatus(`Room code: ${roomCode}`);
  }
});
document.querySelector('#net-badge').addEventListener('click', () => {
  void shareRoomCode();
  sfx.ui();
});
document.querySelector('#btn-room-play').addEventListener('click', startTogether);
document.querySelector('#btn-room-leave').addEventListener('click', () => {
  void leaveOnline().then(() => {
    hideRoomPicker();
    setRoomStatus('One computer runs the street. Everyone else connects to it. No server to pay for.');
  });
  sfx.ui();
});

