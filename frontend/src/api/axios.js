import axios from 'axios';
import { emitSessionExpired } from '../utils/authEvents';

// Defaults to a same-origin "/api" (works with the Vite dev proxy and with
// a reverse proxy in production). Set VITE_API_URL only when the API is
// hosted on a different origin.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true, // send/receive the HttpOnly session cookie
  timeout: 20000,
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
      emitSessionExpired();
    }
    return Promise.reject(error);
  }
);

export default API;
