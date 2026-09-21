import axios from 'axios';
import {
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  clearAuthTokens,
} from '../utils/secureStorage';

// Updated to point to your live Railway backend
export const BASE_URL = 'https://taskchat-app-production.up.railway.app';

const api = axios.create({ baseURL: `${BASE_URL}/api` });

// Callback registered by AuthContext to execute user logout when refresh fails
let onAuthFailureCallback = null;
export const setOnAuthFailure = (callback) => {
  onAuthFailureCallback = callback;
};

// Queue to hold requests that fail with 401 while a refresh is in progress
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor: Attach the access token from secure storage to outgoing requests
api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Catch 401s, attempt silent token refresh, and retry original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Do not intercept if no response, not 401, already retried once, or on auth endpoints
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/refresh') ||
      originalRequest?.url?.includes('/auth/logout');

    if (
      !error.response ||
      error.response.status !== 401 ||
      originalRequest?._retry ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use a separate axios call to avoid recursion through this interceptor
      const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken });

      // Save the newly rotated access and refresh tokens
      await setAuthTokens(data.token, data.refreshToken);

      // Process any queued requests with the new access token
      processQueue(null, data.token);

      // Retry the original request with the fresh access token
      originalRequest.headers.Authorization = `Bearer ${data.token}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      await clearAuthTokens();
      if (typeof onAuthFailureCallback === 'function') {
        onAuthFailureCallback();
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;