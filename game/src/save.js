// The save: one small record in localStorage — cash, where the story stands,
// and what a finished night looks like. Storage can be off (private windows);
// then the save simply lasts for the visit.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Math.max(0, Math.floor(data.cash) || 0),
      missionIndex: Math.max(0, Math.floor(data.missionIndex) || 0),
      storyDone: !!data.storyDone,
      totalEarned: Math.max(0, Math.floor(data.totalEarned) || 0),
    };
  } catch {
    return null;
  }
}

export function storeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Nothing to do: the night goes unsaved.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do.
  }
}
