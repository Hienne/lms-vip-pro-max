import * as THREE from 'three';
import type { RoomMap, RoomFurniture } from '@lms/contracts';

export const WORLD_SCALE = 80;

/** Shared geometry/materials keep the procedural classroom small and avoid external assets. */
export class RoomWorld3D {
  readonly root = new THREE.Group();
  private readonly cube = new THREE.BoxGeometry(1, 1, 1);
  private readonly ball = new THREE.SphereGeometry(1, 12, 8);
  private readonly cylinder = new THREE.CylinderGeometry(1, 0.8, 1, 12);
  private readonly materials = new Map<number, THREE.MeshStandardMaterial>();
  private readonly textures: THREE.Texture[] = [];

  constructor(map: RoomMap) {
    const w = map.width / WORLD_SCALE,
      d = map.height / WORLD_SCALE;
    const floor = this.box(
      this.root,
      w / 2,
      -0.06,
      d / 2,
      w,
      0.12,
      d,
      0xf1e7d3,
    );
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const paint = canvas.getContext('2d')!;
    paint.fillStyle = '#d9c8ac';
    paint.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 5; col++) {
        paint.fillStyle = ['#e6d7bd', '#eee1cb', '#e9dbc3'][
          (col + row + 6) % 3
        ];
        paint.fillRect(col * 128 + (row % 2) * 64, row * 64, 126, 62);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    this.textures.push(texture);
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
    });
    this.materials.set(-1, floorMaterial);
    floor.material = floorMaterial;
    const left = 32 / WORLD_SCALE,
      right = w - left,
      near = 48 / WORLD_SCALE,
      far = d - 32 / WORLD_SCALE;
    const ceiling = this.box(
      this.root,
      w / 2,
      2.85,
      d / 2,
      w,
      0.1,
      d,
      0xf6f4e9,
    );
    ceiling.castShadow = false;
    ceiling.receiveShadow = false;
    ceiling.material = new THREE.MeshBasicMaterial({ color: 0xf0f3ed });
    this.box(
      this.root,
      left - 0.07,
      1.4,
      (near + far) / 2,
      0.14,
      2.8,
      far - near,
      0xf1f3e9,
    );
    this.box(
      this.root,
      right + 0.07,
      1.4,
      (near + far) / 2,
      0.14,
      2.8,
      far - near,
      0xf1f3e9,
    );
    this.box(
      this.root,
      w / 2,
      1.4,
      near - 0.07,
      right - left,
      2.8,
      0.14,
      0xe4ecdf,
    );
    this.box(
      this.root,
      w / 2,
      1.4,
      far + 0.07,
      right - left,
      2.8,
      0.14,
      0xe4ecdf,
    );
    for (const x of [left, right]) {
      this.box(
        this.root,
        x,
        0.08,
        (near + far) / 2,
        0.04,
        0.16,
        far - near,
        0x82a28a,
      );
      for (const z of [2.5, 5.1, 7.7])
        this.window(x + (x === left ? 0.035 : -0.035), z);
    }
    this.box(this.root, w / 2, 0.08, near, right - left, 0.16, 0.04, 0x82a28a);
    this.box(this.root, w / 2, 1.05, far - 0.025, 1.05, 2.1, 0.06, 0xb7c9b5);
    this.box(
      this.root,
      w / 2 - 0.36,
      1.05,
      far - 0.07,
      0.04,
      0.04,
      0.04,
      0x4d6857,
    );
    for (const object of map.objects) this.furniture(object);
    const rug = this.box(
      this.root,
      560 / WORLD_SCALE,
      0.012,
      500 / WORLD_SCALE,
      2.8,
      0.02,
      1.95,
      0xc5d6bd,
    );
    rug.receiveShadow = true;
  }

  material(color: number): THREE.MeshStandardMaterial {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      this.materials.set(color, material);
    }
    return material;
  }
  box(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.cube, this.material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  sphere(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: number,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(this.ball, this.material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private window(x: number, z: number): void {
    this.box(this.root, x, 1.7, z, 0.04, 1.25, 1.45, 0xcee7e5);
    for (const edge of [-0.75, 0.75])
      this.box(this.root, x, 1.7, z + edge, 0.08, 1.35, 0.05, 0xffffff);
    for (const y of [1.05, 2.35])
      this.box(this.root, x, y, z, 0.08, 0.05, 1.55, 0xffffff);
    this.box(this.root, x, 1.7, z, 0.08, 1.25, 0.04, 0xffffff);
  }
  private furniture(o: RoomFurniture): void {
    const group = new THREE.Group();
    group.position.set(
      (o.x + o.w / 2) / WORLD_SCALE,
      0,
      (o.y + o.h / 2) / WORLD_SCALE,
    );
    this.root.add(group);
    const w = o.w / WORLD_SCALE,
      d = o.h / WORLD_SCALE;
    if (o.kind === 'desk') {
      this.box(group, 0, 0.77, 0, w, 0.11, d, 0xd1ad7c);
      this.box(group, 0, 0.7, 0, w - 0.06, 0.06, d - 0.06, 0x9c7755);
      for (const x of [-w / 2 + 0.1, w / 2 - 0.1])
        for (const z of [-d / 2 + 0.1, d / 2 - 0.1])
          this.box(group, x, 0.35, z, 0.07, 0.7, 0.07, 0x6a786d);
      this.box(group, -0.57, 0.84, -0.02, 0.32, 0.035, 0.37, 0x699083);
      this.box(group, 0.23, 0.845, 0, 0.53, 0.028, 0.36, 0xfffbed);
      this.box(group, 0.23, 0.864, 0, 0.012, 0.01, 0.34, 0xb9bda6);
      for (let i = 0; i < 4; i++)
        this.box(
          group,
          0.12,
          0.864,
          -0.1 + i * 0.06,
          0.15,
          0.006,
          0.008,
          0xc7cbb8,
        );
      this.box(group, 0.73, 0.85, -0.03, 0.025, 0.025, 0.3, 0xaf783e);
    } else if (o.kind === 'chair') {
      this.box(group, 0, 0.44, 0, w, 0.09, d, 0x8cae91);
      this.box(group, 0, 0.73, d / 2 - 0.04, w, 0.54, 0.075, 0x789f80);
      for (const x of [-w / 2 + 0.06, w / 2 - 0.06])
        for (const z of [-d / 2 + 0.06, d / 2 - 0.06])
          this.box(group, x, 0.21, z, 0.045, 0.42, 0.045, 0x5b7566);
    } else if (o.kind === 'board') {
      this.box(group, 0, 1.65, 0, w, 1.15, 0.12, 0xb48b5d);
      this.box(group, 0, 1.65, 0.075, w - 0.12, 1.02, 0.05, 0x2e6255);
      for (const x of [-w / 2 + 0.15, w / 2 - 0.15])
        this.box(group, x, 0.52, 0, 0.07, 1.05, d, 0x788779);
      this.box(group, 0, 1.08, 0.14, w, 0.04, 0.17, 0xc4a075);
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#2e6255';
      ctx.fillRect(0, 0, 1024, 256);
      ctx.fillStyle = '#edf3e7';
      ctx.textAlign = 'center';
      ctx.font = '64px sans-serif';
      ctx.fillText('Phòng học chung', 512, 122);
      ctx.font = '25px sans-serif';
      ctx.fillText('Core Banking Academy', 512, 174);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.textures.push(texture);
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(w - 0.14, 0.98),
        material,
      );
      face.position.set(0, 1.65, 0.102);
      group.add(face);
    } else if (o.kind === 'shelf') {
      this.box(group, 0, 0.61, 0, w, 1.22, d, 0xb89368);
      this.box(group, 0, 0.67, d / 2 + 0.008, w - 0.1, 0.96, 0.02, 0x775f49);
      const colors = [0x799c89, 0xc9b780, 0xe7e0c7, 0x7595a8, 0xb78573];
      for (const y of [0.2, 0.7]) {
        this.box(group, 0, y, d / 2 + 0.035, w, 0.05, 0.18, 0xd0aa7c);
        for (let i = 0; i < 10; i++)
          this.box(
            group,
            -w / 2 + 0.12 + (i * (w - 0.15)) / 10,
            y + 0.19,
            d / 2 + 0.02,
            0.07,
            0.3 + (i % 3) * 0.03,
            0.16,
            colors[i % colors.length],
          );
      }
    } else {
      const pot = new THREE.Mesh(this.cylinder, this.material(0xc19476));
      pot.position.y = 0.2;
      pot.scale.set(0.18, 0.4, 0.18);
      pot.castShadow = true;
      group.add(pot);
      this.box(group, 0, 0.53, 0, 0.025, 0.5, 0.025, 0x5c8052);
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        this.sphere(
          group,
          Math.cos(angle) * 0.12,
          0.65 + (i % 2) * 0.12,
          Math.sin(angle) * 0.12,
          0.12,
          0.24,
          0.1,
          i % 2 ? 0x789f68 : 0x477d52,
        );
      }
    }
  }
  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((m) => materials.add(m));
      }
    });
    geometries.add(this.cube);
    geometries.add(this.ball);
    geometries.add(this.cylinder);
    geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => materials.add(m));
    materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
