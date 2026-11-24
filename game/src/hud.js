// The HUD: health and cash, wanted stars, the current objective, dialogue
// toasts, context controls, and the radar — a small living map of Kestrel Bay
// with blips for Ivo, the job, the fares and the Precinct.

import { FONT, PALETTE, ROAD, WORLD } from './config.js';

const MAP_SCALE = 0.046;
const MAP_W = Math.ceil(WORLD.width * MAP_SCALE);
const MAP_H = Math.ceil(WORLD.height * MAP_SCALE);

export function createHud(city) {
  const mapImage = buildMinimap(city);

  function drawHud(ctx, world, camera, mouse) {
    const state = world.state;
    const player = state.player;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    drawVitals(ctx, world);
    drawWanted(ctx, world, w);
    drawObjective(ctx, world, w);
    drawToast(ctx, world, w, h);
    drawMinimap(ctx, world, w, h);
    drawContextHint(ctx, world, h);
    drawCrosshair(ctx, mouse);
    if (player.hp < 32 && !state.over) {
      const pulse = 0.16 + 0.1 * Math.sin(state.time * 6);
      ctx.fillStyle = `rgba(190, 20, 40, ${pulse})`;
      ctx.fillRect(0, 0, w, 6);
      ctx.fillRect(0, h - 6, w, 6);
      ctx.fillRect(0, 0, 6, h);
      ctx.fillRect(w - 6, 0, 6, h);
    }
  }

  function drawVitals(ctx, world) {
    const player = world.state.player;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(16, 16, 252, player.inCar ? 96 : 68, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('IVO LARK', 28, 36);
    // Health.
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(28, 44, 168, 13);
    ctx.fillStyle = player.hp > 32 ? '#53d769' : '#ff4f6d';
    ctx.fillRect(28, 44, 168 * Math.max(0, player.hp / 100), 13);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 13px ${FONT}`;
    ctx.fillText(`${Math.ceil(player.hp)}`, 204, 56);
    // Cash.
    ctx.fillStyle = PALETTE.cash;
    ctx.font = `800 19px ${FONT}`;
    ctx.fillText(`$${player.cash.toLocaleString('en-US')}`, 28, 82);
    if (player.inCar) {
      const car = player.inCar;
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `700 11px ${FONT}`;
      ctx.fillText(car.model.name.toUpperCase(), 118, 82);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(28, 90, 168, 9);
      ctx.fillStyle = car.hp > 30 ? '#4fc3f7' : '#ff9a3c';
      ctx.fillRect(28, 90, 168 * Math.max(0, car.hp / 100), 9);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 12px ${FONT}`;
      ctx.fillText(`${Math.round(Math.hypot(car.vx, car.vy) * 0.24)} km/h`, 204, 99);
    }
    ctx.restore();
  }

  function drawWanted(ctx, world, w) {
    const state = world.state;
    ctx.save();
    ctx.textAlign = 'right';
    for (let i = 0; i < 5; i += 1) {
      const x = w - 26 - (4 - i) * 30;
      const lit = i < state.stars;
      ctx.font = `24px ${FONT}`;
      ctx.fillStyle = lit ? (Math.sin(state.time * 7) > -0.4 ? '#ffd23e' : '#ff9a3c') : 'rgba(255,255,255,0.18)';
      ctx.fillText('★', x, 42);
    }
    if (state.bust > 0.02) {
      ctx.fillStyle = PALETTE.panel;
      ctx.beginPath();
      ctx.roundRect(w - 196, 52, 168, 22, 6);
      ctx.fill();
      ctx.fillStyle = '#ff4f6d';
      ctx.fillRect(w - 190, 57, 156 * state.bust, 12);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 10.5px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('BUSTED', w - 112, 67);
    }
    ctx.restore();
  }

  function drawObjective(ctx, world, w) {
    const missions = world.missions;
    const state = world.state;
    const objective = missions.objective;
    ctx.save();
    ctx.textAlign = 'center';
    let y = 24;
    if (objective) {
      const player = state.player;
      const dist = Math.round(Math.hypot(player.x - objective.x, player.y - objective.y) / 9);
      ctx.fillStyle = PALETTE.panel;
      const title = missions.missionTitle().toUpperCase();
      ctx.font = `700 12px ${FONT}`;
      const tw = Math.max(ctx.measureText(objective.text).width + 90, ctx.measureText(title).width + 40);
      ctx.beginPath();
      ctx.roundRect(w / 2 - tw / 2, y, tw, 52, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.objective;
      ctx.fillText(title, w / 2, y + 19);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 15.5px ${FONT}`;
      ctx.fillText(`${objective.text}  ·  ${dist}m`, w / 2, y + 41);
      y += 60;
    }
    if (missions.cabObjective) {
      ctx.fillStyle = PALETTE.cabYellow;
      ctx.font = `600 13.5px ${FONT}`;
      ctx.fillText(missions.cabObjective.text, w / 2, y + 14);
    }
    ctx.restore();
  }

  function drawToast(ctx, world, w, h) {
    const toast = world.state.toast;
    if (!toast || world.state.time > toast.until) return;
    ctx.save();
    const lines = wrapText(ctx, toast.text, 560);
    const boxH = 34 + lines.length * 21;
    const y = h - 196 - boxH;
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 300, y, 600, boxH, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(55, 244, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#37f4ff';
    ctx.font = `700 12.5px ${FONT}`;
    ctx.fillText(toast.speaker.toUpperCase(), w / 2 - 282, y + 22);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `15.5px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, w / 2 - 282, y + 44 + i * 21));
    ctx.restore();
  }

  function drawMinimap(ctx, world, w, h) {
    const state = world.state;
    const x0 = w - MAP_W - 18;
    const y0 = h - MAP_H - 18;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, MAP_W + 12, MAP_H + 12, 10);
    ctx.fill();
    ctx.drawImage(mapImage, x0, y0);
    const px = (wx) => x0 + wx * MAP_SCALE;
    const py = (wy) => y0 + wy * MAP_SCALE;
    // Police blips flash blue and red.
    const phase = Math.sin(state.time * 9) > 0;
    for (const car of state.cars) {
      if (car.kind !== 'police' || car.sunk) continue;
      ctx.fillStyle = phase ? '#ff3b57' : '#3b8bff';
      ctx.beginPath();
      ctx.arc(px(car.x), py(car.y), 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (world.missions.cabObjective) blip(ctx, px(world.missions.cabObjective.x), py(world.missions.cabObjective.y), PALETTE.cabYellow, 3.6);
    if (world.missions.objective) {
      const o = world.missions.objective;
      const r = 4.4 + Math.sin(state.time * 4.2) * 1.2;
      blip(ctx, px(o.x), py(o.y), PALETTE.objective, r);
    }
    // Ivo: a white arrow that turns with him.
    const player = state.player;
    ctx.translate(px(player.x), py(player.y));
    ctx.rotate(player.inCar ? player.inCar.angle : player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6.4, 0);
    ctx.lineTo(-4.4, -4);
    ctx.lineTo(-4.4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawContextHint(ctx, world, h) {
    const player = world.state.player;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 22, 0.55)';
    ctx.font = `13.5px ${FONT}`;
    const text = player.inCar
      ? 'WASD Drive · E Leave car · P Pause'
      : nearestCarName(world)
        ? `E — Take the ${nearestCarName(world)} · Click Shoot · F Swing`
        : 'WASD Walk · Shift Sprint · Click Shoot · F Swing · E Enter car';
    const tw = ctx.measureText(text).width + 24;
    ctx.beginPath();
    ctx.roundRect(16, h - 42, tw, 27, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'left';
    ctx.fillText(text, 28, h - 24);
    ctx.restore();
  }

  function drawCrosshair(ctx, mouse) {
    ctx.save();
    ctx.strokeStyle = 'rgba(238, 244, 255, 0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff4f6d';
    ctx.fillRect(mouse.x - 1, mouse.y - 1, 2, 2);
    ctx.restore();
  }

  return { drawHud };
}

function blip(ctx, x, y, color, r) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(5,6,14,0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function nearestCarName(world) {
  const player = world.state.player;
  if (player.inCar) return null;
  let best = null;
  let bestD = 110;
  for (const car of world.state.cars) {
    if (car.sunk || car.wrecked) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best ? best.model.name : null;
}

function wrapText(ctx, text, maxWidth) {
  ctx.font = `15.5px ${FONT}`;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A tiny flat map of the bay: water, land, the road net, the piers. */
function buildMinimap(city) {
  const map = document.createElement('canvas');
  map.width = MAP_W;
  map.height = MAP_H;
  const g = map.getContext('2d');
  g.fillStyle = '#0a2e49';
  g.fillRect(0, 0, MAP_W, MAP_H);
  g.fillStyle = '#23233c';
  g.fillRect(0, 0, MAP_W, WORLD.waterY * MAP_SCALE);
  g.fillStyle = '#2d2d4d';
  for (const b of city.blocks) g.fillRect(b.x * MAP_SCALE, b.y * MAP_SCALE, b.w * MAP_SCALE, b.h * MAP_SCALE);
  g.strokeStyle = '#4a4a78';
  g.lineWidth = Math.max(2, ROAD.width * MAP_SCALE);
  for (const x of ROAD.avenuesX) {
    g.beginPath();
    g.moveTo(x * MAP_SCALE, 0);
    g.lineTo(x * MAP_SCALE, WORLD.beachY * MAP_SCALE);
    g.stroke();
  }
  for (const y of ROAD.streetsY) {
    g.beginPath();
    g.moveTo(0, y * MAP_SCALE);
    g.lineTo(MAP_W, y * MAP_SCALE);
    g.stroke();
  }
  g.fillStyle = '#6d5a3a';
  for (const pier of city.piers) g.fillRect(pier.x * MAP_SCALE, pier.y * MAP_SCALE, pier.w * MAP_SCALE, pier.h * MAP_SCALE);
  return map;
}
