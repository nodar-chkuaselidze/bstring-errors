/*!
 * index.js - expose library
 */

'use strict';

const bech32 = require('./bech32-sipa');
const cashaddr = require('./cashaddrerr');

module.exports = {
  bech32,
  cashaddr
};
