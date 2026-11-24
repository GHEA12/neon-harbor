// Kestrel Bay, generated. A grid of avenues and streets makes the blocks; each
// block is built up, left as a plaza, a market, a car park or a park. The south
// edge is the harbour: Coast Road, a boardwalk, three piers and open water.
// Everything the other systems need is here: building colliders, the road
// network for traffic, named places the story visits, and spawn points.

import { WORLD, ROAD } from './config.js';

const SIGN_TEXTS = [
  'NOODLE NINE', 'HOTEL LUMEN', 'PAWN & ANCHOR', 'VELVET EEL', 'DISCO FATHOM',
  'INK & OIL', '24H BAIT', 'CLUB UNDERTOW', 'RAMEN RIOT', 'THE BRASS GULL',
  'LOANS AHOY', 'FATHOM FITNESS', 'SALT AIR RECORDS', 'PIER PRESS', 'MAMA MISO',
  'THE LOWLIGHT', 'KESTREL ARMS', 'TIDELINE MOTEL', 'GULL & BARREL', 'ECHO ARCADE',
];

/** Blocks with a job other than buildings, keyed "col,row" over the block grid. */
const SPECIAL_BLOCKS = {
  '3,2': 'plaza', // Gull Square
  '4,1': 'market', // the Lantern Market
  '5,4': 'marina', // Marina Row car lot, the block above Coast Road
  '1,4': 'park', // Fathom Park
  '6,2': 'parking',
  '2,3': 'parking',
  '7,4': 'parking',
};

export function generateCity(rng) {
  const buildings = [];
  const crates = [];
  const lamps = [];
  const palms = [];
  const lots = [];
  const halfRoad = ROAD.width / 2;

  // Blocks sit between neighbouring road centres, inset by the road and a pavement.
  const blockCols = [];
  for (let i = 0; i < ROAD.avenuesX.length - 1; i += 1) {
    blockCols.push([ROAD.avenuesX[i] + halfRoad + 14, ROAD.avenuesX[i + 1] - halfRoad - 14]);
  }
  const blockRows = [];
  for (let j = 0; j < ROAD.streetsY.length - 1; j += 1) {
    blockRows.push([ROAD.streetsY[j] + halfRoad + 14, ROAD.streetsY[j + 1] - halfRoad - 14]);
  }

  const blocks = [];
  for (let row = 0; row < blockRows.length; row += 1) {
    for (let col = 0; col < blockCols.length; col += 1) {
      const [x0, x1] = blockCols[col];
      const [y0, y1] = blockRows[row];
      const kind = SPECIAL_BLOCKS[`${col},${row}`] ?? 'built';
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, col, row, kind };
      blocks.push(block);
      if (kind === 'built') buildBlock(rng, block, buildings);
      else if (kind === 'parking' || kind === 'marina') {
        lots.push({ x: block.x, y: block.y, w: block.w, h: block.h, marina: kind === 'marina' });
      } else if (kind === 'market') {
        buildMarket(rng, block, buildings, crates);
      } else if (kind === 'park') {
        scatterPalms(rng, block, palms, 9);
      } else if (kind === 'plaza') {
        scatterPalms(rng, block, palms, 4);
      }
    }
  }

  // Street lamps stand on the pavement corners along every road.
  for (const x of ROAD.avenuesX) {
    for (let y = 180; y < WORLD.beachY; y += 236) {
      lamps.push({ x: x - halfRoad - 8, y }, { x: x + halfRoad + 8, y: y + 118 });
    }
  }
  for (let x = 240; x < WORLD.width - 200; x += 264) {
    palms.push({ x: x + rng() * 30, y: WORLD.beachY + 66 + rng() * 60 });
  }

  // The harbour: three piers walk out over the water.
  const piers = [1344, 2368, 3392].map((cx) => ({
    x: cx - 52, y: WORLD.waterY - 6, w: 104, h: WORLD.height - WORLD.waterY - 40, cx,
  }));
  for (const pier of piers) {
    for (let y = pier.y + 30; y < pier.y + pier.h; y += 92) {
      crates.push({ x: pier.x + 6, y, w: 20, h: 20 }, { x: pier.x + pier.w - 26, y: y + 40, w: 20, h: 20 });
    }
  }

  const blockAt = (col, row) => blocks[row * blockCols.length + col];
  const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

  const places = {
    flat: { x: blockAt(2, 1).x - 44, y: centre(blockAt(2, 1)).y, name: "Ivo's flat, Gull Street" },
    market: { ...centre(blockAt(4, 1)), name: 'the Lantern Market' },
    gullSquare: { ...centre(blockAt(3, 2)), name: 'Gull Square' },
    precinct: { x: blockAt(6, 0).x - 44, y: centre(blockAt(6, 0)).y, name: 'Harbor Precinct' },
    hospital: { x: blockAt(0, 3).x + blockAt(0, 3).w + 44, y: centre(blockAt(0, 3)).y, name: 'St Kestrel Hospital' },
    garage: { x: blockAt(7, 3).x - 44, y: centre(blockAt(7, 3)).y, name: 'Rust & Ruin Garage' },
    safehouse: { x: blockAt(2, 4).x - 44, y: centre(blockAt(2, 4)).y, name: 'the Tidemill Lane safehouse' },
    marinaLot: { ...centre(blockAt(5, 4)), name: 'the Marina Row lot' },
    pier3: { x: piers[0].cx, y: piers[0].y + 120, name: 'Pier 3' },
    boat: { x: piers[2].cx + 118, y: WORLD.height - 150, name: 'The Gullwife' },
    pier9Gate: { x: piers[2].cx, y: piers[2].y + 26, name: 'Pier 9' },
  };

  const colliders = [...buildings, ...crates];

  return {
    buildings, crates, lamps, palms, lots, blocks, piers, places, colliders,
    intersections: ROAD.avenuesX.flatMap((x) => ROAD.streetsY.map((y) => ({ x, y }))),
  };
}

function buildBlock(rng, block, buildings) {
  // Split the block into plots with an alley cross, and raise a building on each.
  const midX = block.x + block.w * (0.42 + rng() * 0.16);
  const midY = block.y + block.h * (0.42 + rng() * 0.16);
  const plots = [
    [block.x, block.y, midX - 12 - block.x, midY - 12 - block.y],
    [midX + 12, block.y, block.x + block.w - midX - 12, midY - 12 - block.y],
    [block.x, midY + 12, midX - 12 - block.x, block.y + block.h - midY - 12],
    [midX + 12, midY + 12, block.x + block.w - midX - 12, block.y + block.h - midY - 12],
  ];
  for (const [px, py, pw, ph] of plots) {
    if (pw < 90 || ph < 90) continue;
    const inset = 6 + rng() * 16;
    const sign = rng() < 0.34
      ? { text: SIGN_TEXTS[Math.floor(rng() * SIGN_TEXTS.length)], color: Math.floor(rng() * 6) }
      : null;
    buildings.push({
      x: px + inset, y: py + inset, w: pw - inset * 2, h: ph - inset * 2,
      tone: 0.82 + rng() * 0.5, seed: Math.floor(rng() * 1e9), sign,
    });
  }
}

function buildMarket(rng, block, buildings, crates) {
  // Low sheds around the edges, stalls and crates in the middle.
  buildings.push(
    { x: block.x + 8, y: block.y + 8, w: block.w - 16, h: 54, tone: 1.05, seed: 11, sign: { text: 'LANTERN MARKET', color: 1 } },
    { x: block.x + 8, y: block.y + block.h - 62, w: block.w - 16, h: 54, tone: 0.95, seed: 12, sign: { text: 'NIGHT STALLS', color: 0 } },
  );
  for (let i = 0; i < 10; i += 1) {
    crates.push({
      x: block.x + 30 + rng() * (block.w - 90),
      y: block.y + 90 + rng() * (block.h - 180),
      w: 22 + rng() * 14, h: 22 + rng() * 14,
    });
  }
}

function scatterPalms(rng, block, palms, count) {
  for (let i = 0; i < count; i += 1) {
    palms.push({ x: block.x + 24 + rng() * (block.w - 48), y: block.y + 24 + rng() * (block.h - 48) });
  }
}

/** Is the point on tarmac (a road or a car park), where cars belong? */
export function isOnRoad(city, x, y) {
  const half = ROAD.width / 2;
  for (const ax of ROAD.avenuesX) if (Math.abs(x - ax) <= half) return true;
  for (const sy of ROAD.streetsY) if (Math.abs(y - sy) <= half) return true;
  for (const lot of city.lots) if (x >= lot.x && x <= lot.x + lot.w && y >= lot.y && y <= lot.y + lot.h) return true;
  return false;
}

/** Open water, unless a pier deck is under the point. */
export function isInWater(city, x, y) {
  if (y < WORLD.waterY) return false;
  for (const pier of city.piers) {
    if (x >= pier.x && x <= pier.x + pier.w && y >= pier.y && y <= pier.y + pier.h) return false;
  }
  return true;
}

/** A random point on the road network, used for traffic and police spawns. */
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    const x = ROAD.avenuesX[Math.floor(rng() * ROAD.avenuesX.length)];
    return { x, y: 160 + rng() * (WORLD.beachY - 240) };
  }
  const y = ROAD.streetsY[Math.floor(rng() * (ROAD.streetsY.length - 1))];
  return { x: 160 + rng() * (WORLD.width - 320), y };
}

/** A random pavement point near a road, where people walk. */
export function randomSidewalkPoint(rng) {
  const half = ROAD.width / 2 + 20;
  if (rng() < 0.55) {
    const x = ROAD.avenuesX[Math.floor(rng() * ROAD.avenuesX.length)] + (rng() < 0.5 ? -half : half);
    return { x, y: 140 + rng() * (WORLD.beachY - 200) };
  }
  const y = ROAD.streetsY[Math.floor(rng() * (ROAD.streetsY.length - 1))] + (rng() < 0.5 ? -half : half);
  return { x: 140 + rng() * (WORLD.width - 280), y };
}

export function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of ROAD.avenuesX) {
    for (const sy of ROAD.streetsY) {
      const d = (ax - x) * (ax - x) + (sy - y) * (sy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: ax, y: sy };
      }
    }
  }
  return best;
}

/**
 * Push a circle at (x, y) with radius r out of every building and crate.
 * Returns the corrected position; buildings are solid, the harbour is not.
 */
export function collideCircle(city, x, y, r) {
  for (let i = 0; i < city.colliders.length; i += 1) {
    const b = city.colliders[i];
    if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) continue;
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    let dx = x - cx;
    let dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) continue;
    if (d2 < 0.0001) {
      // Centre inside the rect: leave by the nearest face.
      const left = x - b.x;
      const right = b.x + b.w - x;
      const top = y - b.y;
      const bottom = b.y + b.h - y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x - r;
      else if (m === right) x = b.x + b.w + r;
      else if (m === top) y = b.y - r;
      else y = b.y + b.h + r;
      continue;
    }
    const d = Math.sqrt(d2);
    dx /= d;
    dy /= d;
    x = cx + dx * r;
    y = cy + dy * r;
  }
  return { x, y };
}

/** True when a building stands between two points (sampled along the line). */
export function lineBlocked(city, x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.floor(dist / 42));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (let j = 0; j < city.buildings.length; j += 1) {
      const b = city.buildings[j];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
  }
  return false;
}
