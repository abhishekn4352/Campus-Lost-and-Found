const nodemailer = require('nodemailer');
const { escapeHtml } = require('./escapeHtml');

// Bounded timeouts are essential here: without them, an unreachable SMTP
// server (wrong credentials, blocked network egress, provider outage)
// causes sendMail() to hang indefinitely, which in turn hangs the
// request-otp/send-message HTTP request forever instead of failing with
// a clean, catchable error.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  connectionTimeout: 10000, // time to establish the TCP connection
  greetingTimeout: 10000,   // time to wait for the SMTP greeting after connecting
  socketTimeout: 15000,     // time to wait for activity on the socket once connected
});

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');

// One shared, table-free layout so every email looks the same. All dynamic
// values must be passed through escapeHtml() by the caller.
function layout({ heading, bodyHtml, cta }) {
  const button = cta
    ? `<div style="margin:28px 0 8px"><a href="${cta.href}" style="background:#14213d;color:#ffffff;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${cta.label}</a></div>`
    : '';
  return `
  <div style="background:#f3f5f7;padding:32px 16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #dde3e9;padding:32px">
      <div style="font-size:13px;font-weight:700;color:#14213d;letter-spacing:.02em;margin-bottom:20px">Campus Lost &amp; Found</div>
      <h2 style="margin:0 0 12px;color:#14202b;font-size:20px;line-height:1.3">${heading}</h2>
      <div style="color:#41505e;font-size:15px;line-height:1.6">${bodyHtml}</div>
      ${button}
    </div>
    <p style="text-align:center;color:#8896a3;font-size:12px;margin:16px 0 0">You are receiving this because you have an account on Campus Lost &amp; Found.</p>
  </div>`;
}

// In development (no SMTP credentials) print the email instead of failing,
// so the whole app — including OTP sign-up — can be exercised locally.
// In production this is never reached: validateEnv() refuses to boot
// without credentials.
async function deliver({ to, subject, html, devText }) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email is not configured.');
    console.log(`\n[DEV EMAIL] to=${to} subject="${subject}"\n${devText}\n`);
    return;
  }
  await transporter.sendMail({
    from: `"Campus Lost & Found" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

exports.sendOTPEmail = async (toEmail, toName, otp, purposeLabel = null) => {
  const subject = 'Your verification code';
  const intro = purposeLabel
    ? `Use this code to ${escapeHtml(purposeLabel)}.`
    : 'Use this code to verify your account or sign in.';
  await deliver({
    to: toEmail,
    subject,
    devText: `OTP for ${toEmail}: ${otp}`,
    html: layout({
      heading: `Hi ${escapeHtml(toName || 'there')},`,
      bodyHtml: `
        <p style="margin:0 0 16px">${intro}</p>
        <div style="background:#14213d;color:#ffd23f;border-radius:10px;padding:18px;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px">${escapeHtml(otp)}</div>
        <p style="margin:16px 0 0;font-size:13px;color:#6b7a88">The code expires in 10 minutes. If you didn't ask for it, you can ignore this email.</p>`,
    }),
  });
};

exports.sendMessageEmail = async (toEmail, toName, senderName, itemTitle) => {
  await deliver({
    to: toEmail,
    subject: `New message about "${String(itemTitle).slice(0, 80)}"`,
    devText: `New message for ${toEmail} from ${senderName} about ${itemTitle}`,
    html: layout({
      heading: `Hi ${escapeHtml(toName)},`,
      bodyHtml: `<p style="margin:0"><strong>${escapeHtml(senderName)}</strong> sent you a message about <strong>${escapeHtml(itemTitle)}</strong>.</p>`,
      cta: { href: `${frontendUrl()}/messages`, label: 'Open conversation' },
    }),
  });
};

exports.sendClaimReceivedEmail = async (toEmail, toName, claimantName, itemTitle) => {
  await deliver({
    to: toEmail,
    subject: `Someone wants to claim "${String(itemTitle).slice(0, 80)}"`,
    devText: `Claim on "${itemTitle}" by ${claimantName} → ${toEmail}`,
    html: layout({
      heading: `Hi ${escapeHtml(toName)},`,
      bodyHtml: `<p style="margin:0"><strong>${escapeHtml(claimantName)}</strong> submitted a claim for <strong>${escapeHtml(itemTitle)}</strong> and described how they can prove it is theirs. Review it and approve or reject.</p>`,
      cta: { href: `${frontendUrl()}/claims`, label: 'Review claim' },
    }),
  });
};

exports.sendClaimResultEmail = async (toEmail, toName, itemTitle, approved, note) => {
  await deliver({
    to: toEmail,
    subject: approved ? `Your claim for "${String(itemTitle).slice(0, 80)}" was approved` : `Update on your claim for "${String(itemTitle).slice(0, 80)}"`,
    devText: `Claim ${approved ? 'approved' : 'rejected'} for ${toEmail}: ${itemTitle}`,
    html: layout({
      heading: approved ? 'Your claim was approved' : 'Your claim was not approved',
      bodyHtml: `
        <p style="margin:0 0 12px">Hi ${escapeHtml(toName)}, your claim for <strong>${escapeHtml(itemTitle)}</strong> was ${approved ? 'approved' : 'not approved'}.</p>
        ${note ? `<p style="margin:0 0 12px;padding:12px;background:#f3f5f7;border-radius:8px">${escapeHtml(note)}</p>` : ''}
        ${approved ? '<p style="margin:0">Open the chat to arrange the handover.</p>' : ''}`,
      cta: { href: `${frontendUrl()}${approved ? '/messages' : '/claims'}`, label: approved ? 'Arrange handover' : 'View my claims' },
    }),
  });
};

exports.sendEmailChangedNotice = async (oldEmail, name, newEmail) => {
  await deliver({
    to: oldEmail,
    subject: 'Your email address was changed',
    devText: `Email changed for ${name}: ${oldEmail} -> ${newEmail}`,
    html: layout({
      heading: `Hi ${escapeHtml(name)},`,
      bodyHtml: `<p style="margin:0 0 12px">The email on your Campus Lost &amp; Found account was changed to <strong>${escapeHtml(newEmail)}</strong>.</p>
        <p style="margin:0">If this wasn't you, contact a campus admin right away — your old address will no longer receive codes.</p>`,
    }),
  });
};
