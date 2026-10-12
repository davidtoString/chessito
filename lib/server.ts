import { getChatGPTUser } from '../app/chatgpt-auth';
import { env } from 'cloudflare:workers';
export async function identity(req: Request) {
 const u=await getChatGPTUser();if(!u)throw new Error('UNAUTHORIZED');
 if(req.method!=='GET'){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Error('FORBIDDEN');}
 return u.userId;
}
export function json(data: unknown, status=200) {return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
export function failure(e:unknown){const s=e instanceof Error?e.message:'';if(s==='UNAUTHORIZED')return json({error:'Please sign in again.'},401);if(s==='FORBIDDEN')return json({error:'Request origin is not allowed.'},403);console.error('Request failed:',s.replace(/(?:sk-|AIza)[\w-]+/g,'[redacted]'));return json({error:'The request could not be completed. Please try again.'},500);}
export async function body(req:Request){const raw=await req.text();if(raw.length>1500000)throw new Error('Request too large');return JSON.parse(raw);}
async function key(){const hex=(env as unknown as Record<string,string>).COACH_ENCRYPTION_KEY;if(!hex||!/^[0-9a-f]{64}$/i.test(hex))throw new Error('Encryption is not configured.');return crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g)!,h=>parseInt(h,16)), 'AES-GCM',false,['encrypt','decrypt']);}
export async function encrypt(value:string,user:string){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(user)},await key(),new TextEncoder().encode(value));return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...new Uint8Array(bytes)));}
export async function decrypt(value:string,user:string){const [iv,data]=value.split('.').map(s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)));return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(user)},await key(),data));}
