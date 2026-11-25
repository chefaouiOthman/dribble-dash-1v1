import * as THREE from 'three';
import {
  LANE_POSITIONS, LANE_COUNT, GROUND_Y, PLAYER_Z,
  DEFENDER_WIDTH, DEFENDER_HEIGHT, DEFENDER_DEPTH, BLOCK_WIDTH, TACKLE_HEIGHT, TACKLE_DEPTH,
  SPAWN_DISTANCE, TRACK_START_DISTANCE, FEINT_DISTANCE, ATTACK_DISTANCE, TRACK_LANE_SPEED,
  BASE_DEFENDER_SPEED, SPEED_PER_LEVEL, MAX_DEFENDER_SPEED, SLIDE_SPEED_FACTOR, BLOCK_SPEED_FACTOR,
  BASE_REACTION_TIME, REACTION_DECREASE_PER_LEVEL, MIN_REACTION_TIME,
  BASE_WINDUP_TIME, MIN_WINDUP_TIME, DEFENDER_CONTACT_TIME
} from './config.js';
import { createActor, setActorState, setActorKit, updateActor } from './actor.js';

// States: APPROACH -> TRACK -> WINDUP (telegraph) -> ATTACK -> PASSED
// Attack types: SLIDE (tackle on the ground: jump or dodge) and BLOCK (stands: dodge only).
const PASS_OFFSET_Z = 2.5;
const OFFSCREEN_Z = 10;

const KINDS = [
  {
    jerseyColor: 0x1e88e5, accentColor: 0x0d47a1, pattern: 'hoops',
    shortsColor: 0x0d47a1, sockColor: 0x1e88e5, skinColor: 0xc68642,
    hairColor: 0x111111, bootColor: 0x00bcd4,
    speedFactor: 1.0, reactionFactor: 1.0, scale: 1.1
  },
  {
    jerseyColor: 0xfb8c00, accentColor: 0xe65100, pattern: 'stripes',
    shortsColor: 0x4e342e, sockColor: 0xfb8c00, skinColor: 0x8d5524,
    hairColor: 0x1b1b1b, bootColor: 0xffffff,
    speedFactor: 1.1, reactionFactor: 0.85, scale: 1.05
  },
  {
    jerseyColor: 0x37474f, accentColor: 0x263238, pattern: 'plain',
    shortsColor: 0x000000, sockColor: 0x90a4ae, skinColor: 0xffdbac,
    hairColor: 0x3e2723, bootColor: 0xffd600,
    speedFactor: 0.95, reactionFactor: 0.7, scale: 1.2
  }
];

// The defender remembers which side the player usually escapes to.
const memory = { bias: 0 };
const sweptBox = new THREE.Box3();

function getSpeed(defender) {
  const base = Math.min(BASE_DEFENDER_SPEED + (defender.level - 1) * SPEED_PER_LEVEL, MAX_DEFENDER_SPEED);
  return base * defender.kind.speedFactor * (defender.difficultyScale || 1);
}

function getReactionTime(defender) {
  return Math.max(MIN_REACTION_TIME, BASE_REACTION_TIME - (defender.level - 1) * REACTION_DECREASE_PER_LEVEL)
    * defender.kind.reactionFactor;
}

function updateBox(defender) {
  const x = defender.group.position.x;
  const z = defender.group.position.z;
  const isSlide = defender.attackType === 'SLIDE' && (defender.state === 'ATTACK' || defender.state === 'PASSED');
  if (isSlide) {
    defender.box.min.set(x - DEFENDER_WIDTH / 2, GROUND_Y, z - (TACKLE_DEPTH - 0.4));
    defender.box.max.set(x + DEFENDER_WIDTH / 2, GROUND_Y + TACKLE_HEIGHT, z + 0.4);
    return;
  }
  const width = defender.attackType === 'BLOCK' && defender.state === 'ATTACK' ? BLOCK_WIDTH : DEFENDER_WIDTH;
  defender.box.min.set(x - width / 2, GROUND_Y, z - DEFENDER_DEPTH / 2);
  defender.box.max.set(x + width / 2, GROUND_Y + DEFENDER_HEIGHT, z + DEFENDER_DEPTH / 2);
}

function spawn(defender, level) {
  const kind = KINDS[(level - 1) % KINDS.length];
  defender.level = level;
  defender.kind = kind;
  setActorKit(defender.actor, kind);
  defender.attackType = level >= 3 && Math.random() < 0.4 ? 'BLOCK' : 'SLIDE';

  const laneIndex = Math.floor(Math.random() * LANE_COUNT);
  defender.state = 'APPROACH';
  defender.targetLaneIndex = laneIndex;
  defender.reactionTimer = getReactionTime(defender);
  defender.willFeint = level >= 3 && Math.random() < 0.6;
  defender.feintDone = false;
  defender.windupTimer = 0;
  defender.lockDistance = 0;
  defender.lastPlayerLane = -1;
  defender.time = 0;
  defender.runTime = 0;
  defender.contactTimer = 0;
  defender.events.attackStarted = false;
  defender.events.passed = false;

  defender.group.visible = true;
  defender.group.scale.setScalar(kind.scale);
  defender.group.rotation.set(0, 0, 0);
  defender.group.position.set(LANE_POSITIONS[laneIndex], GROUND_Y, -SPAWN_DISTANCE);
  defender.prevZ = defender.group.position.z;
  defender.warningStrip.visible = false;
  setActorState(defender.actor, 'run', { fade: 0.15, force: true });
  updateBox(defender);
}

export function createDefender(scene) {
  const actor = createActor({
    kit: KINDS[0],
    facing: 1
  });
  scene.add(actor.group);

  const warningStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1),
    new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.35, depthWrite: false })
  );
  warningStrip.rotation.x = -Math.PI / 2;
  warningStrip.visible = false;
  scene.add(warningStrip);

  const defender = {
    actor, group: actor.group, warningStrip,
    state: 'APPROACH', attackType: 'SLIDE', level: 1, kind: KINDS[0],
    targetLaneIndex: 1, reactionTimer: 0, willFeint: false, feintDone: false,
    windupTimer: 0, lockDistance: 0, lastPlayerLane: -1, time: 0, runTime: 0,
    prevZ: 0, contactTimer: 0,
    box: new THREE.Box3(),
    events: { attackStarted: false, passed: false },
    eventSnapshot: { attackStarted: false, passed: false }
  };
  spawn(defender, 1);
  return defender;
}

// Moves toward the target lane. Returns the remaining lateral distance.
function moveTowardTargetLane(defender, delta, factor) {
  const targetX = LANE_POSITIONS[defender.targetLaneIndex];
  const difference = targetX - defender.group.position.x;
  const step = TRACK_LANE_SPEED * factor * delta;
  if (Math.abs(difference) <= step) defender.group.position.x = targetX;
  else defender.group.position.x += Math.sign(difference) * step;
  return targetX - defender.group.position.x;
}

// Learns the escape direction of the player during the final approach.
function observePlayer(defender, playerLaneIndex, distance) {
  if (defender.lastPlayerLane >= 0 && playerLaneIndex !== defender.lastPlayerLane && distance < 35) {
    memory.bias = memory.bias * 0.7 + Math.sign(playerLaneIndex - defender.lastPlayerLane) * 0.3;
  }
  defender.lastPlayerLane = playerLaneIndex;
}

function beginWindup(defender) {
  defender.state = 'WINDUP';
  defender.events.attackStarted = true;
  defender.windupTimer = Math.max(MIN_WINDUP_TIME, BASE_WINDUP_TIME - defender.level * 0.02);
  defender.lockDistance = defender.attackType === 'SLIDE'
    ? Math.max(9, 15 - (defender.level - 1) * 0.9)
    : 8;

  // Anticipation: he sometimes goes where the player usually escapes to.
  const anticipation = Math.min(0.5, 0.05 + defender.level * 0.04);
  if (Math.random() < anticipation && Math.abs(memory.bias) > 0.25) {
    const shifted = defender.targetLaneIndex + Math.sign(memory.bias);
    if (shifted >= 0 && shifted < LANE_COUNT) defender.targetLaneIndex = shifted;
  }
}

function beginAttack(defender) {
  defender.state = 'ATTACK';
  defender.reactionTimer = getReactionTime(defender) * 0.6;
  if (defender.attackType === 'SLIDE' && !defender.actor.rig) {
    // The FBX slide clip handles the body; only the procedural fallback needs
    // a manual root rotation.
    defender.group.rotation.x = -1.25;
    defender.group.position.y = GROUND_Y + 0.12;
  }
}

function updateWarningStrip(defender) {
  const strip = defender.warningStrip;
  const length = PLAYER_Z + 0.6 - defender.group.position.z;
  const isArmed = defender.state === 'WINDUP' || defender.state === 'ATTACK';
  if (!isArmed || length <= 0.2) {
    strip.visible = false;
    return;
  }
  strip.visible = true;
  strip.material.color.setHex(defender.attackType === 'SLIDE' ? 0xff1744 : 0xff9100);
  strip.position.set(LANE_POSITIONS[defender.targetLaneIndex], 0.04, defender.group.position.z + length / 2);
  strip.scale.set(1, length, 1);
  strip.material.opacity = 0.28 + 0.18 * Math.sin(defender.time * 22);
}

export function updateDefender(defender, delta, playerLaneIndex) {
  const group = defender.group;
  defender.time += delta;
  defender.prevZ = group.position.z;

  let speed = getSpeed(defender);
  if (defender.state === 'WINDUP') speed *= 0.7;
  if (defender.state === 'ATTACK') {
    speed *= defender.attackType === 'SLIDE' ? SLIDE_SPEED_FACTOR : BLOCK_SPEED_FACTOR;
  }
  if (defender.state === 'PASSED') speed = 12;
  // Contact freezes the defender instead of letting him slide through the player.
  if (defender.contactTimer > 0) {
    defender.contactTimer -= delta;
    speed = 0;
  }
  group.position.z += speed * delta;

  const distance = PLAYER_Z - group.position.z;
  observePlayer(defender, playerLaneIndex, distance);
  let lateral = 0;

  if (defender.state === 'APPROACH' && distance <= TRACK_START_DISTANCE) defender.state = 'TRACK';

  if (defender.state === 'TRACK') {
    defender.reactionTimer -= delta;
    if (defender.willFeint && !defender.feintDone && distance <= FEINT_DISTANCE) {
      defender.feintDone = true;
      defender.targetLaneIndex = (playerLaneIndex + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
      defender.reactionTimer = 0.45;
    } else if (defender.reactionTimer <= 0) {
      defender.targetLaneIndex = playerLaneIndex;
      defender.reactionTimer = getReactionTime(defender);
    }
    lateral = moveTowardTargetLane(defender, delta, 1);
    if (distance <= ATTACK_DISTANCE) beginWindup(defender);
  } else if (defender.state === 'WINDUP') {
    moveTowardTargetLane(defender, delta, 0.8);
    defender.windupTimer -= delta;
    if (defender.windupTimer <= 0) beginAttack(defender);
  } else if (defender.state === 'ATTACK') {
    defender.reactionTimer -= delta;
    if (distance > defender.lockDistance && defender.reactionTimer <= 0) {
      defender.targetLaneIndex = playerLaneIndex;
      defender.reactionTimer = getReactionTime(defender) * 0.6;
    }
    moveTowardTargetLane(defender, delta, 0.8);
  }

  if (defender.state !== 'PASSED' && group.position.z > PLAYER_Z + PASS_OFFSET_Z) {
    defender.state = 'PASSED';
    defender.events.passed = true;
  }

  const isSlide = defender.attackType === 'SLIDE';
  if (defender.state === 'APPROACH' || defender.state === 'TRACK') {
    defender.runTime += delta * 10;
    if (defender.state === 'TRACK' && Math.abs(lateral) > 0.35) {
      setActorState(defender.actor, 'sideStep', { direction: Math.sign(lateral), fade: 0.12 });
    } else {
      setActorState(defender.actor, 'run', { fade: 0.16 });
    }
    if (!defender.actor.rig) {
      group.rotation.z = Math.max(-0.3, Math.min(0.3, -lateral * 0.1));
    }
  } else {
    group.rotation.z = 0;
    if (defender.state === 'WINDUP') {
      // Both attack types stay on their feet during the telegraph.
      setActorState(defender.actor, isSlide ? 'run' : 'idle', { fade: 0.12, speed: 0.55 });
    } else if (defender.state === 'PASSED') {
      setActorState(defender.actor, 'run', { fade: 0.2 });
    } else if (isSlide) {
      setActorState(defender.actor, 'slide', { fade: 0.08 });
    } else {
      // Standing block: low body-block stance, feet on the ground (the clip is
      // trimmed before the body-block animation drops to the turf).
      setActorState(defender.actor, 'block', { fade: 0.06 });
    }
  }

  updateActor(defender.actor, delta);
  updateBox(defender);
  updateWarningStrip(defender);
}

// Swept Z test: at high levels a defender can move further than his own depth
// in one frame, so the box is extended back to its previous position.
export function checkCollision(defender, playerBox) {
  if (defender.state === 'PASSED') return false;
  sweptBox.copy(defender.box);
  const travel = defender.group.position.z - defender.prevZ;
  if (travel > 0) sweptBox.min.z -= travel;
  else if (travel < 0) sweptBox.max.z -= travel;
  return sweptBox.intersectsBox(playerBox);
}

// Visual contact feedback: the defender stops on the contact instead of
// teleporting through the player.
export function markDefenderContact(defender) {
  defender.contactTimer = DEFENDER_CONTACT_TIME;
}

export function isDefenderOffscreen(defender) {
  return defender.group.position.z > OFFSCREEN_Z;
}

// True once the ball has actually travelled past the defender (used for contact).
export function getDefenderContactPoint(defender, out) {
  return out.set(
    defender.group.position.x,
    defender.attackType === 'SLIDE' ? 0.35 : 0.9,
    defender.group.position.z + 0.4
  );
}

export function nextDefender(defender, level, difficultyScale = 1) {
  defender.difficultyScale = difficultyScale;
  spawn(defender, level);
}

export function resetDefender(defender, difficultyScale = 1) {
  memory.bias = 0;
  defender.difficultyScale = difficultyScale;
  spawn(defender, 1);
}

export function consumeDefenderEvents(defender) {
  const snapshot = defender.eventSnapshot;
  snapshot.attackStarted = defender.events.attackStarted;
  snapshot.passed = defender.events.passed;
  defender.events.attackStarted = false;
  defender.events.passed = false;
  return snapshot;
}
