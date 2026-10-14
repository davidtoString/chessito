'use client';
import {useEffect,useState} from 'react';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function WebApp(){
 const [online,setOnline]=useState(true);const [prompt,setPrompt]=useState<InstallPrompt|null>(null);const [open,setOpen]=useState(false);
 useEffect(()=>{setOnline(navigator.onLine);const up=()=>setOnline(true),down=()=>setOnline(false);const install=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt);};window.addEventListener('online',up);window.addEventListener('offline',down);window.addEventListener('beforeinstallprompt',install);
  if('serviceWorker' in navigator&&window.isSecureContext&&process.env.NODE_ENV==='production')void navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
  return()=>{window.removeEventListener('online',up);window.removeEventListener('offline',down);window.removeEventListener('beforeinstallprompt',install);};
 },[]);
 return <>{!online&&<div className="connection-banner" role="status">You’re offline. Pending moves stay on this device until they can sync.</div>}<button className="install-app" onClick={async()=>{if(prompt){await prompt.prompt();if((await prompt.userChoice).outcome==='accepted')setPrompt(null);}else setOpen(!open);}}>Install app</button>{open&&<div className="install-help" role="status"><strong>Add Chessito to your phone</strong><p>iPhone: Safari → Share → Add to Home Screen.</p><p>Android: your browser menu → Install app or Add to Home screen.</p><p>Installation needs an HTTPS address. You can also play directly in your phone’s browser.</p><button onClick={()=>setOpen(false)}>Got it</button></div>}</>;
}
