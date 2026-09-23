import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
  Vector4,
  type Scene,
} from "three";
import { SUN_DIR, TOUCH_SLOTS } from "./constants";
import { mulberry32 } from "./rng";

const vertexShader = /* glsl */ `
attribute float aPhase;
attribute float aHue;
attribute float aHook;

varying vec3 vNormal;
varying vec3 vWorld;
varying float vH;
varying float vHue;
varying float vTouch;

uniform float uTime;
uniform float uWindAmp;
uniform vec4 uTouch[${TOUCH_SLOTS}];

#include <fog_pars_vertex>

void main() {
  float h = uv.y;
  vH = h;
  vHue = aHue;
  float tip = h * h;

  vec3 side = vec3(normal.z, 0.0, -normal.x);
  vec3 curled = position + side * aHook * tip * h * 0.18;
  vec4 world = instanceMatrix * vec4(curled, 1.0);

  float gust = sin(uTime * 1.32 + aPhase + world.x * 0.45 + world.z * 0.22);
  float gust2 = sin(uTime * 0.54 + aPhase * 1.9 + world.z * 0.18);
  float wind = (gust * 0.72 + gust2 * 0.28) * uWindAmp;
  world.x += 0.94 * wind * tip;
  world.z += 0.26 * wind * tip;

  vec3 root = instanceMatrix[3].xyz;
  vec2 push = vec2(0.0);
  float touchAmt = 0.0;
  for (int i = 0; i < ${TOUCH_SLOTS}; i++) {
    vec2 delta = root.xz - uTouch[i].xy;
    float dist = length(delta);
    float radius = max(uTouch[i].z, 0.001);
    float strength = uTouch[i].w;
    float falloff = (1.0 - smoothstep(radius * 0.05, radius, dist)) * strength;
    vec2 dir = dist > 0.001 ? delta / dist : vec2(0.15, 0.85);
    push += dir * falloff;
    touchAmt += falloff;
  }
  touchAmt = clamp(touchAmt, 0.0, 1.0);
  vTouch = touchAmt;
  world.x += push.x * tip * 1.08;
  world.z += push.y * tip * 1.08;
  world.y *= mix(1.0, 0.46, touchAmt * h);

  vec3 n = normalize(mat3(instanceMatrix) * normal);
  n = normalize(n + vec3(-0.9, 0.22, -0.24) * wind + vec3(-push.x, 0.4, -push.y) * touchAmt);
  vNormal = n;
  vWorld = world.xyz;

  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorld;
varying float vH;
varying float vHue;
varying float vTouch;

uniform vec3 uRoot;
uniform vec3 uTip;
uniform vec3 uGlow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;

#include <fog_pars_fragment>

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorld);
  if (dot(n, viewDir) < 0.0) n = -n;

  vec3 sun = normalize(uSunDir);
  float wrap = clamp(dot(n, sun) * 0.48 + 0.58, 0.0, 1.0);
  float sss = pow(clamp(dot(viewDir, -sun), 0.0, 1.0), 1.6) * vH;

  vec3 albedo = mix(uRoot, uTip, smoothstep(0.0, 1.0, vH));
  albedo += vec3(0.045, 0.03, -0.012) * vHue;
  albedo *= mix(0.55, 1.0, smoothstep(0.0, 0.45, vH));
  albedo = mix(albedo, uGlow, vTouch * 0.78 * smoothstep(0.05, 1.0, vH));

  vec3 skyTint = vec3(0.95, 0.78, 0.52);
  vec3 soilTint = vec3(0.09, 0.13, 0.05);
  vec3 ambient = mix(soilTint, skyTint, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
  vec3 col = albedo * (ambient * 0.62 + uSunColor * wrap * 1.2);
  col += uSunColor * sss * 0.16;

  float spec = pow(clamp(dot(normalize(sun + viewDir), n), 0.0, 1.0), 30.0);
  col += vec3(1.0, 0.9, 0.66) * spec * vH * 0.38;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export type GrassField = {
  mesh: InstancedMesh;
  time: { value: number };
  wind: { value: number };
  touches: Vector4[];
};

export function chooseBladeCount(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 520;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (narrow || coarse || memory <= 4 || cores <= 4) return 8500;
  return 16000;
}

function bladeGeometry(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const segments = 5;

  const append = (rotY: number) => {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const start = positions.length / 3;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const half = 0.078 * (1 - t * 0.94);
      for (const x of [-half, half]) {
        positions.push(x * c, t, -x * s);
        normals.push(s, 0, c);
        uvs.push(x < 0 ? 0 : 1, t);
      }
    }
    for (let i = 0; i < segments; i += 1) {
      const a = start + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  };

  append(0);
  append(Math.PI * 0.5);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function scatter(rng: () => number, count: number, place: (x: number, z: number) => void): void {
  let placed = 0;
  while (placed < count) {
    const foreground = rng() < 0.8;
    let cx: number;
    let cz: number;
    if (foreground) {
      cx = (rng() - 0.5) * 10.2;
      cz = 2.7 - rng() * 6.8;
    } else {
      const angle = rng() * Math.PI * 2;
      const radius = 4.2 + rng() * 8.5;
      cx = Math.cos(angle) * radius * 1.2;
      cz = Math.sin(angle) * radius * 0.72 - 3.2;
    }
    const members = foreground ? 6 + Math.floor(rng() * 8) : 3 + Math.floor(rng() * 4);
    const spread = foreground ? 0.38 : 0.55;
    for (let member = 0; member < members && placed < count; member += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = rng() * spread;
      let x = cx + Math.cos(angle) * radius;
      let z = cz + Math.sin(angle) * radius;
      if (z > 3.05) z = 3.05 - rng() * 0.8;
      place(x, z);
      placed += 1;
    }
  }
}

export function createGrass(scene: Scene, count: number): GrassField {
  const geometry = bladeGeometry();
  const touches = Array.from({ length: TOUCH_SLOTS }, () => new Vector4(0, 0, 0.9, 0));
  const time = { value: 0 };
  const wind = { value: 0.26 };

  const material = new ShaderMaterial({
    uniforms: {
      uTime: time,
      uWindAmp: wind,
      uTouch: { value: touches },
      uRoot: { value: new Color("#12381f") },
      uTip: { value: new Color("#c6e27a") },
      uGlow: { value: new Color("#ffe39a") },
      uSunDir: { value: SUN_DIR },
      uSunColor: { value: new Color("#ffb56a") },
      fogColor: { value: new Color("#f6c592") },
      fogDensity: { value: 0.03 },
    },
    vertexShader,
    fragmentShader,
    side: DoubleSide,
    fog: true,
  });

  const mesh = new InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  const dummy = new Object3D();
  const rng = mulberry32(0x6a55);
  const phases = new Float32Array(count);
  const hues = new Float32Array(count);
  const hooks = new Float32Array(count);

  let index = 0;
  scatter(rng, count, (x, z) => {
    const roll = rng();
    const height = roll < 0.62 ? 0.32 + rng() * 0.38 : roll < 0.9 ? 0.7 + rng() * 0.45 : 1.15 + rng() * 0.5;
    const width = 0.72 + rng() * 0.85;
    dummy.position.set(x, 0, z);
    dummy.rotation.set((rng() - 0.5) * 0.28, rng() * Math.PI * 2, (rng() - 0.5) * 0.22);
    dummy.scale.set(width, height, width);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    phases[index] = rng() * Math.PI * 2;
    hues[index] = rng() * 2 - 1;
    hooks[index] = rng() * 2 - 1;
    index += 1;
  });

  geometry.setAttribute("aPhase", new InstancedBufferAttribute(phases, 1));
  geometry.setAttribute("aHue", new InstancedBufferAttribute(hues, 1));
  geometry.setAttribute("aHook", new InstancedBufferAttribute(hooks, 1));
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  return { mesh, time, wind, touches };
}
