import axios from 'axios';
import { emitSessionExpired } from '../utils/authEvents';

const API = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true // Essential for sending/receiving HttpOnly cookies
});

// A 401 from an /auth/* endpoint (wrong password, bad/expired OTP, no
// token yet on the initial /auth/me check) is an expected, local outcome
// that the calling form already handles in its own catch block. A 401
// from any OTHER endpoint means a session that WAS valid is no longer
// accepted by the server (expired/invalid cookie) — that case needs to
// clear the app's auth state immediately, or the UI is left showing a
// "logged in" user whose every request silently fails.
const AUTH_ENDPOINT_PREFIX = '/auth/';

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes(AUTH_ENDPOINT_PREFIX);
    if (error.response?.status === 401 && !isAuthEndpoint) {
      emitSessionExpired();
    }
    return Promise.reject(error);
  }
);

export default API;
