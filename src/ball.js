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

export function createBall(scene) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
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
    return;
  }
  if (ball.mode === 'FLIGHT') {
    ball.elapsed += delta;
    const t = Math.min(ball.elapsed, ball.flightTime);
    ball.mesh.position.set(
      ball.from.x + ball.launchVelocity.x * t,
      ball.from.y + ball.launchVelocity.y * t - 0.5 * BALL_GRAVITY * t * t,
      ball.from.z + ball.launchVelocity.z * t
    );
    ball.mesh.rotation.x -= delta * 25;
    if (ball.elapsed >= ball.flightTime) applyArrival(ball);
    return;
  }
  updateFree(ball, delta);
}
