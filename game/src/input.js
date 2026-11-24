// Keyboard and mouse input for Neon Harbor. Held keys and the pointer are read
// every frame; one-shot presses (confirm, pause, enter a car, swing a fist) are
// queued as bit flags and taken once by the loop, so a press between two frames
// is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_MELEE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const MELEE = new Set(['KeyF']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, sprint: false };
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;

  function setHeld(event, value) {
    if (UP.has(event.code)) held.up = value;
    else if (DOWN.has(event.code)) held.down = value;
    else if (LEFT.has(event.code)) held.left = value;
    else if (RIGHT.has(event.code)) held.right = value;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.sprint = value;
    else return false;
    return true;
  }

  window.addEventListener('keydown', (event) => {
    if (setHeld(event, true)) {
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
      event.preventDefault();
    } else if (MELEE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MELEE;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (setHeld(event, false)) event.preventDefault();
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.sprint = false;
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      actions |= ACTION_CONFIRM;
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held,
    mouse,
    /** Steering and walking axes, each -1, 0 or 1. */
    moveX() {
      return (held.right ? 1 : 0) - (held.left ? 1 : 0);
    },
    moveY() {
      return (held.down ? 1 : 0) - (held.up ? 1 : 0);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
