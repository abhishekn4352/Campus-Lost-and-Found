// Turns an Axios error into a short, friendly, user-facing message.
// Priority: a real message the backend sent us > a status-code-based
// fallback > a generic fallback. Never surfaces raw stack traces, Mongo/
// Mongoose error text, or "Network Error"-style Axios internals.
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  // Backend responded with a JSON body containing a message — the
  // backend's global error handler and every controller already produce
  // clean, human-readable messages, so this is normally the best source.
  const serverMessage = err?.response?.data?.message;
  if (serverMessage && typeof serverMessage === 'string') {
    return serverMessage;
  }

  const status = err?.response?.status;
  if (status) {
    switch (status) {
      case 400: return fallback;
      case 401: return 'Your session has expired. Please sign in again.';
      case 403: return "You don't have permission to do that.";
      case 404: return "We couldn't find what you were looking for.";
      case 409: return 'That already exists.';
      case 422: return 'Please check your details and try again.';
      case 429: return 'Too many attempts. Please wait a moment before trying again.';
      case 500:
      case 502:
      case 503:
        return 'Something went wrong on our server. Please try again shortly.';
      default: return fallback;
    }
  }

  // err.request exists but no err.response => request was sent but no
  // response ever came back (dropped connection, CORS block, timeout).
  if (err?.request) {
    return 'Unable to reach the server. Please check your internet connection and try again.';
  }

  return fallback;
}
