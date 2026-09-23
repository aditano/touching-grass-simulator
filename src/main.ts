import "./style.css";
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { createAudio } from "./audio";
import { frameCamera } from "./camera";
import { TOUCH_SLOTS } from "./constants";
import { createCritters } from "./critters";
import { chooseBladeCount, createGrass } from "./grass";
import { Session } from "./stats";
import { bindHud } from "./ui";
import { createWorld } from "./world";

type Slot = {
  x: number;
  z: number;
  radius: number;
  strength: number;
  decay: number;
};

type Finger = {
  slot: number;
  x: number;
  z: number;
  markX: number;
  markZ: number;
};

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const raycaster = new Raycaster();
const ndc = new Vector2();
const hitPoint = new Vector3();

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function pixelRatio(): number {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cap = coarse ? 1.75 : 2;
  return Math.min(window.devicePixelRatio || 1, cap);
}

function showFallback(): void {
  const fallback = document.querySelector<HTMLElement>("#fallback");
  const canvas = document.querySelector<HTMLElement>("#view");
  if (canvas) canvas.hidden = true;
  if (fallback) fallback.hidden = false;
}

function main(): void {
  const appNode = document.querySelector<HTMLElement>("#app");
  const canvasNode = document.querySelector<HTMLCanvasElement>("#view");
  if (!appNode || !canvasNode) return;
  const app = appNode;
  const canvas = canvasNode;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch {
    showFallback();
    return;
  }
  if (!renderer.getContext()) {
    showFallback();
    return;
  }

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.08, 160);
  const world = createWorld(scene, renderer);
  const grass = createGrass(scene, chooseBladeCount());
  const critters = createCritters(scene);
  const audio = createAudio();
  const hud = bindHud();
  const session = new Session((text) => hud.showQuip(text));

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  hud.setHint(coarse ? "Drag a finger through the grass" : "Click and drag through the grass");
  hud.setMuted(audio.muted);
  window.setTimeout(() => hud.hideHint(), 5600);

  const slots: Slot[] = Array.from({ length: TOUCH_SLOTS }, () => ({
    x: 0,
    z: 0,
    radius: 0.9,
    strength: 0,
    decay: 2.6,
  }));
  const fingers = new Map<number, Finger>();
  let reduceMotion = prefersReducedMotion();
  let hovered = false;

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  motionQuery.addEventListener("change", () => {
    reduceMotion = motionQuery.matches;
  });

  hud.onMute(() => {
    audio.unlock();
    hud.setMuted(audio.toggleMuted());
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "m" || event.key === "M") {
      audio.unlock();
      hud.setMuted(audio.toggleMuted());
    }
  });

  function viewport() {
    const view = window.visualViewport;
    return {
      width: Math.max(1, Math.round(view?.width ?? window.innerWidth)),
      height: Math.max(1, Math.round(view?.height ?? window.innerHeight)),
    };
  }

  function resize(): void {
    const { width, height } = viewport();
    app.style.height = `${height}px`;
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    frameCamera(camera);
  }

  function groundHit(event: PointerEvent): Vector3 | null {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray.intersectPlane(groundPlane, hitPoint) ? hitPoint : null;
  }

  function weakest(except = -1): number {
    let pick = except === 0 ? 1 : 0;
    for (let i = 0; i < slots.length; i += 1) {
      if (i === except) continue;
      if (slots[i].strength < slots[pick].strength) pick = i;
    }
    return pick;
  }

  function writeTouches(): void {
    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      grass.touches[i].set(slot.x, slot.z, slot.radius, slot.strength);
    }
  }

  function plant(index: number, x: number, z: number, strength: number, radius: number, decay: number): void {
    const slot = slots[index];
    slot.x = x;
    slot.z = z;
    slot.strength = strength;
    slot.radius = radius;
    slot.decay = decay;
  }

  function onDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const hit = groundHit(event);
    if (!hit) return;
    event.preventDefault();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone. The brush still counts.
    }
    audio.unlock();
    audio.rustle();
    hud.hideHint();
    app.classList.add("is-down");
    const radius = event.pointerType === "touch" ? 1.15 : 0.72;
    const slot = weakest();
    plant(slot, hit.x, hit.z, 1, radius, 2.2);
    fingers.set(event.pointerId, { slot, x: hit.x, z: hit.z, markX: hit.x, markZ: hit.z });
    critters.rippleTo(hit.x, hit.z, 0.95, radius * 1.35);
    critters.burst(hit.x, hit.z);
    session.press(performance.now());
    writeTouches();
  }

  function onMove(event: PointerEvent): void {
    const finger = fingers.get(event.pointerId);
    const hit = groundHit(event);
    if (!hit) return;
    if (!finger) {
      if (event.pointerType === "touch") return;
      hovered = true;
      const radius = 0.62;
      critters.rippleTo(hit.x, hit.z, 0.38, radius * 1.2);
      return;
    }
    const radius = slots[finger.slot].radius;
    const dx = hit.x - finger.x;
    const dz = hit.z - finger.z;
    if (dx * dx + dz * dz > 0.1) {
      const ghost = weakest(finger.slot);
      plant(ghost, finger.x, finger.z, 0.82, radius * 0.92, 3.4);
      finger.x = hit.x;
      finger.z = hit.z;
    }
    plant(finger.slot, hit.x, hit.z, 1, radius, 2.2);
    const mx = hit.x - finger.markX;
    const mz = hit.z - finger.markZ;
    if (mx * mx + mz * mz > 0.055) {
      finger.markX = hit.x;
      finger.markZ = hit.z;
      session.stroke(performance.now());
      audio.rustle();
      critters.burst(hit.x, hit.z);
    } else {
      session.hold(performance.now());
    }
    critters.rippleTo(hit.x, hit.z, 0.95, radius * 1.35);
    writeTouches();
  }

  function onUp(event: PointerEvent): void {
    const finger = fingers.get(event.pointerId);
    if (!finger) return;
    fingers.delete(event.pointerId);
    slots[finger.slot].decay = 3.1;
    if (fingers.size === 0) app.classList.remove("is-down");
    try {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
  }

  canvas.addEventListener("pointerdown", onDown, { passive: false });
  canvas.addEventListener("pointermove", onMove, { passive: false });
  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (event.cancelable) event.preventDefault();
    },
    { passive: false },
  );
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", () => {
    if (fingers.size === 0 && hovered) {
      hovered = false;
      critters.hideRipple();
    }
  });
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    showFallback();
  });

  resize();
  window.addEventListener("resize", resize);
  window.visualViewport?.addEventListener("resize", resize);

  let last = performance.now();
  const base = camera.position.clone();

  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const visible = document.visibilityState !== "hidden";
    if (visible) {
      grass.time.value += reduceMotion ? dt * 0.35 : dt;
      world.skyTime.value = grass.time.value;
      grass.wind.value = reduceMotion ? 0.045 : 0.27;
      if (fingers.size > 0) session.hold(now);
      const held = new Set<number>();
      for (const finger of fingers.values()) {
        held.add(finger.slot);
        slots[finger.slot].strength = 1;
      }
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        if (held.has(i) || slot.strength <= 0) continue;
        slot.strength *= Math.exp(-dt * slot.decay);
        if (slot.strength < 0.012) slot.strength = 0;
      }
      writeTouches();
      critters.update(grass.time.value, dt, reduceMotion);
      frameCamera(camera);
      base.copy(camera.position);
      if (!reduceMotion) camera.position.y = base.y + Math.sin(grass.time.value * 0.45) * 0.025;
      world.followSky(camera.position.x, camera.position.y, camera.position.z);
      renderer.render(scene, camera);
    }
    session.tick(dt, visible);
    hud.render(session.view());
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

main();
