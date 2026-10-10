import { useEffect, useRef } from "react";
import { Overlays } from "@/components/overlays";
import { GameEngine } from "@/game/engine";

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GameEngine(canvas);
    engine.start();
    return () => engine.dispose();
  }, []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg select-none">
      <h1 className="sr-only">Cannon Math</h1>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <Overlays />
    </main>
  );
}
