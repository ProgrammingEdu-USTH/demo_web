// Âm tổng hợp đơn giản bằng WebAudio. Mặc định tắt; chỉ tạo AudioContext khi người dùng bật (cử chỉ người dùng).
import type { SoundName } from "../timeline/types";
import { audio } from "../tokens/audio";

export class Synth {
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  enabled = false;

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on && !this.ctx && typeof AudioContext === "function") {
      this.ctx = new AudioContext();
      const n = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = n.getChannelData(0);
      let s = 1;
      for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      this.noise = n;
    }
    if (on) void this.ctx?.resume();
  }

  play(name: SoundName): void {
    const c = this.ctx;
    if (!this.enabled || !c) return;
    const t = c.currentTime;
    const out = c.createGain();
    out.gain.value = audio.master;
    out.connect(c.destination);
    const env = (g: GainNode, dur: number, peak = 1) => {
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    };
    const noise = (hz: number, type: BiquadFilterType, dur: number) => {
      if (!this.noise) return;
      const src = c.createBufferSource();
      src.buffer = this.noise;
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = hz;
      const g = c.createGain();
      env(g, dur);
      src.connect(f).connect(g).connect(out);
      src.start(t);
      src.stop(t + dur);
    };
    const tone = (from: number, to: number, dur: number, type: OscillatorType = "sine") => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(to, t + dur);
      const g = c.createGain();
      env(g, dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur);
    };
    if (name === "kick") tone(audio.kick.from, audio.kick.to, audio.kick.dur);
    else if (name === "snare") { tone(audio.snare.tone, audio.snare.tone, audio.snare.dur, "triangle"); noise(audio.snare.noiseHz, "bandpass", audio.snare.dur); }
    else if (name === "hat") noise(audio.hat.noiseHz, "highpass", audio.hat.dur);
    else tone(audio.ding.tone, audio.ding.tone, audio.ding.dur, "triangle");
  }

  destroy(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}
