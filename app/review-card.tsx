'use client';
import { Sparkles, ChevronRight } from 'lucide-react';
import type { ReviewMove } from '../lib/chess';
import { classes, classOrder, classCounts, gameAccuracy, winPercent, type Cls } from '../lib/review';

type Props = {
 reviews: ReviewMove[];
 byPly: Map<number, Cls>;
 ply: number;
 total: number;
 onGo: (ply: number) => void;
 white: string;
 black: string;
 busy: string;
 progress: { done: number; total: number };
 canAnalyze: boolean;
 onAnalyze: () => void;
 onStop: () => void;
};

export function ClassBadge({ cls }: { cls: Cls }) {
 const c = classes[cls];
 return <span className="cls-dot" style={{ background: c.color }} title={c.label} aria-label={c.label}>{c.symbol}</span>;
}

function Graph({ reviews, byPly, ply, total, onGo }: Pick<Props, 'reviews' | 'byPly' | 'ply' | 'total' | 'onGo'>) {
 const W = 360, H = 84;
 const pts = [...reviews].sort((a, b) => a.ply - b.ply).map(r => ({ ply: r.ply, w: winPercent(r.after) }));
 if (reviews.length) pts.unshift({ ply: 0, w: winPercent(reviews[0].before) });
 const x = (p: number) => total ? p / total * W : 0;
 const y = (w: number) => H - w / 100 * H;
 const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.ply).toFixed(1)} ${y(p.w).toFixed(1)}`).join(' ');
 const area = pts.length ? `${line} L${x(pts[pts.length - 1].ply).toFixed(1)} ${H} L${x(pts[0].ply).toFixed(1)} ${H} Z` : '';
 return <svg className="eval-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evaluation graph. Click to jump to a move."
  onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onGo(Math.max(0, Math.min(total, Math.round((e.clientX - r.left) / r.width * total)))); }}>
  <rect width={W} height={H} fill="#403d39" />
  <path d={area} fill="#f1f0ee" />
  <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#8884" strokeWidth="1" />
  {pts.filter(p => { const c = byPly.get(p.ply); return c === 'mistake' || c === 'blunder' || c === 'brilliant'; }).map(p =>
   <circle key={p.ply} cx={x(p.ply)} cy={y(p.w)} r="3.2" fill={classes[byPly.get(p.ply)!].color} stroke="#262421" strokeWidth=".8" />)}
  <line x1={x(ply)} x2={x(ply)} y1="0" y2={H} stroke="#81b64c" strokeWidth="2" />
 </svg>;
}

export default function ReviewCard(p: Props) {
 const { reviews, byPly } = p;
 const wAcc = gameAccuracy(reviews, 'w'), bAcc = gameAccuracy(reviews, 'b');
 const wc = classCounts(byPly, reviews, 'w'), bc = classCounts(byPly, reviews, 'b');
 const bad = reviews.filter(r => { const c = byPly.get(r.ply); return c === 'mistake' || c === 'blunder'; }).map(r => r.ply).sort((a, b) => a - b);
 const next = bad.find(n => n > p.ply) ?? bad[0];
 const analyzing = p.busy === 'Analyzing game';
 const fmt = (a: number | null) => a === null ? '—' : a.toFixed(1);
 return <section className="review-card" aria-label="Game review">
  <div className="section-top"><h2>Game review</h2>
   {analyzing ? <button className="secondary" onClick={p.onStop}>Stop</button>
    : <button className="primary" disabled={!!p.busy || !p.canAnalyze} onClick={p.onAnalyze}><Sparkles size={15} />{reviews.length ? 'Analyze again' : 'Analyze game'}</button>}
  </div>
  {analyzing && <div className="review-progress" role="progressbar" aria-valuemin={0} aria-valuemax={p.progress.total} aria-valuenow={p.progress.done}><span style={{ width: `${p.progress.total ? p.progress.done / p.progress.total * 100 : 0}%` }} /><small>{p.progress.done} / {p.progress.total} moves</small></div>}
  {reviews.length > 0 ? <>
   <div className="accuracy-row">
    <div><span className="acc-chip white" /><small>{p.white}</small><strong>{fmt(wAcc)}</strong><em>Accuracy</em></div>
    <div><span className="acc-chip black" /><small>{p.black}</small><strong>{fmt(bAcc)}</strong><em>Accuracy</em></div>
   </div>
   <Graph reviews={reviews} byPly={byPly} ply={p.ply} total={p.total} onGo={p.onGo} />
   <table className="class-table"><tbody>
    {classOrder.filter(c => wc[c] || bc[c]).map(c => <tr key={c}><td className="num">{wc[c] || ''}</td><td className="name"><ClassBadge cls={c} />{classes[c].label}</td><td className="num">{bc[c] || ''}</td></tr>)}
   </tbody></table>
   {next !== undefined && <button className="secondary full" onClick={() => p.onGo(next)}>Next mistake<ChevronRight size={15} /></button>}
   <small className="muted">Accuracy uses Lichess’s open win-probability curve on short engine searches. Estimates, not chess.com’s numbers.</small>
  </> : !analyzing && <p className="muted">Run the analysis to see accuracy, move ratings and an evaluation graph.</p>}
 </section>;
}
