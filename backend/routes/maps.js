const express = require('express');
const router = express.Router();

// Rate limit map thumbnail requests per IP to prevent scraping
const staticThumbnailHits = new Map(); // ip -> [timestamps]
const STATIC_THUMBNAIL_WINDOW_MS = 60 * 1000;
const STATIC_THUMBNAIL_MAX_PER_WINDOW = 30;

const rateLimitStaticThumbnail = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const hits = (staticThumbnailHits.get(ip) || []).filter((t) => now - t < STATIC_THUMBNAIL_WINDOW_MS);
  if (hits.length >= STATIC_THUMBNAIL_MAX_PER_WINDOW) {
    return res.status(429).json({ message: 'Too many map requests, please slow down.' });
  }
  hits.push(now);
  staticThumbnailHits.set(ip, hits);
  next();
};

// @route   GET /api/maps/static-thumbnail
// @desc    Proxies Google Static Maps image retrieval with server-side key and cache headers
// @access  Public, rate-limited per IP
router.get('/static-thumbnail', rateLimitStaticThumbnail, async (req, res) => {
  try {
    const lat = parseFloat(req.query.latitude);
    const lng = parseFloat(req.query.longitude);
    const zoom = parseInt(req.query.zoom, 10) || 15;
    const width = parseInt(req.query.width, 10) || 400;
    const height = parseInt(req.query.height, 10) || 200;
    const scale = parseInt(req.query.scale, 10) || 2;

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('[mapsRoute] GOOGLE_MAPS_API_KEY is not configured on the server.');
      return res.status(500).json({ message: 'Google Maps API key is not configured on the server.' });
    }

    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&scale=${scale}&maptype=roadmap&markers=color:red|${lat},${lng}&key=${apiKey}`;

    const googleResponse = await fetch(staticMapUrl);
    if (!googleResponse.ok) {
      const errorText = await googleResponse.text();
      console.warn('[mapsRoute] Google Static Maps API error:', googleResponse.status, errorText);
      return res.status(googleResponse.status).send(errorText || 'Failed to load static map image from Google.');
    }

    const contentType = googleResponse.headers.get('content-type') || 'image/png';
    const arrayBuffer = await googleResponse.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Length': imageBuffer.length,
    });

    return res.send(imageBuffer);
  } catch (err) {
    console.error('[mapsRoute] Error in /static-thumbnail:', err);
    return res.status(500).json({ message: 'Internal server error while generating static map thumbnail.' });
  }
});

module.exports = router;