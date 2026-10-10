export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private rumble: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private pulse: OscillatorNode | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx.gain.value = 0.7;
      this.music.gain.value = 0.22;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.applyMute();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMute();
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  startRun() {
    this.unlock();
    if (!this.ctx || !this.music || this.rumble) return;
    const t = this.ctx.currentTime;
    this.rumble = this.ctx.createOscillator();
    this.rumble.type = "triangle";
    this.rumble.frequency.value = 58;
    this.rumbleGain = this.ctx.createGain();
    this.rumbleGain.gain.setValueAtTime(0.0001, t);
    this.rumbleGain.gain.exponentialRampToValueAtTime(this.muted ? 0.0001 : 0.045, t + 0.2);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;
    this.rumble.connect(filter);
    filter.connect(this.rumbleGain);
    this.rumbleGain.connect(this.music);
    this.rumble.start();

    this.pulse = this.ctx.createOscillator();
    this.pulse.type = "sine";
    this.pulse.frequency.value = 174;
    const pg = this.ctx.createGain();
    pg.gain.value = this.muted ? 0 : 0.018;
    this.pulse.connect(pg);
    pg.connect(this.music);
    this.pulse.start();
  }

  stopRun() {
    const t = this.ctx?.currentTime ?? 0;
    if (this.rumbleGain && this.ctx) {
      this.rumbleGain.gain.setTargetAtTime(0.0001, t, 0.04);
    }
    const r = this.rumble;
    const p = this.pulse;
    this.rumble = null;
    this.pulse = null;
    this.rumbleGain = null;
    if (r) {
      try {
        r.stop(t + 0.12);
      } catch {
        /* already stopped */
      }
    }
    if (p) {
      try {
        p.stop(t + 0.12);
      } catch {
        /* already stopped */
      }
    }
  }

  private applyMute() {
    if (!this.master || !this.ctx) return;
    const v = this.muted ? 0 : 0.85;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private makeNoise() {
    if (!this.ctx) return null;
    const len = this.ctx.sampleRate * 0.35;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private beep(freq: number, dur: number, type: OscillatorType, gain = 0.12, slide = 0) {
    if (!this.ctx || !this.sfx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(dur: number, gain = 0.18, hp = 400) {
    if (!this.ctx || !this.sfx || !this.noise || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(hp, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur);
  }

  playStart() {
    this.beep(220, 0.12, "triangle", 0.1, 180);
    this.beep(330, 0.16, "sine", 0.08, 220);
  }

  playGate(good: boolean) {
    if (good) {
      this.beep(520 + Math.random() * 40, 0.09, "triangle", 0.1, 120);
      this.beep(780, 0.12, "sine", 0.06, 80);
    } else {
      this.beep(180, 0.14, "sawtooth", 0.07, -80);
    }
  }

  playGem() {
    this.beep(880 + Math.random() * 80, 0.07, "sine", 0.06, 200);
  }

  playCrystal() {
    this.beep(740, 0.1, "triangle", 0.08, 180);
    this.beep(980, 0.14, "sine", 0.07, 220);
  }

  playMagnet() {
    this.beep(280, 0.16, "sine", 0.09, 90);
    this.beep(420, 0.2, "triangle", 0.07, 140);
  }

  playAmmo() {
    this.beep(620 + Math.random() * 40, 0.08, "triangle", 0.08, 160);
    this.beep(880, 0.1, "sine", 0.05, 120);
  }

  playShield() {
    this.beep(420, 0.14, "sine", 0.09, 280);
    this.beep(640, 0.18, "triangle", 0.06, 180);
  }

  playFire() {
    this.beep(140 + Math.random() * 40, 0.05, "square", 0.035, -60);
  }

  playBoom() {
    this.burst(0.28, 0.32, 700);
    this.beep(90, 0.22, "sine", 0.14, -50);
  }

  playCrash() {
    this.burst(0.4, 0.4, 500);
    this.beep(70, 0.3, "sawtooth", 0.1, -40);
  }
}
