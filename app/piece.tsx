'use client';
import { useLook } from '../lib/look';
// "classic" is the original Chessito flat Staunton silhouettes. "rhos" is the RhosGFX set (CC0) in /public/pieces/rhos.
const shapes:Record<string,React.ReactNode>={
 p:<><circle cx="32" cy="16" r="8"/><path d="M27 24h10l-2 7c0 5 4 9 7 13H22c3-4 7-8 7-13z"/><path d="M25 25h14" fill="none"/></>,
 r:<><path d="M18 9h7v8h4V9h6v8h4V9h7v17l-6 5 1 13H23l1-13-6-5z"/><path d="M22 26h20M25 32h14" fill="none"/></>,
 n:<><path d="M19 44c0-8 6-13 13-18l-9 3-7 6-7-5 12-16 10-3 6-6 1 8c11 4 14 16 9 31z"/><path d="M37 18c5 4 7 9 6 17M17 29l7 2" fill="none"/><circle cx="28" cy="20" r="2" fill="currentColor" stroke="none"/></>,
 b:<><circle cx="32" cy="8" r="3"/><path d="M32 12c-5 5-13 10-13 17 0 6 6 10 13 10s13-4 13-10c0-7-8-12-13-17z"/><path d="M36 20l-9 11" fill="none"/><path d="M27 39h10l4 5H23z"/></>,
 q:<><path d="M14 19l8 25h20l8-25-12 12-6-17-6 17z"/><circle cx="13" cy="15" r="4"/><circle cx="32" cy="10" r="4"/><circle cx="51" cy="15" r="4"/><path d="M23 36h18M23 41h18" fill="none"/></>,
 k:<><path d="M32 5v13M26 11h12" fill="none" stroke="#24372f" strokeWidth="3.5"/><path d="M32 23c-9-11-23-4-18 7l9 14h18l9-14c5-11-9-18-18-7z"/><path d="M32 23v14M23 38h18" fill="none"/></>,
};
export default function Piece({type,color,set}:{type:string;color:string;set?:string}){
 const look=useLook();const chosen=set??look.pieces;const white=color==='w';
 if(chosen==='rhos')return <img className={`piece ${color}`} src={`/pieces/rhos/${color}${type.toUpperCase()}.svg`} alt="" aria-hidden="true" draggable={false}/>;
 return <svg aria-hidden="true" viewBox="0 0 64 64" className={`piece ${color}`} fill={white?'#fffcf0':'#24372f'} stroke={white?'#34463b':'#e9e4d5'} color={white?'#34463b':'#e9e4d5'} strokeWidth={white?2:1.5} strokeLinejoin="round" strokeLinecap="round">{shapes[type]}<path d="M22 44h20l3 5H19z"/><path d="M19 49h26l3 7H16z"/><path d="M22 52h20" fill="none" opacity=".45"/></svg>;
}
