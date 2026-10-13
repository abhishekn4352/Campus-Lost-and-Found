// Wraps an async Express handler so rejected promises are forwarded to
// next(err) instead of becoming unhandled promise rejections (which,
// left unhandled, can crash the whole process on a bad request such as
// a malformed ObjectId).
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Central error handler. Must be registered LAST, after all routes.
// Keeps error responses consistent and never leaks stack traces/internal
// details in production, while still logging full details server-side
// for debugging.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Server error';

  // Mongoose invalid ObjectId (CastError) -> 404 instead of 500
  if (err.name === 'CastError') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Mongoose validation errors -> 400 with readable message
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // MongoDB duplicate key error -> 400 friendly message instead of raw E11000 text
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `An account with that ${field} already exists.`;
  }

  // Multer errors (file too large, etc.)
  if (err.name === 'MulterError') {
    statusCode = 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image is too large (max 5MB).'
      : err.message;
  }

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
};

module.exports = { asyncHandler, errorHandler, notFound };
