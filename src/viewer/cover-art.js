const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 248;

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value ?? "lesson")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function between(random, minimum, maximum) {
  return minimum + random() * (maximum - minimum);
}

function number(value) {
  return Number(value.toFixed(1));
}

function ribbonArt(random) {
  return Array.from({ length: 3 }, (_, index) => {
    const y = 62 + index * 58 + between(random, -7, 7);
    const bend = between(random, -22, 22);
    return `<path class="ds-cover-line${index === 1 ? " ds-cover-line-strong" : ""}" d="M ${number(860 + between(random, -12, 24))} ${number(y)} C ${number(960 + between(random, -18, 18))} ${number(y + bend)}, ${number(1080 + between(random, -20, 20))} ${number(y - bend)}, 1224 ${number(y + between(random, -8, 8))}"/>`;
  }).join("");
}

function orbitArt(random) {
  const centerX = number(between(random, 1060, 1100));
  const centerY = number(between(random, 112, 138));
  const rings = Array.from({ length: 2 }, (_, index) => {
    const rx = 92 + index * 58;
    const ry = number(rx * between(random, 0.35, 0.6));
    const rotation = number(between(random, -18, 18));
    return `<ellipse class="ds-cover-line${index === 0 ? " ds-cover-line-strong" : ""}" cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}" transform="rotate(${rotation} ${centerX} ${centerY})"/>`;
  }).join("");
  const dots = Array.from(
    { length: 2 },
    (_, index) =>
      `<circle class="ds-cover-dot${index === 0 ? " ds-cover-dot-strong" : ""}" cx="${number(between(random, 930, 1180))}" cy="${number(between(random, 44, 204))}" r="${number(between(random, 2.2, 3.8))}"/>`,
  ).join("");
  return `${rings}${dots}`;
}

function constellationArt(random) {
  const points = Array.from({ length: 5 }, () => ({
    x: number(between(random, 875, 1180)),
    y: number(between(random, 44, 204)),
  })).sort((a, b) => a.x - b.x);
  const lines = `<path class="ds-cover-line ds-cover-line-strong" d="${points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ")}"/>`;
  const dots = points
    .filter((_, index) => index === 0 || index === 2 || index === 4)
    .map(
      (point, index) =>
        `<circle class="ds-cover-dot${index === 1 ? " ds-cover-dot-strong" : ""}" cx="${point.x}" cy="${point.y}" r="${index === 1 ? 3.6 : 2.4}"/>`,
    )
    .join("");
  return `${lines}${dots}`;
}

function contourArt(random) {
  const centerX = number(between(random, 1060, 1100));
  const centerY = number(between(random, 110, 142));
  return Array.from({ length: 3 }, (_, index) => {
    const width = 90 + index * 70;
    const height = number(width * between(random, 0.45, 0.68));
    const driftX = number(between(random, -5, 5));
    const driftY = number(between(random, -4, 4));
    return `<rect class="ds-cover-line${index === 1 ? " ds-cover-line-strong" : ""}" x="${number(centerX - width / 2 + driftX)}" y="${number(centerY - height / 2 + driftY)}" width="${width}" height="${height}" rx="${number(height * 0.48)}" transform="rotate(${number(between(random, -11, 11))} ${centerX} ${centerY})"/>`;
  }).join("");
}

function offsetRingsArt(random) {
  const centerX = number(between(random, 1080, 1130));
  const centerY = number(between(random, 100, 148));
  return Array.from({ length: 3 }, (_, index) => {
    const radius = 52 + index * 54;
    const shift = number(between(random, -8, 8));
    return `<circle class="ds-cover-line${index === 1 ? " ds-cover-line-strong" : ""}" cx="${number(centerX + shift)}" cy="${number(centerY - shift)}" r="${radius}"/>`;
  }).join("");
}

/** @type {Array<[string, (random: () => number) => string]>} */
const ART_VARIANTS = [
  ["ribbons", ribbonArt],
  ["orbits", orbitArt],
  ["constellation", constellationArt],
  ["contours", contourArt],
  ["offset-rings", offsetRingsArt],
];

/** Create stable, decorative SVG art from a lesson key. */
export function generateCoverArt(seedValue) {
  const seed = hashSeed(seedValue);
  const random = seededRandom(seed);
  const [variant, renderVariant] = ART_VARIANTS[seed % ART_VARIANTS.length];
  const art = renderVariant(random);
  return `<svg class="ds-cover-svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" data-cover-variant="${variant}" data-cover-side="right" xmlns="http://www.w3.org/2000/svg"><g vector-effect="non-scaling-stroke">${art}</g></svg>`;
}
