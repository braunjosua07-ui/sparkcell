// src/utils/ErrorHandler.js
export class ErrorHandler {
  constructor(logger) {
    this.logger = logger;
  }

  async safeAsync(fn, fallback = null, context = '') {
    try {
      return await fn();
    } catch (error) {
      if (this.logger) {
        this.logger.error(`[${context}] ${error.message}`);
      }
      return typeof fallback === 'function' ? fallback(error) : fallback;
    }
  }

  wrapMethod(obj, methodName, context) {
    const original = obj[methodName].bind(obj);
    obj[methodName] = (...args) =>
      this.safeAsync(() => original(...args), null, `${context}.${methodName}`);
  }
}
