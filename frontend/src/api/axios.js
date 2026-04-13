import axios from 'axios';

const API = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true // Essential for sending/receiving HttpOnly cookies
});

// Interceptor for error handling (optional but good practice)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    // Catch unauthorized errors to handle session expiry
    if (error.response?.status === 401) {
      // In a real app, you might trigger a redirect to login here
    }
    return Promise.reject(error);
  }
);

export default API;
