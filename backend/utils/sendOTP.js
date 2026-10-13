const nodemailer = require('nodemailer');

// Bounded timeouts are essential here: without them, an unreachable SMTP
// server (wrong credentials, blocked network egress, provider outage)
// causes sendMail() to hang indefinitely, which in turn hangs the
// request-otp/send-message HTTP request forever instead of failing with
// a clean, catchable error. Verified live: without these, a POST to
// /auth/request-otp against an unreachable SMTP target never returned.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  connectionTimeout: 10000, // time to establish the TCP connection
  greetingTimeout: 10000,   // time to wait for the SMTP greeting after connecting
  socketTimeout: 15000,     // time to wait for activity on the socket once connected
});

exports.sendOTPEmail = async (toEmail, toName, otp, itemTitle = null) => {
  const subject = itemTitle ? 'Your OTP to claim item' : 'Your Authentication OTP';
  const subtitle = itemTitle 
    ? `You requested to claim: <strong style="color: #4f46e5;">${itemTitle}</strong>`
    : `Please use the code below to verify your account or sign in.`;

  await transporter.sendMail({
    from: `"Campus Lost & Found" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: subject,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px;">
        <div style="background: white; border-radius: 12px; padding: 30px; text-align: center;">
          <h2 style="color: #1a1a2e; margin-bottom: 8px;">Hello ${toName || 'User'},</h2>
          <p style="color: #555; font-size: 15px;">${subtitle}</p>
          <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h1 style="color: white; letter-spacing: 10px; margin: 0; font-size: 36px;">${otp}</h1>
          </div>
          <p style="color: #888; font-size: 13px;">This OTP expires in <strong>10 minutes</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #aaa; font-size: 11px;">Campus Lost & Found Portal</p>
        </div>
      </div>
    `,
  });
};

exports.sendMessageEmail = async (toEmail, toName, senderName, itemTitle) => {
  await transporter.sendMail({
    from: `"Campus Lost & Found" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `New Message: ${senderName} about "${itemTitle}"`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px;">
        <div style="background: white; border-radius: 12px; padding: 30px; text-align: center;">
          <div style="font-size: 40px; margin-bottom: 20px;">💬</div>
          <h2 style="color: #1a1a2e; margin-bottom: 8px;">Hello ${toName},</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.5;">
            <strong>${senderName}</strong> sent you a message regarding the item: <br/>
            <strong style="color: #4f46e5;">${itemTitle}</strong>
          </p>
          <div style="margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL}/messages" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block;">
              Reply Now
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">Login to the portal to view the full conversation and coordinate the return.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #aaa; font-size: 11px;">Campus Lost & Found Portal</p>
        </div>
      </div>
    `,
  });
};
