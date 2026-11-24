// Drawing Neon Harbor. The still city — roads, roofs, neon signs, piers — is
// baked once into a full-world canvas; each frame paints the animated water,
// that layer, then everything that moves: skid marks, cars, people, Ivo,
// light and weather of the moment. Screens (title, pause, busted, wasted,
// the ending) are drawn over the world in screen space.

import { FONT, NEON_SIGNS, PALETTE, STORY, WORLD, ROAD } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_ENDING = 'ending';

const ROOF_TONES = ['#2c3049', '#332f4d', '#28324a', '#372f42', '#2a2f3e', '#313a52'];

export function createRenderer(canvas, city) {
  const ctx = canvas.getContext('2d');
  const staticLayer = buildStaticLayer(city);

  function drawScene(world, camera) {
    const state = world.state;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(camera.scale, 0, 0, camera.scale, -camera.x * camera.scale, -camera.y * camera.scale);
    drawWater(state.time, camera);
    ctx.drawImage(staticLayer, camera.x, camera.y, camera.w, camera.h, camera.x, camera.y, camera.w, camera.h);
    drawSkids(world);
    drawObjectiveBeacon(world, world.missions.objective, PALETTE.objective);
    drawObjectiveBeacon(world, world.missions.cabObjective, PALETTE.cabYellow);
    drawCarLights(world, camera);
    for (const car of state.cars) if (!car.sunk) drawCar(world, car);
    for (const ped of state.peds) drawPed(ped);
    if (!state.player.inCar) drawPlayer(world);
    drawEffects(world);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (state.hurtFlash > 0) {
      ctx.fillStyle = `rgba(200, 30, 50, ${state.hurtFlash * 0.28})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawWater(time, camera) {
    const y0 = WORLD.waterY;
    if (camera.y + camera.h < y0) return;
    const grad = ctx.createLinearGradient(0, y0, 0, WORLD.height);
    grad.addColorStop(0, PALETTE.waterShallow);
    grad.addColorStop(0.25, '#083049');
    grad.addColorStop(1, PALETTE.waterDeep);
    ctx.fillStyle = grad;
    ctx.fillRect(camera.x, y0, camera.w, WORLD.height - y0);
    // Sparkle: short bright dashes that drift with a slow sine.
    ctx.lineWidth = 2;
    const rng = createRandom(777);
    for (let i = 0; i < 130; i += 1) {
      const x = rng() * WORLD.width;
      const y = y0 + 20 + rng() * (WORLD.height - y0 - 40);
      if (x < camera.x - 40 || x > camera.x + camera.w + 40 || y < camera.y - 20 || y > camera.y + camera.h + 20) continue;
      const tw = 0.5 + 0.5 * Math.sin(time * 1.7 + i * 1.93);
      ctx.strokeStyle = `rgba(127, 231, 255, ${0.10 + tw * 0.22})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14 + tw * 16, y);
      ctx.stroke();
    }
    // Moon glitter path down the middle of the bay.
    ctx.fillStyle = 'rgba(190, 240, 255, 0.05)';
    ctx.fillRect(2260, y0, 210, WORLD.height - y0);
  }

  function drawSkids(world) {
    for (const skid of world.fx.skids) {
      ctx.save();
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.fillStyle = `rgba(8, 8, 14, ${0.34 * skid.strength * Math.min(1, skid.life / 3)})`;
      ctx.fillRect(-2.4, -7, 4.8, 14);
      ctx.restore();
    }
  }

  function drawObjectiveBeacon(world, objective, color) {
    if (!objective) return;
    const t = world.state.time;
    const pulse = 0.6 + 0.4 * Math.sin(t * 4.2);
    const grad = ctx.createLinearGradient(0, objective.y - 340, 0, objective.y);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, color);
    ctx.save();
    ctx.globalAlpha = 0.16 + pulse * 0.1;
    ctx.fillStyle = grad;
    ctx.fillRect(objective.x - 13, objective.y - 340, 26, 340);
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(objective.x, objective.y, 30 + pulse * 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawCarLights(world, camera) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const car of world.state.cars) {
      if (car.sunk || car.wrecked) continue;
      const dx = car.x - (camera.x + camera.w / 2);
      const dy = car.y - (camera.y + camera.h / 2);
      if (dx * dx + dy * dy > 900 * 900) continue;
      if (car.kind === 'police' && car.driver) {
        const phase = Math.sin(world.state.time * 11 + car.sirenPhase) > 0;
        const color = phase ? PALETTE.policeLightA : PALETTE.policeLightB;
        const grad = ctx.createRadialGradient(car.x, car.y, 4, car.x, car.y, 120);
        grad.addColorStop(0, color + '55');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.fillRect(car.x - 120, car.y - 120, 240, 240);
      }
      if (car.driver) {
        // Headlight cones.
        const fx = Math.cos(car.angle);
        const fy = Math.sin(car.angle);
        const hx = car.x + fx * car.model.length * 0.5;
        const hy = car.y + fy * car.model.length * 0.5;
        const grad = ctx.createRadialGradient(hx, hy, 6, hx, hy, 175);
        grad.addColorStop(0, 'rgba(255, 240, 190, 0.20)');
        grad.addColorStop(1, 'rgba(255, 240, 190, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.arc(hx, hy, 175, car.angle - 0.36, car.angle + 0.36);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawCar(world, car) {
    const { model } = car;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = model.length;
    const W = model.width;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.roundRect(-L / 2 + 3, -W / 2 + 5, L, W, 9);
    ctx.fill();
    // Body.
    ctx.fillStyle = car.wrecked ? shade(car.color, 0.45) : car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 9);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#14161f';
      ctx.fillRect(-L * 0.16, -W / 2, L * 0.34, W);
      ctx.fillStyle = '#e8ecf2';
      ctx.fillRect(-L / 2, -W / 2, L * 0.2, W);
      ctx.fillRect(L * 0.22, -W / 2, L * 0.28, W);
    }
    // Cabin and glass.
    ctx.fillStyle = 'rgba(16, 22, 38, 0.92)';
    ctx.beginPath();
    ctx.roundRect(-L * 0.14, -W * 0.4, L * 0.4, W * 0.8, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(140, 200, 255, 0.5)';
    ctx.fillRect(L * 0.2, -W * 0.36, L * 0.07, W * 0.72);
    // Headlights and tail lights.
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(L / 2 - 3, -W * 0.34, 3.4, 6);
    ctx.fillRect(L / 2 - 3, W * 0.34 - 6, 3.4, 6);
    ctx.fillStyle = '#ff4455';
    ctx.fillRect(-L / 2, -W * 0.34, 3, 6);
    ctx.fillRect(-L / 2, W * 0.34 - 6, 3, 6);
    if (car.kind === 'police') {
      const phase = Math.sin(world.state.time * 11 + car.sirenPhase) > 0;
      ctx.fillStyle = phase ? PALETTE.policeLightA : PALETTE.policeLightB;
      ctx.fillRect(-7, -W * 0.3, 14, 6);
      ctx.fillStyle = phase ? PALETTE.policeLightB : PALETTE.policeLightA;
      ctx.fillRect(-7, W * 0.3 - 6, 14, 6);
    }
    if (car.kind === 'mission') {
      ctx.strokeStyle = 'rgba(55, 244, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 11);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      ctx.rotate(ped.angle + Math.PI / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(ped.shirt, 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d9a37e';
      ctx.beginPath();
      ctx.arc(15, 0, 5.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const bob = Math.sin(ped.walkPhase) * 1.6;
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.ellipse(1.5, 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.kind === 'informant' ? '#ffd23e' : ped.shirt;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 9.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.kind === 'thug' ? '#c9a37e' : '#e8b08a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 2.4, Math.sin(ped.angle) * 2.4 + bob * 0.3, 5.6, 0, Math.PI * 2);
    ctx.fill();
    if (ped.kind === 'thug') {
      ctx.fillStyle = '#ff4f6d';
      ctx.fillRect(-2, -8.6, 4, 3.4);
    }
    if (ped.state === 'cower') {
      ctx.fillStyle = '#eef4ff';
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -16);
    }
    ctx.restore();
  }

  function drawPlayer(world) {
    const player = world.state.player;
    ctx.save();
    ctx.translate(player.x, player.y);
    const bob = Math.sin(player.walkPhase) * 1.8;
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath();
    ctx.ellipse(1.5, 3.4, 12, 8.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // The gun arm points where the mouse points.
    ctx.strokeStyle = '#22242e';
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(player.angle) * 21, Math.sin(player.angle) * 21);
    ctx.stroke();
    ctx.fillStyle = PALETTE.playerCoat;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 10.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerSkin;
    ctx.beginPath();
    ctx.arc(Math.cos(player.angle) * 2.6, Math.sin(player.angle) * 2.6 + bob * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEffects(world) {
    const fx = world.fx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const t of fx.tracers) {
      ctx.strokeStyle = 'rgba(255, 230, 150, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.restore();
    for (const p of fx.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(120, 126, 148, ${a * 0.34})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    for (const t of fx.texts) {
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(5, 6, 14, 0.8)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Menu and end screens, drawn in screen space over the world. */
  function drawScreen(world, screen, ui) {
    const state = world.state;
    const w = canvas.width;
    const h = canvas.height;
    if (screen === SCREEN_PLAY) return;
    if (screen === SCREEN_TITLE) {
      const grad = ctx.createLinearGradient(0, 0, w * 0.72, 0);
      grad.addColorStop(0, 'rgba(5, 6, 18, 0.88)');
      grad.addColorStop(1, 'rgba(5, 6, 18, 0.05)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.textAlign = 'left';
      ctx.save();
      ctx.shadowColor = '#ff4fd8';
      ctx.shadowBlur = 34;
      ctx.fillStyle = '#fdf7ff';
      ctx.font = `900 92px ${FONT}`;
      ctx.fillText('NEON', 64, 168);
      ctx.shadowColor = '#37f4ff';
      ctx.fillText('HARBOR', 64, 262);
      ctx.restore();
      ctx.fillStyle = '#ffd23e';
      ctx.font = `700 25px ${FONT}`;
      ctx.fillText(STORY.subtitle.toUpperCase(), 66, 306);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `19px ${FONT}`;
      const blurb = [
        `${STORY.cityName}, a port that never dries out. ${STORY.heroName} was its finest`,
        `harbour pilot, until the debts came due. Tonight his sister's boat,`,
        `${STORY.boatName}, sits impounded at Pier 9 — and the auctioneer comes at dawn.`,
        '',
        'Run errands for fixer Odette Fenn. Steal what you must. Outrun the Precinct.',
        'Buy back the boat before first light.',
      ];
      blurb.forEach((line, i) => ctx.fillText(line, 66, 356 + i * 27));
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `16.5px ${FONT}`;
      const controls = [
        'WASD / Arrows — walk and drive      Mouse — aim, click to shoot',
        'E — enter / leave a car             F — swing        Shift — sprint',
        'P — pause                           Missions pay cash. Cash buys back the boat.',
      ];
      controls.forEach((line, i) => ctx.fillText(line, 66, 356 + blurb.length * 27 + 22 + i * 25));
      ctx.fillStyle = '#8dff6e';
      ctx.font = `700 23px ${FONT}`;
      const prompt = ui.hasSave
        ? 'C — Continue the night        N — Start a new night'
        : 'ENTER — Begin the night';
      ctx.fillText(prompt, 66, h - 44);
      return;
    }
    // A shared dim for pause, over and ending.
    ctx.fillStyle = 'rgba(4, 5, 14, 0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `900 54px ${FONT}`;
      ctx.fillText('PAUSED', w / 2, h / 2 - 30);
      ctx.font = `19px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('The harbour holds its breath. P or Esc to keep going.', w / 2, h / 2 + 14);
      return;
    }
    if (screen === SCREEN_OVER) {
      const busted = state.over === 'busted';
      ctx.save();
      ctx.shadowColor = busted ? '#3b8bff' : '#ff3b57';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#fdf7ff';
      ctx.font = `900 84px ${FONT}`;
      ctx.fillText(busted ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 36);
      ctx.restore();
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(
        busted
          ? 'The Precinct books Ivo, fines him, and loses the paperwork by morning.'
          : 'St Kestrel patches Ivo up and bills him for the bandages.',
        w / 2, h / 2 + 16,
      );
      ctx.fillStyle = '#8dff6e';
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText('ENTER — Back on the street', w / 2, h / 2 + 62);
      return;
    }
    if (screen === SCREEN_ENDING) {
      const s = state.stats;
      const mins = Math.floor(s.timePlayed / 60);
      const secs = Math.floor(s.timePlayed % 60);
      ctx.save();
      ctx.shadowColor = '#37f4ff';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#fdf7ff';
      ctx.font = `900 52px ${FONT}`;
      ctx.fillText('THE GULLWIFE SAILS AGAIN', w / 2, 190);
      ctx.restore();
      ctx.font = `20px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      const lines = [
        'Dawn comes up over Kestrel Bay, and the harbourmaster counts Ivo\'s money twice.',
        `${STORY.boatName} is Wren Lark's again. The night is paid for.`,
        '',
        `Cash on hand $${state.player.cash} · Earned tonight $${s.totalEarned} · Cars stolen ${s.carsStolen} · Cab fares ${s.fares}`,
        `Combine heavies down ${s.thugsDown} · Time ${mins}m ${secs}s`,
        '',
        'Kestrel Bay stays open. The Gull Cab always needs a driver.',
      ];
      lines.forEach((line, i) => ctx.fillText(line, w / 2, 262 + i * 30));
      ctx.fillStyle = '#8dff6e';
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText('ENTER — Keep roaming', w / 2, 262 + lines.length * 30 + 26);
    }
  }

  return { drawScene, drawScreen, ctx };
}

function shade(hex, factor) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * factor);
  const g = Math.min(255, ((n >> 8) & 255) * factor);
  const b = Math.min(255, (n & 255) * factor);
  return `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
}

/** Bake the still city into one world-sized canvas. */
function buildStaticLayer(city) {
  const layer = document.createElement('canvas');
  layer.width = WORLD.width;
  layer.height = WORLD.height;
  const g = layer.getContext('2d');

  // Land base, then the road net over it.
  g.fillStyle = '#1b1b30';
  g.fillRect(0, 0, WORLD.width, WORLD.height);
  g.fillStyle = PALETTE.asphalt;
  for (const x of ROAD.avenuesX) g.fillRect(x - ROAD.width / 2, 0, ROAD.width, WORLD.beachY + 40);
  for (const y of ROAD.streetsY) g.fillRect(0, y - ROAD.width / 2, WORLD.width, ROAD.width);

  // Blocks: pavement apron, then the block's own ground.
  for (const block of city.blocks) {
    g.fillStyle = PALETTE.sidewalk;
    g.fillRect(block.x - 14, block.y - 14, block.w + 28, block.h + 28);
    g.fillStyle = block.kind === 'park'
      ? PALETTE.grass
      : block.kind === 'plaza'
        ? PALETTE.plazaGround
        : block.kind === 'parking' || block.kind === 'marina'
          ? '#24243e'
          : PALETTE.blockGround;
    g.fillRect(block.x, block.y, block.w, block.h);
    if (block.kind === 'parking' || block.kind === 'marina') {
      g.strokeStyle = 'rgba(220, 228, 255, 0.28)';
      g.lineWidth = 2;
      for (let x = block.x + 26; x < block.x + block.w - 10; x += 46) {
        g.beginPath();
        g.moveTo(x, block.y + 16);
        g.lineTo(x, block.y + 74);
        g.stroke();
      }
    }
    if (block.kind === 'plaza') {
      // Gull Square's fountain.
      g.fillStyle = '#3d4a75';
      g.beginPath();
      g.arc(block.x + block.w / 2, block.y + block.h / 2, 54, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#7fe7ff';
      g.beginPath();
      g.arc(block.x + block.w / 2, block.y + block.h / 2, 40, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#dfe9ff';
      g.beginPath();
      g.arc(block.x + block.w / 2, block.y + block.h / 2, 7, 0, Math.PI * 2);
      g.fill();
    }
    if (block.kind === 'park') {
      g.strokeStyle = 'rgba(230, 220, 190, 0.35)';
      g.lineWidth = 10;
      g.beginPath();
      g.moveTo(block.x, block.y + block.h / 2);
      g.lineTo(block.x + block.w, block.y + block.h / 2);
      g.moveTo(block.x + block.w / 2, block.y);
      g.lineTo(block.x + block.w / 2, block.y + block.h);
      g.stroke();
    }
  }

  // Lane dashes and crosswalks.
  g.fillStyle = PALETTE.laneMark;
  for (const x of ROAD.avenuesX) {
    for (let y = 26; y < WORLD.beachY; y += 64) {
      if (ROAD.streetsY.some((sy) => Math.abs(y - sy) < 70)) continue;
      g.globalAlpha = 0.5;
      g.fillRect(x - 2, y, 4, 30);
    }
  }
  for (const y of ROAD.streetsY) {
    for (let x = 26; x < WORLD.width; x += 64) {
      if (ROAD.avenuesX.some((ax) => Math.abs(x - ax) < 70)) continue;
      g.globalAlpha = 0.5;
      g.fillRect(x, y - 2, 30, 4);
    }
  }
  g.globalAlpha = 0.65;
  g.fillStyle = '#dfe6f5';
  for (const x of ROAD.avenuesX) {
    for (const y of ROAD.streetsY) {
      for (let s = -40; s <= 40; s += 16) {
        g.fillRect(x - ROAD.width / 2 + 6, y + s - 4, 18, 8);
        g.fillRect(x + ROAD.width / 2 - 24, y + s - 4, 18, 8);
      }
    }
  }
  g.globalAlpha = 1;

  // The coast: sand, a boardwalk, then the piers over open water.
  g.fillStyle = PALETTE.sand;
  g.fillRect(0, WORLD.beachY, WORLD.width, WORLD.waterY - WORLD.beachY);
  g.fillStyle = '#4e3f27';
  g.fillRect(0, WORLD.beachY + 74, WORLD.width, 30);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 0; x < WORLD.width; x += 26) g.fillRect(x, WORLD.beachY + 74, 3, 30);
  for (const pier of city.piers) {
    g.fillStyle = PALETTE.pierDeck;
    g.fillRect(pier.x, pier.y, pier.w, pier.h);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = pier.y + 8; y < pier.y + pier.h; y += 18) g.fillRect(pier.x, y, pier.w, 3);
    g.fillStyle = PALETTE.pierPost;
    g.fillRect(pier.x - 5, pier.y, 7, pier.h);
    g.fillRect(pier.x + pier.w - 2, pier.y, 7, pier.h);
  }
  drawMooredBoats(g, city);

  // Buildings: roofs with lit edges, rooftop clutter, and neon signs.
  for (const b of city.buildings) {
    const rng = createRandom(b.seed);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    g.fillStyle = shade(ROOF_TONES[Math.floor(rng() * ROOF_TONES.length)], b.tone);
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = 'rgba(200, 215, 255, 0.20)';
    g.lineWidth = 3;
    g.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    // Lit windows crowd the roof rim, the sign of a tall, awake building.
    const warm = rng() < 0.6;
    g.fillStyle = warm ? 'rgba(255, 209, 140, 0.85)' : 'rgba(170, 225, 255, 0.8)';
    for (let x = b.x + 12; x < b.x + b.w - 12; x += 17) {
      if (rng() < 0.55) g.fillRect(x, b.y + 7, 7, 4);
      if (rng() < 0.55) g.fillRect(x, b.y + b.h - 11, 7, 4);
    }
    for (let y = b.y + 12; y < b.y + b.h - 12; y += 17) {
      if (rng() < 0.5) g.fillRect(b.x + 7, y, 4, 7);
      if (rng() < 0.5) g.fillRect(b.x + b.w - 11, y, 4, 7);
    }
    // Rooftop clutter.
    g.fillStyle = 'rgba(10, 12, 22, 0.5)';
    const boxes = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < boxes; i += 1) {
      g.fillRect(b.x + 16 + rng() * (b.w - 60), b.y + 16 + rng() * (b.h - 60), 16 + rng() * 22, 12 + rng() * 18);
    }
    if (b.sign) {
      const color = NEON_SIGNS[b.sign.color % NEON_SIGNS.length];
      g.save();
      g.shadowColor = color;
      g.shadowBlur = 16;
      g.fillStyle = color;
      const signW = Math.min(b.w - 14, 12 + b.sign.text.length * 8.4);
      g.fillRect(b.x + (b.w - signW) / 2, b.y + b.h - 17, signW, 13);
      g.restore();
      g.fillStyle = '#0b0b16';
      g.font = `700 9.5px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(b.sign.text, b.x + b.w / 2, b.y + b.h - 7);
    }
  }

  // Crates read as harbour clutter.
  for (const c of city.crates) {
    g.fillStyle = '#6d5a34';
    g.fillRect(c.x, c.y, c.w, c.h);
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 2;
    g.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
  }

  // Palms: a dark crown of fronds.
  for (const palm of city.palms) {
    g.strokeStyle = '#173d2a';
    g.lineWidth = 4;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + palm.x;
      g.beginPath();
      g.moveTo(palm.x, palm.y);
      g.quadraticCurveTo(
        palm.x + Math.cos(a) * 13, palm.y + Math.sin(a) * 13 - 3,
        palm.x + Math.cos(a) * 21, palm.y + Math.sin(a) * 21 + 4,
      );
      g.stroke();
    }
    g.fillStyle = '#0f2c1e';
    g.beginPath();
    g.arc(palm.x, palm.y, 4, 0, Math.PI * 2);
    g.fill();
  }

  // Street lamps: a pool of light baked into the night.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const lamp of city.lamps) {
    const grad = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 56);
    grad.addColorStop(0, 'rgba(255, 205, 120, 0.20)');
    grad.addColorStop(1, 'rgba(255, 205, 120, 0)');
    g.fillStyle = grad;
    g.fillRect(lamp.x - 56, lamp.y - 56, 112, 112);
  }
  g.restore();
  g.fillStyle = '#ffd9a0';
  for (const lamp of city.lamps) {
    g.beginPath();
    g.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    g.fill();
  }

  return layer;
}

/** Small boats ride at anchor beside the piers; The Gullwife waits at Pier 9. */
function drawMooredBoats(g, city) {
  const hulls = [
    { x: city.piers[0].cx - 120, y: WORLD.height - 260, len: 74, color: '#b5533c' },
    { x: city.piers[0].cx + 96, y: WORLD.height - 150, len: 62, color: '#3c6eb5' },
    { x: city.piers[1].cx - 118, y: WORLD.height - 210, len: 84, color: '#c9c9c9' },
    { x: city.piers[1].cx + 100, y: WORLD.height - 300, len: 58, color: '#53b56e' },
  ];
  for (const boat of hulls) drawBoat(g, boat.x, boat.y, boat.len, boat.color, false);
  const gull = city.places.boat;
  drawBoat(g, gull.x, gull.y, 118, '#e8e3d8', true);
}

function drawBoat(g, x, y, len, color, hero) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(3, 5, len * 0.52, len * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(-len * 0.28, -len * 0.17);
  g.lineTo(len * 0.3, -len * 0.17);
  g.lineTo(len / 2, 0);
  g.lineTo(len * 0.3, len * 0.17);
  g.lineTo(-len * 0.28, len * 0.17);
  g.closePath();
  g.fill();
  g.fillStyle = '#37404f';
  g.fillRect(-len * 0.1, -len * 0.1, len * 0.24, len * 0.2);
  g.fillStyle = '#ffd9a0';
  g.fillRect(-len * 0.04, -len * 0.05, 5, 5);
  g.fillRect(len * 0.03, len * 0.02, 5, 5);
  if (hero) {
    g.fillStyle = '#ffd23e';
    g.font = `700 13px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('THE GULLWIFE', 0, -len * 0.24);
  }
  g.restore();
}
