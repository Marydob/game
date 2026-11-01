// Камера: вид сверху под углом ~57°, плавно следует за дырой и отдаляется при её росте
import * as THREE from 'three';

const ANGLE = THREE.MathUtils.degToRad(57);

export class CameraRig {
  constructor(camera, sun, scene) {
    this.camera = camera;
    this.sun = sun;
    this.scene = scene;
    this.target = new THREE.Vector3();
    this.distance = 34;
    this.shadowHalf = 0;
    camera.far = 900;
    camera.updateProjectionMatrix();
  }

  // Расстояние до земли в зависимости от радиуса дыры
  static distanceFor(radius) {
    return 22 + radius * 9;
  }

  // Мгновенно поставить камеру (старт игры, респавн)
  snap(pos, radius) {
    this.target.set(pos.x, 0, pos.z);
    this.distance = CameraRig.distanceFor(radius);
    this.apply();
  }

  update(dt, pos, radius) {
    const follow = 1 - Math.exp(-8 * dt);
    this.target.x += (pos.x - this.target.x) * follow;
    this.target.z += (pos.z - this.target.z) * follow;
    const zoom = 1 - Math.exp(-3 * dt); // зум плавнее, чем слежение
    this.distance += (CameraRig.distanceFor(radius) - this.distance) * zoom;
    this.apply();
  }

  apply() {
    const { camera, sun, target, distance: D } = this;
    camera.position.set(target.x, Math.sin(ANGLE) * D, target.z + Math.cos(ANGLE) * D);
    camera.lookAt(target);

    // Солнце едет за камерой, чтобы тени были там, где мы смотрим
    sun.position.set(target.x + D * 0.6, D * 1.3, target.z + D * 0.4);
    sun.target.position.copy(target);
    sun.target.updateMatrixWorld();

    // Размер области теней растёт вместе с зумом (пересчёт только при заметном изменении)
    const half = D * 1.1;
    if (Math.abs(half - this.shadowHalf) > 0.5) {
      const s = sun.shadow.camera;
      s.left = -half;
      s.right = half;
      s.top = half;
      s.bottom = -half;
      s.near = 1;
      s.far = D * 3.5;
      s.updateProjectionMatrix();
      this.shadowHalf = half;
    }

    // Дымка тоже масштабируется
    if (this.scene.fog) {
      this.scene.fog.near = D * 1.8;
      this.scene.fog.far = D * 4.5;
    }
  }
}
