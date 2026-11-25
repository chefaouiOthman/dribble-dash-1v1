import * as THREE from 'three';
import {
  PLAYER_Z, GOAL_DEPTH, GOAL_WIDTH, GOAL_HEIGHT,
  BALL_RADIUS, BALL_GRAVITY, PLAYER_DRIBBLE_FOLLOW
} from './config.js';
import { getPlayerDribbleAnchor } from './player.js';

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

const dribbleTarget = new THREE.Vector3();
const TRAIL_COUNT = 18;

function createShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createBall(scene) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
    new THREE.MeshStandardMaterial({ map: createBallTexture(), roughness: 0.45, metalness: 0.05 })
  );
  mesh.castShadow = true;
  scene.add(mesh);

  // Soft contact shadow directly under the ball for instant height readability.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(BALL_RADIUS * 3.0, BALL_RADIUS * 3.0),
    new THREE.MeshBasicMaterial({
      map: createShadowTexture(), transparent: true, depthWrite: false, opacity: 0.85
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  scene.add(shadow);

  // Pre-allocated shot trail (zero per-frame allocations).
  const trailPositions = new Float32Array(TRAIL_COUNT * 3);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trail = new THREE.Points(
    trailGeometry,
    new THREE.PointsMaterial({
      color: 0xfff59d, size: 0.24, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending
    })
  );
  trail.frustumCulled = false;
  trail.visible = false;
  scene.add(trail);

  return {
    mesh,
    shadow,
    trail,
    trailPositions,
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
    goalBoxZ: null,
    arrivedOutcome: null,
    snapToFeet: true,
    spin: new THREE.Vector3()
  };
}

// The ball follows the real foot contact point, with a light dribble hop.
function placeAtFeet(ball, player, delta) {
  getPlayerDribbleAnchor(player, dribbleTarget);
  if (ball.snapToFeet) {
    ball.mesh.position.copy(dribbleTarget);
    ball.snapToFeet = false;
  } else {
    ball.mesh.position.lerp(dribbleTarget, Math.min(1, delta * PLAYER_DRIBBLE_FOLLOW));
  }
  if (player.mode === 'RUN' && !player.isKnockedDown) {
    const bounce = Math.abs(Math.sin(player.dribblePhase)) * 0.09;
    ball.mesh.position.y += bounce;
    ball.mesh.rotation.x -= delta * 14;
  }
}

export function attachBall(ball) {
  ball.mode = 'DRIBBLE';
  ball.arrivedOutcome = null;
  ball.netLimitZ = null;
  ball.goalBoxZ = null;
  ball.snapToFeet = true;
  ball.trail.visible = false;
  ball.velocity.set(0, 0, 0);
}

// Shoots from "from" to "to". outcome: GOAL, SAVE, POST, BAR or MISS
// (decided before the shot by the single goal-boundary/keeper calculation).
export function launchBall(ball, from, to, flightTime, outcome, goalZ, sideSign) {
  ball.mode = 'FLIGHT';
  ball.from.copy(from);
  ball.flightTime = flightTime;
  ball.elapsed = 0;
  ball.outcome = outcome;
  ball.sideSign = sideSign;
  ball.arrivedOutcome = null;
  ball.goalBoxZ = outcome === 'GOAL' ? goalZ : null;
  ball.launchVelocity.set(
    (to.x - from.x) / flightTime,
    (to.y - from.y + 0.5 * BALL_GRAVITY * flightTime * flightTime) / flightTime,
    (to.z - from.z) / flightTime
  );
  ball.netLimitZ = outcome === 'GOAL' ? goalZ - GOAL_DEPTH + BALL_RADIUS : null;
  ball.backLimitZ = goalZ - 8;
  for (let i = 0; i < TRAIL_COUNT; i++) {
    ball.trailPositions[i * 3] = from.x;
    ball.trailPositions[i * 3 + 1] = from.y;
    ball.trailPositions[i * 3 + 2] = from.z;
  }
  ball.trail.geometry.attributes.position.needsUpdate = true;
  ball.trail.visible = true;
}

// Lets the ball roll away on its own (ball lost).
export function releaseBall(ball, vx, vy, vz) {
  ball.mode = 'FREE';
  ball.velocity.set(vx, vy, vz);
  ball.netLimitZ = null;
  ball.goalBoxZ = null;
  ball.backLimitZ = -400;
}

function applyArrival(ball) {
  const velocity = ball.velocity;
  velocity.set(
    ball.launchVelocity.x,
    ball.launchVelocity.y - BALL_GRAVITY * ball.flightTime,
    ball.launchVelocity.z
  );
  if (ball.outcome === 'GOAL') {
    velocity.multiplyScalar(0.32);
  } else if (ball.outcome === 'SAVE') {
    // Punched/parried away from the goal, on the side the keeper contacted it.
    const sign = ball.sideSign >= 0 ? 1 : -1;
    velocity.set(sign * (2.5 + Math.random() * 3), 2 + Math.random() * 2.5, 5 + Math.random() * 4);
  } else if (ball.outcome === 'POST') {
    const side = Math.sign(ball.launchVelocity.x) || 1;
    velocity.set(side * (4 + Math.random() * 3), 1.5 + Math.random() * 2, 5 + Math.random() * 3);
  } else if (ball.outcome === 'BAR') {
    velocity.set(velocity.x * 0.35, -2 - Math.random() * 2, 4 + Math.random() * 2);
  }
  ball.mode = 'FREE';
  ball.arrivedOutcome = ball.outcome;
}

// Returns the outcome (GOAL, SAVE, POST, BAR, MISS) once, when the ball reaches
// the goal line (or the keeper's plane for a save).
export function consumeBallArrival(ball) {
  const outcome = ball.arrivedOutcome;
  ball.arrivedOutcome = null;
  return outcome;
}

function updateFree(ball, delta) {
  const velocity = ball.velocity;
  const position = ball.mesh.position;
  velocity.y -= BALL_GRAVITY * delta;
  position.addScaledVector(velocity, delta);
  velocity.multiplyScalar(Math.exp(-0.25 * delta));

  // Inside the goal: the ball is contained by the net, not by invisible walls.
  if (ball.goalBoxZ !== null) {
    const maxX = GOAL_WIDTH / 2 - BALL_RADIUS;
    if (position.x > maxX) { position.x = maxX; velocity.x *= -0.35; }
    if (position.x < -maxX) { position.x = -maxX; velocity.x *= -0.35; }
    if (position.y > GOAL_HEIGHT - BALL_RADIUS) {
      position.y = GOAL_HEIGHT - BALL_RADIUS;
      velocity.y *= -0.25;
    }
    if (position.z < ball.goalBoxZ - GOAL_DEPTH + BALL_RADIUS) {
      position.z = ball.goalBoxZ - GOAL_DEPTH + BALL_RADIUS;
      velocity.z *= -0.18;
      velocity.x *= 0.7;
      velocity.y *= 0.7;
    }
  }

  if (position.y < BALL_RADIUS) {
    position.y = BALL_RADIUS;
    velocity.y = velocity.y < -1.2 ? -velocity.y * 0.55 : 0;
    const friction = Math.exp(-2.2 * delta);
    velocity.x *= friction;
    velocity.z *= friction;
  }
  if (position.z < ball.backLimitZ) {
    position.z = ball.backLimitZ;
    velocity.z *= -0.3;
  }
  if (ball.goalBoxZ === null && Math.abs(position.x) > GOAL_WIDTH / 2 + 4) {
    position.x = Math.sign(position.x) * (GOAL_WIDTH / 2 + 4);
    velocity.x *= -0.4;
  }
  ball.mesh.rotation.x -= (velocity.z * delta) / BALL_RADIUS;
  ball.mesh.rotation.z += (velocity.x * delta) / BALL_RADIUS;
}

export function updateBall(ball, delta, player) {
  if (ball.mode === 'DRIBBLE') {
    placeAtFeet(ball, player, delta);
    ball.trail.visible = false;
  } else if (ball.mode === 'FLIGHT') {
    ball.elapsed += delta;
    const t = Math.min(ball.elapsed, ball.flightTime);
    ball.mesh.position.set(
      ball.from.x + ball.launchVelocity.x * t,
      ball.from.y + ball.launchVelocity.y * t - 0.5 * BALL_GRAVITY * t * t,
      ball.from.z + ball.launchVelocity.z * t
    );
    ball.mesh.rotation.x -= delta * 25;
    // Shift trail history without allocating.
    const tp = ball.trailPositions;
    for (let i = TRAIL_COUNT - 1; i > 0; i--) {
      tp[i * 3] = tp[(i - 1) * 3];
      tp[i * 3 + 1] = tp[(i - 1) * 3 + 1];
      tp[i * 3 + 2] = tp[(i - 1) * 3 + 2];
    }
    tp[0] = ball.mesh.position.x;
    tp[1] = ball.mesh.position.y;
    tp[2] = ball.mesh.position.z;
    ball.trail.geometry.attributes.position.needsUpdate = true;
    if (ball.elapsed >= ball.flightTime) {
      applyArrival(ball);
      ball.trail.visible = false;
    }
  } else {
    ball.trail.visible = false;
    updateFree(ball, delta);
  }

  // Update ground contact shadow directly under the ball.
  const heightAboveGround = Math.max(0, ball.mesh.position.y - BALL_RADIUS);
  const shadowScale = Math.max(0.45, 1 - heightAboveGround * 0.14);
  ball.shadow.position.x = ball.mesh.position.x;
  ball.shadow.position.z = ball.mesh.position.z;
  ball.shadow.scale.set(shadowScale, shadowScale, 1);
  ball.shadow.material.opacity = Math.max(0.15, 0.85 - heightAboveGround * 0.22);
}
