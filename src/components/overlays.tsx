import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Gem,
  Magnet,
  Moon,
  Pause,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Settings,
  Shield,
  Shapes,
  ShoppingBag,
  Target,
  Trophy,
  Truck,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimPilot, listBoard, postScore, type BoardPayload } from "@/game/board";
import { getGame } from "@/game/engine";
import { loadSave } from "@/game/save";
import { useHud } from "@/game/store";
import { THEME_LIST, THEMES, type ThemeId } from "@/game/themes";
import { VEHICLE_LIST, VEHICLES, type VehicleId } from "@/game/vehicles";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return Math.floor(n).toLocaleString("en-US");
}

const WORLD_ICON: Record<ThemeId, typeof Flame> = {
  forge: Flame,
  reef: Waves,
  toon: Shapes,
  luna: Moon,
};

export function Overlays() {
  const phase = useHud((s) => s.phase);
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <IdentityBoot />
      <BoardSync />
      {phase === "title" && <TitleCard />}
      {phase === "playing" && <Hud />}
      {phase === "paused" && <PauseCard />}
      {phase === "dead" && <DeadCard />}
      {(phase === "playing" || phase === "paused") && <TouchPads />}
    </div>
  );
}

const VEHICLE_ICON: Record<VehicleId, typeof Flame> = {
  rig: Target,
  howl: Truck,
  gale: Wind,
  bolt: Zap,
  skiff: Rocket,
  hydra: Crown,
};

const VEHICLE_CHIP: Record<VehicleId, string> = {
  rig: "bg-good",
  howl: "bg-danger",
  gale: "bg-fg",
  bolt: "bg-steel",
  skiff: "bg-good",
  hydra: "bg-danger",
};

type TitlePanel = "shop" | "stats" | "daily" | "settings" | "board" | null;

function TitleCard() {
  const highScore = useHud((s) => s.highScore);
  const highScores = useHud((s) => s.highScores);
  const muted = useHud((s) => s.muted);
  const shake = useHud((s) => s.shake);
  const theme = useHud((s) => s.theme);
  const wallet = useHud((s) => s.wallet);
  const vehicle = useHud((s) => s.vehicle);
  const owned = useHud((s) => s.owned);
  const shopHint = useHud((s) => s.shopHint);
  const lastDaily = useHud((s) => s.lastDaily);
  const worldName = useHud((s) => s.worldName);
  const playerName = useHud((s) => s.playerName);
  const youRank = useHud((s) => s.board?.you?.rank ?? null);
  const [panel, setPanel] = useState<TitlePanel>(null);
  const [mounted, setMounted] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const dailyReady = lastDaily !== today;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    getGame()?.setMenuOpen(panel !== null);
    return () => getGame()?.setMenuOpen(false);
  }, [panel]);

  const open = (next: TitlePanel) => setPanel((cur) => (cur === next ? null : next));

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-bg/55 via-transparent to-bg/80 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.1rem,env(safe-area-inset-bottom))] sm:px-10">
      <header className="pointer-events-auto flex items-start justify-between">
        <button
          type="button"
          aria-label={`Bank ${fmt(wallet)} gems, open shop`}
          onClick={() => open("shop")}
          className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface/80 py-2 pr-2 pl-3"
        >
          <Gem className="size-4 text-steel" />
          <span className="font-display text-sm font-bold tabular-nums">{fmt(wallet)}</span>
          <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-fg">
            <Plus className="size-3.5" />
          </span>
        </button>
        <Button
          variant="secondary"
          size="icon"
          aria-label="Settings"
          className="rounded-full"
          onClick={() => open("settings")}
        >
          <Settings />
        </Button>
      </header>

      <div className="mt-6 text-center sm:mt-8">
        <h1 className="title-mark font-display text-5xl leading-[0.88] font-extrabold tracking-tight text-fg uppercase sm:text-7xl">
          Cannon
          <span className="block">Math</span>
        </h1>
        <p className="mt-3 font-display text-xs font-semibold tracking-[0.34em] text-steel uppercase">
          Shoot · Solve · Reach
        </p>
        <p className="mt-2 text-xs text-muted">{worldName}</p>
        <p className="mt-1 h-5 font-display text-sm font-semibold text-steel">
          {mounted && playerName ? (youRank ? `${playerName} · #${youRank}` : playerName) : " "}
        </p>
      </div>

      <div className="flex-1" />

      <div className="pointer-events-auto mx-auto w-full max-w-md">
        <ul className="mb-4 flex justify-center gap-2">
          {THEME_LIST.map((world) => {
            const Icon = WORLD_ICON[world.id];
            const on = theme === world.id;
            return (
              <li key={world.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${world.name}, ${world.blurb}`}
                  onClick={() => getGame()?.setTheme(world.id)}
                  className={cn(
                    "flex size-11 flex-col items-center justify-center rounded-[var(--radius-md)] border transition-[border-color,background-color] duration-(--motion-quick) ease-(--ease-out)",
                    on ? "border-accent bg-surface text-fg" : "border-border bg-surface/70 text-muted hover:bg-surface",
                  )}
                >
                  <Icon className="size-4 text-steel" />
                </button>
              </li>
            );
          })}
        </ul>

        <Button
          variant="secondary"
          size="xl"
          className="play-cta h-14 w-full rounded-full bg-surface text-lg font-semibold tracking-[0.22em] text-fg uppercase"
          onClick={() => getGame()?.play()}
        >
          <Play className="size-5" />
          Play
        </Button>
        <p className="mt-2 text-center text-xs tracking-[0.18em] text-subtle uppercase">Tap to start</p>

        <nav className="mt-5 grid grid-cols-4 gap-2">
          <DockBtn label="Stats" icon={BarChart3} on={panel === "stats"} onClick={() => open("stats")} />
          <DockBtn label="Global" icon={Trophy} on={panel === "board"} onClick={() => open("board")} />
          <DockBtn label="Daily" icon={Calendar} on={panel === "daily"} onClick={() => open("daily")} />
          <DockBtn label="Shop" icon={ShoppingBag} on={panel === "shop"} onClick={() => open("shop")} />
        </nav>
      </div>

      {panel && (
        <Sheet
          title={
            panel === "shop"
              ? "Garage"
              : panel === "stats"
                ? "Stats"
                : panel === "daily"
                  ? "Daily"
                  : panel === "board"
                    ? "Global"
                    : "Settings"
          }
          onClose={() => setPanel(null)}
        >
          {panel === "shop" && (
            <GarageGrid owned={owned} vehicle={vehicle} wallet={wallet} shopHint={shopHint} />
          )}
          {panel === "stats" && <StatsList highScore={highScore} highScores={highScores} />}
          {panel === "board" && <BoardPanel />}
          {panel === "daily" && (
            <div className="text-center">
              <p className="text-sm text-muted">A small gem drop, once a day.</p>
              <p className="mt-3 font-display text-4xl font-extrabold tabular-nums text-steel">+30</p>
              <Button className="mt-5 w-full" size="lg" disabled={!dailyReady} onClick={() => getGame()?.claimDaily()}>
                <Gem className="size-4" />
                {dailyReady ? "Claim" : "Claimed"}
              </Button>
              {shopHint ? <p className="mt-3 text-xs text-muted">{shopHint}</p> : null}
            </div>
          )}
          {panel === "settings" && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">
                You are <span className="font-display font-semibold text-fg">{playerName}</span>. This name, your
                gems, and your best stay on this device.
              </p>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => getGame()?.toggleMute()}>
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                {muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => getGame()?.toggleShake()}>
                Screen shake {shake ? "on" : "off"}
              </Button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

function DockBtn({
  label,
  icon: Icon,
  on,
  onClick,
}: {
  label: string;
  icon: typeof Flame;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border transition-[border-color,background-color] duration-(--motion-quick) ease-(--ease-out)",
        on ? "border-accent bg-surface text-fg" : "border-border bg-surface/75 text-muted hover:bg-surface",
      )}
    >
      <Icon className="size-4 text-steel" />
      <span className="font-display text-xs font-semibold tracking-[0.16em] uppercase">{label}</span>
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-end justify-center bg-bg/50 sm:items-center">
      <div className="title-sheet hud-enter w-full max-w-md overflow-y-auto rounded-t-[var(--radius-xl)] border border-border bg-surface p-5 sm:rounded-[var(--radius-xl)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function GarageGrid({
  owned,
  vehicle,
  wallet,
  shopHint,
}: {
  owned: VehicleId[];
  vehicle: VehicleId;
  wallet: number;
  shopHint: string;
}) {
  return (
    <>
      <p className="mb-3 text-sm text-muted">Spend banked gems. Equipped rigs swap on the track.</p>
      <ul className="grid grid-cols-2 gap-2">
        {VEHICLE_LIST.map((rig) => {
          const Icon = VEHICLE_ICON[rig.id];
          const mine = owned.includes(rig.id);
          const on = vehicle === rig.id;
          const canBuy = !mine && wallet >= rig.price;
          const label = on
            ? `${rig.name}, equipped`
            : mine
              ? `${rig.name}, owned`
              : `${rig.name}, ${rig.price} gems`;
          return (
            <li key={rig.id}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={label}
                onClick={() => getGame()?.setVehicle(rig.id)}
                className={cn(
                  "flex min-h-16 w-full flex-col items-start rounded-[var(--radius-lg)] border px-3 py-2.5 text-left transition-[border-color,background-color] duration-(--motion-quick) ease-(--ease-out)",
                  on ? "border-accent bg-surface-2 text-fg" : "border-border bg-bg/40 text-muted hover:bg-surface-2",
                )}
              >
                <span className="flex w-full items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface text-accent">
                    <Icon className="size-4" />
                  </span>
                  <span className={cn("size-2 shrink-0 rounded-full", VEHICLE_CHIP[rig.id])} />
                  <span className="min-w-0 flex-1 font-display text-sm font-semibold text-fg">{rig.name}</span>
                </span>
                <span className="mt-1.5 block text-xs text-muted">{rig.perk}</span>
                <span
                  className={cn(
                    "mt-1 font-display text-xs font-semibold tabular-nums",
                    on ? "text-good" : canBuy ? "text-steel" : "text-muted",
                  )}
                >
                  {on ? "Equipped" : mine ? "Owned" : `${fmt(rig.price)} gems`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shopHint ? <p className="mt-3 text-xs text-muted">{shopHint}</p> : null}
    </>
  );
}

function StatsList({
  highScore,
  highScores,
}: {
  highScore: number;
  highScores: Record<ThemeId, number>;
}) {
  const playerName = useHud((s) => s.playerName);
  const wallet = useHud((s) => s.wallet);
  return (
    <>
      <p className="text-sm text-muted">{playerName}</p>
      <p className="mt-3 font-display text-xs font-semibold tracking-[0.22em] text-subtle uppercase">Best</p>
      <p className="mt-1 font-display text-4xl font-extrabold tabular-nums">{fmt(highScore)}</p>
      <p className="mt-1 text-sm text-muted tabular-nums">Bank {fmt(wallet)}</p>
      <ul className="mt-4 grid gap-2">
        {THEME_LIST.map((world) => {
          const Icon = WORLD_ICON[world.id];
          return (
            <li
              key={world.id}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-border bg-bg/40 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-fg">
                <Icon className="size-4 text-steel" />
                {world.name}
              </span>
              <span className="font-display text-sm font-bold tabular-nums">{fmt(highScores[world.id] ?? 0)}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function IdentityBoot() {
  useEffect(() => {
    const save = loadSave();
    if (!save.playerId || save.playerId.startsWith("0000")) return;
    useHud.setState({
      playerName: save.playerName,
      playerId: save.playerId,
      wallet: save.wallet,
      gems: save.wallet,
      highScore: save.highScores[save.theme] ?? 0,
      highScores: { ...save.highScores },
      lastDaily: save.lastDaily,
      theme: save.theme,
      worldName: THEMES[save.theme].name,
      muted: save.muted,
      shake: save.shake,
      vehicle: save.vehicle,
      owned: [...save.owned],
      vehicleName: VEHICLES[save.vehicle].name,
    });
  }, []);
  return null;
}

function BoardSync() {
  const phase = useHud((s) => s.phase);
  const score = useHud((s) => s.score);
  const highScore = useHud((s) => s.highScore);
  const playerName = useHud((s) => s.playerName);
  const playerId = useHud((s) => s.playerId);
  const posted = useRef(0);
  const claimed = useRef(false);

  useEffect(() => {
    if (!playerId || playerId.startsWith("0000") || !playerName) return;

    const run = async () => {
      if (!claimed.current) {
        claimed.current = true;
        try {
          await claimPilot({ data: { playerId, name: playerName } });
          const best = useHud.getState().highScore;
          const board =
            best > 0
              ? await postScore({ data: { playerId, name: playerName, score: best } })
              : await listBoard({ data: { playerId } });
          useHud.setState({ board });
        } catch {
          claimed.current = false;
        }
      }

      if (phase === "playing") posted.current = 0;
      if (phase !== "dead") return;
      const final = Math.max(score, highScore, useHud.getState().highScore);
      if (final <= 0 || final <= posted.current) return;
      posted.current = final;
      try {
        const board = await postScore({ data: { playerId, name: playerName, score: final } });
        useHud.setState({ board });
      } catch {
        posted.current = 0;
      }
    };

    void run();
  }, [phase, score, highScore, playerName, playerId]);

  return null;
}

function BoardPanel() {
  const playerName = useHud((s) => s.playerName);
  const playerId = useHud((s) => s.playerId);
  const cached = useHud((s) => s.board);
  const [data, setData] = useState<BoardPayload | null>(cached);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    void listBoard({ data: { playerId } })
      .then((board) => {
        if (!live) return;
        setData(board);
        useHud.setState({ board });
      })
      .catch(() => {
        if (live) setErr("Board is warming up.");
      });
    return () => {
      live = false;
    };
  }, [playerId]);

  const view = data ?? cached;
  if (err && !view) return <p className="text-sm text-muted">{err}</p>;
  if (!view) return <p className="text-sm text-muted">Loading board…</p>;

  const you = view.you ?? view.entries.find((e) => e.playerId === playerId) ?? null;

  return (
    <>
      <p className="text-sm text-muted">
        This week’s ranks. Monday starts fresh. Last week’s top 3 stay until a higher score beats them.
      </p>
      {you ? (
        <p className="mt-2 text-sm text-steel">
          You · {playerName} · #{you.rank} · {fmt(you.score)}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">{playerName} · finish a run to post</p>
      )}
      <ul className="mt-4 grid gap-1.5">
        {view.entries.length === 0 && <li className="text-sm text-muted">No scores yet this week.</li>}
        {view.entries.map((row) => {
          const mine = row.playerId === playerId;
          return (
            <li
              key={row.playerId}
              className={cn(
                "flex items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2",
                mine ? "border-accent bg-surface-2" : "border-border bg-bg/40",
              )}
            >
              <span className="w-6 font-display text-sm font-bold tabular-nums text-subtle">{row.rank}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-fg">{row.name}</span>
              {row.held ? (
                <span className="text-xs font-medium tracking-[0.14em] text-steel uppercase">Held</span>
              ) : null}
              <span className="font-display text-sm font-bold tabular-nums">{fmt(row.score)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-subtle">
        Week {view.weekId} · resets {view.resetsOn} UTC. Your name, gems, and best stay on this device.
      </p>
    </>
  );
}

function Hud() {
  const power = useHud((s) => s.power);
  const distance = useHud((s) => s.distance);
  const gems = useHud((s) => s.gems);
  const combo = useHud((s) => s.combo);
  const lastOp = useHud((s) => s.lastOp);
  const lastOpAt = useHud((s) => s.lastOpAt);
  const wallHp = useHud((s) => s.wallHp);
  const shielded = useHud((s) => s.shielded);
  const magnet = useHud((s) => s.magnet);
  const muted = useHud((s) => s.muted);
  const hint = useHud((s) => s.hint);
  const worldName = useHud((s) => s.worldName);
  const vehicleName = useHud((s) => s.vehicleName);

  return (
    <>
      <div className="pointer-events-auto absolute top-0 right-0 left-0 flex items-start justify-between px-4 pt-[max(0.9rem,env(safe-area-inset-top))] sm:px-6">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface/80 px-3 py-2">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Distance</p>
          <p className="font-display text-lg font-bold tabular-nums leading-tight">
            {fmt(distance)}
            <span className="ml-1 text-xs font-medium text-muted">m</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {worldName} · {vehicleName}
          </p>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-xs font-medium tracking-[0.22em] text-muted uppercase">Balls</p>
          <p className="font-display text-5xl font-extrabold tabular-nums leading-none text-fg sm:text-6xl">
            {fmt(power)}
          </p>
          {shielded && (
            <p className="mt-1 flex items-center gap-1 font-display text-xs font-semibold tracking-[0.16em] text-accent uppercase">
              <Shield className="size-3" />
              Shield
            </p>
          )}
          {magnet && (
            <p className="mt-1 flex items-center gap-1 font-display text-xs font-semibold tracking-[0.16em] text-danger uppercase">
              <Magnet className="size-3" />
              Magnet
            </p>
          )}
          {lastOp ? (
            <span
              key={lastOpAt}
              className={cn(
                "hud-pop mt-1 font-display text-sm font-bold",
                lastOp.startsWith("−") || lastOp.startsWith("÷") ? "text-danger" : "text-good",
              )}
            >
              {lastOp}
            </span>
          ) : (
            <span className="mt-1 h-5" />
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="rounded-[var(--radius-lg)] border border-border bg-surface/80 px-3 py-2 text-right">
            <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Gems</p>
            <p className="font-display text-lg font-bold tabular-nums leading-tight text-steel">{fmt(gems)}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon" aria-label={muted ? "Unmute" : "Mute"} onClick={() => getGame()?.toggleMute()}>
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button variant="secondary" size="icon" aria-label="Pause" onClick={() => getGame()?.pause()}>
              <Pause />
            </Button>
          </div>
        </div>
      </div>
      {(combo > 1 || wallHp !== null || hint) && (
        <div className="absolute top-[7.5rem] left-1/2 -translate-x-1/2 text-center">
          {hint && <p className="font-display text-sm font-semibold tracking-wide text-fg">{hint}</p>}
          {combo > 1 && (
            <p className="font-display text-sm font-bold tracking-[0.16em] text-accent uppercase">Combo {combo}</p>
          )}
          {wallHp !== null && (
            <p className={cn("mt-1 text-xs tabular-nums", wallHp <= power ? "text-good" : "text-danger")}>
              Wall {wallHp} / {fmt(power)}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function PauseCard() {
  const score = useHud((s) => s.score);
  const muted = useHud((s) => s.muted);
  const shake = useHud((s) => s.shake);
  const worldName = useHud((s) => s.worldName);
  const vehicleName = useHud((s) => s.vehicleName);
  return (
    <div className="pointer-events-auto flex h-full items-center justify-center bg-bg/70 px-5">
      <div className="hud-enter w-full max-w-sm rounded-[var(--radius-xl)] border border-border bg-surface p-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">Paused</h2>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {worldName} · {vehicleName} · Score {fmt(score)}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => getGame()?.resume()}>
            <Play className="size-4" />
            Resume
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => getGame()?.toggleMute()}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            {muted ? "Unmute" : "Mute"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => getGame()?.toggleShake()}>
            Screen shake {shake ? "on" : "off"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => getGame()?.toTitle()}>
            Menu
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeadCard() {
  const score = useHud((s) => s.score);
  const highScore = useHud((s) => s.highScore);
  const distance = useHud((s) => s.distance);
  const worldName = useHud((s) => s.worldName);
  const wallet = useHud((s) => s.wallet);
  const vehicleName = useHud((s) => s.vehicleName);
  const playerName = useHud((s) => s.playerName);
  const you = useHud((s) => s.board?.you ?? null);
  const isBest = score > 0 && score >= highScore;
  return (
    <div className="pointer-events-auto flex h-full items-center justify-center bg-bg/70 px-5">
      <div className="hud-enter w-full max-w-sm rounded-[var(--radius-xl)] border border-border bg-surface p-6">
        <p className="text-xs font-bold tracking-[0.24em] text-muted uppercase">
          {playerName} · {worldName} · {vehicleName}
        </p>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{isBest ? "New best" : "Smashed"}</h2>
        <p className="mt-4 font-display text-5xl font-extrabold tabular-nums">{fmt(score)}</p>
        <p className="mt-2 text-sm text-muted tabular-nums">
          {fmt(distance)} m · bank {fmt(wallet)}
          {you ? ` · board #${you.rank}` : ""}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" className="w-full" onClick={() => getGame()?.play()}>
            <RotateCcw className="size-4" />
            Again
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => getGame()?.toTitle()}>
            Menu
          </Button>
        </div>
      </div>
    </div>
  );
}

function TouchPads() {
  const leftRef = useRef<HTMLButtonElement>(null);
  const rightRef = useRef<HTMLButtonElement>(null);
  const phase = useHud((s) => s.phase);

  useEffect(() => {
    const bind = (el: HTMLButtonElement | null, side: "left" | "right") => {
      if (!el) return;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        if (side === "left") getGame()?.setUiLeft(true);
        else getGame()?.setUiRight(true);
      };
      const up = () => {
        if (side === "left") getGame()?.setUiLeft(false);
        else getGame()?.setUiRight(false);
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("lostpointercapture", up);
      return () => {
        el.removeEventListener("pointerdown", down);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
        el.removeEventListener("lostpointercapture", up);
        up();
      };
    };
    const a = bind(leftRef.current, "left");
    const b = bind(rightRef.current, "right");
    return () => {
      a?.();
      b?.();
    };
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-auto absolute right-0 bottom-0 left-0 flex justify-between px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden",
        phase !== "playing" && "pointer-events-none opacity-40",
      )}
    >
      <Button ref={leftRef} variant="secondary" size="pad" aria-label="Lane left" className="bg-surface/80">
        <ChevronLeft className="size-7" />
      </Button>
      <Button ref={rightRef} variant="secondary" size="pad" aria-label="Lane right" className="bg-surface/80">
        <ChevronRight className="size-7" />
      </Button>
    </div>
  );
}
