const mongoose = require('mongoose');
const dns = require('dns');

// Prefer IPv4 for consistent address resolution across dual-stack environments
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

/**
 * Returns prioritized fallback DNS servers to resolve MongoDB Atlas SRV records
 * if the system's default DNS resolver fails or blocks UDP port 53.
 * Can be customized via DNS_SERVERS in .env (e.g. DNS_SERVERS=1.1.1.1,8.8.8.8).
 */
const getFallbackDnsServers = () => {
  if (process.env.DNS_SERVERS) {
    return process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return ['1.1.1.1', '8.8.8.8', '1.0.0.1', '8.8.4.4'];
};

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 5000, // Fail fast (5s) instead of hanging 30s
  connectTimeoutMS: 10000,        // 10s initial connection timeout
  socketTimeoutMS: 45000,         // 45s socket inactivity timeout
  heartbeatFrequencyMS: 10000,    // Health check ping every 10s
  maxPoolSize: 10,                // Connection pool sizing
  minPoolSize: 1,
};

let isConnecting = false;

/**
 * Connects to MongoDB with robust connection options, lifecycle listeners,
 * and automatic DNS resolution fallback if the system DNS cannot resolve MongoDB SRV records.
 */
const connectDB = async (retryCount = 0) => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('❌ MONGO_URI is not defined in environment variables (.env)');
    return;
  }

  if (mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }

  isConnecting = true;

  try {
    await mongoose.connect(uri, MONGO_OPTIONS);
    console.log('✔ MongoDB connected successfully');
    isConnecting = false;
  } catch (err) {
    isConnecting = false;
    console.error(`❌ MongoDB connection attempt failed: ${err.message}`);

    const isDnsError =
      err.message.includes('querySrv') ||
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('ENOTFOUND') ||
      err.message.includes('ESERVFAIL');

    // If SRV lookup failed with the default resolver, retry once with fallback DNS servers
    if (isDnsError && retryCount === 0) {
      const fallbackServers = getFallbackDnsServers();
      console.warn(`⚠️ DNS SRV lookup failed with system resolver. Retrying with fallback DNS servers: [${fallbackServers.join(', ')}]...`);
      try {
        dns.setServers(fallbackServers);
        return await connectDB(1);
      } catch (dnsErr) {
        console.error('Failed to set fallback DNS servers:', dnsErr.message);
      }
    }

    // Diagnostic troubleshooting guide
    if (err.name === 'MongooseServerSelectionError' || isDnsError) {
      console.warn('\n--- MongoDB Atlas Connection Checklist ---');
      console.warn('1. IP Whitelisting: Log in to MongoDB Atlas -> Network Access -> Add Current IP Address (or 0.0.0.0/0 for dev).');
      console.warn('2. ISP DNS Blocking: If your ISP blocks SRV records, add DNS_SERVERS=1.1.1.1,8.8.8.8 in .env');
      console.warn('3. Connection String: Alternatively, switch MONGO_URI in .env from mongodb+srv:// to the direct mongodb:// replica set string.');
      console.warn('-------------------------------------------\n');
    }

    // Rather than hard process.exit(1) which crashes the entire Node process,
    // schedule a non-blocking retry attempt after 5 seconds if not in test mode
    if (process.env.NODE_ENV !== 'test') {
      console.log('🔄 Scheduling automatic MongoDB reconnect attempt in 5 seconds...');
      setTimeout(() => connectDB(retryCount + 1), 5000);
    }
  }
};

// Lifecycle Event Listeners
mongoose.connection.on('connected', () => {
  console.log('📡 [MongoDB] Connected to database instance');
});

mongoose.connection.on('error', (err) => {
  console.error('⚠️ [MongoDB] Runtime connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('🔌 [MongoDB] Connection lost. Awaiting automatic reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 [MongoDB] Reconnected to database');
});

module.exports = connectDB;