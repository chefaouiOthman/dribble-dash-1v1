import * as THREE from 'three';
import {
  LANE_POSITIONS, LANE_COUNT, LANE_CHANGE_SPEED, GROUND_Y, PLAYER_Z,
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DEPTH, GRAVITY, JUMP_FORCE,
  SIDE_STEP_TIME, PLAYER_FALL_DISPLACEMENT
} from './config.js';
import { createActor, setActorState, updateActor, getActorFeet } from './actor.js';

let isInputInstalled = false;

// Reused temporaries: no allocation inside the game loop.
const footLeft = new THREE.Vector3();
const footRight = new THREE.Vector3();
const kickOrigin = new THREE.Vector3();

// Reused cross-fade option objects: updateAnimation() runs every frame and must
// not create a new literal each time.
const TRIP_OPTIONS = { fade: 0.08 };
const KICK_OPTIONS = { fade: 0.07 };
const CELEBRATE_OPTIONS = { fade: 0.2 };
const AIM_OPTIONS = { fade: 0.18 };
const IDLE_OPTIONS = { fade: 0.18 };
const JUMP_OPTIONS = { fade: 0.08 };
const RUN_OPTIONS = { fade: 0.16 };
const SIDE_STEP_OPTIONS = { direction: 0, fade: 0.1, speed: 1.0 };
const KNOCKDOWN_OPTIONS = { fade: 0.06 };
const FORCE_TRIP_OPTIONS = { fade: 0.05, force: true };
const RESET_RUN_OPTIONS = { fade: 0.1, force: true };

// Keyboard, mouse and touch. Inputs are only stored here and applied in updatePlayer.
// Jump and shoot use the same input (the game decides what it means).
function installInput(player) {
  if (isInputInstalled) return;
  isInputInstalled = true;

  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key.startsWith('arrow') || event.code === 'Space') event.preventDefault();
    if (event.repeat || player.isKnockedDown) return;
    if (key === 'arrowleft' || key === 'q' || key === 'a') player.pendingMove = -1;
    if (key === 'arrowright' || key === 'd') player.pendingMove = 1;
    if (key === 'arrowup' || key === 'z' || key === 'w' || event.code === 'Space') {
      player.pendingJump = true;
    }
  });

  window.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button === 0 && !player.isKnockedDown) {
      player.pendingJump = true;
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;
  window.addEventListener('touchstart', (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', (event) => {
    if (player.isKnockedDown) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
      player.pendingMove = deltaX > 0 ? 1 : -1;
    } else if (deltaY < -35 || (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15)) {
      player.pendingJump = true;
    }
  }, { passive: true });
}

// Creates the player and adds it to the scene.
export function createPlayer(scene) {
  const actor = createActor({
    kit: {
      jerseyColor: 0xd32f2f, accentColor: 0xb71c1c, pattern: 'stripes',
      shortsColor: 0xffffff, sockColor: 0xd32f2f, skinColor: 0xf1c27d,
      hairColor: 0x2b1b12, bootColor: 0xffeb3b
    },
    facing: -1,
    number: 10
  });
  actor.group.position.set(LANE_POSITIONS[1], GROUND_Y, PLAYER_Z);
  scene.add(actor.group);

  const player = {
    actor,
    group: actor.group,
    mode: 'RUN',                  // RUN, AIM, KICK, CELEBRATE or IDLE
    modeTime: 0,
    laneIndex: 1,
    isJumping: false,
    velocityY: 0,
    pendingMove: 0,
    pendingJump: false,
    box: new THREE.Box3(),
    runTime: 0,
    dribblePhase: 0,
    kickProgress: 0,
    shotState: 'strikeJog',
    isKnockedDown: false,
    fallProgress: 0,
    stepTimer: 0,
    stepDirection: 0,
    events: { jumped: false, landed: false, moved: false, shoot: false }
  };
  installInput(player);
  return player;
}

export function setPlayerMode(player, mode, shotState) {
  player.mode = mode;
  player.modeTime = 0;
  player.kickProgress = 0;
  if (shotState) player.shotState = shotState;
}

function applyPendingInputs(player) {
  if (player.pendingMove !== 0) {
    const nextLane = Math.min(LANE_COUNT - 1, Math.max(0, player.laneIndex + player.pendingMove));
    if (nextLane !== player.laneIndex) {
      player.stepDirection = Math.sign(LANE_POSITIONS[nextLane] - player.group.position.x) || 1;
      player.laneIndex = nextLane;
      player.stepTimer = SIDE_STEP_TIME;
      player.events.moved = true;
    }
    player.pendingMove = 0;
  }
  if (player.pendingJump) {
    if (!player.isJumping) {
      player.velocityY = JUMP_FORCE;
      player.isJumping = true;
      player.events.jumped = true;
    }
    player.pendingJump = false;
  }
}

// Outside the running mode, the jump input means "shoot" while aiming.
function consumeIdleInputs(player) {
  player.pendingMove = 0;
  if (player.pendingJump) {
    if (player.mode === 'AIM') player.events.shoot = true;
    player.pendingJump = false;
  }
}

function updateLaneMovement(player, delta) {
  const targetX = LANE_POSITIONS[player.laneIndex];
  const difference = targetX - player.group.position.x;
  player.group.position.x += difference * Math.min(1, LANE_CHANGE_SPEED * delta);
  if (!player.actor.rig) {
    player.group.rotation.z = Math.max(-0.3, Math.min(0.3, -difference * 0.08));
  }
}

function updateJump(player, delta) {
  if (!player.isJumping) return;
  player.velocityY += GRAVITY * delta;
  player.group.position.y += player.velocityY * delta;
  if (player.group.position.y <= GROUND_Y) {
    player.group.position.y = GROUND_Y;
    player.velocityY = 0;
    player.isJumping = false;
    player.events.landed = true;
  }
}

function updateAnimation(player, delta) {
  player.runTime += delta * 11;
  player.dribblePhase += delta * 11;
  player.modeTime += delta;
  if (player.stepTimer > 0) player.stepTimer -= delta;

  if (player.isKnockedDown) {
    setActorState(player.actor, 'trip', TRIP_OPTIONS);
  } else if (player.mode === 'KICK') {
    setActorState(player.actor, player.shotState || 'strikeJog', KICK_OPTIONS);
  } else if (player.mode === 'CELEBRATE') {
    setActorState(player.actor, 'celebrate', CELEBRATE_OPTIONS);
  } else if (player.mode === 'AIM' || player.mode === 'IDLE') {
    setActorState(player.actor, player.mode === 'AIM' ? 'aim' : 'idle',
      player.mode === 'AIM' ? AIM_OPTIONS : IDLE_OPTIONS);
  } else if (player.isJumping) {
    setActorState(player.actor, 'jump', JUMP_OPTIONS);
  } else if (player.stepTimer > 0) {
    SIDE_STEP_OPTIONS.direction = player.stepDirection;
    setActorState(player.actor, 'sideStep', SIDE_STEP_OPTIONS);
  } else {
    setActorState(player.actor, 'run', RUN_OPTIONS);
  }
  updateActor(player.actor, delta);
}

function updateKnockdown(player, delta) {
  player.fallProgress = Math.min(1, player.fallProgress + delta * 2.2);
  const eased = 1 - Math.pow(1 - player.fallProgress, 3);
  if (!player.actor.rig) {
    // Procedural fallback keeps the old body rotation; the rigged clip already
    // contains the trip, so rotating the root would double the effect.
    player.group.rotation.x = eased * 1.45;
    player.group.position.y = Math.sin(player.fallProgress * Math.PI) * 0.45 + eased * 0.12;
  }
  player.group.position.z = PLAYER_Z + eased * PLAYER_FALL_DISPLACEMENT;
  setActorState(player.actor, 'trip', KNOCKDOWN_OPTIONS);
  updateActor(player.actor, delta);
}

export function updatePlayer(player, delta) {
  if (player.isKnockedDown) {
    updateKnockdown(player, delta);
    return;
  }
  if (player.mode === 'RUN') applyPendingInputs(player);
  else consumeIdleInputs(player);
  updateLaneMovement(player, delta);
  updateJump(player, delta);
  updateAnimation(player, delta);
}

export function getPlayerBox(player) {
  const x = player.group.position.x;
  const y = player.group.position.y;
  player.box.min.set(x - PLAYER_WIDTH / 2, y, PLAYER_Z - PLAYER_DEPTH / 2);
  player.box.max.set(x + PLAYER_WIDTH / 2, y + PLAYER_HEIGHT, PLAYER_Z + PLAYER_DEPTH / 2);
  return player.box;
}

export function getPlayerLane(player) {
  return player.laneIndex;
}

// Point where the ball leaves the foot when shooting (reused vector).
export function getPlayerKickOrigin(player) {
  return kickOrigin.set(
    player.group.position.x + 0.08,
    Math.max(0.24, player.group.position.y + 0.24),
    PLAYER_Z - 0.58
  );
}

// Ball anchor driven by the REAL foot bones (rigged) or boot meshes (procedural).
export function getPlayerDribbleAnchor(player, out) {
  const hasFeet = getActorFeet(player.actor, footLeft, footRight);
  if (!hasFeet) {
    return out.set(player.group.position.x + 0.08, 0.22, PLAYER_Z - 0.75);
  }
  const playerZ = player.group.position.z;
  const isIdle = player.mode !== 'RUN' || player.isKnockedDown;
  const frontFoot = footLeft.z <= footRight.z ? footLeft : footRight;
  const averageX = (footLeft.x + footRight.x) * 0.5;
  // Keep the ball ahead of the boot: the sphere must not intersect the leg.
  const forwardOffset = isIdle ? 0.62 : 0.42;
  out.set(
    averageX * 0.65 + player.group.position.x * 0.35 + 0.04,
    Math.max(0.2, Math.min(footLeft.y, footRight.y) + 0.1),
    Math.min(frontFoot.z, playerZ) - forwardOffset
  );
  return out;
}

export function knockDownPlayer(player) {
  player.isKnockedDown = true;
  player.fallProgress = 0;
  player.pendingMove = 0;
  player.pendingJump = false;
  player.group.rotation.z = 0;
  setActorState(player.actor, 'trip', FORCE_TRIP_OPTIONS);
}

export function resetPlayer(player) {
  player.mode = 'RUN';
  player.modeTime = 0;
  player.laneIndex = 1;
  player.isJumping = false;
  player.velocityY = 0;
  player.pendingMove = 0;
  player.pendingJump = false;
  player.isKnockedDown = false;
  player.fallProgress = 0;
  player.kickProgress = 0;
  player.stepTimer = 0;
  player.stepDirection = 0;
  player.group.position.set(LANE_POSITIONS[1], GROUND_Y, PLAYER_Z);
  player.group.rotation.set(0, 0, 0);
  player.events.jumped = false;
  player.events.landed = false;
  player.events.moved = false;
  player.events.shoot = false;
  setActorState(player.actor, 'run', RESET_RUN_OPTIONS);
}

// Returns what happened since the last call (for sounds and shooting), then clears it.
export function consumePlayerEvents(player) {
  const snapshot = {
    jumped: player.events.jumped,
    landed: player.events.landed,
    moved: player.events.moved,
    shoot: player.events.shoot
  };
  player.events.jumped = false;
  player.events.landed = false;
  player.events.moved = false;
  player.events.shoot = false;
  return snapshot;
}
