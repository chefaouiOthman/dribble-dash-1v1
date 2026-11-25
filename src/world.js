import * as THREE from 'three';
import {
  FIELD_LENGTH, FIELD_WIDTH, PLAYER_Z, CAMERA_POSITION, CAMERA_LOOK_AT, BASE_FOV
} from './config.js';

const STRIPE_LENGTH = 5;
const SCROLL_START_Z = 20;
const BOARD_LENGTH = 6;
const BOARD_COUNT = 30;
const POLE_SPACING = 25;
const POLE_COUNT = 8;
const DUST_COUNT = 90;
const CROWD_Z_MIN = -140;
const CROWD_Z_MAX = 20;
const CROWD_SPACING = 1.7;
const STEP_WIDTH = 1.67;
const STAND_DEFS = [
  { offset: 6.5, topHeight: 3 },
  { offset: 11.5, topHeight: 6.2 }
];

// Visual themes: the player picks one BEFORE kick-off and it stays fixed for
// the whole match (no automatic cycling mid-game).
const THEMES = [
  {
    name: 'JOUR', top: 0x2e7fe6, horizon: 0xbfe0ff, fog: 0xb5d5f0, hemiSky: 0xcfe6ff,
    hemiGround: 0x3a5a2a, light: 0xfff1d6, sunColor: 0xfff0c0, cloudColor: 0xffffff,
    hemi: 1.3, lightI: 3.0, stars: 0, cloud: 0.85, lamp: 0.25, beams: 0, exposure: 1.0,
    bloom: 0.35, board: 1.0, lightPos: [10, 26, 9], sunDir: [0.3, 0.45, -0.84]
  },
  {
    name: 'COUCHER DE SOLEIL', top: 0x3a4a9e, horizon: 0xff8a4a, fog: 0xe89a70, hemiSky: 0xffc79a,
    hemiGround: 0x3a3a2a, light: 0xffb070, sunColor: 0xffa040, cloudColor: 0xffb88a,
    hemi: 1.1, lightI: 2.6, stars: 0.1, cloud: 0.9, lamp: 1.0, beams: 0.016, exposure: 1.0,
    bloom: 0.45, board: 0.9, lightPos: [16, 8, 10], sunDir: [0.15, 0.07, -0.99]
  },
  {
    name: 'NUIT', top: 0x03071a, horizon: 0x1a2a55, fog: 0x101a3a, hemiSky: 0x3a4a8a,
    hemiGround: 0x101a10, light: 0xa8bfff, sunColor: 0xcfd8ff, cloudColor: 0x2a3560,
    hemi: 0.8, lightI: 1.6, stars: 1, cloud: 0.25, lamp: 2.2, beams: 0.045, exposure: 1.15,
    bloom: 0.6, board: 0.7, lightPos: [-9, 22, 10], sunDir: [-0.35, 0.4, -0.85]
  }
];
const COLOR_KEYS = ['top', 'horizon', 'fog', 'hemiSky', 'hemiGround', 'light', 'sunColor', 'cloudColor'];
const NUMBER_KEYS = ['hemi', 'lightI', 'stars', 'cloud', 'lamp', 'beams', 'exposure', 'bloom', 'board'];

const atmosphere = { colors: {}, numbers: {}, lightPos: new THREE.Vector3(), sunDir: new THREE.Vector3() };
COLOR_KEYS.forEach((key) => { atmosphere.colors[key] = new THREE.Color(THEMES[0][key]); });
NUMBER_KEYS.forEach((key) => { atmosphere.numbers[key] = THEMES[0][key]; });
atmosphere.lightPos.set(...THEMES[0].lightPos);
atmosphere.sunDir.set(...THEMES[0].sunDir);

let worldRenderer = null;
let worldScene = null;
let skyMaterial = null;
let hemiLight = null;
let sunLight = null;
let lampMaterial = null;
let beamMaterial = null;
let glowMaterial = null;
let fieldTexture = null;
let themeIndex = 0;
let worldTime = 0;
let crowdExcitement = 0;
let crowdScroll = 0;
let dust = null;
let crowd = null;
let confetti = null;
let sparks = null;
let turfBurst = null;
let fireworks = [];

const dummy = new THREE.Object3D();
const targetColor = new THREE.Color();
const targetVector = new THREE.Vector3();
const scrollingProps = [];
const boardMaterials = [];

// ---------- Textures ----------
function createFieldTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = '#2b8a3a';
  context.fillRect(0, 0, 512, 128);
  context.fillStyle = '#35a046';
  context.fillRect(0, 128, 512, 128);
  for (let i = 0; i < 9000; i++) {
    context.fillStyle = Math.random() < 0.5
      ? 'rgba(0, 40, 0, ' + (Math.random() * 0.12).toFixed(3) + ')'
      : 'rgba(180, 255, 150, ' + (Math.random() * 0.08).toFixed(3) + ')';
    context.fillRect(Math.random() * 512, Math.random() * 256, 1, 2 + Math.random() * 3);
  }
  const pixelsPerUnit = 512 / FIELD_WIDTH;
  const toPixelX = (x) => (x + FIELD_WIDTH / 2) * pixelsPerUnit;
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.fillRect(toPixelX(-10) - 3, 0, 6, 256);
  context.fillRect(toPixelX(10) - 3, 0, 6, 256);
  context.fillStyle = 'rgba(255, 255, 255, 0.35)';
  context.fillRect(toPixelX(-1.5) - 2, 12, 4, 104);
  context.fillRect(toPixelX(1.5) - 2, 12, 4, 104);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.repeat.set(1, FIELD_LENGTH / (STRIPE_LENGTH * 2));
  return texture;
}

export function createBoardTexture(text, background, textColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = background;
  context.fillRect(0, 0, 512, 96);
  context.fillStyle = 'rgba(255, 255, 255, 0.18)';
  context.fillRect(0, 0, 512, 8);
  context.fillStyle = textColor;
  context.font = 'bold 56px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 240, 200, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 240, 200, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createLampTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#000';
  context.fillRect(0, 0, 128, 64);
  context.fillStyle = '#fff';
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 6; column++) {
      context.beginPath();
      context.arc(12 + column * 20.8, 11 + row * 20.5, 8, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------- Sky (GLSL shader: gradient, clouds, sun or moon, stars) ----------
function addSky(scene) {
  skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: atmosphere.colors.top },
      uHorizon: { value: atmosphere.colors.horizon },
      uSunDir: { value: atmosphere.sunDir },
      uSunColor: { value: atmosphere.colors.sunColor },
      uCloudColor: { value: atmosphere.colors.cloudColor },
      uCloudAmount: { value: 0.8 },
      uStars: { value: 0 },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
      uniform vec3 uCloudColor; uniform float uCloudAmount; uniform float uStars; uniform float uTime;
      varying vec3 vDir;
      float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float hash31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i); float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0)); float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float value = 0.0; float amplitude = 0.5;
        for (int i = 0; i < 5; i++) { value += amplitude * noise(p); p *= 2.02; amplitude *= 0.5; }
        return value;
      }
      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 color = mix(uHorizon, uTop, pow(h, 0.5));
        float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
        color += uSunColor * (pow(sunDot, 700.0) * 4.0 + pow(sunDot, 14.0) * 0.4);
        if (dir.y > 0.02) {
          vec2 cloudUv = dir.xz / (dir.y + 0.25) * 1.6 + vec2(uTime * 0.012, 0.0);
          float cloud = smoothstep(0.45, 0.85, fbm(cloudUv)) * smoothstep(0.02, 0.25, dir.y);
          color = mix(color, uCloudColor, cloud * uCloudAmount);
        }
        if (uStars > 0.01 && dir.y > 0.0) {
          vec3 cell = floor(dir * 220.0);
          float star = step(0.9965, hash31(cell));
          float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + hash31(cell) * 40.0);
          color += vec3(star * twinkle) * uStars * smoothstep(0.0, 0.3, dir.y);
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(350, 32, 16), skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
}

// ---------- Lights ----------
function addLights(scene) {
  hemiLight = new THREE.HemisphereLight(THEMES[0].hemiSky, THEMES[0].hemiGround, THEMES[0].hemi);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(THEMES[0].light, THEMES[0].lightI);
  sunLight.position.copy(atmosphere.lightPos);
  sunLight.target.position.set(0, 0, -15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1536, 1536);
  sunLight.shadow.camera.left = -24;
  sunLight.shadow.camera.right = 24;
  sunLight.shadow.camera.top = 24;
  sunLight.shadow.camera.bottom = -24;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 90;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);
}

// ---------- Field ----------
function addField(scene) {
  fieldTexture = createFieldTexture();
  const fieldMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_LENGTH),
    new THREE.MeshStandardMaterial({ map: fieldTexture, roughness: 0.95 })
  );
  fieldMesh.rotation.x = -Math.PI / 2;
  fieldMesh.position.z = -FIELD_LENGTH / 2 + 20;
  fieldMesh.receiveShadow = true;
  scene.add(fieldMesh);

  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 1 })
  );
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.set(0, -0.05, -100);
  scene.add(outerGround);
}

// ---------- Stands and crowd ----------
function getStepHeight(stand, step) {
  return stand.topHeight - (2 - step) * 0.7;
}

function getStepX(side, stand, step) {
  return side * (FIELD_WIDTH / 2 + stand.offset + (step - 1) * STEP_WIDTH);
}

function addStands(scene) {
  const standLength = FIELD_LENGTH + 120;
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.9 })
  ];
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.7, metalness: 0.3 });
  const roofGeometry = new THREE.BoxGeometry(10.5, 0.35, standLength);
  [-1, 1].forEach((side) => {
    STAND_DEFS.forEach((stand, standIndex) => {
      for (let step = 0; step < 3; step++) {
        const height = getStepHeight(stand, step);
        const stepMesh = new THREE.Mesh(
          new THREE.BoxGeometry(STEP_WIDTH, height, standLength), materials[standIndex]
        );
        stepMesh.position.set(getStepX(side, stand, step), height / 2, -100);
        scene.add(stepMesh);
      }
    });
    const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial);
    roofMesh.position.set(side * (FIELD_WIDTH / 2 + 10.2), 9.4, -100);
    roofMesh.rotation.z = side * 0.14;
    scene.add(roofMesh);
  });
}

function addCrowd(scene) {
  const rowCount = 2 * STAND_DEFS.length * 3;
  const perRow = Math.floor((CROWD_Z_MAX - CROWD_Z_MIN) / CROWD_SPACING);
  const count = rowCount * perRow;

  // More realistic proportions: taller torso (shoulders/chest), distinct head on neck.
  const bodies = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.52, 0.76, 0.38), new THREE.MeshStandardMaterial({ roughness: 0.85 }), count
  );
  const heads = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.19, 10, 7), new THREE.MeshStandardMaterial({ roughness: 0.75 }), count
  );
  // Arms: each spectator gets a left and right arm via two transforms in one mesh.
  // We use a single arm InstancedMesh with count instances — the direction is chosen
  // at build time per spectator so nearby ones look varied.
  const arms = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.13, 0.46, 0.13), new THREE.MeshStandardMaterial({ roughness: 0.85 }), count
  );
  // Scarves: a thin coloured strip across the torso — same count, one draw call.
  const scarves = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.56, 0.08, 0.14), new THREE.MeshStandardMaterial({ roughness: 0.9 }), count
  );
  [bodies, heads, arms, scarves].forEach((m) => {
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  });

  const baseX = new Float32Array(count);
  const baseY = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const phase = new Float32Array(count);
  // poseType: 0 = seated-ish, 1 = standing, 2 = arms-always-up
  const poseType = new Uint8Array(count);
  const shirtColors = [0xe53935, 0x1e88e5, 0xffffff, 0xfdd835, 0x43a047, 0xfb8c00, 0x8e24aa, 0xe91e63];
  const skinColors = [0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac];
  const scarfColors = [0xff6f00, 0xffd600, 0x0d47a1, 0x1b5e20, 0xb71c1c, 0x4a148c, 0xffffff];
  const color = new THREE.Color();

  let index = 0;
  [-1, 1].forEach((side) => {
    STAND_DEFS.forEach((stand) => {
      for (let step = 0; step < 3; step++) {
        const x = getStepX(side, stand, step);
        const y = getStepHeight(stand, step);
        for (let i = 0; i < perRow; i++) {
          baseX[index] = x + (Math.random() - 0.5) * 0.42;
          baseY[index] = y;
          baseZ[index] = CROWD_Z_MIN + i * CROWD_SPACING + (Math.random() - 0.5) * 0.38;
          phase[index] = Math.random() * 6.28;
          poseType[index] = Math.random() < 0.25 ? 2 : (Math.random() < 0.4 ? 0 : 1);
          color.setHex(shirtColors[Math.floor(Math.random() * shirtColors.length)]);
          bodies.setColorAt(index, color);
          color.setHex(scarfColors[Math.floor(Math.random() * scarfColors.length)]);
          scarves.setColorAt(index, color);
          color.setHex(skinColors[Math.floor(Math.random() * skinColors.length)]);
          heads.setColorAt(index, color);
          arms.setColorAt(index, color);
          index += 1;
        }
      }
    });
  });
  bodies.instanceColor.needsUpdate = true;
  heads.instanceColor.needsUpdate = true;
  arms.instanceColor.needsUpdate = true;
  scarves.instanceColor.needsUpdate = true;
  scene.add(bodies, heads, arms, scarves);
  crowd = {
    bodies, heads, arms, scarves, count, baseX, baseY, baseZ, phase, poseType,
    slice: 0, slices: 3
  };
}

// The crowd is updated in slices (1/3 of the stands per frame). A full refresh
// of ~1100 instances every frame is unnecessary: nobody can see the difference
// and the saved CPU time goes into the gameplay loop.
// poseType: 0 = seated sway, 1 = standing bob, 2 = arms perpetually raised.
function updateCrowd(delta, speed) {
  crowdScroll += speed * delta;
  const range = CROWD_Z_MAX - CROWD_Z_MIN;
  const excitement = crowdExcitement;
  const slice = crowd.slice;
  for (let i = slice; i < crowd.count; i += crowd.slices) {
    const wrapped = (((crowd.baseZ[i] - CROWD_Z_MIN + crowdScroll) % range) + range) % range;
    const z = CROWD_Z_MIN + wrapped;
    const t = worldTime * 6.5 + crowd.phase[i];
    const wave = Math.abs(Math.sin(t));
    const pose = crowd.poseType[i];

    // Body vertical offset: seated are lower, excited spectators bob more.
    const ampBody = pose === 0 ? 0.03 + excitement * 0.22 : 0.05 + excitement * 0.5;
    const yBody = crowd.baseY[i] + wave * ampBody;

    dummy.position.set(crowd.baseX[i], yBody + 0.38, z);
    dummy.updateMatrix();
    crowd.bodies.setMatrixAt(i, dummy.matrix);

    dummy.position.set(crowd.baseX[i], yBody + 0.98, z);
    dummy.updateMatrix();
    crowd.heads.setMatrixAt(i, dummy.matrix);

    // Scarf: across the chest, slightly below the head.
    dummy.position.set(crowd.baseX[i], yBody + 0.62, z);
    dummy.updateMatrix();
    crowd.scarves.setMatrixAt(i, dummy.matrix);

    // Arms: raised when poseType===2 or when excitement is high and wave peaks.
    const raiseArm = pose === 2 || (excitement > 0.35 && wave > 0.65);
    const armY = raiseArm
      ? yBody + 1.18 + wave * 0.18 * excitement
      : yBody + 0.68;
    dummy.position.set(crowd.baseX[i], armY, z);
    dummy.updateMatrix();
    crowd.arms.setMatrixAt(i, dummy.matrix);
  }
  crowd.bodies.instanceMatrix.needsUpdate = true;
  crowd.heads.instanceMatrix.needsUpdate = true;
  crowd.arms.instanceMatrix.needsUpdate = true;
  crowd.scarves.instanceMatrix.needsUpdate = true;
  crowd.slice = (slice + 1) % crowd.slices;
}

// ---------- Boards and floodlights ----------
function addBoards(scene) {
  [
    createBoardTexture('DRIBBLE DASH', '#c62828', '#ffffff'),
    createBoardTexture('ENSAM', '#1565c0', '#ffffff'),
    createBoardTexture('THREE.JS', '#f9a825', '#212121'),
    createBoardTexture('WEBGL', '#2e7d32', '#ffffff')
  ].forEach((texture) => boardMaterials.push(new THREE.MeshBasicMaterial({ map: texture })));

  const baseGeometry = new THREE.BoxGeometry(0.3, 1.1, BOARD_LENGTH - 0.3);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x263238 });
  const faceGeometry = new THREE.PlaneGeometry(BOARD_LENGTH - 0.5, 0.9);

  [-1, 1].forEach((side) => {
    for (let i = 0; i < BOARD_COUNT; i++) {
      const boardGroup = new THREE.Group();
      const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
      baseMesh.position.y = 0.55;
      const faceMesh = new THREE.Mesh(faceGeometry, boardMaterials[i % boardMaterials.length]);
      faceMesh.position.set(-side * 0.16, 0.55, 0);
      faceMesh.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      boardGroup.add(baseMesh, faceMesh);
      boardGroup.position.set(
        side * (FIELD_WIDTH / 2 + 0.6), 0, SCROLL_START_Z - i * BOARD_LENGTH - BOARD_LENGTH / 2
      );
      scene.add(boardGroup);
      scrollingProps.push({ object: boardGroup, wrapLength: BOARD_COUNT * BOARD_LENGTH });
    }
  });
}

function addPoles(scene) {
  lampMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222, emissive: 0xffffff, emissiveMap: createLampTexture(),
    emissiveIntensity: THEMES[0].lamp
  });
  beamMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff2cc, transparent: true, opacity: 0, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  glowMaterial = new THREE.SpriteMaterial({
    map: createGlowTexture(), color: 0xfff2cc, transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x9e9e9e, roughness: 0.5, metalness: 0.4 });
  const poleGeometry = new THREE.CylinderGeometry(0.2, 0.3, 10, 8);
  const lampGeometry = new THREE.BoxGeometry(3, 1.2, 0.4);
  const beamGeometry = new THREE.ConeGeometry(3.4, 14, 20, 1, true);
  beamGeometry.translate(0, -7, 0);

  [-1, 1].forEach((side) => {
    for (let i = 0; i < POLE_COUNT; i++) {
      const poleGroup = new THREE.Group();
      const poleMesh = new THREE.Mesh(poleGeometry, poleMaterial);
      poleMesh.position.y = 5;
      const lampMesh = new THREE.Mesh(lampGeometry, lampMaterial);
      lampMesh.position.y = 10.2;
      const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
      beamMesh.position.y = 10.2;
      beamMesh.rotation.z = -side * 0.85;
      const glowSprite = new THREE.Sprite(glowMaterial);
      glowSprite.position.y = 10.2;
      glowSprite.scale.set(4.5, 4.5, 1);
      poleGroup.add(poleMesh, lampMesh, beamMesh, glowSprite);
      poleGroup.position.set(side * (FIELD_WIDTH / 2 + 2.5), 0, SCROLL_START_Z - i * POLE_SPACING - 5);
      scene.add(poleGroup);
      scrollingProps.push({ object: poleGroup, wrapLength: POLE_COUNT * POLE_SPACING });
    }
  });
}

// ---------- Dust ----------
function placeDustParticle(positions, index, isInitial) {
  positions[index * 3] = (Math.random() - 0.5) * 16;
  positions[index * 3 + 1] = 0.05 + Math.random() * 0.8;
  positions[index * 3 + 2] = isInitial ? -60 + Math.random() * 70 : -60 - Math.random() * 5;
}

function addDust(scene) {
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) placeDustParticle(positions, i, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.5, depthWrite: false })
  );
  points.frustumCulled = false;
  scene.add(points);
  dust = { points, positions };
}

// ---------- Particle bursts (confetti, sparks, fireworks) ----------
function createBurst(scene, count, size, isAdditive) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: 1, depthWrite: false,
      blending: isAdditive ? THREE.AdditiveBlending : THREE.NormalBlending
    })
  );
  points.visible = false;
  points.frustumCulled = false;
  scene.add(points);
  return {
    points, positions, colors, count, velocities: new Float32Array(count * 3),
    age: 0, lifetime: 1, gravity: -15, isActive: false
  };
}

function activateBurst(burst, lifetime, gravity) {
  burst.points.geometry.attributes.position.needsUpdate = true;
  burst.points.geometry.attributes.color.needsUpdate = true;
  burst.points.material.opacity = 1;
  burst.points.visible = true;
  burst.age = 0;
  burst.lifetime = lifetime;
  burst.gravity = gravity;
  burst.isActive = true;
}

function emitBurst(burst, origin, palette, config) {
  const color = new THREE.Color();
  for (let i = 0; i < burst.count; i++) {
    burst.positions[i * 3] = origin.x + (Math.random() - 0.5) * config.spread;
    burst.positions[i * 3 + 1] = origin.y;
    burst.positions[i * 3 + 2] = origin.z;
    burst.velocities[i * 3] = (Math.random() - 0.5) * config.speedX;
    burst.velocities[i * 3 + 1] = config.up * (0.5 + Math.random() * 0.5);
    burst.velocities[i * 3 + 2] = (Math.random() - 0.5) * config.speedZ + config.zBias;
    color.setHex(palette[i % palette.length]);
    burst.colors[i * 3] = color.r;
    burst.colors[i * 3 + 1] = color.g;
    burst.colors[i * 3 + 2] = color.b;
  }
  activateBurst(burst, config.lifetime, -15);
}

function emitSphere(burst, origin, hex, speed) {
  const color = new THREE.Color(hex);
  for (let i = 0; i < burst.count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const power = speed * (0.6 + Math.random() * 0.4);
    burst.positions[i * 3] = origin.x;
    burst.positions[i * 3 + 1] = origin.y;
    burst.positions[i * 3 + 2] = origin.z;
    burst.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * power;
    burst.velocities[i * 3 + 1] = Math.cos(phi) * power;
    burst.velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * power;
    burst.colors[i * 3] = color.r * (0.7 + Math.random() * 0.6);
    burst.colors[i * 3 + 1] = color.g * (0.7 + Math.random() * 0.6);
    burst.colors[i * 3 + 2] = color.b * (0.7 + Math.random() * 0.6);
  }
  activateBurst(burst, 1.8, -3);
}

function updateBurst(burst, delta) {
  if (!burst || !burst.isActive) return;
  burst.age += delta;
  if (burst.age >= burst.lifetime) {
    burst.isActive = false;
    burst.points.visible = false;
    return;
  }
  for (let i = 0; i < burst.count; i++) {
    burst.velocities[i * 3 + 1] += burst.gravity * delta;
    burst.positions[i * 3] += burst.velocities[i * 3] * delta;
    burst.positions[i * 3 + 1] += burst.velocities[i * 3 + 1] * delta;
    burst.positions[i * 3 + 2] += burst.velocities[i * 3 + 2] * delta;
  }
  burst.points.geometry.attributes.position.needsUpdate = true;
  burst.points.material.opacity = 1 - burst.age / burst.lifetime;
}

// ---------- Atmosphere (day, sunset, night) ----------
function updateTheme(delta) {
  const smoothing = Math.min(1, delta * 1.2);
  const theme = THEMES[themeIndex];
  COLOR_KEYS.forEach((key) => atmosphere.colors[key].lerp(targetColor.set(theme[key]), smoothing));
  NUMBER_KEYS.forEach((key) => {
    atmosphere.numbers[key] += (theme[key] - atmosphere.numbers[key]) * smoothing;
  });
  atmosphere.lightPos.lerp(targetVector.set(...theme.lightPos), smoothing);
  atmosphere.sunDir.lerp(targetVector.set(...theme.sunDir), smoothing);

  const numbers = atmosphere.numbers;
  worldScene.fog.color.copy(atmosphere.colors.fog);
  hemiLight.color.copy(atmosphere.colors.hemiSky);
  hemiLight.groundColor.copy(atmosphere.colors.hemiGround);
  hemiLight.intensity = numbers.hemi;
  sunLight.color.copy(atmosphere.colors.light);
  sunLight.intensity = numbers.lightI;
  sunLight.position.copy(atmosphere.lightPos);
  lampMaterial.emissiveIntensity = numbers.lamp;
  beamMaterial.opacity = numbers.beams;
  glowMaterial.opacity = 0.1 + numbers.beams * 1.2;
  boardMaterials.forEach((material) => material.color.setScalar(numbers.board));
  worldRenderer.toneMappingExposure = numbers.exposure;

  skyMaterial.uniforms.uStars.value = numbers.stars;
  skyMaterial.uniforms.uCloudAmount.value = numbers.cloud;
  skyMaterial.uniforms.uTime.value = worldTime;
}

// ---------- Public functions ----------

// Creates scene, camera and renderer (tone mapping, shadows). Handles resize.
export function createWorld() {
  const scene = new THREE.Scene();
  worldScene = scene;
  scene.fog = new THREE.Fog(THEMES[0].fog, 50, 130);

  const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  worldRenderer = renderer;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  document.body.appendChild(renderer.domElement);

  addSky(scene);
  addLights(scene);
  addField(scene);
  addStands(scene);
  addCrowd(scene);
  addBoards(scene);
  addPoles(scene);
  addDust(scene);
  confetti = createBurst(scene, 160, 0.3, false);
  sparks = createBurst(scene, 80, 0.2, true);
  turfBurst = createBurst(scene, 36, 0.16, false);
  fireworks = [0, 1, 2].map(() => createBurst(scene, 90, 0.9, true));
  // The crowd is updated in slices: fill every slice once before the first frame.
  for (let i = 0; i < crowd.slices; i++) updateCrowd(0, 0);
  updateTheme(10);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return { scene, camera, renderer };
}

// Scrolls the whole world toward the camera. Call every frame.
export function updateWorld(delta, speed) {
  worldTime += delta;
  fieldTexture.offset.y += (speed * delta) / (STRIPE_LENGTH * 2);

  scrollingProps.forEach((prop) => {
    prop.object.position.z += speed * delta;
    if (prop.object.position.z > SCROLL_START_Z) prop.object.position.z -= prop.wrapLength;
  });

  for (let i = 0; i < DUST_COUNT; i++) {
    dust.positions[i * 3 + 2] += speed * delta;
    if (dust.positions[i * 3 + 2] > 10) placeDustParticle(dust.positions, i, false);
  }
  dust.points.geometry.attributes.position.needsUpdate = true;

  crowdExcitement = Math.max(0, crowdExcitement - delta * 0.5);
  updateCrowd(delta, speed);
  updateTheme(delta);
  updateBurst(confetti, delta);
  updateBurst(sparks, delta);
  updateBurst(turfBurst, delta);
  fireworks.forEach((burst) => updateBurst(burst, delta));
}

export function playWinEffect() {
  crowdExcitement = 1;
  emitBurst(confetti, { x: 0, y: 1.5, z: PLAYER_Z },
    [0xff4757, 0xffa502, 0xfff200, 0x2ed573, 0x1e90ff, 0xffffff],
    { spread: 6, speedX: 9, up: 10, speedZ: 6, zBias: -2, lifetime: 1.5 });
}

// Goal: huge confetti, roaring crowd and fireworks in the sky.
export function playGoalEffect() {
  crowdExcitement = 1.6;
  emitBurst(confetti, { x: 0, y: 2, z: -10 },
    [0xff4757, 0xffa502, 0xfff200, 0x2ed573, 0x1e90ff, 0xffffff],
    { spread: 16, speedX: 18, up: 16, speedZ: 20, zBias: 0, lifetime: 2.4 });
  const colors = [0xff3b5c, 0xffd23f, 0x3bceac, 0x4cc9f0];
  fireworks.forEach((burst, index) => {
    emitSphere(
      burst,
      { x: (index - 1) * 14 + (Math.random() - 0.5) * 6, y: 12 + Math.random() * 6, z: -45 - Math.random() * 25 },
      colors[Math.floor(Math.random() * colors.length)], 11
    );
  });
}

export function playHitEffect(x, y, z) {
  emitBurst(sparks, { x, y, z }, [0xff5252, 0xff9100, 0xffd600],
    { spread: 0.6, speedX: 12, up: 9, speedZ: 12, zBias: 0, lifetime: 0.8 });
}

export function playTurfEffect(x, z) {
  if (!turfBurst) return;
  emitBurst(turfBurst, { x, y: 0.08, z }, [0x2e7d32, 0x43a047, 0x5d4037],
    { spread: 0.5, speedX: 4.5, up: 4.2, speedZ: 4.5, zBias: 1.0, lifetime: 0.55 });
}

// 0 = day, 1 = sunset, 2 = night. Returns the name of the theme.
// `immediate` snaps the atmosphere instead of blending (used at kick-off and
// when the player picks an environment in the menu).
export function setTheme(index, immediate) {
  themeIndex = ((index % THEMES.length) + THEMES.length) % THEMES.length;
  if (immediate) {
    const theme = THEMES[themeIndex];
    COLOR_KEYS.forEach((key) => atmosphere.colors[key].set(theme[key]));
    NUMBER_KEYS.forEach((key) => { atmosphere.numbers[key] = theme[key]; });
    atmosphere.lightPos.set(...theme.lightPos);
    atmosphere.sunDir.set(...theme.sunDir);
    updateTheme(10);
  }
  return THEMES[themeIndex].name;
}

export function getThemeName(index) {
  return THEMES[((index % THEMES.length) + THEMES.length) % THEMES.length].name;
}

// Names shown by the pre-match environment selector.
export function getEnvironmentNames() {
  return THEMES.map((theme) => theme.name);
}

// Current bloom strength wanted by the atmosphere (read by main.js).
export function getBloomTarget() {
  return atmosphere.numbers.bloom;
}