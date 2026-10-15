interface Bar {
  percentage: number;
}

interface DrawOptions {
  ctx: CanvasRenderingContext2D;
  bars: Bar[];
  width: number;
  height: number;
  color: string | null;
  edit: boolean;
  time: number;
}

export const ambientVisualizerTypes = [
  "aurora",
  "horizon",
  "orbit",
  "soft-spectrum",
];

function level(
  bars: Bar[],
  start: number,
  end: number,
  edit: boolean,
  fallback: number,
) {
  if (edit) return fallback;
  const first = Math.floor(bars.length * start);
  const last = Math.max(first + 1, Math.floor(bars.length * end));
  let sum = 0;
  for (let i = first; i < last; i++) sum += bars[i]?.percentage || 0;
  return sum / (last - first);
}

function base(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  hue: string,
) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#07101c");
  gradient.addColorStop(0.55, "#111326");
  gradient.addColorStop(1, "#080f19");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.5,
    height,
    0,
    width * 0.5,
    height,
    width * 0.75,
  );
  glow.addColorStop(0, hue);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
}

function accentColor(color: string | null, fallback: string) {
  return color && color !== "rgb(0 0 0 / 0)" ? color : fallback;
}

/** A calm horizon with a low, audio-shaped light field. */
export function drawHorizon({
  ctx,
  bars,
  width,
  height,
  color,
  edit,
  time,
}: DrawOptions) {
  const bass = level(bars, 0, 0.2, edit, 0.32);
  const mids = level(bars, 0.2, 0.7, edit, 0.22);
  const motion = time / 1000;
  const accent = accentColor(color, "rgba(125, 220, 255, 0.75)");

  ctx.save();
  base(ctx, width, height, "rgba(22, 95, 143, 0.22)");
  const horizon = height * 0.72;

  const light = ctx.createRadialGradient(
    width * 0.5,
    horizon,
    0,
    width * 0.5,
    horizon,
    width * 0.58,
  );
  light.addColorStop(0, `rgba(71, 169, 215, ${0.16 + bass * 0.2})`);
  light.addColorStop(1, "rgba(23, 58, 104, 0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, width, height);

  for (let layer = 0; layer < 3; layer++) {
    const phase = motion * (0.18 + layer * 0.035) + layer * 1.8;
    const amplitude = height * (0.025 + bass * 0.035 + layer * 0.009);
    const yBase = horizon + layer * height * 0.055;
    ctx.beginPath();
    for (let x = 0; x <= width; x += Math.max(6, width / 180)) {
      const n = x / width;
      const y =
        yBase +
        Math.sin(n * Math.PI * (2.4 + layer * 0.3) + phase) * amplitude +
        Math.sin(n * 12 - phase * 0.7) * amplitude * 0.22;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle =
      layer === 0 ? accent : `rgba(98, 174, 231, ${0.28 - layer * 0.055})`;
    ctx.lineWidth = Math.max(1, height * (layer === 0 ? 0.002 : 0.0014));
    ctx.shadowColor = "rgba(87, 188, 255, 0.4)";
    ctx.shadowBlur = height * 0.018;
    ctx.stroke();
  }
  ctx.restore();
}

/** A sparse orbital field, with a gentle bass pulse around the outer rim. */
export function drawOrbit({
  ctx,
  bars,
  width,
  height,
  color,
  edit,
  time,
}: DrawOptions) {
  const bass = level(bars, 0, 0.18, edit, 0.3);
  const treble = level(bars, 0.65, 1, edit, 0.2);
  const motion = time / 1000;
  const cx = width * 0.5;
  const cy = height * 0.52;
  const radius = Math.min(width, height) * 0.32;
  const accent = accentColor(color, "rgba(181, 164, 255, 0.76)");

  ctx.save();
  base(ctx, width, height, "rgba(68, 49, 131, 0.19)");
  ctx.globalCompositeOperation = "screen";

  for (let ring = 0; ring < 3; ring++) {
    const r =
      radius * (0.66 + ring * 0.17) + bass * height * (0.025 + ring * 0.008);
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      r * (1 + ring * 0.12),
      r * (0.72 + ring * 0.1),
      Math.sin(motion * 0.08 + ring) * 0.08,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle =
      ring === 1 ? accent : `rgba(143, 129, 230, ${0.18 + treble * 0.2})`;
    ctx.lineWidth = Math.max(1, height * (ring === 1 ? 0.002 : 0.0012));
    ctx.shadowColor = "rgba(170, 150, 255, 0.38)";
    ctx.shadowBlur = height * 0.02;
    ctx.stroke();
  }

  const core = ctx.createRadialGradient(
    cx,
    cy,
    radius * 0.05,
    cx,
    cy,
    radius * 0.9,
  );
  core.addColorStop(0, `rgba(105, 107, 190, ${0.04 + bass * 0.08})`);
  core.addColorStop(1, "rgba(50, 37, 105, 0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A soft, low-profile spectrum that leaves the center clear for lyrics. */
export function drawSoftSpectrum({
  ctx,
  bars,
  width,
  height,
  color,
  edit,
  time,
}: DrawOptions) {
  const count = bars.length || 1;
  const bass = level(bars, 0, 0.2, edit, 0.3);
  const accent = accentColor(color, "rgba(112, 222, 255, 0.78)");
  const motion = time / 1000;

  ctx.save();
  base(ctx, width, height, "rgba(28, 101, 137, 0.15)");
  ctx.globalCompositeOperation = "screen";

  const points: [number, number][] = [];
  for (let i = 0; i <= 160; i++) {
    const n = i / 160;
    const index = Math.min(count - 1, Math.floor(n * count));
    const energy = bars[index]?.percentage || (edit ? 0.22 : 0);
    const envelope = Math.sin(n * Math.PI) ** 0.7;
    const ripple = Math.sin(n * 17 - motion * 0.35) * 0.006;
    points.push([
      n * width,
      height *
        (0.89 - envelope * (0.025 + energy * 0.18 + bass * 0.05) + ripple),
    ]);
  }

  ctx.beginPath();
  ctx.moveTo(0, height);
  points.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(width, height);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, height * 0.68, 0, height);
  fill.addColorStop(0, "rgba(80, 190, 230, 0.22)");
  fill.addColorStop(1, "rgba(25, 63, 100, 0.02)");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
  );
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, height * 0.002);
  ctx.shadowColor = "rgba(91, 209, 255, 0.56)";
  ctx.shadowBlur = height * 0.022;
  ctx.stroke();
  ctx.restore();
}
