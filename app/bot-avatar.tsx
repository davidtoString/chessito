'use client';
import { useLook } from '../lib/look';
import Piece from './piece';
import { getBot } from '../lib/bots';
// Friendly vector avatars for the practice bots (original artwork).
const faces: Record<number, { bg: string; body: React.ReactNode }> = {
 // Pip: a little chick with a pawn-like sprout
 0: { bg: '#fff0b8', body: <>
  <circle cx="32" cy="36" r="19" fill="#ffd84d"/><path d="M29 14c0-4 6-4 6 0 0 3-3 4-3 8h-1c-1-4-2-5-2-8z" fill="#7bc043"/>
  <circle cx="25" cy="33" r="3.2" fill="#2b2b2b"/><circle cx="39" cy="33" r="3.2" fill="#2b2b2b"/><circle cx="26" cy="32" r="1" fill="#fff"/><circle cx="40" cy="32" r="1" fill="#fff"/>
  <path d="M28 40l4 4 4-4z" fill="#ff9a3c"/><circle cx="20" cy="40" r="3" fill="#ff9a8a" opacity=".6"/><circle cx="44" cy="40" r="3" fill="#ff9a8a" opacity=".6"/></> },
 // Clover: a cheerful four-leaf clover
 1: { bg: '#d9f5df', body: <>
  <g fill="#3fae5a"><circle cx="24" cy="24" r="10"/><circle cx="40" cy="24" r="10"/><circle cx="24" cy="40" r="10"/><circle cx="40" cy="40" r="10"/></g>
  <circle cx="32" cy="32" r="11" fill="#6fd08a"/><circle cx="28" cy="30" r="2.6" fill="#1f3d2a"/><circle cx="36" cy="30" r="2.6" fill="#1f3d2a"/>
  <path d="M27 36c2 3 8 3 10 0" stroke="#1f3d2a" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M32 43v13" stroke="#2f8f47" strokeWidth="3" strokeLinecap="round"/></> },
 // Scout: a bright-eyed owl with round glasses
 2: { bg: '#d6ebff', body: <>
  <path d="M14 22l8 6M50 22l-8 6" stroke="#8a5a2b" strokeWidth="5" strokeLinecap="round"/><ellipse cx="32" cy="37" rx="19" ry="20" fill="#b5793b"/><ellipse cx="32" cy="43" rx="11" ry="11" fill="#f1d3a5"/>
  <circle cx="24" cy="31" r="8" fill="#fff" stroke="#2b3a67" strokeWidth="2.4"/><circle cx="40" cy="31" r="8" fill="#fff" stroke="#2b3a67" strokeWidth="2.4"/><circle cx="24" cy="31" r="3.4" fill="#222"/><circle cx="40" cy="31" r="3.4" fill="#222"/>
  <path d="M29 39l3 5 3-5z" fill="#f2a33a"/></> },
 // Atlas: a sturdy, confident robot
 3: { bg: '#e4dcff', body: <>
  <path d="M32 8v8" stroke="#5a4b9a" strokeWidth="3" strokeLinecap="round"/><circle cx="32" cy="7" r="3.2" fill="#ff6b6b"/>
  <rect x="13" y="16" width="38" height="34" rx="9" fill="#8c7ae6"/><rect x="18" y="24" width="28" height="13" rx="6" fill="#241f4a"/>
  <circle cx="26" cy="30.5" r="3.2" fill="#6ff2ff"/><circle cx="38" cy="30.5" r="3.2" fill="#6ff2ff"/><path d="M25 43h14" stroke="#241f4a" strokeWidth="3" strokeLinecap="round"/>
  <rect x="8" y="26" width="5" height="12" rx="2.5" fill="#5a4b9a"/><rect x="51" y="26" width="5" height="12" rx="2.5" fill="#5a4b9a"/></> },

 // Maple: a leaf-eared fox cub
 4: { bg: '#ffe3cf', body: <>
  <path d="M12 14l12 10-10 12zM52 14L40 24l10 12z" fill="#e8742b"/><ellipse cx="32" cy="38" rx="20" ry="18" fill="#f2893b"/><path d="M14 40c6 10 30 10 36 0-4 14-32 14-36 0z" fill="#fff4e6"/>
  <circle cx="24" cy="34" r="3" fill="#2b1a10"/><circle cx="40" cy="34" r="3" fill="#2b1a10"/><circle cx="32" cy="42" r="2.6" fill="#2b1a10"/></> },
 // Juniper: a calm bear with a berry cap
 5: { bg: '#e2f0ff', body: <>
  <circle cx="16" cy="18" r="7" fill="#7a5230"/><circle cx="48" cy="18" r="7" fill="#7a5230"/><circle cx="32" cy="36" r="21" fill="#9a6a3f"/><ellipse cx="32" cy="42" rx="10" ry="8" fill="#e8c9a0"/>
  <circle cx="24" cy="31" r="3" fill="#1e1209"/><circle cx="40" cy="31" r="3" fill="#1e1209"/><ellipse cx="32" cy="40" rx="3.6" ry="2.6" fill="#1e1209"/><circle cx="32" cy="12" r="5" fill="#4a5bd6"/></> },
 // Ember: a small dragon with a glowing cheek
 6: { bg: '#ffe0d6', body: <>
  <path d="M20 16l4 10M44 16l-4 10" stroke="#c0392b" strokeWidth="5" strokeLinecap="round"/><ellipse cx="32" cy="38" rx="20" ry="18" fill="#e74c3c"/><ellipse cx="32" cy="45" rx="11" ry="8" fill="#f6a58f"/>
  <circle cx="24" cy="33" r="3.4" fill="#fff"/><circle cx="40" cy="33" r="3.4" fill="#fff"/><circle cx="24.6" cy="33.4" r="1.7" fill="#1a1a1a"/><circle cx="40.6" cy="33.4" r="1.7" fill="#1a1a1a"/><circle cx="28" cy="45" r="1.3" fill="#7a1f14"/><circle cx="36" cy="45" r="1.3" fill="#7a1f14"/></> },
 // Harbor: a steady seal
 7: { bg: '#d9efff', body: <>
  <ellipse cx="32" cy="38" rx="21" ry="19" fill="#7e92a8"/><ellipse cx="32" cy="43" rx="13" ry="10" fill="#cfd9e3"/>
  <circle cx="24" cy="32" r="3.4" fill="#10202e"/><circle cx="40" cy="32" r="3.4" fill="#10202e"/><ellipse cx="32" cy="40" rx="3.8" ry="2.6" fill="#10202e"/>
  <path d="M20 44l-10-2M20 47l-10 3M44 44l10-2M44 47l10 3" stroke="#10202e" strokeWidth="1.6" strokeLinecap="round"/></> },
 // Quill: a thoughtful heron-like bird with a feather
 8: { bg: '#e9e4ff', body: <>
  <path d="M32 6c6 6 4 14 0 18-4-4-6-12 0-18z" fill="#6c5ce7"/><ellipse cx="32" cy="40" rx="19" ry="19" fill="#f1f2f6"/><path d="M13 40c0-10 8-16 19-16s19 6 19 16z" fill="#dfe4ea"/>
  <circle cx="25" cy="36" r="3" fill="#1d1d2b"/><circle cx="39" cy="36" r="3" fill="#1d1d2b"/><path d="M28 43l4 8 4-8z" fill="#f0a030"/></> },
 // Nova: a star-faced explorer
 9: { bg: '#1f2347', body: <>
  <path d="M32 8l6.5 14 15 1.7-11.2 10 3.2 15L32 41.2 18.5 48.7l3.2-15-11.2-10 15-1.7z" fill="#ffd34d"/>
  <circle cx="27" cy="29" r="2.8" fill="#1f2347"/><circle cx="37" cy="29" r="2.8" fill="#1f2347"/><path d="M28 35c2 2.5 6 2.5 8 0" stroke="#1f2347" strokeWidth="2" fill="none" strokeLinecap="round"/><circle cx="12" cy="52" r="1.6" fill="#fff"/><circle cx="52" cy="14" r="1.4" fill="#fff"/><circle cx="50" cy="52" r="1.2" fill="#fff"/></> },
 // Titan: a stone giant
 10: { bg: '#e9e9ee', body: <>
  <rect x="12" y="12" width="40" height="42" rx="10" fill="#8d95a3"/><path d="M12 24h40" stroke="#6c7482" strokeWidth="3"/><rect x="18" y="28" width="9" height="6" rx="3" fill="#1c2230"/><rect x="37" y="28" width="9" height="6" rx="3" fill="#1c2230"/>
  <path d="M24 44h16" stroke="#1c2230" strokeWidth="3.4" strokeLinecap="round"/><path d="M18 14l3 5M44 16l-2 6" stroke="#6c7482" strokeWidth="2" strokeLinecap="round"/></> },
 // Maximus: a crowned machine
 11: { bg: '#2a2140', body: <>
  <path d="M16 18l6 6 10-12 10 12 6-6-3 14H19z" fill="#ffc83d"/><rect x="14" y="30" width="36" height="24" rx="8" fill="#d9dde8"/><rect x="19" y="36" width="26" height="9" rx="4.5" fill="#1a1530"/>
  <circle cx="27" cy="40.5" r="2.4" fill="#ff5a5a"/><circle cx="37" cy="40.5" r="2.4" fill="#ff5a5a"/></> },
 // Gambit Gwen: a grinning fox-faced cat with a lightning scar
 12: { bg: '#ffd9e6', body: <>
  <path d="M12 12l11 10-9 12zM52 12L41 22l9 12z" fill="#e0457b"/><ellipse cx="32" cy="38" rx="20" ry="18" fill="#f05f93"/>
  <path d="M22 32l5 3-5 3M42 32l-5 3 5 3" stroke="#2b0f1c" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M24 44c3 5 13 5 16 0z" fill="#2b0f1c"/><path d="M34 22l-4 7h4l-3 7" stroke="#ffd34d" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></> },
 // Walter the Wall: a sturdy brick wall with a face
 13: { bg: '#e9e1d6', body: <>
  <rect x="9" y="14" width="46" height="40" rx="5" fill="#b4684a"/><path d="M9 27h46M9 40h46M24 14v13M42 14v13M16 27v13M34 27v13M50 27v13M24 40v14M42 40v14" stroke="#8a4a33" strokeWidth="2"/>
  <circle cx="25" cy="32" r="3.2" fill="#fff"/><circle cx="39" cy="32" r="3.2" fill="#fff"/><circle cx="25.5" cy="32.4" r="1.6" fill="#1d1d1d"/><circle cx="39.5" cy="32.4" r="1.6" fill="#1d1d1d"/><path d="M26 44h12" stroke="#4a2417" strokeWidth="2.6" strokeLinecap="round"/></> },
 // Sicilian Sam: a sunny lemon-coloured chef of the south
 14: { bg: '#fff5cc', body: <>
  <path d="M18 22c-3-10 8-14 14-8 6-6 17-2 14 8z" fill="#fff"/><rect x="18" y="20" width="28" height="6" fill="#fff"/><circle cx="32" cy="40" r="18" fill="#f6c646"/>
  <circle cx="25" cy="38" r="2.8" fill="#2b2410"/><circle cx="39" cy="38" r="2.8" fill="#2b2410"/><path d="M24 47c4 4 12 4 16 0" stroke="#2b2410" strokeWidth="2.2" fill="none" strokeLinecap="round"/><path d="M26 43c2-2 4-2 6 0 2-2 4-2 6 0" stroke="#5a3a12" strokeWidth="2" fill="none" strokeLinecap="round"/></> },
 // London Lou: a bowler-hatted gent in the fog
 15: { bg: '#dfe6ee', body: <>
  <ellipse cx="32" cy="22" rx="20" ry="4" fill="#2c3340"/><path d="M20 22c0-12 24-12 24 0z" fill="#3a4252"/><circle cx="32" cy="40" r="17" fill="#f1c9a5"/>
  <circle cx="26" cy="38" r="2.6" fill="#1d1d1d"/><circle cx="38" cy="38" r="2.6" fill="#1d1d1d"/><path d="M22 46c3 2 5 2 10 0 5 2 7 2 10 0-2 5-18 5-20 0z" fill="#6b4a2b"/></> },
 // Oops Ollie: a wobbly ghost with banana-peel luck
 16: { bg: '#e8f6e8', body: <>
  <path d="M14 54V30c0-10 8-18 18-18s18 8 18 18v24l-6-5-6 5-6-5-6 5-6-5z" fill="#fff" stroke="#aab4c0" strokeWidth="2"/>
  <circle cx="26" cy="31" r="3" fill="#1d1d1d"/><circle cx="38" cy="29" r="4.2" fill="#fff" stroke="#1d1d1d" strokeWidth="1.6"/><circle cx="38.6" cy="29.6" r="1.6" fill="#1d1d1d"/><path d="M26 41c4-3 8-1 12 1" stroke="#1d1d1d" strokeWidth="2.2" fill="none" strokeLinecap="round"/></> },

 // Tick: a stopwatch with legs-up energy
 17: { bg: '#fff0d6', body: <>
  <rect x="27" y="6" width="10" height="6" rx="2" fill="#7a5a2b"/><circle cx="32" cy="36" r="21" fill="#fff" stroke="#e08a1e" strokeWidth="4"/><path d="M32 36V22M32 36l9 5" stroke="#243044" strokeWidth="3" strokeLinecap="round"/><circle cx="32" cy="36" r="3" fill="#d9534f"/>
  <path d="M46 14l4-4" stroke="#e08a1e" strokeWidth="4" strokeLinecap="round"/><circle cx="24" cy="46" r="1.6" fill="#243044"/><circle cx="40" cy="46" r="1.6" fill="#243044"/></> },
 // Pawnless Pete: a pawn-shaped friend
 18: { bg: '#e6efe6', body: <>
  <circle cx="32" cy="18" r="9" fill="#9bb89b"/><path d="M26 28h12l4 18H22z" fill="#9bb89b"/><rect x="16" y="46" width="32" height="8" rx="4" fill="#7c987c"/>
  <circle cx="29" cy="17" r="1.8" fill="#1d2b1d"/><circle cx="35" cy="17" r="1.8" fill="#1d2b1d"/><path d="M29 22c2 2 4 2 6 0" stroke="#1d2b1d" strokeWidth="1.6" fill="none" strokeLinecap="round"/></> },
 // Knightless Kai: a knight with a jaunty grin
 19: { bg: '#dfe9f7', body: <>
  <path d="M18 54c0-14 2-22 10-28l-4-8 8 3c10 0 18 8 18 22v11z" fill="#5d7fb3"/><circle cx="34" cy="26" r="2.4" fill="#fff"/><circle cx="34.6" cy="26.4" r="1.2" fill="#1a2538"/><path d="M26 36c3 2 6 2 9 0" stroke="#1a2538" strokeWidth="2" fill="none" strokeLinecap="round"/><path d="M40 20l6-6 2 8z" fill="#3f5f94"/></> },
 // Rookless Rae: a tower with a friendly face
 20: { bg: '#f3e3ef', body: <>
  <path d="M16 14h7v6h6v-6h6v6h6v-6h7v14H16zM20 28h24l3 22H17z" fill="#b772a6"/><rect x="14" y="50" width="36" height="7" rx="3.5" fill="#9a5a8b"/>
  <circle cx="27" cy="38" r="2.4" fill="#2a1226"/><circle cx="37" cy="38" r="2.4" fill="#2a1226"/><path d="M27 44c3 3 7 3 10 0" stroke="#2a1226" strokeWidth="2" fill="none" strokeLinecap="round"/></> },
 // Queenless Quinn: a crown with a missing-queen wink
 21: { bg: '#ffe6e6', body: <>
  <path d="M12 40l4-22 10 12 6-16 6 16 10-12 4 22z" fill="#e0b13a"/><rect x="12" y="40" width="40" height="10" rx="3" fill="#c9972a"/><circle cx="16" cy="18" r="3" fill="#d9534f"/><circle cx="32" cy="14" r="3" fill="#d9534f"/><circle cx="48" cy="18" r="3" fill="#d9534f"/>
  <circle cx="26" cy="45" r="1.8" fill="#3a2a0c"/><path d="M36 45h6" stroke="#3a2a0c" strokeWidth="2" strokeLinecap="round"/></> },
 // Custom bots: a dial
 1000: { bg: '#e3e8ef', body: <>
  <circle cx="32" cy="34" r="21" fill="#fff" stroke="#5b6b82" strokeWidth="3"/><path d="M16 42a18 18 0 0 1 32 0" stroke="#aab4c0" strokeWidth="4" fill="none" strokeLinecap="round"/><path d="M32 34l10-10" stroke="#d9534f" strokeWidth="3.4" strokeLinecap="round"/><circle cx="32" cy="34" r="3.6" fill="#243044"/></> },
};
// The piece shown when avatars are set to pieces: the first four bots keep theirs, the rest follow their strength.
function pieceFor(index: number): 'p' | 'n' | 'b' | 'r' | 'q' | 'k' {
 if (index < 4) return (['p', 'n', 'b', 'q'] as const)[index];
 const elo = getBot(index).elo;
 return elo < 800 ? 'p' : elo < 1300 ? 'n' : elo < 1800 ? 'b' : elo < 2200 ? 'r' : elo < 2700 ? 'q' : 'k';
}
export default function BotAvatar({ index, size = 40 }: { index: number; size?: number }) {
 const look = useLook();
 const f = faces[index >= 1000 ? 1000 : index] ?? faces[0];
 if (look.avatars === 'pieces') return <span className="bot-face piece-portrait" role="img" aria-label="Bot avatar" style={{ width: size, height: size, borderRadius: size / 4, background: f.bg }}><Piece type={pieceFor(index)} color="b" /></span>;
 return <svg className="bot-face" viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Bot avatar" style={{ borderRadius: size / 4, background: f.bg, flex: 'none' }}>{f.body}</svg>;
}
