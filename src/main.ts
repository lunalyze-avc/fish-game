// Reel Goobers: scaffold. The game renders into a 320x180 canvas that CSS scales up with crisp pixels.
const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("2D canvas not supported");
ctx.imageSmoothingEnabled = false;

function frame(): void {
  ctx!.fillStyle = "#1d6f8c";
  ctx!.fillRect(0, 0, canvas.width, canvas.height);
  ctx!.fillStyle = "#fff";
  ctx!.font = "10px monospace";
  ctx!.fillText("REEL GOOBERS", 110, 90);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
