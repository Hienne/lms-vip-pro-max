import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { FlowKind, FlowObject, FlowStep } from '@lms/contracts';
import { FLOW_KIND_FAMILY } from './flow-support';

/** What the scene tells its host; the host owns the document and decides what changes. */
export interface FlowSceneEvents {
  readonly select: (id: string | null) => void;
  readonly move: (id: string, x: number, z: number) => void;
  /** A drag from one Đối tượng's port; `to` null = released back on itself (works on its own). */
  readonly link: (from: string, to: string | null) => void;
}

export type FlowSceneMode = 'author' | 'learner';

/**
 * The Mô phỏng luồng scene: Đối tượng on rounded plinths over a grid floor, cables derived from the
 * Bước chuyển, and a packet that rides the cable of the active step. Colours come from the token
 * custom properties: the chart palette for the family of each kind (the shape tells the kind),
 * `accent` for the packet, `primary` for what is active.
 *
 * Loaded on demand (dynamic import), so three.js stays out of every other chunk.
 */
export class FlowScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
  private readonly controls: OrbitControls;
  private readonly entries = new Map<string, Entry>();
  private readonly cables = new THREE.Group();
  private readonly packet = new THREE.Group();
  private readonly trail: THREE.Mesh;
  private readonly orbit: THREE.Mesh;
  private readonly rubber: THREE.Mesh;
  private readonly raycaster = new THREE.Raycaster();
  private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly resize: ResizeObserver;
  private readonly visibility: IntersectionObserver;
  private readonly font =
    getComputedStyle(document.body).fontFamily || 'sans-serif';
  private cableKey = '';
  private readonly colors = readColors();
  private mode: FlowSceneMode = 'learner';
  private reducedMotion = false;
  private visible = true;
  private active: FlowStep | null = null;
  private activeSince = 0;
  private selectedId: string | null = null;
  private hoverId: string | null = null;
  private steps: readonly FlowStep[] = [];
  private drag: Drag | null = null;
  private linking: { from: string; target: string | null } | null = null;
  private pointerDown: { x: number; y: number } | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly events: FlowSceneEvents,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Shadows are redrawn only when something on the floor moves (setData, a drag), not each frame.
    this.renderer.shadowMap.autoUpdate = false;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      touchAction: 'none',
    });
    host.appendChild(canvas);

    this.scene.background = new THREE.Color(this.colors.bg);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, this.colors.grid, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-10, 22, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 3;
    sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, {
      left: -26,
      right: 26,
      top: 26,
      bottom: -26,
    });
    this.scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: this.colors.bg, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(
      120,
      120,
      this.colors.grid,
      this.colors.grid,
    );
    grid.position.y = 0.002;
    this.scene.add(grid);
    this.scene.add(this.cables);

    const glow = new THREE.MeshStandardMaterial({
      color: this.colors.packet,
      emissive: this.colors.packet,
      emissiveIntensity: 1.1,
      roughness: 0.3,
    });
    const capsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.34, 8, 20),
      glow,
    );
    capsule.rotation.z = Math.PI / 2;
    capsule.castShadow = false;
    this.packet.add(capsule);
    this.packet.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 24, 16),
        new THREE.MeshBasicMaterial({
          color: this.colors.packet,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        }),
      ),
    );
    this.packet.visible = false;
    this.scene.add(this.packet);
    this.trail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 1, 16),
      glow.clone(),
    );
    this.trail.visible = false;
    this.scene.add(this.trail);
    this.orbit = new THREE.Mesh(
      new THREE.TorusGeometry(EDGE + 0.05, 0.035, 12, 96),
      new THREE.MeshStandardMaterial({
        color: this.colors.active,
        emissive: this.colors.active,
        emissiveIntensity: 0.4,
      }),
    );
    this.orbit.rotation.x = Math.PI / 2;
    this.orbit.visible = false;
    this.scene.add(this.orbit);
    this.rubber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1, 12),
      new THREE.MeshBasicMaterial({
        color: this.colors.active,
        transparent: true,
        opacity: 0.75,
      }),
    );
    this.rubber.visible = false;
    this.scene.add(this.rubber);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = 1.3;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 90;
    this.applyMode();

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onPointerLeave);

    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(host);
    this.visibility = new IntersectionObserver(([entry]) => {
      this.visible = entry?.isIntersecting ?? true;
      this.renderer.setAnimationLoop(this.visible ? (t) => this.tick(t) : null);
    });
    this.visibility.observe(host);
    this.onResize();
  }

  setMode(mode: FlowSceneMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.applyMode();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setData(
    objects: readonly FlowObject[],
    steps: readonly FlowStep[],
    selectedId: string | null,
  ): void {
    this.steps = steps;
    this.selectedId = selectedId;
    const ids = new Set(objects.map((o) => o.id));
    for (const [id, entry] of this.entries) {
      if (!ids.has(id)) {
        this.scene.remove(entry.group);
        disposeTree(entry.group);
        this.entries.delete(id);
      }
    }
    for (const o of objects) {
      let entry = this.entries.get(o.id);
      if (!entry || entry.kind !== o.kind) {
        if (entry) {
          this.scene.remove(entry.group);
          disposeTree(entry.group);
        }
        entry = this.build(o);
        this.entries.set(o.id, entry);
        this.scene.add(entry.group);
      }
      if (entry.name !== o.name) this.setLabel(entry, o.name);
      if (this.drag?.id !== o.id) entry.group.position.set(o.x, 0, o.z);
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.rebuildCables();
  }

  /** Only the selection ring changes; nothing to rebuild. */
  setSelected(selectedId: string | null): void {
    this.selectedId = selectedId;
  }

  setActive(step: FlowStep | null): void {
    if (step?.id !== this.active?.id) this.activeSince = performance.now();
    this.active = step;
    this.rebuildCables();
  }

  /** The floor cell under a screen point. */
  floorAt(clientX: number, clientY: number): { x: number; z: number } | null {
    const hit = this.floorHit(clientX, clientY);
    return hit ? { x: Math.round(hit.x), z: Math.round(hit.z) } : null;
  }

  /** Frames every Đối tượng from the isometric angle. */
  fit(): void {
    const box = new THREE.Box3();
    for (const e of this.entries.values()) box.expandByObject(e.body);
    if (box.isEmpty())
      box.set(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 2, 4));
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, 6) * 0.6 + 2;
    const fov = (this.camera.fov * Math.PI) / 180;
    const aspect = Math.max(this.camera.aspect, 0.6);
    const distance = (radius / Math.sin(fov / 2) / Math.min(aspect, 1.4)) * 0.9;
    this.controls.target.copy(center).setY(0);
    this.camera.position
      .copy(this.controls.target)
      .addScaledVector(new THREE.Vector3(1, 1.05, 1.2).normalize(), distance);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resize.disconnect();
    this.visibility.disconnect();
    this.controls.dispose();
    this.scene.environment?.dispose();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointerleave', this.onPointerLeave);
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  // ---------------------------------------------------------------------------------------------

  private applyMode(): void {
    const author = this.mode === 'author';
    this.controls.enableRotate = !author;
    this.controls.mouseButtons = author
      ? {
          LEFT: THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }
      : {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        };
  }

  private tick(now: number): void {
    const t = this.reducedMotion ? 0 : (now - this.activeSince) / 1000;
    const a = this.active;
    const from = a ? this.entries.get(a.from) : undefined;
    const to = a?.to ? this.entries.get(a.to) : undefined;
    const author = this.mode === 'author';

    for (const [id, e] of this.entries) {
      const involved = !!a && (id === a.from || id === a.to);
      const dim = !!a && !involved;
      const target = this.linking?.target === id && this.linking.from !== id;
      const glow = target
        ? 0.3
        : involved
          ? 0.2
          : author && this.hoverId === id
            ? 0.08
            : 0;
      for (const m of e.materials) {
        m.emissiveIntensity = glow;
        m.opacity = dim ? DIM : 1;
        m.transparent = dim;
      }
      (e.label.material as THREE.SpriteMaterial).opacity = dim ? 0.5 : 1;
      e.ring.visible = author && id === this.selectedId;
      e.port.visible =
        author &&
        !this.drag &&
        (id === this.hoverId ||
          id === this.selectedId ||
          this.linking?.from === id);
      e.body.position.y =
        involved && !this.reducedMotion ? 0.04 + 0.03 * Math.sin(t * 5) : 0;
    }

    this.packet.visible = false;
    this.trail.visible = false;
    this.orbit.visible = false;
    if (from && to && !this.reducedMotion) {
      const [s, e] = this.ends(from.group.position, to.group.position);
      const length = s.distanceTo(e);
      const travel = Math.max(0.9, length / 4.5);
      const p = Math.min((t % (travel + 0.45)) / travel, 1);
      const ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      if (p < 1) {
        const at = s.clone().lerp(e, ease);
        this.packet.position.copy(at).setY(CABLE_Y + 0.05);
        this.packet.rotation.y = -Math.atan2(e.z - s.z, e.x - s.x);
        this.packet.visible = true;
        const tail = s
          .clone()
          .lerp(e, Math.max(0, ease - Math.min(0.35, 1.6 / length)));
        this.span(this.trail, tail.setY(CABLE_Y), at.clone().setY(CABLE_Y));
      }
    } else if (from && !a?.to) {
      const c = from.group.position;
      this.orbit.position.set(c.x, CABLE_Y, c.z);
      this.orbit.visible = true;
      if (!this.reducedMotion) {
        const angle = t * 2.4;
        this.packet.position.set(
          c.x + Math.cos(angle) * (EDGE + 0.05),
          CABLE_Y + 0.05,
          c.z + Math.sin(angle) * (EDGE + 0.05),
        );
        this.packet.rotation.y = -angle - Math.PI / 2;
        this.packet.visible = true;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** The cable ends between two Đối tượng, at the plinth edges. */
  private ends(
    a: THREE.Vector3,
    b: THREE.Vector3,
  ): [THREE.Vector3, THREE.Vector3] {
    const dir = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    const length = dir.length();
    dir.normalize();
    const cut = Math.min(EDGE, length / 2 - 0.05);
    return [
      new THREE.Vector3(a.x, CABLE_Y, a.z).addScaledVector(dir, cut),
      new THREE.Vector3(b.x, CABLE_Y, b.z).addScaledVector(dir, -cut),
    ];
  }

  /** Stretches a unit-height Y cylinder between two points. */
  private span(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    const length = a.distanceTo(b);
    mesh.visible = length > 0.01;
    if (!mesh.visible) return;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, length, 1);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
  }

  /** One cable per unordered pair that at least one Bước chuyển uses. */
  private rebuildCables(): void {
    const activeKey = this.active?.to
      ? pairKey(this.active.from, this.active.to)
      : null;
    // Skips the rebuild when neither the cables, their ends nor the active pair changed.
    const signature = [
      activeKey,
      ...this.steps.map((st) => `${st.from}>${st.to}`),
      ...[...this.entries].map(
        ([id, e]) => `${id}@${e.group.position.x},${e.group.position.z}`,
      ),
    ].join(';');
    if (signature === this.cableKey) return;
    this.cableKey = signature;
    disposeTree(this.cables);
    this.cables.clear();
    const seen = new Set<string>();
    for (const step of this.steps) {
      if (!step.to || step.to === step.from) continue;
      const key = pairKey(step.from, step.to);
      if (seen.has(key)) continue;
      seen.add(key);
      const a = this.entries.get(step.from)?.group.position;
      const b = this.entries.get(step.to)?.group.position;
      if (!a || !b) continue;
      const color = key === activeKey ? this.colors.active : this.colors.cable;
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: key === activeKey ? 0.35 : 0,
        roughness: 0.4,
      });
      const [s, e] = this.ends(a, b);
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1, 16),
        material,
      );
      cable.castShadow = true;
      this.span(cable, s, e);
      this.cables.add(cable);
      for (const end of [s, e]) {
        const plug = new THREE.Mesh(
          new THREE.SphereGeometry(0.1, 16, 12),
          material.clone(),
        );
        plug.position.copy(end);
        this.cables.add(plug);
      }
    }
  }

  private build(o: FlowObject): Entry {
    const group = new THREE.Group();
    group.userData['id'] = o.id;
    const body = new THREE.Group();
    group.add(body);
    const materials: THREE.MeshStandardMaterial[] = [];
    const family = new THREE.Color(
      this.colors.family[FLOW_KIND_FAMILY[o.kind]],
    );
    const make = (color: THREE.ColorRepresentation, roughness = 0.4) => {
      const m = new THREE.MeshStandardMaterial({
        color,
        emissive: family,
        roughness,
      });
      materials.push(m);
      return m;
    };
    const tone = () => make(family, 0.38);
    const white = () => make(this.colors.surface, 0.5);
    const dark = () => make(this.colors.ink, 0.2);
    const add = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
    ) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      body.add(mesh);
      return mesh;
    };

    // Every Đối tượng stands on the same plinth, with a hairline edge in the border colour.
    add(rbox(PLINTH, 0.16, PLINTH, 0.08), white(), 0, 0.08, 0);
    add(
      rbox(PLINTH + 0.04, 0.02, PLINTH + 0.04, 0.01),
      make(this.colors.border, 0.8),
      0,
      0.01,
      0,
    );
    const top = MODELS[o.kind]({ add, tone, white, dark, family });

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(EDGE + 0.02, EDGE + 0.14, 64),
      new THREE.MeshBasicMaterial({ color: this.colors.active }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    ring.visible = false;
    group.add(ring);

    const port = new THREE.Group();
    port.userData['port'] = o.id;
    port.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 12),
        new THREE.MeshBasicMaterial({ visible: false }),
      ),
      new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 24, 16),
        new THREE.MeshStandardMaterial({
          color: this.colors.active,
          emissive: this.colors.active,
          emissiveIntensity: 0.5,
        }),
      ),
      new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.03, 10, 40),
        new THREE.MeshBasicMaterial({ color: this.colors.surface }),
      ),
    );
    port.position.set(EDGE - 0.05, 0.42, EDGE - 0.05);
    port.visible = false;
    group.add(port);

    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ depthTest: false, transparent: true }),
    );
    label.center.set(0.5, 0);
    label.position.y = top + 0.25;
    label.renderOrder = 10;
    group.add(label);

    const entry: Entry = {
      group,
      body,
      label,
      ring,
      port,
      materials,
      kind: o.kind,
      name: '',
    };
    this.setLabel(entry, o.name);
    return entry;
  }

  /** A pill drawn at 3× so the name stays sharp; text goes through `fillText`, never parsed. */
  private setLabel(entry: Entry, name: string): void {
    entry.name = name;
    const text = name || '(chưa đặt tên)';
    const scale = 3;
    const px = 15 * scale;
    const padX = 12 * scale;
    const padY = 8 * scale;
    const shadow = 6 * scale;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const font = `600 ${px}px ${this.font}`;
    ctx.font = font;
    // A name of very wide glyphs must not make a huge texture: cap the width, end with "…".
    const maxText = 300 * scale;
    let shown = text;
    while (shown.length > 1 && ctx.measureText(shown).width > maxText) {
      shown = shown.slice(0, -2) + '…';
    }
    const w = Math.ceil(ctx.measureText(shown).width) + padX * 2;
    const h = px + padY * 2;
    canvas.width = w + shadow * 2;
    canvas.height = h + shadow * 2;
    ctx.font = font;
    ctx.shadowColor = this.colors.shadow;
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = 2 * scale;
    ctx.fillStyle = this.colors.surface;
    ctx.beginPath();
    ctx.roundRect(shadow, shadow, w, h, h / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = scale;
    ctx.stroke();
    ctx.fillStyle = this.colors.text;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(shown, shadow + w / 2, shadow + h / 2 + scale);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = entry.label.material as THREE.SpriteMaterial;
    material.map?.dispose();
    material.map = texture;
    material.needsUpdate = true;
    const worldH = 0.62 * (canvas.height / h);
    entry.label.scale.set((canvas.width / canvas.height) * worldH, worldH, 1);
  }

  private onResize(): void {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private ndc(clientX: number, clientY: number): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
  }

  private floorHit(clientX: number, clientY: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    return this.raycaster.ray.intersectPlane(
      this.floorPlane,
      new THREE.Vector3(),
    );
  }

  /** What is under the pointer: a shown port first, then a body. */
  private pick(
    clientX: number,
    clientY: number,
  ): { id: string; port: boolean } | null {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const ports = [...this.entries.values()]
      .filter((e) => e.port.visible)
      .map((e) => e.port);
    const portHit = this.raycaster.intersectObjects(ports, true)[0];
    const portId = portHit ? ownerId(portHit.object, 'port') : null;
    if (portId) return { id: portId, port: true };
    const bodies = [...this.entries.values()].map((e) => e.body);
    const hit = this.raycaster.intersectObjects(bodies, true)[0];
    const id = hit ? ownerId(hit.object, 'id') : null;
    return id ? { id, port: false } : null;
  }

  private readonly onPointerDown = (ev: PointerEvent) => {
    this.pointerDown = { x: ev.clientX, y: ev.clientY };
    if (this.mode !== 'author' || ev.button !== 0) return;
    const hit = this.pick(ev.clientX, ev.clientY);
    if (!hit) return;
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(ev.pointerId);
    if (hit.port) {
      this.linking = { from: hit.id, target: null };
      return;
    }
    const start = this.entries.get(hit.id)?.group.position;
    this.drag = {
      id: hit.id,
      moved: false,
      x: ev.clientX,
      y: ev.clientY,
      cell: start ? { x: start.x, z: start.z } : null,
    };
    this.events.select(hit.id);
  };

  private readonly onPointerMove = (ev: PointerEvent) => {
    const canvas = this.renderer.domElement;
    if (this.linking) {
      const from = this.entries.get(this.linking.from);
      const hit = this.pick(ev.clientX, ev.clientY);
      this.linking.target = hit && !hit.port ? hit.id : null;
      const target = this.linking.target
        ? this.entries.get(this.linking.target)
        : undefined;
      if (from) {
        const start = from.port.getWorldPosition(new THREE.Vector3());
        const floor = this.floorHit(ev.clientX, ev.clientY);
        const end =
          target && this.linking.target !== this.linking.from
            ? this.ends(from.group.position, target.group.position)[1]
            : (floor?.setY(CABLE_Y) ?? start);
        this.span(this.rubber, start, end);
      }
      canvas.style.cursor = 'crosshair';
      return;
    }
    if (!this.drag) {
      if (this.mode !== 'author') return;
      const hit = this.pick(ev.clientX, ev.clientY);
      this.hoverId = hit?.id ?? (this.nearHovered(ev) ? this.hoverId : null);
      canvas.style.cursor = hit?.port ? 'crosshair' : hit ? 'grab' : '';
      return;
    }
    canvas.style.cursor = 'grabbing';
    if (Math.hypot(ev.clientX - this.drag.x, ev.clientY - this.drag.y) > 4)
      this.drag.moved = true;
    const cell = this.floorAt(ev.clientX, ev.clientY);
    const entry = this.entries.get(this.drag.id);
    const p = entry?.group.position;
    if (
      cell &&
      p &&
      (cell.x !== p.x || cell.z !== p.z) &&
      !this.occupied(cell, this.drag.id)
    ) {
      p.set(cell.x, 0, cell.z);
      this.renderer.shadowMap.needsUpdate = true;
      this.rebuildCables();
    }
  };

  private readonly onPointerUp = (ev: PointerEvent) => {
    this.controls.enabled = true;
    const link = this.linking;
    if (link) {
      this.linking = null;
      this.rubber.visible = false;
      if (link.target)
        this.events.link(
          link.from,
          link.target === link.from ? null : link.target,
        );
      return;
    }
    const drag = this.drag;
    this.drag = null;
    if (drag) {
      const p = this.entries.get(drag.id)?.group.position;
      if (drag.moved && p && (p.x !== drag.cell?.x || p.z !== drag.cell?.z)) {
        this.events.move(drag.id, p.x, p.z);
      }
      return;
    }
    const down = this.pointerDown;
    if (
      this.mode === 'author' &&
      down &&
      Math.hypot(ev.clientX - down.x, ev.clientY - down.y) < 4
    ) {
      this.events.select(null);
    }
  };

  private readonly onPointerLeave = () => {
    if (!this.drag && !this.linking) this.hoverId = null;
  };

  /** Keeps the port shown while the pointer travels from the body to it. */
  private nearHovered(ev: PointerEvent): boolean {
    const e = this.hoverId ? this.entries.get(this.hoverId) : undefined;
    const p = e ? this.floorHit(ev.clientX, ev.clientY) : null;
    return (
      !!e &&
      !!p &&
      Math.hypot(p.x - e.group.position.x, p.z - e.group.position.z) < PLINTH
    );
  }

  private occupied(cell: { x: number; z: number }, except: string): boolean {
    for (const [id, e] of this.entries) {
      if (
        id !== except &&
        e.group.position.x === cell.x &&
        e.group.position.z === cell.z
      )
        return true;
    }
    return false;
  }
}

// -----------------------------------------------------------------------------------------------

interface Entry {
  readonly group: THREE.Group;
  readonly body: THREE.Group;
  readonly label: THREE.Sprite;
  readonly ring: THREE.Mesh;
  readonly port: THREE.Group;
  readonly materials: THREE.MeshStandardMaterial[];
  readonly kind: FlowKind;
  name: string;
}

interface Drag {
  readonly id: string;
  moved: boolean;
  readonly x: number;
  readonly y: number;
  readonly cell: { x: number; z: number } | null;
}

interface Kit {
  add(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x?: number,
    y?: number,
    z?: number,
  ): THREE.Mesh;
  tone(): THREE.Material;
  white(): THREE.Material;
  dark(): THREE.Material;
  readonly family: THREE.Color;
}

const PLINTH = 1.7;
const EDGE = PLINTH / 2 + 0.1;
const CABLE_Y = 0.12;
const DIM = 0.35;
const B = 0.16; // top of the plinth

const rbox = (w: number, h: number, d: number, r = 0.06) =>
  new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) - 0.001);

/** Each kind's model on the plinth; returns the height of its top, where the label sits. */
const MODELS: Record<FlowKind, (kit: Kit) => number> = {
  customer: ({ add, tone, white }) => {
    add(new THREE.CapsuleGeometry(0.3, 0.42, 8, 24), tone(), 0, B + 0.52, 0);
    add(new THREE.SphereGeometry(0.24, 32, 24), white(), 0, B + 1.18, 0);
    return B + 1.45;
  },
  staff: ({ add, tone, white, dark }) => {
    add(new THREE.CapsuleGeometry(0.3, 0.42, 8, 24), tone(), 0, B + 0.52, -0.1);
    add(new THREE.SphereGeometry(0.24, 32, 24), white(), 0, B + 1.18, -0.1);
    add(rbox(1.2, 0.5, 0.42, 0.06), white(), 0, B + 0.25, 0.48);
    add(rbox(0.34, 0.24, 0.03, 0.01), dark(), 0.2, B + 0.62, 0.42).rotation.x =
      -0.35;
    return B + 1.45;
  },
  channel: ({ add, tone, white, dark }) => {
    add(rbox(0.72, 1.3, 0.14, 0.1), tone(), 0, B + 0.75, 0).rotation.x = -0.12;
    add(rbox(0.6, 1.08, 0.02, 0.06), dark(), 0, B + 0.77, 0.07).rotation.x =
      -0.12;
    add(rbox(0.5, 0.08, 0.5, 0.03), white(), 0, B + 0.04, -0.02);
    return B + 1.45;
  },
  system: ({ add, tone, dark, family }) => {
    add(rbox(1.0, 1.7, 0.9, 0.08), tone(), 0, B + 0.85, 0);
    const led = new THREE.MeshStandardMaterial({
      color: family,
      emissive: family,
      emissiveIntensity: 0.8,
    });
    for (let i = 0; i < 4; i++) {
      add(rbox(0.82, 0.26, 0.02, 0.02), dark(), 0, B + 0.3 + i * 0.38, 0.455);
      add(
        new THREE.SphereGeometry(0.035, 12, 8),
        led,
        0.3,
        B + 0.3 + i * 0.38,
        0.475,
      );
    }
    return B + 1.75;
  },
  database: ({ add, tone, white }) => {
    for (let i = 0; i < 3; i++) {
      add(
        new THREE.CylinderGeometry(0.6, 0.6, 0.36, 48),
        tone(),
        0,
        B + 0.2 + i * 0.42,
        0,
      );
      add(
        new THREE.CylinderGeometry(0.605, 0.605, 0.05, 48),
        white(),
        0,
        B + 0.41 + i * 0.42,
        0,
      );
    }
    return B + 1.35;
  },
  queue: ({ add, tone, white }) => {
    add(rbox(1.5, 0.08, 0.62, 0.04), white(), 0, B + 0.04, 0);
    for (let i = 0; i < 3; i++)
      add(rbox(0.38, 0.38, 0.38, 0.06), tone(), -0.46 + i * 0.46, B + 0.27, 0);
    return B + 0.6;
  },
  gateway: ({ add, tone, white }) => {
    add(
      new THREE.CylinderGeometry(0.72, 0.78, 0.36, 6),
      tone(),
      0,
      B + 0.18,
      0,
    );
    add(
      new THREE.CylinderGeometry(0.5, 0.56, 0.36, 6),
      white(),
      0,
      B + 0.54,
      0,
    );
    add(new THREE.CylinderGeometry(0.3, 0.34, 0.3, 6), tone(), 0, B + 0.87, 0);
    return B + 1.05;
  },
  document: ({ add, tone, white }) => {
    for (let i = 0; i < 3; i++) {
      add(
        rbox(0.8, 0.05, 1.0, 0.02),
        i === 2 ? tone() : white(),
        0,
        B + 0.04 + i * 0.07,
        0,
      ).rotation.y = (i - 1) * 0.12;
    }
    add(
      new THREE.CylinderGeometry(0.14, 0.14, 0.04, 32),
      white(),
      0.18,
      B + 0.23,
      0.25,
    );
    return B + 0.45;
  },
  external: ({ add, tone, white }) => {
    add(new THREE.SphereGeometry(0.55, 48, 32), tone(), 0, B + 0.7, 0);
    add(
      new THREE.TorusGeometry(0.72, 0.035, 12, 96),
      white(),
      0,
      B + 0.7,
      0,
    ).rotation.x = Math.PI / 2 - 0.35;
    add(
      new THREE.TorusGeometry(0.72, 0.035, 12, 96),
      white(),
      0,
      B + 0.7,
      0,
    ).rotation.set(Math.PI / 2 + 0.35, 0.6, 0);
    add(
      new THREE.CylinderGeometry(0.1, 0.22, 0.16, 24),
      white(),
      0,
      B + 0.08,
      0,
    );
    return B + 1.35;
  },
  decision: ({ add, tone, white }) => {
    add(
      new THREE.CylinderGeometry(0.08, 0.22, 0.3, 24),
      white(),
      0,
      B + 0.15,
      0,
    );
    const diamond = add(
      new THREE.OctahedronGeometry(0.58, 0),
      tone(),
      0,
      B + 0.85,
      0,
    );
    diamond.scale.set(1, 1.2, 1);
    diamond.rotation.y = Math.PI / 4;
    return B + 1.55;
  },
};

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function ownerId(object: THREE.Object3D, key: 'id' | 'port'): string | null {
  let o: THREE.Object3D | null = object;
  while (o && !o.userData[key]) o = o.parent;
  return (o?.userData[key] as string | undefined) ?? null;
}

function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      o.geometry.dispose();
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of materials as (THREE.Material & {
        map?: THREE.Texture | null;
      })[]) {
        m.map?.dispose();
        m.dispose();
      }
    }
  });
}

/** The token colours, read once from the custom properties the `ui` Sass module emits. */
function readColors() {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) =>
    style.getPropertyValue(`--color-${name}`).trim();
  return {
    bg: token('bg'),
    surface: token('surface'),
    border: token('border'),
    grid: token('chart-grid') || token('border'),
    cable: token('border-strong'),
    active: token('primary'),
    packet: token('primary'),
    text: token('text'),
    ink: token('text'),
    shadow: token('overlay'),
    family: {
      1: token('chart-1'),
      2: token('chart-2'),
      3: token('chart-3'),
      4: token('chart-4'),
      5: token('chart-5'),
    },
  };
}
