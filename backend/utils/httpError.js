// An Error that carries an HTTP status, so services can `throw` a failure
// and the central error handler turns it into the right JSON response.
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}
module.exports = { HttpError };
