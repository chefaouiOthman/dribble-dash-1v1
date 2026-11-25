import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Custom GLSL pass: chromatic aberration, saturation, vignette and film grain.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAberration: { value: 0.0012 },
    uVignette: { value: 0.5 },
    uSaturation: { value: 1.08 },
    uGrain: { value: 0.03 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uGrain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 centered = vUv - 0.5;
      float dist = length(centered);
      vec2 offset = centered * uAberration * (0.5 + dist * 3.0);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 color = vec3(r, g, b);
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation);
      float vignette = 1.0 - smoothstep(0.25, 0.8, dist);
      color *= mix(1.0, vignette, uVignette);
      color += (hash(vUv * 1000.0 + fract(uTime) * 10.0) - 0.5) * uGrain;
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

export function createPostProcessing(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);
  const pixelRatio = renderer.getPixelRatio();
  // The 3D scene is rendered at full canvas resolution; the effect chain runs
  // at a slightly lower internal resolution (bloom/grade are low-frequency and
  // the upscale is invisible, while the GPU cost drops sharply on iGPUs).
  const effectRatio = Math.min(pixelRatio, 1);
  const maxSamples = renderer.capabilities.maxSamples || 0;

  const renderTarget = new THREE.WebGLRenderTarget(size.x * effectRatio, size.y * effectRatio, {
    type: THREE.HalfFloatType,
    samples: Math.min(2, maxSamples)
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(effectRatio);
  composer.setSize(size.x, size.y);

  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(size.x * effectRatio, size.y * effectRatio), 0.4, 0.6, 0.85
  );
  composer.addPass(bloomPass);
  const gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());

  const defaults = { aberration: 0.0012, vignette: 0.5, saturation: 1.08, bloom: 0.4 };
  return {
    composer,
    bloomPass,
    gradePass,
    current: { ...defaults },
    targets: { ...defaults }
  };
}

// Smoothly moves the effect parameters toward fx.targets, then updates the passes.
export function updatePostProcessing(fx, delta) {
  const smoothing = Math.min(1, delta * 6);
  const c = fx.current;
  const t = fx.targets;
  c.aberration += (t.aberration - c.aberration) * smoothing;
  c.vignette += (t.vignette - c.vignette) * smoothing;
  c.saturation += (t.saturation - c.saturation) * smoothing;
  c.bloom += (t.bloom - c.bloom) * smoothing;
  const uniforms = fx.gradePass.uniforms;
  uniforms.uAberration.value = c.aberration;
  uniforms.uVignette.value = c.vignette;
  uniforms.uSaturation.value = c.saturation;
  uniforms.uTime.value += delta;
  fx.bloomPass.strength = c.bloom;
}