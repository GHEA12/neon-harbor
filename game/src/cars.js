// Cars: the factory, the arcade physics every car shares, the traffic that
// follows Kestrel Bay's road grid, and the Precinct Interceptors that chase.
// A car is driven by whoever sits in it: the player, a traffic driver, or a
// police driver. Physics only knows throttle, steer and brake.

import { CAR_MODELS, ROAD, WORLD, POLICE } from './config.js';
import { collideCircle, nearestIntersection, randomRoadPoint } from './city.js';

let nextCarId = 1;

export function createCar(x, y, angle, modelIndex, color, kind) {
  const model = CAR_MODELS[modelIndex];
  return {
    id: nextCarId++,
    x, y, angle,
    vx: 0, vy: 0,
    model, color, kind,
    hp: 100, wrecked: false, sunk: false,
    driver: null, // 'player', 'traffic' or 'police'
    target: null, // the intersection a traffic car is heading for
    fromNode: null,
    stuckTime: 0, reverseTime: 0,
    sirenPhase: Math.random() * Math.PI * 2,
    honkAt: 0,
    smokeAt: 0,
  };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

/** Two body circles, front and back, so a long car turns against walls like a car. */
export function collideCar(city, car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const off = car.model.length * 0.26;
  const r = car.model.width * 0.58;
  const front = collideCircle(city, car.x + fx * off, car.y + fy * off, r);
  const back = collideCircle(city, car.x - fx * off, car.y - fy * off, r);
  car.x = (front.x + back.x) / 2;
  car.y = (front.y + back.y) / 2;
  const dx = front.x - back.x;
  const dy = front.y - back.y;
  if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
    const target = Math.atan2(dy, dx);
    let diff = target - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += diff * 0.35;
  }
}

/**
 * Advance one car. control is {throttle: -1..1, steer: -1..1, brake: bool}.
 * Returns the impact speed lost to walls this step (0 when the road was kind).
 */
export function updateCarPhysics(car, control, dt, city) {
  if (car.wrecked) {
    car.vx *= Math.max(0, 1 - 3 * dt);
    car.vy *= Math.max(0, 1 - 3 * dt);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return 0;
  }
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let forward = car.vx * fx + car.vy * fy;
  let lateral = -car.vx * fy + car.vy * fx;

  const steerAuthority = Math.min(1, Math.abs(forward) / 130 + 0.12);
  const turn = control.steer * car.model.grip * steerAuthority * (forward < -1 ? -1 : 1);
  car.angle += turn * dt * Math.min(1, Math.abs(forward) / 190 + 0.25);

  const nfx = Math.cos(car.angle);
  const nfy = Math.sin(car.angle);
  if (control.throttle > 0) forward += car.model.accel * control.throttle * dt;
  else if (control.throttle < 0) {
    if (forward > 12) forward -= car.model.accel * 1.5 * dt; // braking
    else forward += car.model.accel * 0.55 * control.throttle * dt; // reverse
  }
  if (control.brake) forward -= Math.sign(forward) * car.model.accel * 1.7 * dt;
  forward -= forward * 0.32 * dt; // drag
  if (forward > car.model.topSpeed) forward = car.model.topSpeed;
  if (forward < -car.model.topSpeed * 0.32) forward = -car.model.topSpeed * 0.32;
  if (Math.abs(forward) < 2 && !control.throttle) forward = 0;
  lateral *= Math.exp(-car.model.grip * 1.35 * dt);

  car.vx = nfx * forward - nfy * lateral;
  car.vy = nfy * forward + nfx * lateral;

  const before = Math.hypot(car.vx, car.vy);
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  collideCar(city, car);
  car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
  const after = Math.hypot(car.vx, car.vy);
  // A wall eats the velocity that pointed into it.
  const nfx2 = Math.cos(car.angle);
  const nfy2 = Math.sin(car.angle);
  const intoWall = before - after;
  if (intoWall > 30) {
    const f2 = car.vx * nfx2 + car.vy * nfy2;
    const l2 = -car.vx * nfy2 + car.vy * nfx2;
    car.vx = nfx2 * f2 * 0.4 - nfy2 * l2;
    car.vy = nfy2 * f2 * 0.4 + nfx2 * l2;
  }
  return intoWall;
}

function angleTo(from, x, y) {
  return Math.atan2(y - from.y, x - from.x);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The lane point on the segment from node A to node B at distance along it. */
function lanePoint(a, b, along) {
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  // Right-hand traffic: the lane sits to the driver's right of the centre line.
  const rx = -dy;
  const ry = dx;
  return {
    x: a.x + dx * along + rx * ROAD.laneOffset,
    y: a.y + dy * along + ry * ROAD.laneOffset,
  };
}

function pickNextNode(rng, from, at) {
  const ai = ROAD.avenuesX.indexOf(at.x);
  const si = ROAD.streetsY.indexOf(at.y);
  const neighbours = [];
  if (ai > 0) neighbours.push({ x: ROAD.avenuesX[ai - 1], y: at.y });
  if (ai < ROAD.avenuesX.length - 1) neighbours.push({ x: ROAD.avenuesX[ai + 1], y: at.y });
  if (si > 0) neighbours.push({ x: at.x, y: ROAD.streetsY[si - 1] });
  if (si < ROAD.streetsY.length - 1) neighbours.push({ x: at.x, y: ROAD.streetsY[si + 1] });
  const fresh = neighbours.filter((n) => !(from && n.x === from.x && n.y === from.y));
  const pool = fresh.length ? fresh : neighbours;
  return pool[Math.floor(rng() * pool.length)];
}

/** Traffic: follow the lanes, turn at intersections, brake for what is ahead. */
export function trafficThink(world, car, dt) {
  const rng = world.rng;
  if (!car.target) {
    const at = nearestIntersection(car.x, car.y);
    car.fromNode = at;
    car.target = pickNextNode(rng, null, at);
    car.x = lanePoint(at, car.target, 0).x;
    car.y = lanePoint(at, car.target, 0).y;
    car.angle = Math.atan2(car.target.y - at.y, car.target.x - at.x);
  }
  const segLen = Math.abs(car.target.x - car.fromNode.x) + Math.abs(car.target.y - car.fromNode.y);
  const along = segLen - Math.hypot(car.target.x - car.x, car.target.y - car.y);
  const look = lanePoint(car.fromNode, car.target, Math.min(segLen, along + 130));
  const distToNode = Math.hypot(car.target.x - car.x, car.target.y - car.y);
  if (distToNode < 56) {
    const next = pickNextNode(rng, car.fromNode, car.target);
    car.fromNode = car.target;
    car.target = next;
  }
  const desired = angleTo(car, look.x, look.y);
  const diff = angleDiff(desired, car.angle);
  let throttle = 0.62;
  let brake = false;
  if (Math.abs(diff) > 0.6) throttle = 0.3;

  // Brake for anything solid ahead: another car, the player's car, a person.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const ahead = (ox, oy) => {
    const relx = ox - car.x;
    const rely = oy - car.y;
    const f = relx * fx + rely * fy;
    const l = -relx * fy + rely * fx;
    return f > 6 && f < 92 && Math.abs(l) < 30 ? f : -1;
  };
  let blockedAt = -1;
  for (const other of world.state.cars) {
    if (other === car || other.sunk) continue;
    const f = ahead(other.x, other.y);
    if (f > 0 && (blockedAt < 0 || f < blockedAt)) blockedAt = f;
  }
  const p = world.state.player;
  if (!p.inCar) {
    const f = ahead(p.x, p.y);
    if (f > 0 && (blockedAt < 0 || f < blockedAt)) blockedAt = f;
  }
  for (const ped of world.state.peds) {
    if (ped.state === 'down') continue;
    const f = ahead(ped.x, ped.y);
    if (f > 0 && (blockedAt < 0 || f < blockedAt)) blockedAt = f;
  }
  if (blockedAt > 0) {
    throttle = blockedAt < 40 ? 0 : 0.15;
    brake = blockedAt < 52 && carSpeed(car) > 30;
  }
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.4)), brake };
}

/** Police: hunt the player. Direct steering, wall sliding, and an unstick routine. */
export function policeThink(world, car, dt) {
  const player = world.state.player;
  const tx = player.inCar ? player.inCar.x : player.x;
  const ty = player.inCar ? player.inCar.y : player.y;
  const dist = Math.hypot(tx - car.x, ty - car.y);
  let desired = angleTo(car, tx, ty);
  let throttle = 1;

  if (car.reverseTime > 0) {
    car.reverseTime -= dt;
    return { throttle: -1, steer: car.stuckSteer ?? 1, brake: false };
  }
  if (carSpeed(car) < 26 && dist > 90) {
    car.stuckTime += dt;
    if (car.stuckTime > 0.85) {
      car.stuckTime = 0;
      car.reverseTime = 0.5;
      car.stuckSteer = Math.random() < 0.5 ? -1 : 1;
      return { throttle: -1, steer: car.stuckSteer, brake: false };
    }
  } else car.stuckTime = Math.max(0, car.stuckTime - dt * 2);

  const diff = angleDiff(desired, car.angle);
  if (Math.abs(diff) > 1.9) throttle = -0.7; // turn around instead of orbiting
  else if (Math.abs(diff) > 0.7) throttle = 0.55;
  if (dist < 120) throttle = Math.min(throttle, 0.72); // close in, do not orbit at full speed
  return { throttle, steer: Math.max(-1, Math.min(1, diff * 2.6)), brake: false };
}

/** Spawn a traffic car on a road some distance from the player. */
export function spawnTrafficCar(world) {
  const rng = world.rng;
  const p = world.state.player;
  for (let tries = 0; tries < 8; tries += 1) {
    const point = randomRoadPoint(rng);
    const d = Math.hypot(point.x - p.x, point.y - p.y);
    if (d < 480 || d > 1250) continue;
    const modelIndex = Math.floor(rng() * 4);
    const model = CAR_MODELS[modelIndex];
    const car = createCar(point.x, point.y, 0, modelIndex, model.colors[Math.floor(rng() * model.colors.length)], 'traffic');
    car.driver = 'traffic';
    world.state.cars.push(car);
    return car;
  }
  return null;
}

/** Spawn a police interceptor on a road at spawn distance from the player. */
export function spawnPoliceCar(world) {
  const rng = world.rng;
  const p = world.state.player;
  const modelIndex = 5;
  for (let tries = 0; tries < 14; tries += 1) {
    // Aim a ring point around the player, then snap it onto the road grid.
    const a = rng() * Math.PI * 2;
    const dist = POLICE.spawnGap - 60 + rng() * 200;
    let x = p.x + Math.cos(a) * dist;
    let y = p.y + Math.sin(a) * dist;
    let bestAx = ROAD.avenuesX[0];
    for (const ax of ROAD.avenuesX) if (Math.abs(ax - x) < Math.abs(bestAx - x)) bestAx = ax;
    let bestSy = ROAD.streetsY[0];
    for (const sy of ROAD.streetsY) if (Math.abs(sy - y) < Math.abs(bestSy - y)) bestSy = sy;
    if (Math.abs(bestAx - x) < Math.abs(bestSy - y)) x = bestAx;
    else y = bestSy;
    x = Math.max(80, Math.min(WORLD.width - 80, x));
    y = Math.max(80, Math.min(WORLD.beachY - 60, y));
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < 430 || d > 1250) continue;
    const car = createCar(x, y, 0, modelIndex, CAR_MODELS[modelIndex].colors[0], 'police');
    car.driver = 'police';
    car.angle = Math.atan2(p.y - y, p.x - x);
    world.state.cars.push(car);
    return car;
  }
  return null;
}

/** Fill the car parks with stealable parked cars, in neat rows. */
export function spawnParkedCars(world) {
  const rng = world.rng;
  const city = world.city;
  for (const lot of city.lots) {
    for (let i = 0; i < 6; i += 1) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = lot.x + 56 + col * ((lot.w - 112) / 2);
      const y = lot.y + 58 + row * (lot.h - 116);
      const modelIndex = Math.floor(rng() * 5);
      const model = CAR_MODELS[modelIndex];
      const car = createCar(x, y, Math.PI / 2, modelIndex, model.colors[Math.floor(rng() * model.colors.length)], 'parked');
      world.state.cars.push(car);
    }
  }
}
