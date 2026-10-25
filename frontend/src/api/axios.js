import axios from 'axios';
import { emitSessionExpired } from '../utils/authEvents';
import { getToken, clearToken } from '../utils/session';

// Defaults to a same-origin "/api" (works with the Vite dev proxy and with
// a reverse proxy in production). Set VITE_API_URL only when the API is
// hosted on a different origin.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
});

// Each browser tab keeps its own token (see utils/session.js) and sends it
// explicitly, so different tabs can be signed in as different people.
API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 from an /auth/* endpoint (wrong password, bad OTP, no session yet on
// the initial /auth/me check) is an expected, local outcome that the calling
// form already handles. A 401 from any OTHER endpoint means a session that
// WAS valid is no longer accepted — clear the app's auth state immediately.
const AUTH_ENDPOINT_PREFIX = '/auth/';

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes(AUTH_ENDPOINT_PREFIX)) {
      clearToken();
      emitSessionExpired();
    }
    return Promise.reject(error);
  }
);

export default API;
