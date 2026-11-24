// The world of Neon Harbor: one state object and the step that advances it.
// Systems live in their own files; this file owns the rules between them —
// what counts as a crime, how heat rises and cools, when the Precinct busts
// Ivo, and where he wakes up afterwards.

import { HEAT, POLICE, TRAFFIC, PEDS } from './config.js';
import { generateCity, isInWater, lineBlocked } from './city.js';
import { createRandom } from './random.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createPlayer, hurtPlayer, tryInteract, updatePlayerDriving, updatePlayerOnFoot } from './player.js';
import { carSpeed, policeThink, spawnParkedCars, spawnPoliceCar, spawnTrafficCar, trafficThink, updateCarPhysics } from './cars.js';
import { spawnAmbientPed, updatePeds } from './peds.js';
import { createMissions } from './missions.js';
import { storeSave } from './save.js';
import { ACTION_INTERACT, ACTION_MELEE } from './input.js';

export function createWorld(seed, save) {
  const rng = createRandom(seed);
  const city = generateCity(createRandom(seed ^ 0x9e3779b9));
  const world = {
    rng,
    city,
    fx: createEffects(),
    audio: createAudio(),
    state: null,
    missions: null,
  };
  const player = createPlayer(city.places.flat.x, city.places.flat.y);
  if (save) {
    player.cash = save.cash;
  }
  world.state = {
    time: 0,
    player,
    cars: [],
    peds: [],
    heat: 0,
    heatFloor: 0,
    stars: 0,
    lastCrimeAt: -99,
    crimeCd: {},
    bust: 0,
    danger: { x: 0, y: 0, at: -99 },
    events: [],
    toast: null,
    over: null, // 'busted' | 'wasted'
    ending: false,
    hurtFlash: 0,
    policeTimer: 1.2,
    trafficTimer: 0,
    pedTimer: 0,
    sirenLevel: 0,
    stats: {
      carsStolen: 0, thugsDown: 0, fares: 0,
      totalEarned: save ? save.totalEarned : 0,
      timePlayed: 0,
    },
  };
  spawnParkedCars(world);
  world.missions = createMissions(world, save ? save.missionIndex : 0);
  if (save && save.storyDone) world.missions.index = 4;

  world.hurtPlayer = (dmg, angle) => hurtPlayer(world, dmg, angle);

  world.showToast = (speaker, text, seconds = 5) => {
    world.state.toast = { speaker, text, until: world.state.time + seconds };
  };

  world.saveProgress = () => {
    storeSave({
      cash: world.state.player.cash,
      missionIndex: world.missions.index,
      storyDone: world.missions.index >= 4,
      totalEarned: world.state.stats.totalEarned,
    });
  };

  world.damageCar = (car, dmg) => {
    if (car.wrecked) return;
    car.hp -= dmg;
    if (car.hp <= 0) {
      car.hp = 0;
      car.wrecked = true;
      world.fx.burst(car.x, car.y, { count: 26, color: '#ff9a3c', speed: 260, life: 0.6, size: 4 });
      world.fx.burst(car.x, car.y, { count: 14, color: '#5a5f73', speed: 120, life: 0.9, size: 6 });
      world.fx.addShake(6);
      if (world.state.player.inCar === car) hurtPlayer(world, 9, car.angle);
    }
  };

  world.commitCrime = (type, x, y) => {
    const state = world.state;
    const cd = { shooting: 0.4, assault: 0.5, carRam: 0.8, carTheft: 0.3, pedHit: 0.3, alarm: 0.5 }[type] ?? 0.3;
    if (state.time - (state.crimeCd[type] ?? -99) < cd) return;
    state.crimeCd[type] = state.time;
    const witnessedByCop = state.cars.some((c) => c.kind === 'police' && !c.wrecked
      && Math.hypot(c.x - x, c.y - y) < 640 && !lineBlocked(city, c.x, c.y, x, y));
    const witnessedByPed = state.peds.some((p) => p.state !== 'down'
      && Math.hypot(p.x - x, p.y - y) < 300);
    let add = 0;
    switch (type) {
      case 'carTheft': add = witnessedByCop || witnessedByPed ? HEAT.carTheft : 0; break;
      case 'alarm': add = 60; break;
      case 'assault': add = witnessedByCop ? HEAT.assault : witnessedByPed ? 30 : 8; break;
      case 'shooting': add = witnessedByCop || witnessedByPed ? HEAT.shooting : 0; break;
      case 'pedHit': add = HEAT.pedHit; break;
      case 'carRam': add = witnessedByCop || witnessedByPed ? HEAT.carRam : 0; break;
      default: add = 0;
    }
    if (add > 0) {
      state.heat = Math.min(HEAT.perStar * HEAT.maxStars, state.heat + add);
      state.lastCrimeAt = state.time;
    }
  };

  return world;
}

/** Where Ivo ends up after an arrest or a hospital visit, poorer and cooler. */
export function respawnPlayer(world) {
  const state = world.state;
  const player = state.player;
  const wasBusted = state.over === 'busted';
  const fee = wasBusted ? Math.min(player.cash, 140) : Math.min(player.cash, 90);
  player.cash -= fee;
  if (player.inCar) {
    player.inCar.driver = null;
    player.inCar = null;
  }
  const place = wasBusted ? world.city.places.precinct : world.city.places.hospital;
  player.x = place.x;
  player.y = place.y;
  player.hp = 100;
  player.dead = false;
  state.heat = 0;
  state.bust = 0;
  state.over = null;
  // The Precinct keeps its cars; the street forgets the chase.
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  world.showToast(
    wasBusted ? 'Harbor Precinct' : 'St Kestrel Hospital',
    wasBusted ? `Booked, fined $${fee}, and let go at shift change. The Gullwife will not wait forever.` : `Patched up for $${fee}. The night is still young, Ivo.`,
    6,
  );
  world.saveProgress();
}

function policeDesired(state) {
  const heat = Math.max(state.heat, state.heatFloor);
  if (heat <= 0) return 0;
  return Math.min(HEAT.maxStars, Math.ceil(heat / HEAT.perStar));
}

export function stepWorld(world, dt, input, mouseWorld, actions) {
  const state = world.state;
  const city = world.city;
  const player = state.player;
  state.time += dt;
  state.stats.timePlayed += dt;
  state.hurtFlash = Math.max(0, state.hurtFlash - dt * 1.4);
  state.events.length = 0;

  if (state.over) {
    world.fx.update(dt);
    return;
  }

  // The player.
  if (actions & ACTION_INTERACT) tryInteract(world);
  if (player.inCar) updatePlayerDriving(world, dt, input);
  else updatePlayerOnFoot(world, dt, input, mouseWorld, actions & ACTION_MELEE);
  for (const evt of state.events) world.missions.onEvent(evt);

  // Health creeps back when the night leaves Ivo alone.
  if (!player.inCar && state.time - player.lastHurtAt > 6 && player.hp > 0) {
    player.hp = Math.min(100, player.hp + 9 * dt);
  }

  // Traffic: keep the avenues alive, retire the far away.
  state.trafficTimer -= dt;
  const trafficCount = state.cars.filter((c) => c.kind === 'traffic').length;
  if (state.trafficTimer <= 0 && trafficCount < TRAFFIC.maxCars) {
    spawnTrafficCar(world);
    state.trafficTimer = 0.7;
  }
  state.pedTimer -= dt;
  if (state.pedTimer <= 0 && state.peds.filter((p) => p.kind === 'walker').length < PEDS.max) {
    spawnAmbientPed(world);
    state.pedTimer = 0.8;
  }

  // Wanted level and the Precinct's answer to it.
  const desired = policeDesired(state);
  state.stars = desired;
  state.policeTimer -= dt;
  const policeNow = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
  if (desired > 0 && policeNow.length < desired && state.policeTimer <= 0) {
    spawnPoliceCar(world);
    state.policeTimer = POLICE.spawnEvery;
  }
  // Heat cools when nobody is watching.
  const nearestCop = nearestPoliceDistance(world);
  state.sirenLevel = nearestCop < 700 ? 1 - nearestCop / 800 : 0;
  if (state.time - state.lastCrimeAt > HEAT.decayDelay && nearestCop > 470) {
    state.heat = Math.max(0, state.heat - HEAT.decayRate * dt);
  }

  // Drive every car that has a driver.
  for (const car of state.cars) {
    if (car.sunk) continue;
    if (car.driver === 'traffic') {
      const impact = updateCarPhysics(car, trafficThink(world, car, dt), dt, city);
      if (impact > 210) world.damageCar(car, impact * 0.04);
    } else if (car.driver === 'police') {
      if (desired === 0) {
        updateCarPhysics(car, trafficThink(world, car, dt), dt, city);
      } else {
        const impact = updateCarPhysics(car, policeThink(world, car, dt), dt, city);
        if (impact > 240) world.damageCar(car, impact * 0.045);
      }
    } else if (car.driver === null && !car.wrecked) {
      updateCarPhysics(car, { throttle: 0, steer: 0, brake: false }, dt, city);
    }
    // A damaged car smokes; a dying one burns.
    if (car.hp < 46 && !car.wrecked && Math.random() < dt * 6) world.fx.smoke(car.x, car.y, car.hp < 20);
    // Cars that end up in the harbour sink.
    if (isInWater(city, car.x, car.y) && !car.sunk) {
      car.sunk = true;
      car.wrecked = true;
      world.fx.splash(car.x, car.y);
      if (player.inCar === car) {
        player.inCar = null;
        car.driver = null;
        let ly = car.y;
        while (isInWater(city, car.x, ly) && ly > 0) ly -= 20;
        player.x = car.x;
        player.y = ly - 24;
        hurtPlayer(world, 16, -Math.PI / 2);
        world.showToast('Kestrel Bay', 'The harbour takes the car. It gives back the driver, this once.', 5);
      }
    }
  }
  // Retire sunk and distant cars.
  state.cars = state.cars.filter((car) => {
    if (car.sunk) return false;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if ((car.kind === 'traffic' || car.kind === 'police') && d > POLICE.despawnGap && car.driver !== 'player') return false;
    return true;
  });

  collideCarsAndPeds(world, dt);
  updatePeds(world, dt);

  // The bust meter: a close Interceptor and a slow Ivo is an arrest.
  const playerSpeed = player.inCar ? carSpeed(player.inCar) : (input.moveX() || input.moveY() ? 200 : 0);
  let busting = false;
  if (desired > 0) {
    for (const cop of policeNow) {
      const d = Math.hypot(cop.x - player.x, cop.y - player.y);
      if (d < HEAT.bustRange && playerSpeed < 42) {
        busting = true;
        break;
      }
    }
  }
  state.bust = Math.max(0, Math.min(1, state.bust + (busting ? HEAT.bustFill : -HEAT.bustDrain) * dt));
  if (state.bust >= 1) {
    state.over = 'busted';
    world.audio.fail();
  }

  world.missions.update(dt);
  world.fx.update(dt);
}

function nearestPoliceDistance(world) {
  const p = world.state.player;
  let best = Infinity;
  for (const car of world.state.cars) {
    if (car.kind !== 'police' || car.wrecked) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < best) best = d;
  }
  return best;
}

/** Cars meet cars, and cars meet people, at speed. */
function collideCarsAndPeds(world, dt) {
  const state = world.state;
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.sunk) continue;
    const aSpeed = carSpeed(a);
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.sunk) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = (a.model.length + b.model.length) * 0.31;
      const d2 = dx * dx + dy * dy;
      if (d2 > minD * minD || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const push = (minD - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const impulse = -rel * 0.62;
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
        if (rel < -120) {
          world.damageCar(a, -rel * 0.05);
          world.damageCar(b, -rel * 0.05);
          if (a.driver === 'player' || b.driver === 'player') {
            world.audio.bump(Math.min(1, -rel / 300));
            world.fx.addShake(Math.min(7, -rel / 45));
            const other = a.driver === 'player' ? b : a;
            if (other.kind === 'police' || other.driver === 'traffic') world.commitCrime('carRam', state.player.x, state.player.y);
          }
        }
      }
    }
    // People versus this car.
    if (aSpeed < 34) continue;
    for (const ped of state.peds) {
      if (ped.state === 'down' || ped.state === 'passenger') continue;
      const d = Math.hypot(ped.x - a.x, ped.y - a.y);
      if (d > a.model.length * 0.46) continue;
      if (aSpeed > 165) {
        ped.hp = 0;
        ped.state = 'down';
        ped.downTime = 0;
        world.fx.burst(ped.x, ped.y, { count: 10, color: '#ff5f6d', speed: 190, life: 0.4, size: 3 });
        a.vx *= 0.84;
        a.vy *= 0.84;
        if (a.driver === 'player') {
          if (!ped.hostile) world.commitCrime('pedHit', ped.x, ped.y);
          world.audio.bump(0.7);
          world.fx.addShake(5);
        }
      } else {
        // A nudge: the person stumbles away, furious and upright.
        const away = Math.atan2(ped.y - a.y, ped.x - a.x);
        ped.kx += Math.cos(away) * 260 + a.vx * 0.4;
        ped.ky += Math.sin(away) * 260 + a.vy * 0.4;
        ped.state = 'flee';
        ped.fleeTime = 2.2;
        state.danger = { x: a.x, y: a.y, at: state.time };
      }
    }
  }
}
