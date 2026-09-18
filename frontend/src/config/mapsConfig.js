import { BASE_URL } from '../api/client';

// Haversine formula for distance in meters
export const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export const formatDistance = (meters) => {
    if (!meters && meters !== 0) return '';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
};

// Builds a backend static map image proxy URL centered on coordinates.
// The Google Maps API key is kept server-side and never bundled in client JS.
export const buildStaticMapUrl = (latitude, longitude, options = {}) => {
    if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
        return null;
    }

    const {
        zoom = 15,
        width = 400,
        height = 200,
        scale = 2,
    } = options;

    const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        zoom: String(zoom),
        width: String(width),
        height: String(height),
        scale: String(scale),
    });

    return `${BASE_URL}/api/maps/static-thumbnail?${params.toString()}`;
};

export default {
    calcDistance,
    formatDistance,
    buildStaticMapUrl,
};