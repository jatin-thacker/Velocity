// tests/support/world.js
const { setWorldConstructor } = require('@cucumber/cucumber');
const path = require('node:path');

const baseExcel = require('../../src/data/adapters/excel.js');
const { DEFAULT_DATA_FILE } = require('../../src/data/adapters/excel.js');

class BcpWorld {
  constructor({ attach, parameters }) {
    this.attach = typeof attach === 'function' ? attach : async () => {};
    this.parameters = parameters || {};

    // Resolve data file: env override wins, else adapter default
    const dataFile = process.env.DATA_FILE || DEFAULT_DATA_FILE;
    baseExcel.loadWorkbook(dataFile);

    // Simple Excel accessors for steps/pages
    this.excel = {
      getRow: (sheet, where) => {
        if (!where || typeof where !== 'object') {
          throw new Error(`getRow requires an object predicate, got: ${where}`);
        }
        const keys = Object.keys(where);
        if (keys.length !== 1) {
          throw new Error(`getRow expects exactly one key, got ${JSON.stringify(where)}`);
        }
        const [key] = keys;
        return baseExcel.findRowByKey(sheet, key, where[key], {
          caseInsensitive: false,
          treatBlankAsMissing: true,
        });
      },

      getRows: (sheet, where) => {
        const rows = baseExcel.sheetToObjects(sheet);
        if (!where) return rows;
        const norm = (v) => (v == null ? '' : String(v).trim());
        return rows.filter((r) =>
          Object.entries(where).every(([k, v]) => norm(r[k]) === norm(v))
        );
      },
    };

    // Scratchpads for steps
    this.testData = {};
    this.data = { context: {} };
  }
}

setWorldConstructor(BcpWorld);
