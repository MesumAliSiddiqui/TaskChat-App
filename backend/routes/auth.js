const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const OtpCode = require('../models/OtpCode');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/sendEmail');
const { protect, allowRoles } = require('../middleware/auth');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const router = express.Router();

// Rate limiting configurations
// Strict limiter: 5 requests per 15 minutes per IP + email combination (prevents brute force & OTP email bombing)
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later.' },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    const ip = ipKeyGenerator(req, res);
    const email = (req.body?.email || '').trim().toLowerCase();
    return `${ip}_${email}`;
  },
});

// Looser limiter: 20 requests per hour per IP (avoids blocking legitimate signups & social login retries)
const looseAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again later.' },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  },
});


const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Short-lived access token: 1 hour
const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

// Long-lived refresh token: 30 days, stored hashed in MongoDB
const generateRefreshToken = async (user) => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    expiresAt,
  });

  return rawToken;
};

// Backwards compatibility helper
const signToken = signAccessToken;

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  avatar: user.avatar,
  baseSalary: user.baseSalary,
  currentSalary: user.currentSalary,
  notificationPrefs: user.notificationPrefs,
  privacy: user.privacy,
});

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// How long an OTP code stays valid after being sent
const OTP_EXPIRY_MS = 60 * 1000; // 30 seconds

// @route POST /api/auth/send-otp
// Generates a 6-digit code, emails it, and stores it (overwriting any
// previous unused code for that email) with a 30-second expiry.
router.post('/send-otp', strictAuthLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // Remove any previous pending code for this email, then store the new one
    await OtpCode.deleteMany({ email: normalizedEmail });
    await OtpCode.create({ email: normalizedEmail, code, expiresAt });

    await sendOtpEmail(normalizedEmail, code);

    res.json({ message: 'Verification code sent to your email', expiresInSeconds: OTP_EXPIRY_MS / 1000 });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send verification code: ' + err.message });
  }
});

// Temporary diagnostic route - remove after testing
router.get('/debug-smtp', async (req, res) => {
  const net = require('net');
  const results = {};
  const testPort = (port) => new Promise((resolve) => {
    const socket = net.createConnection({ host: 'smtp.gmail.com', port, family: 4 });
    const timer = setTimeout(() => { socket.destroy(); resolve('timeout'); }, 5000);
    socket.on('connect', () => { clearTimeout(timer); socket.destroy(); resolve('success'); });
    socket.on('error', (err) => { clearTimeout(timer); resolve('error: ' + err.message); });
  });
  results.port465 = await testPort(465);
  results.port587 = await testPort(587);
  results.port25 = await testPort(25);
  res.json(results);
});

// @route POST /api/auth/verify-otp
// Checks the code, and if valid, deletes it (so it can't be reused) and
// returns success. The actual account creation still happens via /signup,
// called by the app right after this succeeds.
router.post('/verify-otp', strictAuthLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const record = await OtpCode.findOne({ email: normalizedEmail, code: code.trim() });
    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }
    if (record.expiresAt < new Date()) {
      await OtpCode.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'Code has expired. Please request a new one.' });
    }

    await OtpCode.deleteOne({ _id: record._id });
    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/signup
// Only a boss/manager should normally create employee accounts, but we allow
// open signup for the very first boss account (when no users exist yet).
// Phone number is now required and must be unique, WhatsApp-style.
// NOTE: the app is expected to call /verify-otp successfully before calling
// this route - see OTPVerificationScreen.jsx.
router.post('/signup', looseAuthLimiter, async (req, res) => {
  try {
    const { name, email, password, phone, role, reportsTo, baseSalary } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) return res.status(400).json({ message: 'Email already registered' });

    const existingPhone = await User.findOne({ phone: phone.trim() });
    if (existingPhone) return res.status(400).json({ message: 'Phone number already registered' });

    const userCount = await User.countDocuments();
    // First user in the whole system becomes boss automatically
    const finalRole = userCount === 0 ? 'boss' : role || 'employee';

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      phone: phone.trim(),
      role: finalRole,
      reportsTo: reportsTo || null,
      baseSalary: baseSalary || 0,
      currentSalary: baseSalary || 0,
    });

    const token = signAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.status(201).json({ token, refreshToken, user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Email or phone number already registered' });
    }
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/login
router.post('/login', strictAuthLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    user.isOnline = true;
    await user.save();

    const token = signAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.json({ token, refreshToken, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

// @route PATCH /api/auth/update-password
// Allows authenticated users to change their password by verifying their current password
router.patch('/update-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    req.user.password = user.password;

    const isMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/google
// Verifies the idToken issued by Google Sign-In on the client, then finds
// or creates a matching user. Google doesn't provide a phone number, so a
// new social-signup account gets a temporary placeholder phone that the
// user MUST replace via Edit Profile before phone-based contact matching
// will work for them. needsPhone tells the app to prompt for it immediately.
router.post('/google', looseAuthLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required' });

    const { OAuth2Client } = require('google-auth-library');
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });
    let needsPhone = false;

    if (!user) {
      const userCount = await User.countDocuments();
      needsPhone = true;
      user = await User.create({
        name,
        email: email.toLowerCase(),
        password: await bcrypt.hash(require('crypto').randomUUID(), 10), // unusable random password, social-only account
        phone: `pending-${require('crypto').randomUUID()}`, // placeholder, unique so schema validation passes
        role: userCount === 0 ? 'boss' : 'employee',
        avatar: picture || '',
      });
    } else if (user.phone?.startsWith('pending-')) {
      needsPhone = true;
    }

    const token = signAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.json({ token, refreshToken, user: publicUser(user), needsPhone });
  } catch (err) {
    res.status(401).json({ message: 'Google authentication failed: ' + err.message });
  }
});

// @route POST /api/auth/facebook
// Same placeholder-phone pattern as Google, since Facebook also doesn't
// reliably provide a phone number through the Graph API.
router.post('/facebook', looseAuthLimiter, async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ message: 'accessToken is required' });

    const graphRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );
    const profile = await graphRes.json();
    if (profile.error) {
      return res.status(401).json({ message: 'Facebook authentication failed: ' + profile.error.message });
    }

    const email = profile.email || `${profile.id}@facebook.placeholder`;

    let user = await User.findOne({ email: email.toLowerCase() });
    let needsPhone = false;

    if (!user) {
      const userCount = await User.countDocuments();
      needsPhone = true;
      user = await User.create({
        name: profile.name,
        email: email.toLowerCase(),
        password: await bcrypt.hash(require('crypto').randomUUID(), 10),
        phone: `pending-${require('crypto').randomUUID()}`,
        role: userCount === 0 ? 'boss' : 'employee',
        avatar: profile.picture?.data?.url || '',
      });
    } else if (user.phone?.startsWith('pending-')) {
      needsPhone = true;
    }

    const token = signAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.json({ token, refreshToken, user: publicUser(user), needsPhone });
  } catch (err) {
    res.status(401).json({ message: 'Facebook authentication failed: ' + err.message });
  }
});

// @route POST /api/auth/refresh
// Exchanges a valid refresh token for a new 1-hour access token + rotated refresh token
router.post('/refresh', strictAuthLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const tokenHash = hashToken(refreshToken);
    const record = await RefreshToken.findOne({ tokenHash }).populate('user');

    if (!record || !record.user || record.expiresAt < new Date()) {
      if (record) await RefreshToken.deleteOne({ _id: record._id });
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    // Issue new short-lived access token
    const token = signAccessToken(record.user);

    // Rotate refresh token (revoke old token, issue new token)
    await RefreshToken.deleteOne({ _id: record._id });
    const newRefreshToken = await generateRefreshToken(record.user);

    res.json({
      token,
      refreshToken: newRefreshToken,
      user: publicUser(record.user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/logout
// Revokes the refresh token so it cannot be used again
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await RefreshToken.deleteOne({ tokenHash });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route POST /api/auth/forgot-password
// Generates a 6-digit password reset code, emails it via sendPasswordResetEmail,
// and stores it in OtpCode with a 10-minute expiry.
router.post('/forgot-password', strictAuthLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    const code = generateCode();
    const RESET_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
    const expiresAt = new Date(Date.now() + RESET_EXPIRY_MS);

    // Remove any previous pending codes for this email and store the new code
    await OtpCode.deleteMany({ email: normalizedEmail });
    await OtpCode.create({ email: normalizedEmail, code, expiresAt });

    await sendPasswordResetEmail(normalizedEmail, code);

    res.json({
      message: 'Password reset code sent to your email',
      expiresInSeconds: RESET_EXPIRY_MS / 1000,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to send password reset code: ' + err.message });
  }
});

// @route POST /api/auth/reset-password
// Verifies the reset code, hashes and updates the new password, then deletes the used code.
router.post('/reset-password', strictAuthLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = await OtpCode.findOne({ email: normalizedEmail, code: code.trim() });

    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }
    if (record.expiresAt < new Date()) {
      await OtpCode.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'Code has expired. Please request a new one.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    // Delete the used code so it cannot be reused
    await OtpCode.deleteOne({ _id: record._id });

    // Revoke all active refresh tokens for this user for security
    await RefreshToken.deleteMany({ user: user._id });

    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.strictAuthLimiter = strictAuthLimiter;
router.looseAuthLimiter = looseAuthLimiter;
router.signAccessToken = signAccessToken;
router.generateRefreshToken = generateRefreshToken;
router.hashToken = hashToken;

module.exports = router;