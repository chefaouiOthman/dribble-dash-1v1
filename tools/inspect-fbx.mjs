// Dev-only FBX inspection tool (Node). Reports clips, tracks, bones, scale and root motion.
// Usage: node tools/inspect-fbx.mjs
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

// Minimal DOM shims so FBXLoader can parse embedded textures in Node without crashing.
globalThis.self = globalThis;
globalThis.window = globalThis;
window.innerWidth = 1280;
window.innerHeight = 720;
if (!globalThis.document) {
  globalThis.document = {
    createElementNS() {
      const img = {
        style: {}, setAttribute() {}, addEventListener() {}, removeEventListener() {},
        getContext() { return null; }
      };
      return img;
    },
    createElement() {
      return {
        width: 1, height: 1, style: {},
        getContext() {
          return {
            fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
            moveTo() {}, lineTo() {}, closePath() {}, createRadialGradient() {
              return { addColorStop() {} };
            }, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
            set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
            fillText() {}, strokeText() {}, set globalAlpha(v) {}
          };
        },
        toDataURL() { return ''; }
      };
    }
  };
}
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:stub';

const ROOT = path.resolve(import.meta.dirname, '..');
const ANIM_DIR = path.join(ROOT, 'public/assets/animations');
const CHARACTER = path.join(ROOT, 'public/assets/characters/ybot-character.fbx');

async function parseFile(file) {
  const buffer = await readFile(file);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new FBXLoader();
  return loader.parse(arrayBuffer, '');
}

function summarizeObject(object) {
  const bones = [];
  let skinnedMeshes = 0;
  let meshes = 0;
  const bbox = new THREE.Box3();
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (child.isBone) bones.push(child.name);
    if (child.isSkinnedMesh) skinnedMeshes += 1;
    if (child.isMesh) meshes += 1;
  });
  try { bbox.setFromObject(object); } catch (error) { /* ignore */ }
  return {
    bones,
    boneCount: bones.length,
    skinnedMeshes,
    meshes,
    bbox: bbox.isEmpty() ? null : {
      min: bbox.min.toArray().map((v) => +v.toFixed(3)),
      max: bbox.max.toArray().map((v) => +v.toFixed(3))
    }
  };
}

function clipSummary(clip, bones) {
  const hipsTracks = clip.tracks.filter((t) => /hips/i.test(t.name));
  let hipsTravel = null;
  let hipsPath = null;
  for (const track of hipsTracks) {
    if (track.name.endsWith('.position')) {
      const values = track.values;
      let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
      let minY = Infinity; let maxY = -Infinity;
      for (let i = 0; i < values.length; i += 3) {
        minX = Math.min(minX, values[i]); maxX = Math.max(maxX, values[i]);
        minY = Math.min(minY, values[i + 1]); maxY = Math.max(maxY, values[i + 1]);
        minZ = Math.min(minZ, values[i + 2]); maxZ = Math.max(maxZ, values[i + 2]);
      }
      const last = values.length - 3;
      hipsTravel = { x: +(maxX - minX).toFixed(3), y: +(maxY - minY).toFixed(3), z: +(maxZ - minZ).toFixed(3) };
      hipsPath = {
        first: [values[0], values[1], values[2]].map((v) => +v.toFixed(2)),
        last: [values[last], values[last + 1], values[last + 2]].map((v) => +v.toFixed(2)),
        deltaX: +(values[last] - values[0]).toFixed(2),
        deltaZ: +(values[last + 2] - values[2]).toFixed(2)
      };
    }
  }
  const trackNames = clip.tracks.map((t) => t.name);
  const left = trackNames.filter((n) => /left/i.test(n) && !/forearm|hand|upLeg|leg|toe/i.test(n)).slice(0, 3);
  const right = trackNames.filter((n) => /right/i.test(n) && !/forearm|hand|upLeg|leg|toe/i.test(n)).slice(0, 3);
  const mismatched = trackNames
    .map((n) => n.split('.')[0])
    .filter((bone) => bones.length > 0 && !bones.includes(bone));
  return {
    name: clip.name,
    duration: +clip.duration.toFixed(3),
    trackCount: clip.tracks.length,
    hipsTravel,
    hipsPath,
    sampleTracks: trackNames.slice(0, 3),
    sampleLeft: left,
    sampleRight: right,
    unmatchedBones: [...new Set(mismatched)].slice(0, 10)
  };
}

const report = { character: null, animations: [] };
const character = await parseFile(CHARACTER);
const characterSummary = summarizeObject(character);
report.character = {
  file: path.relative(ROOT, CHARACTER),
  ...characterSummary,
  animations: character.animations.map((clip) => clipSummary(clip, characterSummary.bones))
};
console.log('CHARACTER', JSON.stringify(report.character, null, 2));

const files = (await readdir(ANIM_DIR)).filter((name) => name.toLowerCase().endsWith('.fbx'));
for (const file of files) {
  try {
    const object = await parseFile(path.join(ANIM_DIR, file));
    const summary = summarizeObject(object);
    const entry = {
      file,
      boneCount: summary.boneCount,
      skinnedMeshes: summary.skinnedMeshes,
      meshes: summary.meshes,
      animations: object.animations.map((clip) => clipSummary(clip, characterSummary.bones)),
      boneSample: summary.bones.slice(0, 5)
    };
    report.animations.push(entry);
    console.log('\nFILE', file);
    console.log(JSON.stringify(entry, null, 2));
  } catch (error) {
    report.animations.push({ file, error: String(error) });
    console.log('\nFILE', file, 'ERROR', error.message);
  }
}

await writeFile(path.join(ROOT, 'tools/fbx-report.json'), JSON.stringify(report, null, 2));
console.log('\nWrote tools/fbx-report.json');
