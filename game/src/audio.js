// All sound is synthesised with WebAudio: an engine hum, a two-tone siren,
// gunshots, thumps, chimes and a small synthwave loop. No audio files exist.
// The context opens on the first user gesture, as browsers require.

const BASS_LINE = [55, 0, 55, 55, 0, 55, 0, 65.4, 55, 0, 55, 55, 0, 82.4, 0, 73.4];
const PAD_CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineSub = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let noiseBuffer = null;
  let musicTimer = 0;
  let musicStep = 0;
  let nextNoteAt = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;

    // The car engine: a saw and a square an octave down through a lowpass.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineSub = ctx.createOscillator();
    engineSub.type = 'square';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineSub.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineSub.start();

    // The siren: a square wave whose pitch an LFO swings between two tones.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 760;
    sirenLfo = ctx.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 130;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    const sirenFilter = ctx.createBiquadFilter();
    sirenFilter.type = 'bandpass';
    sirenFilter.frequency.value = 800;
    sirenOsc.connect(sirenFilter);
    sirenFilter.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();

    nextNoteAt = ctx.currentTime + 0.1;
  }

  function blip(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur, vol, filterFreq, type = 'lowpass') {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
    src.stop(ctx.currentTime + dur);
  }

  function scheduleMusic() {
    // A lookahead step sequencer: bass eighths, a pad chord every two bars, hat ticks.
    while (nextNoteAt < ctx.currentTime + 0.14) {
      const step = musicStep % 64;
      const bass = BASS_LINE[step % 16];
      if (bass) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = bass;
        gain.gain.setValueAtTime(0.16, nextNoteAt);
        gain.gain.exponentialRampToValueAtTime(0.001, nextNoteAt + 0.19);
        osc.connect(gain);
        gain.connect(master);
        osc.start(nextNoteAt);
        osc.stop(nextNoteAt + 0.2);
      }
      if (step % 4 === 2) noiseBurstAt(nextNoteAt, 0.03, 0.03, 7000, 'highpass');
      if (step % 32 === 0) {
        const chord = PAD_CHORDS[Math.floor(step / 32) % PAD_CHORDS.length];
        for (const freq of chord) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, nextNoteAt);
          gain.gain.linearRampToValueAtTime(0.035, nextNoteAt + 0.5);
          gain.gain.linearRampToValueAtTime(0.0001, nextNoteAt + 3.6);
          osc.connect(gain);
          gain.connect(master);
          osc.start(nextNoteAt);
          osc.stop(nextNoteAt + 3.7);
        }
      }
      musicStep += 1;
      nextNoteAt += 0.205;
    }
  }

  function noiseBurstAt(when, dur, vol, freq, type) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  return {
    unlock,

    /** Called every frame: drives the engine, the siren and the music loop. */
    update(state) {
      if (!ctx) return;
      const t = ctx.currentTime;
      const driving = state.driving;
      const targetEngine = driving ? 0.05 + state.speedRatio * 0.075 : 0;
      engineGain.gain.setTargetAtTime(targetEngine, t, 0.08);
      if (driving) {
        const rpm = 52 + state.speedRatio * 165 + Math.sin(t * 31) * 2.5;
        engineOsc.frequency.setTargetAtTime(rpm, t, 0.05);
        engineSub.frequency.setTargetAtTime(rpm / 2, t, 0.05);
        engineFilter.frequency.setTargetAtTime(280 + state.speedRatio * 980, t, 0.08);
      }
      const targetSiren = state.sirenLevel > 0.01 ? 0.028 * state.sirenLevel : 0;
      sirenGain.gain.setTargetAtTime(targetSiren, t, 0.15);
      musicTimer += state.dt;
      if (state.musicOn && musicTimer > 0.05) {
        musicTimer = 0;
        scheduleMusic();
      }
    },

    shot() {
      noiseBurst(0.16, 0.5, 2600);
      blip(160, 0.1, 'square', 0.25, 60);
    },
    melee() {
      noiseBurst(0.09, 0.35, 500);
      blip(90, 0.09, 'sine', 0.3, 45);
    },
    hit() {
      blip(220, 0.08, 'square', 0.18, 110);
    },
    hurt() {
      blip(140, 0.16, 'sawtooth', 0.22, 70);
    },
    bump(strength = 1) {
      noiseBurst(0.14, 0.3 * strength, 340);
      blip(64, 0.14, 'sine', 0.34 * strength, 38);
    },
    door() {
      blip(320, 0.06, 'square', 0.14, 190);
      noiseBurst(0.05, 0.1, 900);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.2);
      setTimeout(() => blip(990, 0.13, 'sine', 0.2), 70);
    },
    cash() {
      blip(880, 0.07, 'triangle', 0.22);
      setTimeout(() => blip(1174, 0.07, 'triangle', 0.22), 60);
      setTimeout(() => blip(1568, 0.12, 'triangle', 0.22), 120);
    },
    ui() {
      blip(520, 0.05, 'square', 0.1, 420);
    },
    jingle() {
      const notes = [523.2, 659.2, 784, 1046.5];
      notes.forEach((n, i) => setTimeout(() => blip(n, 0.22, 'triangle', 0.22), i * 110));
    },
    fail() {
      blip(330, 0.2, 'sawtooth', 0.16, 220);
      setTimeout(() => blip(220, 0.3, 'sawtooth', 0.16, 147), 160);
    },
    sirenBlip() {
      blip(760, 0.12, 'square', 0.1, 990);
    },
  };
}
