import * as THREE from 'three';
import {
  FIELD_LENGTH, FIELD_WIDTH, PLAYER_Z, CAMERA_POSITION, CAMERA_LOOK_AT
} from './config.js';

const STRIPE_LENGTH = 5;            // world units per grass stripe
const SCROLL_START_Z = 20;          // props wrap around when they pass this z
const BOARD_LENGTH = 6;
const BOARD_COUNT = 34;             // advertising boards per side
const POLE_SPACING = 25;
const POLE_COUNT = 8;               // floodlight poles per side
const DUST_COUNT = 80;
const CONFETTI_COUNT = 120;
const CONFETTI_LIFETIME = 1.5;      // seconds

let fieldTexture = null;
let worldScene = null;
let dust = null;
let confetti = null;
const scrollingProps = [];          // { object, wrapLength }

// ---------- Field texture (grass stripes + white lines) ----------
function createFieldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  context.fillStyle = '#2e8b3d';
  context.fillRect(0, 0, 256, 64);
  context.fillStyle = '#379a47';
  context.fillRect(0, 64, 256, 64);

  const pixelsPerUnit = 256 / FIELD_WIDTH;
  const toPixelX = (x) => (x + FIELD_WIDTH / 2) * pixelsPerUnit;

  // solid side lines
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.fillRect(toPixelX(-10) - 2, 0, 4, 128);
  context.fillRect(toPixelX(10) - 2, 0, 4, 128);

  // dashed lane separators
  context.fillStyle = 'rgba(255, 255, 255, 0.35)';
  context.fillRect(toPixelX(-1.5) - 1, 6, 2, 52);
  context.fillRect(toPixelX(1.5) - 1, 6, 2, 52);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.repeat.set(1, FIELD_LENGTH / (STRIPE_LENGTH * 2));
  return texture;
}

// ---------- Lights and shadows ----------
function addLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));

  const sunLight = new THREE.DirectionalLight(0xffffff, 1);
  sunLight.position.set(10, 25, 5);
  sunLight.target.position.set(0, 0, -15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -35;
  sunLight.shadow.camera.right = 35;
  sunLight.shadow.camera.top = 35;
  sunLight.shadow.camera.bottom = -35;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 100;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);
}

// ---------- Field and ground ----------
function addField(scene) {
  fieldTexture = createFieldTexture();
  const fieldMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH),
    new THREE.MeshStandardMaterial({ map: fieldTexture })
  );
  fieldMesh.rotation.x = -Math.PI / 2;
  fieldMesh.position.z = -FIELD_LENGTH / 2 + 20;   // covers z = +20 to z = -180
  fieldMesh.receiveShadow = true;
  scene.add(fieldMesh);

  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x1b5e20 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.set(0, -0.05, -100);
  scene.add(outerGround);
}

// ---------- Stadium (static stands + scrolling boards and poles) ----------
function addStands(scene) {
  const standLength = FIELD_LENGTH + 120;
  const lowerMaterial = new THREE.MeshStandardMaterial({ color: 0x455a64 });
  const upperMaterial = new THREE.MeshStandardMaterial({ color: 0x37474f });

  [-1, 1].forEach((side) => {
    const lowerStand = new THREE.Mesh(new THREE.BoxGeometry(5, 3, standLength), lowerMaterial);
    lowerStand.position.set(side * (FIELD_WIDTH / 2 + 6.5), 1.5, -100);
    scene.add(lowerStand);

    const upperStand = new THREE.Mesh(new THREE.BoxGeometry(5, 6, standLength), upperMaterial);
    upperStand.position.set(side * (FIELD_WIDTH / 2 + 11.5), 3, -100);
    scene.add(upperStand);
  });
}

function addBoards(scene) {
  const boardMaterials = [
    new THREE.MeshStandardMaterial({ color: 0xd32f2f }),
    new THREE.MeshStandardMaterial({ color: 0x1976d2 }),
    new THREE.MeshStandardMaterial({ color: 0xfbc02d })
  ];
  const boardGeometry = new THREE.BoxGeometry(0.3, 1.1, BOARD_LENGTH - 0.3);

  [-1, 1].forEach((side) => {
    for (let i = 0; i < BOARD_COUNT; i++) {
      const boardMesh = new THREE.Mesh(boardGeometry, boardMaterials[i % boardMaterials.length]);
      boardMesh.position.set(
        side * (FIELD_WIDTH / 2 + 0.6),
        0.55,
        SCROLL_START_Z - i * BOARD_LENGTH - BOARD_LENGTH / 2
      );
      scene.add(boardMesh);
      scrollingProps.push({ object: boardMesh, wrapLength: BOARD_COUNT * BOARD_LENGTH });
    }
  });
}

function createPole() {
  const poleGroup = new THREE.Group();
  const poleMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0x9e9e9e })
  );
  poleMesh.position.y = 5;
  const lampMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.5, 1),
    new THREE.MeshStandardMaterial({
      color: 0xfff3b0, emissive: 0xfff3b0, emissiveIntensity: 0.8
    })
  );
  lampMesh.position.y = 10.2;
  poleGroup.add(poleMesh, lampMesh);
  return poleGroup;
}

function addPoles(scene) {
  [-1, 1].forEach((side) => {
    for (let i = 0; i < POLE_COUNT; i++) {
      const poleGroup = createPole();
      poleGroup.position.set(
        side * (FIELD_WIDTH / 2 + 2.5),
        0,
        SCROLL_START_Z - i * POLE_SPACING - 5
      );
      scene.add(poleGroup);
      scrollingProps.push({ object: poleGroup, wrapLength: POLE_COUNT * POLE_SPACING });
    }
  });
}

// ---------- Dust (speed feeling) ----------
function placeDustParticle(positions, index, isInitial) {
  positions[index * 3] = (Math.random() - 0.5) * 16;
  positions[index * 3 + 1] = 0.05 + Math.random() * 0.8;
  positions[index * 3 + 2] = isInitial ? -60 + Math.random() * 70 : -60 - Math.random() * 5;
}

function addDust(scene) {
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    placeDustParticle(positions, i, true);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, transparent: true, opacity: 0.5, depthWrite: false
    })
  );
  points.frustumCulled = false;
  scene.add(points);
  dust = { points, positions };
}

// ---------- Confetti (win effect) ----------
function addConfetti(scene) {
  const positions = new Float32Array(CONFETTI_COUNT * 3);
  const colors = new Float32Array(CONFETTI_COUNT * 3);
  const palette = [0xff4757, 0xffa502, 0xfff200, 0x2ed573, 0x1e90ff, 0xffffff];
  const color = new THREE.Color();
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    color.setHex(palette[i % palette.length]);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.3, vertexColors: true, transparent: true, opacity: 1, depthWrite: false
    })
  );
  points.visible = false;
  points.frustumCulled = false;
  scene.add(points);
  confetti = {
    points,
    velocities: new Float32Array(CONFETTI_COUNT * 3),
    age: CONFETTI_LIFETIME,
    isActive: false
  };
}

// ---------- Public functions ----------

// Creates scene, camera and renderer. Handles window resize itself.
export function createWorld() {
  const scene = new THREE.Scene();
  worldScene = scene;
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 60, 150);

  const camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 0.1, 300
  );
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  addLights(scene);
  addField(scene);
  addStands(scene);
  addBoards(scene);
  addPoles(scene);
  addDust(scene);
  addConfetti(scene);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}

// Scrolls field, stadium props and dust toward the camera. Call every frame.
export function updateWorld(delta, speed) {
  fieldTexture.offset.y += (speed * delta) / (STRIPE_LENGTH * 2);

  scrollingProps.forEach((prop) => {
    prop.object.position.z += speed * delta;
    if (prop.object.position.z > SCROLL_START_Z) {
      prop.object.position.z -= prop.wrapLength;
    }
  });

  const dustPositions = dust.positions;
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3 + 2] += speed * delta;
    if (dustPositions[i * 3 + 2] > 10) {
      placeDustParticle(dustPositions, i, false);
    }
  }
  dust.points.geometry.attributes.position.needsUpdate = true;

  updateConfetti(delta);
}

function updateConfetti(delta) {
  if (!confetti || !confetti.isActive) return;
  confetti.age += delta;
  if (confetti.age >= CONFETTI_LIFETIME) {
    confetti.isActive = false;
    confetti.points.visible = false;
    return;
  }
  const attribute = confetti.points.geometry.attributes.position;
  const positions = attribute.array;
  const velocities = confetti.velocities;
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    velocities[i * 3 + 1] += -15 * delta;                  // gravity
    positions[i * 3] += velocities[i * 3] * delta;
    positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
    positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;
  }
  attribute.needsUpdate = true;
  confetti.points.material.opacity = 1 - confetti.age / CONFETTI_LIFETIME;
}

// Visual effect when a duel is won: a short burst of confetti.
export function playWinEffect() {
  if (!confetti) return;
  const positions = confetti.points.geometry.attributes.position.array;
  const velocities = confetti.velocities;
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 2;
    positions[i * 3 + 1] = 1.5;
    positions[i * 3 + 2] = PLAYER_Z;
    velocities[i * 3] = (Math.random() - 0.5) * 8;
    velocities[i * 3 + 1] = 5 + Math.random() * 5;
    velocities[i * 3 + 2] = (Math.random() - 0.7) * 6;
  }
  confetti.points.geometry.attributes.position.needsUpdate = true;
  confetti.points.material.opacity = 1;
  confetti.points.visible = true;
  confetti.age = 0;
  confetti.isActive = true;
}