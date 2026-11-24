// The story of one night in Kestrel Bay, and the Gull Cab fares between jobs.
// Ivo Lark, a harbour pilot with more debts than luck, works for fixer Odette
// Fenn to earn back his sister's impounded boat, The Gullwife, before the
// dawn auction at Pier 9. Four jobs, told in stages; each stage has one
// objective, one marker, and something to say.

import { createCar } from './cars.js';
import { spawnPed } from './peds.js';
import { randomSidewalkPoint } from './city.js';

export const MISSION_TITLES = [
  'First Light',
  'Marina Muscle',
  'The Canary Sings',
  'Low Tide',
];

export function createMissions(world, savedIndex) {
  const state = world.state;
  const places = world.city.places;
  const M = {
    index: savedIndex,
    stage: 0,
    objective: null,
    cabObjective: null,
    missionCar: null,
    pell: null,
    thugs: [],
    hasPassenger: false,
    timer: 0,
    cab: { phase: 'idle', cooldown: 6, ped: null, dest: null, timeLeft: 0 },
    started: false,

    start() {
      if (this.index >= MISSION_TITLES.length) {
        this.objective = null;
        return;
      }
      this.started = true;
      this.stage = 0;
      this.setupStage();
      if (this.index === 0) {
        world.showToast('Odette Fenn (phone)', 'Ivo. The Gullwife goes under the hammer at dawn. Earn tonight, or wave her goodbye. Come see me at the Lantern Market.', 8);
      }
    },

    missionTitle() {
      return this.index < MISSION_TITLES.length ? MISSION_TITLES[this.index] : 'Free Roam';
    },

    setupStage() {
      const p = state.player;
      switch (this.index * 10 + this.stage) {
        case 0: // First Light: meet Odette
          this.objective = { text: 'Meet Odette at the Lantern Market', x: places.market.x, y: places.market.y, radius: 95 };
          break;
        case 1: // First Light: deliver the crate
          world.showToast('Odette Fenn', 'A sealed crate, Pier 3, no questions asked by either of us. The harbour provides, Ivo.', 6);
          this.objective = { text: 'Take the crate to Pier 3', x: places.pier3.x, y: places.pier3.y, radius: 85 };
          break;
        case 10: // Marina Muscle: scope the lot
          world.showToast('Odette Fenn (phone)', 'A silver Aurora Coupe sleeps in the Marina Row lot. Rust & Ruin will pay well for it. Keys optional.', 7);
          this.objective = { text: 'Scope the Marina Row lot', x: places.marinaLot.x, y: places.marinaLot.y, radius: 110 };
          break;
        case 11: { // Marina Muscle: steal the coupe
          const model = 4;
          this.missionCar = createCar(places.marinaLot.x + 30, places.marinaLot.y - 20, Math.PI / 2, model, '#cfd6dd', 'mission');
          state.cars.push(this.missionCar);
          this.objective = { text: 'Steal the silver Aurora Coupe', x: this.missionCar.x, y: this.missionCar.y, radius: 70, followCar: this.missionCar };
          break;
        }
        case 12: // Marina Muscle: deliver it
          world.showToast('Odette Fenn (phone)', "That's the one. The Precinct will have opinions. Bring it to Rust & Ruin Garage.", 6);
          this.objective = { text: 'Deliver the Aurora to Rust & Ruin Garage', x: places.garage.x, y: places.garage.y, radius: 115 };
          break;
        case 20: // The Canary Sings: find Pell
          world.showToast('Odette Fenn (phone)', "Pell's been singing about you, Ivo. Gull Square. Go gentle, he's a nervous bird.", 6);
          this.pell = spawnPed(world, places.gullSquare.x + 26, places.gullSquare.y + 14, 'informant');
          this.objective = { text: 'Find Pell the Canary in Gull Square', x: places.gullSquare.x, y: places.gullSquare.y, radius: 80 };
          break;
        case 21: { // The Canary Sings: the heavies arrive
          world.showToast('Pell the Canary', "Ivo Lark? Odette's Ivo? Thank the tide. The Combine's heavies are — behind you!", 5);
          if (this.pell) this.pell.state = 'cower';
          this.thugs = [
            spawnPed(world, p.x + 150, p.y - 90, 'thug'),
            spawnPed(world, p.x - 140, p.y + 110, 'thug'),
          ];
          for (const thug of this.thugs) thug.state = 'fight';
          this.objective = { text: 'Drop the Combine heavies (0/2)', x: places.gullSquare.x, y: places.gullSquare.y, radius: 0 };
          break;
        }
        case 22: // The Canary Sings: drive him out
          world.showToast('Pell the Canary', 'You fight like your sister sails. Get me to Tidemill Lane, please. Quietly, if the night allows.', 6);
          if (this.pell) this.pell.state = 'wait';
          this.objective = { text: 'Drive Pell to the Tidemill Lane safehouse', x: places.safehouse.x, y: places.safehouse.y, radius: 105 };
          break;
        case 30: // Low Tide: get to Pier 9
          world.showToast('Odette Fenn (phone)', 'Pier 9, Ivo. Bring the money. Bring the noise. Bring yourself home.', 6);
          this.objective = { text: 'Get to Pier 9', x: places.pier9Gate.x, y: places.pier9Gate.y, radius: 95 };
          break;
        case 31: // Low Tide: the run down the pier
          this.timer = 170;
          state.heatFloor = 300;
          world.commitCrime('alarm', p.x, p.y); // the Precinct notices the night moving
          world.showToast('Harbour tannoy', 'Final call. Lot 9: one fishing boat, The Gullwife. Auction at dawn — bidding opens now.', 6);
          this.objective = { text: 'Reach The Gullwife before the auction ends', x: places.boat.x - 90, y: places.boat.y, radius: 92 };
          break;
        default:
          this.objective = null;
      }
    },

    completeMission(reward, line) {
      const player = state.player;
      player.cash += reward;
      state.stats.totalEarned += reward;
      world.audio.cash();
      world.audio.jingle();
      world.fx.addText(player.x, player.y - 56, `+$${reward}`, '#8dff6e');
      if (line) world.showToast('Odette Fenn', line, 6);
      this.index += 1;
      this.stage = 0;
      this.missionCar = null;
      state.heatFloor = 0;
      world.saveProgress();
      if (this.index >= MISSION_TITLES.length) {
        this.objective = null;
        state.ending = true;
      } else {
        this.setupStage();
      }
    },

    advance() {
      this.stage += 1;
      this.setupStage();
    },

    onEvent(evt) {
      if (this.index === 1 && this.stage === 1 && evt.type === 'enterCar' && evt.car === this.missionCar) {
        this.advance();
      }
      if (this.index === 2 && this.stage === 2 && evt.type === 'enterCar' && this.pell) {
        const d = Math.hypot(this.pell.x - evt.car.x, this.pell.y - evt.car.y);
        if (d < 230 && !this.hasPassenger) {
          this.hasPassenger = true;
          this.pell.state = 'passenger';
          const i = state.peds.indexOf(this.pell);
          if (i >= 0) state.peds.splice(i, 1);
          world.audio.pickup();
          world.showToast('Pell the Canary', 'Floor it, but gently. I bruise in several places already.', 4);
        }
      }
      if (evt.type === 'exitCar' && this.hasPassenger) {
        // Pell climbs out and waits by the car.
        this.hasPassenger = false;
        this.pell = spawnPed(world, evt.car.x + 26, evt.car.y + 8, 'informant');
        this.pell.state = 'wait';
      }
    },

    atObjective(radiusScale = 1) {
      if (!this.objective) return false;
      const p = state.player;
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      return Math.hypot(px - this.objective.x, py - this.objective.y) < this.objective.radius * radiusScale;
    },

    update(dt) {
      if (!this.started) return;
      const p = state.player;
      // Keep a follow objective glued to its car.
      if (this.objective && this.objective.followCar) {
        this.objective.x = this.objective.followCar.x;
        this.objective.y = this.objective.followCar.y;
      }
      switch (this.index * 10 + this.stage) {
        case 0:
          if (this.atObjective()) this.advance();
          break;
        case 1:
          if (this.atObjective()) this.completeMission(250, 'Clean work. The Combine pays better, if your hands stay steady.');
          break;
        case 10:
          if (this.atObjective()) this.advance();
          break;
        case 11:
          if (this.missionCar && this.missionCar.wrecked) {
            world.showToast('Odette Fenn (phone)', 'You broke the merchandise, Ivo. Another coupe, same lot. Again, with feeling.', 5);
            const i = state.cars.indexOf(this.missionCar);
            if (i >= 0) state.cars.splice(i, 1);
            this.setupStage();
          }
          break;
        case 12:
          if (this.missionCar && this.missionCar.wrecked) {
            world.showToast('Odette Fenn (phone)', 'Wrecked on the way? The lot has another. This is why we cannot have nice cars.', 5);
            const i = state.cars.indexOf(this.missionCar);
            if (i >= 0) state.cars.splice(i, 1);
            this.stage = 1;
            this.setupStage();
          } else if (this.atObjective() && p.inCar === this.missionCar) {
            // The garage takes the car; Ivo walks away lighter and richer.
            const i = state.cars.indexOf(this.missionCar);
            if (i >= 0) state.cars.splice(i, 1);
            p.inCar = null;
            p.x = places.garage.x + 60;
            p.y = places.garage.y + 40;
            this.completeMission(600, "Pleasure, Ivo. Pell's been singing about you. Gull Square. Go gentle.");
          }
          break;
        case 20:
          if (this.atObjective()) this.advance();
          break;
        case 21: {
          const down = this.thugs.filter((t) => t.state === 'down').length;
          this.objective.text = `Drop the Combine heavies (${down}/2)`;
          if (down >= 2) this.advance();
          break;
        }
        case 22:
          if (this.hasPassenger && p.inCar && this.atObjective()) {
            this.hasPassenger = false;
            this.pell = null;
            this.completeMission(900, 'One more tide, Ivo. Vane auctions the Gullwife at Pier 9. Tonight. Bring everything.');
          }
          break;
        case 30:
          if (this.atObjective()) this.advance();
          break;
        case 31: {
          this.timer -= dt;
          this.objective.text = `Reach The Gullwife — ${Math.max(0, Math.ceil(this.timer))}s left`;
          if (this.atObjective()) {
            state.heatFloor = 0;
            this.completeMission(2000, 'She is yours again, Ivo. Mind the tide on the way home.');
          } else if (this.timer <= 0) {
            state.heatFloor = 0;
            world.audio.fail();
            world.showToast('Harbour tannoy', 'Lot 9 held over — the buyer never showed. One more chance, pilot.', 5);
            this.stage = 0;
            this.setupStage();
          }
          break;
        }
        default:
          break;
      }
      this.updateCab(dt);
    },

    /** Gull Cab: a repeatable fare that appears while Ivo is driving. */
    updateCab(dt) {
      const cab = this.cab;
      const p = state.player;
      if (cab.phase === 'idle') {
        cab.cooldown -= dt;
        if (cab.cooldown <= 0 && p.inCar && !state.over) {
          const spot = randomSidewalkPoint(world.rng);
          if (Math.hypot(spot.x - p.x, spot.y - p.y) > 380) {
            cab.ped = spawnPed(world, spot.x, spot.y, 'walker');
            cab.ped.state = 'wait';
            cab.phase = 'pickup';
            this.cabObjective = { text: 'Gull Cab: pick up the fare', x: spot.x, y: spot.y, radius: 62 };
            world.showToast('Gull Cab', 'A fare is waiting. Yellow blip — get them where they are going.', 4);
          } else {
            cab.cooldown = 2;
          }
        }
        return;
      }
      if (cab.phase === 'pickup') {
        if (!cab.ped || cab.ped.state === 'down') {
          cab.phase = 'idle';
          cab.cooldown = 14;
          this.cabObjective = null;
          return;
        }
        this.cabObjective.x = cab.ped.x;
        this.cabObjective.y = cab.ped.y;
        if (p.inCar && Math.hypot(p.inCar.x - cab.ped.x, p.inCar.y - cab.ped.y) < 66 && Math.hypot(p.inCar.vx, p.inCar.vy) < 60) {
          const i = state.peds.indexOf(cab.ped);
          if (i >= 0) state.peds.splice(i, 1);
          cab.ped = null;
          const dest = randomSidewalkPoint(world.rng);
          cab.dest = dest;
          cab.timeLeft = Math.hypot(dest.x - p.x, dest.y - p.y) / 8.5 + 26;
          cab.phase = 'dropoff';
          this.cabObjective = { text: 'Gull Cab: drop off the fare', x: dest.x, y: dest.y, radius: 78 };
          world.audio.pickup();
        }
        return;
      }
      // dropoff
      cab.timeLeft -= dt;
      this.cabObjective.text = `Gull Cab: drop off the fare — ${Math.max(0, Math.ceil(cab.timeLeft))}s`;
      if (!p.inCar) {
        cab.phase = 'idle';
        cab.cooldown = 10;
        this.cabObjective = null;
        world.showToast('Gull Cab', 'Fare lost. They will walk, and tell everyone.', 3.5);
        return;
      }
      if (Math.hypot(p.inCar.x - cab.dest.x, p.inCar.y - cab.dest.y) < 78) {
        const tip = Math.max(0, Math.round(cab.timeLeft * 0.8));
        const fare = 26 + tip;
        p.cash += fare;
        state.stats.totalEarned += fare;
        state.stats.fares += 1;
        world.audio.cash();
        world.fx.addText(p.x, p.y - 52, `FARE $${fare}`, '#ffd23e');
        world.saveProgress();
        cab.phase = 'idle';
        cab.cooldown = 11;
        this.cabObjective = null;
      } else if (cab.timeLeft <= -30) {
        cab.phase = 'idle';
        cab.cooldown = 8;
        this.cabObjective = null;
        world.showToast('Gull Cab', 'The fare gave up and got out at a light.', 3.5);
      }
    },
  };
  if (savedIndex >= MISSION_TITLES.length) M.objective = null;
  return M;
}
