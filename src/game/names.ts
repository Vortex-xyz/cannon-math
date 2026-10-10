const ADJ = [
  "Neon",
  "Tide",
  "Ember",
  "Lunar",
  "Cobalt",
  "Ash",
  "Drift",
  "Frost",
  "Pulse",
  "Rogue",
  "Steel",
  "Vapor",
  "Quartz",
  "Ion",
  "Nimbus",
  "Obsidian",
  "Reef",
  "Sable",
  "Volt",
  "Wisp",
] as const;

const NOUN = [
  "Fox",
  "Pike",
  "Bolt",
  "Moth",
  "Drake",
  "Lynx",
  "Hawk",
  "Ray",
  "Wolf",
  "Kite",
  "Crane",
  "Asp",
  "Mako",
  "Orca",
  "Rook",
  "Skiff",
  "Vole",
  "Wren",
  "Yak",
  "Zed",
] as const;

export function makePilotName(seed?: string) {
  let n = 0;
  if (seed) {
    for (let i = 0; i < seed.length; i++) n = (n * 33 + seed.charCodeAt(i)) >>> 0;
  } else {
    n = (Math.random() * 0xffffffff) >>> 0;
  }
  return `${ADJ[n % ADJ.length]} ${NOUN[(n >>> 8) % NOUN.length]}`;
}

export function isPilotName(v: unknown): v is string {
  return typeof v === "string" && /^[A-Z][a-z]{1,11} [A-Z][a-z]{1,11}$/.test(v);
}

export function makePlayerId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isPlayerId(v: unknown): v is string {
  return typeof v === "string" && /^[a-f0-9]{32}$/.test(v);
}

export function isoWeekId(at = new Date()) {
  const date = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function nextMondayUtc(at = new Date()) {
  const day = at.getUTCDay() || 7;
  const add = 8 - day;
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + add));
}
