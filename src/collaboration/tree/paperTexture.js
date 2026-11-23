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
  context.textBaseline = "top";
  const layout = layoutPaperText(context, text);
  layout.lines.forEach((line, index) => context.fillText(line, 45, 68 + index * layout.lineHeight));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// Fit the complete accepted message on the physical paper; never silently cut
// off its last lines. Extremely fragmented line breaks reflow like normal text.
export function layoutPaperText(context, text) {
  function wrap(value) {
    const lines = []; let line = "";
    for (const character of [...value]) {
      if (character === "\n") {
        lines.push(line);
        line = "";
      } else if (context.measureText(line + character).width > 422) {
        // Prefer whole words; long unbroken input still wraps without losing text.
        const split = line.lastIndexOf(" ") + 1;
        lines.push(split ? line.slice(0, split) : line);
        line = (split ? line.slice(split) : "") + character;
      } else line += character;
    }
    lines.push(line);
    return lines;
  }
  for (const value of [text, text.replace(/\s*\n\s*/g, " ")]) {
    for (let font = 30; font >= 16; font -= 2) {
      context.font = `${font}px "Segoe Print", "Bradley Hand", cursive`;
      const lines = wrap(value), lineHeight = font * 1.43;
      if (lines.length * lineHeight <= 490) return { lines, lineHeight };
    }
  }
  return { lines: wrap(text.replace(/\s+/g, " ")), lineHeight: 22.88 };
}
