import * as THREE from 'three';
import {
  GOAL_WIDTH, GOAL_HEIGHT, GOAL_DEPTH, GOAL_SPAWN_Z, GOAL_DISTANCE,
  KEEPER_DIVE_SPEED, KEEPER_BASE_Y, KEEPER_SAVE_RADIUS, KEEPER_Z_OFFSET,
  POST_TOLERANCE, RETICLE_X_RANGE, SHOT_SPEED
} from './config.js';
import { createHumanoid, poseKeeperReady, poseDive } from './characters.js';
import { createBoardTexture } from './world.js';

const NET_CELL = 0.12;

function createNetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  context.lineWidth = 5;
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
    map: texture, color: 0xb8b8b8, transparent: true, side: THREE.DoubleSide, depthWrite: false
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
  addPipe(group, frameMaterial, 0.06, GOAL_HEIGHT, -half, GOAL_HEIGHT / 2, 0);
  addPipe(group, frameMaterial, 0.06, GOAL_HEIGHT, half, GOAL_HEIGHT / 2, 0);
  addPipe(group, frameMaterial, 0.06, GOAL_WIDTH + 0.12, 0, GOAL_HEIGHT, 0, Math.PI / 2);
  addPipe(group, frameMaterial, 0.04, GOAL_HEIGHT, -half, GOAL_HEIGHT / 2, -GOAL_DEPTH);
  addPipe(group, frameMaterial, 0.04, GOAL_HEIGHT, half, GOAL_HEIGHT / 2, -GOAL_DEPTH);
  addPipe(group, frameMaterial, 0.04, GOAL_WIDTH, 0, GOAL_HEIGHT, -GOAL_DEPTH, Math.PI / 2);
  addPipe(group, frameMaterial, 0.04, GOAL_DEPTH, -half, GOAL_HEIGHT, -GOAL_DEPTH / 2, 0, Math.PI / 2);
  addPipe(group, frameMaterial, 0.04, GOAL_DEPTH, half, GOAL_HEIGHT, -GOAL_DEPTH / 2, 0, Math.PI / 2);

  // Nets: the back panel is a subdivided grid so it can bulge on impact.
  const netTexture = createNetTexture();
  const netGeometry = new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_HEIGHT, 30, 12);
  const backNet = new THREE.Mesh(netGeometry, createNetMaterial(netTexture, GOAL_WIDTH, GOAL_HEIGHT));
  backNet.position.set(0, GOAL_HEIGHT / 2, -GOAL_DEPTH);
  group.add(backNet);
  const topNet = new THREE.Mesh(
    new THREE.PlaneGeometry(GOAL_WIDTH, GOAL_DEPTH), createNetMaterial(netTexture, GOAL_WIDTH, GOAL_DEPTH)
  );
  topNet.rotation.x = -Math.PI / 2;
  topNet.position.set(0, GOAL_HEIGHT, -GOAL_DEPTH / 2);
  group.add(topNet);
  [-1, 1].forEach((side) => {
    const sideNet = new THREE.Mesh(
      new THREE.PlaneGeometry(GOAL_DEPTH, GOAL_HEIGHT), createNetMaterial(netTexture, GOAL_DEPTH, GOAL_HEIGHT)
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
  const stand = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 10),
    new THREE.MeshStandardMaterial({
      map: createStandTexture(), roughness: 1, emissive: 0x222233,
      emissiveMap: createStandTexture(), emissiveIntensity: 0.5
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

  // Keeper.
  const keeper = createHumanoid({
    jerseyColor: 0xc6ff00, accentColor: 0x76b900, pattern: 'plain',
    shortsColor: 0x111111, sockColor: 0xc6ff00, skinColor: 0xf1c27d,
    hairColor: 0x4e342e, gloveColor: 0xff6d00, facing: 1, number: 1
  });
  keeper.group.position.set(0, 0, KEEPER_Z_OFFSET);
  keeper.group.scale.setScalar(1.06);
  group.add(keeper.group);

  // Aiming reticle (a sprite drawn on top of everything, in the goal plane).
  const reticle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createReticleTexture(), color: 0x00e5ff, depthTest: false,
    transparent: true, blending: THREE.AdditiveBlending
  }));
  reticle.scale.set(0.95, 0.95, 1);
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
    keeper.group.position.x = Math.sin(goal.time * 0.9) * 0.4;
    poseKeeperReady(keeper, goal.time);
    return;
  }
  dive.elapsed += delta;
  const progress = Math.min(1, Math.max(0, (dive.elapsed - dive.reaction) / dive.duration));
  const eased = 1 - (1 - progress) * (1 - progress);
  keeper.group.position.x = dive.fromX + (dive.toX - dive.fromX) * eased;
  keeper.group.position.y = Math.max(0, dive.toY - KEEPER_BASE_Y) * 0.7 * eased;
  const sideways = dive.toX - dive.fromX;
  keeper.group.rotation.z = -Math.sign(sideways) * Math.min(1, Math.abs(sideways) / 1.8) * 1.15 * eased;
  if (eased > 0.05) poseDive(keeper);
  else poseKeeperReady(keeper, goal.time);
}

function updateNet(goal, delta) {
  const impact = goal.netImpact;
  if (!impact) return;
  impact.t += delta;
  const positions = goal.netGeometry.attributes.position;
  const array = positions.array;
  const rest = goal.netRest;
  const amplitude = impact.amp * Math.exp(-3 * impact.t) * Math.cos(16 * impact.t);
  const centerY = impact.y - GOAL_HEIGHT / 2;
  for (let i = 0; i < array.length; i += 3) {
    const dx = rest[i] - impact.x;
    const dy = rest[i + 1] - centerY;
    array[i + 2] = -amplitude * Math.exp(-(dx * dx + dy * dy) / 2.2);
  }
  positions.needsUpdate = true;
  if (impact.t > 3) {
    array.set(rest);
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

// The reticle sweeps across the goal; it is red when outside the frame.
export function updateReticle(goal, aimTime, level) {
  const speed = Math.min(2, 1 + level * 0.06);
  goal.reticle.position.set(
    Math.sin(aimTime * 1.9 * speed + 0.7) * RETICLE_X_RANGE,
    1.25 + Math.sin(aimTime * 2.9 * speed) * 1.55,
    0.05
  );
  const x = goal.reticle.position.x;
  const y = goal.reticle.position.y;
  const isInside = Math.abs(x) < GOAL_WIDTH / 2 - 0.06 && y > 0.05 && y < GOAL_HEIGHT - 0.06;
  goal.reticle.material.color.setHex(isInside ? 0x00e5ff : 0xff5252);
}

// Decides the result of the shot (post, miss, save or goal) and the keeper's dive.
export function planShot(goal, from, level) {
  const half = GOAL_WIDTH / 2;
  const target = { x: goal.reticle.position.x, y: goal.reticle.position.y };
  const goalZ = goal.group.position.z;
  const world = new THREE.Vector3(target.x, Math.max(0.15, target.y), goalZ);
  const flightTime = from.distanceTo(world) / SHOT_SPEED;

  // Keeper decision: sometimes he reads the shot, sometimes he guesses.
  const readProbability = Math.min(0.8, 0.28 + level * 0.035);
  const noise = Math.max(0.3, 0.9 - level * 0.04);
  const roll = Math.random();
  let guessX;
  let guessY;
  if (roll < readProbability) {
    guessX = target.x + (Math.random() - 0.5) * 2 * noise;
    guessY = target.y + (Math.random() - 0.5) * 2 * noise * 0.8;
  } else if (roll < readProbability + 0.12) {
    guessX = (Math.random() - 0.5);
    guessY = KEEPER_BASE_Y;
  } else {
    const side = Math.random() < 0.5 ? -1 : 1;
    guessX = side * (1.2 + Math.random() * 2.2);
    guessY = 0.5 + Math.random() * 1.6;
  }
  guessX = Math.max(-half + 0.3, Math.min(half - 0.3, guessX));
  guessY = Math.max(0.4, Math.min(GOAL_HEIGHT - 0.2, guessY));

  const fromX = goal.keeper.group.position.x;
  const reaction = Math.max(0.14, 0.3 - level * 0.012);
  const distance = Math.hypot(guessX - fromX, guessY - KEEPER_BASE_Y);
  const duration = Math.max(0.2, distance / KEEPER_DIVE_SPEED);
  const progress = Math.min(1, Math.max(0, flightTime - reaction) / duration);
  const eased = 1 - (1 - progress) * (1 - progress);
  const reachX = fromX + (guessX - fromX) * eased;
  const reachY = KEEPER_BASE_Y + (guessY - KEEPER_BASE_Y) * eased;
  const isSaved = Math.hypot(target.x - reachX, target.y - reachY) < KEEPER_SAVE_RADIUS;

  const nearPost = Math.abs(Math.abs(target.x) - half) < POST_TOLERANCE && target.y > -0.05 && target.y < GOAL_HEIGHT + 0.1;
  const nearBar = Math.abs(target.y - GOAL_HEIGHT) < POST_TOLERANCE && Math.abs(target.x) < half + POST_TOLERANCE;
  const isInside = Math.abs(target.x) < half && target.y > 0 && target.y < GOAL_HEIGHT;
  let outcome;
  if (nearPost || nearBar) outcome = 'POST';
  else if (!isInside) outcome = 'MISS';
  else outcome = isSaved ? 'SAVE' : 'GOAL';

  return {
    outcome,
    target: world,
    targetLocal: target,
    flightTime,
    goalZ,
    sideSign: guessX >= fromX ? 1 : -1,
    keeper: { fromX, toX: guessX, toY: guessY, reaction, duration },
    launched: false,
    resolved: false
  };
}

export function startKeeperDive(goal, plan) {
  goal.keeperDive = {
    elapsed: 0,
    reaction: plan.keeper.reaction,
    duration: plan.keeper.duration,
    fromX: plan.keeper.fromX,
    toX: plan.keeper.toX,
    toY: plan.keeper.toY
  };
}

export function triggerNetImpact(goal, x, y) {
  goal.netImpact = { x, y, t: 0, amp: 0.85 };
}