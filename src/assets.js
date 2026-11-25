// assets.js - single asset manifest + FBX loader with cache.
//
// Mixamo FBX files are loaded directly with FBXLoader (no Blender, no GLB
// conversion). Every file is downloaded once, clips are normalised once and
// mirrored variants are cached. If the character cannot be loaded, the game
// keeps the procedural characters and logs exactly what is missing.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// All file names live HERE and nowhere else. Spaces are real: URLs are encoded.
export const CHARACTER_FILE = 'characters/ybot-character.fbx';

// action -> FBX file + playback rules. Directional clips are authored toward
// local -X (the character's right): verified from Hips/foot displacement data
// (see tools/fbx-report.json and tools/clip-samples.json).
// `trimEnd` cuts the loop seam / get-up tail of one-shot clips so they can be
// held in a useful pose. `pendingValidation` flags mappings to review visually.
export const CLIP_DEFINITIONS = {
  idle: { file: 'Idle.fbx', loop: true, speed: 1.0, fade: 0.25 },
  jog: { file: 'Jogging.fbx', loop: true, speed: 1.0, fade: 0.2 },
  run: { file: 'Running.fbx', loop: true, speed: 1.1, fade: 0.16 },
  sprint: { file: 'Sprint.fbx', loop: true, speed: 1.0, fade: 0.16 },
  jump: { file: 'Jump.fbx', once: true, speed: 1.15, fade: 0.1, trimEnd: 0.93 },
  // Running strike (used for every player shot so the full wind-up and strike
  // are clearly visible). Measured via tools/analyze-clips.mjs: RightFoot peak
  // forward velocity (vz = 1038.9 cm/s, y = 22.9 cm, z = 70.1 cm) occurs at t = 0.42s.
  // Starting at 0.04s at 1.15x preserves the wind-up and gives 0.33s release latency,
  // with full follow-through up to 1.25s.
  strikeJog: {
    file: 'Strike Foward Jog.fbx', once: true, speed: 1.15, fade: 0.08,
    startTime: 0.04, contactTime: 0.42, trimEnd: 1.25
  },
  sideStep: { file: 'Side Step.fbx', once: true, directional: true, speed: 1.25, fade: 0.12, trimEnd: 1.32 },
  trip: { file: 'Soccer Trip.fbx', once: true, speed: 1.0, fade: 0.1, trimEnd: 1.42 },
  getUp: { file: 'Standing Up.fbx', once: true, speed: 1.0, fade: 0.2, trimEnd: 1.55 },
  victory: { file: 'Victory.fbx', loop: true, speed: 1.0, fade: 0.2 },
  slide: { file: 'Running Slide.fbx', once: true, speed: 1.15, fade: 0.1, trimEnd: 1.42 },
  // No dedicated outfield standing-block clip exists in the provided set.
  // Visual validation of both candidates: `Kick Soccerball` is clearly a
  // shooting motion (raised knee, striking foot), so it cannot be sold as a
  // simple standing interception. The first half of `Goalkeeper Body Block`
  // is a low, arms-out blocking stance; trimming it before the keeper drops
  // to the ground gives the defender a readable standing block.
  block: {
    file: 'Goalkeeper Body Block.fbx', once: true, speed: 0.9, fade: 0.08,
    trimEnd: 0.55, pendingValidation: 'Standing block (body-block stance, trimmed)'
  },
  keeperIdle: { file: 'Goalkeeper Idle.fbx', loop: true, speed: 1.0, fade: 0.25 },
  keeperSideStep: {
    file: 'Goalkeeper Sidestep.fbx', loop: true, directional: true, speed: 1.0, fade: 0.12
  },
  keeperDive: {
    file: 'Goalkeeper Diving Save.fbx', once: true, directional: true,
    speed: 1.0, fade: 0.06, trimEnd: 1.7
  },
  keeperCatch: { file: 'Goalkeeper Catch.fbx', once: true, speed: 1.0, fade: 0.08, trimEnd: 1.6 },
  keeperBlock: {
    file: 'Goalkeeper Body Block.fbx', once: true, directional: true,
    speed: 1.0, fade: 0.08, trimEnd: 1.35
  }
};

// All clips in the manifest are now mapped to active gameplay states.
export const EXTRA_CLIP_FILES = [];

const HIPS_NAME = 'mixamorigHips';
const RAW_CLIP_NAME = 'mixamo.com';

function getBaseUrl() {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return base.endsWith('/') ? base : base + '/';
}

function assetUrl(relativePath) {
  // encodeURI keeps the slashes but safely encodes the real spaces in names.
  return encodeURI(getBaseUrl() + 'assets/' + relativePath);
}

const fileCache = new Map();
const mirrorCache = new WeakMap();

function loadFbx(url) {
  if (fileCache.has(url)) return fileCache.get(url);
  const promise = new Promise((resolve, reject) => {
    new FBXLoader().load(url, resolve, undefined, reject);
  });
  fileCache.set(url, promise);
  return promise;
}

function findMainClip(fbx) {
  return fbx.animations.find((clip) => clip.tracks.length > 0) || null;
}

// Removes horizontal root motion: the gameplay controller owns X/Z position.
// The Hips Y track is kept (crouch, jump bob, falls) but X/Z are locked to the
// first key so an animation can never move a hitbox or fight the controller.
function neutraliseRootMotion(clip) {
  for (const track of clip.tracks) {
    if (!track.name.startsWith(HIPS_NAME) || !track.name.endsWith('.position')) continue;
    const values = track.values;
    if (values.length < 3) continue;
    const baseX = values[0];
    const baseZ = values[2];
    for (let i = 0; i < values.length; i += 3) {
      values[i] = baseX;
      values[i + 2] = baseZ;
    }
  }
}

function prepareClip(rawClip, semantic, definition) {
  const clip = rawClip.clone();
  clip.name = semantic;
  neutraliseRootMotion(clip);
  if (definition.trimEnd !== undefined) {
    clip.duration = Math.min(clip.duration, definition.trimEnd);
  }
  return clip;
}

function swapSide(name) {
  return name.replace(/(Left|Right)/g, (match) => (match === 'Left' ? 'Right' : 'Left'));
}

// Mirror a clip across the YZ plane for the Mixamo rig:
//  - Left/Right bone tracks swap;
//  - position tracks: x -> -x;
//  - quaternion tracks: (x, y, z, w) -> (x, -y, -z, w) (reflection of the axis).
// The mirrored clips are cached, never rebuilt per frame.
export function mirrorClip(sourceClip) {
  if (mirrorCache.has(sourceClip)) return mirrorCache.get(sourceClip);
  const clip = sourceClip.clone();
  clip.name = sourceClip.name + '_mirrored';
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const bone = track.name.slice(0, dot);
    const property = track.name.slice(dot + 1);
    track.name = swapSide(bone) + '.' + property;
    const values = track.values;
    if (property === 'position') {
      for (let i = 0; i < values.length; i += 3) values[i] = -values[i];
    } else if (property === 'quaternion') {
      for (let i = 0; i < values.length; i += 4) {
        values[i + 1] = -values[i + 1];
        values[i + 2] = -values[i + 2];
        const length = Math.hypot(values[i], values[i + 1], values[i + 2], values[i + 3]) || 1;
        values[i] /= length;
        values[i + 1] /= length;
        values[i + 2] /= length;
        values[i + 3] /= length;
      }
    }
  }
  mirrorCache.set(sourceClip, clip);
  return clip;
}

function collectBones(object) {
  const names = new Set();
  object.traverse((child) => {
    if (child.isBone) names.add(child.name);
  });
  return names;
}

function measurePrototype(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const heightCm = box.max.y - box.min.y;
  // Mixamo exports are in centimetres; derive the scale from the real height
  // so a replaced character would still stand on the ground.
  const scale = heightCm > 10 ? 1.8 / heightCm : 1;
  return {
    heightCm: +heightCm.toFixed(2),
    scale,
    groundOffset: -box.min.y * scale
  };
}

function validateClip(clip, boneNames, warnings) {
  const missing = new Set();
  for (const track of clip.tracks) {
    const bone = track.name.slice(0, track.name.lastIndexOf('.'));
    if (bone && !boneNames.has(bone)) missing.add(bone);
  }
  if (missing.size > 0) {
    warnings.push(clip.name + ': unknown bones ' + [...missing].slice(0, 6).join(', '));
  }
}

// Loads the character and every mapped animation. Never rejects: a missing file
// is recorded in `missing` and the caller keeps procedural characters.
export async function loadCharacterAssets(onProgress) {
  const assets = {
    ready: false,
    prototype: null,
    scale: 1,
    groundOffset: 0,
    heightCm: 0,
    boneNames: new Set(),
    clips: new Map(),
    clipInfo: [],
    missing: [],
    errors: [],
    warnings: [],
    definitions: CLIP_DEFINITIONS
  };

  const total = 1 + Object.keys(CLIP_DEFINITIONS).length + EXTRA_CLIP_FILES.length;
  let loaded = 0;
  const report = (label, error) => {
    loaded += 1;
    if (typeof onProgress === 'function') onProgress({ loaded, total, label, error });
  };

  try {
    const character = await loadFbx(assetUrl(CHARACTER_FILE));
    const measured = measurePrototype(character);
    assets.prototype = character;
    assets.scale = measured.scale;
    assets.groundOffset = measured.groundOffset;
    assets.heightCm = measured.heightCm;
    assets.boneNames = collectBones(character);
    assets.ready = true;
    report('Personnage');
  } catch (error) {
    assets.missing.push(CHARACTER_FILE);
    assets.errors.push(CHARACTER_FILE + ': ' + error.message);
    assets.ready = false;
    report('Personnage', error);
    // No skeleton -> no clip can be bound. Stop here, keep procedural actors.
    for (const name of Object.keys(CLIP_DEFINITIONS)) report(name, new Error('character missing'));
    for (const file of EXTRA_CLIP_FILES) report(file, new Error('character missing'));
    console.warn('[assets] Character missing, procedural characters kept:', assets.errors);
    return assets;
  }

  const uniqueFiles = new Map();
  for (const [semantic, definition] of Object.entries(CLIP_DEFINITIONS)) {
    if (!uniqueFiles.has(definition.file)) uniqueFiles.set(definition.file, []);
    uniqueFiles.get(definition.file).push({ semantic, definition });
  }

  for (const [file, mappings] of uniqueFiles) {
    try {
      const fbx = await loadFbx(assetUrl('animations/' + file));
      const rawClip = findMainClip(fbx);
      if (!rawClip) throw new Error('no animation clip in file');
      for (const { semantic: action, definition } of mappings) {
        const clip = prepareClip(rawClip, action, definition);
        if (action === mappings[0].semantic) {
          validateClip(clip, assets.boneNames, assets.warnings);
        }
        assets.clips.set(action, clip);
        assets.clipInfo.push({
          action,
          file,
          rawName: rawClip.name || RAW_CLIP_NAME,
          duration: +clip.duration.toFixed(3),
          tracks: clip.tracks.length,
          loop: !definition.once,
          directional: Boolean(definition.directional),
          pendingValidation: definition.pendingValidation || null
        });
        report(action);
      }
    } catch (error) {
      assets.missing.push(file);
      assets.errors.push(file + ': ' + error.message);
      for (const { semantic } of mappings) {
        assets.missing.push(semantic);
        report(semantic, error);
      }
    }
  }

  for (const file of EXTRA_CLIP_FILES) {
    try {
      const fbx = await loadFbx(assetUrl('animations/' + file));
      const rawClip = findMainClip(fbx);
      if (rawClip) {
        assets.clipInfo.push({
          action: 'extra:' + file,
          file,
          rawName: rawClip.name || RAW_CLIP_NAME,
          duration: +rawClip.duration.toFixed(3),
          tracks: rawClip.tracks.length,
          loop: true,
          directional: false,
          pendingValidation: null
        });
      }
      report(file);
    } catch (error) {
      assets.missing.push(file);
      assets.errors.push(file + ': ' + error.message);
      report(file, error);
    }
  }

  if (assets.errors.length > 0) {
    console.warn('[assets] Missing or invalid assets:', assets.errors);
  }
  return assets;
}

export function getClip(assets, semantic, mirrored) {
  const clip = assets.clips.get(semantic);
  if (!clip) return null;
  return mirrored ? mirrorClip(clip) : clip;
}

export function getClipDefinition(assets, semantic) {
  return (assets && assets.definitions[semantic]) || CLIP_DEFINITIONS[semantic] || null;
}

// Computes the exact real-time delay (seconds) from clip start to foot-ball contact.
export function getClipContactDelay(assets, semantic, fallback) {
  const definition = getClipDefinition(assets, semantic);
  if (!definition || definition.contactTime === undefined) return fallback;
  const start = definition.startTime || 0;
  const speed = definition.speed || 1;
  return Math.max(0.04, (definition.contactTime - start) / speed);
}
