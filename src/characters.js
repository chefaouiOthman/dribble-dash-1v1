// characters.js - articulated football players (thighs, shins, arms, forearms,
// textured kits) and all the poses used by player, defender and keeper.
import * as THREE from 'three';

function toCss(color) {
  return '#' + color.toString(16).padStart(6, '0');
}

function makeMaterial(color, roughness) {
  return new THREE.MeshStandardMaterial({
    color, roughness: roughness === undefined ? 0.7 : roughness, metalness: 0
  });
}

function mesh(geometry, material) {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = true;
  return result;
}

function createKitTexture(primary, accent, pattern) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = toCss(primary);
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = toCss(accent);
  if (pattern === 'stripes') {
    for (let i = 0; i < 16; i += 2) context.fillRect(i * 16, 0, 16, 256);
  }
  if (pattern === 'hoops') {
    for (let i = 0; i < 16; i += 2) context.fillRect(0, i * 16, 256, 16);
  }
  for (let i = 0; i < 1800; i++) {
    context.fillStyle = 'rgba(0, 0, 0, ' + (Math.random() * 0.07).toFixed(3) + ')';
    context.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createNumberTexture(number) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.font = 'bold 104px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.lineWidth = 8;
  context.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  context.strokeText(String(number), 64, 70);
  context.fillStyle = '#ffffff';
  context.fillText(String(number), 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Changes the kit colors (used for the different defenders).
// kit: jerseyColor, accentColor, pattern ('stripes' | 'hoops' | 'plain'), shortsColor, sockColor
export function applyKit(humanoid, kit) {
  const materials = humanoid.materials;
  if (materials.torso.map) materials.torso.map.dispose();
  materials.torso.map = createKitTexture(kit.jerseyColor, kit.accentColor, kit.pattern);
  materials.torso.needsUpdate = true;
  materials.sleeve.color.setHex(kit.jerseyColor);
  materials.shorts.color.setHex(kit.shortsColor);
  materials.sock.color.setHex(kit.sockColor);
}

// options: kit fields + skinColor, hairColor, bootColor, gloveColor, facing (1 or -1), number
export function createHumanoid(options) {
  const torsoMaterial = makeMaterial(0xffffff, 0.65);
  const sleeveMaterial = makeMaterial(options.jerseyColor, 0.65);
  const shortsMaterial = makeMaterial(options.shortsColor, 0.7);
  const sockMaterial = makeMaterial(options.sockColor, 0.8);
  const skinMaterial = makeMaterial(options.skinColor, 0.6);
  const hairMaterial = makeMaterial(options.hairColor, 0.8);
  const bootMaterial = makeMaterial(options.bootColor === undefined ? 0x111111 : options.bootColor, 0.4);
  const gloveMaterial = options.gloveColor === undefined ? skinMaterial : makeMaterial(options.gloveColor, 0.5);

  const group = new THREE.Group();
  const model = new THREE.Group();
  const root = new THREE.Group();
  model.rotation.y = options.facing === -1 ? Math.PI : 0;
  model.add(root);
  group.add(model);

  const createLeg = (x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.92, 0);
    const thigh = mesh(new THREE.CapsuleGeometry(0.078, 0.32, 4, 10), skinMaterial);
    thigh.position.y = -0.23;
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    const shin = mesh(new THREE.CapsuleGeometry(0.06, 0.34, 4, 10), skinMaterial);
    shin.position.y = -0.23;
    const sock = mesh(new THREE.CylinderGeometry(0.066, 0.06, 0.3, 12), sockMaterial);
    sock.position.y = -0.2;
    const boot = mesh(new THREE.CapsuleGeometry(0.052, 0.16, 4, 8), bootMaterial);
    boot.rotation.x = Math.PI / 2;
    boot.position.set(0, -0.41, 0.06);
    knee.add(shin, sock, boot);
    hip.add(thigh, knee);
    root.add(hip);
    return { hip, knee };
  };

  const createArm = (x) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.43, 0);
    const upper = mesh(new THREE.CapsuleGeometry(0.048, 0.2, 4, 10), skinMaterial);
    upper.position.y = -0.15;
    const sleeve = mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.17, 12), sleeveMaterial);
    sleeve.position.y = -0.1;
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const forearm = mesh(new THREE.CapsuleGeometry(0.04, 0.2, 4, 10), skinMaterial);
    forearm.position.y = -0.15;
    const hand = mesh(new THREE.SphereGeometry(0.05, 10, 8), gloveMaterial);
    hand.position.y = -0.32;
    elbow.add(forearm, hand);
    shoulder.add(upper, sleeve, elbow);
    root.add(shoulder);
    return { shoulder, elbow };
  };

  const leftLeg = createLeg(-0.13);
  const rightLeg = createLeg(0.13);
  const leftArm = createArm(-0.29);
  const rightArm = createArm(0.29);

  const shorts = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.28, 18), shortsMaterial);
  shorts.scale.z = 0.85;
  shorts.position.y = 0.92;
  const torso = mesh(new THREE.CapsuleGeometry(0.19, 0.28, 6, 16), torsoMaterial);
  torso.scale.set(1.25, 1, 0.78);
  torso.position.y = 1.2;
  const neck = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 10), skinMaterial);
  neck.position.y = 1.55;
  const head = mesh(new THREE.SphereGeometry(0.115, 20, 16), skinMaterial);
  head.scale.y = 1.1;
  head.position.y = 1.66;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.45),
    hairMaterial
  );
  hair.position.set(0, 1.665, -0.005);
  root.add(shorts, torso, neck, head, hair);

  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x111111 });
  [-0.045, 0.045].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), eyeMaterial);
    eye.position.set(x, 1.655, 0.108);
    root.add(eye);
  });

  if (options.number !== undefined) {
    const numberMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({ map: createNumberTexture(options.number), transparent: true })
    );
    numberMesh.position.set(0, 1.25, -0.152);
    numberMesh.rotation.y = Math.PI;
    root.add(numberMesh);
  }

  const humanoid = {
    group,
    model,
    root,
    limbs: {
      leftHip: leftLeg.hip, leftKnee: leftLeg.knee,
      rightHip: rightLeg.hip, rightKnee: rightLeg.knee,
      leftShoulder: leftArm.shoulder, leftElbow: leftArm.elbow,
      rightShoulder: rightArm.shoulder, rightElbow: rightArm.elbow
    },
    materials: { torso: torsoMaterial, sleeve: sleeveMaterial, shorts: shortsMaterial, sock: sockMaterial }
  };
  applyKit(humanoid, options);
  return humanoid;
}

// Rotation convention (model faces +z): positive x-rotation of a leg or arm swings it BACKWARD.
function setLimbs(humanoid, v) {
  const limbs = humanoid.limbs;
  limbs.leftHip.rotation.x = v.hipL;
  limbs.leftKnee.rotation.x = v.kneeL;
  limbs.rightHip.rotation.x = v.hipR;
  limbs.rightKnee.rotation.x = v.kneeR;
  limbs.leftShoulder.rotation.set(v.shoulderL, 0, -v.spread);
  limbs.rightShoulder.rotation.set(v.shoulderR, 0, v.spread);
  limbs.leftElbow.rotation.x = v.elbowL;
  limbs.rightElbow.rotation.x = v.elbowR;
  humanoid.root.position.y = v.rootY || 0;
  humanoid.root.rotation.set(v.lean || 0, 0, v.sway || 0);
}

// Running cycle with knee flexion and counter-swinging arms.
export function animateRun(humanoid, phase, intensity) {
  const swingL = Math.sin(phase);
  const swingR = -swingL;
  setLimbs(humanoid, {
    hipL: -swingL * 0.85 * intensity,
    kneeL: (0.12 + Math.max(0, Math.cos(phase)) * 1.1) * intensity,
    hipR: -swingR * 0.85 * intensity,
    kneeR: (0.12 + Math.max(0, -Math.cos(phase)) * 1.1) * intensity,
    shoulderL: swingL * 0.75 * intensity,
    shoulderR: swingR * 0.75 * intensity,
    elbowL: -(0.9 + Math.max(0, -swingL) * 0.35) * intensity,
    elbowR: -(0.9 + Math.max(0, -swingR) * 0.35) * intensity,
    spread: 0.08,
    rootY: Math.abs(swingL) * 0.06 * intensity,
    lean: 0.12 * intensity,
    sway: swingL * 0.03 * intensity
  });
}

export function poseIdle(humanoid, time) {
  setLimbs(humanoid, {
    hipL: 0.05, kneeL: 0.12, hipR: -0.05, kneeR: 0.15,
    shoulderL: 0.08, shoulderR: 0.08, elbowL: -0.35, elbowR: -0.35,
    spread: 0.12, rootY: Math.sin(time * 2) * 0.008, lean: 0.05
  });
}

export function poseJump(humanoid) {
  setLimbs(humanoid, {
    hipL: -0.9, kneeL: 1.25, hipR: 0.35, kneeR: 0.9,
    shoulderL: -1.4, shoulderR: -1.4, elbowL: -0.4, elbowR: -0.4,
    spread: 0.35, rootY: 0, lean: 0.05
  });
}

export function poseSlide(humanoid) {
  setLimbs(humanoid, {
    hipL: 0.5, kneeL: 1.3, hipR: -0.1, kneeR: 0.1,
    shoulderL: 0.3, shoulderR: 0.3, elbowL: -0.3, elbowR: -0.3,
    spread: 0.9, rootY: 0, lean: 0
  });
}

export function poseWindup(humanoid) {
  setLimbs(humanoid, {
    hipL: -0.75, kneeL: 1.3, hipR: -0.35, kneeR: 0.9,
    shoulderL: 0.6, shoulderR: 0.6, elbowL: -0.8, elbowR: -0.8,
    spread: 0.3, rootY: -0.17, lean: 0.35
  });
}

export function poseBlock(humanoid, time) {
  setLimbs(humanoid, {
    hipL: -0.5, kneeL: 0.9, hipR: -0.4, kneeR: 0.8,
    shoulderL: -0.4, shoulderR: -0.4, elbowL: -0.5, elbowR: -0.5,
    spread: 1.25, rootY: -0.11 + Math.sin(time * 10) * 0.02, lean: 0.12
  });
}

export function poseKnockdown(humanoid) {
  setLimbs(humanoid, {
    hipL: 0.3, kneeL: 0.4, hipR: -0.3, kneeR: 0.2,
    shoulderL: -0.6, shoulderR: -0.6, elbowL: -0.3, elbowR: -0.3,
    spread: 1.3, rootY: 0, lean: 0
  });
}

// progress from 0 to 1: backswing then strike with the right leg.
export function poseKick(humanoid, progress) {
  const back = Math.min(1, progress / 0.4);
  const strike = Math.max(0, (progress - 0.4) / 0.6);
  const eased = 1 - (1 - strike) * (1 - strike);
  const hipR = progress < 0.4 ? 0.8 * back : 0.8 - 2.15 * eased;
  const kneeR = progress < 0.4 ? 0.1 + 1.2 * back : 1.3 - 1.2 * eased;
  setLimbs(humanoid, {
    hipL: 0.1, kneeL: 0.35, hipR, kneeR,
    shoulderL: hipR * 0.7, shoulderR: -hipR * 0.5, elbowL: -0.5, elbowR: -0.5,
    spread: 0.3, rootY: -0.05, lean: 0.1
  });
}

export function poseKeeperReady(humanoid, time) {
  setLimbs(humanoid, {
    hipL: -0.55, kneeL: 0.9, hipR: -0.55, kneeR: 0.9,
    shoulderL: -0.5, shoulderR: -0.5, elbowL: -0.6, elbowR: -0.6,
    spread: 0.55 + Math.sin(time * 3) * 0.05, rootY: -0.1, lean: 0.15
  });
}

export function poseDive(humanoid) {
  setLimbs(humanoid, {
    hipL: -0.3, kneeL: 0.6, hipR: 0.4, kneeR: 0.9,
    shoulderL: -2.9, shoulderR: -2.9, elbowL: -0.1, elbowR: -0.1,
    spread: 0.15, rootY: 0, lean: 0
  });
}

export function poseCelebrate(humanoid, time) {
  setLimbs(humanoid, {
    hipL: -0.2, kneeL: 0.5, hipR: -0.2, kneeR: 0.5,
    shoulderL: -2.9 + Math.sin(time * 9) * 0.3, shoulderR: -2.9 - Math.sin(time * 9) * 0.3,
    elbowL: -0.3, elbowR: -0.3, spread: 0.5,
    rootY: Math.abs(Math.sin(time * 5)) * 0.28, lean: -0.05
  });
}