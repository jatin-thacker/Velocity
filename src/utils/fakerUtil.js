/**
 * helpers/fakerUtil.js — Test data helper (Faker + curated static addresses)
 *
 * Usage:
 *   const faker = require('../utils/fakerUtil');
 *   const name = faker.getName();                      // { firstName, lastName, fullName }
 *   const addrON = faker.getAddress('ON');            // filter by province (code or full name)
 *   const addrAny = faker.getAddress();               // any province
 *   const n = faker.numberInRange(1_000_000, 1_500_000); // 2 decimals by default
 */

const { faker: fakerLib } = require('@faker-js/faker');
const fs = require('node:fs');
const path = require('node:path');

function tryLoadAddresses() {
  try {
    const file = path.resolve(process.cwd(), 'data', 'addresses.json');
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {
    console.warn('Could not load static addresses:', e.message);
  }
  return [];
}
const STATIC_ADDRESSES = tryLoadAddresses();

// Province normalization (supports CA codes and names; extendable)
const CA_PROVINCES = {
  ab: 'alberta', bc: 'british columbia', mb: 'manitoba', nb: 'new brunswick',
  nl: 'newfoundland and labrador', ns: 'nova scotia', nt: 'northwest territories',
  nu: 'nunavut', on: 'ontario', pe: 'prince edward island', qc: 'quebec',
  sk: 'saskatchewan', yt: 'yukon'
};
const normalizeProvince = (s) => {
  if (!s || typeof s !== 'string') return '';
  const raw = s.trim().toLowerCase();
  return CA_PROVINCES[raw] || raw;
};

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)];

class DataFaker {
  /** Return random person name parts */
  getName() {
    const firstName = fakerLib.person.firstName();
    const lastName = fakerLib.person.lastName();
    return { firstName, lastName, fullName: `${firstName} ${lastName}` };
  }

  /**
   * Return a curated static address.
   * - getAddress('QC') or getAddress('Quebec') => filter by province (case-insensitive)
   * - getAddress() => any random address
   * Returns only: street_no, street, str_name, str_type, str_dir, unit, city, postal_code, province
   */
  getAddress(province) {
    if (!Array.isArray(STATIC_ADDRESSES) || STATIC_ADDRESSES.length === 0) {
      throw new Error('No static addresses found in data/addresses.json');
    }
    let pool = STATIC_ADDRESSES;
    if (province) {
      const want = normalizeProvince(province);
      pool = STATIC_ADDRESSES.filter(a => normalizeProvince(a.province) === want);
      if (pool.length === 0) {
        throw new Error(`No addresses found for province: ${province}`);
      }
    }
    const addr = pickRandom(pool);
    const {
      street_no, street, str_name, str_type, str_dir, unit, city, postal_code, province: prov
    } = addr;
    return { street_no, street, str_name, str_type, str_dir, unit, city, postal_code, province: prov };
  }

  /** Return a random number between min and max, rounded to `decimals` places. */
  numberInRange(min, max, decimals = 2) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const rnd = Math.random() * (hi - lo) + lo;
    const factor = Math.pow(10, decimals);
    return Math.round(rnd * factor) / factor;
  }

  getFirstName() { return fakerLib.person.firstName(); }
  getLastName()  { return fakerLib.person.lastName(); }
  getEmail()     { return fakerLib.internet.email(); }
}

module.exports = new DataFaker();
module.exports.DataFaker = DataFaker;

