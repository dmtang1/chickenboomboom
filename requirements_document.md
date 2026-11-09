# Game Requirements: 3D Ragdoll Sandbox & Playground

## 1. Overview & Vision

A single-player, web-based 3D physics sandbox centered around endless, zero-pressure ragdoll chaos. There are no timers, no fail states, and no strict objectives—just pure physics-driven destruction, button-mashing fun, and instant rewards.

## 2. Core Gameplay & Features

### 2.1 Ragdoll Physics & Interactions

* **3D Physics Rig:** Full humanoid skeletal mesh bound to a rigid-body physics ragdoll (head, torso, upper/lower arms, hands, upper/lower legs, feet).
* **Steer & Flail:** Basic directional controls (WASD / thumbstick) to steer, paired with action buttons for **Flail Impulses**.
* **Button-Mashing & Chaos Mechanics:**
  * **The "Flail" Impulse:** Every tap applies a small, randomized upward or outward force to the ragdoll's limbs. Frantic mashing turns the character into an uncontrollable human helicopter that knocks over everything nearby.
  * **Overheat & Pop (Chaos Meter):** Spamming inputs fills a **Chaos Meter**, making the ragdoll glow, vibrate, and emit sparks. Maxing it out triggers **MAX CHAOS!**—rocketing the ragdoll forward like a firework or turning them into a glowing wrecking ball for massive point multipliers.
  * **Sticky Traps & Break-Free Events:** Optional hazards like slime or mud that trap the ragdoll until the player mashes fast enough to thrash violently and pop free.

### 2.2 Endless Toy-Box Sandbox

* **Open Sandbox Arena:** A bright, toy-box 3D arena packed with random, destructible physics props—Jenga towers, stacked foam blocks, wooden crates, bowling pins, giant rubber ducks, trampolines, and piñatas.
* **Endless Respawning:** As props are smashed or knocked off the edge, new random toys periodically rain down from the sky so the arena never runs empty.
* **Interactive Props:**
  * **Bouncy Pads / Trampolines:** High-rebound surfaces for launching across the arena.
  * **Swinging Hazards:** Giant toy hammers and pendulums that send the ragdoll flying.
  * **Cannons / Launchers:** Prop devices to fire the ragdoll across the map.

### 2.3 Destruction Scoring & Emergent Badges

* **Pure Destruction Scoring:** Every bump, topple, and shatter triggers floating point popups (`+50`, `SMASH!`, `x15 COMBO`) and showers coins or confetti.
* **Emergent "Silly" Badges:** The game watches physics events and awards instant pop-up badges for ridiculous moments:
  * **Wrecking Ball:** Knock over 50 blocks in 10 seconds.
  * **Button Masher:** Max out the Chaos Meter 3 times.
  * **Airborne Menace:** Stay off the ground for 5 seconds straight.
  * **Duck Hunter:** Launch a giant rubber duck into orbit.
  * **Human Helicopter:** Spin at max speed while flailing.

### 2.4 Camera & Controls

* **Dynamic Follow / Orbit Camera:** Smooth 360-degree rotation, pan, and zoom controls that keep the flying ragdoll in view.
* **Mouse/Touch/Gamepad Support:** Full support for keyboard, mouse/touch raycasting, and gamepad button mashing.

## 3. Visual & Audio Experience

### 3.1 Visual Style

* **Art Direction:** Stylized, vibrant toy-box aesthetic with bright primary colors, soft shadows, and playful textures.
* **Particle Effects:** Impact bursts, collision sparkles, confetti explosions, dust clouds on landing, and glowing Chaos Meter trails.

### 3.2 Audio & Zero-Cooldown "Juice"

* **Zero-Cooldown Feedback:** Even if physics forces are capped to keep the engine stable, audiovisual feedback is never capped. Every single button press triggers a squeak, boing, particle puff, or subtle camera shake so spamming always feels responsive.
* **Impact SFX:** Dynamic sound pitch/volume mapped to ragdoll collision velocity and prop destruction.

## 4. UI / UX Design

* **HUD:**
  * **Chaos Meter:** Vertical fiery meter on the side showing current spam charge and **MAX CHAOS!** state.
  * **Score & Combo Counter:** Live total coins/points and active destruction combo multiplier.
  * **Badge Pop-ups:** Celebratory toast notifications when an emergent badge is unlocked.
  * **Quick Sandbox Controls:** Buttons to spawn fresh toy piles, reset ragdoll position, or toggle gravity.

## 5. Technical Requirements & Stack

### 5.1 Tech Stack

* **Framework:** Single-file HTML/JS or React Three Fiber setup.
* **3D Engine:** Three.js.
* **Physics Engine:** Cannon.js (`cannon-es`) or Rapier (`@dimforge/rapier3d`).

### 5.2 Performance Targets

* Maintain 60 FPS under normal loads (1 active ragdoll + dozens of interactive destructible props).
* Efficient collision detection and object pooling/cleanup for endlessly respawning toys.