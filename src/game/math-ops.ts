export type OpKind = "add" | "sub" | "mul" | "div";
export type Op = { kind: OpKind; value: number };

export function opLabel(op: Op): string {
  const sym = { add: "+", sub: "−", mul: "×", div: "÷" }[op.kind];
  return `${sym}${op.value}`;
}

export function applyOp(power: number, op: Op): number {
  let n = power;
  switch (op.kind) {
    case "add":
      n += op.value;
      break;
    case "sub":
      n -= op.value;
      break;
    case "mul":
      n *= op.value;
      break;
    case "div":
      n = Math.floor(n / Math.max(1, op.value));
      break;
  }
  return Math.max(0, Math.min(99999, Math.floor(n)));
}

export function opColor(op: Op): string {
  if (op.kind === "add") return "#5dbea3";
  if (op.kind === "mul") return "#7eb8c9";
  if (op.kind === "sub") return "#c45c4a";
  return "#8a9bb0";
}

function ri(rng: () => number, a: number, b: number) {
  return a + Math.floor(rng() * (b - a + 1));
}

export function pickGoodOp(power: number, difficulty: number, rng: () => number): Op {
  if (power < 10) return { kind: "add", value: ri(rng, 4, 10) };
  const mulChance = 0.22 + difficulty * 0.18;
  if (rng() < mulChance && power < 400) {
    return { kind: "mul", value: power < 30 && rng() < 0.2 ? 3 : 2 };
  }
  const span = 6 + Math.floor(difficulty * 10);
  return { kind: "add", value: ri(rng, 5, 8 + span) };
}

export function pickBaitOp(power: number, difficulty: number, rng: () => number): Op {
  const r = rng();
  if (r < 0.28) return { kind: "sub", value: ri(rng, 2, 4 + Math.floor(difficulty * 8)) };
  if (r < 0.5 && power >= 4) return { kind: "div", value: 2 };
  if (r < 0.7) return { kind: "add", value: ri(rng, 1, 3) };
  if (r < 0.86 && power > 8) return { kind: "mul", value: 2 };
  return { kind: "sub", value: ri(rng, 1, 5) };
}

/**
 * Wall HP from the balls you actually have — never a best-path fantasy.
 * 2–3 lane walls are always cheaper than your load. 1-lane walls can match
 * you so swerving is the play, but they never jump to 3× your pile.
 */
export function fairWallHp(have: number, lanes: number, difficulty: number, jitter = 0): number {
  const load = Math.max(1, Math.floor(have));
  const d = Math.max(0, Math.min(1, difficulty));
  const j = Math.max(0, Math.min(1, jitter));
  const ratio =
    lanes >= 3
      ? 0.3 + d * 0.16 + j * 0.04
      : lanes === 2
        ? 0.38 + d * 0.18 + j * 0.04
        : 0.58 + d * 0.22 + j * 0.06;
  let hp = Math.max(2, Math.round(load * ratio));
  if (lanes >= 2) hp = Math.min(hp, Math.max(1, load - 1));
  else hp = Math.min(hp, load);
  return hp;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
