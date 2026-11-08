import * as THREE from 'three';
import type { RoomFacing, RoomMap, RoomMovement } from '@lms/contracts';
import type { RoomCanvasState } from '../../../data-access/chat-room.model';
import {
  facingFromVector,
  facingYaw,
  gesturePose,
  moveInRoom,
  seatCenter,
} from './room.motion';
import { RoomAvatar3D } from './room-avatar-3d';
import { RoomWorld3D, WORLD_SCALE } from './room-world-3d';

/** The 3D view shares the map, footprint and movement protocol with Phaser. */
export class RoomOrbit {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(47, 1, 0.04, 70);
  private readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  private readonly world: RoomWorld3D;
  private readonly actors = new Map<string, RoomAvatar3D>();
  private readonly raycaster = new THREE.Raycaster();
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
  private elevation = 0.65;
  private portrait = false;
  private touch = { x: 0, y: 0 };
  private drag?: { id: number; x: number; y: number };
  private previousView?: RoomCanvasState;
  private lastPosition = { x: -1, y: -1, facing: '' };
  private lastSent = 0;
  private previousTime = 0;
  private frame = 0;
  private active = true;
  private seat?: number;

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
    this.scene.fog = new THREE.Fog(0xe6eadd, 22, 42);
    this.scene.add(new THREE.HemisphereLight(0xeaf4ff, 0xb3a68d, 2));
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
    this.sun.position
      .copy(this.sun.target.position)
      .add(new THREE.Vector3(-3, 12, -4));
    this.scene.add(this.sun, this.sun.target);
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
    canvas.style.cursor = 'grab';
    canvas.setAttribute('aria-hidden', 'true');
    this.mount.appendChild(canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(mount);
    this.resize();
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('visibilitychange', this.visibility);
    canvas.addEventListener('pointerdown', this.pointerDown);
    canvas.addEventListener('pointermove', this.pointerMove);
    canvas.addEventListener('pointerup', this.pointerUp);
    canvas.addEventListener('pointercancel', this.pointerUp);
    canvas.addEventListener('lostpointercapture', this.pointerUp);
    canvas.addEventListener('webglcontextlost', this.contextLost);
    this.frame = requestAnimationFrame(this.update);
  }

  setTouch(x: number, y: number): void {
    this.touch = { x, y };
  }

  chairAt(clientX: number, clientY: number): number | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) * 2) / rect.width - 1,
        1 - ((clientY - rect.top) * 2) / rect.height,
      ),
      this.camera,
    );
    for (const hit of this.raycaster.intersectObject(this.world.root, true)) {
      let chair: number | undefined;
      let visible = true;
      for (
        let object: THREE.Object3D | null = hit.object;
        object;
        object = object.parent
      ) {
        visible &&= object.visible;
        if (typeof object.userData['chair'] === 'number')
          chair = object.userData['chair'];
      }
      if (visible) return chair;
    }
    return undefined;
  }

  setPortrait(portrait: boolean): void {
    this.portrait = portrait;
    this.yaw = facingYaw(this.facing) + (portrait ? Math.PI : 0);
    this.elevation = portrait ? 0.23 : 0.65;
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
    this.renderer.domElement.style.cursor = 'grab';
  };
  private readonly visibility = (): void => {
    if (document.hidden) this.blur();
    this.previousTime = 0;
  };
  private readonly pointerDown = (event: PointerEvent): void => {
    if (this.view().chatting || this.drag || event.button !== 0) return;
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.renderer.domElement.style.cursor = 'grabbing';
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    if (!this.drag || this.drag.id !== event.pointerId || this.view().chatting)
      return;
    this.yaw -= (event.clientX - this.drag.x) * 0.007;
    this.elevation = THREE.MathUtils.clamp(
      this.elevation + (event.clientY - this.drag.y) * 0.005,
      0.12,
      1.12,
    );
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  private readonly pointerUp = (event: PointerEvent): void => {
    if (this.drag?.id !== event.pointerId) return;
    this.drag = undefined;
    this.renderer.domElement.style.cursor = 'grab';
  };
  private readonly contextLost = (event: Event): void => {
    event.preventDefault();
    this.failed('Mất ngữ cảnh 3D. Hãy thử lại hoặc chuyển sang bản đồ 2D.');
  };
  private synchronize(view: RoomCanvasState): void {
    if (view === this.previousView) return;
    const previous = this.previousView;
    this.previousView = view;
    if (view.dice !== previous?.dice) this.world.showDice(view.dice?.dice);
    if (view.chatting || (previous?.online && !view.online)) {
      this.blur();
    }
    const self = view.players.find((player) => player.id === view.me);
    if (view.me !== previous?.me || this.seat !== self?.seat) {
      this.seat = self?.seat;
      this.position = self ? { x: self.x, y: self.y } : { ...this.map.spawn };
      this.facing = self?.facing ?? 'north';
      if (view.me !== previous?.me) this.setPortrait(this.portrait);
      this.lastPosition = { x: -1, y: -1, facing: '' };
    }
    if (view.correction && view.correction !== previous?.correction)
      this.position = { ...view.correction };
    const ids = new Set(view.players.map((player) => player.id));
    this.actors.forEach((actor, id) => {
      if (!ids.has(id)) {
        actor.dispose();
        this.scene.remove(actor.root);
        this.actors.delete(id);
      }
    });
    view.players.forEach((player) => {
      let actor = this.actors.get(player.id);
      if (!actor) {
        actor = new RoomAvatar3D(this.world, player, player.id === view.me);
        this.scene.add(actor.root);
        this.actors.set(player.id, actor);
      }
      const seat = seatCenter(this.map, player.seat);
      actor.seated = !!seat;
      if (player.id === view.me && !seat) return;
      actor.target = {
        x: seat?.x ?? player.x,
        y: seat?.y ?? player.y,
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
    const now = performance.now();
    const localPose = gesturePose(
      view.gestures[view.me],
      now,
      this.reducedMotion,
    );
    let walking = false;
    if (
      view.online &&
      !view.chatting &&
      !document.hidden &&
      this.seat === undefined &&
      !localPose.highFive
    ) {
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
        this.facing = facingFromVector(dx, dy, this.facing);
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
    const self = this.actors.get(view.me);
    if (self && !self.seated)
      self.target = { ...this.position, facing: this.facing };
    this.actors.forEach((actor, id) =>
      actor.update(
        delta,
        time,
        view.speech[id],
        this.reducedMotion,
        id === view.me
          ? localPose
          : gesturePose(view.gestures[id], now, this.reducedMotion),
        id === view.me ? walking : undefined,
      ),
    );
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
  };

  private placeCamera(): void {
    const x = this.position.x / WORLD_SCALE;
    const z = this.position.y / WORLD_SCALE;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const radius = this.portrait ? 2.25 : 7.8;
    const horizontal = radius * Math.cos(this.elevation);
    const ahead = this.portrait ? 0 : 2.9;
    this.camera.position.set(
      x + sin * horizontal,
      (this.portrait ? 0.68 : 1.12) + radius * Math.sin(this.elevation),
      z + cos * horizontal,
    );
    this.camera.lookAt(
      x - sin * ahead,
      this.portrait ? 0.56 : 1.04,
      z - cos * ahead,
    );
    this.world.showInterior(this.camera.position);
  }
  destroy(): void {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('visibilitychange', this.visibility);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown);
    canvas.removeEventListener('pointermove', this.pointerMove);
    canvas.removeEventListener('pointerup', this.pointerUp);
    canvas.removeEventListener('pointercancel', this.pointerUp);
    canvas.removeEventListener('lostpointercapture', this.pointerUp);
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
