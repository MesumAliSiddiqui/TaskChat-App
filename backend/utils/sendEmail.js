const nodemailer = require('nodemailer');

// Uses Gmail SMTP with an App Password (NOT your regular Gmail password —
// see setup instructions for generating one). Set these in your .env:
//   EMAIL_USER=youraddress@gmail.com
//   EMAIL_PASS=your_16_character_app_password
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for port 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000, // fail fast (10s) instead of hanging for a minute
});

const sendOtpEmail = async (toEmail, code) => {
  await transporter.sendMail({
    from: `"TaskChat" <${process.env.EMAIL_USER}>`,
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
        <p style="color: #9CA3AF; font-size: 13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (toEmail, code) => {
  await transporter.sendMail({
    from: `"TaskChat" <${process.env.EMAIL_USER}>`,
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