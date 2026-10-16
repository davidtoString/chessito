'use client';
import { useEffect, useState } from 'react';
import { Copy, Trash2, KeyRound, Link2, Users, LogOut, Check, Mail } from 'lucide-react';

export type Me = { id: string; username: string; displayName: string; role: 'owner' | 'member'; signup: 'invite' | 'closed'; origin: string; email: { configured: boolean; address: string | null; verified: boolean } };
type Invite = { id: string; note: string; email: string | null; createdAt: string; expiresAt: number; maxUses: number; uses: number };
type Member = { id: string; username: string; displayName: string; email: string | null; role: string; disabled: boolean; createdAt: string; lastLoginAt: string | null; games: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function acct(path: string, method = 'GET', data?: unknown): Promise<any> {
 const r = await fetch(path, { method, headers: data ? { 'Content-Type': 'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined });
 const b = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error((b as { error?: string }).error || 'The request failed.');
 return b;
}
const when = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'never';

function Status({ ok, text }: { ok: boolean; text: string }) { return text ? <p className={ok ? 'lesson-msg ok' : 'lesson-msg'} role="status">{text}</p> : null; }

function PasswordForm() {
 const [cur, setCur] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState('');
 const [msg, setMsg] = useState({ ok: false, text: '' });
 return <form className="account-form" onSubmit={async e => {
  e.preventDefault();
  if (next !== again) { setMsg({ ok: false, text: 'The new passwords do not match.' }); return; }
  try { await acct('/account/password', 'POST', { current: cur, next }); setCur(''); setNext(''); setAgain(''); setMsg({ ok: true, text: 'Password changed. Your other devices were signed out.' }); }
  catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change the password.' }); }
 }}>
  <h3><KeyRound size={16} />Change password</h3>
  <label>Current password<input type="password" autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} required /></label>
  <label>New password<input type="password" autoComplete="new-password" minLength={10} value={next} onChange={e => setNext(e.target.value)} required /><small>At least 10 characters.</small></label>
  <label>Repeat new password<input type="password" autoComplete="new-password" minLength={10} value={again} onChange={e => setAgain(e.target.value)} required /></label>
  <button className="secondary" type="submit">Change password</button>
  <Status {...msg} />
 </form>;
}

function EmailSection({ me }: { me: Me }) {
 const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState({ ok: false, text: '' });
 if (!me.email.configured) return <div className="account-form"><h3><Mail size={16} />Email</h3><p className="muted small">Email is not set up on this server yet, so passwords cannot be reset by email. The owner can reset one from the server.</p></div>;
 return <form className="account-form" onSubmit={async e => {
  e.preventDefault(); setBusy(true); setMsg({ ok: false, text: '' });
  try { await acct('/account/email', 'POST', { email }); setMsg({ ok: true, text: `We sent a confirmation link to ${email}. The address is only used after you open it.` }); setEmail(''); }
  catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not send the email.' }); } finally { setBusy(false); }
 }}>
  <h3><Mail size={16} />Email for password reset</h3>
  <p className="muted small">{me.email.address ? <>Confirmed: <b>{me.email.address}</b>. You can reset your password by email.</> : 'Add an email address so you can reset your password if you forget it. It is only used after you open the confirmation link.'}</p>
  <label>{me.email.address ? 'Use a different address' : 'Email address'}<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
  <button className="secondary" type="submit" disabled={busy}>Send confirmation email</button>
  <Status {...msg} />
 </form>;
}

function Invites({ me }: { me: Me }) {
 const [list, setList] = useState<Invite[]>([]);
 const [days, setDays] = useState(7), [uses, setUses] = useState(1), [note, setNote] = useState(''), [addr, setAddr] = useState(''), [sent, setSent] = useState({ ok: false, text: '' });
 const [link, setLink] = useState(''), [copied, setCopied] = useState(false), [err, setErr] = useState('');
 const refresh = () => acct('/account/invites').then(b => setList(b.invites)).catch(() => {});
 useEffect(() => { void refresh(); }, []);
 if (me.signup === 'closed') return <div className="account-form"><h3><Link2 size={16} />Invite friends</h3><p className="muted small">Sign-ups are closed. Remove <code>CHESSITO_SIGNUP=closed</code> from the server settings to invite people.</p></div>;
 return <div className="account-form">
  <h3><Link2 size={16} />Invite friends</h3>
  <p className="muted small">Make a link, then send it to a friend. They choose their own username and password. Everyone’s games, puzzles and settings stay private to them.</p>
  <div className="invite-row">
   <label>Valid for<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={1}>1 day</option><option value={7}>7 days</option><option value={30}>30 days</option></select></label>
   <label>Sign-ups<select value={addr ? 1 : uses} disabled={!!addr} onChange={e => setUses(Number(e.target.value))}><option value={1}>1 person</option><option value={5}>5 people</option><option value={20}>20 people</option></select></label>
   {me.email.configured && <label>Friend’s email <small>(optional: we email them the link)</small><input type="email" value={addr} placeholder="friend@example.com" onChange={e => setAddr(e.target.value)} /></label>}
   <label>Note<input value={note} maxLength={60} placeholder="Who is it for?" onChange={e => setNote(e.target.value)} /></label>
  </div>
  <button className="primary" onClick={async () => { setErr(''); setSent({ ok: false, text: '' }); try { const b = await acct('/account/invites', 'POST', { days, uses, note, email: addr }); setLink(b.url); setCopied(false); setNote(''); if (b.email) setSent({ ok: !!b.emailed, text: b.emailed ? `Invite emailed to ${b.email}.` : b.emailError }); setAddr(''); void refresh(); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not create the link.'); } }}>{addr ? 'Create and email invite' : 'Create invite link'}</button>
  <Status {...sent} />
  {err && <p className="danger small">{err}</p>}
  {link && <div className="invite-link"><input readOnly value={link} aria-label="Invite link" onFocus={e => e.currentTarget.select()} /><button className="secondary" onClick={() => { void navigator.clipboard?.writeText(link).then(() => setCopied(true)); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy'}</button><small>Shown once. Anyone with this link can create an account until it is used up or expires.</small></div>}
  {list.length > 0 && <ul className="member-list">{list.map(i => <li key={i.id}><span><b>{i.note || i.email || 'Invite'}</b>{i.note && i.email && <small>{i.email}</small>}<small>{i.uses}/{i.maxUses} used · expires {new Date(i.expiresAt).toLocaleDateString()}</small></span><button className="text-action danger" onClick={async () => { await acct('/account/invites/revoke', 'POST', { id: i.id }).catch(() => {}); void refresh(); }}>Revoke</button></li>)}</ul>}
 </div>;
}

function Members() {
 const [list, setList] = useState<Member[]>([]); const [err, setErr] = useState('');
 const refresh = () => acct('/account/members').then(b => setList(b.members)).catch(e => setErr(e instanceof Error ? e.message : ''));
 useEffect(() => { void refresh(); }, []);
 const act = async (m: Member, action: 'disable' | 'enable' | 'delete') => {
  if (action === 'delete' && !window.confirm(`Delete ${m.displayName} (${m.username}) and all their games and settings? This cannot be undone.`)) return;
  try { await acct('/account/members', 'POST', { id: m.id, action }); void refresh(); } catch (e) { setErr(e instanceof Error ? e.message : ''); }
 };
 return <div className="account-form">
  <h3><Users size={16} />People ({list.length})</h3>
  {err && <p className="danger small">{err}</p>}
  <ul className="member-list">{list.map(m => <li key={m.id} className={m.disabled ? 'off' : ''}>
   <span><b>{m.displayName}</b> <small>@{m.username}{m.role === 'owner' ? ' · owner' : ''}{m.disabled ? ' · disabled' : ''}{m.email ? ` · ${m.email}` : ''}</small><small>{m.games} game{m.games === 1 ? '' : 's'} · joined {when(m.createdAt)} · last sign-in {when(m.lastLoginAt)}</small></span>
   {m.role !== 'owner' && <span className="member-actions"><button className="text-action" onClick={() => void act(m, m.disabled ? 'enable' : 'disable')}>{m.disabled ? 'Enable' : 'Disable'}</button><button className="text-action danger" onClick={() => void act(m, 'delete')}>Remove</button></span>}
  </li>)}</ul>
 </div>;
}

function DangerZone() {
 const [pw, setPw] = useState(''); const [err, setErr] = useState('');
 return <form className="account-form danger-zone" onSubmit={async e => {
  e.preventDefault();
  if (!window.confirm('Delete your account and all your games, puzzle progress and settings? This cannot be undone.')) return;
  try { await acct('/account/delete', 'POST', { password: pw }); window.location.href = '/login'; } catch (x) { setErr(x instanceof Error ? x.message : 'Could not delete the account.'); }
 }}>
  <h3><Trash2 size={16} />Delete my account</h3>
  <p className="muted small">Removes your account, games, puzzle progress, lesson progress and saved AI key from this server.</p>
  <label>Confirm with your password<input type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} required /></label>
  <button className="secondary danger" type="submit">Delete my account and data</button>
  {err && <p className="danger small">{err}</p>}
 </form>;
}

export default function Account({ me }: { me: Me | null }) {
 const [msg, setMsg] = useState('');
 if (!me) return null;
 return <section className="panel account-panel">
  <div className="section-top"><h2>Account</h2><span className="tiny-pill">{me.role === 'owner' ? 'OWNER' : 'MEMBER'}</span></div>
  <p>Signed in as <b>{me.displayName}</b> <span className="muted">@{me.username}</span></p>
  <div className="actions"><button className="secondary" onClick={async () => { try { await acct('/account/signout-all', 'POST', {}); setMsg('Signed out of all your other devices.'); } catch { setMsg('Could not sign out other devices.'); } }}><LogOut size={15} />Sign out other devices</button></div>
  <Status ok text={msg} />
  <PasswordForm />
  <EmailSection me={me} />
  {me.role === 'owner' && <><Invites me={me} /><Members /></>}
  {me.role !== 'owner' && <DangerZone />}
 </section>;
}
