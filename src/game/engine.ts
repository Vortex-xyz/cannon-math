import * as THREE from "three";
import {
  BASE_SPEED,
  DESPAWN_Z,
  FIRE_BASE,
  FIXED_DT,
  HIT_Z,
  HIT_Z_MIN,
  LANE_COUNT,
  LANE_TWEEN,
  LANE_X,
  MAX_SPEED,
  SAVE_VERSION,
  SPAWN_BASE,
  SPEED_PER_METER,
  START_POWER,
  TITLE_SPEED,
  TRACK_WIDTH,
} from "./config";
import { GameAudio } from "./audio";
import { GameInput } from "./input";
import { applyOp, fairWallHp, mulberry32, opLabel, pickBaitOp, pickGoodOp, type Op } from "./math-ops";
import { loadPilot, loadSave, writeSave } from "./save";
import { useHud, type GamePhase } from "./store";
import { THEMES, type ThemeId } from "./themes";
import {
  AssetKit,
  applyWorld,
  drawLabel,
  makeAmmo,
  makeBallMesh,
  makeBarrel,
  makeBlock,
  makeBoostPickup,
  makeBrickTexture,
  makeCannon,
  makeCliffs,
  makeClouds,
  makeCoral,
  makeCraters,
  makeCrystal,
  makeEarth,
  makeFrostPickup,
  makeGate,
  makeGem,
  makeGhostPickup,
  makeGround,
  makeHills,
  makeKelp,
  makeLaneGlow,
  makeLaser,
  makeMagnetPickup,
  makeMine,
  makeMotes,
  makeParticleMesh,
  makePileMesh,
  makePillars,
  makeRails,
  makeRam,
  makeRockTexture,
  makeSaw,
  makeShieldPickup,
  makeSky,
  makeSpike,
  makeStars,
  makeStreaks,
  makeSun,
  makeTrackPlates,
  makeTrackTexture,
  makeTreeCanopies,
  makeTreeTrunks,
  makeWall,
  makeLabel,
  tintGate,
  type CannonHandle,
  type LabelHandle,
} from "./visuals";
import { VEHICLES, VEHICLE_LIST, type VehicleId } from "./vehicles";
import { isPilotName, isPlayerId } from "./names";

type Kind =
  | "gate"
  | "wall"
  | "gem"
  | "block"
  | "ammo"
  | "shield"
  | "barrel"
  | "saw"
  | "crystal"
  | "magnet"
  | "mine"
  | "spike"
  | "laser"
  | "ram"
  | "boost"
  | "frost"
  | "ghost";

type Ent = {
  kind: Kind;
  active: boolean;
  root: THREE.Object3D;
  z: number;
  x: number;
  lanes: [boolean, boolean, boolean];
  op?: Op;
  hp: number;
  maxHp: number;
  consumed: boolean;
  label?: LabelHandle;
  bodyMat?: THREE.MeshStandardMaterial;
  glowMat?: THREE.MeshBasicMaterial;
  frameMat?: THREE.MeshStandardMaterial;
  bob: number;
  width: number;
  pulse: number;
  value: number;
  slide: boolean;
  baseX: number;
  slideAmp: number;
  tuned: boolean;
};

type Ball = { alive: boolean; x: number; y: number; z: number; vx: number; vz: number; life: number; s: number };
type Spark = {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  s: number;
  color: THREE.Color;
};
type Floater = {
  alive: boolean;
  label: LabelHandle;
  x: number;
  y: number;
  z: number;
  life: number;
  max: number;
};

const dummy = new THREE.Object3D();
const _cam = new THREE.Vector3();
const _look = new THREE.Vector3();

let instance: GameEngine | null = null;
export function getGame() {
  return instance;
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getLane: () => number;
      getPower: () => number;
      getWallHp: () => number | null;
      setKeys: (keys: string[]) => void;
      setSteer: (v: number) => void;
      die: () => void;
    };
  }
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private kit = new AssetKit();
  private input = new GameInput();
  private audio = new GameAudio();
  private running = false;
  private disposed = false;
  private acc = 0;
  private lastT = 0;
  private elapsed = 0;

  private phase: GamePhase = "title";
  private lane = 1;
  private playerX = 0;
  private fromX = 0;
  private toX = 0;
  private laneT = 1;
  private switching = false;
  private queuedLane: number | null = null;
  private power = START_POWER;
  private gems = 0;
  private runGems = 0;
  private shielded = false;
  private magnetT = 0;
  private boostT = 0;
  private frostT = 0;
  private ghostT = 0;
  private distance = 0;
  private combo = 0;
  private wallsBroken = 0;
  private score = 0;
  private speed = TITLE_SPEED;
  private lastSpawnZ = 0;
  private forecast = START_POWER;
  private intro = 0;
  private stage = 0;
  private rng = mulberry32((Math.random() * 1e9) | 0);
  private afterGates = false;
  private fireAcc = 0;
  private recoil = 0;
  private trauma = 0;
  private hitstop = 0;
  private punch = 0;
  private lastHud = 0;
  private muted = false;
  private shakeOn = true;
  private highScore = 0;
  private lastOp: string | null = null;
  private lastOpAt = 0;
  private wallHp: number | null = null;
  private dustAcc = 0;
  private theme: ThemeId = "forge";
  private highScores: Record<ThemeId, number> = { forge: 0, reef: 0, toon: 0, luna: 0, frost: 0, dune: 0 };
  private wallet = 80;
  private vehicle: VehicleId = "rig";
  private owned: VehicleId[] = ["rig"];
  private shopHint = "";
  private lastDaily = "";
  private playerName = "Ion Fox";
  private playerId = "00000000000000000000000000000000";
  private menuOpen = false;
  private fleet: Record<VehicleId, CannonHandle> = {} as Record<VehicleId, CannonHandle>;

  private cannon: ReturnType<typeof makeCannon>;
  private shieldFx!: THREE.Mesh;
  private magnetFx!: THREE.Mesh;
  private boostFx!: THREE.Mesh;
  private frostFx!: THREE.Mesh;
  private ghostFx!: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private laneGlow: THREE.Mesh;
  private skyMat!: THREE.ShaderMaterial;
  private sunMesh!: THREE.Mesh;
  private earth!: THREE.Mesh;
  private groundMat!: THREE.MeshStandardMaterial;
  private hemi!: THREE.HemisphereLight;
  private sunLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private trackTex!: THREE.CanvasTexture;
  private brickTex!: THREE.CanvasTexture;
  private rockTex!: THREE.CanvasTexture;
  private plateMesh: THREE.InstancedMesh;
  private plateZ: Float32Array;
  private railMesh: THREE.InstancedMesh;
  private railZ: Float32Array;
  private railSide: Int8Array;
  private pillarMesh: THREE.InstancedMesh;
  private pillarZ: Float32Array;
  private pillarX: Float32Array;
  private cliffMesh: THREE.InstancedMesh;
  private cliffZ: Float32Array;
  private cliffSide: Int8Array;
  private cliffSy: Float32Array;
  private moteMesh: THREE.InstancedMesh;
  private moteX: Float32Array;
  private moteY: Float32Array;
  private moteZ: Float32Array;
  private streakMesh: THREE.InstancedMesh;
  private streakX: Float32Array;
  private streakY: Float32Array;
  private streakZ: Float32Array;
  private kelpMesh!: THREE.InstancedMesh;
  private kelpZ!: Float32Array;
  private kelpSide!: Int8Array;
  private kelpSy!: Float32Array;
  private coralMesh!: THREE.InstancedMesh;
  private coralZ!: Float32Array;
  private coralX!: Float32Array;
  private coralS!: Float32Array;
  private trunkMesh!: THREE.InstancedMesh;
  private canopyMesh!: THREE.InstancedMesh;
  private treeZ!: Float32Array;
  private treeX!: Float32Array;
  private hillMesh!: THREE.InstancedMesh;
  private hillZ!: Float32Array;
  private hillSide!: Int8Array;
  private hillS!: Float32Array;
  private cloudMesh!: THREE.InstancedMesh;
  private cloudZ!: Float32Array;
  private cloudX!: Float32Array;
  private cloudY!: Float32Array;
  private craterMesh!: THREE.InstancedMesh;
  private craterZ!: Float32Array;
  private craterX!: Float32Array;
  private craterS!: Float32Array;
  private stars!: THREE.Points;
  private ents: Ent[] = [];
  private balls: Ball[] = [];
  private ballMesh: THREE.InstancedMesh;
  private pileMesh: THREE.InstancedMesh;
  private sparks: Spark[] = [];
  private sparkMesh: THREE.InstancedMesh;
  private sparkColors: THREE.InstancedBufferAttribute;
  private floaters: Floater[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const save = loadSave();
    const pilot = loadPilot();
    this.muted = save.muted;
    this.shakeOn = save.shake;
    this.theme = save.theme;
    this.highScores = { ...save.highScores };
    this.highScore = this.highScores[this.theme] ?? 0;
    this.wallet = save.wallet;
    this.vehicle = save.vehicle;
    this.owned = [...save.owned];
    this.lastDaily = save.lastDaily;
    this.playerId = pilot.playerId;
    this.playerName = pilot.playerName;
    this.gems = this.wallet;
    this.audio.setMuted(this.muted);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.setClearColor(0x0c151c, 1);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0c151c, 28, 100);

    this.camera = new THREE.PerspectiveCamera(56, 1, 0.1, 220);
    this.camera.position.set(0, 2.55, 7.6);

    const sky = makeSky(this.kit);
    this.skyMat = sky.material as THREE.ShaderMaterial;
    this.scene.add(sky);
    this.sunMesh = makeSun(this.kit);
    this.scene.add(this.sunMesh);
    this.earth = makeEarth(this.kit);
    this.scene.add(this.earth);
    const ground = makeGround(this.kit);
    this.groundMat = ground.material as THREE.MeshStandardMaterial;
    this.scene.add(ground);
    this.hemi = new THREE.HemisphereLight(0x9bb8c6, 0x152026, 0.82);
    this.scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight(0xe8f0f4, 1.02);
    this.sunLight.position.set(6, 14, 8);
    this.scene.add(this.sunLight);
    this.fillLight = new THREE.DirectionalLight(0x5dbea3, 0.28);
    this.fillLight.position.set(-4, 6, -12);
    this.scene.add(this.fillLight);
    this.ambientLight = new THREE.AmbientLight(0x1a2830, 0.32);
    this.scene.add(this.ambientLight);

    this.muzzleLight = new THREE.PointLight(0x9ed8d0, 0, 8);
    this.muzzleLight.position.set(0, 0.9, -1.4);
    this.scene.add(this.muzzleLight);

    this.trackTex = makeTrackTexture(this.kit);
    this.plateMesh = makeTrackPlates(this.kit, this.trackTex, 16);
    this.plateZ = new Float32Array(16);
    for (let i = 0; i < 16; i++) this.plateZ[i] = -i * 10 + 20;
    this.scene.add(this.plateMesh);

    this.railMesh = makeRails(this.kit, 32);
    this.railZ = new Float32Array(32);
    this.railSide = new Int8Array(32);
    for (let i = 0; i < 16; i++) {
      this.railZ[i * 2] = -i * 10 + 20;
      this.railZ[i * 2 + 1] = -i * 10 + 20;
      this.railSide[i * 2] = -1;
      this.railSide[i * 2 + 1] = 1;
    }
    this.scene.add(this.railMesh);

    this.pillarMesh = makePillars(this.kit, 18);
    this.pillarZ = new Float32Array(18);
    this.pillarX = new Float32Array(18);
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.pillarZ[i] = -i * 9;
      this.pillarX[i] = side * (5.4 + (i % 3) * 0.35);
    }
    this.scene.add(this.pillarMesh);

    this.rockTex = makeRockTexture(this.kit);
    this.cliffMesh = makeCliffs(this.kit, this.rockTex, 24);
    this.cliffZ = new Float32Array(24);
    this.cliffSide = new Int8Array(24);
    this.cliffSy = new Float32Array(24);
    for (let i = 0; i < 24; i++) {
      this.cliffZ[i] = -i * 14 + 18;
      this.cliffSide[i] = i % 2 === 0 ? -1 : 1;
      this.cliffSy[i] = 0.82 + (i % 5) * 0.08;
    }
    this.scene.add(this.cliffMesh);

    this.moteMesh = makeMotes(this.kit, 40);
    this.moteX = new Float32Array(40);
    this.moteY = new Float32Array(40);
    this.moteZ = new Float32Array(40);
    for (let i = 0; i < 40; i++) {
      this.moteX[i] = (this.rng() - 0.5) * 12;
      this.moteY[i] = 0.5 + this.rng() * 3.2;
      this.moteZ[i] = -this.rng() * 80;
    }
    this.scene.add(this.moteMesh);

    this.kelpMesh = makeKelp(this.kit, 20);
    this.kelpZ = new Float32Array(20);
    this.kelpSide = new Int8Array(20);
    this.kelpSy = new Float32Array(20);
    for (let i = 0; i < 20; i++) {
      this.kelpZ[i] = -i * 8 + 10;
      this.kelpSide[i] = i % 2 === 0 ? -1 : 1;
      this.kelpSy[i] = 0.75 + (i % 4) * 0.18;
    }
    this.scene.add(this.kelpMesh);

    this.coralMesh = makeCoral(this.kit, 16);
    this.coralZ = new Float32Array(16);
    this.coralX = new Float32Array(16);
    this.coralS = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.coralZ[i] = -i * 10 + 8;
      this.coralX[i] = side * (4.6 + (i % 3) * 0.55);
      this.coralS[i] = 0.7 + (i % 4) * 0.28;
    }
    this.scene.add(this.coralMesh);

    this.trunkMesh = makeTreeTrunks(this.kit, 14);
    this.canopyMesh = makeTreeCanopies(this.kit, 14);
    this.treeZ = new Float32Array(14);
    this.treeX = new Float32Array(14);
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.treeZ[i] = -i * 12 + 6;
      this.treeX[i] = side * (5.8 + (i % 3) * 0.4);
    }
    this.scene.add(this.trunkMesh);
    this.scene.add(this.canopyMesh);

    this.hillMesh = makeHills(this.kit, 14);
    this.hillZ = new Float32Array(14);
    this.hillSide = new Int8Array(14);
    this.hillS = new Float32Array(14);
    for (let i = 0; i < 14; i++) {
      this.hillZ[i] = -i * 16 + 12;
      this.hillSide[i] = i % 2 === 0 ? -1 : 1;
      this.hillS[i] = 5.5 + (i % 3) * 1.1;
    }
    this.scene.add(this.hillMesh);

    this.cloudMesh = makeClouds(this.kit, 10);
    this.cloudZ = new Float32Array(10);
    this.cloudX = new Float32Array(10);
    this.cloudY = new Float32Array(10);
    for (let i = 0; i < 10; i++) {
      this.cloudZ[i] = -i * 18 - 8;
      this.cloudX[i] = (i % 2 === 0 ? -1 : 1) * (8 + (i % 3) * 2);
      this.cloudY[i] = 8 + (i % 4) * 1.4;
    }
    this.scene.add(this.cloudMesh);

    this.craterMesh = makeCraters(this.kit, 16);
    this.craterZ = new Float32Array(16);
    this.craterX = new Float32Array(16);
    this.craterS = new Float32Array(16);
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.craterZ[i] = -i * 12 + 4;
      this.craterX[i] = side * (6.2 + (i % 3) * 0.8);
      this.craterS[i] = 0.8 + (i % 4) * 0.35;
    }
    this.scene.add(this.craterMesh);

    this.stars = makeStars(this.kit);
    this.scene.add(this.stars);

    this.streakMesh = makeStreaks(this.kit, 28);
    this.streakX = new Float32Array(28);
    this.streakY = new Float32Array(28);
    this.streakZ = new Float32Array(28);
    for (let i = 0; i < 28; i++) {
      this.streakX[i] = (this.rng() - 0.5) * 9;
      this.streakY[i] = 0.4 + this.rng() * 2.6;
      this.streakZ[i] = -this.rng() * 40;
    }
    this.scene.add(this.streakMesh);

    this.cannon = makeCannon(this.kit, this.vehicle);
    this.scene.add(this.cannon.root);
    for (const spec of VEHICLE_LIST) {
      if (spec.id === this.vehicle) {
        this.fleet[spec.id] = this.cannon;
        continue;
      }
      const rig = makeCannon(this.kit, spec.id);
      rig.root.visible = false;
      this.scene.add(rig.root);
      this.fleet[spec.id] = rig;
    }
    this.shieldFx = new THREE.Mesh(
      this.kit.geo(new THREE.SphereGeometry(1.18, 16, 12)),
      this.kit.mat(
        new THREE.MeshBasicMaterial({
          color: 0x7ee0d4,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
        }),
      ),
    );
    this.shieldFx.position.y = 0.7;
    this.shieldFx.visible = false;
    this.cannon.root.add(this.shieldFx);
    this.magnetFx = new THREE.Mesh(
      this.kit.geo(new THREE.TorusGeometry(1.05, 0.045, 8, 20)),
      this.kit.mat(
        new THREE.MeshBasicMaterial({
          color: 0xc45c4a,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      ),
    );
    this.magnetFx.rotation.x = Math.PI / 2;
    this.magnetFx.position.y = 0.55;
    this.magnetFx.visible = false;
    this.cannon.root.add(this.magnetFx);
    this.boostFx = this.auraRing(0xffd060, 1.28);
    this.frostFx = this.auraRing(0x9fd8ff, 1.42);
    this.ghostFx = this.auraRing(0xc8b0ff, 1.15);
    this.cannon.root.add(this.boostFx, this.frostFx, this.ghostFx);

    this.pileMesh = makePileMesh(this.kit);
    this.cannon.root.add(this.pileMesh);

    this.laneGlow = makeLaneGlow(this.kit);
    this.scene.add(this.laneGlow);

    this.ballMesh = makeBallMesh(this.kit);
    this.scene.add(this.ballMesh);
    for (let i = 0; i < 48; i++) this.balls.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vz: 0, life: 0, s: 1 });

    this.sparkMesh = makeParticleMesh(this.kit);
    this.sparkMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(180 * 3), 3);
    this.sparkColors = this.sparkMesh.instanceColor;
    this.scene.add(this.sparkMesh);
    for (let i = 0; i < 180; i++) {
      this.sparks.push({
        alive: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        max: 1,
        s: 0.16,
        color: new THREE.Color(),
      });
    }
    for (let i = 0; i < 8; i++) {
      const label = makeLabel(this.kit, 1.35, 0.78);
      label.mesh.visible = false;
      this.scene.add(label.mesh);
      this.floaters.push({ alive: false, label, x: 0, y: 0, z: 0, life: 0, max: 0.7 });
    }

    this.buildPools();
    this.resetWorld(true);
    this.syncScenery();
    this.input.bind(canvas);
    this.bindResize();
    this.resize();
    this.installProbe();
    this.applyTheme(this.theme, false);
    this.persist();
    this.pushHud(true);
    instance = this;
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastT = 0;
    this.renderer.setAnimationLoop(this.tick);
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.audio.stopRun();
    this.input.dispose();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.kit.dispose();
    this.renderer.dispose();
    if (instance === this) instance = null;
    if (window.__controlsTest) delete window.__controlsTest;
  }

  play() {
    this.audio.unlock();
    this.audio.playStart();
    this.resetWorld(false);
    const spec = VEHICLES[this.vehicle];
    this.power = spec.startPower;
    this.shielded = spec.startShield;
    this.phase = "playing";
    this.speed = BASE_SPEED * spec.speed;
    this.audio.startRun();
    this.pushHud(true);
  }

  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.audio.stopRun();
    this.persist();
    this.pushHud(true);
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.audio.unlock();
    this.audio.startRun();
    this.pushHud(true);
  }

  toTitle() {
    this.audio.stopRun();
    this.persist();
    this.resetWorld(true);
    this.phase = "title";
    this.speed = TITLE_SPEED;
    this.pushHud(true);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
    this.persist();
    this.pushHud(true);
  }

  toggleShake() {
    this.shakeOn = !this.shakeOn;
    this.persist();
    this.pushHud(true);
  }

  setTheme(id: ThemeId) {
    if (this.theme === id) return;
    this.applyTheme(id, true);
  }

  setUiLeft(v: boolean) {
    this.input.uiLeft = v;
  }
  setUiRight(v: boolean) {
    this.input.uiRight = v;
  }

  setVehicle(id: VehicleId) {
    if (!this.owned.includes(id)) {
      this.buyVehicle(id);
      return;
    }
    if (this.vehicle === id) return;
    this.mountVehicle(id);
    this.shopHint = `${VEHICLES[id].name} ready`;
    this.persist();
    this.pushHud(true);
  }

  setMenuOpen(open: boolean) {
    this.menuOpen = open;
  }

  claimDaily() {
    const day = new Date().toISOString().slice(0, 10);
    if (this.lastDaily === day) {
      this.shopHint = "Come back tomorrow";
      this.pushHud(true);
      return;
    }
    this.lastDaily = day;
    this.wallet += 30;
    this.gems = this.wallet;
    this.shopHint = "Daily +30 gems";
    this.audio.playCrystal();
    this.persist();
    this.pushHud(true);
  }

  setPlayerName(name: string) {
    if (!isPilotName(name) || name === this.playerName) return;
    this.playerName = name;
    this.persist();
    this.pushHud(true);
  }

  buyVehicle(id: VehicleId) {
    const spec = VEHICLES[id];
    if (this.owned.includes(id)) {
      this.setVehicle(id);
      return;
    }
    if (this.wallet < spec.price) {
      this.shopHint = `Need ${spec.price - this.wallet} more gems`;
      this.audio.playGate(false);
      this.pushHud(true);
      return;
    }
    this.wallet -= spec.price;
    this.gems = this.wallet;
    this.owned = [...this.owned, id];
    this.mountVehicle(id);
    this.shopHint = `Bought ${spec.name}`;
    this.audio.playCrystal();
    this.persist();
    this.pushHud(true);
  }

  private auraRing(color: number, radius: number) {
    const mesh = new THREE.Mesh(
      this.kit.geo(new THREE.TorusGeometry(radius, 0.04, 8, 22)),
      this.kit.mat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false })),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 0.35;
    mesh.visible = false;
    return mesh;
  }

  private spinAura(mesh: THREE.Mesh, on: boolean, t: number, dt: number, spin: number) {
    mesh.visible = on;
    if (!on) return;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.35 + Math.sin(t * 7) * 0.15;
    mesh.rotation.z += dt * spin;
  }

  private mountVehicle(id: VehicleId) {
    this.cannon.root.remove(this.shieldFx);
    this.cannon.root.remove(this.magnetFx);
    this.cannon.root.remove(this.boostFx);
    this.cannon.root.remove(this.frostFx);
    this.cannon.root.remove(this.ghostFx);
    this.cannon.root.remove(this.pileMesh);
    this.cannon.root.visible = false;
    this.vehicle = id;
    this.cannon = this.fleet[id];
    this.cannon.root.visible = true;
    this.cannon.root.add(this.shieldFx);
    this.cannon.root.add(this.magnetFx);
    this.cannon.root.add(this.boostFx);
    this.cannon.root.add(this.frostFx);
    this.cannon.root.add(this.ghostFx);
    this.cannon.root.add(this.pileMesh);
    this.tintCannon();
  }

  private tintCannon() {
    const p = VEHICLES[this.vehicle].paint;
    this.cannon.rim.color.setHex(p.rim);
    this.cannon.rim.emissive.setHex(p.rim);
    this.cannon.copper.color.setHex(p.copper);
    this.cannon.metal.color.setHex(p.metal);
    this.cannon.steel.color.setHex(p.steel);
    this.cannon.dark.color.setHex(p.dark);
    (this.cannon.core.material as THREE.MeshBasicMaterial).color.setHex(p.rim);
  }

  private applyTheme(id: ThemeId, persist: boolean) {
    this.theme = id;
    this.highScore = this.highScores[id] ?? 0;
    applyWorld(
      {
        renderer: this.renderer,
        fog: this.scene.fog as THREE.Fog,
        skyMat: this.skyMat,
        sunMesh: this.sunMesh,
        earth: this.earth,
        groundMat: this.groundMat,
        hemi: this.hemi,
        sun: this.sunLight,
        fill: this.fillLight,
        ambient: this.ambientLight,
        trackTex: this.trackTex,
        brickTex: this.brickTex,
        rockTex: this.rockTex,
        plateMat: this.plateMesh.material as THREE.MeshStandardMaterial,
        railMat: this.railMesh.material as THREE.MeshStandardMaterial,
        pillarMat: this.pillarMesh.material as THREE.MeshStandardMaterial,
        cliffMat: this.cliffMesh.material as THREE.MeshStandardMaterial,
        moteMat: this.moteMesh.material as THREE.MeshBasicMaterial,
        streakMat: this.streakMesh.material as THREE.MeshBasicMaterial,
        laneGlow: this.laneGlow.material as THREE.MeshBasicMaterial,
        ballMat: this.ballMesh.material as THREE.MeshStandardMaterial,
        pileMat: this.pileMesh.material as THREE.MeshStandardMaterial,
        rim: this.cannon.rim,
        copper: this.cannon.copper,
        metal: this.cannon.metal,
        core: this.cannon.core.material as THREE.MeshBasicMaterial,
        kelpMat: this.kelpMesh.material as THREE.MeshStandardMaterial,
        coralMat: this.coralMesh.material as THREE.MeshStandardMaterial,
        trunkMat: this.trunkMesh.material as THREE.MeshStandardMaterial,
        canopyMat: this.canopyMesh.material as THREE.MeshStandardMaterial,
        hillMat: this.hillMesh.material as THREE.MeshStandardMaterial,
        cloudMat: this.cloudMesh.material as THREE.MeshBasicMaterial,
        craterMat: this.craterMesh.material as THREE.MeshStandardMaterial,
        kelp: this.kelpMesh,
        coral: this.coralMesh,
        trunks: this.trunkMesh,
        canopies: this.canopyMesh,
        hills: this.hillMesh,
        clouds: this.cloudMesh,
        craters: this.craterMesh,
        stars: this.stars,
        cliffs: this.cliffMesh,
        pillars: this.pillarMesh,
        rails: this.railMesh,
      },
      id,
    );
    for (const e of this.ents) {
      if (e.kind === "gem") {
        const mesh = e.root as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.setHex(THEMES[id].gem);
        mat.emissive.setHex(THEMES[id].gem);
        mat.emissiveIntensity = 0.7;
      } else if (e.kind === "ammo" && e.bodyMat) {
        e.bodyMat.color.setHex(THEMES[id].ball);
        e.bodyMat.emissive.setHex(THEMES[id].pileEmissive);
      } else if (e.kind === "shield" && e.bodyMat) {
        e.bodyMat.color.setHex(THEMES[id].laneGlow);
        e.bodyMat.emissive.setHex(THEMES[id].laneGlow);
      } else if (e.kind === "barrel" && e.bodyMat) {
        e.bodyMat.color.setHex(THEMES[id].copper);
      } else if (e.kind === "saw" && e.bodyMat) {
        e.bodyMat.color.setHex(THEMES[id].metal);
        e.bodyMat.emissive.setHex(0xc45c4a);
      } else if (e.kind === "crystal" && e.bodyMat) {
        e.bodyMat.color.setHex(0xe8c878);
        e.bodyMat.emissive.setHex(0xb88830);
      } else if (e.kind === "mine" && e.bodyMat) {
        e.bodyMat.emissive.setHex(0xc45c4a);
      }
    }
    for (let i = 0; i < this.moteZ.length; i++) {
      if (id === "luna") {
        this.moteY[i] = 3.2 + this.rng() * 8;
        this.moteX[i] = (this.rng() - 0.5) * 28;
      } else if (id === "reef") {
        this.moteY[i] = 0.4 + this.rng() * 4.5;
        this.moteX[i] = (this.rng() - 0.5) * 10;
      } else {
        this.moteY[i] = 0.5 + this.rng() * 3.2;
        this.moteX[i] = (this.rng() - 0.5) * 12;
      }
    }
    this.tintCannon();
    if (persist) this.persist();
    this.pushHud(true);
  }

  private persist() {
    if (!this.playerId || this.playerId.startsWith("0000")) return;
    writeSave({
      version: SAVE_VERSION,
      highScore: Math.max(...Object.values(this.highScores)),
      highScores: this.highScores,
      theme: this.theme,
      muted: this.muted,
      shake: this.shakeOn,
      wallet: this.wallet,
      vehicle: this.vehicle,
      owned: this.owned,
      lastDaily: this.lastDaily,
      playerName: this.playerName,
      playerId: this.playerId,
    });
  }

  private baseEnt(kind: Kind, root: THREE.Object3D, extra: Partial<Ent> = {}): Ent {
    return {
      kind,
      active: false,
      root,
      z: 0,
      x: 0,
      lanes: [false, false, false],
      hp: 0,
      maxHp: 0,
      consumed: false,
      bob: 0,
      width: 1,
      pulse: 0,
      value: 0,
      slide: false,
      baseX: 0,
      slideAmp: 0,
      tuned: false,
      ...extra,
    };
  }

  private buildPools() {
    this.brickTex = makeBrickTexture(this.kit);
    for (let i = 0; i < 24; i++) {
      const g = makeGate(this.kit);
      g.root.visible = false;
      this.scene.add(g.root);
      const glowMat = g.glow.material;
      this.ents.push(
        this.baseEnt("gate", g.root, {
          label: g.label,
          glowMat: Array.isArray(glowMat)
            ? (glowMat[0] as THREE.MeshBasicMaterial)
            : (glowMat as THREE.MeshBasicMaterial),
          frameMat: g.frame,
          width: 1.8,
        }),
      );
    }
    for (let i = 0; i < 8; i++) {
      const w = makeWall(this.kit, this.brickTex);
      w.root.visible = false;
      this.scene.add(w.root);
      this.ents.push(this.baseEnt("wall", w.root, { label: w.label, bodyMat: w.bodyMat, width: 2 }));
    }
    for (let i = 0; i < 36; i++) {
      const gem = makeGem(this.kit);
      gem.visible = false;
      this.scene.add(gem);
      this.ents.push(this.baseEnt("gem", gem, { bob: this.rng() * Math.PI * 2, width: 0.5 }));
    }
    for (let i = 0; i < 12; i++) {
      const b = makeBlock(this.kit);
      b.visible = false;
      this.scene.add(b);
      this.ents.push(this.baseEnt("block", b, { width: 1.6 }));
    }
    for (let i = 0; i < 32; i++) {
      const a = makeAmmo(this.kit);
      a.root.visible = false;
      this.scene.add(a.root);
      this.ents.push(this.baseEnt("ammo", a.root, { label: a.label, bodyMat: a.mat, width: 0.55, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 4; i++) {
      const s = makeShieldPickup(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("shield", s.root, { bodyMat: s.mat, width: 0.7, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 10; i++) {
      const b = makeBarrel(this.kit);
      b.root.visible = false;
      this.scene.add(b.root);
      this.ents.push(this.baseEnt("barrel", b.root, { label: b.label, bodyMat: b.bodyMat, width: 1.1 }));
    }
    for (let i = 0; i < 8; i++) {
      const s = makeSaw(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("saw", s.root, { bodyMat: s.mat, width: 1.7, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 8; i++) {
      const s = makeSpike(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("spike", s.root, { bodyMat: s.mat, width: 1.5, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 6; i++) {
      const s = makeLaser(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("laser", s.root, { bodyMat: s.mat, width: 1.2, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 4; i++) {
      const s = makeRam(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("ram", s.root, { bodyMat: s.mat, width: 3.3, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 4; i++) {
      const s = makeBoostPickup(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("boost", s.root, { bodyMat: s.mat, width: 0.7, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 4; i++) {
      const s = makeFrostPickup(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("frost", s.root, { bodyMat: s.mat, width: 0.7, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 4; i++) {
      const s = makeGhostPickup(this.kit);
      s.root.visible = false;
      this.scene.add(s.root);
      this.ents.push(this.baseEnt("ghost", s.root, { bodyMat: s.mat, width: 0.7, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 10; i++) {
      const c = makeCrystal(this.kit);
      c.root.visible = false;
      this.scene.add(c.root);
      this.ents.push(this.baseEnt("crystal", c.root, { label: c.label, bodyMat: c.mat, width: 0.7, bob: this.rng() * 6, value: 5 }));
    }
    for (let i = 0; i < 4; i++) {
      const m = makeMagnetPickup(this.kit);
      m.root.visible = false;
      this.scene.add(m.root);
      this.ents.push(this.baseEnt("magnet", m.root, { bodyMat: m.mat, width: 0.7, bob: this.rng() * 6 }));
    }
    for (let i = 0; i < 12; i++) {
      const m = makeMine(this.kit);
      m.root.visible = false;
      this.scene.add(m.root);
      this.ents.push(this.baseEnt("mine", m.root, { bodyMat: m.mat, width: 1.35, bob: this.rng() * 6 }));
    }
  }

  private resetWorld(title: boolean) {
    this.lane = 1;
    this.playerX = 0;
    this.fromX = 0;
    this.toX = 0;
    this.laneT = 1;
    this.switching = false;
    this.queuedLane = null;
    this.power = START_POWER;
    this.gems = this.wallet;
    this.runGems = 0;
    this.shielded = false;
    this.magnetT = 0;
    this.boostT = 0;
    this.frostT = 0;
    this.ghostT = 0;
    this.distance = 0;
    this.combo = 0;
    this.wallsBroken = 0;
    this.score = 0;
    this.forecast = START_POWER;
    this.intro = 0;
    this.stage = 0;
    this.afterGates = false;
    this.fireAcc = 0;
    this.recoil = 0;
    this.trauma = 0;
    this.hitstop = 0;
    this.punch = 0;
    this.lastOp = null;
    this.wallHp = null;
    this.lastSpawnZ = -8;
    this.dustAcc = 0;
    this.rng = mulberry32((Math.random() * 1e9) | 0);
    this.cannon.root.visible = true;
    this.cannon.root.scale.setScalar(1);
    this.cannon.flash.visible = false;
    for (const e of this.ents) this.recycle(e);
    for (const b of this.balls) b.alive = false;
    for (const s of this.sparks) s.alive = false;
    for (const f of this.floaters) {
      f.alive = false;
      f.label.mesh.visible = false;
    }
    this.speed = title ? TITLE_SPEED : BASE_SPEED;
    this.ensureSpawns();
  }

  private recycle(e: Ent) {
    e.active = false;
    e.root.visible = false;
    e.consumed = false;
    e.hp = 0;
    e.pulse = 0;
    e.value = 0;
    e.slide = false;
    e.tuned = false;
  }

  private take(kind: Kind): Ent | null {
    for (const e of this.ents) {
      if (e.kind === kind && !e.active) return e;
    }
    return null;
  }

  private activate(e: Ent, z: number, x: number, lanes: [boolean, boolean, boolean]) {
    e.active = true;
    e.consumed = false;
    e.pulse = 0;
    e.z = z;
    e.x = x;
    e.lanes = lanes;
    e.root.visible = true;
    e.root.position.set(x, 0, z);
  }

  private spawnAhead() {
    return SPAWN_BASE + this.speed * 1.35;
  }

  private ensureSpawns() {
    let guard = 0;
    while (this.lastSpawnZ > -this.spawnAhead() && guard++ < 24) {
      this.placePattern();
    }
  }

  private gap() {
    return 15 + this.rng() * 6 + this.speed * 0.12;
  }

  private placePattern() {
    if (this.phase === "title") {
      this.lastSpawnZ -= 22;
      if (this.rng() < 0.62) {
        this.spawnGates(this.lastSpawnZ, 0.05, [
          { kind: "add", value: 4 },
          { kind: "add", value: 8 },
          { kind: "add", value: 6 },
        ]);
      } else {
        this.spawnGems(this.lastSpawnZ, 1);
      }
      return;
    }
    if (this.intro < 5) {
      this.placeIntro();
      return;
    }
    const d = this.difficulty();
    if (this.stage === 0) {
      this.lastSpawnZ -= this.gap();
      if (this.rng() < 0.72) this.spawnPickupRun(this.lastSpawnZ + 7);
      this.spawnGates(this.lastSpawnZ, d);
      this.stage = 1;
    } else if (this.stage === 1) {
      this.lastSpawnZ -= this.gap() + 2;
      if (this.rng() < 0.6) this.spawnPickupRun(this.lastSpawnZ + 8);
      this.spawnWall(this.lastSpawnZ, d);
      this.stage = this.distance > 70 && this.rng() < 0.78 ? 2 : 0;
    } else {
      this.lastSpawnZ -= this.gap();
      this.spawnHazardPack(this.lastSpawnZ, d);
      if (this.rng() < 0.45) this.spawnPickupRun(this.lastSpawnZ + 6);
      this.stage = 0;
    }
  }

  private placeIntro() {
    const step = this.intro++;
    if (step === 0) {
      this.lastSpawnZ -= 16;
      this.spawnAmmoLine(this.lastSpawnZ, 1, 4, 1);
    } else if (step === 1) {
      this.lastSpawnZ -= 16;
      this.spawnGates(this.lastSpawnZ, 0, [
        { kind: "add", value: 4 },
        { kind: "add", value: 8 },
        { kind: "add", value: 6 },
      ]);
    } else if (step === 2) {
      this.lastSpawnZ -= 18;
      this.spawnWall(this.lastSpawnZ, 0, 4, [true, true, true]);
    } else if (step === 3) {
      this.lastSpawnZ -= 16;
      this.spawnGems(this.lastSpawnZ, 0);
      this.spawnBlockAt(this.lastSpawnZ - 4, 2);
    } else {
      this.lastSpawnZ -= 14;
      this.spawnAmmoLine(this.lastSpawnZ, 1, 3, 2);
      this.stage = 0;
    }
  }

  private difficulty() {
    return Math.max(0, Math.min(1, this.distance / 950));
  }

  private spawnGates(z: number, d: number, preset?: (Op | null)[]) {
    const ops: (Op | null)[] = preset ?? this.rollOps(d);
    for (let i = 0; i < 3; i++) {
      const op = ops[i];
      if (!op) continue;
      const e = this.take("gate");
      if (!e || !e.frameMat || !e.glowMat || !e.label) continue;
      this.activate(e, z, LANE_X[i], [i === 0, i === 1, i === 2]);
      e.op = op;
      tintGate(e.frameMat, e.glowMat, op);
      drawLabel(e.label, opLabel(op), "#eef1f4", "rgba(9,11,16,0.82)");
    }
    this.forecast = this.power;
  }

  private rollOps(d: number): (Op | null)[] {
    const good = pickGoodOp(this.power, d, this.rng);
    const bait = pickBaitOp(this.power, d, this.rng);
    const slots: (Op | null)[] = [null, null, null];
    const a = Math.floor(this.rng() * 3);
    let b = Math.floor(this.rng() * 3);
    if (b === a) b = (b + 1) % 3;
    slots[a] = good;
    if (this.rng() < 0.72) slots[b] = bait;
    else if (this.rng() < 0.4) slots[b] = pickGoodOp(this.power, d, this.rng);
    return slots;
  }

  private spawnWall(z: number, d: number, hpOverride?: number, lanes?: [boolean, boolean, boolean]) {
    const e = this.take("wall");
    if (!e || !e.bodyMat || !e.label) return;
    let mask: [boolean, boolean, boolean];
    if (lanes) mask = lanes;
    else if (d < 0.12) {
      mask = [true, true, true];
    } else if (this.rng() < 0.42) {
      const open = Math.floor(this.rng() * 3);
      mask = [open !== 0, open !== 1, open !== 2];
    } else if (d > 0.28 && this.rng() < 0.35) {
      const only = Math.floor(this.rng() * 3);
      mask = [only === 0, only === 1, only === 2];
    } else {
      mask = [true, true, true];
    }
    const nLanes = mask.filter(Boolean).length;
    const hp = hpOverride ?? fairWallHp(this.power, nLanes, d, 0);
    const xs: number[] = [];
    mask.forEach((on, i) => {
      if (on) xs.push(LANE_X[i]);
    });
    const x = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
    this.activate(e, z, x, mask);
    e.hp = hp;
    e.maxHp = hp;
    e.tuned = hpOverride !== undefined;
    e.width = nLanes === 1 ? 2.05 : nLanes === 2 ? 4.3 : 6.6;
    e.root.scale.set(e.width, 2.35, 1);
    e.label.mesh.scale.set(1 / e.width, 1 / 2.35, 1);
    e.label.mesh.position.set(0, 0.62, 0.42);
    this.paintWall(e);
  }

  private fairHpFor(e: Ent) {
    const n = e.lanes.filter(Boolean).length;
    return fairWallHp(this.power, n, this.difficulty(), 0);
  }

  private retuneWalls() {
    const lockZ = -this.fireRange();
    for (const e of this.ents) {
      if (!e.active || e.kind !== "wall" || e.hp <= 0) continue;
      if (e.tuned) continue;
      if (e.z > lockZ) {
        const hp = this.fairHpFor(e);
        e.hp = hp;
        e.maxHp = hp;
        e.tuned = true;
        this.paintWall(e);
        continue;
      }
      const hp = this.fairHpFor(e);
      if (hp !== e.hp) {
        e.hp = hp;
        e.maxHp = hp;
        this.paintWall(e);
      }
    }
  }

  private paintWall(e: Ent) {
    if (!e.bodyMat || !e.label) return;
    const can = e.hp <= this.power;
    const col = can ? 0x5dbea3 : 0xc45c4a;
    const t = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    e.bodyMat.color.setHex(can ? 0x9ec4c0 : 0xc49a90);
    e.bodyMat.color.multiplyScalar(0.55 + t * 0.45);
    e.bodyMat.emissive.setHex(col);
    e.bodyMat.emissiveIntensity = 0.28 + (1 - t) * 0.22;
    drawLabel(e.label, String(e.hp), can ? "#5dbea3" : "#e8b4ac", "rgba(9,11,16,0.84)");
  }

  private spawnGems(z: number, lane: number) {
    for (let i = 0; i < 4; i++) {
      const e = this.take("gem");
      if (!e) return;
      const zz = z - i * 1.5;
      this.activate(e, zz, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
    }
  }

  private spawnAmmo(z: number, lane: number, value: number) {
    const e = this.take("ammo");
    if (!e || !e.label) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
    e.value = value;
    drawLabel(e.label, `+${value}`, "#eef1f4", "rgba(9,11,16,0.72)");
  }

  private spawnAmmoLine(z: number, lane: number, n: number, value: number) {
    for (let i = 0; i < n; i++) this.spawnAmmo(z - i * 1.45, lane, value);
  }

  private spawnPickupRun(z: number) {
    const r = this.rng();
    const lane = Math.floor(this.rng() * 3);
    if (r < 0.32) {
      const n = 3 + Math.floor(this.rng() * 3);
      const val = this.rng() < 0.28 ? 2 : this.rng() < 0.1 ? 3 : 1;
      this.spawnAmmoLine(z, lane, n, val);
    } else if (r < 0.46) {
      for (let i = 0; i < 5; i++) this.spawnAmmo(z - i * 1.4, i % 3, 1);
    } else if (r < 0.58) {
      this.spawnGems(z, lane);
    } else if (r < 0.7) {
      this.spawnCrystal(z, lane);
    } else if (r < 0.8 && this.distance > 40 && this.boostT <= 0) {
      this.spawnPower("boost", z, lane);
    } else if (r < 0.88 && this.distance > 70 && this.frostT <= 0) {
      this.spawnPower("frost", z, lane);
    } else if (r < 0.94 && this.distance > 90 && this.ghostT <= 0) {
      this.spawnPower("ghost", z, lane);
    } else if (this.distance > 80 && this.magnetT <= 0 && this.rng() < 0.55) {
      this.spawnMagnet(z, lane);
    } else if (this.distance > 110 && !this.shielded) {
      this.spawnShield(z, lane);
    } else {
      this.spawnGems(z, lane);
    }
  }

  private spawnPower(kind: "boost" | "frost" | "ghost", z: number, lane: number) {
    const e = this.take(kind);
    if (!e) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
  }

  private spawnShield(z: number, lane: number) {
    const e = this.take("shield");
    if (!e) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
  }

  private spawnCrystal(z: number, lane: number) {
    const e = this.take("crystal");
    if (!e || !e.label) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
    e.value = 5;
    drawLabel(e.label, "+5", "#f0dca0", "rgba(9,11,16,0.72)");
  }

  private spawnMagnet(z: number, lane: number) {
    const e = this.take("magnet");
    if (!e) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
  }

  private spawnMine(z: number, lane: number, slide = false) {
    const e = this.take("mine");
    if (!e) return;
    this.activate(e, z, slide ? 0 : LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
    e.slide = slide;
    e.baseX = slide ? 0 : LANE_X[lane];
    e.slideAmp = slide ? 2.55 : 0;
    e.bob = this.rng() * Math.PI * 2;
  }

  private spawnBlockAt(z: number, lane: number, slide = false) {
    const e = this.take("block");
    if (!e) return;
    this.activate(e, z, slide ? 0 : LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
    e.slide = slide;
    e.baseX = slide ? 0 : LANE_X[lane];
    e.slideAmp = slide ? 2.55 : 0;
    e.bob = this.rng() * Math.PI * 2;
  }

  private spawnBarrel(z: number, lane: number, d: number) {
    const e = this.take("barrel");
    if (!e || !e.label || !e.bodyMat) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
    const hp = Math.max(4, Math.min(this.power, Math.round(this.power * (0.34 + d * 0.22))));
    e.hp = hp;
    e.maxHp = hp;
    e.tuned = true;
    this.paintBarrel(e);
  }

  private paintBarrel(e: Ent) {
    if (!e.bodyMat || !e.label) return;
    const can = e.hp <= this.power;
    drawLabel(e.label, String(e.hp), can ? "#e8c090" : "#e8b4ac", "rgba(9,11,16,0.84)");
    e.bodyMat.emissiveIntensity = 0.22 + (e.pulse > 0 ? 0.35 : 0);
  }

  private spawnSaw(z: number, lane: number, slide: boolean) {
    const e = this.take("saw");
    if (!e) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
    e.slide = slide;
    e.baseX = slide ? 0 : LANE_X[lane];
    e.slideAmp = slide ? 2.55 : 0;
    e.bob = this.rng() * Math.PI * 2;
  }

  private spawnSpike(z: number, lane: number) {
    const e = this.take("spike");
    if (!e) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
  }

  private spawnLaser(z: number, lane: number) {
    const e = this.take("laser");
    if (!e) return;
    this.activate(e, z, LANE_X[lane], [lane === 0, lane === 1, lane === 2]);
  }

  private spawnRam(z: number) {
    const e = this.take("ram");
    if (!e) return;
    this.activate(e, z, 0, [false, true, false]);
    e.slide = true;
    e.baseX = 0;
    e.slideAmp = 1.08;
    e.width = 3.3;
    e.bob = this.rng() * Math.PI * 2;
  }

  private spawnHazardPack(z: number, d: number) {
    const roll = this.rng();
    const open = Math.floor(this.rng() * 3);
    const a = (open + 1) % 3;
    const b = (open + 2) % 3;
    if (roll < 0.12) {
      this.spawnSpike(z, a);
      if (this.rng() < 0.65) this.spawnSpike(z, b);
    } else if (roll < 0.22) {
      this.spawnLaser(z, a);
      if (this.rng() < 0.4) this.spawnBlockAt(z - 6, b);
    } else if (roll < 0.32 && d > 0.05) {
      this.spawnRam(z);
    } else if (roll < 0.42) {
      this.spawnBlockAt(z, a);
      if (this.rng() < 0.55) this.spawnBlockAt(z, b);
    } else if (roll < 0.52) {
      this.spawnMine(z, a);
      if (this.rng() < 0.45) this.spawnMine(z - 5, b);
    } else if (roll < 0.62) {
      this.spawnSaw(z, a, false);
      if (this.rng() < 0.35) this.spawnSpike(z - 6, b);
    } else if (roll < 0.72 && d > 0.08) {
      this.spawnSaw(z, 1, true);
    } else if (roll < 0.8 && d > 0.12) {
      this.spawnMine(z, 1, true);
    } else if (roll < 0.9) {
      this.spawnBarrel(z, a, d);
      if (this.rng() < 0.45) this.spawnBarrel(z - 6, b, d);
    } else {
      this.spawnLaser(z, 0);
      this.spawnSpike(z - 7, 2);
    }
  }

  private tick = (time: number) => {
    if (this.disposed) return;
    if (!this.lastT) this.lastT = time;
    let dt = Math.min((time - this.lastT) / 1000, 0.1);
    this.lastT = time;
    this.elapsed += dt;

    if (this.input.consumePause()) {
      if (this.phase === "playing") this.pause();
      else if (this.phase === "paused") this.resume();
    }
    if (this.input.consumeConfirm()) {
      if (this.menuOpen) {
        // consumed — sheets handle their own actions
      } else if (this.phase === "title" || this.phase === "dead") this.play();
      else if (this.phase === "paused") this.resume();
    }

    const frozen = this.phase === "paused";
    if (!frozen) {
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        dt *= 0.18;
      }
      this.acc += dt;
      while (this.acc >= FIXED_DT) {
        this.fixedUpdate(FIXED_DT);
        this.acc -= FIXED_DT;
      }
    }
    this.visuals(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private tally() {
    return Math.floor(this.distance) + this.runGems * 12 + this.wallsBroken * 40 + this.combo * 4;
  }

  private fixedUpdate(dt: number) {
    const playing = this.phase === "playing";
    const scrolling = playing || this.phase === "title";
    if (playing) {
      let spd = Math.min(MAX_SPEED, BASE_SPEED * VEHICLES[this.vehicle].speed + this.distance * SPEED_PER_METER);
      if (this.frostT > 0) spd *= 0.58;
      this.speed = spd;
      this.boostT = Math.max(0, this.boostT - dt);
      this.frostT = Math.max(0, this.frostT - dt);
      this.ghostT = Math.max(0, this.ghostT - dt);
      this.steer(dt);
      this.distance += this.speed * dt;
      this.score = this.tally();
    }

    if (scrolling) {
      const dz = this.speed * dt;
      this.lastSpawnZ += dz;
      this.scrollScenery(dz);
      for (const e of this.ents) {
        if (!e.active) continue;
        e.z += dz;
        if (e.z > DESPAWN_Z) this.recycle(e);
      }
      this.stepMovers();
      this.ensureSpawns();
      if (playing) {
        this.retuneWalls();
        this.stepMagnet(dt);
        this.fireAtTargets(dt);
        this.collide();
        this.emitDust(dt);
      }
    }

    this.stepBalls(dt);
    this.stepSparks(dt);
    this.stepFloaters(dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.punch = Math.max(0, this.punch - dt * 2.4);
    this.recoil *= Math.max(0, 1 - dt * 10);
    this.muzzleLight.intensity *= Math.max(0, 1 - dt * 14);
    this.pushHud(false);
  }

  private stepMovers() {
    for (const e of this.ents) {
      if (!e.active || !e.slide) continue;
      e.x = e.baseX + Math.sin(this.elapsed * 2.8 + e.bob) * e.slideAmp;
      let lane = 1;
      let best = 99;
      for (let i = 0; i < 3; i++) {
        const d = Math.abs(e.x - LANE_X[i]);
        if (d < best) {
          best = d;
          lane = i;
        }
      }
      e.lanes = [lane === 0, lane === 1, lane === 2];
    }
  }

  private stepMagnet(dt: number) {
    if (this.magnetT <= 0) return;
    this.magnetT = Math.max(0, this.magnetT - dt);
    for (const e of this.ents) {
      if (!e.active || (e.kind !== "gem" && e.kind !== "crystal")) continue;
      if (e.z > 5 || e.z < -22) continue;
      const dx = this.playerX - e.x;
      const dz = 0.2 - e.z;
      e.x += dx * Math.min(1, dt * 7);
      e.z += dz * Math.min(1, dt * 5);
      const lane = Math.abs(e.x - LANE_X[0]) < Math.abs(e.x - LANE_X[2]) ? (Math.abs(e.x - LANE_X[0]) < Math.abs(e.x - LANE_X[1]) ? 0 : 1) : Math.abs(e.x - LANE_X[2]) < Math.abs(e.x - LANE_X[1]) ? 2 : 1;
      e.lanes = [lane === 0, lane === 1, lane === 2];
      if (Math.abs(dx) < 0.55 && Math.abs(e.z) < 1.1) {
        e.consumed = true;
        if (e.kind === "crystal") {
          this.bankGems(e.value || 5);
          this.audio.playCrystal();
          this.spawnFloater(e.x, 1.4, 0.1, `+${e.value || 5}`, "#e8c878");
        } else {
          this.bankGems(1);
          this.audio.playGem();
        }
        this.recycle(e);
      }
    }
  }

  private scrollScenery(dz: number) {
    for (let i = 0; i < this.plateZ.length; i++) {
      this.plateZ[i] += dz;
      if (this.plateZ[i] > 22) this.plateZ[i] -= 160;
    }
    for (let i = 0; i < this.railZ.length; i++) {
      this.railZ[i] += dz;
      if (this.railZ[i] > 22) this.railZ[i] -= 160;
    }
    for (let i = 0; i < this.pillarZ.length; i++) {
      this.pillarZ[i] += dz;
      if (this.pillarZ[i] > 18) {
        this.pillarZ[i] -= 162;
        const side = this.pillarX[i] < 0 ? -1 : 1;
        this.pillarX[i] = side * (5.3 + this.rng() * 1.1);
      }
    }
    for (let i = 0; i < this.cliffZ.length; i++) {
      this.cliffZ[i] += dz;
      if (this.cliffZ[i] > 22) this.cliffZ[i] -= 336;
    }
    for (let i = 0; i < this.moteZ.length; i++) {
      this.moteZ[i] += dz;
      if (this.moteZ[i] > 8) {
        this.moteZ[i] -= 90;
        this.moteX[i] = (this.rng() - 0.5) * 12;
        this.moteY[i] = 0.5 + this.rng() * 3.2;
      }
    }
    const streakBoost = dz * 1.85;
    for (let i = 0; i < this.streakZ.length; i++) {
      this.streakZ[i] += streakBoost;
      if (this.streakZ[i] > 6) {
        this.streakZ[i] -= 42;
        this.streakX[i] = (this.rng() - 0.5) * 9;
        this.streakY[i] = 0.4 + this.rng() * 2.6;
      }
    }
    for (let i = 0; i < this.kelpZ.length; i++) {
      this.kelpZ[i] += dz;
      if (this.kelpZ[i] > 16) this.kelpZ[i] -= 160;
    }
    for (let i = 0; i < this.coralZ.length; i++) {
      this.coralZ[i] += dz;
      if (this.coralZ[i] > 16) {
        this.coralZ[i] -= 160;
        const side = this.coralX[i] < 0 ? -1 : 1;
        this.coralX[i] = side * (4.5 + this.rng() * 1.4);
      }
    }
    for (let i = 0; i < this.treeZ.length; i++) {
      this.treeZ[i] += dz;
      if (this.treeZ[i] > 16) this.treeZ[i] -= 168;
    }
    for (let i = 0; i < this.hillZ.length; i++) {
      this.hillZ[i] += dz;
      if (this.hillZ[i] > 20) this.hillZ[i] -= 224;
    }
    for (let i = 0; i < this.cloudZ.length; i++) {
      this.cloudZ[i] += dz * 0.35;
      if (this.cloudZ[i] > 20) {
        this.cloudZ[i] -= 180;
        this.cloudX[i] = (this.rng() - 0.5) * 22;
      }
    }
    for (let i = 0; i < this.craterZ.length; i++) {
      this.craterZ[i] += dz;
      if (this.craterZ[i] > 16) {
        this.craterZ[i] -= 192;
        const side = this.craterX[i] < 0 ? -1 : 1;
        this.craterX[i] = side * (5.8 + this.rng() * 2.2);
      }
    }
    this.syncScenery();
  }

  private stamp(
    mesh: THREE.InstancedMesh,
    i: number,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  private syncScenery() {
    for (let i = 0; i < this.plateZ.length; i++) this.stamp(this.plateMesh, i, 0, -0.09, this.plateZ[i]);
    this.plateMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.railZ.length; i++) {
      this.stamp(this.railMesh, i, this.railSide[i] * (TRACK_WIDTH / 2 + 0.16), 0.22, this.railZ[i]);
    }
    this.railMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.pillarZ.length; i++) {
      const t = this.theme === "reef" ? 0.42 : this.theme === "luna" ? 0.7 : this.theme === "toon" ? 0.9 : 1;
      const n = this.theme === "reef" ? 1.55 : this.theme === "luna" ? 0.5 : this.theme === "toon" ? 1.15 : 1;
      const r = this.theme === "reef" ? Math.sin(this.elapsed * 1.3 + i) * 0.18 : 0;
      this.stamp(this.pillarMesh, i, this.pillarX[i], this.theme === "reef" ? 2.5 : 1.9, this.pillarZ[i], t, n, t, 0, 0, r);
    }
    this.pillarMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.cliffZ.length; i++) {
      const side = this.cliffSide[i];
      this.stamp(
        this.cliffMesh,
        i,
        side * (TRACK_WIDTH / 2 + 6.4),
        this.theme === "luna" ? 2.1 : 3.2,
        this.cliffZ[i],
        1,
        this.theme === "luna" ? this.cliffSy[i] * 0.55 : this.cliffSy[i],
        1,
        0,
        0,
        side * 0.2,
      );
    }
    this.cliffMesh.instanceMatrix.needsUpdate = true;
    if (this.kelpMesh.visible) {
      for (let i = 0; i < this.kelpZ.length; i++) {
        const side = this.kelpSide[i];
        const sway = Math.sin(this.elapsed * 1.15 + i) * 0.16;
        this.stamp(
          this.kelpMesh,
          i,
          side * (TRACK_WIDTH / 2 + 1.35 + (i % 3) * 0.45),
          3.2 * this.kelpSy[i],
          this.kelpZ[i],
          1,
          this.kelpSy[i],
          1,
          0,
          0,
          sway,
        );
      }
      this.kelpMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.coralMesh.visible) {
      for (let i = 0; i < this.coralZ.length; i++) {
        this.stamp(
          this.coralMesh,
          i,
          this.coralX[i],
          0.45 * this.coralS[i],
          this.coralZ[i],
          this.coralS[i],
          this.coralS[i] * 0.85,
          this.coralS[i],
          0,
          i * 0.4,
          0,
        );
      }
      this.coralMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.trunkMesh.visible) {
      const snow = this.theme === "frost";
      for (let i = 0; i < this.treeZ.length; i++) {
        this.stamp(this.trunkMesh, i, this.treeX[i], snow ? 1.55 : 1.2, this.treeZ[i], snow ? 0.7 : 1, snow ? 1.35 : 1, snow ? 0.7 : 1);
        this.stamp(this.canopyMesh, i, this.treeX[i], snow ? 3.15 : 2.7, this.treeZ[i], snow ? 0.85 : 1.05, snow ? 1.35 : 0.9, snow ? 0.85 : 1.05);
      }
      this.trunkMesh.instanceMatrix.needsUpdate = true;
      this.canopyMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.hillMesh.visible) {
      const y = this.theme === "reef" ? 0.9 : this.theme === "dune" ? 0.55 : this.theme === "frost" ? 1.05 : 1.4;
      const t = this.theme === "dune" ? 0.42 : this.theme === "reef" ? 0.7 : 1;
      for (let i = 0; i < this.hillZ.length; i++) {
        const s = this.hillS[i];
        this.stamp(this.hillMesh, i, this.hillSide[i] * (TRACK_WIDTH / 2 + 5.6), y, this.hillZ[i], s, s * 0.42 * t, s * 1.35);
      }
      this.hillMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.cloudMesh.visible) {
      for (let i = 0; i < this.cloudZ.length; i++) {
        const bob = Math.sin(this.elapsed * 0.35 + i) * 0.25;
        this.stamp(this.cloudMesh, i, this.cloudX[i], this.cloudY[i] + bob, this.cloudZ[i], 1.4 + (i % 3) * 0.25, 0.7, 1);
      }
      this.cloudMesh.instanceMatrix.needsUpdate = true;
    }
    if (this.craterMesh.visible) {
      for (let i = 0; i < this.craterZ.length; i++) {
        const s = this.craterS[i];
        this.stamp(this.craterMesh, i, this.craterX[i], 0.04, this.craterZ[i], s, 1, s);
      }
      this.craterMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private steer(dt: number) {
    const dir = this.input.consumeLaneDelta(dt);
    if (this.switching) {
      if (dir < 0) this.queuedLane = Math.max(0, this.lane - 1);
      else if (dir > 0) this.queuedLane = Math.min(LANE_COUNT - 1, this.lane + 1);
    } else {
      let next = this.lane;
      if (this.queuedLane !== null) {
        next = this.queuedLane;
        this.queuedLane = null;
      } else if (dir < 0 && this.lane > 0) next = this.lane - 1;
      else if (dir > 0 && this.lane < LANE_COUNT - 1) next = this.lane + 1;
      if (next !== this.lane) this.beginLane(next);
    }
    if (this.switching) {
      this.laneT += dt / LANE_TWEEN;
      const t = Math.min(1, this.laneT);
      const e = 1 - (1 - t) * (1 - t) * (1 - t);
      this.playerX = this.fromX + (this.toX - this.fromX) * e;
      const sign = Math.sign(this.toX - this.fromX);
      this.cannon.root.rotation.z = -sign * 0.24 * Math.sin(Math.PI * e);
      const squash = Math.sin(Math.PI * e) * 0.06;
      this.cannon.root.scale.set(1 + squash, 1 - squash, 1);
      if (t >= 1) {
        this.switching = false;
        this.playerX = this.toX;
        this.cannon.root.rotation.z = 0;
        this.cannon.root.scale.setScalar(1);
      }
    }
  }

  private beginLane(lane: number) {
    this.lane = lane;
    this.fromX = this.playerX;
    this.toX = LANE_X[lane];
    this.laneT = 0;
    this.switching = true;
  }

  private occupies(e: Ent, lane: number) {
    return e.lanes[lane];
  }

  private fireAtTargets(dt: number) {
    let target: Ent | null = null;
    for (const e of this.ents) {
      if (!e.active || e.hp <= 0) continue;
      if (e.kind !== "wall" && e.kind !== "barrel") continue;
      if (e.z <= -this.fireRange() || e.z >= 1.5) continue;
      if (!this.occupies(e, this.lane)) continue;
      if (!target || e.z > target.z) target = e;
    }
    this.wallHp = target && target.kind === "wall" ? target.hp : null;
    if (!target || this.power <= 0) return;

    const dist = Math.max(0.2, -target.z);
    const tta = dist / Math.max(this.speed, 1);
    const needed = Math.min(this.power, target.hp);
    const dump = Math.max(0.4, Math.min(0.85, tta * 0.7));
    const spec = VEHICLES[this.vehicle];
    const rate = (needed / dump) * spec.fireMul;
    this.fireAcc += rate * dt;
    let vis = 0;
    const visEvery = Math.max(1, Math.floor(rate / 26));
    const dmg = this.boostT > 0 ? 2 : 1;
    while (this.fireAcc >= 1 && this.power > 0 && target.hp > 0) {
      this.fireAcc -= 1;
      this.power -= 1;
      target.hp -= dmg;
      target.pulse = 1;
      vis++;
      if (vis % visEvery === 0) {
        this.spawnBall(target, 0, spec.ballScale);
        if (spec.barrels >= 2) this.spawnBall(target, spec.spread, spec.ballScale * 0.85);
        if (spec.barrels >= 3) this.spawnBall(target, -spec.spread, spec.ballScale * 0.85);
        this.audio.playFire();
        this.burst(target.x + (this.rng() - 0.5) * target.width * 0.25, 1.05, target.z, 3, 0x8a6860);
      }
      this.recoil = Math.min(0.32, this.recoil + (spec.ballScale > 1.2 ? 0.08 : 0.05));
      this.muzzleLight.intensity = 2.4;
    }
    if (target.kind === "wall") this.paintWall(target);
    else this.paintBarrel(target);
    if (target.hp <= 0) {
      if (target.kind === "wall") this.breakWall(target);
      else this.breakBarrel(target);
    }
  }

  private fireRange() {
    return FIRE_BASE + this.speed * 0.85;
  }

  private spawnBall(target: Ent, ox = 0, scale = 1) {
    const spec = VEHICLES[this.vehicle];
    for (const b of this.balls) {
      if (b.alive) continue;
      b.alive = true;
      b.x = this.playerX + ox;
      b.y = 0.78;
      b.z = -1.25;
      b.vx = (target.x - this.playerX) * 3.2 + ox * 8;
      b.vz = -Math.max(28, this.speed + 22) * spec.shotSpeed;
      b.life = 0.7;
      b.s = scale;
      return;
    }
  }

  private breakWall(e: Ent) {
    this.wallsBroken += 1;
    this.combo += 1;
    this.audio.playBoom();
    this.addTrauma(0.55);
    this.hitstop = this.shakeOn ? 0.055 : 0;
    this.punch = 0.22;
    this.burst(e.x, 1.1, e.z, 28, 0x5dbea3);
    this.spawnFloater(e.x, 1.8, e.z, "BREAK", "#5dbea3");
    this.recycle(e);
  }

  private breakBarrel(e: Ent) {
    this.combo += 1;
    this.audio.playBoom();
    this.addTrauma(0.28);
    this.punch = 0.12;
    this.burst(e.x, 0.9, e.z, 16, 0xd08848);
    this.spawnFloater(e.x, 1.5, e.z, "POP", "#e8c090");
    this.recycle(e);
  }

  private absorbHit(e: Ent) {
    if (!this.shielded) return false;
    this.shielded = false;
    this.audio.playShield();
    this.burst(this.playerX, 0.9, 0.2, 22, 0x7ee0d4);
    this.spawnFloater(this.playerX, 1.8, 0.2, "SHIELD", "#7ee0d4");
    this.addTrauma(0.22);
    this.recycle(e);
    return true;
  }

  private collide() {
    for (const e of this.ents) {
      if (!e.active || e.consumed) continue;
      if (e.z < HIT_Z_MIN || e.z > HIT_Z) continue;
      if (Math.abs(this.playerX - e.x) >= e.width * 0.5 + 0.42) continue;
      if (e.kind === "gate" && e.op) {
        e.consumed = true;
        const before = this.power;
        this.power = applyOp(this.power, e.op);
        const good = this.power >= before;
        this.lastOp = opLabel(e.op);
        this.lastOpAt = this.elapsed;
        if (good) this.combo += 1;
        else this.combo = 0;
        this.audio.playGate(good);
        this.burst(e.x, 1.2, 0.2, e.op.kind === "mul" ? 18 : 10, good ? 0x5dbea3 : 0xc45c4a);
        this.spawnFloater(e.x, 1.7, 0.2, this.lastOp, good ? "#5dbea3" : "#c45c4a");
        this.addTrauma(good ? 0.18 : 0.28);
        this.punch = 0.12;
        this.recycle(e);
      } else if (e.kind === "ammo") {
        e.consumed = true;
        this.power += e.value;
        this.lastOp = `+${e.value}`;
        this.lastOpAt = this.elapsed;
        this.combo += 1;
        this.audio.playAmmo();
        this.burst(e.x, 0.6, 0.1, 8, 0x5dbea3);
        this.spawnFloater(e.x, 1.4, 0.15, `+${e.value}`, "#5dbea3");
        this.recycle(e);
      } else if (e.kind === "crystal") {
        e.consumed = true;
        this.bankGems(e.value || 5);
        this.audio.playCrystal();
        this.burst(e.x, 0.7, 0.1, 12, 0xe8c878);
        this.spawnFloater(e.x, 1.5, 0.15, `+${e.value || 5}`, "#e8c878");
        this.recycle(e);
      } else if (e.kind === "gem") {
        e.consumed = true;
        this.bankGems(1);
        this.audio.playGem();
        this.burst(e.x, 0.6, 0.1, 6, 0x7eb8c9);
        this.recycle(e);
      } else if (e.kind === "magnet") {
        e.consumed = true;
        this.magnetT = 7;
        this.audio.playMagnet();
        this.burst(e.x, 0.8, 0.1, 14, 0xc45c4a);
        this.spawnFloater(e.x, 1.6, 0.15, "MAGNET", "#e8c090");
        this.recycle(e);
      } else if (e.kind === "shield") {
        e.consumed = true;
        this.shielded = true;
        this.audio.playShield();
        this.burst(e.x, 0.8, 0.1, 12, 0x7ee0d4);
        this.spawnFloater(e.x, 1.6, 0.15, "SHIELD", "#7ee0d4");
        this.recycle(e);
      } else if (e.kind === "boost") {
        e.consumed = true;
        this.boostT = 6;
        this.audio.playBoost();
        this.burst(e.x, 0.8, 0.1, 14, 0xffd060);
        this.spawnFloater(e.x, 1.6, 0.15, "BOOST", "#ffd060");
        this.recycle(e);
      } else if (e.kind === "frost") {
        e.consumed = true;
        this.frostT = 5;
        this.audio.playFrost();
        this.burst(e.x, 0.8, 0.1, 14, 0x9fd8ff);
        this.spawnFloater(e.x, 1.6, 0.15, "FROST", "#9fd8ff");
        this.recycle(e);
      } else if (e.kind === "ghost") {
        e.consumed = true;
        this.ghostT = 4;
        this.audio.playGhost();
        this.burst(e.x, 0.8, 0.1, 14, 0xc8b0ff);
        this.spawnFloater(e.x, 1.6, 0.15, "PHASE", "#c8b0ff");
        this.recycle(e);
      } else if (e.kind === "block" || e.kind === "saw" || e.kind === "mine" || e.kind === "spike" || e.kind === "laser" || e.kind === "ram") {
        if (this.ghostT > 0) continue;
        if (this.absorbHit(e)) continue;
        this.die();
        return;
      } else if ((e.kind === "wall" || e.kind === "barrel") && e.hp > 0) {
        const cost = this.boostT > 0 ? Math.ceil(e.hp / 2) : e.hp;
        if (this.power >= cost) {
          this.power -= cost;
          if (e.kind === "wall") this.breakWall(e);
          else this.breakBarrel(e);
        } else if (this.ghostT > 0) {
          continue;
        } else if (this.absorbHit(e)) {
          continue;
        } else {
          this.die();
          return;
        }
      }
    }
  }

  private die() {
    if (this.phase !== "playing") return;
    this.phase = "dead";
    this.audio.stopRun();
    this.audio.playCrash();
    this.addTrauma(0.9);
    this.hitstop = 0.1;
    this.burst(this.playerX, 0.8, 0.2, 40, 0xc45c4a);
    this.cannon.root.visible = false;
    this.score = this.tally();
    if (this.score > (this.highScores[this.theme] ?? 0)) {
      this.highScores[this.theme] = this.score;
      this.highScore = this.score;
    }
    this.persist();
    this.pushHud(true);
  }

  private bankGems(n: number) {
    this.runGems += n;
    this.wallet += n;
    this.gems = this.wallet;
    this.persist();
  }

  private addTrauma(n: number) {
    if (!this.shakeOn) return;
    this.trauma = Math.min(1, this.trauma + n);
  }

  private emitDust(dt: number) {
    this.dustAcc += dt;
    if (this.dustAcc < 0.05) return;
    this.dustAcc = 0;
    this.burst(this.playerX + (this.rng() - 0.5) * 0.4, 0.12, 0.4, 2, 0x6a7a80);
  }

  private burst(x: number, y: number, z: number, n: number, hex: number) {
    let left = n;
    for (const s of this.sparks) {
      if (s.alive) continue;
      s.alive = true;
      s.x = x;
      s.y = y;
      s.z = z;
      s.vx = (this.rng() - 0.5) * 8;
      s.vy = 2 + this.rng() * 6;
      s.vz = (this.rng() - 0.5) * 6;
      s.max = 0.35 + this.rng() * 0.4;
      s.life = s.max;
      s.s = 0.1 + this.rng() * 0.18;
      s.color.setHex(hex);
      left -= 1;
      if (left <= 0) return;
    }
  }

  private spawnFloater(x: number, y: number, z: number, text: string, fill: string) {
    for (const f of this.floaters) {
      if (f.alive) continue;
      f.alive = true;
      f.x = x;
      f.y = y;
      f.z = z;
      f.max = 0.7;
      f.life = 0.7;
      f.label.mesh.visible = true;
      drawLabel(f.label, text, fill, "rgba(9,11,16,0.0)");
      return;
    }
  }

  private stepFloaters(dt: number) {
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.life -= dt;
      f.y += dt * 1.6;
      const t = Math.max(0, f.life / f.max);
      f.label.mesh.position.set(f.x, f.y, f.z);
      f.label.mesh.scale.setScalar(0.85 + (1 - t) * 0.25);
      const mat = f.label.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = t;
      if (f.life <= 0) {
        f.alive = false;
        f.label.mesh.visible = false;
        mat.opacity = 1;
      }
    }
  }

  private stepBalls(dt: number) {
    for (const b of this.balls) {
      if (!b.alive) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.y += dt * 0.4;
      if (b.life <= 0 || b.z < -40) b.alive = false;
    }
  }

  private stepSparks(dt: number) {
    for (const s of this.sparks) {
      if (!s.alive) continue;
      s.life -= dt;
      s.vy -= 14 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      if (s.life <= 0 || s.y < 0) s.alive = false;
    }
  }

  private pileCount() {
    if (this.power <= 0) return 0;
    if (this.power <= 24) return this.power;
    return Math.min(36, 24 + Math.floor(Math.log2(this.power - 23) * 4));
  }

  private syncPile() {
    const n = this.pileCount();
    const cols = 4;
    for (let i = 0; i < 36; i++) {
      if (i >= n) {
        dummy.position.set(0, -8, 0);
        dummy.scale.setScalar(0);
      } else {
        const layer = Math.floor(i / cols);
        const col = i % cols;
        dummy.position.set((col - 1.5) * 0.24, 0.72 + layer * 0.2, 0.48);
        dummy.scale.setScalar(0.92);
      }
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      this.pileMesh.setMatrixAt(i, dummy.matrix);
    }
    this.pileMesh.instanceMatrix.needsUpdate = true;
  }

  private visuals(dt: number) {
    const t = this.elapsed;
    const bob = Math.sin(t * 7.5) * 0.03;
    this.cannon.root.position.set(this.playerX, bob, 0);
    this.cannon.barrel.position.z = -0.22 + this.recoil;
    for (const w of this.cannon.wheels) w.rotation.x -= this.speed * dt * 1.7;
    drawLabel(this.cannon.powerLabel, String(this.power), "#eef1f4", "rgba(9,11,16,0.72)");
    const firing = this.muzzleLight.intensity > 0.15;
    this.cannon.flash.visible = firing;
    if (firing) {
      const s = 0.7 + this.rng() * 0.5;
      this.cannon.flash.scale.set(s, s, 0.8 + this.rng() * 0.6);
    }
    this.cannon.core.scale.setScalar(0.9 + Math.sin(t * 9) * 0.12);
    this.cannon.powerLabel.mesh.visible = this.phase === "playing";
    this.syncPile();
    this.shieldFx.visible = this.shielded;
    if (this.shielded) {
      const mat = this.shieldFx.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.16 + Math.sin(t * 5) * 0.06;
      this.shieldFx.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
    }
    this.magnetFx.visible = this.magnetT > 0;
    if (this.magnetT > 0) {
      const mat = this.magnetFx.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + Math.sin(t * 8) * 0.12;
      this.magnetFx.scale.setScalar(1 + Math.sin(t * 6) * 0.08);
      this.magnetFx.rotation.z += dt * 4;
    }
    this.spinAura(this.boostFx, this.boostT > 0, t, dt, 5);
    this.spinAura(this.frostFx, this.frostT > 0, t, dt, -3.2);
    this.spinAura(this.ghostFx, this.ghostT > 0, t, dt, 2.4);

    this.laneGlow.position.x = this.playerX;
    const glowMat = this.laneGlow.material as THREE.MeshBasicMaterial;
    glowMat.opacity = this.phase === "playing" ? 0.14 + Math.sin(t * 6) * 0.04 : 0.06;

    const streakLen = 0.7 + this.speed / MAX_SPEED;
    for (let i = 0; i < this.streakZ.length; i++) {
      this.stamp(
        this.streakMesh,
        i,
        this.streakX[i],
        this.streakY[i],
        this.streakZ[i],
        1,
        1,
        this.phase === "playing" ? streakLen : 0.4,
      );
    }
    this.streakMesh.instanceMatrix.needsUpdate = true;
    const streakMat = this.streakMesh.material as THREE.MeshBasicMaterial;
    streakMat.opacity = this.phase === "playing" ? 0.12 + (this.speed / MAX_SPEED) * 0.22 : 0.05;

    for (const e of this.ents) {
      if (!e.active) continue;
      e.pulse = Math.max(0, e.pulse - dt * 8);
      e.root.position.x = e.x;
      e.root.position.z = e.z;
      if (e.kind === "gem" || e.kind === "ammo" || e.kind === "shield" || e.kind === "crystal" || e.kind === "magnet" || e.kind === "boost" || e.kind === "frost" || e.kind === "ghost") {
        e.bob += dt * 4;
        e.root.position.y = 0.15 + Math.sin(e.bob) * 0.12;
        e.root.rotation.y += dt * 2.4;
      } else if (e.kind === "wall") {
        const p = e.pulse;
        e.root.scale.set(e.width * (1 + p * 0.03), 2.35 * (1 + p * 0.08), 1 + p * 0.12);
        e.root.position.y = 0;
      } else if (e.kind === "gate") {
        e.root.position.y = 0;
        if (e.glowMat) e.glowMat.opacity = 0.22 + Math.sin(t * 5 + e.x) * 0.08;
      } else if (e.kind === "saw") {
        e.root.rotation.y += dt * 8;
        e.root.position.y = 0;
      } else if (e.kind === "mine") {
        e.bob += dt * 6;
        e.root.position.y = Math.sin(e.bob) * 0.08;
        e.root.rotation.y += dt * 2.2;
        if (e.bodyMat) e.bodyMat.emissiveIntensity = 0.4 + Math.sin(t * 8 + e.x) * 0.25;
      } else if (e.kind === "laser") {
        e.root.position.y = 0;
        if (e.bodyMat) e.bodyMat.emissiveIntensity = 1.1 + Math.sin(t * 14 + e.x) * 0.45;
      } else if (e.kind === "barrel") {
        e.root.position.y = 0;
        e.root.rotation.y = Math.sin(t * 2 + e.x) * 0.08;
      } else {
        e.root.position.y = 0;
      }
    }

    let bi = 0;
    for (const b of this.balls) {
      if (!b.alive) continue;
      dummy.position.set(b.x, b.y, b.z);
      dummy.scale.setScalar(b.s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      this.ballMesh.setMatrixAt(bi, dummy.matrix);
      bi += 1;
    }
    for (let i = bi; i < 48; i++) {
      dummy.position.set(0, -99, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      this.ballMesh.setMatrixAt(i, dummy.matrix);
    }
    this.ballMesh.instanceMatrix.needsUpdate = true;

    let si = 0;
    for (const s of this.sparks) {
      if (!s.alive) continue;
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.setScalar(s.s * (s.life / s.max));
      dummy.rotation.set(s.life, s.life * 2, 0);
      dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(si, dummy.matrix);
      this.sparkColors.setXYZ(si, s.color.r, s.color.g, s.color.b);
      si += 1;
    }
    for (let i = si; i < 180; i++) {
      dummy.position.set(0, -99, 0);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, dummy.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.sparkColors.needsUpdate = true;

    for (let i = 0; i < this.moteZ.length; i++) {
      let y = this.moteY[i] + Math.sin(t * 1.4 + i) * 0.12;
      if (this.theme === "reef") {
        this.moteY[i] += dt * (0.55 + (i % 5) * 0.12);
        if (this.moteY[i] > 5.5) this.moteY[i] = 0.15;
        y = this.moteY[i];
      } else if (this.theme === "frost") {
        this.moteY[i] -= dt * (0.7 + (i % 4) * 0.18);
        if (this.moteY[i] < 0.15) this.moteY[i] = 5.2;
        y = this.moteY[i];
      } else if (this.theme === "dune") {
        y = 0.35 + Math.sin(t * 0.8 + i) * 0.2;
      }
      const s = this.theme === "luna" ? 1.8 : this.theme === "reef" ? 1.4 : this.theme === "frost" ? 0.7 : this.theme === "dune" ? 1.3 : 1;
      this.stamp(this.moteMesh, i, this.moteX[i], y, this.moteZ[i], s, s, s);
    }
    this.moteMesh.instanceMatrix.needsUpdate = true;

    const title = this.phase === "title";
    const shake = this.trauma * this.trauma;
    const sx = (this.rng() - 0.5) * shake * 0.45;
    const sy = (this.rng() - 0.5) * shake * 0.3;
    const zoom = this.punch * 0.55;
    if (title) {
      _cam.set(this.playerX * 0.08 + sx, 2.55 + sy, 7.6);
      _look.set(this.playerX * 0.04, 1.2, -10);
    } else {
      _cam.set(this.playerX * 0.4 + sx, 4.35 + sy, 8.5 - zoom);
      _look.set(this.playerX * 0.22, 1.05, -7.2);
    }
    const k = 1 - Math.exp(-6.2 * dt);
    this.camera.position.lerp(_cam, k);
    this.camera.lookAt(_look);
    this.muzzleLight.position.set(this.playerX, 0.9, -1.35);
    this.skyMat.uniforms.uTime.value = t;
    if (this.theme === "reef") {
      this.fillLight.intensity = THEMES.reef.fillInt * (0.82 + Math.sin(t * 1.6) * 0.18);
    }
  }

  private hint() {
    if (this.phase !== "playing") return "";
    if (this.distance < 24) return "Silver orbs are balls — they break walls";
    if (this.distance < 52) return "Steer into the bigger gate";
    if (this.distance < 90) return "Gems are score. Balls smash walls.";
    for (const e of this.ents) {
      if (!e.active || e.kind !== "wall" || e.hp <= 0) continue;
      if (e.z < -28 || e.z > 2) continue;
      const n = e.lanes.filter(Boolean).length;
      if (n === 1 && e.lanes[this.lane] && e.hp > this.power) return "Too big — swerve";
    }
    if (this.magnetT > 1.2) return "Magnet — gems pull in";
    if (this.boostT > 0.4) return "Boost — each shot hits twice";
    if (this.frostT > 0.4) return "Frost — the track slows";
    if (this.ghostT > 0.4) return "Phase — hazards pass through";
    return "";
  }

  private pushHud(force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastHud < 50) return;
    this.lastHud = now;
    useHud.setState({
      phase: this.phase,
      power: this.power,
      distance: this.distance,
      gems: this.gems,
      score: this.score,
      highScore: this.highScore,
      highScores: this.highScores,
      combo: this.combo,
      lastOp: this.lastOp,
      lastOpAt: this.lastOpAt,
      wallHp: this.wallHp,
      shielded: this.shielded,
      magnet: this.magnetT > 0,
      boost: this.boostT > 0,
      frost: this.frostT > 0,
      ghost: this.ghostT > 0,
      muted: this.muted,
      shake: this.shakeOn,
      hint: this.hint(),
      theme: this.theme,
      worldName: THEMES[this.theme].name,
      wallet: this.wallet,
      vehicle: this.vehicle,
      owned: this.owned,
      vehicleName: VEHICLES[this.vehicle].name,
      shopHint: this.shopHint,
      lastDaily: this.lastDaily,
      playerName: this.playerName,
      playerId: this.playerId,
    });
  }

  private bindResize() {
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVis);
  }

  private onResize = () => this.resize();

  private onVis = () => {
    if (document.visibilityState === "visible") this.audio.resume();
    else if (this.phase === "playing") this.pause();
  };

  private resize() {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
  }

  private installProbe() {
    window.__controlsTest = {
      getYaw: () => -this.playerX,
      getSpeed: () => (this.phase === "playing" || this.phase === "title" ? this.speed : 0),
      getLane: () => this.lane,
      getPower: () => this.power,
      getWallHp: () => this.wallHp,
      setKeys: (keys) => this.input.setInjected(keys),
      setSteer: (v) => {
        if (v > 0.3) this.input.setInjected(["KeyA"]);
        else if (v < -0.3) this.input.setInjected(["KeyD"]);
        else this.input.setInjected([]);
      },
      die: () => this.die(),
    };
  }
}
