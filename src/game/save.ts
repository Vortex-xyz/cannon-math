import { SAVE_KEY, SAVE_VERSION } from "./config";
import { isPilotName, isPlayerId, makePilotName, makePlayerId } from "./names";
import { THEME_IDS, isThemeId, type ThemeId } from "./themes";
import { VEHICLE_IDS, isVehicleId, type VehicleId } from "./vehicles";

const PILOT_KEY = "cannon-math-pilot";

export type SaveData = {
  version: number;
  highScore: number;
  highScores: Record<ThemeId, number>;
  theme: ThemeId;
  muted: boolean;
  shake: boolean;
  wallet: number;
  vehicle: VehicleId;
  owned: VehicleId[];
  lastDaily: string;
  playerName: string;
  playerId: string;
};

export type Pilot = { playerId: string; playerName: string };

const SSR_PILOT: Pilot = {
  playerId: "00000000000000000000000000000000",
  playerName: "Ion Fox",
};

function emptyScores(): Record<ThemeId, number> {
  return { forge: 0, reef: 0, toon: 0, luna: 0, frost: 0, dune: 0 };
}

function writePilot(pilot: Pilot) {
  if (typeof window === "undefined") return;
  if (!isPlayerId(pilot.playerId) || pilot.playerId.startsWith("0000")) return;
  try {
    localStorage.setItem(PILOT_KEY, JSON.stringify(pilot));
  } catch {
    // private mode / quota
  }
}

function asPilot(id: unknown, name: unknown): Pilot | null {
  if (!isPlayerId(id) || id.startsWith("0000")) return null;
  if (!isPilotName(name)) return { playerId: id, playerName: makePilotName(id) };
  return { playerId: id, playerName: name };
}

function readStoredPilot(): Pilot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PILOT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Pilot>;
      const ok = asPilot(p.playerId, p.playerName);
      if (ok) return ok;
    }
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return asPilot(parsed.playerId, parsed.playerName);
  } catch {
    return null;
  }
}

export function loadPilot(): Pilot {
  if (typeof window === "undefined") return SSR_PILOT;
  const existing = readStoredPilot();
  if (existing) {
    writePilot(existing);
    return existing;
  }
  const playerId = makePlayerId();
  const playerName = makePilotName(playerId);
  const p = { playerId, playerName };
  writePilot(p);
  return p;
}

function blank(pilot: Pilot): SaveData {
  return {
    version: SAVE_VERSION,
    highScore: 0,
    highScores: emptyScores(),
    theme: "forge",
    muted: false,
    shake: true,
    wallet: 80,
    vehicle: "rig",
    owned: ["rig"],
    lastDaily: "",
    playerId: pilot.playerId,
    playerName: pilot.playerName,
  };
}

function migrate(raw: Partial<SaveData> & { version?: number }, pilot: Pilot): SaveData {
  const scores = emptyScores();
  if (raw.highScores && typeof raw.highScores === "object") {
    for (const id of THEME_IDS) {
      const n = raw.highScores[id];
      scores[id] = typeof n === "number" && Number.isFinite(n) ? n : 0;
    }
  }
  const legacy = typeof raw.highScore === "number" && Number.isFinite(raw.highScore) ? raw.highScore : 0;
  scores.forge = Math.max(scores.forge, legacy);
  const theme = isThemeId(raw.theme) ? raw.theme : "forge";
  const best = Math.max(...THEME_IDS.map((id) => scores[id]));
  const owned = new Set<VehicleId>(["rig"]);
  if (Array.isArray(raw.owned)) {
    for (const id of raw.owned) {
      if (isVehicleId(id)) owned.add(id);
    }
  }
  const vehicle = isVehicleId(raw.vehicle) && owned.has(raw.vehicle) ? raw.vehicle : "rig";
  const wallet =
    typeof raw.wallet === "number" && Number.isFinite(raw.wallet)
      ? Math.max(0, Math.floor(raw.wallet))
      : Math.max(80, Math.floor(best / 8));
  const keep = asPilot(pilot.playerId, pilot.playerName) ?? asPilot(raw.playerId, raw.playerName) ?? pilot;
  return {
    version: SAVE_VERSION,
    highScore: best,
    highScores: scores,
    theme,
    muted: Boolean(raw.muted),
    shake: raw.shake !== false,
    wallet,
    vehicle,
    owned: VEHICLE_IDS.filter((id) => owned.has(id)),
    lastDaily: typeof raw.lastDaily === "string" ? raw.lastDaily : "",
    playerId: keep.playerId,
    playerName: keep.playerName,
  };
}

export function loadSave(): SaveData {
  const pilot = loadPilot();
  if (typeof window === "undefined") {
    return { ...blank(pilot), highScores: emptyScores(), owned: ["rig"] };
  }
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const fresh = blank(pilot);
      writeSave(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const data = migrate(parsed, pilot);
    writeSave(data);
    return data;
  } catch {
    const existing = readStoredPilot();
    const fresh = blank(existing ?? pilot);
    writeSave(fresh);
    return fresh;
  }
}

export function writeSave(data: SaveData) {
  if (typeof window === "undefined") return;
  if (!isPlayerId(data.playerId) || data.playerId.startsWith("0000")) return;
  try {
    writePilot({ playerId: data.playerId, playerName: data.playerName });
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
  } catch {
    // private mode / quota — keep playing
  }
}
