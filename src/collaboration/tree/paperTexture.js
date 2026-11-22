import { CanvasTexture, SRGBColorSpace } from "three";

// Procedural paper stays local and adds no network asset or external font request.
export function createPaperTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  context.fillStyle = "#eee4ce";
  context.fillRect(0, 0, 512, 640);
  // Deterministic fine fibers avoid regenerating random paper on every render.
  for (let i = 0; i < 3500; i++) {
    context.fillStyle = i % 2 ? "#7f705610" : "#ffffff38";
    context.fillRect((i * 137) % 512, (i * 293) % 640, 1, 2);
  }
  const fold = context.createLinearGradient(0, 306, 0, 326);
  fold.addColorStop(0, "#b4a38800");
  fold.addColorStop(0.5, "#b4a38835");
  fold.addColorStop(1, "#ffffff00");
  context.fillStyle = fold;
  context.fillRect(0, 306, 512, 20);
  context.fillStyle = "#514637";
  context.font = '30px "Segoe Print", "Bradley Hand", cursive';
  context.textBaseline = "top";
  let line = "", y = 72;
  for (const character of [...text]) {
    if (character === "\n" || context.measureText(line + character).width > 422) {
      context.fillText(line, 45, y);
      y += 43;
      line = character === "\n" ? "" : character;
    } else line += character;
    if (y > 540) break;
  }
  if (y <= 540) context.fillText(line, 45, y);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
