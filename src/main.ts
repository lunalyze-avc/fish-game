// Reel Goobers: game loop, input, fish AI, random events, trophies and screens.
import { SPECIES, paintFish, loadAtlas, type Species } from "./sprites";
import { sfx, startMusic, stopMusic, unlockAudio } from "./audio";
import { TROPHIES, drawRoom } from "./trophies";

const W = 320;
const H = 180;
const POND = { x0: 8, x1: 312, y0: 36, y1: 168 };
const ROD = { x: 34, y: 164 }; // the player stands at the bottom left
const SAVE_KEY = "reelgoobers.v1";
// The 320x180 game is drawn at 6x into a 1920x1080 canvas, so pixels stay chunky and text stays legible.
const SCALE = 6;
const FONT = '"Press Start 2P", monospace';

type MapId = "kiddie" | "sewer" | "swamp";
type Scene = "title" | "play" | "over" | "room";
type BobState = "idle" | "charging" | "fly" | "wait" | "bite" | "fight";
type Mode = "endless" | "tourney";

interface MapDef {
  label: string;
  top: string;
  bottom: string;
  bank: string;
  keys: string[];
  tempo: number;
  notes: number[];
  bass: number[];
}

const MAPS: Record<MapId, MapDef> = {
  kiddie: { label: "KIDDIE POOL", top: "#5ff0ff", bottom: "#1cb3ee", bank: "#fbfaf4", keys: ["bubbles", "splashington", "doug", "nugget"], tempo: 150, notes: [523, 659, 784, 659, 698, 784, 880, 784], bass: [131, 131, 147, 147] },
  sewer: { label: "SEWER", top: "#6fa35a", bottom: "#24402e", bank: "#5b5f58", keys: ["flops", "gary", "steve", "dee"], tempo: 112, notes: [392, 466, 523, 466, 392, 349, 392, 466], bass: [98, 98, 116, 116] },
  swamp: { label: "SWAMP", top: "#8c8a3e", bottom: "#33361a", bank: "#4a3c24", keys: ["marv", "gloopy", "bogfin", "tina", "zorp", "glarb"], tempo: 92, notes: [440, 523, 587, 523, 440, 392, 440, 494], bass: [110, 110, 147, 131] },
};
const MAP_ORDER: MapId[] = ["kiddie", "sewer", "swamp"];

const EVENTS: Record<string, { label: string; dur: number }> = {
  jam: { label: "FISH TRAFFIC JAM!", dur: 9 },
  reverse: { label: "REVERSE!", dur: 8 },
  frenzy: { label: "FISH FRENZY!", dur: 8 },
  imposter: { label: "THE IMPOSTER!", dur: 9 },
  big: { label: "THE BIG ONE!", dur: 10 },
  rebellion: { label: "FISH REBELLION!", dur: 8 },
  boots: { label: "OOPS, ALL BOOTS!", dur: 9 },
  disco: { label: "DISCO POND!", dur: 10 },
};
const EVENT_KEYS = Object.keys(EVENTS);

interface Save {
  trophies: string[];
  catches: number;
  maps: string[];
  best: number;
}
const DEFAULT_SAVE: Save = { trophies: [], catches: 0, maps: [], best: 0 };

function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt: play without saving.
  }
  return { ...DEFAULT_SAVE, trophies: [], maps: [] };
}
function persist(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Ignore: progress just won't persist.
  }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
ctx.imageSmoothingEnabled = false;

let save: Save = loadSave();
let scene: Scene = "title";
let mode: Mode = "endless";
let mapId: MapId = "kiddie";
let clock = 0;
let timeLeft = 180;
let score = 0;
let flow = 1;
let quip = { text: "", t: 0 };
let banner = { text: "", t: 0 };
let toast = { text: "", t: 0 };
let floaters: { text: string; x: number; y: number; t: number }[] = [];
interface Particle { x: number; y: number; vx: number; vy: number; t: number; c: string; }
let particles: Particle[] = [];
let shakeT = 0;
let shakeX = 0;
let shakeY = 0;
const ZONE = 0.22; // width of the green zone on the reel bar
let deco: { x: number; y: number; r: number }[] = [];
let mx = W / 2;
let my = H / 2;
let held = false;
let ev: { kind: string; t: number; dur: number } = { kind: "none", t: 0, dur: 0 };
let nextEvent = 20;

interface Fish {
  key: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  wander: number;
  mouthT: number;
  mouthOpen: boolean;
  hooked: boolean;
  dead: boolean;
  big: boolean;
  phase: number;
  bubble: string;
  bubbleT: number;
}
let fishes: Fish[] = [];

const bob = {
  state: "idle" as BobState,
  charge: 0,
  tx: ROD.x,
  ty: ROD.y,
  x: ROD.x,
  y: ROD.y,
  sx: ROD.x,
  sy: ROD.y,
  flyT: 0,
  t: 0,
  biteT: 0,
  miss: 0,
  streak: 0,
  fish: null as Fish | null,
  tension: 0,
  strain: 0,
  marker: 0.5,
  markerV: 0,
  zoneC: 0.5,
  zoneRetarget: 0,
  progress: 0,
  inZone: false,
  perfect: false,
  start: { x: 0, y: 0 },
  beatT: 0,
  hitThisBeat: false,
};

function spawn(key: string): Fish {
  const f: Fish = {
    key,
    x: rnd(POND.x0 + 20, POND.x1 - 20),
    y: rnd(POND.y0 + 12, POND.y1 - 12),
    vx: 0,
    vy: 0,
    tx: 0,
    ty: 0,
    wander: 0,
    mouthT: rnd(0, 2),
    mouthOpen: false,
    hooked: false,
    dead: false,
    big: key === "gerald",
    phase: Math.random() * 6.28,
    bubble: "",
    bubbleT: 0,
  };
  pickTarget(f);
  return f;
}

function pickTarget(f: Fish): void {
  if (ev.kind === "jam") {
    f.tx = rnd(POND.x0 + 10, POND.x0 + 70);
    f.ty = rnd(POND.y0 + 20, POND.y1 - 15);
  } else {
    f.tx = rnd(POND.x0 + 10, POND.x1 - 10);
    f.ty = rnd(POND.y0 + 15, POND.y1 - 12);
  }
  f.wander = rnd(2, 5);
}

function updateFish(f: Fish, dt: number): void {
  if (f.dead) return;
  if (f.bubbleT > 0) f.bubbleT -= dt;
  if (f.hooked) return; // the fight moves hooked fish
  f.wander -= dt;
  if (f.wander <= 0) pickTarget(f);
  const dx = f.tx - f.x;
  const dy = f.ty - f.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = (f.big ? 7 : 14) * (ev.kind === "jam" ? 1.8 : 1) * (ev.kind === "frenzy" ? 1.3 : 1);
  f.vx += ((dx / d) * speed - f.vx) * Math.min(1, dt * 2);
  f.vy += ((dy / d) * speed * 0.5 - f.vy) * Math.min(1, dt * 2);
  if (d < 5) pickTarget(f);
  f.x = clamp(f.x + f.vx * flow * dt, POND.x0 + 6, POND.x1 - 6);
  f.y = clamp(f.y + f.vy * dt, POND.y0 + 8, POND.y1 - 6);
  f.mouthT -= dt * (ev.kind === "frenzy" ? 3 : 1);
  if (f.mouthT <= 0) {
    f.mouthOpen = !f.mouthOpen;
    f.mouthT = f.mouthOpen ? rnd(0.5, 0.9) : rnd(1.5, 3);
  }
  if (ev.kind === "rebellion" && ev.t < 3) f.mouthOpen = false;
}

// ---------- Trophies ----------
function unlock(id: string): void {
  if (save.trophies.includes(id)) return;
  save.trophies.push(id);
  persist();
  const t = TROPHIES.find((x) => x.id === id);
  if (t) toast = { text: `TROPHY: ${t.name}`, t: 3 };
  sfx("trophy");
}

// ---------- Events ----------
function startEvent(kind: string): void {
  ev = { kind, t: 0, dur: EVENTS[kind].dur };
  banner = { text: EVENTS[kind].label, t: 2.5 };
  sfx("event");
  if (kind === "imposter") fishes.push(spawn("duck"));
  if (kind === "big") fishes.push(spawn("gerald"));
  if (kind === "jam") fishes.forEach(pickTarget);
  if (kind === "disco") startMusic(MAPS[mapId].notes, MAPS[mapId].bass, MAPS[mapId].tempo * 2);
}

function endEvent(): void {
  if (ev.kind === "imposter" || ev.kind === "big") {
    fishes.forEach((f) => {
      if (f.key === "duck" || f.key === "gerald") f.dead = true;
    });
  }
  if (ev.kind === "disco") startMusic(MAPS[mapId].notes, MAPS[mapId].bass, MAPS[mapId].tempo);
  ev = { kind: "none", t: 0, dur: 0 };
  nextEvent = rnd(30, 60);
}

// ---------- Bobber and fishing ----------
function resetBob(): void {
  if (bob.fish) bob.fish.hooked = false;
  bob.fish = null;
  bob.state = "idle";
  bob.charge = 0;
  bob.x = ROD.x;
  bob.y = ROD.y;
  bob.tx = ROD.x;
  bob.ty = ROD.y;
  bob.tension = 0;
  bob.strain = 0;
  bob.progress = 0;
  bob.marker = 0.5;
  bob.markerV = 0;
  bob.inZone = false;
}

function cast(): void {
  // The bobber goes exactly where you clicked, anywhere on the pond
  bob.sx = bob.x;
  bob.sy = bob.y;
  bob.tx = clamp(mx, POND.x0 + 6, POND.x1 - 6);
  bob.ty = clamp(my, POND.y0 + 6, POND.y1 - 6);
  bob.flyT = 0;
  bob.state = "fly";
  sfx("cast");
}
function bite(f: Fish): void {
  bob.state = "bite";
  bob.biteT = 1.0;
  bob.fish = f;
  f.hooked = true;
  sfx("bite");
}

function hookFish(): void {
  const f = bob.fish;
  if (!f) return;
  // The ring shrinks while the fish bites; clicking it thin is a PERFECT strike
  const radius = 3 + 11 * (bob.biteT / 1.0);
  bob.perfect = radius < 4.5;
  bob.state = "fight";
  bob.progress = bob.perfect ? 0.1 : 0.04;
  bob.strain = 0;
  bob.beatT = 0;
  bob.hitThisBeat = false;
  bob.start = { x: f.x, y: f.y };
  f.hooked = true;
  f.bubble = bob.perfect ? "PERFECT!" : "Hey!";
  f.bubbleT = 1.2;
  burst(bob.x, bob.y, "#ffd23f", 14);
  shakeT = 0.18;
  sfx(bob.perfect ? "event" : "hook");
  if (bob.perfect) floaters.push({ text: "PERFECT!", x: bob.x, y: bob.y - 22, t: 1 });
}

function catchFish(f: Fish): void {
  const isBoot = ev.kind === "boots" && f.key !== "duck" && f.key !== "gerald";
  const key = isBoot ? "boot" : f.key;
  const pts = SPECIES[key].value;
  score += pts;
  f.dead = true;
  bob.streak++;
  bob.miss = 0;
  save.catches++;
  if (!save.maps.includes(mapId)) save.maps.push(mapId);
  quip = { text: pick(SPECIES[f.key].quips), t: 2 };
  burst(f.x, f.y, SPECIES[key].body, 26);
  shakeT = f.big ? 0.5 : 0.22;
  if (bob.perfect) {
    score += 2;
    floaters.push({ text: "PERFECT +2", x: f.x, y: f.y - 24, t: 1.4 });
  }
  floaters.push({ text: `+${pts}`, x: f.x, y: f.y - 14, t: 1.2 });
  sfx(f.key === "duck" ? "squeak" : "catch");
  if (f.key === "duck") unlock("catch_me_if_you_can");
  if (isBoot) unlock("hook_line_stinker");
  if (f.big) unlock("cod_almighty");
  if (ev.kind === "disco") unlock("reely_ridiculous");
  if (ev.kind === "reverse") unlock("reverse_psychology");
  if (bob.streak >= 3) unlock("fish_and_giggles");
  if (save.catches >= 25) unlock("what_a_catch");
  if (save.maps.length >= 3) unlock("oh_my_cod");
  persist();
  resetBob();
  if (!f.big && f.key !== "duck") fishes.push(spawn(pick(MAPS[mapId].keys)));
}

// Pump mini game: a ring shrinks toward the bobber once per beat.
// Click when it lines up with the bobber to pull the fish in; click early or late and it dashes away.
const PUMP_AT = 0.85;   // where the ring lines up with the bobber, as a fraction of the beat
const PUMP_WIN = 0.12;  // how close to PUMP_AT counts as a hit

function fightStep(dt: number): void {
  const f = bob.fish;
  if (!f) {
    resetBob();
    return;
  }
  const sp = SPECIES[f.key];
  const beat = 0.9 + 0.1 * sp.strength; // stronger fish make a slower beat
  bob.beatT += dt / beat;
  if (bob.beatT >= 1) {
    bob.beatT -= 1;
    if (!bob.hitThisBeat) missPump(f);
    bob.hitThisBeat = false;
  }
  // Keep the fish drifting between pumps
  f.x = clamp(lerp(bob.start.x, bob.x, bob.progress) + Math.sin(clock * 3 + f.phase) * 2, POND.x0, POND.x1);
  f.y = clamp(lerp(bob.start.y, bob.y, bob.progress) + Math.cos(clock * 2 + f.phase) * 1.5, POND.y0, POND.y1);
  bob.progress = clamp(bob.progress, 0, 1);
  if (bob.progress >= 1) catchFish(f);
}

function pump(): void {
  const f = bob.fish;
  if (!f || bob.state !== "fight" || bob.hitThisBeat) return;
  bob.hitThisBeat = true;
  const off = Math.abs(bob.beatT - PUMP_AT);
  if (off <= PUMP_WIN) {
    const sp = SPECIES[f.key];
    const perfect = off < 0.035;
    bob.progress += (perfect ? 0.26 : 0.2) / (0.6 + 0.4 * sp.strength);
    bob.strain = Math.max(0, bob.strain - 0.2);
    f.bubble = perfect ? "PERFECT!" : pick(["Ugh!", "Hey!", "Hup!"]);
    f.bubbleT = 0.8;
    if (perfect) floaters.push({ text: "PERFECT", x: bob.x, y: bob.y - 20, t: 0.8 });
    burst(bob.x, bob.y, perfect ? "#ffd23f" : "#7fe0ff", 8);
    sfx(perfect ? "event" : "click");
  } else {
    missPump(f);
  }
}

function missPump(f: Fish): void {
  bob.strain += 0.34;
  f.x = clamp(f.x + (Math.random() < 0.5 ? -1 : 1) * 8, POND.x0, POND.x1);
  f.bubble = pick(["Nope!", "Nah!", "Whoa!"]);
  f.bubbleT = 0.9;
  sfx("miss");
  shakeT = 0.12;
  if (bob.strain >= 1) {
    f.hooked = false;
    f.bubble = "Ha! Bye!";
    f.bubbleT = 1.6;
    sfx("escape");
    unlock("reel_trouble");
    bob.streak = 0;
    resetBob();
  }
}

function updateBob(dt: number): void {
  if (bob.fish && bob.fish.dead) resetBob();
  switch (bob.state) {
    case "charging":
      bob.charge = Math.min(1, bob.charge + dt / 1.2);
      if (!held) cast();
      break;
    case "fly": {
      bob.flyT += dt;
      const t = Math.min(1, bob.flyT / 0.4);
      bob.x = lerp(bob.sx, bob.tx, t);
      bob.y = lerp(bob.sy, bob.ty, t) - Math.sin(t * Math.PI) * 28;
      if (t >= 1) {
        bob.state = "wait";
        bob.t = 0;
        bob.x = bob.tx;
        bob.y = bob.ty;
        sfx("splash");
        burst(bob.x, bob.y, "#ffffff", 8);
      }
      break;
    }
    case "wait":
      bob.t += dt;
      if (ev.kind === "reverse") bob.tx = clamp(bob.tx - 6 * dt, POND.x0 + 6, POND.x1 - 6);
      bob.x = bob.tx;
      bob.y = bob.ty + Math.sin(bob.t * 3) * 0.8;
      for (const f of fishes) {
        if (f.dead || f.hooked || !f.mouthOpen) continue;
        if (Math.hypot(f.x - bob.x, (f.y - bob.y) * 1.6) < 14 && Math.random() < 1.3 * dt) {
          bite(f);
          break;
        }
      }
      break;
    case "bite": {
      bob.biteT -= dt;
      bob.y = bob.ty + Math.sin(clock * 18) * 1.2;
      if (bob.biteT <= 0) {
        const f = bob.fish;
        if (f) {
          f.bubble = "Nope!";
          f.bubbleT = 1.2;
        }
        bob.miss++;
        bob.streak = 0;
        sfx("miss");
        if (bob.miss >= 3) {
          unlock("fish_outta_luck");
          bob.miss = 0;
        }
        resetBob();
      }
      break;
    }
    case "fight":
      fightStep(dt);
      break;
    default:
      break;
  }
}

// ---------- Scenes and buttons ----------
interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  action: () => void;
}
let buttons: Btn[] = [];

function btn(label: string, y: number, action: () => void, w = 150): Btn {
  return { x: (W - w) / 2, y, w, h: 15, label, action };
}

function cycleMap(): void {
  mapId = MAP_ORDER[(MAP_ORDER.indexOf(mapId) + 1) % MAP_ORDER.length];
  layoutButtons();
}

function layoutButtons(): void {
  if (scene === "title") {
    buttons = [
      btn("ENDLESS", 84, () => startPlay("endless")),
      btn("TOURNAMENT 3:00", 104, () => startPlay("tourney")),
      btn(`MAP: ${MAPS[mapId].label}`, 124, cycleMap),
      btn("TROPHY ROOM", 144, () => setScene("room")),
    ];
  } else if (scene === "over") {
    buttons = [
      btn("PLAY AGAIN", 120, () => startPlay("tourney")),
      btn("MENU", 140, () => setScene("title")),
    ];
  } else if (scene === "room") {
    buttons = [{ x: W - 84, y: 4, w: 80, h: 13, label: "BACK", action: () => setScene("title") }];
  } else {
    buttons = [];
  }
}

function setScene(s: Scene): void {
  scene = s;
  if (s === "title") startMusic(MAPS.kiddie.notes, MAPS.kiddie.bass, 96);
  else if (s !== "play") stopMusic();
  layoutButtons();
}

function makeDeco(): void {
  deco = [];
  for (let i = 0; i < 10; i++) {
    deco.push({ x: rnd(POND.x0 + 10, POND.x1 - 10), y: rnd(POND.y0 + 10, POND.y1 - 10), r: rnd(3, 6) });
  }
}

function startPlay(m: Mode): void {
  mode = m;
  score = 0;
  timeLeft = 180;
  ev = { kind: "none", t: 0, dur: 0 };
  nextEvent = rnd(15, 25);
  flow = 1;
  resetBob();
  floaters = [];
  quip = { text: "", t: 0 };
  fishes = [];
  for (let i = 0; i < 6; i++) fishes.push(spawn(pick(MAPS[mapId].keys)));
  makeDeco();
  scene = "play";
  layoutButtons();
  startMusic(MAPS[mapId].notes, MAPS[mapId].bass, MAPS[mapId].tempo);
}

function endTourney(): void {
  save.best = Math.max(save.best, score);
  if (score >= 40) unlock("reel_champ");
  persist();
  resetBob();
  fishes = fishes.filter((f) => !f.dead);
  setScene("over");
}

// ---------- Input ----------
function setPointer(e: PointerEvent): void {
  const r = canvas.getBoundingClientRect();
  mx = ((e.clientX - r.left) / r.width) * W;
  my = ((e.clientY - r.top) / r.height) * H;
}

canvas.addEventListener("pointermove", setPointer);
canvas.addEventListener("pointerdown", (e) => {
  setPointer(e);
  unlockAudio();
  held = true;
  if (scene !== "play") {
    for (const b of buttons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        sfx("click");
        b.action();
        return;
      }
    }
    return;
  }
  if (bob.state === "idle") {
    bob.state = "charging";
    bob.charge = 0;
  } else if (bob.state === "bite") {
    hookFish();
  } else if (bob.state === "fight") {
    pump();
  }
});
window.addEventListener("pointerup", () => {
  held = false;
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && scene === "play") {
    if (mode === "tourney") endTourney();
    else setScene("title");
  }
});

// ---------- Update ----------
function update(dt: number): void {
  clock += dt;
  if (banner.t > 0) banner.t -= dt;
  if (toast.t > 0) toast.t -= dt;
  if (quip.t > 0) quip.t -= dt;
  for (const f of floaters) {
    f.t -= dt;
    f.y -= 12 * dt;
  }
  floaters = floaters.filter((f) => f.t > 0);
  updateParticles(dt);
  if (scene !== "play") return;

  if (mode === "tourney") {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      endTourney();
      return;
    }
  }

  if (ev.kind === "none") {
    nextEvent -= dt;
    if (nextEvent <= 0) startEvent(pick(EVENT_KEYS));
  } else {
    ev.t += dt;
    if (ev.t >= ev.dur) endEvent();
  }
  flow = ev.kind === "reverse" ? -1 : 1;

  for (const f of fishes) updateFish(f, dt);
  updateBob(dt);
  fishes = fishes.filter((f) => !f.dead);
}

// ---------- Drawing ----------
function txt(s: string, x: number, y: number, color = "#fff", size = 8, align: CanvasTextAlign = "left"): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function speech(x: number, y: number, s: string): void {
  ctx.font = `8px ${FONT}`;
  const w = Math.ceil(ctx.measureText(s).width) + 6;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - 10);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx, by, w, 11);
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, bx + w / 2, by + 5.5);
}

function drawBank(m: MapDef): void {
  // Banks: each map has its own ground around the pond
  ctx.fillStyle = m.bank;
  ctx.fillRect(0, 0, W, POND.y0);
  ctx.fillRect(0, POND.y1, W, H - POND.y1);
  const id = mapKey(m);
  if (id === "kiddie") {
    // Pool deck: white tiles with light-blue grout
    ctx.fillStyle = "#9fdcf2";
    for (let x = 0; x < W; x += 12) ctx.fillRect(x, 0, 1, POND.y0);
    for (let y = 0; y < POND.y0; y += 12) ctx.fillRect(0, y, W, 1);
    for (let x = 0; x < W; x += 12) ctx.fillRect(x, POND.y1, 1, H - POND.y1);
    for (let y = POND.y1; y < H; y += 12) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = "#ffffff";
    for (let x = 0; x < W; x += 12) for (let y = 2; y < POND.y0; y += 12) ctx.fillRect(x + 2, y, 8, 8);
  } else if (id === "sewer") {
    // Concrete slabs with grime seams
    ctx.fillStyle = "#4a4e48";
    for (let x = 0; x < W; x += 32) ctx.fillRect(x, 0, 1, POND.y0);
    for (let y = 0; y < POND.y0; y += 12) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = "rgba(90,140,70,0.35)";
    for (let i = 0; i < 12; i++) ctx.fillRect((i * 71) % W, (i * 23) % POND.y0, 14, 3);
  } else {
    // Mud with clumps of grass
    ctx.fillStyle = "#3a2e1a";
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 89) % W, (i * 13) % POND.y0, 3, 2);
    ctx.fillStyle = "#4f7a2e";
    for (let i = 0; i < 14; i++) ctx.fillRect((i * 97 + 20) % W, POND.y1 + 4 + ((i * 7) % 8), 4, 3);
  }
}

function mapKey(m: MapDef): MapId {
  return (Object.keys(MAPS) as MapId[]).find((k) => MAPS[k] === m) ?? "kiddie";
}

// Scenery drawn on the water, under the fish
function drawScenery(m: MapId): void {
  const t = clock;
  if (m === "kiddie") {
    // Tiled rim all the way round, so the water reads as an enclosed pool
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(POND.x0 - 4, POND.y0 - 4, POND.x1 - POND.x0 + 8, 4);
    ctx.fillRect(POND.x0 - 4, POND.y1, POND.x1 - POND.x0 + 8, 4);
    ctx.fillRect(POND.x0 - 4, POND.y0, 4, POND.y1 - POND.y0);
    ctx.fillRect(POND.x1, POND.y0, 4, POND.y1 - POND.y0);
    for (let x = POND.x0 - 4; x < POND.x1 + 4; x += 6) {
      ctx.fillStyle = (x / 6) % 2 === 0 ? "#2aa8e0" : "#9fe6ff";
      ctx.fillRect(x, POND.y0 - 4, 3, 2);
      ctx.fillRect(x, POND.y1 + 2, 3, 2);
    }
    // Lane ropes of floating buoys, the classic pool look
    for (const ly of [84, 124]) {
      for (let x = POND.x0 + 4; x < POND.x1 - 4; x += 8) {
        ctx.fillStyle = (x / 8) % 2 === 0 ? "#ff4d4d" : "#ffffff";
        ctx.fillRect(x, ly, 5, 3);
      }
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(POND.x0 + 4, ly + 1, POND.x1 - POND.x0 - 8, 1);
    }
    // Rubber ring float with a highlight
    ctx.fillStyle = "#ff5c8a";
    ctx.beginPath(); ctx.ellipse(60, 66, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7fe3ff";
    ctx.beginPath(); ctx.ellipse(60, 66, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd0e0";
    ctx.fillRect(52, 61, 3, 1);
    // Toy boat
    const bx = 250 + Math.sin(t * 0.7) * 2;
    ctx.fillStyle = "#e33b3b";
    ctx.beginPath(); ctx.moveTo(bx - 12, 58); ctx.lineTo(bx + 12, 58); ctx.lineTo(bx + 9, 66); ctx.lineTo(bx - 9, 66); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(bx - 12), 56, 24, 2);
    ctx.fillStyle = "#c08a4a";
    ctx.fillRect(Math.round(bx) - 1, 42, 2, 14);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(Math.round(bx) + 1, 43, 6, 4);
    // Beach ball
    ctx.fillStyle = "#ff5c8a"; ctx.beginPath(); ctx.arc(120, 150, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd23f"; ctx.fillRect(114, 148, 4, 2);
    ctx.fillStyle = "#7fe3ff"; ctx.fillRect(122, 145, 3, 2);
    // Pool ladder on the right edge
    ctx.fillStyle = "#dfe8ee";
    ctx.fillRect(304, 84, 2, 26); ctx.fillRect(312, 84, 2, 26);
    for (let y = 88; y < 110; y += 5) ctx.fillRect(304, y, 10, 1);
    // Bubbles rising from the sandcastle
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 3; i++) ctx.fillRect(280 + i * 3, 150 - ((t * 12 + i * 9) % 20), 1, 1);
    // Sandcastle
    ctx.fillStyle = "#f6d07a";
    ctx.fillRect(264, 150, 26, 12);
    ctx.fillRect(268, 143, 18, 7);
    ctx.fillRect(272, 139, 10, 4);
    ctx.fillStyle = "#b8862c";
    ctx.fillRect(264, 161, 26, 1);
    ctx.fillStyle = "#ff5c8a"; ctx.fillRect(276, 134, 1, 5); ctx.fillRect(277, 134, 3, 2);
  } else if (m === "sewer") {
    // Grates sunk in the water
    ctx.fillStyle = "#1a1f1a";
    ctx.fillRect(22, 140, 30, 22);
    ctx.fillRect(250, 116, 36, 24);
    ctx.fillStyle = "#4a5a4a";
    for (let x = 24; x < 52; x += 4) ctx.fillRect(x, 141, 1, 20);
    for (let y = 142; y < 162; y += 4) ctx.fillRect(23, y, 28, 1);
    for (let x = 252; x < 286; x += 4) ctx.fillRect(x, 117, 1, 22);
    for (let y = 118; y < 140; y += 4) ctx.fillRect(251, y, 34, 1);
    // Pipe outlets in the bank, dripping slime
    for (const px of [72, 210]) {
      ctx.fillStyle = "#2b2f2b";
      ctx.fillRect(px, 0, 22, 18);
      ctx.fillStyle = "#555b55";
      ctx.fillRect(px - 2, 14, 26, 4);
      ctx.fillStyle = "#6fdc4a";
      ctx.fillRect(px + 9, 18 + ((t * 10) % 8), 3, 3);
    }
    // Slime pools
    for (const [x, y, r] of [[120, 74, 9], [190, 150, 7]] as const) {
      ctx.fillStyle = "rgba(111,220,74,0.55)";
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(200,255,160,0.6)";
      ctx.fillRect(x - r * 0.4, y - 1, 3, 1);
    }
    // Trash drifting slowly
    const drift = (k: number, base: number) => ((base + t * (5 + k)) % (POND.x1 - POND.x0)) + POND.x0;
    ctx.fillStyle = "#3a7a3a"; ctx.fillRect(Math.round(drift(1, 40)), 96, 3, 6);   // bottle
    ctx.fillStyle = "#c8c8d0"; ctx.fillRect(Math.round(drift(2, 180)), 60, 4, 3);  // can
    ctx.fillStyle = "#e0d060"; ctx.fillRect(Math.round(drift(3, 260)), 130, 3, 2); // wrapper
  } else {
    // Lily pads with notches and flowers
    const pads: [number, number, number][] = [[46, 58, 9], [96, 120, 8], [150, 72, 7], [206, 124, 10], [270, 66, 8], [236, 150, 6]];
    for (const [x, y, r] of pads) {
      ctx.fillStyle = "#3f8a3a";
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0.2, Math.PI * 2 - 0.2); ctx.fill();
      ctx.fillStyle = "#5fae4f";
      ctx.beginPath(); ctx.ellipse(x - 1, y - 1, r * 0.5, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ff9ad0";
    ctx.fillRect(150, 70, 2, 2);
    ctx.fillRect(268, 64, 2, 2);
    // Fallen log across the pond
    ctx.fillStyle = "#5a3a1e";
    ctx.beginPath(); ctx.ellipse(200, 100, 36, 4, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7a5230";
    ctx.beginPath(); ctx.ellipse(200, 99, 34, 2.5, -0.12, 0, Math.PI * 2); ctx.fill();
    // Reeds on the left and right edges
    for (let i = 0; i < 9; i++) {
      const rx = i < 5 ? POND.x0 + 2 + i * 3 : POND.x1 - 2 - (i - 5) * 3;
      const top = POND.y0 + 10 + ((i * 17) % 40);
      ctx.fillStyle = "#4d7a2a";
      ctx.fillRect(rx, top, 1, POND.y1 - top);
      ctx.fillStyle = "#6b4a22";
      ctx.fillRect(rx - 1, top - 3, 3, 4);
    }
    // Mud bubbles
    ctx.fillStyle = "rgba(220,230,180,0.5)";
    for (let i = 0; i < 4; i++) ctx.fillRect(60 + i * 70, POND.y1 - 6 - ((t * 9 + i * 13) % 30), 2, 2);
  }
}

function drawWater(m: MapId): void {
  const d = MAPS[m];
  const disco = ev.kind === "disco";
  const hue = disco ? (clock * 60) % 360 : 0;
  const g = ctx.createLinearGradient(0, POND.y0, 0, POND.y1);
  g.addColorStop(0, disco ? `hsl(${hue},70%,60%)` : d.top);
  g.addColorStop(1, disco ? `hsl(${(hue + 160) % 360},70%,25%)` : d.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(POND.x0, POND.y0, POND.x1 - POND.x0, POND.y1 - POND.y0);

  // Ripples drifting across the surface
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 14; i++) {
    const span = POND.x1 - POND.x0;
    const x = POND.x0 + ((i * 53 + clock * (8 + (i % 3) * 4)) % span);
    const y = POND.y0 + 6 + ((i * 37) % (POND.y1 - POND.y0 - 12));
    ctx.fillRect(Math.round(x), Math.round(y), 6, 1);
  }

  drawScenery(m);

  if (disco) {
    ctx.fillStyle = `hsla(${hue},100%,70%,0.14)`;
    ctx.fillRect(POND.x0, POND.y0, POND.x1 - POND.x0, POND.y1 - POND.y0);
  }
  if (m === "swamp") {
    ctx.fillStyle = `rgba(200,210,160,${0.12 + 0.05 * Math.sin(clock)})`;
    ctx.fillRect(POND.x0, POND.y0, POND.x1 - POND.x0, POND.y1 - POND.y0);
  }
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(POND.x0, POND.y0, POND.x1 - POND.x0, 4);
}

function drawButtons(): void {
  buttons.forEach((b) => {
    const hover = mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
    ctx.fillStyle = "#2b1b0e";
    ctx.fillRect(b.x + 1, b.y + 1, b.w, b.h);
    ctx.fillStyle = hover ? "#fff3b0" : "#ffd23f";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    txt(b.label, b.x + b.w / 2, b.y + b.h / 2, "#2b1b0e", 8, "center");
  });
}

function burst(x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    particles.push({ x, y, vx: rnd(-40, 40), vy: rnd(-70, 10), t: rnd(0.4, 0.9), c: i % 2 ? color : "#ffffff" });
  }
}

function updateParticles(dt: number): void {
  for (const p of particles) {
    p.t -= dt;
    p.vy += 120 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  particles = particles.filter((p) => p.t > 0);
  if (shakeT > 0) {
    shakeT -= dt;
    shakeX = rnd(-1.5, 1.5) * Math.max(0, shakeT);
    shakeY = rnd(-1.5, 1.5) * Math.max(0, shakeT);
  } else {
    shakeX = 0;
    shakeY = 0;
  }
}

function drawParticles(): void {
  for (const p of particles) {
    ctx.fillStyle = p.c;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
  }
}

// The reel bar: green zone, yellow marker, and a catch meter beside it
// Pump meter: blue fills with each hit, red builds with each miss
function drawReelPanel(): void {
  const top = 40;
  const h = 120;
  const x = 286;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x - 3, top - 3, 30, h + 6);
  ctx.fillStyle = "#000000";
  ctx.fillRect(x, top, 6, h);
  ctx.fillStyle = "#7fe0ff";
  ctx.fillRect(x, top + h - bob.progress * h, 6, bob.progress * h);
  ctx.fillStyle = "#000000";
  ctx.fillRect(x + 12, top, 6, h);
  ctx.fillStyle = "#ff5c5c";
  ctx.fillRect(x + 12, top + h - bob.strain * h, 6, bob.strain * h);
  txt("FISH", x - 2, top - 9, "#ffffff", 8);
}

function drawPlay(): void {
  const m = MAPS[mapId];
  drawBank(m);
  drawWater(mapId);

  // Rod and line
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ROD.x - 16, ROD.y + 12);
  ctx.lineTo(ROD.x, ROD.y);
  ctx.stroke();
  if (bob.state !== "idle" && bob.state !== "charging") {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.moveTo(ROD.x, ROD.y);
    ctx.lineTo(bob.x, bob.y);
    ctx.stroke();
    ctx.fillStyle = "#e33b3b";
    ctx.fillRect(Math.round(bob.x) - 1, Math.round(bob.y) - 1, 3, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.round(bob.x) - 1, Math.round(bob.y) + 1, 3, 2);
  }

  // Fish, back to front, with shadows
  const list = fishes.filter((f) => !f.dead).sort((a, b) => a.y - b.y);
  for (const f of list) {
    const sp = SPECIES[f.key];
    const asBoot = ev.kind === "boots" && f.key !== "duck" && !f.big;
    const facing = f.vx * flow >= 0 ? 1 : -1;
    const bobY = ev.kind === "disco" ? Math.sin(clock * 10 + f.phase) * 1.5 : 0;
    const x = Math.round(f.x);
    const y = Math.round(f.y + bobY);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x - Math.round(sp.w / 2), Math.round(f.y) + Math.round(sp.h / 2) + 1, sp.w, 1);
    paintFish(ctx, sp, x, y, facing, f.mouthOpen || f.hooked, clock + f.phase, asBoot);
    if (f.bubbleT > 0) speech(x, y - sp.h / 2 - 4, f.bubble);
  }

  // Floating points
  for (const p of floaters) txt(p.text, p.x, p.y, "#ffd23f", 8, "center");

  // Pump ring: shrinks onto the bobber, click when it lines up
  if (bob.state === "fight") {
    const r = Math.max(4, 4 + 14 * (1 - bob.beatT / PUMP_AT));
    const inWindow = Math.abs(bob.beatT - PUMP_AT) <= PUMP_WIN;
    ctx.strokeStyle = inWindow ? "#7dff7d" : "#ffffff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Strike ring: shrinks toward the bobber, click when it's thin for a PERFECT
  if (bob.state === "bite") {
    const radius = 3 + 11 * (bob.biteT / 1.0);
    ctx.strokeStyle = radius < 4.5 ? "#ffd23f" : "#ff4d4d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bob.x, bob.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawParticles();

  // Bite prompt
  if (bob.state === "bite" && Math.floor(clock * 6) % 2 === 0) {
    txt("!", bob.x, bob.y - 16, "#ff4d4d", 16, "center");
    txt("CLICK!", bob.x, bob.y - 26, "#ffffff", 8, "center");
  }

  // Charge meter
  if (bob.state === "charging") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(110, 26, 100, 5);
    ctx.fillStyle = bob.charge < 0.9 ? "#7fe0ff" : "#ffd23f";
    ctx.fillRect(111, 27, 98 * bob.charge, 3);
  }

  if (bob.state === "fight") drawReelPanel();

  drawHud();
}

function drawHud(): void {
  txt(`SCORE ${score}`, 6, 18, "#ffffff", 8);
  if (mode === "tourney") {
    const s = Math.max(0, timeLeft);
    const mm = Math.floor(s / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, "0");
    txt(`TIME ${mm}:${ss}`, W / 2, 18, timeLeft < 20 ? "#ff4d4d" : "#ffffff", 8, "center");
  }
  txt(MAPS[mapId].label, W - 6, 18, "#ffffff", 8, "right");

  const hint =
    bob.state === "idle" ? "CLICK + HOLD TO CAST" :
    bob.state === "bite" ? "CLICK THE RING!" :
    bob.state === "fight" ? "CLICK WHEN THE RING HITS THE BOBBER" : "";
  txt(hint, 6, 174, "#ffffff", 8);

  if (banner.t > 0) {
    const flash = Math.floor(clock * 6) % 2 === 0 ? "#ffd23f" : "#ff6b6b";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(40, 60, W - 80, 16);
    txt(banner.text, W / 2, 68, flash, 8, "center");
  }
  if (quip.t > 0) speech(160, 150, quip.text);
  if (toast.t > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(30, 118, W - 60, 14);
    txt(toast.text, W / 2, 125, "#ffd23f", 8, "center");
  }
}

// Title with a colour-cycling fill and a dark outline so it reads on any background
function rainbowTitle(text: string, cx: number, y: number, size: number): void {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  chars.forEach((c, i) => {
    ctx.fillStyle = "#1a0a2e";
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [2, 2]]) ctx.fillText(c, x + dx, y + 2 + dy);
    ctx.fillStyle = `hsl(${(i * 35 + clock * 90) % 360}, 100%, 62%)`;
    ctx.fillText(c, x, y + 2);
    x += widths[i];
  });
}

function drawFrame(): void {
  if (scene === "room") {
    drawRoom(ctx, new Set(save.trophies), clock);
    drawButtons();
    return;
  }
  if (scene === "play") {
    drawPlay();
    return;
  }
  // Title and game-over screens sit over a calm pond backdrop
  drawBank(MAPS.kiddie);
  drawWater("kiddie");
  if (scene === "title") {
    rainbowTitle("REEL GOOBERS", W / 2, 20, 20);
    txt("a pixel fishing game", W / 2, 34, "#ffffff", 8, "center");
    drawButtons();
    txt(`BEST TOURNEY: ${save.best}   TROPHIES: ${save.trophies.length}/${TROPHIES.length}`, W / 2, 168, "#ffffff", 8, "center");
  } else {
    txt("TIME'S UP!", W / 2, 30, "#ffd23f", 16, "center");
    txt(`SCORE ${score}`, W / 2, 62, "#ffffff", 14, "center");
    txt(`BEST ${save.best}`, W / 2, 82, "#ffffff", 8, "center");
    if (score >= save.best && score > 0) txt("NEW BEST!", W / 2, 96, "#5fd35f", 8, "center");
    drawButtons();
  }
}

// ---------- Loop ----------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  ctx.setTransform(SCALE, 0, 0, SCALE, shakeX * SCALE, shakeY * SCALE);
  drawFrame();
  requestAnimationFrame(frame);
}

// Ask the browser to load the pixel fonts; the loop redraws with them as soon as they arrive.
void document.fonts?.load(`8px ${FONT}`);
loadAtlas("assets/pixelfishes.png");
setScene("title");
requestAnimationFrame(frame);
