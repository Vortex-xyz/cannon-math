const GAME_CODES = new Set([
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyS",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "Enter",
  "Escape",
  "KeyP",
]);

export class GameInput {
  private keys = new Set<string>();
  private injected = new Set<string>();
  uiLeft = false;
  uiRight = false;
  private swipeQueued = 0;
  private ptrId: number | null = null;
  private ptrX = 0;
  private ptrY = 0;
  private canvas: HTMLElement | null = null;
  private pauseQueued = false;
  private confirmQueued = false;
  private bound = false;
  private leftWas = false;
  private rightWas = false;
  private leftHold = 0;
  private rightHold = 0;

  private onDown = (e: KeyboardEvent) => {
    if (GAME_CODES.has(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "Escape" || e.code === "KeyP") this.pauseQueued = true;
    if (e.code === "Space" || e.code === "Enter") this.confirmQueued = true;
  };
  private onUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
    this.uiLeft = false;
    this.uiRight = false;
    this.leftWas = false;
    this.rightWas = false;
    this.leftHold = 0;
    this.rightHold = 0;
  };
  private onPointerDown = (e: PointerEvent) => {
    if (this.ptrId !== null) return;
    this.ptrId = e.pointerId;
    this.ptrX = e.clientX;
    this.ptrY = e.clientY;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.ptrId) return;
    const dx = e.clientX - this.ptrX;
    const dy = e.clientY - this.ptrY;
    this.ptrId = null;
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 0.85) {
      this.swipeQueued += dx < 0 ? -1 : 1;
    }
  };
  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId === this.ptrId) this.ptrId = null;
  };

  bind(canvas: HTMLElement) {
    if (this.bound) return;
    this.bound = true;
    this.canvas = canvas;
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
  }

  dispose() {
    if (!this.bound) return;
    this.bound = false;
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas?.removeEventListener("pointerup", this.onPointerUp);
    this.canvas?.removeEventListener("pointercancel", this.onPointerCancel);
  }

  setInjected(codes: string[]) {
    this.injected = new Set(codes);
  }

  get leftHeld() {
    return (
      this.keys.has("KeyA") ||
      this.keys.has("ArrowLeft") ||
      this.injected.has("KeyA") ||
      this.injected.has("ArrowLeft") ||
      this.uiLeft ||
      this.padDir() < 0
    );
  }

  get rightHeld() {
    return (
      this.keys.has("KeyD") ||
      this.keys.has("ArrowRight") ||
      this.injected.has("KeyD") ||
      this.injected.has("ArrowRight") ||
      this.uiRight ||
      this.padDir() > 0
    );
  }

  consumeLaneDelta(dt: number) {
    let d = 0;
    const left = this.leftHeld;
    const right = this.rightHeld;
    if (left) {
      this.leftHold += dt;
      if (!this.leftWas) d -= 1;
      else if (this.leftHold > 0.2) {
        d -= 1;
        this.leftHold = 0.05;
      }
    } else {
      this.leftHold = 0;
    }
    if (right) {
      this.rightHold += dt;
      if (!this.rightWas) d += 1;
      else if (this.rightHold > 0.2) {
        d += 1;
        this.rightHold = 0.05;
      }
    } else {
      this.rightHold = 0;
    }
    this.leftWas = left;
    this.rightWas = right;
    if (this.swipeQueued) {
      d += Math.sign(this.swipeQueued);
      this.swipeQueued -= Math.sign(this.swipeQueued);
    }
    return Math.max(-1, Math.min(1, d));
  }

  consumePause() {
    const p = this.pauseQueued;
    this.pauseQueued = false;
    return p;
  }

  consumeConfirm() {
    const c = this.confirmQueued;
    this.confirmQueued = false;
    return c;
  }

  private padDir() {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad || pad.mapping !== "standard") continue;
      const ax = pad.axes[0] ?? 0;
      if (ax < -0.45 || pad.buttons[14]?.pressed) return -1;
      if (ax > 0.45 || pad.buttons[15]?.pressed) return 1;
    }
    return 0;
  }
}
