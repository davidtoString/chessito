'use client';
import {ThemeProvider,useTheme} from 'next-themes';
import {useEffect,useState} from 'react';
import {Sun,Moon,Monitor} from 'lucide-react';
import {useLook,setLook,palettes,boards,fonts,avatarStyles} from '../lib/look';
import {pieceSetList,pieceGroups} from '../lib/piece-sets';
import BotAvatar from './bot-avatar';
import {soundSets,getSoundSet,setSoundSet,getVolume,setVolume,soundOn,setSound,play,preload,type Kind} from '../lib/sound';
import Piece from './piece';
export function AppearanceProvider({children,nonce}:{children:React.ReactNode;nonce?:string}){return <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem nonce={nonce} storageKey="chessito-theme">{children}</ThemeProvider>;}
export function ThemeToggle(){const {resolvedTheme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const dark=mounted&&resolvedTheme==='dark';return <button className="theme-toggle" aria-label={dark?'Switch to light mode':'Switch to dark mode'} title={dark?'Switch to light mode':'Switch to dark mode'} onClick={()=>setTheme(dark?'light':'dark')}>{dark?<Sun size={19}/>:<Moon size={19}/>}</button>;}
export function AppearanceSettings(){const {theme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const look=useLook();
 return <section className="panel appearance-settings"><h2>Appearance</h2><p>Choose how Chessito looks. These choices are remembered on this device.</p>
  <div className="look-group"><h3>Mode</h3><div className="appearance-options">{[['light','Light',Sun],['dark','Dark',Moon],['system','System',Monitor]].map(([id,label,Icon])=>{const Component=Icon as typeof Sun;return <button className={mounted&&theme===id?'chosen':''} key={id as string} aria-pressed={mounted&&theme===id} onClick={()=>setTheme(id as string)}><Component size={19}/>{label as string}</button>;})}</div></div>
  <div className="look-group"><h3>Colour palette</h3><div className="look-options">{palettes.map(p=><button key={p.id} className={look.palette===p.id?'look-option chosen':'look-option'} aria-pressed={look.palette===p.id} onClick={()=>setLook({palette:p.id})}><span className="swatch" style={{background:p.swatch}}/>{p.label}</button>)}</div></div>
  <div className="look-group"><h3>Board colours</h3><div className="look-options">{boards.map(b=><button key={b.id} className={look.board===b.id?'look-option chosen':'look-option'} aria-pressed={look.board===b.id} onClick={()=>setLook({board:b.id})}><span className="mini-board"><i style={{background:b.light}}/><i style={{background:b.dark}}/><i style={{background:b.dark}}/><i style={{background:b.light}}/></span>{b.label}</button>)}</div></div>
  <div className="look-group"><h3>Pieces <small>{pieceSetList.length} sets</small></h3>{pieceGroups.map(g=><div key={g.id} className="piece-group"><h4>{g.title}</h4><p className="muted small">{g.note}</p><div className="look-options">{pieceSetList.filter(p=>p.group===g.id).map(p=><button key={p.id} className={look.pieces===p.id?'look-option chosen':'look-option'} aria-pressed={look.pieces===p.id} title={`${p.label} · ${p.author} · ${p.license}`} onClick={()=>setLook({pieces:p.id})}><span className="piece-preview"><span><Piece type="n" color="w" set={p.id}/></span><span><Piece type="q" color="b" set={p.id}/></span></span>{p.label}<small>{p.license}</small></button>)}</div></div>)}
   <details className="credits"><summary>Credits &amp; licenses</summary><ul>{pieceSetList.filter(p=>p.id!=='classic').map(p=><li key={p.id}><b>{p.label}</b> by {p.url?<a href={p.url} target="_blank" rel="noreferrer">{p.author}</a>:p.author} · {p.license}</li>)}</ul><p className="muted small">Most sets come from the <a href="https://github.com/lichess-org/lila/tree/master/public/piece" target="_blank" rel="noreferrer">Lichess repository</a>.</p></details></div>
  <div className="look-group"><h3>Bot avatars</h3><div className="look-options">{avatarStyles.map(a=><button key={a.id} className={look.avatars===a.id?'look-option chosen':'look-option'} aria-pressed={look.avatars===a.id} onClick={()=>setLook({avatars:a.id})}><span className="avatar-preview">{[0,1,2,3].map(n=><BotAvatar key={n} index={n} size={30}/>)}</span>{a.label}</button>)}</div></div>
  <SoundSettings/>
  <div className="look-group"><h3>Font</h3><div className="look-options">{fonts.map(f=><button key={f.id} className={look.font===f.id?'look-option chosen':'look-option'} aria-pressed={look.font===f.id} onClick={()=>setLook({font:f.id})} style={{fontFamily:f.id==='clean'?'Inter':f.id==='soft'?'Nunito':'Sora'}}><span className="font-sample">Aa</span>{f.label}</button>)}</div></div>
 </section>;}

const previews:[Kind,string][]=[['move','Move'],['capture','Capture'],['check','Check'],['checkmate','Mate'],['win','Win'],['lose','Lose']];
function SoundSettings(){
 const [snd,setSnd]=useState({set:'sfx',vol:0.8,on:true});
 useEffect(()=>{setSnd({set:getSoundSet(),vol:getVolume(),on:soundOn()});},[]);
 return <div className="look-group"><h3>Sounds</h3>
  <div className="sound-controls"><label><input type="checkbox" checked={snd.on} onChange={e=>{setSound(e.target.checked);setSnd({...snd,on:e.target.checked});}}/> Sound on</label>
   <label className="sound-volume">Volume <input type="range" min={0} max={100} value={Math.round(snd.vol*100)} aria-label="Volume" onChange={e=>{setVolume(Number(e.target.value)/100);setSnd({...snd,vol:Number(e.target.value)/100});}} onPointerUp={()=>play('capture',{force:true})}/></label></div>
  <div className="sound-sets">{soundSets.map(s=><div key={s.id} className={snd.set===s.id?'sound-set chosen':'sound-set'}>
   <button className="sound-pick" aria-pressed={snd.set===s.id} onClick={()=>{setSoundSet(s.id);setSnd({...snd,set:s.id});void preload(s.id).then(()=>play('move',{set:s.id,force:true}));}}><b>{s.label}</b><small>{s.author} · {s.license}{s.group==='nc'?' · non-commercial':''}</small></button>
   <div className="sound-previews">{previews.map(([k,l])=><button key={k} onClick={()=>{void preload(s.id).then(()=>play(k,{set:s.id,force:true}));}}>{l}</button>)}</div></div>)}</div>
  <p className="muted small">Recordings come from the <a href="https://github.com/lichess-org/lila/tree/master/public/sound" target="_blank" rel="noreferrer">Lichess repository</a>; credits are in <code>public/sounds/CREDITS.md</code>.</p>
 </div>;
}
