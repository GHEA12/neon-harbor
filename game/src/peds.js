// The people of Kestrel Bay: evening walkers who mind their business, flee
// from gunfire and traffic, and — for the Combine — heavies who fight.
// A person is a small state machine: wander, flee, fight, cower, wait, down.

import { FOOT, PEDS } from './config.js';
import { collideCircle, isInWater, randomSidewalkPoint } from './city.js';
import { angleDiff } from './cars.js';

const SHIRTS = ['#e8e3d8', '#b5533c', '#3c6eb5', '#53b56e', '#b53c8a', '#d8a03c', '#7a7f8c', '#4fc3f7', '#e58bb1'];
let nextPedId = 1;

export function createPed(x, y, kind, rng) {
  return {
    id: nextPedId++,
    x, y, angle: rng() * Math.PI * 2,
    kx: 0, ky: 0,
    hp: kind === 'thug' ? 62 : 30,
    kind, // 'walker' | 'thug' | 'informant'
    hostile: kind === 'thug',
    state: kind === 'informant' ? 'wait' : 'wander',
    tx: x, ty: y,
    retarget: 0, fleeTime: 0, idleTime: 0,
    attackCd: 0, walkPhase: rng() * 6,
    shirt: kind === 'thug' ? '#23232e' : SHIRTS[Math.floor(rng() * SHIRTS.length)],
    downTime: 0,
  };
}

export function spawnPed(world, x, y, kind = 'walker') {
  const ped = createPed(x, y, kind, world.rng);
  world.state.peds.push(ped);
  return ped;
}

export function spawnAmbientPed(world) {
  const p = world.state.player;
  for (let tries = 0; tries < 6; tries += 1) {
    const point = randomSidewalkPoint(world.rng);
    const d = Math.hypot(point.x - p.x, point.y - p.y);
    if (d < PEDS.spawnGap - 160 || d > PEDS.spawnGap + 260) continue;
    return spawnPed(world, point.x, point.y);
  }
  return null;
}

export function damagePed(world, ped, dmg, fromAngle) {
  if (ped.state === 'down') return;
  ped.hp -= dmg;
  ped.kx += Math.cos(fromAngle) * 190;
  ped.ky += Math.sin(fromAngle) * 190;
  world.fx.burst(ped.x, ped.y, { count: 5, color: '#ff5f6d', speed: 130, life: 0.3, size: 2.5 });
  if (ped.hp <= 0) {
    ped.state = 'down';
    ped.downTime = 0;
    world.audio.hit();
    if (ped.kind === 'thug') world.state.stats.thugsDown += 1;
  } else if (ped.kind === 'walker') {
    ped.state = 'flee';
    ped.fleeTime = 3;
  } else if (ped.kind === 'thug') {
    ped.state = 'fight';
  }
}

function movePed(world, ped, dt, speed) {
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 4) ped.angle = Math.atan2(dy, dx);
  let vx = (dist > 4 ? Math.cos(ped.angle) * speed : 0) + ped.kx;
  let vy = (dist > 4 ? Math.sin(ped.angle) * speed : 0) + ped.ky;
  ped.kx *= Math.exp(-7 * dt);
  ped.ky *= Math.exp(-7 * dt);
  let nx = ped.x + vx * dt;
  let ny = ped.y + vy * dt;
  if (isInWater(world.city, nx, ny)) {
    nx = ped.x;
    ny = ped.y;
    ped.retarget = 0;
  }
  const resolved = collideCircle(world.city, nx, ny, 13);
  ped.x = resolved.x;
  ped.y = resolved.y;
  ped.walkPhase += dt * (Math.hypot(vx, vy) > 12 ? 11 : 0);
  return dist;
}

export function updatePeds(world, dt) {
  const state = world.state;
  const player = state.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const dangerFresh = state.time - state.danger.at < 3.2;

  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.state === 'down') {
      ped.downTime += dt;
      if (ped.downTime > 26) state.peds.splice(i, 1);
      continue;
    }
    // Despawn ambient walkers who fall far behind the player.
    if (ped.kind === 'walker' && Math.hypot(ped.x - px, ped.y - py) > PEDS.despawnGap) {
      state.peds.splice(i, 1);
      continue;
    }
    ped.attackCd = Math.max(0, ped.attackCd - dt);
    ped.retarget -= dt;

    if (ped.state === 'wander') {
      if (dangerFresh && Math.hypot(ped.x - state.danger.x, ped.y - state.danger.y) < 300) {
        ped.state = 'flee';
        ped.fleeTime = 2.6 + Math.random() * 1.4;
      } else {
        if (ped.idleTime > 0) {
          ped.idleTime -= dt;
        } else {
          const dist = movePed(world, ped, dt, 78);
          if (dist < 14 || ped.retarget <= 0) {
            if (Math.random() < 0.3) ped.idleTime = 1 + Math.random() * 2.4;
            const t = randomSidewalkPoint(world.rng);
            // Wander locally: blend the far target toward home ground.
            ped.tx = ped.x + (t.x - ped.x) * 0.24 + (Math.random() - 0.5) * 60;
            ped.ty = ped.y + (t.y - ped.y) * 0.24 + (Math.random() - 0.5) * 60;
            ped.retarget = 5 + Math.random() * 5;
          }
        }
        continue;
      }
    }
    if (ped.state === 'flee') {
      ped.fleeTime -= dt;
      const away = Math.atan2(ped.y - state.danger.y, ped.x - state.danger.x);
      ped.tx = ped.x + Math.cos(away) * 220;
      ped.ty = ped.y + Math.sin(away) * 220;
      movePed(world, ped, dt, 232);
      if (ped.fleeTime <= 0) ped.state = ped.kind === 'thug' ? 'fight' : 'wander';
      continue;
    }
    if (ped.state === 'fight') {
      if (player.inCar) {
        // A heavy with any sense runs from two tons of steel.
        ped.state = 'flee';
        ped.fleeTime = 1.6;
        state.danger = { x: px, y: py, at: state.time };
        continue;
      }
      ped.tx = px;
      ped.ty = py;
      const dist = Math.hypot(px - ped.x, py - ped.y);
      if (dist > 34) movePed(world, ped, dt, 196);
      else {
        ped.angle = Math.atan2(py - ped.y, px - ped.x);
        if (ped.attackCd <= 0) {
          ped.attackCd = 0.85;
          world.hurtPlayer(7, ped.angle);
          world.audio.melee();
          world.fx.burst(px, py, { count: 3, color: '#ffb340', speed: 90, life: 0.2, size: 2 });
        }
      }
      continue;
    }
    if (ped.state === 'cower') {
      continue; // stays put, hands up, until the world calms down
    }
    // 'wait' (the informant, a cab fare): stand, face the player when near.
    if (Math.hypot(px - ped.x, py - ped.y) < 190) {
      ped.angle = Math.atan2(py - ped.y, px - ped.x);
    }
  }
}
