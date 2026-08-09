const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 248;

// Cover composition grammar:
// - Keep every mark inside the rightmost 28% of the canvas.
// - Use one dominant cluster with no more than two supporting forms.
// - Prefer shallow arcs, repeated ripples, or connected points.
// - Never use broad S curves, double inflections, crossings, or tangencies.
// - Leave at least one shape-width of calm space between separate forms.
// - Randomness may shift a composition slightly, but may not alter its geometry.

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

function jitterPoints(random, template, amount = 4) {
  return template.map(([x, y]) => ({
    x: number(x + between(random, -amount, amount)),
    y: number(y + between(random, -amount, amount)),
  }));
}

function connectedDots(points, extraLines = "", extraDots = []) {
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const dotPath = [...points, ...extraDots]
    .map((point, index) => {
      const radius = index === 2 ? 3.4 : 2.4;
      return `M ${number(point.x - radius)} ${point.y} a ${radius} ${radius} 0 1 0 ${number(radius * 2)} 0 a ${radius} ${radius} 0 1 0 ${number(radius * -2)} 0`;
    })
    .join(" ");
  return `<path class="ds-cover-line ds-cover-line-strong" d="${linePath}${extraLines}"/><path class="ds-cover-dots" d="${dotPath}"/>`;
}

function constellationRiseArt(random) {
  return connectedDots(
    jitterPoints(random, [
      [870, 174],
      [928, 136],
      [986, 151],
      [1048, 96],
      [1112, 112],
      [1180, 58],
    ]),
  );
}

function constellationDriftArt(random) {
  return connectedDots(
    jitterPoints(random, [
      [868, 82],
      [930, 66],
      [990, 106],
      [1052, 88],
      [1116, 136],
      [1182, 119],
    ]),
  );
}

function constellationBranchArt(random) {
  const points = jitterPoints(random, [
    [878, 166],
    [948, 126],
    [1018, 143],
    [1092, 92],
    [1172, 108],
  ]);
  const branch = jitterPoints(random, [[1028, 62]])[0];
  const extraLine = ` M ${points[2].x} ${points[2].y} L ${branch.x} ${branch.y}`;
  return connectedDots(points, extraLine, [branch]);
}

function rippleArt(random) {
  const shift = number(between(random, -5, 5));
  const path = [
    `M ${number(930 + shift)} 60 C ${number(1000 + shift)} 38, ${number(1110 + shift)} 38, 1192 66`,
    `M ${number(906 + shift)} 120 C ${number(990 + shift)} 88, ${number(1110 + shift)} 88, 1198 120`,
    `M ${number(940 + shift)} 180 C ${number(1022 + shift)} 154, ${number(1110 + shift)} 154, 1182 179`,
  ].join(" ");
  const dots = `M ${number(1188 + shift)} 66 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 M ${number(903 + shift)} 120 a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0`;
  return `<path class="ds-cover-line ds-cover-line-strong" d="${path}"/><path class="ds-cover-dots" d="${dots}"/>`;
}

function shapeSequenceArt(random) {
  const shiftX = number(between(random, -5, 5));
  const shiftY = number(between(random, -4, 4));
  const path = [
    `M ${number(892 + shiftX)} ${number(76 + shiftY)} L ${number(932 + shiftX)} ${number(54 + shiftY)} L ${number(962 + shiftX)} ${number(88 + shiftY)} L ${number(922 + shiftX)} ${number(112 + shiftY)} Z`,
    `M ${number(1010 + shiftX)} ${number(142 + shiftY)} L ${number(1044 + shiftX)} ${number(102 + shiftY)} L ${number(1080 + shiftX)} ${number(142 + shiftY)} Z`,
    `M ${number(1128 + shiftX)} ${number(72 + shiftY)} L ${number(1172 + shiftX)} ${number(72 + shiftY)} L ${number(1190 + shiftX)} ${number(108 + shiftY)} L ${number(1148 + shiftX)} ${number(126 + shiftY)} L ${number(1118 + shiftX)} ${number(101 + shiftY)} Z`,
  ].join(" ");
  return `<path class="ds-cover-line ds-cover-line-strong" d="${path}"/>`;
}

function arcAndShapesArt(random) {
  const shiftX = number(between(random, -3, 3));
  const shiftY = number(between(random, -3, 3));
  const arc = `M ${number(872 + shiftX)} ${number(150 + shiftY)} C ${number(914 + shiftX)} ${number(96 + shiftY)}, ${number(966 + shiftX)} ${number(96 + shiftY)}, ${number(1008 + shiftX)} ${number(150 + shiftY)}`;
  const arcDots = `M ${number(869.5 + shiftX)} ${number(150 + shiftY)} a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0 M ${number(1005.5 + shiftX)} ${number(150 + shiftY)} a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0`;
  const circleX = number(1072 + shiftX);
  const circleY = number(82 + shiftY);
  const triangle = `M ${number(1134 + shiftX)} ${number(166 + shiftY)} L ${number(1164 + shiftX)} ${number(122 + shiftY)} L ${number(1190 + shiftX)} ${number(166 + shiftY)} Z`;
  return `<path class="ds-cover-line ds-cover-line-strong" d="${arc}"/><path class="ds-cover-dots" d="${arcDots}"/><circle class="ds-cover-line" cx="${circleX}" cy="${circleY}" r="19"/><path class="ds-cover-line" d="${triangle}"/>`;
}

function zigzagAndCirclesArt(random) {
  const points = jitterPoints(
    random,
    [
      [868, 154],
      [912, 88],
      [958, 132],
      [1006, 64],
      [1050, 112],
    ],
    3,
  );
  const constellation = connectedDots(points);
  const firstX = number(1110 + between(random, -3, 3));
  const secondX = number(1170 + between(random, -3, 3));
  return `${constellation}<circle class="ds-cover-line" cx="${firstX}" cy="65" r="17"/><circle class="ds-cover-line ds-cover-line-strong" cx="${secondX}" cy="154" r="25"/>`;
}

/** @type {Array<[string, (random: () => number) => string]>} */
const ART_VARIANTS = [
  ["constellation-rise", constellationRiseArt],
  ["constellation-drift", constellationDriftArt],
  ["constellation-branch", constellationBranchArt],
  ["ripples", rippleArt],
  ["shape-sequence", shapeSequenceArt],
  ["arc-and-shapes", arcAndShapesArt],
  ["zigzag-and-circles", zigzagAndCirclesArt],
];

/** Create stable, decorative SVG art from a lesson key. */
export function generateCoverArt(seedValue) {
  const seed = hashSeed(seedValue);
  const random = seededRandom(seed);
  const [variant, renderVariant] = ART_VARIANTS[seed % ART_VARIANTS.length];
  const art = renderVariant(random);
  return `<svg class="ds-cover-svg" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}" preserveAspectRatio="xMaxYMid slice" aria-hidden="true" focusable="false" data-cover-variant="${variant}" data-cover-side="right" xmlns="http://www.w3.org/2000/svg"><g vector-effect="non-scaling-stroke">${art}</g></svg>`;
}
