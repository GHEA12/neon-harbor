// Juice: particles, skid marks, bullet tracers, floating text and screen shake.
// Everything is pooled and capped, so a long chase never grows the arrays.

const MAX_PARTICLES = 340;
const MAX_SKIDS = 420;
const MAX_TEXTS = 12;

export function createEffects() {
  const particles = [];
  const skids = [];
  const tracers = [];
  const texts = [];
  let shake = 0;

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  return {
    particles, skids, tracers, texts,

    addShake(amount) {
      shake = Math.min(16, shake + amount);
    },
    shakeAmount() {
      return shake;
    },

    burst(x, y, { count = 10, color = '#ffd76a', speed = 190, life = 0.45, size = 3, gravity = 0, spread = Math.PI * 2, baseAngle = 0 } = {}) {
      for (let i = 0; i < count; i += 1) {
        const a = baseAngle + (Math.random() - 0.5) * spread;
        const s = speed * (0.3 + Math.random() * 0.7);
        spawn({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: life * (0.5 + Math.random() * 0.8), maxLife: life,
          size: size * (0.6 + Math.random() * 0.8), color, gravity, kind: 'spark',
        });
      }
    },

    smoke(x, y, big = false) {
      spawn({
        x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 22, vy: -34 - Math.random() * 26,
        life: 0.9 + Math.random() * 0.7, maxLife: 1.4,
        size: (big ? 13 : 8) + Math.random() * 7, color: '#8d93a8', gravity: -30, kind: 'smoke',
      });
    },

    splash(x, y) {
      this.burst(x, y, { count: 22, color: '#7fe7ff', speed: 240, life: 0.6, size: 3, gravity: 420 });
      this.burst(x, y, { count: 10, color: '#e8fbff', speed: 140, life: 0.5, size: 2, gravity: 300 });
    },

    muzzle(x, y, angle) {
      this.burst(x, y, { count: 5, color: '#ffe9a3', speed: 260, life: 0.12, size: 3, spread: 0.7, baseAngle: angle });
    },

    addSkid(x, y, angle, strength) {
      if (skids.length >= MAX_SKIDS) skids.shift();
      skids.push({ x, y, angle, strength, life: 7 });
    },

    addTracer(x1, y1, x2, y2) {
      tracers.push({ x1, y1, x2, y2, life: 0.07 });
      if (tracers.length > 24) tracers.shift();
    },

    addText(x, y, str, color = '#eef4ff') {
      if (texts.length >= MAX_TEXTS) texts.shift();
      texts.push({ x, y, str, color, life: 1.5 });
    },

    update(dt) {
      shake = Math.max(0, shake - dt * 26);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = skids.length - 1; i >= 0; i -= 1) {
        skids[i].life -= dt;
        if (skids[i].life <= 0) skids.splice(i, 1);
      }
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) tracers.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        texts[i].life -= dt;
        texts[i].y -= 34 * dt;
        if (texts[i].life <= 0) texts.splice(i, 1);
      }
    },
  };
}
