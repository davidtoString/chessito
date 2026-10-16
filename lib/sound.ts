// Game sounds. Recorded sets (public/sounds/<id>/*.mp3) are played through Web Audio; "wood" is synthesized
// here, so it needs no files and doubles as the fallback if a recording has not loaded yet.
export type Kind = 'move' | 'capture' | 'check' | 'castle' | 'promote' | 'checkmate' | 'win' | 'lose' | 'draw' | 'low' | 'notify';

export type SoundSet = { id: string; label: string; author: string; license: string; url: string; group: 'free' | 'open' | 'nc'; samples: boolean; castles: boolean };
export const soundSets: SoundSet[] = [
 { id: 'sfx', label: 'Natural (sfx)', author: 'Enigmahack', license: 'AGPLv3+', url: 'https://github.com/Enigmahack', group: 'open', samples: true, castles: false },
 { id: 'wood', label: 'Wood (synth)', author: 'Chessito', license: 'Original', url: '', group: 'free', samples: false, castles: true },
 { id: 'piano', label: 'Piano', author: 'Enigmahack', license: 'AGPLv3+', url: 'https://github.com/Enigmahack', group: 'open', samples: true, castles: false },
 { id: 'nes', label: 'Retro (NES)', author: 'Enigmahack', license: 'AGPLv3+', url: 'https://github.com/Enigmahack', group: 'open', samples: true, castles: false },
 { id: 'futuristic', label: 'Futuristic', author: 'Enigmahack', license: 'AGPLv3+', url: 'https://github.com/Enigmahack', group: 'open', samples: true, castles: false },
 { id: 'lisp', label: 'Lisp', author: 'EdinburghCollective', license: 'CC BY-NC-SA 4.0', url: 'https://lichess.org/@/EdinburghCollective', group: 'nc', samples: true, castles: true },
];
export const defaultSoundSet = 'sfx';
// Which recording plays for each kind of event.
export const fileFor: Record<Kind, string> = { move: 'Move', capture: 'Capture', check: 'Check', castle: 'Castles', promote: 'Confirmation', checkmate: 'Checkmate', win: 'Victory', lose: 'Defeat', draw: 'Draw', low: 'LowTime', notify: 'GenericNotify' };

const KEY_ON = 'chessito-sound', KEY_SET = 'chessito-sound-set', KEY_VOL = 'chessito-volume';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* optional */ } };

export function soundOn() { return read(KEY_ON) !== 'off'; }
export function setSound(on: boolean) { write(KEY_ON, on ? 'on' : 'off'); }
export function getVolume() { const v = Number(read(KEY_VOL)); return read(KEY_VOL) === null || Number.isNaN(v) ? 0.8 : Math.min(1, Math.max(0, v)); }
export function setVolume(v: number) { write(KEY_VOL, String(Math.min(1, Math.max(0, v)))); }
export function getSoundSet() { const s = read(KEY_SET); return soundSets.some(x => x.id === s) ? s! : defaultSoundSet; }
export function setSoundSet(id: string) { if (soundSets.some(x => x.id === id)) { write(KEY_SET, id); void preload(id); } }

let ctx: AudioContext | null = null, master: GainNode | null = null;
function audio() {
 if (typeof window === 'undefined') return null;
 if (!ctx) {
  ctx = new AudioContext();
  const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -10; limiter.knee.value = 8; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.15;
  master = ctx.createGain(); master.connect(limiter).connect(ctx.destination);
 }
 if (ctx.state === 'suspended') void ctx.resume();
 return ctx;
}

// ── recordings ─────────────────────────────────────────────────────────────
const buffers = new Map<string, AudioBuffer | 'missing' | Promise<void>>();
function load(set: string, file: string): Promise<void> | undefined {
 const key = `${set}/${file}`; const have = buffers.get(key);
 if (have instanceof Promise) return have; if (have) return undefined;
 const c = audio(); if (!c) return undefined;
 const p = fetch(`/sounds/${key}.mp3`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); }).then(b => c.decodeAudioData(b)).then(buf => { buffers.set(key, buf); }).catch(() => { buffers.set(key, 'missing'); });
 buffers.set(key, p); return p;
}
export function preload(set = getSoundSet()) {
 const info = soundSets.find(s => s.id === set); if (!info?.samples) return Promise.resolve();
 return Promise.all((Object.keys(fileFor) as Kind[]).filter(k => k !== 'castle' || info.castles).map(k => load(set, fileFor[k])));
}
function sample(set: string, file: string, at = 0): boolean {
 const b = buffers.get(`${set}/${file}`); const c = audio();
 if (!c || !master || !(b instanceof AudioBuffer)) { if (!b) void load(set, file); return false; }
 const s = c.createBufferSource(); s.buffer = b; s.connect(master); s.start(c.currentTime + at); return true;
}

// ── synthesized "wood" set ─────────────────────────────────────────────────
function noiseBuf(c: AudioContext, dur: number) {
 const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
 for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b;
}
// The sharp "tock" of a piece meeting a wooden board: a filtered noise burst with a fast decay.
function click(c: AudioContext, t: number, freq: number, dur: number, vol: number, q = 1.4) {
 const s = c.createBufferSource(); s.buffer = noiseBuf(c, dur + 0.02);
 const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
 const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
 s.connect(f).connect(g).connect(master!); s.start(t);
}
// The body of the knock: a short sine that drops in pitch.
function thump(c: AudioContext, t: number, f0: number, f1: number, dur: number, vol: number) {
 const o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
 o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
 g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
 o.connect(g).connect(master!); o.start(t); o.stop(t + dur + 0.02);
}
// A soft glassy ring: a sine plus one inharmonic partial, with a gentle attack.
function bell(c: AudioContext, t: number, f: number, dur: number, vol: number) {
 for (const [mult, amp] of [[1, 1], [2.76, 0.28]] as const) {
  const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * mult;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0003, t + dur);
  o.connect(g).connect(master!); o.start(t); o.stop(t + dur + 0.02);
 }
}
function tone(c: AudioContext, t: number, f: number, dur: number, vol: number, type: OscillatorType = 'triangle', lp = 2400) {
 const o = c.createOscillator(), g = c.createGain(), l = c.createBiquadFilter(); o.type = type; o.frequency.value = f; l.type = 'lowpass'; l.frequency.value = lp;
 g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0003, t + dur);
 o.connect(l).connect(g).connect(master!); o.start(t); o.stop(t + dur + 0.02);
}
const N = { C4: 261.63, D4: 293.66, F4: 349.23, G4: 392, A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, B6: 1975.5 };
function synth(kind: Kind) {
 const c = audio(); if (!c || !master) return; const t = c.currentTime + 0.005;
 const knock = (at: number, bright = 1800, vol = 0.9) => { click(c, at, bright, 0.05, vol); thump(c, at, 200, 105, 0.075, vol * 0.55); };
 switch (kind) {
  case 'move': knock(t); break;
  case 'capture': click(c, t, 1300, 0.085, 1); thump(c, t, 160, 62, 0.13, 0.9); click(c, t + 0.028, 2600, 0.035, 0.4); break;
  case 'castle': knock(t, 1700); knock(t + 0.13, 2100, 0.8); break;
  case 'promote': knock(t, 1900, 0.7); [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => bell(c, t + 0.07 + i * 0.06, f, 0.5, 0.2)); break;
  case 'check': knock(t); bell(c, t + 0.03, N.E6, 0.45, 0.26); bell(c, t + 0.1, N.B6, 0.5, 0.18); break;
  case 'checkmate': click(c, t, 1100, 0.12, 1); thump(c, t, 130, 48, 0.32, 1); tone(c, t + 0.05, 110, 0.9, 0.3, 'triangle', 900); tone(c, t + 0.05, 164.81, 0.9, 0.2, 'triangle', 900); bell(c, t + 0.1, N.E6, 0.8, 0.22); break;
  case 'win': [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => { bell(c, t + i * 0.1, f, 0.9, 0.3); }); tone(c, t + 0.3, N.C5, 0.9, 0.12); break;
  case 'lose': [N.A4, N.F4, N.D4].forEach((f, i) => tone(c, t + i * 0.16, f, 0.7, 0.28, 'triangle', 1500)); break;
  case 'draw': bell(c, t, N.G4, 0.7, 0.28); bell(c, t + 0.14, N.C5, 0.9, 0.26); break;
  case 'low': click(c, t, 3200, 0.03, 0.5, 3); break;
  case 'notify': bell(c, t, 880, 0.5, 0.25); break;
 }
}

export function play(kind: Kind, opts: { set?: string; force?: boolean } = {}) {
 if (typeof window === 'undefined' || (!opts.force && !soundOn())) return;
 try {
  const c = audio(); if (!c || !master) return;
  master.gain.value = getVolume();
  const set = opts.set ?? getSoundSet(); const info = soundSets.find(s => s.id === set);
  if (!info?.samples) { synth(kind); return; }
  if (kind === 'castle' && !info.castles) { // no castling recording in this set: two moves in a row
   if (sample(set, fileFor.move) && sample(set, fileFor.move, 0.14)) return; synth('castle'); return;
  }
  if (!sample(set, fileFor[kind])) synth(kind);   // not loaded yet: use the synth for this one
 } catch (e) { console.warn('sound error', e); }
}
// The jingle that follows a game-ending move.
export function playResult(result: 'win' | 'lose' | 'draw', delayMs = 750) { if (typeof window !== 'undefined') window.setTimeout(() => play(result), delayMs); }

export function soundFor(m: { san: string; flags: string; captured?: string; promotion?: string }, over: boolean): Kind {
 if (over) return m.san.includes('#') ? 'checkmate' : 'draw';
 if (m.san.includes('+') || m.san.includes('#')) return 'check';
 if (m.promotion) return 'promote';
 if (m.flags.includes('k') || m.flags.includes('q')) return 'castle';
 return m.captured ? 'capture' : 'move';
}
