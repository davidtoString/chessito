'use client';
import { useLook } from '../lib/look';
import Piece from './piece';
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
};
export default function BotAvatar({ index, size = 40 }: { index: number; size?: number }) {
 const look = useLook();
 const f = faces[index] ?? faces[0];
 if (look.avatars === 'pieces') return <span className="bot-face piece-portrait" role="img" aria-label="Bot avatar" style={{ width: size, height: size, borderRadius: size / 4, background: f.bg }}><Piece type={['p', 'n', 'b', 'q'][index] ?? 'p'} color="b" /></span>;
 return <svg className="bot-face" viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Bot avatar" style={{ borderRadius: size / 4, background: f.bg, flex: 'none' }}>{f.body}</svg>;
}
