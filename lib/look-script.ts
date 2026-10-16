// Runs before first paint (inline, with the CSP nonce) so there is no flash of the default look.
export const KEY = 'chessito-look';
export const earlyScript = `try{var d=document.documentElement,p=JSON.parse(localStorage.getItem('${KEY}')||'{}');['palette','board','pieces','font'].forEach(function(k){if(typeof p[k]==='string')d.dataset[k]=p[k]})}catch(e){}`;
