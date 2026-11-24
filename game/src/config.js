// Neon Harbor — every tuning number, name and colour in one place.
// The world is Kestrel Bay, a neon container port. The camera shows a 1280x720
// slice of it at a time; no rule below depends on the screen size.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = {
  width: 4864,
  height: 3712,
  /** Below this y the ground gives way to beach, then open water. */
  beachY: 3136,
  waterY: 3328,
};

export const ROAD = {
  width: 104,
  pitch: 512,
  /** Centres of the vertical avenues, west to east. */
  avenuesX: [320, 832, 1344, 1856, 2368, 2880, 3392, 3904, 4416],
  /** Centres of the horizontal streets, north to south; the last is Coast Road. */
  streetsY: [320, 832, 1344, 1856, 2368, 2880, 3056],
  laneOffset: 27,
};

export const FOOT = {
  radius: 15,
  walkSpeed: 216,
  sprintSpeed: 318,
  health: 100,
  regenDelay: 6,
  regenRate: 9,
  meleeRange: 52,
  meleeDamage: 34,
  meleeCooldown: 0.38,
  gunDamage: 26,
  gunRange: 560,
  gunCooldown: 0.16,
  gunSpread: 0.035,
};

/** Car models of Kestrel Bay: all invented here, none borrowed. */
export const CAR_MODELS = [
  { name: 'Bantam Hatch', length: 64, width: 34, topSpeed: 348, accel: 300, grip: 5.2, colors: ['#e5534b', '#4fc3f7', '#f2c94c', '#7ee081', '#c792ea'] },
  { name: 'Sable Sedan', length: 74, width: 36, topSpeed: 392, accel: 330, grip: 5.6, colors: ['#5b6ee1', '#9aa7bd', '#37404f', '#8a5a44', '#4f7d6a'] },
  { name: 'Harbor Pickup', length: 80, width: 38, topSpeed: 356, accel: 300, grip: 4.8, colors: ['#d97b29', '#6b7c8d', '#47525e', '#a03d3d'] },
  { name: 'Gullwing Van', length: 84, width: 40, topSpeed: 330, accel: 280, grip: 4.6, colors: ['#d8dce6', '#7a8699', '#3f6d8e'] },
  { name: 'Aurora Coupe', length: 72, width: 35, topSpeed: 452, accel: 420, grip: 6.4, colors: ['#cfd6dd'] },
  { name: 'Precinct Interceptor', length: 76, width: 37, topSpeed: 438, accel: 430, grip: 6.2, colors: ['#e8ecf2'] },
];

export const TRAFFIC = { maxCars: 13, spawnGap: 620 };
export const PARKED = { perLot: 3 };
export const PEDS = { max: 24, spawnGap: 560, despawnGap: 1050 };

export const HEAT = {
  /** Heat is measured in points; 100 points make a star, five stars is the ceiling. */
  perStar: 100,
  maxStars: 5,
  carTheft: 100,
  grandTheftWitnessed: 100,
  assault: 55,
  shooting: 30,
  pedHit: 130,
  carRam: 25,
  decayDelay: 7,
  decayRate: 9,
  /** How close a police car must be, and how still the player, for the bust meter to fill. */
  bustRange: 92,
  bustFill: 0.5,
  bustDrain: 0.9,
};

export const POLICE = {
  spawnGap: 760,
  despawnGap: 1500,
  spawnEvery: 2.4,
  ramDamage: 7,
};

export const PALETTE = {
  night: '#07070f',
  asphalt: '#22223a',
  asphaltEdge: '#313154',
  laneMark: '#c9a86a',
  sidewalk: '#3b3f5e',
  blockGround: '#292945',
  plazaGround: '#2f2f52',
  sand: '#5f4c2c',
  waterDeep: '#062238',
  waterShallow: '#0a3a5c',
  waterSparkle: '#7fe7ff',
  grass: '#1e4034',
  pierDeck: '#4a3b2c',
  pierPost: '#2c2118',
  playerCoat: '#19c2b8',
  playerSkin: '#e8b08a',
  policeLightA: '#ff3b57',
  policeLightB: '#3b8bff',
  objective: '#37f4ff',
  cabYellow: '#ffd23e',
  danger: '#ff4f6d',
  cash: '#8dff6e',
  text: '#eef4ff',
  muted: '#9aa7c7',
  panel: 'rgba(10, 12, 26, 0.72)',
};

export const NEON_SIGNS = ['#ff4fd8', '#37f4ff', '#ffb340', '#9dff57', '#8a6bff', '#ff6a5e'];

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-harbor.save.v1';

export const STORY = {
  cityName: 'Kestrel Bay',
  heroName: 'Ivo Lark',
  boatName: 'The Gullwife',
  fixerName: 'Odette Fenn',
  informantName: 'Pell the Canary',
  subtitle: 'One Night to Buy Back the Gullwife',
};
