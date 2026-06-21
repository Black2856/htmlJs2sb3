/**
 * ListStore.js
 * Manages Scratch-compatible lists (1-indexed) for a single target.
 * Scratch equality: numeric strings compared numerically, strings case-insensitive.
 */

function scratchListEq(a, b) {
  const na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
    return na === nb;
  }
  return String(a).toLowerCase() === String(b).toLowerCase();
}

export class ListStore {
  constructor() {
    this._lists = new Map();   // name -> array
    this._visible = new Map(); // name -> bool
  }

  define(name, items = []) {
    this._lists.set(name, Array.from(items));
    this._visible.set(name, false);
  }

  has(name) {
    return this._lists.has(name);
  }

  /** Returns the internal array (no copy). */
  get(name) {
    return this._lists.get(name);
  }

  add(name, item) {
    if (!this._lists.has(name)) return;
    this._lists.get(name).push(item);
  }

  /** 1-based index; "all" clears the list. */
  deleteAt(name, index1) {
    if (!this._lists.has(name)) return;
    const arr = this._lists.get(name);
    if (index1 === 'all') {
      arr.length = 0;
      return;
    }
    const idx = Number(index1);
    if (idx < 1 || idx > arr.length || !Number.isInteger(idx)) return;
    arr.splice(idx - 1, 1);
  }

  deleteAll(name) {
    if (!this._lists.has(name)) return;
    this._lists.get(name).length = 0;
  }

  /** 1-based insert; clamps to valid range. */
  insertAt(name, index1, item) {
    if (!this._lists.has(name)) return;
    const arr = this._lists.get(name);
    let idx = Number(index1);
    if (idx < 1) idx = 1;
    if (idx > arr.length + 1) idx = arr.length + 1;
    arr.splice(idx - 1, 0, item);
  }

  /** 1-based replace; out of range is ignored. */
  replaceAt(name, index1, item) {
    if (!this._lists.has(name)) return;
    const arr = this._lists.get(name);
    const idx = Number(index1);
    if (idx < 1 || idx > arr.length) return;
    arr[idx - 1] = item;
  }

  /** 1-based; returns "" for out-of-range. */
  itemAt(name, index1) {
    if (!this._lists.has(name)) return '';
    const arr = this._lists.get(name);
    const idx = Number(index1);
    if (!Number.isFinite(idx) || idx < 1 || idx > arr.length) return '';
    return arr[Math.floor(idx) - 1];
  }

  /** Returns 1-based index; 0 if not found. Uses Scratch equality. */
  indexOf(name, item) {
    if (!this._lists.has(name)) return 0;
    const arr = this._lists.get(name);
    for (let i = 0; i < arr.length; i++) {
      if (scratchListEq(arr[i], item)) return i + 1;
    }
    return 0;
  }

  length(name) {
    if (!this._lists.has(name)) return 0;
    return this._lists.get(name).length;
  }

  contains(name, item) {
    return this.indexOf(name, item) > 0;
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
    return Array.from(this._lists.keys());
  }

  snapshot() {
    const result = {};
    for (const [name, arr] of this._lists) {
      result[name] = Array.from(arr);
    }
    return result;
  }
}
