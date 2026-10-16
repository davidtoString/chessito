// Move sounds synthesized with WebAudio, so there are no audio files or licenses to carry.
type Kind = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'end' | 'low';
let ctx: AudioContext | null = null;
const KEY = 'chessito-sound';

export function soundOn() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
export function setSound(on: boolean) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} }

function tone(c: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
 const o = c.createOscillator(), g = c.createGain();
 o.type = type; o.frequency.setValueAtTime(freq, t);
 if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
 g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
 o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
}

function noise(c: AudioContext, t: number, dur: number, vol: number, cutoff: number) {
 const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
 for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
 const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
 s.buffer = buf; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = vol;
 s.connect(f).connect(g).connect(c.destination); s.start(t);
}

export function play(kind: Kind) {
 if (typeof window === 'undefined' || !soundOn()) return;
 try {
  ctx ||= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  const c = ctx, t = c.currentTime;
  switch (kind) {
   case 'move': noise(c, t, .06, .5, 1800); tone(c, t, 220, .07, 'sine', .25, -90); break;
   case 'capture': noise(c, t, .12, .9, 3200); tone(c, t, 160, .12, 'triangle', .4, -80); break;
   case 'castle': noise(c, t, .06, .5, 1800); noise(c, t + .09, .07, .6, 2200); tone(c, t, 220, .07, 'sine', .25, -90); break;
   case 'promote': tone(c, t, 523, .1, 'triangle', .25); tone(c, t + .08, 784, .16, 'triangle', .25); break;
   case 'check': noise(c, t, .08, .6, 2600); tone(c, t, 880, .18, 'square', .09); break;
   case 'end': [392, 330, 262].forEach((f, i) => tone(c, t + i * .13, f, .22, 'triangle', .22)); break;
   case 'low': tone(c, t, 1000, .05, 'square', .06); break;
  }
 } catch {}
}

export function soundFor(m: { san: string; flags: string; captured?: string; promotion?: string }, over: boolean): Kind {
 if (over) return 'end';
 if (m.san.includes('+') || m.san.includes('#')) return 'check';
 if (m.promotion) return 'promote';
 if (m.flags.includes('k') || m.flags.includes('q')) return 'castle';
 return m.captured ? 'capture' : 'move';
}
