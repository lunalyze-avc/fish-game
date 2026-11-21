// Trophy definitions and the Hall of Fish Fame (the man cave trophy room), drawn in pixels.

export interface TrophyDef {
  id: string;
  name: string;
  hint: string;
}

export const TROPHIES: TrophyDef[] = [
  { id: "reel_trouble", name: "Reel Trouble", hint: "Snap the line" },
  { id: "hook_line_stinker", name: "Hook, Line and Stinker", hint: "Catch a boot" },
  { id: "cod_almighty", name: "Cod Almighty", hint: "Land Big Gerald" },
  { id: "oh_my_cod", name: "Oh My Cod", hint: "Catch on all 3 maps" },
  { id: "reely_ridiculous", name: "Reely Ridiculous", hint: "Catch in Disco Pond" },
  { id: "fish_outta_luck", name: "Fish Outta Luck", hint: "Miss 3 bites in a row" },
  { id: "what_a_catch", name: "What a Catch", hint: "25 catches" },
  { id: "catch_me_if_you_can", name: "Catch Me If You Can", hint: "Catch the duck" },
  { id: "fish_and_giggles", name: "Fish and Giggles", hint: "3 catches in a row" },
  { id: "reverse_psychology", name: "Reverse Psychology", hint: "Catch in Reverse" },
  { id: "reel_champ", name: "Reel Champ", hint: "Score 40 in Tournament" },
];

const SHELF_Y = [46, 86, 126];

function cup(ctx: CanvasRenderingContext2D, x: number, y: number, lit: boolean): void {
  const gold = lit ? "#ffd23f" : "#3a3a46";
  const gold2 = lit ? "#b8860b" : "#2c2c36";
  ctx.fillStyle = gold2;
  ctx.fillRect(x, y + 2, 2, 5);
  ctx.fillRect(x + 12, y + 2, 2, 5);
  ctx.fillStyle = gold;
  ctx.fillRect(x + 2, y, 10, 8);
  ctx.fillRect(x + 6, y + 8, 2, 4);
  ctx.fillStyle = gold2;
  ctx.fillRect(x + 3, y + 12, 8, 2);
  ctx.fillStyle = lit ? "#6b4226" : "#22222a";
  ctx.fillRect(x, y + 14, 14, 3);
  if (lit) {
    ctx.fillStyle = "#fff6c8";
    ctx.fillRect(x + 3, y + 1, 1, 3);
  }
}

function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string): void {
  ctx.font = "5px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function drawRoom(ctx: CanvasRenderingContext2D, owned: Set<string>, t: number): void {
  // Paneled wood wall
  ctx.fillStyle = "#4a2f22";
  ctx.fillRect(0, 0, 320, 180);
  ctx.fillStyle = "#3d2519";
  for (let x = 0; x < 320; x += 40) ctx.fillRect(x, 0, 1, 180);

  // Warm lamp glow
  const glow = ctx.createRadialGradient(160, 4, 2, 160, 4, 120);
  glow.addColorStop(0, "rgba(255,210,120,0.35)");
  glow.addColorStop(1, "rgba(255,210,120,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 320, 180);

  // Neon-ish sign
  ctx.fillStyle = "#1a1a24";
  ctx.fillRect(96, 4, 128, 14);
  ctx.font = "7px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `hsl(${40 + Math.sin(t * 2) * 10}, 100%, 60%)`;
  ctx.fillText("HALL OF FISH FAME", 160, 11);

  // Shelves and trophies
  TROPHIES.forEach((tr, i) => {
    const shelf = Math.floor(i / 4);
    const col = i % 4;
    const sx = 30 + col * 72;
    const sy = SHELF_Y[shelf];
    const got = owned.has(tr.id);
    cup(ctx, sx + 22, sy - 16, got);
    const name = got ? tr.name : "???";
    label(ctx, name.length > 16 ? name.slice(0, 15) + "." : name, sx + 36, sy + 8, got ? "#ffe9a8" : "#8a8a96");
    if (!got) label(ctx, tr.hint, sx + 36, sy + 14, "#6d6d78");
  });

  SHELF_Y.forEach((sy) => {
    ctx.fillStyle = "#8b5a3c";
    ctx.fillRect(14, sy, 292, 3);
    ctx.fillStyle = "#2a180f";
    ctx.fillRect(14, sy + 3, 292, 2);
  });

  // Display cabinet with glass front along the floor
  ctx.fillStyle = "#2b1a12";
  ctx.fillRect(14, 150, 292, 26);
  ctx.fillStyle = "rgba(180,220,255,0.12)";
  ctx.fillRect(18, 153, 284, 20);
  ctx.fillStyle = "#6b4226";
  ctx.fillRect(14, 150, 292, 1);

  const count = TROPHIES.filter((tr) => owned.has(tr.id)).length;
  ctx.font = "8px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffd23f";
  ctx.fillText(`TROPHIES ${count}/${TROPHIES.length}`, 160, 162);
}
