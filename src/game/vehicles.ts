export const VEHICLE_IDS = ["rig", "howl", "gale", "bolt", "skiff", "hydra"] as const;
export type VehicleId = (typeof VEHICLE_IDS)[number];

export type VehiclePaint = {
  metal: number;
  steel: number;
  copper: number;
  rim: number;
  dark: number;
};

export type VehicleSpec = {
  id: VehicleId;
  name: string;
  blurb: string;
  perk: string;
  price: number;
  startPower: number;
  speed: number;
  startShield: boolean;
  barrels: 1 | 2 | 3;
  fireMul: number;
  spread: number;
  ballScale: number;
  shotSpeed: number;
  paint: VehiclePaint;
};

export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  rig: {
    id: "rig",
    name: "Rig",
    blurb: "Starter cart",
    perk: "Balanced shot",
    price: 0,
    startPower: 6,
    speed: 1,
    startShield: false,
    barrels: 1,
    fireMul: 1,
    spread: 0,
    ballScale: 1,
    shotSpeed: 1,
    paint: { metal: 0x3c4650, steel: 0x9aaab6, copper: 0x8a5a4e, rim: 0x5dbea3, dark: 0x14181d },
  },
  howl: {
    id: "howl",
    name: "Howl",
    blurb: "Tracked howitzer",
    perk: "Fat shells · +2 balls",
    price: 45,
    startPower: 8,
    speed: 0.92,
    startShield: false,
    barrels: 1,
    fireMul: 0.72,
    spread: 0,
    ballScale: 1.55,
    shotSpeed: 0.82,
    paint: { metal: 0x2a3036, steel: 0x7a848c, copper: 0xa06850, rim: 0xc45c4a, dark: 0x101214 },
  },
  gale: {
    id: "gale",
    name: "Gale",
    blurb: "Scatter sled",
    perk: "Triple spray",
    price: 80,
    startPower: 7,
    speed: 1.02,
    startShield: false,
    barrels: 3,
    fireMul: 1.05,
    spread: 0.32,
    ballScale: 0.72,
    shotSpeed: 1.08,
    paint: { metal: 0x4a5560, steel: 0xc5d0d6, copper: 0x6a7a88, rim: 0xeef1f4, dark: 0x161a20 },
  },
  bolt: {
    id: "bolt",
    name: "Bolt",
    blurb: "Lane racer",
    perk: "Rapid needle fire",
    price: 130,
    startPower: 5,
    speed: 1.14,
    startShield: false,
    barrels: 1,
    fireMul: 1.45,
    spread: 0,
    ballScale: 0.62,
    shotSpeed: 1.28,
    paint: { metal: 0x243038, steel: 0x7eb8c9, copper: 0x3a5a68, rim: 0x7ee0d4, dark: 0x0c1418 },
  },
  skiff: {
    id: "skiff",
    name: "Skiff",
    blurb: "Hover sled",
    perk: "Starts shielded",
    price: 190,
    startPower: 6,
    speed: 1.06,
    startShield: true,
    barrels: 2,
    fireMul: 1.12,
    spread: 0.18,
    ballScale: 0.88,
    shotSpeed: 1.1,
    paint: { metal: 0x3a4850, steel: 0xb8d0d4, copper: 0x4a706c, rim: 0x5dbea3, dark: 0x12181c },
  },
  hydra: {
    id: "hydra",
    name: "Hydra",
    blurb: "Twin-mouth beast",
    perk: "Twin barrels · +4 balls",
    price: 280,
    startPower: 10,
    speed: 0.98,
    startShield: false,
    barrels: 2,
    fireMul: 0.9,
    spread: 0.24,
    ballScale: 1.18,
    shotSpeed: 0.95,
    paint: { metal: 0x3a2c2c, steel: 0xa89088, copper: 0x8a5a4e, rim: 0xc45c4a, dark: 0x140c0c },
  },
};

export const VEHICLE_LIST = VEHICLE_IDS.map((id) => VEHICLES[id]);

export function isVehicleId(v: unknown): v is VehicleId {
  return typeof v === "string" && (VEHICLE_IDS as readonly string[]).includes(v);
}
