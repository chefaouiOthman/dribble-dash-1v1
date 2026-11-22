import * as THREE from 'three';
import { PLAYER_Z, GOAL_DEPTH } from './config.js';

const RADIUS = 0.22;
const GRAVITY = 9.8;

function createBallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#f5f5f5';
  context.fillRect(0, 0, 256, 128);
  context.fillStyle = '#1a1a1a';
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 6; column++) {
      const x = column * 43 + (row % 2) * 21 + 15;
      const y = row * 44 + 20;
      context.beginPath();
      for (let k = 0; k < 5; k++) {
        const angle = (k / 5) * Math.PI * 2 - Math.PI / 2;
        context.lineTo(x + Math.cos(angle) * 13, y + Math.sin(angle) * 13);
      }
      context.closePath();
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createBall(scene) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 32, 24),
    new THREE.MeshStandardMaterial({ map: createBallTexture(), roughness: 0.45, metalness: 0.05 })
  );
  mesh.castShadow = true;
  scene.add(mesh);
  return {
    mesh,
    mode: 'DRIBBLE',                 // DRIBBLE (at the feet), FLIGHT (shot), FREE (physics)
    velocity: new THREE.Vector3(),
    from: new THREE.Vector3(),
    launchVelocity: new THREE.Vector3(),
    flightTime: 1,
    elapsed: 0,
    outcome: null,
    sideSign: 1,
    netLimitZ: null,
    backLimitZ: -400,
    arrivedOutcome: null
  };
}

function placeAtFeet(ball, player) {
  const isIdle = player.mode !== 'RUN';
  const bounce = isIdle ? 0 : Math.abs(Math.sin(player.dribblePhase));
  const forward = isIdle ? 0.65 : 0.85 + Math.sin(player.dribblePhase * 0.5) * 0.18;
  ball.mesh.position.set(
    player.group.position.x + 0.08,
    player.group.position.y + RADIUS + bounce * 0.16,
    PLAYER_Z - forward
  );
}

export function attachBall(ball) {
  ball.mode = 'DRIBBLE';
  ball.arrivedOutcome = null;
  ball.netLimitZ = null;
}

// Shoots from "from" to "to". outcome: GOAL, SAVE, POST or MISS (decided before the shot).
export function launchBall(ball, from, to, flightTime, outcome, goalZ, sideSign) {
  ball.mode = 'FLIGHT';
  ball.from.copy(from);
  ball.flightTime = flightTime;
  ball.elapsed = 0;
  ball.outcome = outcome;
  ball.sideSign = sideSign;
  ball.arrivedOutcome = null;
  ball.launchVelocity.set(
    (to.x - from.x) / flightTime,
    (to.y - from.y + 0.5 * GRAVITY * flightTime * flightTime) / flightTime,
    (to.z - from.z) / flightTime
  );
  ball.netLimitZ = outcome === 'GOAL' ? goalZ - GOAL_DEPTH + 0.3 : null;
  ball.backLimitZ = goalZ - 8;
}

// Lets the ball roll away on its own (ball lost).
export function releaseBall(ball, vx, vy, vz) {
  ball.mode = 'FREE';
  ball.velocity.set(vx, vy, vz);
  ball.netLimitZ = null;
  ball.backLimitZ = -400;
}

function applyArrival(ball) {
  const velocity = ball.velocity;
  velocity.set(
    ball.launchVelocity.x,
    ball.launchVelocity.y - GRAVITY * ball.flightTime,
    ball.launchVelocity.z
  );
  if (ball.outcome === 'GOAL') {
    velocity.multiplyScalar(0.3);
  } else if (ball.outcome === 'SAVE') {
    velocity.set(ball.sideSign * (3 + Math.random() * 4), 2 + Math.random() * 3, 6 + Math.random() * 4);
  } else if (ball.outcome === 'POST') {
    velocity.set((Math.random() - 0.5) * 8, 2 + Math.random() * 2, 6 + Math.random() * 3);
  }
  ball.mode = 'FREE';
  ball.arrivedOutcome = ball.outcome;
}

// Returns the outcome (GOAL, SAVE, POST, MISS) once, at the moment the ball reaches the goal line.
export function consumeBallArrival(ball) {
  const outcome = ball.arrivedOutcome;
  ball.arrivedOutcome = null;
  return outcome;
}

function updateFree(ball, delta) {
  const velocity = ball.velocity;
  const position = ball.mesh.position;
  velocity.y -= GRAVITY * delta;
  position.addScaledVector(velocity, delta);
  velocity.multiplyScalar(Math.exp(-0.25 * delta));
  if (position.y < RADIUS) {
    position.y = RADIUS;
    velocity.y = velocity.y < -1.2 ? -velocity.y * 0.55 : 0;
    const friction = Math.exp(-2.2 * delta);
    velocity.x *= friction;
    velocity.z *= friction;
  }
  if (ball.netLimitZ !== null && position.z < ball.netLimitZ) {
    position.z = ball.netLimitZ;
    velocity.z *= -0.15;
    velocity.x *= 0.6;
  }
  if (position.z < ball.backLimitZ) {
    position.z = ball.backLimitZ;
    velocity.z *= -0.3;
  }
  if (Math.abs(position.x) > 11.5) {
    position.x = Math.sign(position.x) * 11.5;
    velocity.x *= -0.4;
  }
  ball.mesh.rotation.x -= (velocity.z * delta) / RADIUS;
  ball.mesh.rotation.z += (velocity.x * delta) / RADIUS;
}

export function updateBall(ball, delta, player) {
  if (ball.mode === 'DRIBBLE') {
    if (player.mode === 'RUN') ball.mesh.rotation.x -= delta * 14;
    placeAtFeet(ball, player);
    return;
  }
  if (ball.mode === 'FLIGHT') {
    ball.elapsed += delta;
    const t = Math.min(ball.elapsed, ball.flightTime);
    ball.mesh.position.set(
      ball.from.x + ball.launchVelocity.x * t,
      ball.from.y + ball.launchVelocity.y * t - 0.5 * GRAVITY * t * t,
      ball.from.z + ball.launchVelocity.z * t
    );
    ball.mesh.rotation.x -= delta * 25;
    if (ball.elapsed >= ball.flightTime) applyArrival(ball);
    return;
  }
  updateFree(ball, delta);
}