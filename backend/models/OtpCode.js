const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  code: { type: String, required: true },
  // TTL index below auto-deletes this document once expiresAt passes,
  // so expired codes clean themselves up without a cron job.
  expiresAt: { type: Date, required: true },
});

otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);