class AppError extends Error {
  constructor(message, statusCode = 400, status = false) {
    super(message);
    this.status = status;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
