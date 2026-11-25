import * as THREE from 'three';
import {
  GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH, GOAL_SPAWN_Z, GOAL_DISTANCE,
  KEEPER_BASE_Y, KEEPER_Z_OFFSET, POST_RADIUS, CROSSBAR_RADIUS,
  RETICLE_X_RANGE, RETICLE_SIZE, RETICLE_SPEED_BASE, RETICLE_SPEED_PER_LEVEL,
  RETICLE_SPEED_MAX, RETICLE_CENTER_Y, RETICLE_Y_AMPLITUDE,
  SHOT_SPEED, BALL_RADIUS, NET_IMPACT_RADIUS
} from './config.js';
import { createActor, setActorState, updateActor } from './actor.js';
import {
  classifyGoalPoint, SHOT_RESULT, predictBallAtZ, planKeeperSave, clamp
} from './goalMath.js';
import { createBoardTexture } from './world.js';

const NET_CELL = 0.12;
const NET_SEGMENTS_X = 40;
const NET_SEGMENTS_Y = 16;
const NET_FREQUENCY = 15;
const NET_DAMPING = 3.4;

function createNetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, 0); context.lineTo(64, 0);
  context.moveTo(0, 0); context.lineTo(0, 64);
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNetMaterial(baseTexture, width, height) {
  const texture = baseTexture.clone();
  texture.repeat.set(width / NET_CELL, height / NET_CELL);
  texture.needsUpdate = true;
  return new THREE.MeshBasicMaterial({
    map: texture, color: 0xd8d8d8, transparent: true, opacity: 0.9,
    side: THREE.DoubleSide, depthWrite: false
  });
}

function createStandTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#1a2230';
  context.fillRect(0, 0, 1024, 256);
  const shirts = ['#e53935', '#1e88e5', '#ffffff', '#fdd835', '#43a047', '#fb8c00', '#8e24aa'];
  const skins = ['#f1c27d', '#c68642', '#8d5524', '#ffdbac'];
  for (let y = 18; y < 256; y += 13) {
    for (let x = 0; x < 1024; x += 11) {
      const offsetX = x + (Math.random() - 0.5) * 4;
      context.fillStyle = shirts[Math.floor(Math.random() * shirts.length)];
      context.fillRect(offsetX, y, 9, 8);
      context.fillStyle = skins[Math.floor(Math.random() * skins.length)];
      context.beginPath();
      context.arc(offsetX + 4.5, y - 2, 3.2, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createReticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  // Dark outline first: the reticle stays readable over the white goal frame,
  // the crowd and the floodlight beams.
  context.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  context.lineWidth = 13;
  context.beginPath();
  context.arc(64, 64, 40, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 12;
  context.beginPath();
  [[64, 8, 64, 28], [64, 100, 64, 120], [8, 64, 28, 64], [100, 64, 120, 64]].forEach((line) => {
    context.moveTo(line[0], line[1]);
    context.lineTo(line[2], line[3]);
  });
  context.stroke();
  context.strokeStyle = '#ffffff';
  context.lineWidth = 7;
  context.beginPath();
  context.arc(64, 64, 40, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 6;
  context.beginPath();
  [[64, 8, 64, 28], [64, 100, 64, 120], [8, 64, 28, 64], [100, 64, 120, 64]].forEach((line) => {
    context.moveTo(line[0], line[1]);
    context.lineTo(line[2], line[3]);
  });
  context.stroke();
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(64, 64, 5, 0, Math.PI * 2);
  context.fill();
  return new THREE.CanvasTexture(canvas);
}

function addPipe(group, material, radius, length, x, y, z, rotationZ, rotationX) {
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
  pipe.position.set(x, y, z);
  pipe.rotation.z = rotationZ || 0;
  pipe.rotation.x = rotationX || 0;
  pipe.castShadow = true;
  group.add(pipe);
}

function addLine(group, material, width, depth, x, z) {
  const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.012, depth), material);
  line.position.set(x, 0.006, z);
  group.add(line);
}

// Builds the goal (frame, nets, markings, backdrop), the keeper and the aiming reticle.
export function createGoal(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const half = GOAL_WIDTH / 2;
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 });
  // Posts and crossbar use the SAME radii as classifyGoalPoint().
  addPipe(group, frameMaterial, POST_RADIUS, GOAL_HEIGHT, -half, GOAL_HEIGHT / 2, 0);
  addPipe(group, frameMaterial, POST_RADIUS, GOAL_HEIGHT, half, GOAL_HEIGHT / 2, 0);
  addPipe(group, frameMaterial, CROSSBAR_RADIUS, GOAL_WIDTH + POST_RADIUS * 2, 0, GOAL_HEIGHT, 0, Math.PI / 2);
  addPipe(group, frameMaterial, 0.04, GOAL_HEIGHT, -half, GOAL_HEIGHT / 2, -GOAL_DEPTH);
  addPipe(group, frameMaterial, 0.04, GOAL_HEIGHT, half, GOAL_HEIGHT / 2, -GOAL_DEPTH);
  addPipe(group, frameMaterial, 0.04, GOAL_WIDTH, 0, GOAL_HEIGHT, -GOAL_DEPTH, Math.PI / 2);
  addPipe(group, frameMaterial, 0.04, GOAL_DEPTH, -half, GOAL_HEIGHT, -GOAL_DEPTH / 2, 0, Math.PI / 2);
  addPipe(group, frameMaterial, 0.04, GOAL_DEPTH, half, GOAL_HEIGHT, -GOAL_DEPTH / 2, 0, Math.PI / 2);

  // Nets: the back panel is a subdivided grid so it can bulge on impact.
  const netTexture = createNetTexture();
  const netGeometry = new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_HEIGHT, NET_SEGMENTS_X, NET_SEGMENTS_Y);
  const backNet = new THREE.Mesh(netGeometry, createNetMaterial(netTexture, GOAL_WIDTH, GOAL_HEIGHT));
  backNet.position.set(0, GOAL_HEIGHT / 2, -GOAL_DEPTH);
  group.add(backNet);
  const topNet = new THREE.Mesh(
    new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_DEPTH, NET_SEGMENTS_X, 8),
    createNetMaterial(netTexture, GOAL_WIDTH, GOAL_DEPTH)
  );
  topNet.rotation.x = -Math.PI / 2;
  topNet.position.set(0, GOAL_HEIGHT, -GOAL_DEPTH / 2);
  group.add(topNet);
  [-1, 1].forEach((side) => {
    const sideNet = new THREE.Mesh(
      new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_HEIGHT, 8, NET_SEGMENTS_Y),
      createNetMaterial(netTexture, GOAL_DEPTH, GOAL_HEIGHT)
    );
    sideNet.rotation.y = Math.PI / 2;
    sideNet.position.set(side * half, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2);
    group.add(sideNet);
  });

  // Pitch markings (relative to the goal line).
  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  addLine(group, lineMaterial, 24, 0.12, 0, 0);
  addLine(group, lineMaterial, 18.32, 0.12, 0, 5.5);
  addLine(group, lineMaterial, 0.12, 5.5, -9.16, 2.75);
  addLine(group, lineMaterial, 0.12, 5.5, 9.16, 2.75);
  addLine(group, lineMaterial, 24, 0.12, 0, 16.5);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), lineMaterial);
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(0, 0.014, 11);
  group.add(spot);

  // Backdrop: advertising boards and a crowd behind the goal.
  const standTexture = createStandTexture();
  const stand = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 10),
    new THREE.MeshStandardMaterial({
      map: standTexture, roughness: 1, emissive: 0x222233,
      emissiveMap: standTexture, emissiveIntensity: 0.45
    })
  );
  stand.position.set(0, 6, -7.4);
  group.add(stand);
  [
    ['DRIBBLE DASH', '#c62828', '#ffffff'], ['ENSAM', '#1565c0', '#ffffff'],
    ['THREE.JS', '#f9a825', '#212121'], ['WEBGL', '#2e7d32', '#ffffff']
  ].forEach((board, index) => {
    const boardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 1.1),
      new THREE.MeshBasicMaterial({ map: createBoardTexture(board[0], board[1], board[2]) })
    );
    boardMesh.position.set(-24 + index * 16, 0.55, -6.9);
    group.add(boardMesh);
  });

  // Keeper: same rigged character as the outfield players, with keeper clips.
  const keeper = createActor({
    kit: {
      jerseyColor: 0xc6ff00, accentColor: 0x76b900, pattern: 'plain',
      shortsColor: 0x111111, sockColor: 0xc6ff00, skinColor: 0xf1c27d,
      hairColor: 0x4e342e, bootColor: 0xff6d00, gloveColor: 0xff6d00
    },
    facing: 1,
    number: 1
  });
  keeper.group.position.set(0, 0, KEEPER_Z_OFFSET);
  group.add(keeper.group);
  setActorState(keeper, 'keeperIdle', { fade: 0 });

  // Aiming reticle (a sprite drawn on top of everything, in the goal plane).
  const reticle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createReticleTexture(), color: 0x00e5ff, depthTest: false,
    transparent: true, opacity: 1, blending: THREE.NormalBlending
  }));
  reticle.scale.set(RETICLE_SIZE, RETICLE_SIZE, 1);
  reticle.renderOrder = 999;
  reticle.visible = false;
  group.add(reticle);

  return {
    group, keeper, reticle, netGeometry,
    netRest: netGeometry.attributes.position.array.slice(),
    netImpact: null, keeperDive: null,
    arrived: false, time: 0
  };
}

export function showGoal(goal) {
  goal.group.position.set(0, 0, GOAL_SPAWN_Z);
  goal.group.visible = true;
  goal.arrived = false;
  goal.time = 0;
  goal.keeperDive = null;
  goal.keeper.group.position.set(0, 0, KEEPER_Z_OFFSET);
  goal.keeper.group.rotation.set(0, 0, 0);
  setActorState(goal.keeper, 'keeperIdle', { fade: 0.1, force: true });
  goal.netImpact = null;
  goal.netGeometry.attributes.position.array.set(goal.netRest);
  goal.netGeometry.attributes.position.needsUpdate = true;
  goal.reticle.visible = false;
}

export function hideGoal(goal) {
  goal.group.visible = false;
  goal.reticle.visible = false;
  goal.keeperDive = null;
}

export function setReticleVisible(goal, isVisible) {
  goal.reticle.visible = isVisible;
}

function updateKeeper(goal, delta) {
  const keeper = goal.keeper;
  const dive = goal.keeperDive;
  if (!dive) {
    keeper.group.position.x = Math.sin(goal.time * 0.9) * 0.35;
    keeper.group.position.y = 0;
    setActorState(keeper, 'keeperIdle', { fade: 0.2 });
    updateActor(keeper, delta);
    return;
  }
  dive.elapsed += delta;
  const progress = clamp((dive.elapsed - dive.reaction) / Math.max(0.08, dive.duration), 0, 1);
  const eased = 1 - (1 - progress) * (1 - progress);
  keeper.group.position.x = dive.fromX + (dive.toX - dive.fromX) * eased;
  keeper.group.position.y = Math.max(0, dive.toY - KEEPER_BASE_Y) * 0.55 * eased;
  updateActor(keeper, delta);
}

function updateNet(goal, delta) {
  const impact = goal.netImpact;
  if (!impact) return;
  impact.t += delta;
  const positions = goal.netGeometry.attributes.position;
  const array = positions.array;
  const rest = goal.netRest;
  const amplitude = impact.amp * Math.exp(-NET_DAMPING * impact.t) * Math.cos(NET_FREQUENCY * impact.t);
  const centerY = impact.y - GOAL_HEIGHT / 2;
  const radiusSq = NET_IMPACT_RADIUS * NET_IMPACT_RADIUS;
  // Only the vertices in the impact neighbourhood are touched: no full-mesh
  // rebuild and no permanent deformation.
  for (let i = 0; i < array.length; i += 3) {
    const dx = rest[i] - impact.x;
    const dy = rest[i + 1] - centerY;
    const distanceSq = dx * dx + dy * dy;
    array[i + 2] = distanceSq > radiusSq
      ? 0
      : -amplitude * Math.exp(-distanceSq / 1.6) * (1 - distanceSq / radiusSq);
  }
  positions.needsUpdate = true;
  if (impact.t > 2.2) {
    array.set(rest);
    positions.needsUpdate = true;
    goal.netImpact = null;
  }
}

// Moves the goal toward the player until it reaches the shooting position.
export function updateGoal(goal, delta, scrollSpeed) {
  if (!goal.group.visible) return;
  goal.time += delta;
  if (!goal.arrived) {
    goal.group.position.z += scrollSpeed * delta;
    if (goal.group.position.z >= -GOAL_DISTANCE) {
      goal.group.position.z = -GOAL_DISTANCE;
      goal.arrived = true;
    }
  }
  updateKeeper(goal, delta);
  updateNet(goal, delta);
}

// The reticle sweeps across the goal. Its size is constant; difficulty only
// changes the speed/pattern. Its colour uses the exact scoring function.
export function updateReticle(goal, aimTime, level) {
  const speed = Math.min(
    RETICLE_SPEED_MAX,
    RETICLE_SPEED_BASE + (level - 1) * RETICLE_SPEED_PER_LEVEL
  );
  const pattern = level % 2;
  let x;
  let y;
  if (pattern === 0) {
    x = Math.sin(aimTime * 1.9 * speed + 0.7) * RETICLE_X_RANGE;
    y = RETICLE_CENTER_Y + Math.sin(aimTime * 2.9 * speed) * RETICLE_Y_AMPLITUDE;
  } else {
    x = Math.sin(aimTime * 2.35 * speed + 1.2) * RETICLE_X_RANGE;
    y = RETICLE_CENTER_Y + Math.sin(aimTime * 1.7 * speed + 0.55) * RETICLE_Y_AMPLITUDE;
  }
  goal.reticle.position.set(x, y, 0.06);
  const inside = classifyGoalPoint(x, y) === SHOT_RESULT.GOAL;
  goal.reticle.material.color.setHex(inside ? 0x00e5ff : 0xff5252);
}

// Decides the result of the shot and the keeper's action from the real
// trajectory. The keeper predicts the crossing point at its own plane, then
// moves only as far as reaction time + speed allow:
//  - central shot -> no lateral dive (catch or body block),
//  - lateral shot -> dive on the correct side,
//  - unreachable shot -> goal even if the keeper dives the right way.
export function planShot(goal, from, level) {
  const aimX = goal.reticle.position.x;
  const aimY = goal.reticle.position.y;
  const goalZ = goal.group.position.z;
  const target = new THREE.Vector3(aimX, aimY, goalZ);
  const shotDistance = from.distanceTo(target);
  const flightTime = Math.max(0.12, shotDistance / SHOT_SPEED);

  const boundary = classifyGoalPoint(aimX, aimY);

  const keeperPlaneZ = goalZ + KEEPER_Z_OFFSET;
  const predicted = predictBallAtZ(from, target, keeperPlaneZ, flightTime, {
    x: 0, y: 0, time: 0
  });
  const fromX = goal.keeper.group.position.x;
  const errorFactor = Math.random();
  const keeper = planKeeperSave({
    fromX,
    fromY: KEEPER_BASE_Y,
    crossingX: predicted.x,
    crossingY: predicted.y,
    time: predicted.time,
    level,
    errorFactor
  });

  let outcome = boundary;
  let ballTarget = target;
  let ballFlightTime = flightTime;
  if (boundary === SHOT_RESULT.GOAL && keeper.save) {
    outcome = SHOT_RESULT.SAVE;
    ballTarget = new THREE.Vector3(predicted.x, predicted.y, keeperPlaneZ);
    ballFlightTime = Math.max(0.1, predicted.time);
  }

  const plan = {
    outcome,
    boundary,
    target: ballTarget,
    targetLocal: { x: aimX, y: aimY },
    flightTime: ballFlightTime,
    goalZ,
    sideSign: keeper.direction || 1,
    keeper,
    launched: false,
    resolved: false
  };
  goal.lastPlan = plan;
  return plan;
}

export function startKeeperDive(goal, plan) {
  // A shot that is going clearly wide/high does not deserve a dive animation:
  // the keeper would look like he guessed the wrong way. He simply stays ready.
  if (plan.boundary === SHOT_RESULT.MISS) {
    goal.keeperDive = null;
    setActorState(goal.keeper, 'keeperIdle', { fade: 0.15, force: true });
    return;
  }
  const keeper = plan.keeper;
  goal.keeperDive = {
    elapsed: 0,
    reaction: keeper.reaction,
    duration: keeper.duration,
    fromX: goal.keeper.group.position.x,
    toX: keeper.endX,
    toY: keeper.endY
  };
  const direction = keeper.direction;
  if (keeper.mode === 'CATCH') {
    setActorState(goal.keeper, 'keeperCatch', { fade: 0.05, force: true });
  } else if (keeper.mode === 'BLOCK') {
    setActorState(goal.keeper, 'keeperBlock', {
      direction: direction || 1, fade: 0.05, force: true, speed: 1.35
    });
  } else {
    const playback = Math.min(2.2, Math.max(1, 1.0 / Math.max(0.25, keeper.duration)));
    setActorState(goal.keeper, 'keeperDive', {
      direction: direction || 1, fade: 0.04, force: true, speed: playback
    });
  }
}

export function triggerNetImpact(goal, x, y, strength) {
  goal.netImpact = { x, y, t: 0, amp: 0.85 * (strength === undefined ? 1 : strength) };
}

export { BALL_RADIUS };
