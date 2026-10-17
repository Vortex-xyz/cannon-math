import * as THREE from "three";
import { TRACK_WIDTH } from "./config";
import type { Op } from "./math-ops";
import { opColor } from "./math-ops";
import { THEMES, type ThemeId, type WorldTheme } from "./themes";
import type { VehicleId, VehiclePaint } from "./vehicles";
import { VEHICLES } from "./vehicles";

export type LabelHandle = {
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  last: string;
};

export class AssetKit {
  geos: THREE.BufferGeometry[] = [];
  mats: THREE.Material[] = [];
  texs: THREE.Texture[] = [];

  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.push(g);
    return g;
  }
  mat<T extends THREE.Material>(m: T): T {
    this.mats.push(m);
    return m;
  }
  tex<T extends THREE.Texture>(t: T): T {
    this.texs.push(t);
    return t;
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.texs) t.dispose();
    this.geos.length = 0;
    this.mats.length = 0;
    this.texs.length = 0;
  }
}

function canvasTex(
  kit: AssetKit,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!, w, h);
  const tex = kit.tex(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function paintCanvas(tex: THREE.CanvasTexture, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = tex.image as HTMLCanvasElement;
  paint(c.getContext("2d")!, c.width, c.height);
  tex.needsUpdate = true;
}

export function paintTrack(tex: THREE.CanvasTexture, t: WorldTheme) {
  paintCanvas(tex, (ctx, w, h) => {
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.trackBase;
    ctx.fillRect(0, 0, w, h);
    const lanes = [
      { x: 42, c: t.trackLaneA },
      { x: 128, c: t.trackLaneB },
      { x: 214, c: t.trackLaneA },
    ];
    for (const lane of lanes) {
      ctx.fillStyle = lane.c;
      ctx.fillRect(lane.x - 34, 0, 68, h);
    }
    ctx.fillStyle = t.trackEdge;
    ctx.fillRect(0, 0, 14, h);
    ctx.fillRect(w - 14, 0, 14, h);

    if (t.id === "reef") {
      ctx.strokeStyle = t.trackMark;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      for (let y = 6; y < h; y += 18) {
        ctx.beginPath();
        ctx.moveTo(18, y);
        for (let x = 18; x < w - 18; x += 16) {
          ctx.lineTo(x + 8, y + Math.sin(x * 0.2 + y) * 3);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = t.chevron;
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.arc((i * 47) % w, (i * 29) % h, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (t.id === "toon") {
      ctx.strokeStyle = t.trackDash;
      ctx.globalAlpha = 1;
      ctx.lineWidth = 5;
      ctx.setLineDash([22, 16]);
      ctx.beginPath();
      ctx.moveTo(85, 0);
      ctx.lineTo(85, h);
      ctx.moveTo(171, 0);
      ctx.lineTo(171, h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = t.trackEdge;
      ctx.fillRect(0, 0, 10, h);
      ctx.fillRect(w - 10, 0, 10, h);
      return;
    }
    if (t.id === "luna") {
      ctx.fillStyle = t.rockC;
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 22; i++) {
        const x = (i * 53) % w;
        const y = (i * 37) % h;
        ctx.beginPath();
        ctx.ellipse(x, y, 7 + (i % 4), 4 + (i % 3), 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = t.chevron;
      for (let y = 10; y < h; y += 44) {
        for (const x of [42, 128, 214]) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - 6, y + 10);
          ctx.lineTo(x + 6, y + 10);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      return;
    }

    ctx.strokeStyle = t.trackDash;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    ctx.moveTo(85, 0);
    ctx.lineTo(85, h);
    ctx.moveTo(171, 0);
    ctx.lineTo(171, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.trackMark;
    for (let y = 0; y < h; y += 32) ctx.fillRect(18, y + 10, w - 36, 2);
    ctx.fillStyle = t.chevron;
    ctx.globalAlpha = 0.4;
    for (let y = 8; y < h; y += 40) {
      for (const x of [42, 128, 214]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7, y + 12);
        ctx.lineTo(x + 7, y + 12);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  });
}

function paintBrick(tex: THREE.CanvasTexture, t: WorldTheme) {
  paintCanvas(tex, (ctx, w, h) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.brickGrout;
    ctx.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += 16, row++) {
      const off = row % 2 === 0 ? 0 : 16;
      for (let x = -32; x < w; x += 32) {
        ctx.fillStyle = row % 2 === 0 ? t.brickA : t.brickB;
        ctx.fillRect(x + off + 1, y + 1, 30, 14);
        ctx.fillStyle = t.brickHi;
        ctx.fillRect(x + off + 1, y + 1, 30, 2);
      }
    }
  });
}

function paintRock(tex: THREE.CanvasTexture, t: WorldTheme) {
  paintCanvas(tex, (ctx, w, h) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.rockA;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 2 ? t.rockB : t.rockC;
      ctx.fillRect((i * 17) % 64, (i * 11) % 64, 12, 9);
    }
  });
}

export function makeTrackTexture(kit: AssetKit, theme: WorldTheme = THEMES.forge) {
  const tex = canvasTex(kit, 256, 256, () => {});
  tex.repeat.set(1, 8);
  paintTrack(tex, theme);
  return tex;
}

export function makeBrickTexture(kit: AssetKit, theme: WorldTheme = THEMES.forge) {
  const tex = canvasTex(kit, 128, 128, () => {});
  paintBrick(tex, theme);
  return tex;
}

export function makeRockTexture(kit: AssetKit, theme: WorldTheme = THEMES.forge) {
  const tex = canvasTex(kit, 64, 64, () => {});
  paintRock(tex, theme);
  return tex;
}

export function makeSky(kit: AssetKit) {
  const t = THEMES.forge;
  return new THREE.Mesh(
    kit.geo(new THREE.SphereGeometry(160, 24, 16)),
    kit.mat(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uZenith: { value: new THREE.Color(t.zenith) },
          uHorizon: { value: new THREE.Color(t.horizon) },
          uGround: { value: new THREE.Color(t.skyGround) },
          uSunDir: { value: new THREE.Vector3(...t.sunDir).normalize() },
          uSunCol: { value: new THREE.Color(t.sunMesh) },
          uSunPow: { value: t.sunPow },
          uTime: { value: 0 },
          uStars: { value: 0 },
          uCaustic: { value: 0 },
          uClouds: { value: 0 },
          uSnow: { value: 0 },
          uDune: { value: 0 },
        },
        vertexShader: `
        varying vec3 vP;
        void main() {
          vP = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
        fragmentShader: `
        varying vec3 vP;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        uniform vec3 uSunDir;
        uniform vec3 uSunCol;
        uniform float uSunPow;
        uniform float uTime;
        uniform float uStars;
        uniform float uCaustic;
        uniform float uClouds;
        uniform float uSnow;
        uniform float uDune;
        float hash(vec3 p) {
          return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        }
        void main() {
          vec3 n = normalize(vP);
          float h = n.y;
          vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, h));
          col = mix(uGround, col, smoothstep(-0.32, 0.06, h));
          float sun = pow(max(0.0, dot(n, normalize(uSunDir))), uSunPow);
          col += uSunCol * sun * 0.72;
          if (uCaustic > 0.01) {
            float bands = sin(n.x * 10.0 + uTime * 0.7) * sin(n.z * 7.0 - uTime * 0.45);
            col += vec3(0.12, 0.28, 0.26) * bands * uCaustic * 0.35;
            col *= 0.92 + 0.08 * sin(uTime + n.x * 4.0);
          }
          if (uClouds > 0.01 && h > 0.06 && h < 0.62) {
            float c = sin(n.x * 5.0 + 0.4) * sin(n.z * 4.0 + n.x * 2.0);
            float puff = smoothstep(0.28, 0.72, c) * uClouds * (1.0 - abs(h - 0.32) * 2.2);
            col = mix(col, vec3(1.0, 0.99, 0.96), clamp(puff, 0.0, 0.75));
          }
          if (uStars > 0.01 && h > 0.02) {
            float s = hash(floor(n * 90.0));
            float tw = 0.65 + 0.35 * sin(uTime * 2.4 + s * 40.0);
            col += vec3(0.95, 0.97, 1.0) * step(0.973, s) * uStars * tw;
          }
          if (uSnow > 0.01) {
            col = mix(col, vec3(0.86, 0.93, 0.98), 0.22 * uSnow);
            float flake = hash(floor(vec3(n.x * 48.0, n.y * 36.0 + uTime * 0.35, n.z * 48.0)));
            col += vec3(0.95, 0.98, 1.0) * step(0.988, flake) * uSnow;
          }
          if (uDune > 0.01) {
            col = mix(col, vec3(0.95, 0.62, 0.28), smoothstep(0.45, -0.08, h) * 0.45 * uDune);
            float haze = sin(n.x * 7.0 + uTime * 0.25) * sin(n.z * 5.0);
            col += vec3(0.55, 0.32, 0.08) * haze * uDune * 0.12;
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      }),
    ),
  );
}

export function makeSun(kit: AssetKit) {
  const mesh = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(1, 16, 12)), kit.mat(new THREE.MeshBasicMaterial({ color: 0xc5d4d8 })));
  mesh.position.set(-38, 26, -80);
  mesh.scale.setScalar(5.5);
  return mesh;
}

export function makeEarth(kit: AssetKit) {
  const root = new THREE.Mesh(
    kit.geo(new THREE.SphereGeometry(9.5, 24, 16)),
    kit.mat(new THREE.MeshBasicMaterial({ color: 0x6a8ab0 })),
  );
  root.position.set(28, 16, -78);
  root.visible = false;
  const ice = new THREE.Mesh(
    kit.geo(new THREE.SphereGeometry(9.52, 16, 10, 0, Math.PI * 2, 0, 0.55)),
    kit.mat(new THREE.MeshBasicMaterial({ color: 0xe8eef4 })),
  );
  ice.rotation.z = 0.4;
  root.add(ice);
  const land = new THREE.Mesh(
    kit.geo(new THREE.SphereGeometry(9.53, 12, 8, 0.4, 1.2, 0.7, 0.7)),
    kit.mat(new THREE.MeshBasicMaterial({ color: 0x6a9a58 })),
  );
  root.add(land);
  return root;
}

export function makeGround(kit: AssetKit) {
  const mesh = new THREE.Mesh(
    kit.geo(new THREE.PlaneGeometry(140, 420)),
    kit.mat(new THREE.MeshStandardMaterial({ color: 0x0d1c20, roughness: 1, metalness: 0 })),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, -0.22, -90);
  return mesh;
}

export function makeLabel(kit: AssetKit, w = 1.8, h = 1.1): LabelHandle {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  const texture = kit.tex(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const mat = kit.mat(
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  return {
    mesh: new THREE.Mesh(kit.geo(new THREE.PlaneGeometry(w, h)), mat),
    canvas,
    ctx,
    texture,
    last: "",
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawLabel(h: LabelHandle, text: string, fill: string, bg = "rgba(9,11,16,0.78)") {
  if (h.last === text + fill + bg) return;
  h.last = text + fill + bg;
  const { ctx, canvas, texture } = h;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = bg;
  roundRect(ctx, 12, 18, canvas.width - 24, canvas.height - 36, 28);
  ctx.fill();
  ctx.strokeStyle = fill;
  ctx.lineWidth = 6;
  roundRect(ctx, 12, 18, canvas.width - 24, canvas.height - 36, 28);
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.font = "800 72px Syne, Outfit, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(9,11,16,0.9)";
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  texture.needsUpdate = true;
}

export type CannonHandle = {
  root: THREE.Group;
  barrel: THREE.Group;
  wheels: THREE.Mesh[];
  powerLabel: LabelHandle;
  rim: THREE.MeshStandardMaterial;
  flash: THREE.Mesh;
  core: THREE.Mesh;
  metal: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
};

type CannonMats = {
  metal: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
};

function cannonMats(kit: AssetKit, paint: VehiclePaint): CannonMats {
  return {
    metal: kit.mat(new THREE.MeshStandardMaterial({ color: paint.metal, metalness: 0.74, roughness: 0.36 })),
    steel: kit.mat(new THREE.MeshStandardMaterial({ color: paint.steel, metalness: 0.88, roughness: 0.24 })),
    copper: kit.mat(new THREE.MeshStandardMaterial({ color: paint.copper, metalness: 0.7, roughness: 0.32 })),
    dark: kit.mat(new THREE.MeshStandardMaterial({ color: paint.dark, metalness: 0.5, roughness: 0.5 })),
    rim: kit.mat(
      new THREE.MeshStandardMaterial({
        color: paint.rim,
        emissive: paint.rim,
        emissiveIntensity: 0.62,
        metalness: 0.3,
        roughness: 0.4,
      }),
    ),
  };
}

function tube(kit: AssetKit, rTop: number, rBot: number, len: number, segs = 16) {
  const g = kit.geo(new THREE.CylinderGeometry(rTop, rBot, len, segs));
  g.rotateX(-Math.PI / 2);
  return g;
}

function addBarrelKit(
  kit: AssetKit,
  barrel: THREE.Group,
  mats: CannonMats,
  opts: { len: number; r: number; flashZ: number },
) {
  const tubeMesh = new THREE.Mesh(tube(kit, opts.r * 0.78, opts.r, opts.len), mats.steel);
  tubeMesh.position.z = -opts.len * 0.4;
  barrel.add(tubeMesh);
  const bandGeo = tube(kit, opts.r + 0.02, opts.r + 0.02, 0.1, 14);
  const bandA = new THREE.Mesh(bandGeo, mats.copper);
  const bandB = new THREE.Mesh(bandGeo, mats.copper);
  bandA.position.z = -0.18;
  bandB.position.z = -opts.len * 0.62;
  barrel.add(bandA, bandB);
  const ring = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(opts.r * 0.95, 0.045, 8, 16)), mats.rim);
  ring.position.z = -opts.len * 0.82;
  barrel.add(ring);
  const muzzle = new THREE.Mesh(tube(kit, opts.r * 0.88, opts.r * 0.88, 0.14, 12), mats.dark);
  muzzle.position.z = -opts.len * 0.9;
  barrel.add(muzzle);
  const core = new THREE.Mesh(
    kit.geo(new THREE.SphereGeometry(0.12, 10, 8)),
    kit.mat(new THREE.MeshBasicMaterial({ color: 0x9ee8d8, transparent: true, opacity: 0.85 })),
  );
  core.position.z = -0.15;
  barrel.add(core);
  const flashGeo = kit.geo(new THREE.ConeGeometry(opts.r + 0.08, 0.7, 8));
  flashGeo.rotateX(-Math.PI / 2);
  const flash = new THREE.Mesh(
    flashGeo,
    kit.mat(new THREE.MeshBasicMaterial({ color: 0xe8f4f0, transparent: true, opacity: 0.85, depthWrite: false })),
  );
  flash.position.z = opts.flashZ;
  flash.visible = false;
  barrel.add(flash);
  return { core, flash };
}

function finishCannon(
  kit: AssetKit,
  root: THREE.Group,
  barrel: THREE.Group,
  wheels: THREE.Mesh[],
  mats: CannonMats,
  core: THREE.Mesh,
  flash: THREE.Mesh,
): CannonHandle {
  const shadow = new THREE.Mesh(
    kit.geo(new THREE.CircleGeometry(0.92, 16)),
    kit.mat(new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.38, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);
  const powerLabel = makeLabel(kit, 1.35, 0.78);
  powerLabel.mesh.position.set(0, 2.05, 0);
  root.add(powerLabel.mesh);
  return { root, barrel, wheels, powerLabel, rim: mats.rim, flash, core, metal: mats.metal, steel: mats.steel, copper: mats.copper, dark: mats.dark };
}

function makeRigCannon(kit: AssetKit, mats: CannonMats): CannonHandle {
  const root = new THREE.Group();
  const body = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.12, 0.5, 1.28)), mats.metal);
  body.position.y = 0.48;
  root.add(body);
  const skirt = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.22, 0.12, 1.38)), mats.copper);
  skirt.position.y = 0.28;
  root.add(skirt);
  const seat = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.72, 0.3, 0.58)), mats.dark);
  seat.position.set(0, 0.84, 0.18);
  root.add(seat);
  const postL = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.1, 0.42, 0.72)), mats.steel);
  const postR = postL.clone();
  const brace = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.05, 0.42, 0.1)), mats.steel);
  postL.position.set(-0.52, 0.78, 0.5);
  postR.position.set(0.52, 0.78, 0.5);
  brace.position.set(0, 0.78, 0.82);
  const plate = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.05, 0.08, 0.72)), mats.copper);
  plate.position.set(0, 0.58, 0.5);
  root.add(postL, postR, brace, plate);
  const railL = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.08, 0.42, 0.7)), mats.steel);
  const railR = railL.clone();
  railL.position.set(-0.58, 0.62, 0.05);
  railR.position.set(0.58, 0.62, 0.05);
  root.add(railL, railR);

  const barrel = new THREE.Group();
  barrel.position.set(0, 0.74, -0.22);
  const { core, flash } = addBarrelKit(kit, barrel, mats, { len: 1.55, r: 0.27, flashZ: -1.7 });
  root.add(barrel);

  const wheelGeo = kit.geo(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 16));
  wheelGeo.rotateZ(Math.PI / 2);
  const tireGeo = kit.geo(new THREE.TorusGeometry(0.32, 0.04, 8, 16));
  tireGeo.rotateY(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  for (const [x, y, z] of [
    [-0.64, 0.32, 0.42],
    [0.64, 0.32, 0.42],
    [-0.64, 0.32, -0.38],
    [0.64, 0.32, -0.38],
  ] as const) {
    const wheel = new THREE.Mesh(wheelGeo, mats.dark);
    const tire = new THREE.Mesh(tireGeo, mats.rim);
    wheel.position.set(x, y, z);
    tire.position.set(x, y, z);
    root.add(wheel, tire);
    wheels.push(wheel, tire);
  }
  return finishCannon(kit, root, barrel, wheels, mats, core, flash);
}

function makeHowlCannon(kit: AssetKit, mats: CannonMats): CannonHandle {
  const root = new THREE.Group();
  const hull = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.55, 0.52, 1.85)), mats.metal);
  hull.position.y = 0.52;
  const armor = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.7, 0.14, 1.95)), mats.copper);
  armor.position.y = 0.3;
  const turret = new THREE.Mesh(kit.geo(new THREE.CylinderGeometry(0.52, 0.58, 0.38, 10)), mats.steel);
  turret.position.y = 0.92;
  const hatch = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.22, 8, 6)), mats.dark);
  hatch.position.set(0.18, 1.14, 0.12);
  root.add(hull, armor, turret, hatch);

  const barrel = new THREE.Group();
  barrel.position.set(0, 0.9, -0.2);
  const { core, flash } = addBarrelKit(kit, barrel, mats, { len: 1.2, r: 0.34, flashZ: -1.45 });
  root.add(barrel);

  const trackGeo = kit.geo(new THREE.BoxGeometry(0.32, 0.38, 1.9));
  const wheels: THREE.Mesh[] = [];
  for (const x of [-0.78, 0.78]) {
    const track = new THREE.Mesh(trackGeo, mats.dark);
    track.position.set(x, 0.26, 0);
    const rim = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.28, 0.05, 6, 12)), mats.rim);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(x, 0.26, 0.55);
    const rim2 = rim.clone();
    rim2.position.z = -0.55;
    root.add(track, rim, rim2);
    wheels.push(rim, rim2);
  }
  return finishCannon(kit, root, barrel, wheels, mats, core, flash);
}

function makeBoltCannon(kit: AssetKit, mats: CannonMats): CannonHandle {
  const root = new THREE.Group();
  const body = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.62, 0.28, 1.85)), mats.metal);
  body.position.y = 0.48;
  const nose = new THREE.Mesh(kit.geo(new THREE.ConeGeometry(0.34, 0.7, 6)), mats.steel);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0.48, -1.15);
  const seat = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.5, 0.22, 0.5)), mats.dark);
  seat.position.set(0, 0.72, 0.35);
  const spoiler = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.85, 0.06, 0.28)), mats.rim);
  spoiler.position.set(0, 0.88, 0.78);
  const strut = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.08, 0.28, 0.08)), mats.steel);
  strut.position.set(0, 0.74, 0.72);
  root.add(body, nose, seat, spoiler, strut);

  const barrel = new THREE.Group();
  barrel.position.set(0, 0.62, -0.35);
  const { core, flash } = addBarrelKit(kit, barrel, mats, { len: 1.95, r: 0.16, flashZ: -2.05 });
  root.add(barrel);

  const wheelGeo = kit.geo(new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14));
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const spots: [number, number, number][] = [
    [0, 0.28, -0.72],
    [-0.48, 0.3, 0.62],
    [0.48, 0.3, 0.62],
  ];
  for (const [x, y, z] of spots) {
    const w = new THREE.Mesh(wheelGeo, mats.dark);
    w.position.set(x, y, z);
    const tire = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.28, 0.04, 8, 14)), mats.rim);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(x, y, z);
    root.add(w, tire);
    wheels.push(w, tire);
  }
  return finishCannon(kit, root, barrel, wheels, mats, core, flash);
}

function makeSkiffCannon(kit: AssetKit, mats: CannonMats): CannonHandle {
  const root = new THREE.Group();
  const deck = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.25, 0.16, 1.9)), mats.metal);
  deck.position.y = 0.48;
  const cabin = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.42, 10, 8, 0, Math.PI * 2, 0, 1.2)), mats.steel);
  cabin.position.set(0, 0.62, 0.28);
  const finL = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.08, 0.42, 0.7)), mats.copper);
  const finR = finL.clone();
  finL.position.set(-0.58, 0.55, 0.1);
  finR.position.set(0.58, 0.55, 0.1);
  root.add(deck, cabin, finL, finR);

  const barrel = new THREE.Group();
  barrel.position.set(0, 0.62, -0.2);
  const { core, flash } = addBarrelKit(kit, barrel, mats, { len: 1.35, r: 0.2, flashZ: -1.55 });
  const twin = new THREE.Mesh(tube(kit, 0.1, 0.12, 1.05, 10), mats.steel);
  twin.position.set(0.22, -0.06, -0.55);
  barrel.add(twin);
  root.add(barrel);

  const padGeo = kit.geo(new THREE.CylinderGeometry(0.28, 0.34, 0.1, 12));
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-0.42, 0.55],
    [0.42, 0.55],
    [0, -0.7],
  ] as const) {
    const pad = new THREE.Mesh(padGeo, mats.dark);
    pad.position.set(x, 0.18, z);
    const glow = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.26, 0.035, 8, 16)), mats.rim);
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, 0.14, z);
    root.add(pad, glow);
    wheels.push(glow);
  }
  return finishCannon(kit, root, barrel, wheels, mats, core, flash);
}

function makeGaleCannon(kit: AssetKit, mats: CannonMats): CannonHandle {
  const root = new THREE.Group();
  const hull = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.45, 0.28, 1.35)), mats.metal);
  hull.position.y = 0.42;
  const prow = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.15, 0.18, 0.55)), mats.steel);
  prow.position.set(0, 0.5, -0.72);
  const rack = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.2, 0.12, 0.28)), mats.copper);
  rack.position.set(0, 0.62, -0.15);
  root.add(hull, prow, rack);

  const barrel = new THREE.Group();
  barrel.position.set(0, 0.62, -0.22);
  const { core, flash } = addBarrelKit(kit, barrel, mats, { len: 1.05, r: 0.14, flashZ: -1.25 });
  const sideGeo = tube(kit, 0.09, 0.11, 0.95, 8);
  const left = new THREE.Mesh(sideGeo, mats.steel);
  const right = new THREE.Mesh(sideGeo, mats.steel);
  left.position.set(-0.28, -0.02, -0.42);
  right.position.set(0.28, -0.02, -0.42);
  barrel.add(left, right);
  root.add(barrel);

  const wheelGeo = kit.geo(new THREE.CylinderGeometry(0.26, 0.26, 0.16, 12));
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-0.68, 0.38],
    [0.68, 0.38],
    [-0.62, -0.48],
    [0.62, -0.48],
  ] as const) {
    const w = new THREE.Mesh(wheelGeo, mats.dark);
    w.position.set(x, 0.26, z);
    const tire = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.26, 0.035, 8, 12)), mats.rim);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(x, 0.26, z);
    root.add(w, tire);
    wheels.push(w, tire);
  }
  return finishCannon(kit, root, barrel, wheels, mats, core, flash);
}

function makeHydraCannon(kit: AssetKit, mats: CannonMats): CannonHandle {
  const root = new THREE.Group();
  const body = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.62, 12, 10)), mats.metal);
  body.position.y = 0.7;
  body.scale.set(1.15, 0.85, 1.25);
  const jaw = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.38, 10, 8)), mats.copper);
  jaw.position.set(0, 0.62, -0.55);
  const hornGeo = kit.geo(new THREE.ConeGeometry(0.1, 0.55, 6));
  const h1 = new THREE.Mesh(hornGeo, mats.steel);
  const h2 = h1.clone();
  h1.position.set(-0.28, 1.18, 0.1);
  h1.rotation.z = 0.35;
  h2.position.set(0.28, 1.18, 0.1);
  h2.rotation.z = -0.35;
  root.add(body, jaw, h1, h2);

  const barrel = new THREE.Group();
  barrel.position.set(0, 0.7, -0.45);
  const { core, flash } = addBarrelKit(kit, barrel, mats, { len: 1.15, r: 0.3, flashZ: -1.4 });
  const fang = new THREE.Mesh(tube(kit, 0.12, 0.16, 0.9, 8), mats.steel);
  fang.position.set(-0.22, -0.12, -0.4);
  const fang2 = fang.clone();
  fang2.position.x = 0.22;
  barrel.add(fang, fang2);
  root.add(barrel);

  const legGeo = kit.geo(new THREE.CylinderGeometry(0.1, 0.14, 0.42, 8));
  const wheels: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-0.42, 0.38],
    [0.42, 0.38],
    [-0.38, -0.32],
    [0.38, -0.32],
  ] as const) {
    const leg = new THREE.Mesh(legGeo, mats.dark);
    leg.position.set(x, 0.28, z);
    const claw = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.12, 8, 6)), mats.rim);
    claw.position.set(x, 0.1, z);
    root.add(leg, claw);
    wheels.push(claw);
  }
  return finishCannon(kit, root, barrel, wheels, mats, core, flash);
}

export function makeCannon(kit: AssetKit, id: VehicleId = "rig"): CannonHandle {
  const mats = cannonMats(kit, VEHICLES[id].paint);
  if (id === "howl") return makeHowlCannon(kit, mats);
  if (id === "gale") return makeGaleCannon(kit, mats);
  if (id === "bolt") return makeBoltCannon(kit, mats);
  if (id === "skiff") return makeSkiffCannon(kit, mats);
  if (id === "hydra") return makeHydraCannon(kit, mats);
  return makeRigCannon(kit, mats);
}

export function makeGate(kit: AssetKit) {
  const root = new THREE.Group();
  const frame = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0x5dbea3,
      metalness: 0.38,
      roughness: 0.4,
      emissive: 0x5dbea3,
      emissiveIntensity: 0.28,
    }),
  );
  const postGeo = kit.geo(new THREE.BoxGeometry(0.24, 2.5, 0.24));
  const left = new THREE.Mesh(postGeo, frame);
  const right = new THREE.Mesh(postGeo, frame);
  left.position.set(-0.92, 1.25, 0);
  right.position.set(0.92, 1.25, 0);
  const lintel = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(2.08, 0.24, 0.24)), frame);
  lintel.position.set(0, 2.42, 0);
  const footGeo = kit.geo(new THREE.BoxGeometry(0.42, 0.16, 0.42));
  const fl = new THREE.Mesh(footGeo, frame);
  const fr = new THREE.Mesh(footGeo, frame);
  fl.position.set(-0.92, 0.08, 0);
  fr.position.set(0.92, 0.08, 0);
  const glow = new THREE.Mesh(
    kit.geo(new THREE.PlaneGeometry(1.62, 2.15)),
    kit.mat(
      new THREE.MeshBasicMaterial({
        color: 0x5dbea3,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    ),
  );
  glow.position.set(0, 1.2, 0);
  const halo = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.72, 0.045, 8, 22)), frame);
  halo.position.set(0, 1.2, 0.02);
  const label = makeLabel(kit, 1.58, 0.92);
  label.mesh.position.set(0, 1.2, 0.14);
  root.add(left, right, lintel, fl, fr, glow, halo, label.mesh);
  return { root, frame, glow, label };
}

export function tintGate(frame: THREE.MeshStandardMaterial, glow: THREE.MeshBasicMaterial, op: Op) {
  const c = new THREE.Color(opColor(op));
  frame.color.copy(c);
  frame.emissive.copy(c);
  glow.color.copy(c);
}

export function makeWall(kit: AssetKit, brick: THREE.CanvasTexture) {
  const root = new THREE.Group();
  const bodyMat = kit.mat(
    new THREE.MeshStandardMaterial({
      map: brick,
      color: 0xb0c4cc,
      metalness: 0.18,
      roughness: 0.62,
      emissive: 0x0a2024,
      emissiveIntensity: 0.42,
    }),
  );
  const body = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1, 1, 0.72)), bodyMat);
  body.position.y = 0.5;
  const cap = new THREE.Mesh(
    kit.geo(new THREE.BoxGeometry(1.06, 0.1, 0.82)),
    kit.mat(new THREE.MeshStandardMaterial({ color: 0x2a3a40, roughness: 0.7, metalness: 0.2 })),
  );
  cap.position.y = 1.02;
  root.add(body, cap);
  const label = makeLabel(kit, 1.4, 0.85);
  label.mesh.position.set(0, 1.18, 0.42);
  root.add(label.mesh);
  return { root, body, bodyMat, label };
}

export function makeGem(kit: AssetKit) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0x7eb8c9,
      emissive: 0x3a7a88,
      emissiveIntensity: 0.85,
      metalness: 0.35,
      roughness: 0.22,
    }),
  );
  return new THREE.Mesh(kit.geo(new THREE.OctahedronGeometry(0.3, 0)), mat);
}

export function makeAmmo(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xc5ced6,
      metalness: 0.62,
      roughness: 0.28,
      emissive: 0x5dbea3,
      emissiveIntensity: 0.42,
    }),
  );
  const ball = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.3, 12, 10)), mat);
  ball.position.y = 0.32;
  const ring = new THREE.Mesh(
    kit.geo(new THREE.TorusGeometry(0.36, 0.035, 8, 16)),
    kit.mat(
      new THREE.MeshStandardMaterial({
        color: 0x5dbea3,
        emissive: 0x5dbea3,
        emissiveIntensity: 0.55,
        metalness: 0.3,
        roughness: 0.4,
      }),
    ),
  );
  ring.position.y = 0.32;
  ring.rotation.x = Math.PI / 2;
  const label = makeLabel(kit, 0.86, 0.5);
  label.mesh.position.set(0, 0.92, 0.02);
  root.add(ball, ring, label.mesh);
  return { root, mat, label };
}

export function makeShieldPickup(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0x7ee0d4,
      emissive: 0x3ec8b8,
      emissiveIntensity: 0.7,
      metalness: 0.15,
      roughness: 0.22,
      transparent: true,
      opacity: 0.78,
    }),
  );
  const shell = new THREE.Mesh(kit.geo(new THREE.IcosahedronGeometry(0.4, 0)), mat);
  shell.position.y = 0.72;
  const ring = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.5, 0.045, 8, 18)), mat);
  ring.position.y = 0.72;
  root.add(shell, ring);
  return { root, mat, ring };
}

export function makeBarrel(kit: AssetKit) {
  const root = new THREE.Group();
  const bodyMat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0x8a5a4e,
      metalness: 0.28,
      roughness: 0.55,
      emissive: 0x3a2018,
      emissiveIntensity: 0.28,
    }),
  );
  const body = new THREE.Mesh(kit.geo(new THREE.CylinderGeometry(0.42, 0.46, 1.08, 10)), bodyMat);
  body.position.y = 0.56;
  const band = kit.mat(new THREE.MeshStandardMaterial({ color: 0x2a2e32, metalness: 0.72, roughness: 0.32 }));
  const bandGeo = kit.geo(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 10));
  const b1 = new THREE.Mesh(bandGeo, band);
  b1.position.y = 0.28;
  const b2 = new THREE.Mesh(bandGeo, band);
  b2.position.y = 0.86;
  const label = makeLabel(kit, 0.92, 0.52);
  label.mesh.position.set(0, 1.32, 0.18);
  root.add(body, b1, b2, label.mesh);
  return { root, bodyMat, label };
}

export function makeSaw(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xb8c0c6,
      metalness: 0.84,
      roughness: 0.26,
      emissive: 0xc45c4a,
      emissiveIntensity: 0.32,
    }),
  );
  const disc = new THREE.Mesh(kit.geo(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 16)), mat);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = 0.7;
  const hub = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.16, 8, 8)), mat);
  hub.position.y = 0.7;
  const toothGeo = kit.geo(new THREE.ConeGeometry(0.11, 0.26, 4));
  for (let i = 0; i < 8; i++) {
    const tooth = new THREE.Mesh(toothGeo, mat);
    const a = (i / 8) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.78, 0.7, Math.sin(a) * 0.78);
    tooth.lookAt(0, 0.7, 0);
    root.add(tooth);
  }
  root.add(disc, hub);
  return { root, mat };
}

export function makeCrystal(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xe8c878,
      emissive: 0xb88830,
      emissiveIntensity: 0.85,
      metalness: 0.45,
      roughness: 0.18,
    }),
  );
  const gem = new THREE.Mesh(kit.geo(new THREE.OctahedronGeometry(0.42, 0)), mat);
  gem.position.y = 0.55;
  const ring = new THREE.Mesh(
    kit.geo(new THREE.TorusGeometry(0.48, 0.04, 8, 18)),
    kit.mat(
      new THREE.MeshStandardMaterial({
        color: 0xf0dca0,
        emissive: 0xe0b050,
        emissiveIntensity: 0.5,
        metalness: 0.4,
        roughness: 0.3,
      }),
    ),
  );
  ring.position.y = 0.55;
  ring.rotation.x = Math.PI / 2;
  const label = makeLabel(kit, 0.86, 0.5);
  label.mesh.position.set(0, 1.18, 0.02);
  root.add(gem, ring, label.mesh);
  return { root, mat, label };
}

export function makeMagnetPickup(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xc45c4a,
      emissive: 0x8a3030,
      emissiveIntensity: 0.55,
      metalness: 0.55,
      roughness: 0.28,
    }),
  );
  const steel = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xc5ced6,
      metalness: 0.72,
      roughness: 0.28,
      emissive: 0x5dbea3,
      emissiveIntensity: 0.35,
    }),
  );
  const core = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.34, 0.12, 8, 14, Math.PI)), mat);
  core.position.y = 0.62;
  core.rotation.x = Math.PI;
  const capGeo = kit.geo(new THREE.BoxGeometry(0.18, 0.28, 0.18));
  const l = new THREE.Mesh(capGeo, steel);
  l.position.set(-0.34, 0.48, 0);
  const r = new THREE.Mesh(capGeo, steel);
  r.position.set(0.34, 0.48, 0);
  root.add(core, l, r);
  return { root, mat };
}

export function makeMine(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0x3a2428,
      emissive: 0xc45c4a,
      emissiveIntensity: 0.55,
      metalness: 0.45,
      roughness: 0.38,
    }),
  );
  const body = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.42, 12, 10)), mat);
  body.position.y = 0.55;
  const spikeGeo = kit.geo(new THREE.ConeGeometry(0.09, 0.32, 5));
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(spikeGeo, mat);
    const a = (i / 6) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.4, 0.55, Math.sin(a) * 0.4);
    s.lookAt(0, 0.55, 0);
    root.add(s);
  }
  const top = new THREE.Mesh(spikeGeo, mat);
  top.position.set(0, 0.95, 0);
  root.add(body, top);
  return { root, mat };
}

export function makeSpike(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xb8c0c8,
      emissive: 0x6a3030,
      emissiveIntensity: 0.4,
      metalness: 0.72,
      roughness: 0.28,
    }),
  );
  const geo = kit.geo(new THREE.ConeGeometry(0.2, 0.95, 5));
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(geo, mat);
    s.position.set(-0.46 + i * 0.46, 0.48, 0);
    root.add(s);
  }
  return { root, mat };
}

export function makeLaser(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xff6868,
      emissive: 0xff3030,
      emissiveIntensity: 1.5,
      metalness: 0.15,
      roughness: 0.22,
    }),
  );
  const beam = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(0.18, 2.6, 0.18)), mat);
  beam.position.y = 1.3;
  const base = new THREE.Mesh(kit.geo(new THREE.CylinderGeometry(0.36, 0.44, 0.16, 8)), mat);
  base.position.y = 0.08;
  root.add(beam, base);
  return { root, mat };
}

export function makeRam(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xc45c4a,
      emissive: 0x8a2820,
      emissiveIntensity: 0.5,
      metalness: 0.42,
      roughness: 0.38,
    }),
  );
  const bar = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(3.3, 0.7, 0.52)), mat);
  bar.position.y = 0.72;
  const capGeo = kit.geo(new THREE.BoxGeometry(0.26, 0.92, 0.68));
  const left = new THREE.Mesh(capGeo, mat);
  left.position.set(-1.55, 0.72, 0);
  const right = new THREE.Mesh(capGeo, mat);
  right.position.set(1.55, 0.72, 0);
  root.add(bar, left, right);
  return { root, mat };
}

export function makeBoostPickup(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xffd060,
      emissive: 0xe09020,
      emissiveIntensity: 0.9,
      metalness: 0.35,
      roughness: 0.25,
    }),
  );
  const a = new THREE.Mesh(kit.geo(new THREE.ConeGeometry(0.28, 0.48, 4)), mat);
  a.position.set(0, 0.78, 0);
  a.rotation.x = Math.PI;
  const b = new THREE.Mesh(kit.geo(new THREE.ConeGeometry(0.22, 0.38, 4)), mat);
  b.position.set(0, 0.42, 0);
  b.rotation.x = Math.PI;
  root.add(a, b);
  return { root, mat };
}

export function makeFrostPickup(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xd8f4ff,
      emissive: 0x6ec8ee,
      emissiveIntensity: 0.85,
      metalness: 0.2,
      roughness: 0.15,
    }),
  );
  const gem = new THREE.Mesh(kit.geo(new THREE.OctahedronGeometry(0.36, 0)), mat);
  gem.position.y = 0.58;
  const ring = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.42, 0.035, 6, 14)), mat);
  ring.position.y = 0.58;
  ring.rotation.x = Math.PI / 2;
  root.add(gem, ring);
  return { root, mat };
}

export function makeGhostPickup(kit: AssetKit) {
  const root = new THREE.Group();
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0xc8b0ff,
      emissive: 0x7050c8,
      emissiveIntensity: 0.8,
      metalness: 0.15,
      roughness: 0.2,
      transparent: true,
      opacity: 0.85,
    }),
  );
  const orb = new THREE.Mesh(kit.geo(new THREE.SphereGeometry(0.32, 12, 10)), mat);
  orb.position.y = 0.58;
  const ring = new THREE.Mesh(kit.geo(new THREE.TorusGeometry(0.46, 0.04, 8, 16)), mat);
  ring.position.y = 0.58;
  ring.rotation.x = Math.PI / 2.6;
  root.add(orb, ring);
  return { root, mat };
}

export function makeBlock(kit: AssetKit) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0x3a2424,
      metalness: 0.22,
      roughness: 0.68,
      emissive: 0x4a1818,
      emissiveIntensity: 0.4,
    }),
  );
  const root = new THREE.Group();
  const body = new THREE.Mesh(kit.geo(new THREE.BoxGeometry(1.55, 1.05, 1.05)), mat);
  body.position.y = 0.52;
  const spikeGeo = kit.geo(new THREE.ConeGeometry(0.22, 0.72, 5));
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(spikeGeo, mat);
    s.position.set(-0.45 + i * 0.45, 1.22, 0);
    root.add(s);
  }
  root.add(body);
  return root;
}

function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number) {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
}

export function makeTrackPlates(kit: AssetKit, tex: THREE.CanvasTexture, n: number) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.84, metalness: 0.06, color: 0xe4eef0 }),
  );
  return instanced(kit.geo(new THREE.BoxGeometry(TRACK_WIDTH, 0.18, 10)), mat, n);
}

export function makeRails(kit: AssetKit, n: number) {
  const mat = kit.mat(new THREE.MeshStandardMaterial({ color: 0x101c22, roughness: 0.78, metalness: 0.18 }));
  return instanced(kit.geo(new THREE.BoxGeometry(0.38, 0.58, 10)), mat, n);
}

export function makePillars(kit: AssetKit, n: number) {
  const mat = kit.mat(new THREE.MeshStandardMaterial({ color: 0x1a3038, roughness: 0.72, metalness: 0.22 }));
  return instanced(kit.geo(new THREE.CylinderGeometry(0.3, 0.42, 4.4, 6)), mat, n);
}

export function makeCliffs(kit: AssetKit, tex: THREE.CanvasTexture, n: number) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      map: tex,
      color: 0x8aa0a6,
      roughness: 0.94,
      metalness: 0.04,
      flatShading: true,
    }),
  );
  return instanced(kit.geo(new THREE.BoxGeometry(8, 11, 16)), mat, n);
}

export function makeMotes(kit: AssetKit, n: number) {
  const mat = kit.mat(
    new THREE.MeshBasicMaterial({ color: 0x8eb8c0, transparent: true, opacity: 0.42, depthWrite: false }),
  );
  return instanced(kit.geo(new THREE.SphereGeometry(0.07, 6, 4)), mat, n);
}

export function makeKelp(kit: AssetKit, n: number) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({
      color: 0x1c8a52,
      roughness: 0.72,
      metalness: 0.05,
      emissive: 0x0a4028,
      emissiveIntensity: 0.35,
    }),
  );
  const mesh = instanced(kit.geo(new THREE.ConeGeometry(0.28, 6.8, 5)), mat, n);
  mesh.visible = false;
  return mesh;
}

export function makeCoral(kit: AssetKit, n: number) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({ color: 0xe08a78, roughness: 0.55, metalness: 0.08, flatShading: true }),
  );
  const mesh = instanced(kit.geo(new THREE.IcosahedronGeometry(0.72, 0)), mat, n);
  mesh.visible = false;
  return mesh;
}

export function makeTreeTrunks(kit: AssetKit, n: number) {
  const mat = kit.mat(new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.9, metalness: 0 }));
  const mesh = instanced(kit.geo(new THREE.CylinderGeometry(0.14, 0.22, 2.5, 6)), mat, n);
  mesh.visible = false;
  return mesh;
}

export function makeTreeCanopies(kit: AssetKit, n: number) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({ color: 0x3daa40, roughness: 0.78, metalness: 0, flatShading: true }),
  );
  const mesh = instanced(kit.geo(new THREE.SphereGeometry(1.2, 7, 5)), mat, n);
  mesh.visible = false;
  return mesh;
}

export function makeHills(kit: AssetKit, n: number) {
  const mat = kit.mat(
    new THREE.MeshStandardMaterial({ color: 0x6ec056, roughness: 0.92, metalness: 0, flatShading: true }),
  );
  const mesh = instanced(kit.geo(new THREE.SphereGeometry(1, 8, 6)), mat, n);
  mesh.visible = false;
  return mesh;
}

export function makeClouds(kit: AssetKit, n: number) {
  const mat = kit.mat(
    new THREE.MeshBasicMaterial({ color: 0xfffdf8, transparent: true, opacity: 0.92, depthWrite: false }),
  );
  const mesh = instanced(kit.geo(new THREE.SphereGeometry(1.6, 8, 6)), mat, n);
  mesh.visible = false;
  return mesh;
}

export function makeCraters(kit: AssetKit, n: number) {
  const mat = kit.mat(new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 1, metalness: 0 }));
  const geo = kit.geo(new THREE.TorusGeometry(1.9, 0.28, 6, 16));
  geo.rotateX(-Math.PI / 2);
  const mesh = instanced(geo, mat, n);
  mesh.visible = false;
  return mesh;
}

export function makeStars(kit: AssetKit) {
  const geo = kit.geo(new THREE.BufferGeometry());
  const n = 220;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = ((i * 137.5) % 360) * (Math.PI / 180);
    const r = (0.08 + ((i * 17) % 80) / 100) * Math.PI * 0.48;
    pos[i * 3] = 92 * Math.sin(r) * Math.cos(t);
    pos[i * 3 + 1] = 92 * Math.cos(r);
    pos[i * 3 + 2] = 92 * Math.sin(r) * Math.sin(t) - 18;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(
    geo,
    kit.mat(
      new THREE.PointsMaterial({
        color: 0xf4f8ff,
        size: 0.7,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: false,
      }),
    ),
  );
  pts.visible = false;
  pts.frustumCulled = false;
  return pts;
}

export function makeBallMesh(kit: AssetKit) {
  const mesh = instanced(
    kit.geo(new THREE.SphereGeometry(0.17, 10, 8)),
    kit.mat(
      new THREE.MeshStandardMaterial({
        color: 0xc5ced6,
        emissive: 0x7eb8c9,
        emissiveIntensity: 0.95,
        metalness: 0.42,
        roughness: 0.28,
      }),
    ),
    48,
  );
  return mesh;
}

export function makePileMesh(kit: AssetKit) {
  const mesh = instanced(
    kit.geo(new THREE.SphereGeometry(0.14, 8, 6)),
    kit.mat(
      new THREE.MeshStandardMaterial({
        color: 0xd5dde2,
        emissive: 0x5dbea3,
        emissiveIntensity: 0.55,
        metalness: 0.5,
        roughness: 0.3,
      }),
    ),
    36,
  );
  mesh.castShadow = false;
  return mesh;
}

export function makeLaneGlow(kit: AssetKit) {
  const mesh = new THREE.Mesh(
    kit.geo(new THREE.PlaneGeometry(1.9, 18)),
    kit.mat(new THREE.MeshBasicMaterial({ color: 0x5dbea3, transparent: true, opacity: 0.16, depthWrite: false })),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.03, -6);
  return mesh;
}

export function makeStreaks(kit: AssetKit, n: number) {
  const mat = kit.mat(
    new THREE.MeshBasicMaterial({ color: 0xc5d8dc, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  return instanced(kit.geo(new THREE.BoxGeometry(0.035, 0.035, 1.6)), mat, n);
}

export function makeParticleMesh(kit: AssetKit) {
  const mesh = instanced(
    kit.geo(new THREE.BoxGeometry(0.16, 0.16, 0.16)),
    kit.mat(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    180,
  );
  return mesh;
}

export type WorldHandles = {
  renderer: THREE.WebGLRenderer;
  fog: THREE.Fog;
  skyMat: THREE.ShaderMaterial;
  sunMesh: THREE.Mesh;
  earth: THREE.Object3D;
  groundMat: THREE.MeshStandardMaterial;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  trackTex: THREE.CanvasTexture;
  brickTex: THREE.CanvasTexture;
  rockTex: THREE.CanvasTexture;
  plateMat: THREE.MeshStandardMaterial;
  railMat: THREE.MeshStandardMaterial;
  pillarMat: THREE.MeshStandardMaterial;
  cliffMat: THREE.MeshStandardMaterial;
  moteMat: THREE.MeshBasicMaterial;
  streakMat: THREE.MeshBasicMaterial;
  laneGlow: THREE.MeshBasicMaterial;
  ballMat: THREE.MeshStandardMaterial;
  pileMat: THREE.MeshStandardMaterial;
  rim: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  core: THREE.MeshBasicMaterial;
  kelpMat: THREE.MeshStandardMaterial;
  coralMat: THREE.MeshStandardMaterial;
  trunkMat: THREE.MeshStandardMaterial;
  canopyMat: THREE.MeshStandardMaterial;
  hillMat: THREE.MeshStandardMaterial;
  cloudMat: THREE.MeshBasicMaterial;
  craterMat: THREE.MeshStandardMaterial;
  kelp: THREE.InstancedMesh;
  coral: THREE.InstancedMesh;
  trunks: THREE.InstancedMesh;
  canopies: THREE.InstancedMesh;
  hills: THREE.InstancedMesh;
  clouds: THREE.InstancedMesh;
  craters: THREE.InstancedMesh;
  stars: THREE.Points;
  cliffs: THREE.InstancedMesh;
  pillars: THREE.InstancedMesh;
  rails: THREE.InstancedMesh;
};

export function applyWorld(h: WorldHandles, id: ThemeId) {
  const t = THEMES[id];
  h.renderer.setClearColor(t.fog, 1);
  h.renderer.toneMappingExposure = t.exposure;
  h.fog.color.setHex(t.fog);
  h.fog.near = t.fogNear;
  h.fog.far = t.fogFar;
  const u = h.skyMat.uniforms;
  u.uZenith.value.setHex(t.zenith);
  u.uHorizon.value.setHex(t.horizon);
  u.uGround.value.setHex(t.skyGround);
  u.uSunDir.value.set(...t.sunDir).normalize();
  u.uSunCol.value.setHex(t.sunMesh);
  u.uSunPow.value = t.sunPow;
  u.uStars.value = +(id === "luna");
  u.uCaustic.value = +(id === "reef");
  u.uClouds.value = +(id === "toon" || id === "frost");
  u.uSnow.value = +(id === "frost");
  u.uDune.value = +(id === "dune");
  (h.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(t.sunMesh);
  h.sunMesh.scale.setScalar(t.sunSize);
  h.earth.visible = id === "luna";
  h.groundMat.color.setHex(t.ground);
  h.hemi.color.setHex(t.hemiSky);
  h.hemi.groundColor.setHex(t.hemiGround);
  h.hemi.intensity = t.hemiInt;
  h.sun.color.setHex(t.sunLight);
  h.sun.intensity = t.sunInt;
  h.fill.color.setHex(t.fill);
  h.fill.intensity = t.fillInt;
  h.ambient.color.setHex(t.ambient);
  paintTrack(h.trackTex, t);
  paintBrick(h.brickTex, t);
  paintRock(h.rockTex, t);
  h.plateMat.color.setHex(t.plate);
  h.railMat.color.setHex(t.rail);
  h.pillarMat.color.setHex(t.pillar);
  h.cliffMat.color.setHex(t.cliff);
  h.moteMat.color.setHex(t.mote);
  h.moteMat.opacity = id === "luna" ? 0.9 : id === "reef" ? 0.55 : id === "frost" ? 0.75 : id === "dune" ? 0.45 : id === "toon" ? 0.35 : 0.42;
  h.streakMat.color.setHex(t.streak);
  h.laneGlow.color.setHex(t.laneGlow);
  h.ballMat.color.setHex(t.ball);
  h.ballMat.emissive.setHex(t.gem);
  h.pileMat.emissive.setHex(t.pileEmissive);
  h.rim.color.setHex(t.rim);
  h.rim.emissive.setHex(t.rim);
  h.copper.color.setHex(t.copper);
  h.metal.color.setHex(t.metal);
  h.core.color.setHex(t.gem);
  h.metal.metalness = id === "luna" ? 0.92 : id === "toon" ? 0.18 : id === "reef" ? 0.35 : 0.74;
  h.cliffMat.flatShading = id !== "reef";
  h.kelpMat.color.setHex(t.kelp);
  h.coralMat.color.setHex(t.coral);
  h.trunkMat.color.setHex(t.trunk);
  h.canopyMat.color.setHex(t.canopy);
  h.hillMat.color.setHex(t.hill);
  h.cloudMat.color.setHex(t.cloud);
  h.craterMat.color.setHex(t.crater);
  h.kelp.visible = id === "reef";
  h.coral.visible = id === "reef";
  h.trunks.visible = id === "toon" || id === "frost";
  h.canopies.visible = id === "toon" || id === "frost";
  h.hills.visible = id === "toon" || id === "reef" || id === "frost" || id === "dune";
  h.clouds.visible = id === "toon" || id === "frost";
  h.craters.visible = id === "luna";
  h.stars.visible = id === "luna";
  h.cliffs.visible = id === "forge" || id === "luna" || id === "dune";
  h.pillars.visible = id === "forge" || id === "luna";
  h.rails.visible = id === "forge" || id === "luna" || id === "dune";
}
