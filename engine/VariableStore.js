/**
 * VariableStore.js
 * Manages Scratch-compatible variables for a single target.
 */
export class VariableStore {
  constructor() {
    this._vars = new Map();    // name -> value
    this._visible = new Map(); // name -> bool
  }

  define(name, value = 0) {
    this._vars.set(name, value);
    this._visible.set(name, false);
  }

  has(name) {
    return this._vars.has(name);
  }

  get(name) {
    return this._vars.has(name) ? this._vars.get(name) : 0;
  }

  set(name, value) {
    if (this._vars.has(name)) {
      this._vars.set(name, value);
    }
  }

  change(name, delta) {
    const current = Number(this.get(name));
    const d = Number(delta);
    this._vars.set(name, current + (isNaN(d) ? 0 : d));
  }

  showMonitor(name) {
    this._visible.set(name, true);
  }

  hideMonitor(name) {
    this._visible.set(name, false);
  }

  isMonitorVisible(name) {
    return this._visible.get(name) === true;
  }

  names() {
    return Array.from(this._vars.keys());
  }

  snapshot() {
    const result = {};
    for (const [name, value] of this._vars) {
      result[name] = value;
    }
    return result;
  }
}
