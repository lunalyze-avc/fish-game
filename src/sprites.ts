// Procedural pixel-art fish. Every pixel is painted in code; there are no image assets.

export interface Species {
  name: string;
  body: string;
  belly: string;
  tail: string;
  w: number;
  h: number;
  strength: number; // how hard it pulls when hooked
  value: number; // points for a catch
  hat?: "sun" | "boat" | "monocle" | "cape" | "horns";
  beak?: boolean;
  cell?: [number, number]; // [column, row] on the PixelFishes atlas (32px cells)
  quips: string[];
}

export const SPECIES: Record<string, Species> = {
  bubbles: { name: "Bubbles McGee", cell: [1, 0], body: "#ffb347", belly: "#ffd38a", tail: "#ff8c1a", w: 14, h: 9, strength: 0.6, value: 1, hat: "sun", quips: ["Wheee!", "Ooh, a ride!"] },
  splashington: { name: "Captain Splashington", cell: [8, 1], body: "#7fd1ff", belly: "#d6f2ff", tail: "#3aa0e0", w: 16, h: 12, strength: 0.9, value: 2, hat: "boat", quips: ["Rescue mission!", "Ahoy!"] },
  doug: { name: "Doug", cell: [0, 1], body: "#c8b89a", belly: "#e5dcc8", tail: "#a89878", w: 16, h: 10, strength: 0.7, value: 2, quips: ["Meh.", "I'm not excited."] },
  nugget: { name: "Nugget", cell: [0, 3], body: "#e8a33c", belly: "#f6cf86", tail: "#c97f22", w: 12, h: 10, strength: 0.5, value: 1, quips: ["Is that bait? Nom.", "I'm hungry."] },
  flops: { name: "Sir Flops-a-Lot", cell: [3, 1], body: "#6d5b8c", belly: "#b9a8d6", tail: "#4a3d63", w: 18, h: 10, strength: 1.0, value: 3, hat: "monocle", quips: ["Your bobber is tacky.", "Hook, line and stinker."] },
  gary: { name: "Gary the Gaslighting Guppy", cell: [2, 3], body: "#9ee89a", belly: "#d6ffd3", tail: "#6cc56a", w: 9, h: 7, strength: 0.4, value: 1, quips: ["I was never hooked.", "You imagined that."] },
  steve: { name: "Stinkbait Steve", cell: [4, 2], body: "#8c9b3a", belly: "#c7d46a", tail: "#6b7a22", w: 20, h: 6, strength: 1.3, value: 3, quips: ["Ya got me!", "Grr!"] },
  dee: { name: "Dee the Drain Dweller", cell: [5, 2], body: "#e0d6e8", belly: "#f6f0ff", tail: "#bfb3cc", w: 12, h: 8, strength: 0.8, value: 2, quips: ["The pond is haunted.", "Who turned on the light?"] },
  marv: { name: "Mudskipper Marv", cell: [5, 5], body: "#8a6a3f", belly: "#c09a64", tail: "#5e4426", w: 13, h: 9, strength: 0.9, value: 2, quips: ["My legs!", "Walking is overrated."] },
  gloopy: { name: "Gloopy", cell: [5, 6], body: "#6ed36a", belly: "#a6f5a0", tail: "#49a24a", w: 14, h: 12, strength: 0.5, value: 1, quips: ["Sorry, sorry, sorry.", "Oops, my bad."] },
  bogfin: { name: "Count Bogfin", cell: [6, 4], body: "#4b3f5c", belly: "#7b6a92", tail: "#2e2538", w: 16, h: 10, strength: 1.1, value: 3, hat: "cape", quips: ["I VANQUISH YOU!", "BLOOD. OF. CAPITALS."] },
  tina: { name: "Tadpole Tina", cell: [1, 5], body: "#2f3d2f", belly: "#5b7a5b", tail: "#1f2a1f", w: 8, h: 6, strength: 0.3, value: 1, quips: ["One day I'll be a frog.", "Not yet..."] },
  zorp: { name: "Zorp the Three-Eyed Sardine", cell: [3, 7], body: "#b58cff", belly: "#e2d2ff", tail: "#8a5cd6", w: 14, h: 6, strength: 0.7, value: 3, quips: ["Directions home?", "Take me to the mothership!"] },
  glarb: { name: "Glarb", cell: [8, 5], body: "#55e0a0", belly: "#b7ffd9", tail: "#2fb57a", w: 12, h: 10, strength: 0.9, value: 2, hat: "horns", quips: ["La la laaa!", "*wobbly singing*"] },
  duck: { name: "The Imposter", body: "#ffe04a", belly: "#fff3a0", tail: "#ffe04a", w: 12, h: 9, strength: 0.6, value: 5, beak: true, quips: ["Squeak!"] },
  gerald: { name: "Big Gerald", cell: [8, 6], body: "#5a7d8c", belly: "#b7d0da", tail: "#3c5b68", w: 60, h: 34, strength: 1.8, value: 10, quips: ["...", "Rrrumble."] },
  boot: { name: "Boot", body: "#7a4a22", belly: "#a06a34", tail: "#5a3516", w: 12, h: 10, strength: 0.3, value: 1, quips: ["Stomp!"] },
};

let atlas: HTMLImageElement | null = null;

// Load the CC0 PixelFishes sheet. Until it arrives, fish fall back to the code-drawn sprites.
export function loadAtlas(url: string): void {
  const img = new Image();
  img.onload = () => {
    atlas = img;
  };
  img.src = url;
}

function drawAtlasFish(
  ctx: CanvasRenderingContext2D,
  sp: Species,
  cx: number,
  cy: number,
  facing: number,
  t: number,
): void {
  const [col, row] = sp.cell!;
  const size = Math.round(sp.w * 1.6);
  ctx.save();
  ctx.translate(Math.round(cx), Math.round(cy));
  ctx.rotate(Math.sin(t * 6) * 0.06); // gentle wiggle
  ctx.scale(facing, 1);
  ctx.drawImage(atlas!, col * 32, row * 32, 32, 32, -size / 2, -size / 2, size, size);
  ctx.restore();
}

export function paintFish(
  ctx: CanvasRenderingContext2D,
  sp: Species,
  cx: number,
  cy: number,
  facing: number,
  mouthOpen: boolean,
  t: number,
  asBoot = false,
): void {
  if (asBoot) {
    paintBoot(ctx, cx, cy);
    return;
  }
  if (atlas && sp.cell) {
    drawAtlasFish(ctx, sp, cx, cy, facing, t);
    return;
  }
  const rx = sp.w / 2;
  const ry = sp.h / 2;
  const put = (x: number, y: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  };

  // Tail, wagging
  const wag = Math.sin(t * 9) * 1.2;
  if (!sp.beak) {
    for (let i = 0; i < 4; i++) {
      for (let j = -i; j <= i; j++) {
        put(cx - facing * (rx + 1 + i), cy + j * 0.8 + wag * (i / 3), sp.tail);
      }
    }
  }

  // Cape sits behind the body
  if (sp.hat === "cape") {
    ctx.fillStyle = "#b3202a";
    ctx.fillRect(Math.round(cx - facing * rx * 0.2 - 2), Math.round(cy - ry - 1), 4, Math.round(sp.h) + 2);
  }

  // Body: an ellipse of pixels, belly on the lower third
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        put(cx + dx, cy + dy, dy > ry * 0.3 ? sp.belly : sp.body);
      }
    }
  }
  // Dorsal fin
  put(cx - facing, cy - ry - 1, sp.tail);

  // Eye
  const ex = cx + facing * rx * 0.45;
  const ey = cy - ry * 0.25;
  // Eyes blink now and then
  const blinking = (t * 0.37) % 1 < 0.06;
  if (blinking) {
    put(ex, ey + 1, "#101010");
  } else {
    put(ex, ey, "#ffffff");
    put(ex + facing, ey + 1, "#101010");
  }

  // Mouth: two pixels tall when open, one when closed
  const mx = cx + facing * rx * 0.95;
  const my = cy + ry * 0.3;
  put(mx, my, "#2a0808");
  if (mouthOpen) put(mx, my + 1, "#2a0808");

  if (sp.beak) {
    put(cx + facing * (rx + 1), cy - ry * 0.1, "#ff8c1a");
    put(cx + facing * (rx + 2), cy - ry * 0.1, "#ff8c1a");
    put(cx + facing * (rx + 1), cy + ry * 0.2, "#e06a00");
  }

  // Accessories
  switch (sp.hat) {
    case "sun":
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(Math.round(cx - rx * 0.6), Math.round(cy - ry - 2), Math.round(rx * 1.2), 2);
      ctx.fillStyle = "#ffb000";
      ctx.fillRect(Math.round(cx - rx * 0.9), Math.round(cy - ry), Math.round(rx * 1.8), 1);
      break;
    case "boat":
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(cx - rx * 0.5), Math.round(cy - ry - 2), Math.round(rx), 2);
      ctx.fillStyle = "#e33b3b";
      ctx.fillRect(Math.round(cx - rx * 0.5), Math.round(cy - ry - 1), Math.round(rx), 1);
      break;
    case "monocle":
      put(ex + facing * 2, ey, "#ffd23f");
      put(ex + facing * 2, ey + 1, "#ffd23f");
      put(ex + facing * 2, ey - 1, "#ffd23f");
      break;
    case "horns":
      put(cx - 1, cy - ry - 2, "#e9e2c0");
      put(cx + 2 * facing, cy - ry - 3, "#e9e2c0");
      break;
    default:
      break;
  }
}

function paintBoot(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const x = Math.round(cx) - 4;
  const y = Math.round(cy) - 6;
  ctx.fillStyle = "#5a3516";
  ctx.fillRect(x, y, 6, 8);
  ctx.fillStyle = "#7a4a22";
  ctx.fillRect(x + 1, y + 1, 4, 6);
  ctx.fillStyle = "#5a3516";
  ctx.fillRect(x, y + 8, 10, 3);
  ctx.fillStyle = "#2a1608";
  ctx.fillRect(x, y + 11, 10, 1);
  ctx.fillStyle = "#c9a36a";
  ctx.fillRect(x + 1, y + 2, 1, 1);
}
