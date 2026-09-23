import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
  type Scene,
} from "three";

const MOTE_COUNT = 36;
const BURST_COUNT = 64;
const POINT_COUNT = MOTE_COUNT + BURST_COUNT;

const pointVertex = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (190.0 / max(1.0, -mv.z));
  vAlpha = aAlpha;
}
`;

const pointFragment = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 p = gl_PointCoord - vec2(0.5);
  float d = length(p);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.08, d) * vAlpha;
  gl_FragColor = vec4(1.0, 0.93, 0.72, alpha);
}
`;

type Flier = {
  group: Group;
  left: Mesh;
  right: Mesh;
  ox: number;
  oz: number;
  y: number;
  phase: number;
  radius: number;
  speed: number;
};

type Bird = {
  group: Group;
  left: Mesh;
  right: Mesh;
  wait: number;
  flight: number;
};

export type Critters = {
  update: (time: number, dt: number, reduce: boolean) => void;
  rippleTo: (x: number, z: number, alpha: number, radius: number) => void;
  hideRipple: () => void;
  burst: (x: number, z: number) => void;
};

function wingTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not paint a wing");
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#fff4d2";
  ctx.beginPath();
  ctx.ellipse(34, 32, 22, 16, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 196, 120, 0.85)";
  ctx.beginPath();
  ctx.ellipse(30, 34, 8, 5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function ringTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not paint the touch ring");
  const glow = ctx.createRadialGradient(64, 64, 18, 64, 64, 62);
  glow.addColorStop(0, "rgba(255, 248, 230, 0)");
  glow.addColorStop(0.5, "rgba(255, 244, 214, 0.08)");
  glow.addColorStop(0.74, "rgba(255, 236, 196, 0.72)");
  glow.addColorStop(0.86, "rgba(255, 220, 160, 0.2)");
  glow.addColorStop(1, "rgba(255, 220, 160, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function makeButterfly(map: CanvasTexture, x: number, z: number, phase: number): Flier {
  const material = new MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    side: 2,
    color: new Color().setHSL(0.12 + phase * 0.04, 0.45, 0.82),
    fog: true,
  });
  const left = new Mesh(new PlaneGeometry(0.22, 0.14), material);
  const right = new Mesh(new PlaneGeometry(0.22, 0.14), material);
  left.position.x = -0.1;
  right.position.x = 0.1;
  right.scale.x = -1;
  const body = new Mesh(
    new PlaneGeometry(0.03, 0.16),
    new MeshBasicMaterial({ color: 0x3a2a22, side: 2, fog: true }),
  );
  const group = new Group();
  group.add(left, right, body);
  return { group, left, right, ox: x, oz: z, y: 0.85 + phase * 0.35, phase, radius: 0.7 + phase, speed: 0.35 + phase * 0.15 };
}

function makeBird(): Bird {
  const material = new MeshBasicMaterial({ color: 0x241c16, side: 2, fog: true });
  const left = new Mesh(new PlaneGeometry(0.7, 0.16), material);
  const right = new Mesh(new PlaneGeometry(0.7, 0.16), material);
  left.position.x = -0.34;
  right.position.x = 0.34;
  const group = new Group();
  group.add(left, right);
  group.visible = false;
  group.position.set(-16, 8, -6);
  return { group, left, right, wait: 2.5, flight: -1 };
}

export function createCritters(scene: Scene): Critters {
  const positions = new Float32Array(POINT_COUNT * 3);
  const sizes = new Float32Array(POINT_COUNT);
  const alphas = new Float32Array(POINT_COUNT);
  const velocity = new Float32Array(BURST_COUNT * 3);
  const life = new Float32Array(BURST_COUNT);

  for (let i = 0; i < MOTE_COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 1] = 0.4 + Math.random() * 2.2;
    positions[i * 3 + 2] = 2 - Math.random() * 8;
    sizes[i] = 5 + Math.random() * 6;
    alphas[i] = 0.35 + Math.random() * 0.4;
  }
  for (let i = 0; i < BURST_COUNT; i += 1) {
    const index = MOTE_COUNT + i;
    positions[index * 3 + 1] = -8;
    sizes[index] = 7;
    alphas[index] = 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new Float32BufferAttribute(alphas, 1));
  const points = new Points(
    geometry,
    new ShaderMaterial({
      uniforms: {},
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      toneMapped: false,
    }),
  );
  points.frustumCulled = false;
  scene.add(points);

  const ripple = new Mesh(
    new CircleGeometry(1, 40),
    new MeshBasicMaterial({
      map: ringTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0,
      fog: true,
    }),
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.035;
  ripple.renderOrder = 3;
  scene.add(ripple);

  const wing = wingTexture();
  const fliers = [
    makeButterfly(wing, -1.2, 0.2, 0.2),
    makeButterfly(wing, 1.4, -0.8, 0.9),
    makeButterfly(wing, -2.4, -1.6, 1.4),
    makeButterfly(wing, 2.2, -2.4, 0.5),
    makeButterfly(wing, 0.3, -3.2, 1.8),
  ];
  for (const flier of fliers) scene.add(flier.group);

  const bird = makeBird();
  scene.add(bird.group);

  const positionAttr = geometry.getAttribute("position");
  const alphaAttr = geometry.getAttribute("aAlpha");

  return {
    update(time, dt, reduce) {
      const drift = reduce ? 0.15 : 1;
      for (let i = 0; i < MOTE_COUNT; i += 1) {
        positions[i * 3] += Math.sin(time * 0.6 + i) * 0.08 * dt * drift;
        positions[i * 3 + 1] += (0.18 + (i % 5) * 0.03) * dt * drift;
        positions[i * 3 + 2] += Math.cos(time * 0.4 + i * 0.7) * 0.06 * dt * drift;
        if (positions[i * 3 + 1] > 3.1) {
          positions[i * 3 + 1] = 0.25;
          positions[i * 3] = (Math.random() - 0.5) * 10;
          positions[i * 3 + 2] = 2 - Math.random() * 8;
        }
      }
      for (let i = 0; i < BURST_COUNT; i += 1) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        const index = MOTE_COUNT + i;
        positions[index * 3] += velocity[i * 3] * dt;
        positions[index * 3 + 1] += velocity[i * 3 + 1] * dt;
        positions[index * 3 + 2] += velocity[i * 3 + 2] * dt;
        velocity[i * 3 + 1] -= dt * 0.35;
        alphas[index] = Math.max(0, life[i] / 0.9);
        if (life[i] <= 0) {
          alphas[index] = 0;
          positions[index * 3 + 1] = -8;
        }
      }
      positionAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;

      for (const flier of fliers) {
        const speed = flier.speed * (reduce ? 0.35 : 1);
        flier.group.position.set(
          flier.ox + Math.sin(time * speed + flier.phase) * flier.radius,
          flier.y + Math.sin(time * speed * 2.2 + flier.phase) * (reduce ? 0.02 : 0.12),
          flier.oz + Math.cos(time * speed * 0.8 + flier.phase) * flier.radius * 0.65,
        );
        const flap = Math.sin(time * (reduce ? 1.5 : 13) + flier.phase) * (reduce ? 0.08 : 0.85);
        flier.left.rotation.y = flap;
        flier.right.rotation.y = -flap;
        flier.group.rotation.y = Math.sin(time * speed + flier.phase) * 0.8;
      }

      bird.wait -= dt;
      if (bird.flight < 0 && bird.wait <= 0) {
        bird.flight = 0;
        bird.wait = reduce ? 28 : 14 + Math.random() * 8;
        bird.group.visible = true;
      }
      if (bird.flight >= 0) {
        bird.flight += dt * (reduce ? 0.55 : 1);
        const p = bird.flight / 9;
        if (p >= 1) {
          bird.flight = -1;
          bird.group.visible = false;
        } else {
          bird.group.position.set(-14 + p * 28, 6.4 + Math.sin(p * Math.PI) * 1.4, -5.5);
          const flap = reduce ? 0.12 : Math.sin(time * 11) * 0.55;
          bird.left.rotation.z = 0.25 + flap;
          bird.right.rotation.z = -0.25 - flap;
        }
      }
    },
    rippleTo(x, z, alpha, radius) {
      ripple.position.x = x;
      ripple.position.z = z;
      ripple.scale.setScalar(Math.max(0.2, radius));
      const material = ripple.material;
      if (material instanceof MeshBasicMaterial) material.opacity = alpha;
    },
    hideRipple() {
      const material = ripple.material;
      if (material instanceof MeshBasicMaterial) material.opacity = 0;
    },
    burst(x, z) {
      const count = 8;
      let spawned = 0;
      for (let i = 0; i < BURST_COUNT && spawned < count; i += 1) {
        if (life[i] > 0.05) continue;
        life[i] = 0.75 + Math.random() * 0.35;
        const index = MOTE_COUNT + i;
        positions[index * 3] = x + (Math.random() - 0.5) * 0.2;
        positions[index * 3 + 1] = 0.15 + Math.random() * 0.2;
        positions[index * 3 + 2] = z + (Math.random() - 0.5) * 0.2;
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.4 + Math.random() * 0.9;
        velocity[i * 3] = Math.cos(angle) * speed * 0.45;
        velocity[i * 3 + 1] = 0.8 + Math.random() * 1.1;
        velocity[i * 3 + 2] = Math.sin(angle) * speed * 0.45;
        alphas[index] = 0.9;
        sizes[index] = 6 + Math.random() * 5;
        spawned += 1;
      }
      geometry.getAttribute("aSize").needsUpdate = true;
    },
  };
}
