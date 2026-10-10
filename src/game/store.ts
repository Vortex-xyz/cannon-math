import { create } from "zustand";
import type { BoardPayload } from "./board";
import { loadSave } from "./save";
import { THEMES, type ThemeId } from "./themes";
import { VEHICLES, type VehicleId } from "./vehicles";

export type GamePhase = "title" | "playing" | "paused" | "dead";

export type HudState = {
  phase: GamePhase;
  power: number;
  distance: number;
  gems: number;
  score: number;
  highScore: number;
  highScores: Record<ThemeId, number>;
  combo: number;
  lastOp: string | null;
  lastOpAt: number;
  wallHp: number | null;
  shielded: boolean;
  magnet: boolean;
  muted: boolean;
  shake: boolean;
  hint: string;
  theme: ThemeId;
  worldName: string;
  wallet: number;
  vehicle: VehicleId;
  owned: VehicleId[];
  vehicleName: string;
  shopHint: string;
  lastDaily: string;
  playerName: string;
  playerId: string;
  board: BoardPayload | null;
};

const save = loadSave();
const named = save.playerId.startsWith("0000") ? "" : save.playerName;

export const useHud = create<HudState>(() => ({
  phase: "title",
  power: 6,
  distance: 0,
  gems: 0,
  score: 0,
  highScore: save.highScores[save.theme] ?? 0,
  highScores: { ...save.highScores },
  combo: 0,
  lastOp: null,
  lastOpAt: 0,
  wallHp: null,
  shielded: false,
  magnet: false,
  muted: save.muted,
  shake: save.shake,
  hint: "",
  theme: save.theme,
  worldName: THEMES[save.theme].name,
  wallet: save.wallet,
  vehicle: save.vehicle,
  owned: [...save.owned],
  vehicleName: VEHICLES[save.vehicle].name,
  shopHint: "",
  lastDaily: save.lastDaily,
  playerName: named,
  playerId: save.playerId,
  board: null,
}));
