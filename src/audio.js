export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.14;
    master.connect(comp);
    comp.connect(ctx.destination);

    const len = ctx.sampleRate;
    const noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    ensure.noise = noise;
  }

  function tone({ freq = 440, dur = 0.1, type = 'sine', gain = 0.1, slide = 0, delay = 0 }) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), t);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    }
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst({ dur = 0.1, gain = 0.2, freq = 700, q = 0.7, delay = 0 }) {
    if (!ctx || muted || !ensure.noise) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = ensure.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    const offset = Math.random() * Math.max(0, ensure.noise.duration - dur - 0.05);
    src.start(t, offset, dur);
    src.stop(t + dur + 0.02);
  }

  return {
    start() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.85;
      return muted;
    },
    get muted() {
      return muted;
    },
    flail() {
      tone({
        freq: 480 + Math.random() * 720,
        dur: 0.07,
        type: 'square',
        gain: 0.055,
        slide: 280 + Math.random() * 220,
      });
      tone({
        freq: 180 + Math.random() * 90,
        dur: 0.05,
        type: 'triangle',
        gain: 0.03,
      });
    },
    impact(speed) {
      const v = Math.min(22, speed);
      noiseBurst({
        dur: 0.05 + v * 0.008,
        gain: Math.min(0.32, 0.05 + v * 0.014),
        freq: 180 + v * 55,
        q: 0.8,
      });
      tone({
        freq: 90 + v * 9,
        dur: 0.09 + v * 0.004,
        type: 'sine',
        gain: Math.min(0.22, 0.04 + v * 0.01),
        slide: -70,
      });
    },
    boing() {
      tone({ freq: 170, dur: 0.22, type: 'sine', gain: 0.16, slide: 460 });
    },
    pop() {
      tone({ freq: 320, dur: 0.16, type: 'square', gain: 0.08, slide: 520 });
      tone({ freq: 640, dur: 0.12, type: 'triangle', gain: 0.06, delay: 0.04, slide: 200 });
    },
    stuck() {
      tone({ freq: 90, dur: 0.28, type: 'sawtooth', gain: 0.06, slide: -40 });
      noiseBurst({ dur: 0.2, gain: 0.08, freq: 240, q: 1.2 });
    },
    launch() {
      noiseBurst({ dur: 0.28, gain: 0.18, freq: 420, q: 0.5 });
      tone({ freq: 180, dur: 0.35, type: 'sawtooth', gain: 0.07, slide: 640 });
    },
    chaos() {
      for (let i = 0; i < 7; i++) {
        tone({
          freq: 280 + i * 90,
          dur: 0.12,
          type: 'sawtooth',
          gain: 0.045,
          delay: i * 0.045,
          slide: 240,
        });
      }
      noiseBurst({ dur: 0.4, gain: 0.12, freq: 900, q: 0.4 });
    },
    badge() {
      [523, 659, 784, 1046].forEach((f, i) => {
        tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.09, delay: i * 0.07 });
      });
    },
    ui() {
      tone({ freq: 660, dur: 0.06, type: 'square', gain: 0.04, slide: 80 });
    },
    pickup() {
      tone({ freq: 520, dur: 0.08, type: 'triangle', gain: 0.08, slide: 280 });
      tone({ freq: 780, dur: 0.11, type: 'triangle', gain: 0.06, delay: 0.07 });
    },
    drop() {
      tone({ freq: 240, dur: 0.08, type: 'triangle', gain: 0.06, slide: -90 });
      noiseBurst({ dur: 0.05, gain: 0.05, freq: 480, q: 1.4 });
    },
    boom() {
      noiseBurst({ dur: 0.38, gain: 0.3, freq: 160, q: 0.45 });
      tone({ freq: 78, dur: 0.36, type: 'sawtooth', gain: 0.13, slide: -50 });
      tone({ freq: 420, dur: 0.09, type: 'square', gain: 0.05, slide: 240 });
    },
    honk() {
      tone({ freq: 320, dur: 0.13, type: 'square', gain: 0.07, slide: 50 });
      tone({ freq: 410, dur: 0.16, type: 'square', gain: 0.055, delay: 0.14, slide: -40 });
    },
    bawk() {
      tone({ freq: 640, dur: 0.09, type: 'square', gain: 0.06, slide: -260 });
      tone({ freq: 880, dur: 0.07, type: 'triangle', gain: 0.04, delay: 0.08, slide: 120 });
    },
    land(speed) {
      noiseBurst({
        dur: 0.12,
        gain: Math.min(0.22, 0.05 + speed * 0.01),
        freq: 140,
        q: 0.6,
      });
    },
  };
}
