const { normalizeKey, normRowMap } = require('../../utils/dataHelpers');

class DataBag {
  constructor(obj = {}) {
    this._raw = obj;
    this._map = normRowMap(obj); // normalized key -> raw value
  }

  /**
   * Get a value by column name (case/space/underscore-insensitive).
   * - Returns undefined for missing/blank values
   * - Supports optional aliases: DataBag.get('DateOfBirth', { aliases: ['DOB'] })
   */
  get(key, { aliases = [] } = {}) {
    const names = [key, ...aliases].map(normalizeKey);
    for (const n of names) {
      if (n in this._map) {
        const v = this._map[n];
        if (v == null) return undefined;
        const s = String(v).trim();
        if (s !== '') return s;
      }
    }
    return undefined;
  }

  has(key) { return this.get(key) !== undefined; }
  toObject() { return { ...this._raw }; }
}

module.exports = { DataBag };
