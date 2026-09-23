export const FIRST_TOUCH = "You touched grass. Therapy can wait.";

const LINES = [
  "The group chat can wait.",
  "Vitamin D, but make it a hobby.",
  "Your screen time just flinched.",
  "A blade of grass has been notified.",
  "This counts. Probably.",
  "Nature received your tapback.",
  "Outside is undefeated.",
  "You are, technically, outdoors.",
  "The lawn says hi back.",
  "Touch grass speedrun, any percent.",
  "Soft, green, and in no particular hurry.",
  "Serotonin has entered the chat.",
  "The field logged your visit.",
  "Fresh air, delivered digitally. Ironic.",
];

let lastLine = "";

export function pickQuip(): string {
  const start = Math.floor(Math.random() * LINES.length);
  for (let offset = 0; offset < LINES.length; offset += 1) {
    const line = LINES[(start + offset) % LINES.length] ?? LINES[0];
    if (line !== lastLine) {
      lastLine = line;
      return line;
    }
  }
  return LINES[0] ?? FIRST_TOUCH;
}

export function milestoneQuip(before: number, after: number): string | null {
  if (before < 60 && after >= 60) return "One minute outside. Heroic.";
  if (before < 180 && after >= 180) return "Three minutes. The grass has accepted you.";
  if (before < 600 && after >= 600) return "Ten minutes. You live here now.";
  return null;
}
