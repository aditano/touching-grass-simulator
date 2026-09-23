const MUTE_KEY = "touching-grass-muted";

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore storage failures.
  }
}

export type LawnAudio = {
  unlock: () => void;
  rustle: () => void;
  toggleMuted: () => boolean;
  readonly muted: boolean;
};

export function createAudio(): LawnAudio {
  let context: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let windGain: GainNode | null = null;
  let master: GainNode | null = null;
  let muted = readMuted();
  let lastRustle = 0;

  function ensure(): AudioContext | null {
    if (context) return context;
    const AudioCtx = window.AudioContext;
    if (!AudioCtx) return null;
    context = new AudioCtx();
    master = context.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(context.destination);

    const length = context.sampleRate;
    noise = context.createBuffer(1, length, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    windGain = context.createGain();
    windGain.gain.value = 0.018;
    source.connect(filter);
    filter.connect(windGain);
    windGain.connect(master);
    source.start();
    return context;
  }

  return {
    get muted() {
      return muted;
    },
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === "suspended") void ctx.resume();
    },
    rustle() {
      const ctx = ensure();
      if (!ctx || !noise || !master || muted) return;
      const now = ctx.currentTime;
      if (now - lastRustle < 0.07) return;
      lastRustle = now;
      const source = ctx.createBufferSource();
      source.buffer = noise;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900 + Math.random() * 1400;
      filter.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
      source.stop(now + 0.12);
    },
    toggleMuted() {
      muted = !muted;
      writeMuted(muted);
      if (master && context) {
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(muted ? 0 : 1, now, 0.03);
      }
      return muted;
    },
  };
}
