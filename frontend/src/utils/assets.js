const API_URL = import.meta.env.VITE_API_URL || '/api';

// Uploaded images are served by the API server at /uploads/…. When the API
// is on another origin, prefix that origin; otherwise stay same-origin.
export function assetUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  let origin = '';
  if (/^https?:\/\//i.test(API_URL)) {
    try { origin = new URL(API_URL).origin; } catch { origin = ''; }
  }
  return `${origin}${path}`;
}
