import * as THREE from 'three';
import type { RoomArea, RoomMap, RoomFurniture } from '@lms/contracts';
import { inRoomArea } from '../../../data-access/chat-room.model';

export const WORLD_SCALE = 80;
export const CHAIR_SEAT_TOP = 0.485;

/** Shared geometry/materials keep the procedural classroom small and avoid external assets. */
export class RoomWorld3D {
  readonly root = new THREE.Group();
  private readonly cube = new THREE.BoxGeometry(1, 1, 1);
  private readonly ball = new THREE.SphereGeometry(1, 24, 16);
  private readonly robe = new THREE.LatheGeometry(
    [
      [0, 0.22],
      [0.26, 0.22],
      [0.35, 0.25],
      [0.375, 0.3],
      [0.367, 0.36],
      [0.306, 0.55],
      [0.285, 0.65],
      [0.308, 0.83],
      [0.285, 0.94],
      [0.23, 1.02],
      [0.155, 1.07],
      [0, 1.07],
    ].map(([radius, height]) => new THREE.Vector2(radius, height)),
    24,
  );
  private readonly jacket = new THREE.LatheGeometry(
    [
      [0, 0.47],
      [0.25, 0.47],
      [0.29, 0.52],
      [0.295, 0.68],
      [0.34, 0.86],
      [0.31, 0.96],
      [0.21, 1.04],
      [0.14, 1.07],
      [0, 1.07],
    ].map(([radius, height]) => new THREE.Vector2(radius, height)),
    24,
  );
  private readonly cylinder = new THREE.CylinderGeometry(1, 0.8, 1, 12);
  private readonly materials = new Map<number, THREE.MeshStandardMaterial>();
  private readonly textures: THREE.Texture[] = [];
  private readonly dicePips: THREE.Mesh[][] = [];
  private readonly walls = {
    left: new THREE.Group(),
    right: new THREE.Group(),
    north: new THREE.Group(),
    south: new THREE.Group(),
  };

  constructor(private map: RoomMap) {
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
    texture.repeat.set(w / 4.65, d / 4.75);
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
    this.root.add(...Object.values(this.walls));
    this.box(
      this.walls.left,
      left - 0.07,
      1.4,
      (near + far) / 2,
      0.14,
      2.8,
      far - near,
      0xf1f3e9,
    );
    this.box(
      this.walls.right,
      right + 0.07,
      1.4,
      (near + far) / 2,
      0.14,
      2.8,
      far - near,
      0xf1f3e9,
    );
    this.box(
      this.walls.north,
      w / 2,
      1.4,
      near - 0.07,
      right - left,
      2.8,
      0.14,
      0xe4ecdf,
    );
    this.box(
      this.walls.south,
      w / 2,
      1.4,
      far + 0.07,
      right - left,
      2.8,
      0.14,
      0xe4ecdf,
    );
    for (const x of [left, right]) {
      const wall = x === left ? this.walls.left : this.walls.right;
      this.box(
        wall,
        x,
        0.08,
        (near + far) / 2,
        0.04,
        0.16,
        far - near,
        0x82a28a,
      );
      for (let z = near + 1.9; z < far - 1; z += 2.6)
        this.window(wall, x + (x === left ? 0.035 : -0.035), z);
    }
    this.box(
      this.walls.north,
      w / 2,
      0.08,
      near,
      right - left,
      0.16,
      0.04,
      0x82a28a,
    );
    this.box(
      this.walls.south,
      w / 2,
      1.05,
      far - 0.025,
      1.05,
      2.1,
      0.06,
      0xb7c9b5,
    );
    this.box(
      this.walls.south,
      w / 2 - 0.36,
      1.05,
      far - 0.07,
      0.04,
      0.04,
      0.04,
      0x4d6857,
    );
    map.objects.forEach((object, index) => this.furniture(object, index));
    if (map.activityArea)
      this.drawArea(
        map.activityArea,
        'Khu giao lưu',
        ['#bed3bc', '#88aa90', '#52795e'],
        0.37,
        102,
      );
    if (map.diceArea)
      this.drawArea(
        map.diceArea,
        'Bàn Trên/Dưới',
        ['#e4c89e', '#a66c38', '#6b411e'],
        0.5,
        310,
      );
    map.caroTables?.forEach((table, index) => {
      const desk = map.objects[table.desk];
      if (!desk) return;
      this.drawArea(
        { x: desk.x - 24, y: desk.y - 82, w: desk.w + 48, h: 273 },
        `Caro ${index + 1}`,
        ['#c4dadb', '#649395', '#355f61'],
        0.5,
        350,
      );
    });
  }

  showInterior(camera: THREE.Vector3): void {
    this.walls.left.visible = camera.x > 32 / WORLD_SCALE;
    this.walls.right.visible = camera.x < (this.map.width - 32) / WORLD_SCALE;
    this.walls.north.visible = camera.z > 48 / WORLD_SCALE;
    this.walls.south.visible = camera.z < (this.map.height - 32) / WORLD_SCALE;
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
  dressAvatar(parent: THREE.Group, color: number, skirt: boolean): THREE.Mesh {
    const mesh = new THREE.Mesh(
      skirt ? this.robe : this.jacket,
      this.material(color),
    );
    mesh.scale.z = 0.73;
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private window(wall: THREE.Group, x: number, z: number): void {
    this.box(wall, x, 1.7, z, 0.04, 1.25, 1.45, 0xcee7e5);
    for (const edge of [-0.75, 0.75])
      this.box(wall, x, 1.7, z + edge, 0.08, 1.35, 0.05, 0xffffff);
    for (const y of [1.05, 2.35])
      this.box(wall, x, y, z, 0.08, 0.05, 1.55, 0xffffff);
    this.box(wall, x, 1.7, z, 0.08, 1.25, 0.04, 0xffffff);
  }
  private drawArea(
    area: RoomArea,
    label: string,
    colors: readonly [string, string, string],
    labelX: number,
    labelY: number,
  ): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    const paint = canvas.getContext('2d');
    if (!paint) return;
    paint.fillStyle = colors[0];
    paint.fillRect(0, 0, canvas.width, canvas.height);
    paint.strokeStyle = colors[1];
    paint.lineWidth = 5;
    paint.strokeRect(24, 22, canvas.width - 48, canvas.height - 44);
    paint.fillStyle = colors[2];
    paint.font = '600 50px Segoe UI, sans-serif';
    paint.textAlign = 'center';
    paint.fillText(label, canvas.width * labelX, labelY);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.textures.push(texture);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.95,
    });
    const floorMark = new THREE.Mesh(
      new THREE.PlaneGeometry(area.w / WORLD_SCALE, area.h / WORLD_SCALE),
      mat,
    );
    floorMark.rotation.x = -Math.PI / 2;
    floorMark.position.set(
      (area.x + area.w / 2) / WORLD_SCALE,
      0.015,
      (area.y + area.h / 2) / WORLD_SCALE,
    );
    floorMark.receiveShadow = true;
    this.root.add(floorMark);
  }
  showDice(faces: readonly number[] = [1, 2, 3]): void {
    const pips = [
      [3],
      [0, 6],
      [0, 3, 6],
      [0, 1, 5, 6],
      [0, 1, 3, 5, 6],
      [0, 1, 2, 4, 5, 6],
    ];
    this.dicePips.forEach((die, index) => {
      const shown = pips[faces[index] - 1] ?? [];
      die.forEach((pip, dot) => (pip.visible = shown.includes(dot)));
    });
  }

  private furniture(o: RoomFurniture, index: number): void {
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
      if (inRoomArea(this.map.diceArea, o.x + o.w / 2, o.y + o.h / 2)) {
        this.box(group, 0, 0.83, 0, w - 0.22, 0.02, d - 0.17, 0x305747);
        for (const x of [-0.43, 0, 0.43]) {
          this.box(group, x, 0.98, 0, 0.28, 0.28, 0.28, 0xfff3d4);
          this.dicePips.push(
            [
              [-1, -1],
              [1, -1],
              [-1, 0],
              [0, 0],
              [1, 0],
              [-1, 1],
              [1, 1],
            ].map(([column, row]) =>
              this.sphere(
                group,
                x + column * 0.075,
                1.12,
                row * 0.075,
                0.024,
                0.007,
                0.024,
                0x3b3025,
              ),
            ),
          );
        }
        this.showDice();
        return;
      }
      if (this.map.caroTables?.some((table) => table.desk === index)) {
        this.box(group, 0, 0.84, 0, 0.7, 0.03, 0.7, 0xf6e3bf);
        for (let line = -3; line <= 3; line++) {
          this.box(group, line * 0.09, 0.857, 0, 0.009, 0.004, 0.54, 0x7e6852);
          this.box(group, 0, 0.857, line * 0.09, 0.54, 0.004, 0.009, 0x7e6852);
        }
        return;
      }
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
      group.userData['chair'] = index;
      if (o.facing === 'south') group.rotation.y = Math.PI;
      const caro = this.map.caroTables?.some((table) =>
        table.chairs.includes(index),
      );
      const cushionHeight = 0.09;
      this.box(
        group,
        0,
        CHAIR_SEAT_TOP - cushionHeight / 2,
        0,
        w,
        cushionHeight,
        d,
        caro ? 0x83b1b1 : 0x8cae91,
      );
      this.box(
        group,
        0,
        caro ? 0.64 : 0.73,
        d / 2 - 0.04,
        w,
        caro ? 0.36 : 0.54,
        0.075,
        caro ? 0x608d90 : 0x789f80,
      );
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
      ctx.fillText('Giờ ra chơi', 512, 122);
      ctx.font = '25px sans-serif';
      ctx.fillText('CHAN Academy', 512, 174);
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
    geometries.add(this.robe);
    geometries.add(this.jacket);
    geometries.add(this.cylinder);
    geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => materials.add(m));
    materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
