import type { StatsView } from "./stats";

export type Hud = {
  setHint: (text: string) => void;
  hideHint: () => void;
  showQuip: (text: string) => void;
  render: (view: StatsView) => void;
  setMuted: (muted: boolean) => void;
  onMute: (handler: () => void) => void;
};

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}

export function bindHud(): Hud {
  const hint = must<HTMLElement>("#hint");
  const quip = must<HTMLElement>("#quip");
  const touches = must<HTMLElement>("#touches");
  const streak = must<HTMLElement>("#streak");
  const best = must<HTMLElement>("#best");
  const mood = must<HTMLElement>("#mood");
  const outside = must<HTMLElement>("#outside");
  const fill = must<HTMLElement>("#sero-fill");
  const mute = must<HTMLButtonElement>("#mute");

  let quipTimer = 0;
  let lastTouches = "";
  let lastStreak = "";
  let lastBest = "";
  let lastMood = "";
  let lastOutside = "";
  let lastSero = -1;

  function pulse(node: HTMLElement): void {
    node.classList.remove("pulse");
    void node.offsetWidth;
    node.classList.add("pulse");
  }

  return {
    setHint(text) {
      hint.textContent = text;
      hint.classList.remove("is-gone");
    },
    hideHint() {
      hint.classList.add("is-gone");
    },
    showQuip(text) {
      quip.textContent = text;
      quip.classList.add("is-on");
      window.clearTimeout(quipTimer);
      quipTimer = window.setTimeout(() => {
        quip.classList.remove("is-on");
      }, 3200);
    },
    render(view) {
      const touchText = String(view.touches);
      if (touchText !== lastTouches) {
        if (lastTouches !== "") pulse(touches);
        touches.textContent = touchText;
        lastTouches = touchText;
      }
      const streakText = String(view.streak);
      if (streakText !== lastStreak) {
        if (lastStreak !== "") pulse(streak);
        streak.textContent = streakText;
        lastStreak = streakText;
      }
      const bestText = view.best > 0 ? `best ${view.best}` : "";
      if (bestText !== lastBest) {
        best.textContent = bestText;
        lastBest = bestText;
      }
      if (view.mood !== lastMood) {
        mood.textContent = view.mood;
        lastMood = view.mood;
      }
      if (view.outside !== lastOutside) {
        outside.textContent = view.outside;
        lastOutside = view.outside;
      }
      const rounded = Math.round(view.serotonin);
      if (rounded !== lastSero) {
        fill.style.width = `${rounded}%`;
        lastSero = rounded;
      }
    },
    setMuted(muted) {
      mute.setAttribute("aria-pressed", muted ? "true" : "false");
      mute.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    },
    onMute(handler) {
      mute.addEventListener("click", handler);
    },
  };
}
