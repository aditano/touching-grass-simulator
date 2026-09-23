import type { PerspectiveCamera } from "three";

/** Frame the meadow for a tall phone first, then open up as the screen widens. */
export function frameCamera(camera: PerspectiveCamera): void {
  const aspect = camera.aspect;
  if (aspect < 0.72) {
    camera.fov = 56;
    camera.position.set(0.18, 1.85, 3.15);
    camera.lookAt(0.05, 0.38, -1.55);
  } else if (aspect < 1.15) {
    camera.fov = 48;
    camera.position.set(0.1, 2.05, 3.7);
    camera.lookAt(0, 0.46, -1.45);
  } else {
    camera.fov = 40;
    camera.position.set(0, 2.2, 4.55);
    camera.lookAt(0, 0.52, -1.35);
  }
  camera.updateProjectionMatrix();
}
