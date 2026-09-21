const https = require('https');

// Calls Brevo's REST API directly over HTTPS (port 443) - no SDK needed,
// which avoids any package version/export-shape mismatches.
// This also avoids Railway's outbound SMTP port blocking entirely.
// Set these in your Railway environment variables:
//   BREVO_API_KEY=xkeysib-xxxxxxxxxxxx
//   EMAIL_FROM_ADDRESS=mesumalisiddiqui@gmail.com   (your verified sender)
//   EMAIL_FROM_NAME=TaskChat

const sendViaBrevo = ({ to, subject, text, html }) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      sender: {
        email: process.env.EMAIL_FROM_ADDRESS,
        name: process.env.EMAIL_FROM_NAME || 'TaskChat',
      },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    });

    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body || '{}'));
        } else {
          reject(new Error(`Brevo API error (${res.statusCode}): ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
};

const sendOtpEmail = async (toEmail, code) => {
  await sendViaBrevo({
    to: toEmail,
    subject: 'Your TaskChat verification code',
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #6366F1;">TaskChat Verification</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111827; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #9CA3AF; font-size: 13px;">This code expires in 30 second. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (toEmail, code) => {
  await sendViaBrevo({
    to: toEmail,
    subject: 'TaskChat Password Reset Code',
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request a password reset, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px; background-color: #111827; color: #F9FAFB; border-radius: 12px;">
        <h2 style="color: #6366F1; margin-top: 0;">TaskChat Security</h2>
        <p style="font-size: 15px; line-height: 22px;">We received a request to reset your TaskChat account password. Use the verification code below to set a new password:</p>
        <div style="font-size: 34px; font-weight: bold; letter-spacing: 10px; color: #6366F1; background: #1F2937; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 24px 0;">
          ${code}
        </div>
        <p style="color: #9CA3AF; font-size: 13px; line-height: 18px;">This code is valid for 10 minutes. If you didn't request a password reset, you can safely disregard this email.</p>
      </div>
    `,
  });
};

module.exports = { sendOtpEmail, sendPasswordResetEmail };