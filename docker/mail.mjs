// Transactional email through Resend (https://resend.com). Off unless RESEND_API_KEY and CHESSITO_EMAIL_FROM are set.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mailConfig(env = process.env) {
 const key = env.RESEND_API_KEY, from = env.CHESSITO_EMAIL_FROM;
 return key && from ? { key, from, api: (env.RESEND_API_URL || 'https://api.resend.com').replace(/\/$/, '') } : null;
}

export async function sendMail(cfg, { to, subject, html, text }) {
 const r = await fetch(`${cfg.api}/emails`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ from: cfg.from, to: [to], subject, html, text }),
  signal: AbortSignal.timeout(10000),
 });
 if (!r.ok) throw new Error(`Resend returned HTTP ${r.status}`);   // never include the key or the response body in errors
 return true;
}

const layout = (heading, paragraphs, button, url, footer) => `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f5fa;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px;padding:32px">
<tr><td style="font-size:26px;font-weight:800;letter-spacing:-1px">chessito<span style="color:#5d8a2f">.</span></td></tr>
<tr><td style="padding-top:18px;font-size:20px;font-weight:700">${esc(heading)}</td></tr>
${paragraphs.map(p => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#475467">${p}</td></tr>`).join('')}
<tr><td style="padding-top:24px"><a href="${esc(url)}" style="display:inline-block;background:#5d8a2f;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px">${esc(button)}</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#667085;word-break:break-all">Or paste this link into your browser:<br>${esc(url)}</td></tr>
<tr><td style="padding-top:18px;font-size:12px;color:#667085">${footer}</td></tr></table></td></tr></table></body></html>`;

export const inviteEmail = ({ inviter, url, days }) => ({
 subject: `${inviter} invited you to Chessito`,
 text: `${inviter} invited you to Chessito, a private chess practice room.\n\nCreate your account: ${url}\n\nThe link works for ${days} day${days === 1 ? '' : 's'}. If you were not expecting this, you can ignore the email.`,
 html: layout('You are invited', [`<b>${esc(inviter)}</b> invited you to Chessito, a private chess practice room with bots, puzzles, lessons and game review.`, `Your games and progress stay private to your account. The link works for ${days} day${days === 1 ? '' : 's'}.`], 'Create my account', url, 'If you were not expecting this, you can ignore the email.'),
});
export const resetEmail = ({ name, url }) => ({
 subject: 'Reset your Chessito password',
 text: `Hi ${name},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you did not ask for this, ignore the email: your password stays the same.`,
 html: layout('Reset your password', [`Hi ${esc(name)}, use the button below to choose a new password. The link works for 1 hour and only once.`], 'Choose a new password', url, 'If you did not ask for this, ignore the email: your password stays the same.'),
});
export const verifyEmail = ({ name, url }) => ({
 subject: 'Confirm your email for Chessito',
 text: `Hi ${name},\n\nConfirm this address so you can reset your password by email later:\n${url}\n\nIf you did not ask for this, ignore the email.`,
 html: layout('Confirm your email', [`Hi ${esc(name)}, confirm this address so you can reset your password by email if you ever forget it.`], 'Confirm my email', url, 'If you did not ask for this, ignore the email.'),
});
export const testEmail = () => ({ subject: 'Chessito email test', text: 'Email is working. Chessito can send invites and password resets.', html: layout('Email is working', ['Chessito can send invites and password resets.'], 'Open Chessito', 'https://example.com', 'This was a test message.') });
