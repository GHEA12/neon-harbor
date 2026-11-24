// The screenshot scenes behind ?shot=start|chase|mission|drive (with &seed=N).
// Each builds the real world, puts Ivo in a real situation the rules allow,
// steps the simulation forward with scripted hands, and leaves the frame
// exactly as play would show it. The same seed gives the same frame.

import { STEP } from './config.js';
import { createCar } from './cars.js';
import { spawnPed } from './peds.js';
import { stepWorld } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function neutralInput() {
  return {
    held: { up: false, down: false, left: false, right: false, sprint: false },
    mouse: { x: 900, y: 300, down: false },
    moveX: () => 0,
    moveY: () => 0,
    takeActions: () => 0,
  };
}

function driveInput() {
  const input = neutralInput();
  input.held.up = true;
  return input;
}

function step(world, input, times) {
  const mouseWorld = { x: world.state.player.x + 220, y: world.state.player.y - 60 };
  for (let i = 0; i < times; i += 1) stepWorld(world, STEP, input, mouseWorld, 0);
}

function putPlayerInCar(world, modelIndex, color, x, y, angle) {
  const car = createCar(x, y, angle, modelIndex, color, 'parked');
  car.driver = 'player';
  car.everDriven = true;
  world.state.cars.push(car);
  world.state.player.inCar = car;
  world.state.player.x = x;
  world.state.player.y = y;
  return car;
}

/** Set `world` to the named scene and return the screen and camera focus for it. */
export function stageShot(name, world) {
  const state = world.state;
  const places = world.city.places;
  if (name === 'chase') {
    // Mid-errand, mid-pursuit: Ivo runs the crate south with the Precinct behind him.
    putPlayerInCar(world, 1, '#5b6ee1', 1856, 1230, Math.PI / 2);
    world.missions.index = 0;
    world.missions.objective = { text: 'Take the crate to Pier 3', x: places.pier3.x, y: places.pier3.y, radius: 85 };
    state.heat = 305;
    step(world, driveInput(), 300);
    return { screen: SCREEN_PLAY, focus: null };
  }
  if (name === 'mission') {
    // Gull Square: Pell cowers, one heavy is down, the other is squaring up.
    state.player.x = places.gullSquare.x - 60;
    state.player.y = places.gullSquare.y + 96;
    const pell = spawnPed(world, places.gullSquare.x + 30, places.gullSquare.y + 30, 'informant');
    pell.state = 'cower';
    const down = spawnPed(world, places.gullSquare.x + 66, places.gullSquare.y - 26, 'thug');
    down.state = 'down';
    down.hp = 0;
    const heavy = spawnPed(world, places.gullSquare.x + 96, places.gullSquare.y + 58, 'thug');
    heavy.state = 'fight';
    for (let i = 0; i < 6; i += 1) {
      const extra = spawnPed(world, places.gullSquare.x - 200 + i * 74, places.gullSquare.y - 150 + (i % 3) * 46, 'walker');
      extra.state = 'flee';
      extra.fleeTime = 3;
    }
    world.missions.index = 2;
    world.missions.objective = { text: 'Drop the Combine heavies (1/2)', x: places.gullSquare.x, y: places.gullSquare.y, radius: 0 };
    step(world, neutralInput(), 26);
    // A fresh tracer and muzzle bloom, caught by the camera.
    const p = state.player;
    p.angle = Math.atan2(heavy.y - p.y, heavy.x - p.x);
    world.fx.addTracer(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, heavy.x, heavy.y);
    world.fx.muzzle(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, p.angle);
    return { screen: SCREEN_PLAY, focus: null };
  }
  if (name === 'drive') {
    // Coast Road at speed, a Gull Cab fare on the clock.
    putPlayerInCar(world, 4, '#cfd6dd', 900, 3056, 0);
    world.missions.index = 4;
    world.missions.cabObjective = { text: 'Gull Cab: drop off the fare — 21s', x: 3392, y: 2880, radius: 78 };
    step(world, driveInput(), 150);
    return { screen: SCREEN_PLAY, focus: null };
  }
  // 'start': the title over a living city, focused on Gull Square's neon.
  step(world, neutralInput(), 200);
  return { screen: SCREEN_TITLE, focus: { x: places.gullSquare.x + 120, y: places.gullSquare.y + 60 } };
}
