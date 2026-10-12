const shapes:Record<string,React.ReactNode>={
 p:<><circle cx="24" cy="13" r="6"/><path d="M19 19h10l-2 8 6 9H15l6-9z"/><path d="M14 36h20l2 6H12z"/></>,
 r:<><path d="M13 7h6v6h4V7h4v6h4V7h6v13l-5 4 1 12H15l1-12-3-4z"/><path d="M13 36h22l2 6H11zM17 21h14"/></>,
 n:<><path d="M13 35c1-9 13-12 15-19l-9 5-5 7-7-4 8-13 7-3 5-5 1 6c10 2 12 14 9 26z"/><circle cx="21" cy="14" r="1.2" fill="currentColor"/><path d="M12 36h25l2 6H10z"/></>,
 b:<><path d="M24 5c-3 5-11 9-10 15 0 5 5 8 10 8s10-3 10-8c1-6-7-10-10-15zM27 12l-6 9M20 28h8l4 8H16z"/><path d="M13 36h22l3 6H10z"/></>,
 q:<><path d="M10 14l5 19h18l5-19-10 10-4-13-4 13zM15 33h18v4H15zM12 37h24l2 5H10z"/><circle cx="9" cy="11" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="39" cy="11" r="3"/></>,
 k:<><path d="M24 3v12M19 8h10" fill="none"/><path d="M24 18c-7-9-17-2-12 6l6 9h12l6-9c5-8-5-15-12-6zM17 33h14l2 4H15zM13 37h22l2 5H11z"/></>,
};
export default function Piece({type,color}:{type:string;color:string}){return <svg aria-hidden="true" viewBox="0 0 48 48" className={`piece ${color}`} fill={color==='w'?'#fff9eb':'#263c33'} stroke={color==='w'?'#526357':'#13251e'} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">{shapes[type]}</svg>;}
