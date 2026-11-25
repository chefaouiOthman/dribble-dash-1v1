// Dev-only clip analysis: evaluates clips on the character skeleton and prints
// foot/hand/hip world positions over time, to determine clip direction and reach.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

globalThis.self = globalThis;
globalThis.window = globalThis;
window.innerWidth = 1280;
window.innerHeight = 720;
globalThis.document = globalThis.document || {
  createElementNS() { return { style: {}, setAttribute() {}, addEventListener() {}, removeEventListener() {}, getContext() { return null; } }; },
  createElement() { return { width: 1, height: 1, style: {}, getContext() { return { fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {}, createRadialGradient() { return { addColorStop() {} }; }, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {}, fillText() {}, strokeText() {}, set globalAlpha(v) {} }; }, toDataURL() { return ''; } }; }
};
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:stub';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIR = path.join(ROOT, 'public/assets/animations');
const CHARACTER = path.join(ROOT, 'public/assets/characters/ybot-character.fbx');

async function parse(file) {
  const buffer = await readFile(file);
  return new FBXLoader().parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

const character = await parse(CHARACTER);
const files = [
  'Side Step.fbx', 'Goalkeeper Sidestep.fbx', 'Goalkeeper Diving Save.fbx',
  'Goalkeeper Body Block.fbx', 'Goalkeeper Catch.fbx', 'Soccer Trip.fbx',
  'Running Slide.fbx', 'Sprint.fbx', 'Running.fbx', 'Jogging.fbx',
  'Kick Soccerball.fbx', 'Strike Foward Jog.fbx', 'Standing Up.fbx',
  'Jump.fbx', 'Victory.fbx'
];
const samples = {};
for (const file of files) {
  const animation = await parse(path.join(DIR, file));
  const clip = animation.animations[0];
  const root = skeletonClone(character);
  root.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();
  const out = [];
  const boneNames = ['mixamorigHips', 'mixamorigLeftFoot', 'mixamorigRightFoot', 'mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftHand', 'mixamorigRightHand'];
  for (let step = 0; step <= 8; step++) {
    const t = (clip.duration * step) / 8;
    mixer.setTime(0);
    mixer.setTime(t);
    root.updateMatrixWorld(true);
    const row = { t: +t.toFixed(2) };
    for (const name of boneNames) {
      const bone = root.getObjectByName(name);
      if (!bone) { row[name] = null; continue; }
      const p = new THREE.Vector3();
      bone.getWorldPosition(p);
      row[name] = [ +p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1) ];
    }
    out.push(row);
  }
  samples[file] = { duration: clip.duration, samples: out };
  console.log('\n=== ' + file + ' (' + clip.duration.toFixed(2) + 's)');
  for (const row of out) {
    console.log(`t=${row.t} hips=${row.mixamorigHips} LF=${row.mixamorigLeftFoot} RF=${row.mixamorigRightFoot} LH=${row.mixamorigLeftHand} RH=${row.mixamorigRightHand}`);
  }
}
await writeFile(path.join(ROOT, 'tools/clip-samples.json'), JSON.stringify(samples, null, 2));
console.log('\nWrote tools/clip-samples.json');
