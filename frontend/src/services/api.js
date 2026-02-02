/**
 * API Service for GreenGuard AI
 * Handles all backend API calls using native Fetch API
 */

import { apiCache } from './cache';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8020';
const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * Helper to perform fetch with timeout and error handling
 */
const fetchWithTimeout = async (endpoint, options = {}) => {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

export const aqiAPI = {
  // Get current AQI for a location
  getCurrentAQI: async (latitude, longitude) => {
    const cacheKey = `current-aqi-${latitude}-${longitude}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    const queryParams = new URLSearchParams({ latitude, longitude });
    const data = await fetchWithTimeout(`/api/current-aqi?${queryParams}`);

    apiCache.set(cacheKey, data);
    return data;
  },

  // Get forecast
  getForecast: async (latitude, longitude, days = 7) => {
    const cacheKey = `forecast-${latitude}-${longitude}-${days}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    const queryParams = new URLSearchParams({ latitude, longitude, days });
    const data = await fetchWithTimeout(`/api/forecast?${queryParams}`);

    apiCache.set(cacheKey, data);
    return data;
  },

  // Get recommendations
  getRecommendations: async (aqi, userType) => {
    return await fetchWithTimeout('/api/recommendations', {
      method: 'POST',
      body: JSON.stringify({
        aqi,
        user_type: userType,
      }),
    });
  },

  // Calculate travel exposure
  calculateTravelExposure: async (sourceLat, sourceLon, destLat, destLon, travelMode = 'driving') => {
    return await fetchWithTimeout('/api/travel-exposure', {
      method: 'POST',
      body: JSON.stringify({
        source_lat: sourceLat,
        source_lon: sourceLon,
        dest_lat: destLat,
        dest_lon: destLon,
        travel_mode: travelMode,
      }),
    });
  },

  // Get historical data (last 6 months)
  getHistoricalData: async (latitude, longitude) => {
    const queryParams = new URLSearchParams({ latitude, longitude });
    return await fetchWithTimeout(`/api/historical?${queryParams}`);
  },

  // Geocode location name to coordinates
  geocodeLocation: async (locationName) => {
    const queryParams = new URLSearchParams({ location: locationName });
    return await fetchWithTimeout(`/api/geocode?${queryParams}`);
  },
};

const api = {
  ...aqiAPI,
  fetch: fetchWithTimeout
};

export default api;
