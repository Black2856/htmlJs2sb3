/**
 * EventBus.js
 * Simple synchronous pub/sub event bus.
 */
export class EventBus {
  constructor() {
    this._handlers = new Map(); // type -> Set<handler>
  }

  /**
   * Subscribe to an event type.
   * @param {string} type
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  on(type, handler) {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, new Set());
    }
    this._handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    const set = this._handlers.get(type);
    if (set) set.delete(handler);
  }

  /** Synchronous fan-out to all subscribers. */
  emit(type, payload) {
    const set = this._handlers.get(type);
    if (!set) return;
    // Copy to avoid mutation during iteration
    for (const handler of Array.from(set)) {
      handler(payload);
    }
  }
}
