import * as THREE from 'three';
import type { RoomFacing, RoomMap, RoomMovement } from '@lms/contracts';
import type { RoomCanvasState } from '../../../data-access/chat-room.model';
import { facingFromVector, facingYaw, moveInRoom } from './room.motion';
import { RoomAvatar3D } from './room-avatar-3d';
import { RoomWorld3D, WORLD_SCALE } from './room-world-3d';

/** First-person rendering shares the exact map, footprint and movement protocol with Phaser. */
export class RoomFirstPerson {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.04, 70);
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  private readonly world: RoomWorld3D;
  private readonly actors = new Map<string, RoomAvatar3D>();
  private readonly keys = new Set<string>();
  private readonly resizeObserver: ResizeObserver;
  private readonly sun = new THREE.DirectionalLight(0xfff4da, 2.7);
  private readonly reducedMotion = matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  private readonly coarse = matchMedia('(pointer: coarse)').matches;
  private position: { x: number; y: number };
  private facing: RoomFacing = 'north';
  private yaw = 0;
  private pitch = -0.08;
  private touch = { x: 0, y: 0 };
  private drag?: { id: number; x: number; y: number };
  private previousView?: RoomCanvasState;
  private lastPosition = { x: -1, y: -1, facing: '' };
  private lastSent = 0;
  private previousTime = 0;
  private frame = 0;
  private active = true;

  constructor(
    private map: RoomMap,
    private mount: HTMLDivElement,
    private view: () => RoomCanvasState,
    private moved: (position: RoomMovement) => void,
    private failed: (message: string) => void,
  ) {
    this.position = { ...map.spawn };
    this.world = new RoomWorld3D(map);
    this.scene.add(this.world.root);
    this.scene.background = new THREE.Color(0xdce8df);
    this.scene.fog = new THREE.Fog(0xe6eadd, 16, 35);
    this.scene.add(new THREE.HemisphereLight(0xeaf4ff, 0xb3a68d, 2));
    this.sun.position.set(3, 8, 3);
    this.sun.castShadow = !this.coarse;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -15;
    this.sun.shadow.camera.right = 15;
    this.sun.shadow.camera.top = 15;
    this.sun.shadow.camera.bottom = -15;
    this.sun.shadow.camera.far = 30;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(
      map.width / WORLD_SCALE / 2,
      0,
      map.height / WORLD_SCALE / 2,
    );
    this.scene.add(this.sun, this.sun.target);
    this.camera.rotation.order = 'YXZ';
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.coarse ? 1.25 : 1.5),
    );
    this.renderer.shadowMap.enabled = !this.coarse;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    this.mount.appendChild(canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('mousemove', this.mouseMove);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerUp);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    document.addEventListener('pointerlockerror', this.lockError);
    this.frame = requestAnimationFrame(this.update);
  }

  setTouch(x: number, y: number): void {
    this.touch = { x, y };
  }
  private resize(): void {
    const width = Math.max(1, this.mount.clientWidth),
      height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  private readonly keyDown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if (
      !this.view().online ||
      this.view().chatting ||
      event.isComposing ||
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) ||
      target.isContentEditable
    )
      return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(event.code)
    ) {
      this.keys.add(event.code);
      event.preventDefault();
    }
  };
  private readonly keyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };
  private readonly blur = (): void => {
    this.keys.clear();
    this.touch = { x: 0, y: 0 };
    this.drag = undefined;
  };
  private readonly visibility = (): void => {
    if (document.hidden) this.blur();
    this.previousTime = 0;
  };
  private readonly mouseMove = (event: MouseEvent): void => {
    if (
      document.pointerLockElement === this.renderer.domElement &&
      this.view().online &&
      !this.view().chatting
    )
      this.look(event.movementX, event.movementY);
  };
  private readonly pointerDown = (event: PointerEvent): void => {
    if (!this.view().online || this.view().chatting) return;
    if (event.pointerType !== 'mouse') {
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.renderer.domElement.setPointerCapture(event.pointerId);
    } else if (document.pointerLockElement !== this.renderer.domElement) {
      // Pointer lock is optional: dragging still works when a browser denies capture.
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.renderer.domElement.requestPointerLock()?.catch(() => undefined);
    }
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    if (
      !this.drag ||
      this.drag.id !== event.pointerId ||
      document.pointerLockElement === this.renderer.domElement ||
      this.view().chatting
    )
      return;
    this.look(event.clientX - this.drag.x, event.clientY - this.drag.y);
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  private readonly pointerUp = (): void => {
    this.drag = undefined;
  };
  private readonly lockError = (): void => {
    this.drag = undefined;
  };
  private look(x: number, y: number): void {
    this.yaw -= x * 0.0026;
    this.pitch = THREE.MathUtils.clamp(this.pitch - y * 0.0026, -1.2, 1.2);
    this.facing = facingFromVector(
      -Math.sin(this.yaw),
      -Math.cos(this.yaw),
      this.facing,
    );
  }
  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    this.failed('Mất ngữ cảnh 3D. Hãy thử lại hoặc chuyển sang bản đồ 2D.');
  };
  private synchronize(view: RoomCanvasState): void {
    if (view === this.previousView) return;
    const previous = this.previousView;
    this.previousView = view;
    if (view.chatting || !view.online) {
      this.blur();
      if (document.pointerLockElement === this.renderer.domElement)
        document.exitPointerLock();
    }
    if (view.me !== previous?.me) {
      const self = view.players.find((player) => player.id === view.me);
      this.position = self ? { x: self.x, y: self.y } : { ...this.map.spawn };
      this.facing = self?.facing ?? 'north';
      this.yaw = facingYaw(this.facing);
      this.pitch = -0.08;
      this.lastPosition = { x: -1, y: -1, facing: '' };
    }
    if (view.correction && view.correction !== previous?.correction)
      this.position = { ...view.correction };
    const ids = new Set(
      view.players
        .filter((player) => player.id !== view.me)
        .map((player) => player.id),
    );
    this.actors.forEach((actor, id) => {
      if (!ids.has(id)) {
        actor.dispose();
        this.scene.remove(actor.root);
        this.actors.delete(id);
      }
    });
    view.players
      .filter((player) => player.id !== view.me)
      .forEach((player) => {
        let actor = this.actors.get(player.id);
        if (!actor) {
          actor = new RoomAvatar3D(this.world, player);
          this.scene.add(actor.root);
          this.actors.set(player.id, actor);
        }
        actor.target = {
          x: player.x,
          y: player.y,
          facing:
            player.facing ??
            facingFromVector(
              player.x - actor.target.x,
              player.y - actor.target.y,
              actor.target.facing,
            ),
        };
      });
  }
  private readonly update = (time: number): void => {
    if (!this.active) return;
    this.frame = requestAnimationFrame(this.update);
    const delta = this.previousTime
      ? Math.min(40, time - this.previousTime)
      : 0;
    this.previousTime = time;
    const view = this.view();
    this.synchronize(view);
    let walking = false;
    if (view.online && !view.chatting && !document.hidden) {
      const forward =
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
        this.touch.y;
      const side =
        Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) +
        this.touch.x;
      const length = Math.hypot(forward, side);
      if (length) {
        const distance = (this.map.speed * delta) / 1000;
        const dx =
          ((-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) /
            length) *
          distance;
        const dy =
          ((-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side) /
            length) *
          distance;
        const next = moveInRoom(this.map, this.position, dx, dy);
        walking =
          Math.hypot(next.x - this.position.x, next.y - this.position.y) > 0.01;
        this.position = next;
      }
      if (
        time - this.lastSent > 65 &&
        (this.position.x !== this.lastPosition.x ||
          this.position.y !== this.lastPosition.y ||
          this.facing !== this.lastPosition.facing)
      ) {
        this.moved({ ...this.position, facing: this.facing });
        this.lastSent = time;
        this.lastPosition = { ...this.position, facing: this.facing };
      }
    }
    const bob =
      walking && !this.reducedMotion ? Math.sin(time / 100) * 0.018 : 0;
    this.camera.position.set(
      this.position.x / WORLD_SCALE,
      1.6 + bob,
      this.position.y / WORLD_SCALE,
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.actors.forEach((actor, id) =>
      actor.update(delta, time, view.speech[id], this.reducedMotion),
    );
    this.renderer.render(this.scene, this.camera);
  };
  destroy(): void {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('mousemove', this.mouseMove);
    document.removeEventListener('pointerlockerror', this.lockError);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown);
    canvas.removeEventListener('pointermove', this.pointerMove);
    canvas.removeEventListener('pointerup', this.pointerUp);
    canvas.removeEventListener('pointercancel', this.pointerUp);
    canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.actors.forEach((actor) => actor.dispose());
    this.actors.clear();
    this.world.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
    this.scene.clear();
  }
}
