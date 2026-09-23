import {
  BackSide,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Scene,
  type WebGLRenderer,
} from "three";
import { SUN_DIR } from "./constants";
import { mulberry32 } from "./rng";

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vDir = world.xyz - cameraPosition;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const skyFragment = /* glsl */ `
varying vec3 vDir;
uniform vec3 uHorizon;
uniform vec3 uMid;
uniform vec3 uZenith;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uTime;

void main() {
  vec3 dir = normalize(vDir);
  float height = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.2, height));
  col = mix(col, uZenith, smoothstep(0.15, 0.78, height));

  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sunDot, 5.0) * 0.62;
  col += uSunColor * pow(sunDot, 90.0) * 1.35;

  float cloud = sin(dir.x * 10.0 + uTime * 0.05 + sin(dir.z * 4.0));
  cloud *= sin(dir.z * 8.0 - uTime * 0.035);
  cloud = smoothstep(0.2, 0.95, cloud * 0.5 + 0.5);
  float band = smoothstep(0.06, 0.32, height) * (1.0 - smoothstep(0.5, 0.92, height));
  col = mix(col, uSunColor * 0.55 + uHorizon * 0.45, cloud * band * 0.33);

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function carpetTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not paint the ground");
  ctx.fillStyle = "#3d7c46";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(22, 70, 36, 0.28)" : "rgba(190, 200, 90, 0.12)";
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 256,
      Math.random() * 256,
      10 + Math.random() * 28,
      6 + Math.random() * 16,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  for (let i = 0; i < 1400; i += 1) {
    ctx.fillStyle = Math.random() > 0.45 ? "rgba(18, 62, 30, 0.35)" : "rgba(214, 220, 120, 0.18)";
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 2 + Math.random() * 5);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(16, 16);
  return texture;
}

function sunTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not paint the sun");
  const glow = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  glow.addColorStop(0, "rgba(255, 252, 236, 1)");
  glow.addColorStop(0.18, "rgba(255, 214, 140, 0.95)");
  glow.addColorStop(0.42, "rgba(255, 160, 70, 0.28)");
  glow.addColorStop(1, "rgba(255, 140, 50, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export type World = {
  skyTime: { value: number };
  followSky: (x: number, y: number, z: number) => void;
};

export function createWorld(scene: Scene, renderer: WebGLRenderer): World {
  scene.fog = new FogExp2(0xf6c592, 0.032);

  const hemi = new HemisphereLight(0xffe0b5, 0x2f5c34, 1.05);
  const sun = new DirectionalLight(0xffb15a, 1.7);
  sun.position.copy(SUN_DIR).multiplyScalar(14);
  const fill = new DirectionalLight(0x9ebedd, 0.28);
  fill.position.set(-5, 3.2, 3);
  scene.add(hemi, sun, fill);

  const skyTime = { value: 0 };
  const sky = new Mesh(
    new SphereGeometry(80, 32, 18),
    new ShaderMaterial({
      uniforms: {
        uHorizon: { value: new Color("#ffd3a6") },
        uMid: { value: new Color("#f4a15f") },
        uZenith: { value: new Color("#79b4dc") },
        uSunColor: { value: new Color("#fff1cc") },
        uSunDir: { value: SUN_DIR },
        uTime: skyTime,
      },
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.renderOrder = -2;
  sky.frustumCulled = false;
  scene.add(sky);

  const sunSprite = new Sprite(
    new SpriteMaterial({
      map: sunTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  sunSprite.position.copy(SUN_DIR).multiplyScalar(34);
  sunSprite.scale.set(16, 16, 1);
  sunSprite.renderOrder = -1;
  scene.add(sunSprite);

  const groundMap = carpetTexture();
  groundMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new Mesh(
    new PlaneGeometry(80, 80),
    new MeshLambertMaterial({ map: groundMap, color: 0xd7f0b0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const hills: Array<[number, number, number, number, number, number, number]> = [
    [-12, -2.4, -13, 10, 3.2, 7, 0x4f8d55],
    [8, -2.8, -15, 12, 3.6, 8, 0x3f7a48],
    [0, -4.2, -20, 24, 5.5, 9, 0x6aa36a],
    [-18, -1.6, -8, 7, 2.2, 5, 0x467e4c],
    [16, -1.8, -7, 6, 2, 5, 0x3d7346],
  ];
  for (const [x, y, z, sx, sy, sz, color] of hills) {
    const hill = new Mesh(new SphereGeometry(1, 28, 16), new MeshLambertMaterial({ color }));
    hill.scale.set(sx, sy, sz);
    hill.position.set(x, y, z);
    scene.add(hill);
  }

  addTrees(scene);
  addFlowers(scene);

  return {
    skyTime,
    followSky(x, y, z) {
      sky.position.set(x, y, z);
    },
  };
}

function addTrees(scene: Scene): void {
  const rng = mulberry32(0x71ee);
  const trunkMat = new MeshLambertMaterial({ color: 0x6a4632 });
  const greens = [0x2b6738, 0x347a44, 0x245c32, 0x3e8648].map(
    (color) => new MeshLambertMaterial({ color }),
  );
  const spots: Array<[number, number, number]> = [
    [-6.8, -7.4, 1.35],
    [-3.4, -8.6, 1.7],
    [0.2, -9.4, 1.25],
    [3.6, -8.2, 1.55],
    [6.6, -7.1, 1.2],
    [-8.4, -4.8, 0.95],
    [8.2, -4.4, 1.05],
    [-1.2, -11.2, 1.9],
    [5.2, -11.5, 1.4],
  ];
  for (const [x, z, scale] of spots) {
    const crownMat = greens[Math.floor(rng() * greens.length)] ?? greens[0];
    const group = new Group();
    const trunk = new Mesh(new CylinderGeometry(0.08, 0.13, 0.85, 6), trunkMat);
    trunk.position.y = 0.42;
    const crown = new Mesh(new IcosahedronGeometry(0.7, 1), crownMat);
    crown.position.y = 1.18;
    crown.scale.set(1.05, 0.82, 1);
    const puff = new Mesh(new IcosahedronGeometry(0.46, 1), crownMat);
    puff.position.set((rng() - 0.5) * 0.4, 1.62, (rng() - 0.5) * 0.32);
    group.add(trunk, crown, puff);
    group.position.set(x, 0, z);
    group.scale.setScalar(scale);
    scene.add(group);
  }
}

function addFlowers(scene: Scene): void {
  const count = 42;
  const rng = mulberry32(0xc0ffee);
  const stem = new InstancedMesh(
    new CylinderGeometry(0.012, 0.016, 1, 5),
    new MeshLambertMaterial({ color: 0x3e7a3a }),
    count,
  );
  const bud = new InstancedMesh(
    new SphereGeometry(0.055, 7, 6),
    new MeshLambertMaterial({ color: 0xffffff }),
    count,
  );
  const dummy = new Object3D();
  const palette = [new Color("#fff6d8"), new Color("#ffe08a"), new Color("#ffd0dc"), new Color("#ffffff")];
  for (let i = 0; i < count; i += 1) {
    const x = (rng() - 0.5) * 9;
    const z = 1.6 - rng() * 7.5;
    const height = 0.28 + rng() * 0.42;
    dummy.position.set(x, height * 0.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    stem.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, height, z);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bud.setMatrixAt(i, dummy.matrix);
    const color = palette[Math.floor(rng() * palette.length)] ?? palette[0];
    bud.setColorAt(i, color);
  }
  stem.instanceMatrix.needsUpdate = true;
  bud.instanceMatrix.needsUpdate = true;
  if (bud.instanceColor) bud.instanceColor.needsUpdate = true;
  scene.add(stem, bud);
}
