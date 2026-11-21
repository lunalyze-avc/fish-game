// All sound is synthesized with the Web Audio API. No audio files.

export type SfxName =
  | "cast"
  | "splash"
  | "bite"
  | "hook"
  | "catch"
  | "miss"
  | "escape"
  | "event"
  | "trophy"
  | "squeak"
  | "click";

let ac: AudioContext | null = null;
let musicTimer: number | undefined;
let musicStep = 0;

function context(): AudioContext | null {
  if (!ac) {
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      ac = new Ctor();
    } catch {
      return null;
    }
  }
  if (ac && ac.state === "suspended") void ac.resume();
  return ac;
}

// Call from a user gesture so browsers allow audio to start.
export function unlockAudio(): void {
  context();
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slide = 0): void {
  const a = context();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function sfx(name: SfxName): void {
  switch (name) {
    case "cast":
      tone(320, 0.15, "sine", 0.15, 0, -200);
      break;
    case "splash":
      tone(200, 0.25, "sine", 0.12, 0, -120);
      break;
    case "bite":
      tone(880, 0.08, "square", 0.08);
      break;
    case "hook":
      tone(660, 0.1, "square", 0.1);
      tone(990, 0.1, "square", 0.1, 0.08);
      break;
    case "catch":
      tone(523, 0.1, "triangle", 0.15);
      tone(659, 0.1, "triangle", 0.15, 0.08);
      tone(784, 0.18, "triangle", 0.15, 0.16);
      break;
    case "miss":
      tone(220, 0.2, "triangle", 0.1);
      break;
    case "escape":
      tone(200, 0.4, "sawtooth", 0.08, 0, -150);
      break;
    case "event":
      tone(440, 0.1, "square", 0.08);
      tone(660, 0.15, "square", 0.08, 0.1);
      break;
    case "trophy":
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, "triangle", 0.16, i * 0.12));
      break;
    case "squeak":
      tone(1500, 0.05, "square", 0.12, 0, 1200);
      tone(1800, 0.2, "square", 0.1, 0.05, -1000);
      break;
    case "click":
      tone(600, 0.04, "square", 0.06);
      break;
  }
}

// Simple looping chiptune: a lead arpeggio, a bass line and a hi-hat tick.
export function startMusic(notes: number[], bass: number[], tempo: number): void {
  stopMusic();
  musicStep = 0;
  const stepMs = (60000 / tempo) / 2;
  musicTimer = window.setInterval(() => {
    const i = musicStep++;
    tone(notes[i % notes.length], 0.16, "triangle", 0.035);
    if (i % 2 === 0) tone(bass[Math.floor(i / 2) % bass.length] / 2, 0.3, "sawtooth", 0.02);
    if (i % 2 === 1) tone(4000, 0.02, "square", 0.01);
  }, stepMs);
}

export function stopMusic(): void {
  if (musicTimer !== undefined) {
    window.clearInterval(musicTimer);
    musicTimer = undefined;
  }
}
