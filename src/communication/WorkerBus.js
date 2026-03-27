/**
 * WorkerBus — Pub/Sub event bus with wildcard namespace support.
 *
 * Supports exact event matches and wildcard patterns ending with ':*',
 * e.g. 'agent:*' matches any event whose name starts with 'agent:'.
 */
export class WorkerBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event or wildcard pattern.
   * @param {string} event - Exact name or pattern ending in ':*'
   * @param {Function} callback - Called with (data) when matching event fires
   * @returns {Function} Unsubscribe function
   */
  subscribe(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);

    return () => {
      const set = this._listeners.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this._listeners.delete(event);
        }
      }
    };
  }

  /**
   * Publish an event, delivering to exact matches and wildcard subscribers.
   * @param {string} event - The event name
   * @param {*} data - Payload passed to each subscriber
   */
  publish(event, data) {
    for (const [pattern, callbacks] of this._listeners) {
      const matches =
        pattern === event ||
        (pattern.endsWith(':*') && event.startsWith(pattern.slice(0, -1)));

      if (matches) {
        for (const cb of callbacks) {
          cb(data);
        }
      }
    }
  }
}
