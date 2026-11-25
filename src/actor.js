// actor.js - one interface for visual characters, backed either by the rigged
// Mixamo FBX model or by the original procedural characters.
//
// Gameplay NEVER reads positions from the animation: the actor root (`group`)
// stays authoritative and hitboxes are computed from config dimensions. The
// rigged model is only the visual child. This is what lets us swap the
// procedural body for the FBX rig at runtime without touching the gameplay.
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ANIMATION_CROSSFADE } from './config.js';
import {
  createHumanoid, applyKit, animateRun, poseIdle, poseJump, poseKnockdown,
  poseKick, poseSlide, poseBlock, poseKeeperReady, poseDive, poseCelebrate
} from './characters.js';
import { getClip, getClipDefinition } from './assets.js';

// Semantic gameplay state -> animation action in the single clip manifest.
const STATE_CLIPS = {
  idle: 'idle',
  aim: 'idle',
  jog: 'jog',
  run: 'run',
  sprint: 'sprint',
  jump: 'jump',
  kick: 'kick',
  strikeJog: 'strikeJog',
  sideStep: 'sideStep',
  trip: 'trip',
  getUp: 'getUp',
  celebrate: 'victory',
  slide: 'slide',
  block: 'block',
  keeperIdle: 'keeperIdle',
  keeperSideStep: 'keeperSideStep',
  keeperDive: 'keeperDive',
  keeperCatch: 'keeperCatch',
  keeperBlock: 'keeperBlock'
};

function makeRigMaterial(sourceMaterial, kit) {
  const material = new THREE.MeshStandardMaterial({
    map: sourceMaterial && sourceMaterial.map ? sourceMaterial.map : null,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
    transparent: Boolean(sourceMaterial && sourceMaterial.transparent),
    alphaTest: sourceMaterial ? sourceMaterial.alphaTest : 0,
    side: sourceMaterial ? sourceMaterial.side : THREE.FrontSide
  });

  // The Mixamo character comes with a single material, so a flat colour turns
  // the whole body into a red mannequin. The kit is painted in the shader from
  // the BIND-POSE position (T-pose, centimetres): jersey/sleeves on the torso
  // and upper arms, skin on head/arms, hair on the skull, shorts, socks, boots
  // and gloves. Because it uses the bind pose, the regions follow the skeleton
  // once the animation deforms the mesh.
  const uniforms = {
    uSkin: { value: new THREE.Color(kit.skinColor === undefined ? 0xf1c27d : kit.skinColor) },
    uJersey: { value: new THREE.Color(kit.jerseyColor) },
    uAccent: { value: new THREE.Color(kit.accentColor === undefined ? kit.jerseyColor : kit.accentColor) },
    uShorts: { value: new THREE.Color(kit.shortsColor === undefined ? 0xffffff : kit.shortsColor) },
    uSocks: { value: new THREE.Color(kit.sockColor === undefined ? kit.jerseyColor : kit.sockColor) },
    uBoots: { value: new THREE.Color(kit.bootColor === undefined ? 0x111111 : kit.bootColor) },
    uHair: { value: new THREE.Color(kit.hairColor === undefined ? 0x2b1b12 : kit.hairColor) },
    uGlove: { value: new THREE.Color(kit.gloveColor === undefined ? (kit.skinColor === undefined ? 0xf1c27d : kit.skinColor) : kit.gloveColor) },
    uPattern: { value: kit.pattern === 'stripes' ? 1 : kit.pattern === 'hoops' ? 2 : 0 }
  };
  material.userData.uniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying float vBindY;\nvarying float vBindX;\n'
      + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vBindY = position.y;\n  vBindX = position.x;'
      );
    shader.fragmentShader = `
      varying float vBindY;
      varying float vBindX;
      uniform vec3 uSkin; uniform vec3 uJersey; uniform vec3 uAccent;
      uniform vec3 uShorts; uniform vec3 uSocks; uniform vec3 uBoots;
      uniform vec3 uHair; uniform vec3 uGlove; uniform float uPattern;
    ` + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      {
        float y = vBindY;
        float ax = abs(vBindX);
        vec3 kit = uJersey;
        if (y > 171.0) kit = uHair;
        else if (y > 152.0) kit = uSkin;
        else if (y > 130.0 && ax > 78.0) kit = uGlove;
        else if (y > 130.0 && ax > 34.0) kit = uSkin;
        else if (y > 130.0 && ax > 20.0) kit = uJersey;
        else if (y > 102.0) {
          kit = uJersey;
          if (uPattern > 0.5 && uPattern < 1.5) {
            kit = mix(uJersey, uAccent, step(0.5, fract(vBindX / 12.0)));
          } else if (uPattern > 1.5) {
            kit = mix(uJersey, uAccent, step(0.5, fract(y / 11.0)));
          }
        }
        else if (y > 84.0) kit = uShorts;
        else if (y > 52.0) kit = uSkin;
        else if (y > 12.0) kit = uSocks;
        else kit = uBoots;
        diffuseColor.rgb *= kit;
      }`
    );
  };
  // One shader program is shared by every rig material (uniforms differ).
  material.customProgramCacheKey = () => 'dd-rig-kit-v1';
  return material;
}

export function createActor(options) {
  const { kit, facing = 1, number } = options;
  const group = new THREE.Group();
  const procedural = createHumanoid({
    ...kit,
    skinColor: kit.skinColor === undefined ? 0xf1c27d : kit.skinColor,
    hairColor: kit.hairColor === undefined ? 0x2b1b12 : kit.hairColor,
    bootColor: kit.bootColor === undefined ? 0x111111 : kit.bootColor,
    gloveColor: kit.gloveColor,
    facing,
    number
  });
  group.add(procedural.group);

  return {
    group,
    facing,
    kit,
    procedural,
    rig: null,
    mixer: null,
    currentAction: null,
    currentKey: '',
    state: 'idle',
    stateOptions: {},
    stateTime: 0,
    runTime: 0,
    kickProgress: 0,
    baseWorldX: facing === 1 ? -1 : 1,
    missingStates: new Set()
  };
}

// Replaces the procedural body with the rigged FBX body. Safe to call twice.
export function attachRig(actor, assets) {
  if (!assets || !assets.ready || !assets.prototype || actor.rig) return false;

  const model = cloneSkeleton(assets.prototype);
  model.scale.setScalar(assets.scale);
  model.position.y = assets.groundOffset;
  model.rotation.y = actor.facing === -1 ? Math.PI : 0;

  let rigMaterial = null;
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = false;
    // Skinned bounds are computed from the bind pose: disable culling so a
    // dive/slide never makes the character disappear.
    child.frustumCulled = false;
    if (!rigMaterial) rigMaterial = makeRigMaterial(child.material, actor.kit);
    child.material = rigMaterial;
  });

  actor.procedural.group.visible = false;
  actor.group.add(model);
  actor.assets = assets;
  actor.rig = {
    model,
    material: rigMaterial,
    footLeft: model.getObjectByName('mixamorigLeftFoot'),
    footRight: model.getObjectByName('mixamorigRightFoot'),
    head: model.getObjectByName('mixamorigHead')
  };
  actor.mixer = new THREE.AnimationMixer(model);
  actor.currentAction = null;
  actor.currentKey = '';
  actor.stateOptions = { ...actor.stateOptions, force: true };
  setActorState(actor, actor.state, actor.stateOptions);
  return true;
}

export function setActorKit(actor, kit) {
  actor.kit = kit;
  const uniforms = actor.rig && actor.rig.material ? actor.rig.material.userData.uniforms : null;
  if (uniforms) {
    uniforms.uJersey.value.setHex(kit.jerseyColor);
    uniforms.uAccent.value.setHex(kit.accentColor === undefined ? kit.jerseyColor : kit.accentColor);
    uniforms.uShorts.value.setHex(kit.shortsColor === undefined ? 0xffffff : kit.shortsColor);
    uniforms.uSocks.value.setHex(kit.sockColor === undefined ? kit.jerseyColor : kit.sockColor);
    uniforms.uBoots.value.setHex(kit.bootColor === undefined ? 0x111111 : kit.bootColor);
    uniforms.uHair.value.setHex(kit.hairColor === undefined ? 0x2b1b12 : kit.hairColor);
    uniforms.uSkin.value.setHex(kit.skinColor === undefined ? 0xf1c27d : kit.skinColor);
    uniforms.uGlove.value.setHex(
      kit.gloveColor === undefined
        ? (kit.skinColor === undefined ? 0xf1c27d : kit.skinColor)
        : kit.gloveColor
    );
    uniforms.uPattern.value = kit.pattern === 'stripes' ? 1 : kit.pattern === 'hoops' ? 2 : 0;
  } else {
    applyKit(actor.procedural, kit);
  }
}

// options: { direction (world -1/0/1), speed, fade, force }
export function setActorState(actor, state, options) {
  const opts = options || {};
  const semantic = STATE_CLIPS[state] || state;
  const assets = actor.assets;
  if (!assets) {
    actor.state = state;
    actor.stateOptions = opts;
    return;
  }
  const definition = getClipDefinition(assets, semantic);
  const direction = opts.direction === undefined ? 0 : opts.direction;
  const flip = Boolean(definition && definition.directional)
    && direction !== 0 && Math.sign(direction) !== actor.baseWorldX;

  if (!actor.rig) {
    if (actor.state !== state) {
      actor.state = state;
      actor.stateTime = 0;
      actor.kickProgress = 0;
    }
    actor.stateOptions = opts;
    return;
  }

  const key = semantic + (flip ? ':mirror' : '');
  if (actor.currentKey === key && !opts.force) {
    actor.state = state;
    actor.stateOptions = opts;
    if (actor.currentAction) {
      const speed = (definition ? definition.speed : 1) * (opts.speed === undefined ? 1 : opts.speed);
      actor.currentAction.setEffectiveTimeScale(speed);
    }
    return;
  }

  const clip = getClip(assets, semantic, flip);
  if (!clip) {
    if (!actor.missingStates.has(key)) {
      actor.missingStates.add(key);
      console.warn('[actor] Missing animation clip for state:', state, semantic);
    }
    actor.state = state;
    actor.stateOptions = opts;
    return;
  }

  let action = actor.actions ? actor.actions.get(key) : null;
  if (!actor.actions) actor.actions = new Map();
  if (!action) {
    action = actor.mixer.clipAction(clip);
    actor.actions.set(key, action);
  }

  const once = Boolean(definition && definition.once);
  const fade = opts.fade === undefined
    ? (definition && definition.fade !== undefined ? definition.fade : ANIMATION_CROSSFADE)
    : opts.fade;
  const speed = (definition ? definition.speed : 1) * (opts.speed === undefined ? 1 : opts.speed);

  const previous = actor.currentAction;
  action.reset();
  if (definition && definition.startTime) {
    action.time = definition.startTime;
  }
  action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
  action.clampWhenFinished = once;
  action.setEffectiveTimeScale(speed);
  action.setEffectiveWeight(1);
  action.enabled = true;
  action.play();
  if (previous && previous !== action) {
    previous.crossFadeTo(action, fade, false);
  } else if (!previous) {
    action.fadeIn(fade);
  }

  actor.currentAction = action;
  actor.currentKey = key;
  actor.state = state;
  actor.stateOptions = opts;
  actor.stateTime = 0;
  actor.kickProgress = 0;
}

// Procedural fallback state machine (used when FBX assets are unavailable).
function updateProcedural(actor, delta) {
  const humanoid = actor.procedural;
  actor.stateTime += delta;
  actor.runTime += delta * 11;
  switch (actor.state) {
    case 'run':
    case 'jog':
      animateRun(humanoid, actor.runTime, actor.state === 'jog' ? 0.8 : 1);
      break;
    case 'jump':
      poseJump(humanoid);
      break;
    case 'kick':
    case 'strikeJog':
      actor.kickProgress = Math.min(1, actor.kickProgress + delta * 3.4);
      poseKick(humanoid, actor.kickProgress);
      break;
    case 'celebrate':
      poseCelebrate(humanoid, actor.stateTime);
      break;
    case 'trip':
      poseKnockdown(humanoid);
      break;
    case 'getUp':
      poseIdle(humanoid, actor.stateTime);
      break;
    case 'slide':
      poseSlide(humanoid);
      break;
    case 'block':
      poseBlock(humanoid, actor.stateTime);
      break;
    case 'keeperIdle':
      poseKeeperReady(humanoid, actor.stateTime);
      break;
    case 'keeperDive':
      poseDive(humanoid);
      break;
    case 'keeperCatch':
      poseKeeperReady(humanoid, actor.stateTime);
      break;
    case 'keeperBlock':
      poseBlock(humanoid, actor.stateTime);
      break;
    case 'aim':
    case 'idle':
    default:
      poseIdle(humanoid, actor.stateTime);
      break;
  }
}

export function updateActor(actor, delta) {
  if (actor.rig) {
    actor.stateTime += delta;
    actor.mixer.update(delta);
    return;
  }
  updateProcedural(actor, delta);
}

// World positions of the feet, used to make the ball follow the real contact
// point instead of floating in front of the chest.
export function getActorFeet(actor, outLeft, outRight) {
  actor.group.updateMatrixWorld(true);
  if (actor.rig && actor.rig.footLeft && actor.rig.footRight) {
    actor.rig.footLeft.getWorldPosition(outLeft);
    actor.rig.footRight.getWorldPosition(outRight);
    return true;
  }
  const feet = actor.procedural.feet;
  if (feet && feet.left && feet.right) {
    feet.left.getWorldPosition(outLeft);
    feet.right.getWorldPosition(outRight);
    return true;
  }
  return false;
}

export function isRigReady(actor) {
  return Boolean(actor.rig);
}
