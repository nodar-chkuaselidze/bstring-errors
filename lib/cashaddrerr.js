/*!
 * cashadderr.js - naive implementation for cash addr error detection
 * Detects up to 2 errors.
 * Based on Amaurys `cashaddressed` - https://github.com/deadalnix/cashaddressed
 * Copyright (c) 2018, Chkuaselidze Nodari (MIT License)
 */
'use strict';

const {U64} = require('n64');
const cashaddr = require('./cashaddr');
const {deserialize, polymod, ChecksumError} = cashaddr;

/**
 * Locate up to 2 errors in address.
 * This could also correct up 2 to errors, but it's not
 * recommended, so we won't be fixing address.
 * @param {String} address - cashaddr
 * @param {String} defaultPrefix
 * @returns {Array} - array of error positions
 * @throws Error - if it could not locate errors and address is incorrect.
 */

exports.locateErrors = function locateErrors(address, defaultPrefix) {
  let data, checksum;

  try {
    deserialize(address, defaultPrefix);

    return [];
  } catch (e) {
    if (!(e instanceof ChecksumError))
      throw e;

    data = e.data;
    checksum = e.checksum;
  }

  const syndromes = new Map();

  // collect syndromes or detect one error
  for (let p = 0; p < data.length; p++) {
    for (let e = 1; e < 32; e++) {
      data[p] ^= e;

      const c = polymod(data);

      // did `e` fix ?
      if (c.eqn(0))
        return [p];

      syndromes.set(checksum.xor(c).toString(), p);

      // recover for later tests
      data[p] ^= e;
    }
  }

  for (const [s, p] of syndromes.entries()) {
    const s1 = U64.fromString(s).xor(checksum).toString();
    const s1p = syndromes.get(s1);

    if (s1p)
      return [p, s1p];
  }

  throw new Error('Could not find error locations.');
};
