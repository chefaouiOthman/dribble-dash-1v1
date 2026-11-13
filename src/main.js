import * as THREE from 'three';
import { createWorld, updateWorld, playWinEffect } from './world.js';
import {
  PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DEPTH, PLAYER_Z, GROUND_Y,
  LANE_POSITIONS, LANE_COUNT, LANE_CHANGE_SPEED, GRAVITY, JUMP_FORCE,
  WORLD_SCROLL_SPEED
} from './config.js';

const { scene, camera, renderer } = createWorld();

// ---------- TEMPORARY test player (replaced later by player.js of Member B) ----------
const testPlayerMesh = new THREE.Mesh(
  new THREE.BoxGeometry(PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_DEPTH),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
testPlayerMesh.castShadow = true;
testPlayerMesh.position.set(0, GROUND_Y + PLAYER_HEIGHT / 2, PLAYER_Z);
scene.add(testPlayerMesh);

const restingY = GROUND_Y + PLAYER_HEIGHT / 2;
let testLaneIndex = 1;
let testVelocityY = 0;
let testIsJumping = false;

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.key.startsWith('Arrow')) event.preventDefault();
  if (event.repeat) return;
  if (event.key === 'ArrowLeft') testLaneIndex = Math.max(0, testLaneIndex - 1);
  if (event.key === 'ArrowRight') testLaneIndex = Math.min(LANE_COUNT - 1, testLaneIndex + 1);
  if (event.code === 'Space' && !testIsJumping) {
    testVelocityY = JUMP_FORCE;
    testIsJumping = true;
  }
  if (event.key === 'c' || event.key === 'C') playWinEffect();
});

function updateTestPlayer(delta) {
  const targetX = LANE_POSITIONS[testLaneIndex];
  testPlayerMesh.position.x += (targetX - testPlayerMesh.position.x)
    * Math.min(1, LANE_CHANGE_SPEED * delta);

  if (testIsJumping) {
    testVelocityY += GRAVITY * delta;
    testPlayerMesh.position.y += testVelocityY * delta;
    if (testPlayerMesh.position.y <= restingY) {
      testPlayerMesh.position.y = restingY;
      testVelocityY = 0;
      testIsJumping = false;
    }
  }
}

// ---------- Small on-screen help ----------
const helpDiv = document.createElement('div');
helpDiv.style.cssText =
  'position:fixed;top:10px;left:10px;color:#fff;font:14px monospace;' +
  'background:rgba(0,0,0,0.45);padding:8px 10px;border-radius:6px';
helpDiv.innerHTML =
  'Dribble Dash 1v1 - world test<br>Left / Right : change lane<br>Space : jump<br>C : confetti';
document.body.appendChild(helpDiv);

// ---------- Main loop ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updateWorld(delta, WORLD_SCROLL_SPEED);
  updateTestPlayer(delta);
  renderer.render(scene, camera);
}
animate();