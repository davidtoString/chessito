'use client';
import {useEffect,useState} from 'react';
export default function WebApp(){
 const [online,setOnline]=useState(true);
 useEffect(()=>{setOnline(navigator.onLine);const up=()=>setOnline(true),down=()=>setOnline(false);window.addEventListener('online',up);window.addEventListener('offline',down);
  if('serviceWorker' in navigator&&window.isSecureContext&&process.env.NODE_ENV==='production')void navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
  return()=>{window.removeEventListener('online',up);window.removeEventListener('offline',down);};
 },[]);
 return <>{!online&&<div className="connection-banner" role="status">You’re offline. Pending moves stay on this device until they can sync.</div>}</>;
}
