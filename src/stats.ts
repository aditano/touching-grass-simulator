import { FIRST_TOUCH, milestoneQuip, pickQuip } from "./copy";

export type Mood = "idle" | "stirring" | "decent" | "glowing" | "lush" | "feral";

export type StatsView = {
  touches: number;
  streak: number;
  best: number;
  mood: Mood;
  serotonin: number;
  outside: string;
};

const BEST_KEY = "touching-grass-best";
const STREAK_WINDOW_MS = 2400;

export function moodFor(value: number): Mood {
  if (value >= 90) return "feral";
  if (value >= 74) return "lush";
  if (value >= 54) return "glowing";
  if (value >= 32) return "decent";
  if (value >= 12) return "stirring";
  return "idle";
}

export function formatOutside(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

function readNum(key: string): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeNum(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.floor(value)));
  } catch {
    // Private mode can refuse storage. The lawn does not mind.
  }
}

export class Session {
  touches = 0;
  streak = 0;
  best = readNum(BEST_KEY);
  serotonin = 6;
  outsideSeconds = 0;

  private lastTouch = 0;
  private lastQuipAt = -10;
  private readonly onQuip: (text: string) => void;

  constructor(onQuip: (text: string) => void) {
    this.onQuip = onQuip;
  }

  tick(dt: number, visible: boolean): void {
    const before = this.outsideSeconds;
    if (visible) this.outsideSeconds += dt;
    this.serotonin = 4 + (this.serotonin - 4) * Math.exp(-dt * 0.045);
    const line = milestoneQuip(before, this.outsideSeconds);
    if (line) this.say(line, false);
  }

  press(now: number): void {
    this.hit(now, true);
  }

  stroke(now: number): void {
    this.hit(now, false);
  }

  hold(now: number): void {
    if (this.streak > 0) this.lastTouch = now;
  }

  view(): StatsView {
    return {
      touches: this.touches,
      streak: this.streak,
      best: this.best,
      mood: moodFor(this.serotonin),
      serotonin: this.serotonin,
      outside: formatOutside(this.outsideSeconds),
    };
  }

  private hit(now: number, fromPress: boolean): void {
    const first = this.touches === 0;
    if (now - this.lastTouch > STREAK_WINDOW_MS) this.streak = 0;
    this.streak += 1;
    this.touches += 1;
    this.lastTouch = now;
    this.serotonin = Math.min(100, this.serotonin + 7.4 * (1 - this.serotonin / 148));

    let line: string | null = null;
    if (first) line = FIRST_TOUCH;
    if (this.streak > this.best) {
      this.best = this.streak;
      writeNum(BEST_KEY, this.best);
      if (!line && (this.streak === 8 || this.streak % 20 === 0)) {
        line = "New personal best. The lawn is proud.";
      }
    }
    if (!line && fromPress && this.touches % 4 === 0) line = pickQuip();
    if (line) this.say(line, first);
  }

  private say(text: string, force: boolean): void {
    if (!force && this.outsideSeconds - this.lastQuipAt < 1.5) return;
    this.lastQuipAt = this.outsideSeconds;
    this.onQuip(text);
  }
}
