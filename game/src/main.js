// Boot and the one loop for Neon Harbor. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between screens: title, play, paused, busted or
// wasted, and the ending at dawn.
//
// ?seed=N fixes the city's dice. ?shot=start|chase|mission|drive (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { STEP, VIEW, WORLD } from './config.js';
import { createWorld, respawnPlayer, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_ENDING, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createHud } from './hud.js';
import { loadSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

/** The camera: a VIEW-tall slice of the bay, centred on a focus, kept in the world. */
function computeCamera(focusX, focusY) {
  const scale = canvas.height / VIEW.height;
  const w = canvas.width / scale;
  const h = VIEW.height;
  let x = focusX - w / 2;
  let y = focusY - h / 2;
  x = Math.max(0, Math.min(Math.max(0, WORLD.width - w), x));
  y = Math.max(0, Math.min(WORLD.height - h, y));
  return { x, y, w, h, scale };
}

function runShot(name) {
  const world = createWorld(seed, null);
  const renderer = createRenderer(canvas, world.city);
  const hud = createHud(world.city);
  const scene = stageShot(name, world);
  const focus = scene.focus ?? world.state.player;
  const camera = computeCamera(focus.x, focus.y);
  let painted = 0;
  function paint() {
    renderer.drawScene(world, camera);
    if (scene.screen === SCREEN_PLAY) hud.drawHud(renderer.ctx, world, camera, { x: canvas.width * 0.62, y: canvas.height * 0.42 });
    else renderer.drawScreen(world, scene.screen, { hasSave: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let save = loadSave();
  let world = createWorld(seed, save);
  let renderer = createRenderer(canvas, world.city);
  let hud = createHud(world.city);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let titleTime = 0;

  function announce(message) {
    status.textContent = message;
  }

  function beginNight(fresh) {
    if (fresh) {
      clearSave();
      save = null;
      world = createWorld(Math.floor(Math.random() * 4294967296), null);
      renderer = createRenderer(canvas, world.city);
      hud = createHud(world.city);
    }
    world.audio.unlock();
    world.missions.start();
    world.saveProgress();
    screen = SCREEN_PLAY;
    announce('Playing. One night in Kestrel Bay.');
  }

  // The title screen's letter keys (C continue, N new night) are not action
  // flags, so the title watches them directly.
  let titleKey = '';
  window.addEventListener('keydown', (event) => {
    if (screen === SCREEN_TITLE) titleKey = event.code;
    if (event.code === 'Enter' || event.code === 'Space') world.audio.unlock();
  });

  function handleActions() {
    const actions = input.takeActions();
    if (screen === SCREEN_TITLE) {
      if (save && titleKey === 'KeyN') {
        titleKey = '';
        beginNight(true);
      } else if (save && titleKey === 'KeyC') {
        titleKey = '';
        beginNight(false);
      } else if (actions & ACTION_CONFIRM) {
        titleKey = '';
        beginNight(false);
      }
      return actions;
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (screen === SCREEN_OVER && (actions & ACTION_CONFIRM)) {
      respawnPlayer(world);
      screen = SCREEN_PLAY;
      announce('Back on the street.');
    } else if (screen === SCREEN_ENDING && (actions & ACTION_CONFIRM)) {
      world.state.ending = false;
      screen = SCREEN_PLAY;
      announce('Free roam.');
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    const actions = handleActions();

    const player = world.state.player;
    let focus = { x: player.x, y: player.y };
    if (screen === SCREEN_TITLE) {
      titleTime += dt;
      // A slow drift over Gull Square and the market while the city lives.
      focus = {
        x: world.city.places.gullSquare.x + Math.sin(titleTime * 0.07) * 420,
        y: world.city.places.gullSquare.y + Math.cos(titleTime * 0.05) * 260,
      };
      while (accumulator >= STEP) {
        stepWorld(world, STEP, neutralTitleInput(), { x: player.x + 200, y: player.y }, 0);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      const cameraPre = computeCamera(player.x, player.y);
      const mouseWorld = {
        x: cameraPre.x + input.mouse.x / cameraPre.scale,
        y: cameraPre.y + input.mouse.y / cameraPre.scale,
      };
      let firstStep = true;
      while (accumulator >= STEP) {
        stepWorld(world, STEP, input, mouseWorld, firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
        if (world.state.over) {
          screen = SCREEN_OVER;
          announce(world.state.over === 'busted' ? 'Busted.' : 'Wasted.');
          break;
        }
        if (world.state.ending) {
          screen = SCREEN_ENDING;
          announce('The Gullwife sails again.');
          break;
        }
      }
    } else {
      accumulator = 0;
    }

    const camera = computeCamera(focus.x, focus.y);
    // Screen shake rides on top of the camera.
    const shake = world.fx.shakeAmount();
    if (shake > 0.2) {
      camera.x += (Math.random() - 0.5) * shake;
      camera.y += (Math.random() - 0.5) * shake;
    }
    renderer.drawScene(world, camera);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      hud.drawHud(renderer.ctx, world, camera, input.mouse);
    }
    if (screen !== SCREEN_PLAY) {
      renderer.drawScreen(world, screen, { hasSave: !!save });
    }
    world.audio.update({
      dt,
      driving: screen === SCREEN_PLAY && !!player.inCar,
      speedRatio: player.inCar ? Math.min(1, Math.hypot(player.inCar.vx, player.inCar.vy) / player.inCar.model.topSpeed) : 0,
      sirenLevel: world.state.sirenLevel,
      musicOn: screen !== SCREEN_PAUSED,
    });
  }

  function neutralTitleInput() {
    return {
      held: { up: false, down: false, left: false, right: false, sprint: false },
      mouse: { x: 0, y: 0, down: false },
      moveX: () => 0,
      moveY: () => 0,
      takeActions: () => 0,
    };
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Harbor. One night to buy back the Gullwife.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
