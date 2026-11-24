// Ivo Lark: the player. On foot he walks, sprints, swings and shoots toward
// the mouse; in a car he drives it with the same keys. This file owns his
// body, his gun and the door handle: entering and stealing cars lives here.

import { FOOT } from './config.js';
import { collideCircle, isInWater } from './city.js';
import { angleDiff, carSpeed, updateCarPhysics } from './cars.js';
import { damagePed, spawnPed } from './peds.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: FOOT.health,
    cash: 40,
    inCar: null,
    walkPhase: 0,
    meleeCd: 0, gunCd: 0,
    lastHurtAt: -99,
    dead: false,
  };
}

/** Damage to Ivo himself, with a knock direction for the effects. */
export function hurtPlayer(world, dmg, fromAngle) {
  const player = world.state.player;
  if (player.dead || world.state.over) return;
  player.hp -= dmg;
  player.lastHurtAt = world.state.time;
  world.state.hurtFlash = 0.55;
  world.audio.hurt();
  world.fx.burst(player.x, player.y, { count: 4, color: '#ff5f6d', speed: 110, life: 0.25, size: 2.5 });
  if (player.hp <= 0) {
    player.hp = 0;
    world.state.over = 'wasted';
    world.audio.fail();
  }
}

export function updatePlayerOnFoot(world, dt, input, mouseWorld, actions) {
  const state = world.state;
  const player = state.player;
  const city = world.city;

  player.meleeCd = Math.max(0, player.meleeCd - dt);
  player.gunCd = Math.max(0, player.gunCd - dt);
  player.angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x);

  // Walking.
  const mx = input.moveX();
  const my = input.moveY();
  if (mx || my) {
    const len = Math.hypot(mx, my);
    const speed = input.held.sprint ? FOOT.sprintSpeed : FOOT.walkSpeed;
    let nx = player.x + (mx / len) * speed * dt;
    let ny = player.y + (my / len) * speed * dt;
    if (isInWater(city, nx, ny)) {
      nx = player.x;
      ny = player.y;
    }
    const resolved = collideCircle(city, nx, ny, FOOT.radius);
    player.x = resolved.x;
    player.y = resolved.y;
    player.walkPhase += dt * (speed / 22);
  }

  // Shooting: a held trigger, a hitscan ray, the nearest thing it meets.
  if (input.mouse.down && player.gunCd <= 0 && !state.over) {
    player.gunCd = FOOT.gunCooldown;
    fireGun(world, mouseWorld);
  }

  // A swing of the fist.
  if ((actions & 8) && player.meleeCd <= 0) {
    player.meleeCd = FOOT.meleeCooldown;
    swingFist(world);
  }
}

function fireGun(world, mouseWorld) {
  const state = world.state;
  const player = state.player;
  const angle = Math.atan2(mouseWorld.y - player.y, mouseWorld.x - player.x)
    + (Math.random() - 0.5) * 2 * FOOT.gunSpread;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ox = player.x + dx * 22;
  const oy = player.y + dy * 22;
  world.audio.shot();
  world.fx.muzzle(ox, oy, angle);
  world.fx.addShake(1.4);
  state.danger = { x: player.x, y: player.y, at: state.time };
  world.commitCrime('shooting', player.x, player.y);

  // Nearest target along the ray: a person, a car, or a wall.
  let bestT = FOOT.gunRange;
  let hitPed = null;
  let hitCar = null;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const t = (ped.x - ox) * dx + (ped.y - oy) * dy;
    if (t < 0 || t > bestT) continue;
    const perp = Math.abs((ped.x - ox) * -dy + (ped.y - oy) * dx);
    if (perp < 17) {
      bestT = t;
      hitPed = ped;
      hitCar = null;
    }
  }
  for (const car of state.cars) {
    if (car.sunk) continue;
    const t = (car.x - ox) * dx + (car.y - oy) * dy;
    if (t < 0 || t > bestT) continue;
    const perp = Math.abs((car.x - ox) * -dy + (car.y - oy) * dx);
    if (perp < car.model.length * 0.44) {
      bestT = t;
      hitCar = car;
      hitPed = null;
    }
  }
  // Walls stop bullets: step the ray until it enters a building.
  const steps = Math.floor(bestT / 26);
  for (let i = 1; i <= steps; i += 1) {
    const x = ox + dx * i * 26;
    const y = oy + dy * i * 26;
    let inWall = false;
    for (const b of world.city.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        inWall = true;
        break;
      }
    }
    if (inWall) {
      bestT = i * 26;
      hitPed = null;
      hitCar = null;
      break;
    }
  }
  const hx = ox + dx * bestT;
  const hy = oy + dy * bestT;
  world.fx.addTracer(ox, oy, hx, hy);
  if (hitPed) {
    damagePed(world, hitPed, FOOT.gunDamage, angle);
    if (!hitPed.hostile && hitPed.state !== 'down') world.commitCrime('assault', player.x, player.y);
    if (hitPed.state === 'down' && !hitPed.hostile) world.commitCrime('assault', player.x, player.y);
  } else if (hitCar) {
    world.damageCar(hitCar, 11);
    world.fx.burst(hx, hy, { count: 6, color: '#ffd76a', speed: 170, life: 0.25, size: 2.5 });
    if (hitCar.kind === 'police') world.commitCrime('assault', player.x, player.y);
  } else {
    world.fx.burst(hx, hy, { count: 3, color: '#c9d4ff', speed: 90, life: 0.2, size: 2 });
  }
}

function swingFist(world) {
  const state = world.state;
  const player = state.player;
  world.audio.melee();
  let struck = false;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = Math.hypot(ped.x - player.x, ped.y - player.y);
    if (d > FOOT.meleeRange) continue;
    const to = Math.atan2(ped.y - player.y, ped.x - player.x);
    if (Math.abs(angleDiff(to, player.angle)) > 1.05) continue;
    damagePed(world, ped, FOOT.meleeDamage, to);
    if (!ped.hostile) world.commitCrime('assault', player.x, player.y);
    struck = true;
  }
  if (!struck) {
    // Swinging at a car dents it and rings.
    for (const car of state.cars) {
      if (Math.hypot(car.x - player.x, car.y - player.y) < car.model.length * 0.5 + 26) {
        world.damageCar(car, 5);
        world.audio.bump(0.35);
        world.fx.burst(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30, { count: 4, color: '#ffd76a', speed: 120, life: 0.2, size: 2 });
        break;
      }
    }
  }
}

/** E pressed: climb into the nearest car, or out of the current one. */
export function tryInteract(world) {
  const state = world.state;
  const player = state.player;
  if (player.inCar) {
    const car = player.inCar;
    car.driver = null;
    player.inCar = null;
    const side = car.angle + Math.PI / 2;
    let nx = car.x + Math.cos(side) * (car.model.width / 2 + 22);
    let ny = car.y + Math.sin(side) * (car.model.width / 2 + 22);
    if (isInWater(world.city, nx, ny)) {
      nx = car.x - Math.cos(side) * (car.model.width / 2 + 22);
      ny = car.y - Math.sin(side) * (car.model.width / 2 + 22);
    }
    const resolved = collideCircle(world.city, nx, ny, FOOT.radius);
    player.x = resolved.x;
    player.y = resolved.y;
    world.audio.door();
    state.events.push({ type: 'exitCar', car });
    return;
  }
  let best = null;
  let bestD = 96;
  for (const car of state.cars) {
    if (car.sunk || car.wrecked) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y) - car.model.length * 0.3;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    // Yank the driver out: they become a very startled pedestrian.
    const driver = spawnPed(world, best.x + 20, best.y + 10, 'walker');
    driver.state = 'flee';
    driver.fleeTime = 3.4;
    state.danger = { x: best.x, y: best.y, at: state.time };
    world.commitCrime('carTheft', best.x, best.y);
    state.stats.carsStolen += 1;
  } else if (best.driver === 'police') {
    return; // An occupied Interceptor stays the Precinct's.
  } else if (best.kind === 'parked' && !best.everDriven) {
    world.commitCrime('carTheft', best.x, best.y);
    state.stats.carsStolen += 1;
    if (Math.random() < 0.3) {
      world.audio.sirenBlip();
      world.commitCrime('alarm', best.x, best.y);
      world.fx.addText(best.x, best.y - 40, 'ALARM', '#ffb340');
    }
  }
  best.driver = 'player';
  best.everDriven = true;
  player.inCar = best;
  player.x = best.x;
  player.y = best.y;
  world.audio.door();
  state.events.push({ type: 'enterCar', car: best });
}

export function updatePlayerDriving(world, dt, input) {
  const state = world.state;
  const player = state.player;
  const car = player.inCar;
  if (!car) return;
  const control = {
    throttle: input.held.up ? 1 : input.held.down ? -1 : 0,
    steer: input.moveX(),
    brake: false,
  };
  const impact = updateCarPhysics(car, control, dt, world.city);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;

  // Tyres complain: skid marks and smoke when the car slides or spins up.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const lateral = Math.abs(-car.vx * fy + car.vy * fx);
  const speed = carSpeed(car);
  const rearX = car.x - fx * car.model.length * 0.32;
  const rearY = car.y - fy * car.model.length * 0.32;
  const sideX = -fy * car.model.width * 0.4;
  const sideY = fx * car.model.width * 0.4;
  if ((lateral > 95 && speed > 130) || (control.throttle > 0 && speed < 40 && lateral > 30)) {
    world.fx.addSkid(rearX + sideX, rearY + sideY, car.angle, Math.min(1, lateral / 200));
    world.fx.addSkid(rearX - sideX, rearY - sideY, car.angle, Math.min(1, lateral / 200));
    if (Math.random() < 0.3) world.fx.smoke(rearX, rearY);
  }
  if (impact > 130) {
    world.damageCar(car, impact * 0.055);
    world.audio.bump(Math.min(1, impact / 260));
    world.fx.addShake(Math.min(8, impact / 40));
    world.fx.burst(car.x + fx * car.model.length * 0.4, car.y + fy * car.model.length * 0.4, { count: 8, color: '#ffd76a', speed: 180, life: 0.3, size: 3 });
    if (impact > 300) hurtPlayer(world, 5, car.angle);
  }
  if (car.wrecked) {
    world.fx.addText(car.x, car.y - 44, 'WRECKED', '#ff4f6d');
  }
}
